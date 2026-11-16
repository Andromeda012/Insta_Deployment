-- ============================================================================
-- GLOBAL MOBİLYA — MODULE 8: ATOMIC PRODUCTION JOB QUEUE & EGRESS FIX
-- Migration: 20261112130000_module8_atomic_queue_and_egress_fix.sql
-- ============================================================================

BEGIN;

-- 1. UPGRADE public.production_jobs COLUMNS
ALTER TABLE public.production_jobs
  ADD COLUMN IF NOT EXISTS input_model_path TEXT,
  ADD COLUMN IF NOT EXISTS output_render_path TEXT,
  ADD COLUMN IF NOT EXISTS output_public_url TEXT,
  ADD COLUMN IF NOT EXISTS render_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_details JSONB;

-- Update constraints
ALTER TABLE public.production_jobs
  DROP CONSTRAINT IF EXISTS production_jobs_status_check;

ALTER TABLE public.production_jobs
  ADD CONSTRAINT production_jobs_status_check CHECK (status IN (
    'pending', 'queued', 'processing', 'rendering', 'uploading', 'encoding',
    'quality_check', 'completed', 'failed', 'cancelled'
  ));

ALTER TABLE public.production_jobs
  DROP CONSTRAINT IF EXISTS production_jobs_production_type_check;

ALTER TABLE public.production_jobs
  ADD CONSTRAINT production_jobs_production_type_check CHECK (production_type IN (
    'image_enhance', 'image_enhancement', 'background_removal', 'background_processing',
    '3d_reconstruction', 'image_to_3d', 'photogrammetry',
    '3d_render', 'blender_render', 'cinematic_render', 'cinematic_video',
    'multi_format_transcode', 'video_editing', 'media_export',
    'texture_synthesis', 'benchmark_test', 'multi_platform_video'
  ));

CREATE INDEX IF NOT EXISTS idx_prod_jobs_queue_claim
  ON public.production_jobs(status, created_at, lease_expires_at)
  WHERE status IN ('pending', 'queued', 'processing', 'rendering', 'uploading');

CREATE INDEX IF NOT EXISTS idx_prod_jobs_worker_lease
  ON public.production_jobs(worker_id, lease_expires_at)
  WHERE worker_id IS NOT NULL;

-- 2. GRANTS TO service_role
GRANT ALL ON public.production_jobs TO service_role;
GRANT ALL ON public.media_assets TO service_role;
GRANT ALL ON public.three_d_assets TO service_role;
GRANT ALL ON public.production_outputs TO service_role;
GRANT ALL ON public.production_events TO service_role;
GRANT ALL ON public.production_costs TO service_role;
GRANT ALL ON public.scene_templates TO service_role;

-- 3. FUNCTION: claim_next_production_job
CREATE OR REPLACE FUNCTION public.claim_next_production_job(
  p_worker_id TEXT,
  p_supported_engines TEXT[] DEFAULT ARRAY['blender_headless'],
  p_lease_seconds INT DEFAULT 360
)
RETURNS SETOF public.production_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job_id UUID;
  v_rows INT;
BEGIN
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0
     OR p_lease_seconds < 10 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'Invalid worker_id or lease_seconds parameter';
  END IF;

  -- Step A: Fail stale jobs whose lease expired and retry_count >= max_retries
  UPDATE public.production_jobs j
  SET status = 'failed',
      worker_id = NULL,
      lease_expires_at = NULL,
      completed_at = NOW(),
      error_code = 'LEASE_EXPIRED_MAX_RETRIES',
      error_message = concat_ws(' ', NULLIF(j.error_message, ''), '[Worker lease expired; max_retries exhausted]'),
      updated_at = NOW()
  WHERE j.status IN ('processing', 'rendering', 'uploading')
    AND j.lease_expires_at IS NOT NULL
    AND j.lease_expires_at <= NOW()
    AND j.retry_count >= j.max_retries;

  -- Step B: Requeue stale jobs whose lease expired and retry_count < max_retries
  UPDATE public.production_jobs j
  SET status = 'pending',
      worker_id = NULL,
      lease_expires_at = NULL,
      retry_count = j.retry_count + 1,
      error_message = concat_ws(' ', NULLIF(j.error_message, ''), '[Worker lease expired; automatically requeued]'),
      updated_at = NOW()
  WHERE j.status IN ('processing', 'rendering', 'uploading')
    AND j.lease_expires_at IS NOT NULL
    AND j.lease_expires_at <= NOW()
    AND j.retry_count < j.max_retries;

  -- Step C: Atomically select & lock the next pending/queued job (FOR UPDATE SKIP LOCKED)
  -- Exclude AI 3D reconstruction jobs from blender worker queue
  SELECT j.id INTO v_job_id
  FROM public.production_jobs j
  WHERE j.status IN ('pending', 'queued')
    AND j.selected_engine <> 'ai_3d_recon'
    AND j.production_type NOT IN ('3d_reconstruction', 'image_to_3d', 'photogrammetry')
    AND (p_supported_engines IS NULL OR array_length(p_supported_engines, 1) IS NULL OR j.selected_engine = ANY(p_supported_engines))
  ORDER BY j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  -- Step D: Transition to 'processing' and assign worker lease
  UPDATE public.production_jobs j
  SET status = 'processing',
      worker_id = p_worker_id,
      started_at = COALESCE(j.started_at, NOW()),
      lease_expires_at = NOW() + make_interval(secs => p_lease_seconds),
      progress_percent = GREATEST(COALESCE(j.progress_percent, 0), 5),
      updated_at = NOW()
  WHERE j.id = v_job_id
    AND j.status IN ('pending', 'queued');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RETURN;
  END IF;

  INSERT INTO public.production_events (id, job_id, event_type, event_details, created_at)
  VALUES (
    gen_random_uuid(),
    v_job_id,
    'worker_claimed',
    jsonb_build_object('worker_id', p_worker_id, 'lease_seconds', p_lease_seconds),
    NOW()
  );

  RETURN QUERY
  SELECT * FROM public.production_jobs WHERE id = v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_production_job(TEXT, TEXT[], INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_production_job(TEXT, TEXT[], INT) TO service_role;

-- 4. FUNCTION: extend_production_job_lease
CREATE OR REPLACE FUNCTION public.extend_production_job_lease(
  p_job_id UUID,
  p_worker_id TEXT,
  p_status TEXT DEFAULT 'processing',
  p_progress_percent INT DEFAULT NULL,
  p_extra_seconds INT DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows INT;
BEGIN
  IF p_extra_seconds < 10 OR p_extra_seconds > 3600 THEN
    RETURN FALSE;
  END IF;
  IF p_status NOT IN ('processing', 'rendering', 'uploading', 'encoding', 'quality_check') THEN
    RETURN FALSE;
  END IF;

  UPDATE public.production_jobs j
  SET status = p_status,
      progress_percent = COALESCE(p_progress_percent, j.progress_percent),
      lease_expires_at = NOW() + make_interval(secs => p_extra_seconds),
      updated_at = NOW()
  WHERE j.id = p_job_id
    AND j.worker_id = p_worker_id
    AND j.status IN ('processing', 'rendering', 'uploading', 'encoding', 'quality_check');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.extend_production_job_lease(UUID, TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_production_job_lease(UUID, TEXT, TEXT, INT, INT) TO service_role;

-- 5. FUNCTION: complete_production_job
CREATE OR REPLACE FUNCTION public.complete_production_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_output_render_path TEXT DEFAULT NULL,
  p_output_public_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE public.production_jobs j
  SET status = 'completed',
      progress_percent = 100,
      lease_expires_at = NULL,
      error_code = NULL,
      error_message = NULL,
      output_render_path = COALESCE(p_output_render_path, j.output_render_path),
      output_public_url = COALESCE(p_output_public_url, j.output_public_url),
      completed_at = NOW(),
      updated_at = NOW()
  WHERE j.id = p_job_id
    AND (j.worker_id = p_worker_id OR j.worker_id IS NULL)
    AND j.status NOT IN ('completed', 'cancelled');

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 1 THEN
    INSERT INTO public.production_events (id, job_id, event_type, event_details, created_at)
    VALUES (
      gen_random_uuid(),
      p_job_id,
      'worker_completed',
      jsonb_build_object('worker_id', p_worker_id, 'output_render_path', p_output_render_path, 'output_public_url', p_output_public_url),
      NOW()
    );
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_production_job(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_production_job(UUID, TEXT, TEXT, TEXT) TO service_role;

-- 6. FUNCTION: fail_production_job
CREATE OR REPLACE FUNCTION public.fail_production_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_error_code TEXT DEFAULT 'RENDER_ERROR',
  p_error_message TEXT DEFAULT 'Render error',
  p_error_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE public.production_jobs j
  SET status = 'failed',
      lease_expires_at = NULL,
      error_code = p_error_code,
      error_message = p_error_message,
      error_details = p_error_details,
      completed_at = NOW(),
      updated_at = NOW()
  WHERE j.id = p_job_id
    AND (j.worker_id = p_worker_id OR j.worker_id IS NULL)
    AND j.status <> 'completed';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 1 THEN
    INSERT INTO public.production_events (id, job_id, event_type, event_details, error_details, created_at)
    VALUES (
      gen_random_uuid(),
      p_job_id,
      'worker_failed',
      jsonb_build_object('worker_id', p_worker_id, 'code', p_error_code, 'message', p_error_message),
      COALESCE(p_error_details::text, p_error_message),
      NOW()
    );
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_production_job(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_production_job(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- 7. FUNCTION: retry_production_job
CREATE OR REPLACE FUNCTION public.retry_production_job(
  p_job_id UUID,
  p_max_retries INT DEFAULT 3
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE public.production_jobs j
  SET status = 'pending',
      worker_id = NULL,
      lease_expires_at = NULL,
      retry_count = COALESCE(j.retry_count, 0) + 1,
      max_retries = GREATEST(COALESCE(j.max_retries, p_max_retries), p_max_retries),
      error_code = NULL,
      error_message = NULL,
      error_details = NULL,
      completed_at = NULL,
      updated_at = NOW()
  WHERE j.id = p_job_id
    AND j.status IN ('failed', 'cancelled');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_production_job(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_production_job(UUID, INT) TO service_role;

COMMIT;

-- ============================================================================
-- GLOBAL MOBİLYA — MODULE 8: SUPABASE STORAGE & PRODUCTION JOB QUEUE RPCs
-- ============================================================================
-- Provides:
-- 1. Idempotent column & constraint upgrades for public.production_jobs
-- 2. Storage RLS policies for bucket 'media' under 'studio/' prefix
-- 3. Atomic job queue claiming (FOR UPDATE SKIP LOCKED) & stale lease recovery
-- 4. Lease extension, completion, and failure RPC functions for Render Worker
-- ============================================================================

BEGIN;

-- ── 1. IDEMPOTENT COLUMN UPGRADES FOR public.production_jobs ─────────────────
ALTER TABLE public.production_jobs
  ADD COLUMN IF NOT EXISTS input_model_path TEXT,
  ADD COLUMN IF NOT EXISTS output_render_path TEXT,
  ADD COLUMN IF NOT EXISTS output_public_url TEXT,
  ADD COLUMN IF NOT EXISTS render_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT;

-- Drop old check constraints if they exist and replace with unified lifecycle constraints
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
    'texture_synthesis', 'benchmark_test'
  ));

CREATE INDEX IF NOT EXISTS idx_prod_jobs_queue_claim
  ON public.production_jobs(status, created_at, lease_expires_at)
  WHERE status IN ('pending', 'queued', 'processing', 'rendering', 'uploading');

-- Grant service_role full access for headless Render Worker
GRANT ALL ON public.production_jobs TO service_role;
GRANT ALL ON public.media_assets TO service_role;
GRANT ALL ON public.production_outputs TO service_role;
GRANT ALL ON public.production_events TO service_role;
GRANT ALL ON public.production_costs TO service_role;

-- ── 2. STORAGE BUCKET ('media' -> 'studio/') RLS POLICIES ────────────────────
DROP POLICY IF EXISTS "Module 8 public read studio renders" ON storage.objects;
CREATE POLICY "Module 8 public read studio renders"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'media' AND coalesce((storage.foldername(name))[1], '') = 'studio');

DROP POLICY IF EXISTS "Module 8 managers upload studio media" ON storage.objects;
CREATE POLICY "Module 8 managers upload studio media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND coalesce((storage.foldername(name))[1], '') = 'studio'
    AND coalesce((auth.jwt()->'app_metadata'->>'role'), '') IN ('admin', 'production_manager', 'content_manager')
  );

DROP POLICY IF EXISTS "Module 8 managers update studio media" ON storage.objects;
CREATE POLICY "Module 8 managers update studio media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND coalesce((storage.foldername(name))[1], '') = 'studio'
    AND coalesce((auth.jwt()->'app_metadata'->>'role'), '') IN ('admin', 'production_manager', 'content_manager')
  )
  WITH CHECK (
    bucket_id = 'media'
    AND coalesce((storage.foldername(name))[1], '') = 'studio'
    AND coalesce((auth.jwt()->'app_metadata'->>'role'), '') IN ('admin', 'production_manager', 'content_manager')
  );

DROP POLICY IF EXISTS "Module 8 managers delete studio media" ON storage.objects;
CREATE POLICY "Module 8 managers delete studio media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND coalesce((storage.foldername(name))[1], '') = 'studio'
    AND coalesce((auth.jwt()->'app_metadata'->>'role'), '') IN ('admin', 'production_manager')
  );

-- ── 3. ATOMIC JOB CLAIM & STALE LEASE RECOVERY RPC ───────────────────────────
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
     OR p_lease_seconds < 30 OR p_lease_seconds > 1800 THEN
    RAISE EXCEPTION 'Invalid worker_id or lease_seconds parameter';
  END IF;

  -- Step A: Permanently fail stale jobs whose lease expired and retry_count >= max_retries
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
  SELECT j.id INTO v_job_id
  FROM public.production_jobs j
  WHERE j.status IN ('pending', 'queued')
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

  INSERT INTO public.production_events (job_id, event_type, event_details)
  VALUES (v_job_id, 'worker_claimed', jsonb_build_object('worker_id', p_worker_id, 'lease_seconds', p_lease_seconds));

  RETURN QUERY
  SELECT * FROM public.production_jobs WHERE id = v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_production_job(TEXT, TEXT[], INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_production_job(TEXT, TEXT[], INT) TO service_role;

-- ── 4. LEASE EXTENSION / PROGRESS HEARTBEAT RPC ──────────────────────────────
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
  IF p_extra_seconds < 15 OR p_extra_seconds > 1800 THEN
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

COMMIT;

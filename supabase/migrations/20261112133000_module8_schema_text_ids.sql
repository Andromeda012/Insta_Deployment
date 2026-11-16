-- ============================================================================
-- GLOBAL MOBİLYA — MODULE 8: SCHEMA REFACTOR TO UNIVERSAL TEXT IDs
-- Migration: 20261112133000_module8_schema_text_ids.sql
-- ============================================================================

BEGIN;

-- Drop dependent constraints and tables in safe order
DROP TABLE IF EXISTS public.production_outputs CASCADE;
DROP TABLE IF EXISTS public.production_events CASCADE;
DROP TABLE IF EXISTS public.production_costs CASCADE;
DROP TABLE IF EXISTS public.scene_templates CASCADE;
DROP TABLE IF EXISTS public.three_d_assets CASCADE;
DROP TABLE IF EXISTS public.media_assets CASCADE;
DROP TABLE IF EXISTS public.production_jobs CASCADE;

-- 1. public.production_jobs
CREATE TABLE public.production_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_slug TEXT,
  collection_id TEXT,
  production_type TEXT NOT NULL,
  pipeline_type TEXT NOT NULL DEFAULT 'standard',
  selected_engine TEXT NOT NULL,
  config_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  render_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  progress_percent INT DEFAULT 0,
  worker_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  input_model_path TEXT,
  output_render_path TEXT,
  output_public_url TEXT,
  error_code TEXT,
  error_message TEXT,
  error_details JSONB,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT production_jobs_status_check CHECK (status IN (
    'pending', 'queued', 'processing', 'rendering', 'uploading', 'encoding',
    'quality_check', 'completed', 'failed', 'cancelled'
  ))
);

-- 2. public.media_assets
CREATE TABLE public.media_assets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id TEXT,
  product_slug TEXT,
  collection_id TEXT,
  asset_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT DEFAULT 0,
  width_px INT,
  height_px INT,
  duration_seconds NUMERIC,
  source_asset_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  version INT DEFAULT 1,
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. public.three_d_assets
CREATE TABLE public.three_d_assets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_slug TEXT NOT NULL,
  product_name TEXT,
  product_id TEXT,
  status TEXT DEFAULT 'completed',
  model_asset_id TEXT,
  model_format TEXT NOT NULL DEFAULT 'glb',
  source_type TEXT NOT NULL DEFAULT 'ai_reconstruction',
  provider TEXT,
  provider_model TEXT,
  provider_task_id TEXT,
  storage_path TEXT,
  public_url TEXT,
  source_image_url TEXT,
  source_image_path TEXT,
  generated_model_url TEXT,
  generated_model_path TEXT,
  geometry_validation_status TEXT,
  polygon_count INT,
  mesh_count INT,
  material_count INT,
  material_status TEXT,
  scale_factor NUMERIC,
  dimensions_cm JSONB,
  generation_settings JSONB DEFAULT '{}'::jsonb,
  is_validated BOOLEAN DEFAULT TRUE,
  blender_ready BOOLEAN DEFAULT TRUE,
  consumed_credits NUMERIC DEFAULT 0,
  estimated_cost NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  version INT DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. public.production_outputs
CREATE TABLE public.production_outputs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id TEXT NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  media_asset_id TEXT,
  storage_path TEXT,
  public_url TEXT,
  file_name TEXT,
  file_size_bytes BIGINT DEFAULT 0,
  output_type TEXT NOT NULL DEFAULT 'hero_still',
  file_format TEXT NOT NULL DEFAULT 'jpg',
  resolution_label TEXT,
  width_px INT,
  height_px INT,
  duration_seconds NUMERIC,
  quality_status TEXT DEFAULT 'pending',
  quality_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. public.production_events
CREATE TABLE public.production_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id TEXT NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_details JSONB,
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. public.production_costs
CREATE TABLE public.production_costs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id TEXT REFERENCES public.production_jobs(id) ON DELETE SET NULL,
  provider_name TEXT NOT NULL,
  compute_device TEXT,
  processing_duration_ms BIGINT,
  gpu_type TEXT,
  gpu_seconds_used NUMERIC DEFAULT 0,
  cpu_seconds_used NUMERIC DEFAULT 0,
  api_calls_count INT DEFAULT 1,
  consumed_credits NUMERIC DEFAULT 0,
  cost_amount NUMERIC DEFAULT 0,
  cost_measured BOOLEAN DEFAULT FALSE,
  storage_bytes_added BIGINT DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. public.scene_templates
CREATE TABLE public.scene_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scene_slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  collection_id TEXT,
  environment_theme TEXT NOT NULL,
  blend_file_asset_id TEXT,
  lighting_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  camera_presets JSONB NOT NULL DEFAULT '[]'::jsonb,
  render_engine_type TEXT NOT NULL DEFAULT 'cycles',
  samples_preset INT DEFAULT 64,
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDICES
CREATE INDEX idx_prod_jobs_queue_claim
  ON public.production_jobs(status, created_at, lease_expires_at)
  WHERE status IN ('pending', 'queued', 'processing', 'rendering', 'uploading');

CREATE INDEX idx_prod_jobs_worker_lease
  ON public.production_jobs(worker_id, lease_expires_at)
  WHERE worker_id IS NOT NULL;

CREATE INDEX idx_media_assets_job
  ON public.media_assets(job_id)
  WHERE job_id IS NOT NULL;

CREATE INDEX idx_prod_outputs_job
  ON public.production_outputs(job_id);

CREATE INDEX idx_prod_events_job
  ON public.production_events(job_id);

CREATE INDEX idx_prod_costs_job
  ON public.production_costs(job_id)
  WHERE job_id IS NOT NULL;

-- GRANTS
GRANT ALL ON public.production_jobs TO service_role;
GRANT ALL ON public.media_assets TO service_role;
GRANT ALL ON public.three_d_assets TO service_role;
GRANT ALL ON public.production_outputs TO service_role;
GRANT ALL ON public.production_events TO service_role;
GRANT ALL ON public.production_costs TO service_role;
GRANT ALL ON public.scene_templates TO service_role;

GRANT SELECT ON public.production_jobs TO authenticated, anon;
GRANT SELECT ON public.media_assets TO authenticated, anon;
GRANT SELECT ON public.three_d_assets TO authenticated, anon;
GRANT SELECT ON public.production_outputs TO authenticated, anon;
GRANT SELECT ON public.production_events TO authenticated, anon;
GRANT SELECT ON public.production_costs TO authenticated, anon;
GRANT SELECT ON public.scene_templates TO authenticated, anon;

-- RPC: claim_next_production_job
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
  v_job_id TEXT;
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

  -- Step C: Atomically select & lock the next pending/queued job
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
    gen_random_uuid()::text,
    v_job_id,
    'worker_claimed',
    jsonb_build_object('worker_id', p_worker_id, 'lease_seconds', p_lease_seconds),
    NOW()
  );

  RETURN QUERY
  SELECT * FROM public.production_jobs WHERE id = v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_production_job(TEXT, TEXT[], INT) TO service_role;

-- RPC: extend_production_job_lease
CREATE OR REPLACE FUNCTION public.extend_production_job_lease(
  p_job_id TEXT,
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

-- Overload with p_extension_seconds
CREATE OR REPLACE FUNCTION public.extend_production_job_lease(
  p_job_id TEXT,
  p_worker_id TEXT,
  p_extension_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN public.extend_production_job_lease(
    p_job_id := p_job_id,
    p_worker_id := p_worker_id,
    p_status := 'processing',
    p_progress_percent := NULL,
    p_extra_seconds := p_extension_seconds
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_production_job_lease(TEXT, TEXT, TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.extend_production_job_lease(TEXT, TEXT, INT) TO service_role;

-- RPC: complete_production_job
CREATE OR REPLACE FUNCTION public.complete_production_job(
  p_job_id TEXT,
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
      gen_random_uuid()::text,
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

GRANT EXECUTE ON FUNCTION public.complete_production_job(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- RPC: fail_production_job
CREATE OR REPLACE FUNCTION public.fail_production_job(
  p_job_id TEXT,
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
      gen_random_uuid()::text,
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

GRANT EXECUTE ON FUNCTION public.fail_production_job(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- RPC: retry_production_job
CREATE OR REPLACE FUNCTION public.retry_production_job(
  p_job_id TEXT,
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

GRANT EXECUTE ON FUNCTION public.retry_production_job(TEXT, INT) TO service_role;

COMMIT;

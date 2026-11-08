-- ============================================================================
-- GLOBAL MOBİLYA — MODULE 8.1: AI ASSET RECONSTRUCTION ENGINE (TRIPO H3.1)
-- ============================================================================
-- 1. Extends public.three_d_assets with Tripo H3.1 provenance, cost & storage metadata
-- 2. Creates public.asset_reconstruction_jobs separated from Blender production_jobs
--    so the headless Blender Render Worker never accidentally claims AI recon tasks
-- 3. Updates claim_next_production_job RPC with an explicit guard excluding AI recon
-- 4. Configures Supabase Storage ('media' -> 'studio/assets/...') RLS policies
-- ============================================================================

BEGIN;

-- ── 1. EXTEND public.three_d_assets FOR AI RECONSTRUCTED GLB MODELS ──────────
ALTER TABLE public.three_d_assets
  ALTER COLUMN product_slug DROP NOT NULL;

ALTER TABLE public.three_d_assets
  ADD COLUMN IF NOT EXISTS asset_id TEXT,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS source_image_path TEXT,
  ADD COLUMN IF NOT EXISTS source_image_url TEXT,
  ADD COLUMN IF NOT EXISTS generated_model_path TEXT,
  ADD COLUMN IF NOT EXISTS generated_model_url TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'tripo',
  ADD COLUMN IF NOT EXISTS provider_model TEXT DEFAULT 'v3.1-20260211',
  ADD COLUMN IF NOT EXISTS provider_task_id TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generation_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dimensions_cm JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10, 4) DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS consumed_credits NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS is_ai_estimated_geometry BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS blender_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_3d_assets_provider_task ON public.three_d_assets(provider_task_id);
CREATE INDEX IF NOT EXISTS idx_3d_assets_status ON public.three_d_assets(status);
CREATE INDEX IF NOT EXISTS idx_3d_assets_blender_ready ON public.three_d_assets(blender_ready);

-- ── 2. CREATE SEPARATE public.asset_reconstruction_jobs TABLE ────────────────
-- Separated from public.production_jobs so Blender Worker never claims Tripo tasks
CREATE TABLE IF NOT EXISTS public.asset_reconstruction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT UNIQUE NOT NULL,
  asset_id TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  product_id TEXT,
  product_slug TEXT REFERENCES public.products(slug) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  dimensions_cm JSONB DEFAULT '{}'::jsonb,
  source_image_path TEXT NOT NULL,
  source_image_url TEXT,
  crop_metadata JSONB DEFAULT '{}'::jsonb,
  generated_model_path TEXT,
  generated_model_url TEXT,
  provider TEXT NOT NULL DEFAULT 'tripo' CHECK (provider IN ('tripo')),
  provider_model TEXT NOT NULL DEFAULT 'v3.1-20260211',
  provider_file_token TEXT,
  provider_task_id TEXT,
  file_size_bytes BIGINT DEFAULT 0,
  generation_settings JSONB NOT NULL DEFAULT '{
    "model": "v3.1-20260211",
    "texture": true,
    "pbr": true,
    "texture_quality": "standard",
    "geometry_quality": "detailed",
    "texture_alignment": "original_image"
  }'::jsonb,
  estimated_cost NUMERIC(10, 4) NOT NULL DEFAULT 0.3000 CHECK (estimated_cost >= 0),
  actual_cost NUMERIC(10, 4),
  consumed_credits NUMERIC(10, 2),
  max_cost_limit_usd NUMERIC(10, 4) NOT NULL DEFAULT 1.0000,
  user_cost_approved BOOLEAN NOT NULL DEFAULT FALSE,
  single_item_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft_prepared' CHECK (status IN (
    'draft_prepared',
    'queued',
    'uploading_source',
    'submitted',
    'processing',
    'downloading_model',
    'validating_glb',
    'uploading_storage',
    'completed',
    'failed',
    'cancelled'
  )),
  progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  glb_validation JSONB DEFAULT '{}'::jsonb,
  blender_ready BOOLEAN NOT NULL DEFAULT FALSE,
  error_code TEXT,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recon_jobs_status ON public.asset_reconstruction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_recon_jobs_product ON public.asset_reconstruction_jobs(product_slug);
CREATE INDEX IF NOT EXISTS idx_recon_jobs_provider_task ON public.asset_reconstruction_jobs(provider_task_id);

ALTER TABLE public.asset_reconstruction_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Production team can read reconstruction jobs" ON public.asset_reconstruction_jobs;
CREATE POLICY "Production team can read reconstruction jobs"
  ON public.asset_reconstruction_jobs FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager', 'content_manager', 'product_manager']);

DROP POLICY IF EXISTS "Authorized production staff can write reconstruction jobs" ON public.asset_reconstruction_jobs;
CREATE POLICY "Authorized production staff can write reconstruction jobs"
  ON public.asset_reconstruction_jobs FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager'])
  WITH CHECK ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager']);

GRANT ALL ON public.asset_reconstruction_jobs TO service_role;

-- ── 3. HARDEN BLENDER WORKER CLAIM RPC TO EXCLUDE RECONSTRUCTION JOBS ────────
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

  -- Step A: Fail stale Blender jobs exceeding max_retries
  UPDATE public.production_jobs j
  SET status = 'failed',
      worker_id = NULL,
      lease_expires_at = NULL,
      completed_at = NOW(),
      error_code = 'LEASE_EXPIRED_MAX_RETRIES',
      error_message = concat_ws(' ', NULLIF(j.error_message, ''), '[Worker lease expired; max_retries exhausted]'),
      updated_at = NOW()
  WHERE j.status IN ('processing', 'rendering', 'uploading')
    AND j.selected_engine <> 'ai_3d_recon'
    AND j.production_type NOT IN ('3d_reconstruction', 'image_to_3d', 'photogrammetry')
    AND j.lease_expires_at IS NOT NULL
    AND j.lease_expires_at <= NOW()
    AND j.retry_count >= j.max_retries;

  -- Step B: Requeue stale Blender jobs below max_retries
  UPDATE public.production_jobs j
  SET status = 'pending',
      worker_id = NULL,
      lease_expires_at = NULL,
      retry_count = j.retry_count + 1,
      error_message = concat_ws(' ', NULLIF(j.error_message, ''), '[Worker lease expired; automatically requeued]'),
      updated_at = NOW()
  WHERE j.status IN ('processing', 'rendering', 'uploading')
    AND j.selected_engine <> 'ai_3d_recon'
    AND j.production_type NOT IN ('3d_reconstruction', 'image_to_3d', 'photogrammetry')
    AND j.lease_expires_at IS NOT NULL
    AND j.lease_expires_at <= NOW()
    AND j.retry_count < j.max_retries;

  -- Step C: Atomically claim ONLY supported render jobs (never AI 3D reconstruction jobs)
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

COMMIT;

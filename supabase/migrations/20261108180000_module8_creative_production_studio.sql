-- ============================================================================
-- GLOBAL MOBİLYA — MODULE 8: CREATIVE PRODUCTION STUDIO
-- Database Schema & Security Architecture Migration (Draft for Review)
-- ============================================================================
-- IMPORTANT: Do not execute in production without explicit administrator approval.
-- This migration establishes the relational foundation for Module 8.

BEGIN;

-- 1. MEDIA ASSETS (Merkezi Medya Varlıkları)
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_slug TEXT REFERENCES public.products(slug) ON DELETE SET NULL,
    collection_id TEXT,
    asset_type TEXT NOT NULL CHECK (asset_type IN (
        'raw_photo', 'processed_photo', 'ai_enhanced', 'ai_generated',
        'render_frame', 'video_render', 'rendered_video', '3d_model', 'scene_template',
        'texture_map', 'variant_export', 'blender_project'
    )),
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    width_px INT,
    height_px INT,
    duration_seconds NUMERIC(8, 2),
    source_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    version INT DEFAULT 1,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_product ON public.media_assets(product_slug);
CREATE INDEX IF NOT EXISTS idx_media_assets_collection ON public.media_assets(collection_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_type ON public.media_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_media_assets_approved ON public.media_assets(is_approved);

-- 2. PRODUCTION JOBS (İmalat ve Render Görevleri)
CREATE TABLE IF NOT EXISTS public.production_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_slug TEXT REFERENCES public.products(slug) ON DELETE SET NULL,
    collection_id TEXT,
    production_type TEXT NOT NULL CHECK (production_type IN (
        'image_enhance', 'image_enhancement', 'background_removal', 'background_processing',
        '3d_reconstruction', 'image_to_3d', 'photogrammetry',
        '3d_render', 'blender_render', 'cinematic_render', 'cinematic_video',
        'multi_format_transcode', 'video_editing', 'media_export',
        'texture_synthesis', 'benchmark_test'
    )),
    pipeline_type TEXT NOT NULL DEFAULT 'standard',
    selected_engine TEXT NOT NULL CHECK (selected_engine IN (
        'blender_headless', 'ai_enhancer', 'ai_3d_recon',
        'ffmpeg_transcoder', 'cloud_gpu_cluster'
    )),
    input_model_path TEXT,
    output_render_path TEXT,
    output_public_url TEXT,
    render_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    config_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'queued', 'processing', 'rendering', 'uploading', 'encoding',
        'quality_check', 'completed', 'failed', 'cancelled'
    )),
    progress_percent INT DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    idempotency_key TEXT UNIQUE,
    worker_id TEXT,
    lease_expires_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    max_retries INT NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_jobs_status ON public.production_jobs(status);
CREATE INDEX IF NOT EXISTS idx_prod_jobs_queue_claim ON public.production_jobs(status, created_at, lease_expires_at)
    WHERE status IN ('pending', 'queued', 'processing', 'rendering', 'uploading');
CREATE INDEX IF NOT EXISTS idx_prod_jobs_engine ON public.production_jobs(selected_engine);
CREATE INDEX IF NOT EXISTS idx_prod_jobs_product ON public.production_jobs(product_slug);

-- 3. PRODUCTION OUTPUTS (Üretim Çıktıları)
CREATE TABLE IF NOT EXISTS public.production_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
    media_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
    output_type TEXT NOT NULL CHECK (output_type IN (
        'hero_still', 'turntable_video', 'social_reel_9_16',
        'website_hero_16_9', 'square_1_1', 'portrait_4_5',
        'glft_model', 'depth_map'
    )),
    file_format TEXT NOT NULL,
    resolution_label TEXT,
    duration_seconds NUMERIC(8, 2),
    quality_status TEXT DEFAULT 'pending' CHECK (quality_status IN (
        'pending', 'passed', 'flagged', 'rejected'
    )),
    quality_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_outputs_job ON public.production_outputs(job_id);
CREATE INDEX IF NOT EXISTS idx_prod_outputs_asset ON public.production_outputs(media_asset_id);

-- 4. 3D ASSETS (3 Boyutlu Geometri ve Model Varlıkları)
CREATE TABLE IF NOT EXISTS public.three_d_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_slug TEXT NOT NULL REFERENCES public.products(slug) ON DELETE CASCADE,
    model_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    model_format TEXT NOT NULL CHECK (model_format IN (
        'blend', 'fbx', 'obj', 'glb', 'gltf'
    )),
    source_type TEXT NOT NULL DEFAULT 'cad_import' CHECK (source_type IN (
        'cad_import', 'manual_modeling', 'ai_reconstructed', 'photogrammetry'
    )),
    geometry_validation_status TEXT DEFAULT 'unvalidated' CHECK (geometry_validation_status IN (
        'unvalidated', 'passed', 'manifold_errors', 'scale_mismatch'
    )),
    polygon_count INT,
    material_status TEXT DEFAULT 'pbr_ready' CHECK (material_status IN (
        'untextured', 'pbr_ready', 'procedural_wood', 'cnc_membrane_assigned'
    )),
    scale_factor NUMERIC(8, 4) DEFAULT 1.0000,
    version INT DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_3d_assets_product ON public.three_d_assets(product_slug);
CREATE INDEX IF NOT EXISTS idx_3d_assets_format ON public.three_d_assets(model_format);

-- 5. SCENE TEMPLATES (Blender ve Çekim Şablonları)
CREATE TABLE IF NOT EXISTS public.scene_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    collection_id TEXT,
    environment_theme TEXT NOT NULL DEFAULT 'luxury_showroom' CHECK (environment_theme IN (
        'luxury_showroom', 'nordic_daylight', 'evening_salon',
        'warm_atelier', 'alpine_minimal', 'mediterranean_sun'
    )),
    blend_file_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    lighting_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    camera_presets JSONB NOT NULL DEFAULT '[]'::jsonb,
    render_engine_type TEXT NOT NULL DEFAULT 'cycles' CHECK (render_engine_type IN ('cycles', 'eevee_next', 'workbench')),
    samples_preset INT DEFAULT 128,
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scene_templates_slug ON public.scene_templates(scene_slug);
CREATE INDEX IF NOT EXISTS idx_scene_templates_env ON public.scene_templates(environment_theme);

-- 6. MEDIA VARIANTS (Platform Format Türevleri)
CREATE TABLE IF NOT EXISTS public.media_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
    target_platform TEXT NOT NULL CHECK (target_platform IN (
        'web_desktop', 'web_mobile', 'instagram_reels', 'instagram_story',
        'instagram_feed', 'tiktok_vertical', 'youtube_shorts', 'master_archive'
    )),
    output_format TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL CHECK (aspect_ratio IN ('16:9', '9:16', '4:5', '1:1', '21:9')),
    width_px INT NOT NULL,
    height_px INT NOT NULL,
    variant_asset_id UUID REFERENCES public.media_assets(id) ON DELETE CASCADE,
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN (
        'pending', 'processing', 'ready', 'failed'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_variants_orig ON public.media_variants(original_asset_id);
CREATE INDEX IF NOT EXISTS idx_media_variants_plat ON public.media_variants(target_platform);

-- 7. PRODUCTION COSTS (Kaynak ve Maliyet Takibi)
CREATE TABLE IF NOT EXISTS public.production_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL,
    processing_duration_ms BIGINT DEFAULT 0,
    gpu_type TEXT,
    gpu_seconds_used NUMERIC(10, 2) DEFAULT 0,
    api_calls_count INT DEFAULT 0,
    storage_bytes_added BIGINT DEFAULT 0,
    cost_amount NUMERIC(10, 4) DEFAULT 0.0000,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_costs_job ON public.production_costs(job_id);

-- 8. PRODUCTION EVENTS (İşlem Olay Günlüğü)
CREATE TABLE IF NOT EXISTS public.production_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_details JSONB DEFAULT '{}'::jsonb,
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_events_job ON public.production_events(job_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.three_d_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;

-- 1. Read Permissions: Authenticated team members with roles
CREATE POLICY "Production team can read studio data" ON public.media_assets
    FOR SELECT TO authenticated
    USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager', 'content_manager', 'product_manager']);

CREATE POLICY "Production team can read jobs" ON public.production_jobs
    FOR SELECT TO authenticated
    USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager', 'content_manager']);

CREATE POLICY "Production team can read outputs" ON public.production_outputs
    FOR SELECT TO authenticated
    USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager', 'content_manager']);

CREATE POLICY "Production team can read 3d assets" ON public.three_d_assets
    FOR SELECT TO authenticated
    USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager', 'content_manager']);

CREATE POLICY "Production team can read scene templates" ON public.scene_templates
    FOR SELECT TO authenticated
    USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager', 'content_manager']);

CREATE POLICY "Production team can read variants" ON public.media_variants
    FOR SELECT TO authenticated
    USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager', 'content_manager']);

CREATE POLICY "Admins and managers can read costs" ON public.production_costs
    FOR SELECT TO authenticated
    USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager']);

CREATE POLICY "Production team can read events" ON public.production_events
    FOR SELECT TO authenticated
    USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager', 'content_manager']);

-- 2. Write Permissions: Restricted to admin and production_manager
CREATE POLICY "Authorized production staff can write jobs" ON public.production_jobs
    FOR ALL TO authenticated
    USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager'])
    WITH CHECK ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager']);

CREATE POLICY "Authorized production staff can manage assets" ON public.media_assets
    FOR ALL TO authenticated
    USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager'])
    WITH CHECK ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager']);

-- 3. Public Web Read Permission: ONLY for approved web-ready media
CREATE POLICY "Public can view approved web-ready media" ON public.media_assets
    FOR SELECT TO anon, public
    USING (is_approved = TRUE AND asset_type IN ('processed_photo', 'variant_export', 'render_frame', 'video_render'));

COMMIT;

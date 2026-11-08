-- ============================================================================
-- GLOBAL MOBİLYA — MODULE 8.2: AI SCENE BUILDER & ENVIRONMENT STUDIO (PHASE 2)
-- ============================================================================
-- 1. Creates public.studio_scenes to persist reusable parametric 3D interior
--    scenes, room architecture parameters, independent 3D furniture asset
--    transforms, PBR material overrides, lighting profiles, camera settings,
--    and Supabase Storage paths:
--      - studio/scenes/{scene_id}/scene.blend
--      - studio/scenes/{scene_id}/preview.jpg
--      - studio/scenes/{scene_id}/scene_metadata.json
-- 2. Keeps AI-estimated reference room analysis separate from verified product
--    geometry so AI suggestions are never stored as CAD/verified product data.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.studio_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id TEXT UNIQUE NOT NULL,
  scene_name TEXT NOT NULL,
  collection_id TEXT,
  source_image_path TEXT,
  source_image_url TEXT,
  reference_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_ai_estimated_room BOOLEAN NOT NULL DEFAULT TRUE,
  room_dimensions JSONB NOT NULL DEFAULT '{
    "room_width": 5.2,
    "room_length": 4.6,
    "room_height": 2.9,
    "wall_thickness": 0.18,
    "window_width": 1.8,
    "window_height": 1.6,
    "window_sill_height": 0.75,
    "window_wall": "right",
    "window_offset": 0.0,
    "door_width": 0.95,
    "door_height": 2.15,
    "door_wall": "left",
    "door_offset": -1.1,
    "has_wall_panels": true,
    "has_baseboards": true,
    "has_crown_molding": true
  }'::jsonb,
  asset_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  asset_transforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  material_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  lighting_profile TEXT NOT NULL DEFAULT 'luxury_bedroom' CHECK (lighting_profile IN (
    'luxury_bedroom',
    'modern_minimal',
    'warm_interior',
    'dark_premium',
    'natural_daylight'
  )),
  lighting_custom_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  camera_settings JSONB NOT NULL DEFAULT '{
    "position": [0.0, -3.8, 1.65],
    "target": [0.0, 1.4, 0.95],
    "fov_mm": 35,
    "dof_enabled": false,
    "f_stop": 4.0
  }'::jsonb,
  blender_version TEXT NOT NULL DEFAULT '4.2',
  scene_file_path TEXT,
  scene_file_url TEXT,
  preview_image_path TEXT,
  preview_image_url TEXT,
  metadata_file_path TEXT,
  metadata_file_url TEXT,
  user_approved BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'preview_ready',
    'approved',
    'building_blend',
    'rendering_preview',
    'rendering_final',
    'completed',
    'failed'
  )),
  last_job_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_scenes_scene_id ON public.studio_scenes(scene_id);
CREATE INDEX IF NOT EXISTS idx_studio_scenes_status ON public.studio_scenes(status);
CREATE INDEX IF NOT EXISTS idx_studio_scenes_profile ON public.studio_scenes(lighting_profile);

ALTER TABLE public.studio_scenes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Production team can read studio scenes" ON public.studio_scenes;
CREATE POLICY "Production team can read studio scenes"
  ON public.studio_scenes FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager', 'content_manager', 'product_manager']);

DROP POLICY IF EXISTS "Authorized production staff can write studio scenes" ON public.studio_scenes;
CREATE POLICY "Authorized production staff can write studio scenes"
  ON public.studio_scenes FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager'])
  WITH CHECK ((auth.jwt()->'app_metadata'->'roles')::jsonb ?| array['admin', 'production_manager']);

GRANT ALL ON public.studio_scenes TO service_role;

COMMIT;

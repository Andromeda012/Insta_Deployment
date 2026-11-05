-- ============================================================================
-- GLOBAL MOBİLYA — MODÜL 2 & MODÜL 7 KOLEKSİYON MERKEZLİ KAMPANYA VE SAHNE MİMARİSİ
-- Migration: 20261105190000_collection_campaigns_and_scenes.sql
-- Not: Bu migration dosyası yalnızca şema tanımlarını içerir; hiçbir sahte/demo
-- katalog veya kampanya verisi (seed) içermez. Tek başına (standalone) çalıştırılabilir.
-- ============================================================================

BEGIN;

-- 1. KOLEKSİYONLAR TABLOSU (Modül 7 Merkezi Koleksiyon Yapısı)
CREATE TABLE IF NOT EXISTS public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  code text,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Yatak Odası',
  short_description text,
  description text,
  design_story text,
  hero_image text NOT NULL DEFAULT '',
  color_palette jsonb NOT NULL DEFAULT '[]'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  technical_specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  video_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  marketing_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS technical_specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS video_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS marketing_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_collections_slug ON public.collections(slug);
CREATE INDEX IF NOT EXISTS idx_collections_visible_sort ON public.collections(is_visible, sort_order);

-- 2. ÜRÜNLER TABLOSU GENİŞLETMELERİ (Koleksiyon / Koleksiyon Parçası / Bağımsız Ürün)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'independent',
  ADD COLUMN IF NOT EXISTS piece_role text DEFAULT 'part',
  ADD COLUMN IF NOT EXISTS design_story text,
  ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dimensions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS technical_specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS marketing_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_product_type_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_product_type_check
      CHECK (product_type IN ('collection', 'collection_piece', 'independent'));
  END IF;
END $$;

-- 3. KOLEKSİYON - ÜRÜN İLİŞKİSİ (Parçaları tekrar ürün açmadan koleksiyonla bağlar)
CREATE TABLE IF NOT EXISTS public.collection_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  product_slug text NOT NULL REFERENCES public.products(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  role_in_collection text NOT NULL DEFAULT 'part',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, product_slug)
);

ALTER TABLE public.collection_products
  DROP CONSTRAINT IF EXISTS collection_products_role_in_collection_check;

ALTER TABLE public.collection_products
  ADD CONSTRAINT collection_products_role_in_collection_check
  CHECK (role_in_collection IN (
    'main_bed', 'wardrobe', 'nightstand', 'dresser', 'vanity', 'mirror',
    'bench', 'dining_table', 'console', 'chair', 'sofa', 'armchair',
    'tv_unit', 'coffee_table', 'bookcase', 'cabinet', 'accent', 'part'
  ));

CREATE INDEX IF NOT EXISTS idx_collection_products_col ON public.collection_products(collection_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_collection_products_prod ON public.collection_products(product_slug);

-- 4. 9 KATEGORİLİ MEDYA KÜTÜPHANESİ VE GERÇEK/AI AYRIMI
CREATE TABLE IF NOT EXISTS public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text REFERENCES public.products(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  collection_id uuid REFERENCES public.collections(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'hero',
  source_type text NOT NULL DEFAULT 'real',
  aspect_ratio text NOT NULL DEFAULT '1:1',
  approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  is_primary boolean NOT NULL DEFAULT false,
  alt_text text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  fidelity_verified boolean NOT NULL DEFAULT true,
  generation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_media
  DROP CONSTRAINT IF EXISTS product_media_media_type_check,
  DROP CONSTRAINT IF EXISTS product_media_source_type_check;

ALTER TABLE public.product_media
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fidelity_verified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS generation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.product_media
  ADD CONSTRAINT product_media_media_type_check
  CHECK (media_type IN (
    'hero', 'lifestyle', 'detail', 'isolated', 'texture',
    'color', 'carousel', 'video', 'technical'
  ));

ALTER TABLE public.product_media
  ADD CONSTRAINT product_media_source_type_check
  CHECK (source_type IN (
    'real', 'original', 'ai_generated', 'ai_banana', 'cad_render'
  ));

CREATE INDEX IF NOT EXISTS idx_product_media_slug ON public.product_media(product_slug, approval_status);
CREATE INDEX IF NOT EXISTS idx_product_media_col ON public.product_media(collection_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_product_media_source_type ON public.product_media(source_type);

-- 5. AI PAZARLAMA PROFİLLERİ (Koleksiyon ve Ürün Bazlı 6 Boyutlu Profil)
CREATE TABLE IF NOT EXISTS public.marketing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text UNIQUE REFERENCES public.products(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  collection_id uuid REFERENCES public.collections(id) ON DELETE CASCADE,
  category_name text,
  atmosphere text NOT NULL DEFAULT 'Minimal',
  lighting text NOT NULL DEFAULT 'Soft daylight',
  color_palette text NOT NULL DEFAULT '',
  color_palette_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  camera_angle text NOT NULL DEFAULT 'Wide architectural straight-on view',
  camera_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  music_preference text NOT NULL DEFAULT 'Ambient',
  marketing_tone text NOT NULL DEFAULT 'Premium',
  notes text,
  target_platforms jsonb NOT NULL DEFAULT '["instagram", "facebook", "youtube", "tiktok"]'::jsonb,
  preserve_original_fidelity boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_profiles
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.collections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS color_palette_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS camera_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS marketing_tone text NOT NULL DEFAULT 'Premium',
  ADD COLUMN IF NOT EXISTS notes text;

-- 6. PAZARLAMA KAMPANYALARI / İÇERİK PAKETLERİ ANA TABLOSU (Modül 2)
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text UNIQUE NOT NULL,
  title text NOT NULL,
  target_type text NOT NULL DEFAULT 'collection' CHECK (target_type IN ('collection', 'collection_piece', 'independent')),
  collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  product_slug text REFERENCES public.products(slug) ON UPDATE CASCADE ON DELETE SET NULL,
  source_version integer NOT NULL DEFAULT 1,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  marketing_strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  creative_controls jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_platforms jsonb NOT NULL DEFAULT '["instagram", "facebook", "youtube", "tiktok"]'::jsonb,
  selected_packages jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_cost jsonb NOT NULL DEFAULT '{}'::jsonb,
  pipeline_stage integer NOT NULL DEFAULT 1 CHECK (pipeline_stage BETWEEN 1 AND 8),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'generating', 'pending_review', 'approved',
    'partially_published', 'published', 'archived'
  )),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_col ON public.marketing_campaigns(collection_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_prod ON public.marketing_campaigns(product_slug);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns(status, created_at DESC);

-- 7. KAMPANYA PLATFORM DURUMLARI TABLOSU
CREATE TABLE IF NOT EXISTS public.campaign_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook', 'youtube', 'tiktok')),
  connection_status text NOT NULL DEFAULT 'ready' CHECK (connection_status IN (
    'missing_credentials', 'awaiting_oauth', 'unverified', 'ready'
  )),
  package_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending_generation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, platform)
);

-- 8. KAMPANYA İÇERİK ÖĞELERİ TABLOSU (12 Gerçek Yaşam Döngüsü Durumu)
CREATE TABLE IF NOT EXISTS public.campaign_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook', 'youtube', 'tiktok')),
  package_type text NOT NULL,
  content_type text NOT NULL,
  title text NOT NULL,
  caption text,
  hashtags text,
  cta_text text,
  target_link text,
  aspect_ratio text NOT NULL DEFAULT '1:1',
  resolution text NOT NULL DEFAULT '1080x1080',
  duration_seconds integer,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_url text,
  music_track jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  layered_prompt jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'not_created' CHECK (status IN (
    'not_created',
    'pending_generation',
    'generating',
    'pending_review',
    'revision_required',
    'approved',
    'queued',
    'publishing',
    'published',
    'failed',
    'manual_action_required',
    'awaiting_platform_connection'
  )),
  review_notes text,
  approved_by text,
  approved_at timestamptz,
  scheduled_for timestamptz,
  queue_task_id uuid REFERENCES public.social_publish_queue(id) ON DELETE SET NULL,
  platform_post_id text,
  error_message text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_items_campaign ON public.campaign_items(campaign_id, platform, sort_order);
CREATE INDEX IF NOT EXISTS idx_campaign_items_status ON public.campaign_items(status);

-- 9. KAMPANYA VİDEO VE ANİMASYON SAHNELERİ TABLOSU (Tekil Sahne Yeniden Üretim Desteği)
CREATE TABLE IF NOT EXISTS public.campaign_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.campaign_items(id) ON DELETE CASCADE,
  scene_index integer NOT NULL,
  scene_code text NOT NULL,
  title text NOT NULL,
  time_range text NOT NULL,
  duration_seconds numeric(5, 2) NOT NULL DEFAULT 4.0,
  camera_angle text,
  camera_movement text,
  lighting text,
  music_cue text,
  subtitle_text text,
  voiceover_or_caption text,
  visual_prompt text,
  source_media_url text,
  generated_asset_url text,
  provider_name text NOT NULL DEFAULT 'nova_ffmpeg_studio',
  status text NOT NULL DEFAULT 'pending_generation' CHECK (status IN (
    'not_created',
    'pending_generation',
    'generating',
    'pending_review',
    'revision_required',
    'approved',
    'failed'
  )),
  generation_cost numeric(10, 4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, scene_index)
);

CREATE INDEX IF NOT EXISTS idx_campaign_scenes_item ON public.campaign_scenes(item_id, scene_index);

-- 10. YAYINLAMA VE HATA LOGLARI TABLOSU
CREATE TABLE IF NOT EXISTS public.social_publish_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.campaign_items(id) ON DELETE SET NULL,
  queue_task_id uuid REFERENCES public.social_publish_queue(id) ON DELETE SET NULL,
  platform text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_publish_logs_campaign ON public.social_publish_logs(campaign_id, created_at DESC);

-- 11. RLS VE YETKİLENDİRME POLİTİKALARI
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publish_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.collections TO anon, authenticated;
GRANT SELECT ON TABLE public.collection_products TO anon, authenticated;
GRANT SELECT ON TABLE public.product_media TO anon, authenticated;
GRANT SELECT ON TABLE public.marketing_profiles TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.collections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.collection_products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_media TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.campaign_platforms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.campaign_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.campaign_scenes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_publish_logs TO service_role;

GRANT SELECT ON TABLE public.marketing_campaigns TO authenticated;
GRANT SELECT ON TABLE public.campaign_platforms TO authenticated;
GRANT SELECT ON TABLE public.campaign_items TO authenticated;
GRANT SELECT ON TABLE public.campaign_scenes TO authenticated;
GRANT SELECT ON TABLE public.social_publish_logs TO authenticated;

DROP POLICY IF EXISTS "Public read collections" ON public.collections;
CREATE POLICY "Public read collections" ON public.collections FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read collection_products" ON public.collection_products;
CREATE POLICY "Public read collection_products" ON public.collection_products FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read product_media" ON public.product_media;
CREATE POLICY "Public read product_media" ON public.product_media FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read marketing_profiles" ON public.marketing_profiles;
CREATE POLICY "Public read marketing_profiles" ON public.marketing_profiles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read marketing_campaigns" ON public.marketing_campaigns;
CREATE POLICY "Authenticated read marketing_campaigns" ON public.marketing_campaigns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read campaign_platforms" ON public.campaign_platforms;
CREATE POLICY "Authenticated read campaign_platforms" ON public.campaign_platforms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read campaign_items" ON public.campaign_items;
CREATE POLICY "Authenticated read campaign_items" ON public.campaign_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read campaign_scenes" ON public.campaign_scenes;
CREATE POLICY "Authenticated read campaign_scenes" ON public.campaign_scenes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read social_publish_logs" ON public.social_publish_logs;
CREATE POLICY "Authenticated read social_publish_logs" ON public.social_publish_logs FOR SELECT TO authenticated USING (true);

COMMIT;

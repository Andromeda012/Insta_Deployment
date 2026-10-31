-- ============================================================================
-- NOVA FURNITURE — PHOTOROOM AI & 4-BOT CAMPAIGN DISTRIBUTION ARCHITECTURE
-- ============================================================================
-- Bu şema Photoroom API ile üretilen işlenmiş görsel, Reels video, detay post
-- ve story varlıklarını saklar ve 4 bot (Instagram, Facebook, TikTok, YouTube)
-- tarafından çekilip otomatik dağıtılmasını sağlar.
-- ============================================================================

-- 1. Photoroom Üretim & 4 Bot Dağıtım Varlıkları Tablosu
CREATE TABLE IF NOT EXISTS public.social_campaign_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug TEXT NOT NULL,
  product_title TEXT NOT NULL,
  raw_image_url TEXT NOT NULL,
  photoroom_prompt TEXT NOT NULL,
  photoroom_hero_url TEXT NOT NULL,
  reels_video_url TEXT DEFAULT '',
  post_image_url TEXT NOT NULL,
  story_image_url TEXT DEFAULT '',
  caption TEXT NOT NULL,
  hashtags TEXT DEFAULT '#novafurniture #minimalistmobilya #icmimari #mdfmobilya #cnckapak #luxuryfurniture',
  distribution_status JSONB NOT NULL DEFAULT '{
    "instagram": {"status": "scheduled", "published_reels": false, "published_post": false, "published_story": false},
    "facebook": {"status": "scheduled", "published_post": false},
    "tiktok": {"status": "scheduled", "published_video": false},
    "youtube": {"status": "scheduled", "published_shorts": false}
  }'::jsonb,
  is_sandbox BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Photoroom API & Bot Ayarları Tablosu (veya site_settings entegrasyonu)
CREATE TABLE IF NOT EXISTS public.photoroom_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  photoroom_api_key TEXT DEFAULT '',
  sandbox_mode BOOLEAN DEFAULT true,
  fixed_prompt TEXT DEFAULT 'Ultra-luxurious, modern Scandinavian architectural living space, warm greige microcement and dark charcoal walls, natural oak acoustic wood slat panels, polished warm herringbone parquet flooring with soft natural floor reflections, cinematic golden hour window directional sunlight from the left, soft ambient ceiling spot cone, minimalist designer aesthetic, 8k resolution, architectural digest photography, perfectly positioned furniture with realistic contact and ambient drop shadow',
  auto_campaign_generation BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Politikaları
ALTER TABLE public.social_campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photoroom_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read social_campaign_assets" ON public.social_campaign_assets;
CREATE POLICY "Public read social_campaign_assets" ON public.social_campaign_assets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access photoroom_config" ON public.photoroom_config;
CREATE POLICY "Public access photoroom_config" ON public.photoroom_config FOR ALL USING (true) WITH CHECK (true);

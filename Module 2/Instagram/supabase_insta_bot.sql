-- ============================================================================
-- NOVA FURNITURE (@thenovafurniture) — MODULE 2: INSTAGRAM CLOUD BOT
-- 7/24 Bulut Üzerinde Çalışan Otomatik Reels/Story/Gönderi & 3 Aşamalı İletişim Botu
-- ============================================================================

-- 1. Bot Genel & Bulut Zamanlayıcı Ayarları Tablosu
CREATE TABLE IF NOT EXISTS public.insta_bot_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  account_handle TEXT DEFAULT '@thenovafurniture',
  ig_user_id TEXT DEFAULT '',
  access_token TEXT DEFAULT '',
  gemini_api_key TEXT DEFAULT '',
  gemini_model TEXT DEFAULT 'gemini-2.5-flash',
  cloud_status TEXT DEFAULT 'active',
  auto_publish_enabled BOOLEAN DEFAULT true,
  require_approval BOOLEAN DEFAULT false,
  auto_product_reels BOOLEAN DEFAULT true,
  posting_slots JSONB DEFAULT '[
    {"slot_id": "slot_morning", "time": "10:00", "type": "POST", "active": true, "label": "Sabah Katalog Gönderisi"},
    {"slot_id": "slot_afternoon", "time": "14:30", "type": "STORIES", "active": true, "label": "Öğleden Sonra Atölye / Renk Story"},
    {"slot_id": "slot_evening", "time": "19:30", "type": "REELS", "active": true, "label": "Akşam CNC Üretim & Mutfak Reels"}
  ]'::jsonb,
  tier2_system_prompt TEXT DEFAULT 'Sen Nova Furniture''ın (@thenovafurniture) resmi Instagram asistanısın. Modern tesisimizde 1. sınıf 18mm E1 MDF ve suya/neme dayanıklı ithal kaplama teknolojisiyle özel ölçü mobilya, gardırop, yatak odası, mutfak ve banyo modelleri üretmekteyiz. KESİNLİKLE hiçbir web sitesi linki verme ve "Global Kapak" veya "#globalkapak" kelimelerini asla kullanma. Müşteriyi her zaman WhatsApp hattımıza (0 505 015 1035) veya DM ile iletişime yönlendir.',
  tier3_whatsapp_number TEXT DEFAULT '905050151035',
  tier3_phone_display TEXT DEFAULT '0 (505) 015 1035',
  tier3_email TEXT DEFAULT 'info@thenovafurniture.com',
  tier3_web_url TEXT DEFAULT '',
  tier3_handoff_triggers JSONB DEFAULT '["sipariş vermek", "özel ölçü fiyat", "yetkili", "insan", "temsilci", "toplu alım", "bayilik", "şikayet", "sorun", "ustayla görüşmek", "whatsapp", "numaranız"]'::jsonb,
  tier3_handoff_template TEXT DEFAULT 'Memnuniyetle yardımcı olalım! 🙌 Özel ölçü hesaplaması, net fiyat teklifi ve birebir müşteri temsilcimizle görüşmek için doğrudan WhatsApp hattımıza tıklayabilirsiniz: https://wa.me/905050151035 — Ayrıca 0 (505) 015 1035 numaralı hattımızdan bize hemen ulaşabilirsiniz.',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Otomatik Yayınlanacak Reels, Story ve Gönderi Kuyruğu (Onaysız Otomatik Yayın)
CREATE TABLE IF NOT EXISTS public.insta_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type TEXT NOT NULL DEFAULT 'POST', -- 'POST' | 'REELS' | 'STORIES'
  title TEXT NOT NULL,
  caption TEXT DEFAULT '',
  hashtags TEXT DEFAULT '#novafurniture #thenovafurniture #mobilyatasarim #luxuryfurniture #evdekorasyonu',
  media_url TEXT NOT NULL,
  thumbnail_url TEXT DEFAULT '',
  scheduled_for TIMESTAMPTZ NOT NULL,
  slot_label TEXT DEFAULT 'Otomatik Saat Dilimi',
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'publishing' | 'published' | 'failed'
  ig_Container_id TEXT DEFAULT '',
  ig_media_id TEXT DEFAULT '',
  published_at TIMESTAMPTZ,
  error_message TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 1. Aşama: Basit Sorular İçin Sabit Anahtar Kelime Kuralları Tablosu
CREATE TABLE IF NOT EXISTS public.insta_keyword_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_type TEXT DEFAULT 'contains', -- 'contains' | 'exact'
  channel_scope TEXT DEFAULT 'BOTH', -- 'DM' | 'COMMENT' | 'BOTH'
  response_text TEXT NOT NULL,
  escalate_to_tier3 BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 10,
  active BOOLEAN DEFAULT true,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 3 Aşamalı İletişim Geçmişi ve İnsan Devir (Handoff) Kayıtları Tablosu
CREATE TABLE IF NOT EXISTS public.insta_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL,
  sender_username TEXT DEFAULT '@musteri',
  channel TEXT NOT NULL DEFAULT 'DM', -- 'DM' | 'COMMENT'
  incoming_text TEXT NOT NULL,
  resolved_tier INTEGER NOT NULL DEFAULT 1, -- 1: Sabit Kural, 2: Gemini AI, 3: İnsan / WhatsApp Yönlendirme
  tier_label TEXT NOT NULL DEFAULT '1. Aşama: Sabit Cevap',
  bot_reply TEXT NOT NULL,
  handoff_status TEXT DEFAULT 'resolved', -- 'resolved' | 'waiting_human' | 'contacted_on_whatsapp'
  whatsapp_link TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Bulut Sunucu Çalışma & Otomasyon Logları
CREATE TABLE IF NOT EXISTS public.insta_bot_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'CRON_PUBLISH' | 'TIER1_REPLY' | 'TIER2_GEMINI' | 'TIER3_HANDOFF' | 'ERROR'
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Politikaları (Bulut Servisi & Yönetim Paneli Erişimi)
ALTER TABLE public.insta_bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insta_scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insta_keyword_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insta_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insta_bot_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access insta_bot_config" ON public.insta_bot_config;
CREATE POLICY "Public full access insta_bot_config" ON public.insta_bot_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access insta_scheduled_posts" ON public.insta_scheduled_posts;
CREATE POLICY "Public full access insta_scheduled_posts" ON public.insta_scheduled_posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access insta_keyword_rules" ON public.insta_keyword_rules;
CREATE POLICY "Public full access insta_keyword_rules" ON public.insta_keyword_rules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access insta_conversations" ON public.insta_conversations;
CREATE POLICY "Public full access insta_conversations" ON public.insta_conversations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access insta_bot_logs" ON public.insta_bot_logs;
CREATE POLICY "Public full access insta_bot_logs" ON public.insta_bot_logs FOR ALL USING (true) WITH CHECK (true);

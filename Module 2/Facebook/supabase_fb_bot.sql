-- ============================================================================
-- GLOBAL KAPAK MOBİLYA — MODULE 2: FACEBOOK CLOUD BOT SUPABASE ŞEMASI
-- Not: Bot tüm durumunu anlık olarak `public.site_settings` (`key = 'fb_bot_state'`)
-- üzerinde tutar. İsteğe bağlı ilişkisel tablolar aşağıdadır:
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fb_bot_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  page_name TEXT DEFAULT 'Global Kapak Mobilya',
  page_id TEXT DEFAULT '',
  page_access_token TEXT DEFAULT '',
  gemini_api_key TEXT DEFAULT '',
  gemini_model TEXT DEFAULT 'gemini-2.5-flash',
  auto_publish_enabled BOOLEAN DEFAULT true,
  require_approval BOOLEAN DEFAULT false,
  posting_slots JSONB DEFAULT '[]'::jsonb,
  tier2_system_prompt TEXT DEFAULT '',
  tier3_whatsapp_number TEXT DEFAULT '905050151035',
  tier3_phone_display TEXT DEFAULT '0 (505) 015 1035',
  tier3_handoff_triggers JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fb_scheduled_posts (
  id TEXT PRIMARY KEY,
  media_type TEXT NOT NULL DEFAULT 'PHOTO_POST', -- 'PHOTO_POST' | 'FB_REELS' | 'FB_STORIES' | 'LINK_CARD'
  title TEXT NOT NULL,
  caption TEXT,
  hashtags TEXT,
  media_url TEXT,
  target_link TEXT,
  auto_designed BOOLEAN DEFAULT true,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'scheduled',
  fb_post_id TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fb_conversations (
  id TEXT PRIMARY KEY,
  sender_id TEXT,
  sender_name TEXT,
  channel TEXT DEFAULT 'MESSENGER', -- 'MESSENGER' | 'COMMENT'
  incoming_text TEXT,
  resolved_tier INT DEFAULT 1,
  tier_label TEXT,
  bot_reply TEXT,
  handoff_status TEXT DEFAULT 'resolved',
  whatsapp_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

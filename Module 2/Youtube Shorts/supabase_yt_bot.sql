-- ============================================================================
-- NOVA FURNITURE — MODULE 2: YOUTUBE SHORTS CLOUD BOT SUPABASE ŞEMASI
-- Not: Bot tüm durumunu anlık olarak `public.site_settings` (`key = 'yt_bot_state'`)
-- üzerinde tutar. İsteğe bağlı ilişkisel tablolar aşağıdadır:
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.yt_bot_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  channel_name TEXT DEFAULT 'Nova Furniture',
  channel_handle TEXT DEFAULT '@thenovafurniture',
  channel_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  client_secret TEXT DEFAULT '',
  refresh_token TEXT DEFAULT '',
  gemini_api_key TEXT DEFAULT '',
  gemini_model TEXT DEFAULT 'gemini-2.5-flash',
  auto_publish_enabled BOOLEAN DEFAULT true,
  require_approval BOOLEAN DEFAULT false,
  auto_pin_first_comment BOOLEAN DEFAULT true,
  posting_slots JSONB DEFAULT '[]'::jsonb,
  tier2_system_prompt TEXT DEFAULT '',
  tier3_whatsapp_number TEXT DEFAULT '905050151035',
  tier3_phone_display TEXT DEFAULT '0 (505) 015 1035',
  tier3_handoff_triggers JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.yt_scheduled_shorts (
  id TEXT PRIMARY KEY,
  media_type TEXT NOT NULL DEFAULT 'SHORTS_CNC', -- 'SHORTS_CNC' | 'SHORTS_SHOWCASE' | 'SHORTS_GUIDE' | 'COMMUNITY_POST'
  title TEXT NOT NULL,
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  pinned_comment TEXT,
  media_url TEXT,
  auto_designed BOOLEAN DEFAULT true,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'scheduled',
  yt_video_id TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.yt_comment_conversations (
  id TEXT PRIMARY KEY,
  comment_id TEXT,
  author_name TEXT,
  video_title TEXT,
  incoming_text TEXT,
  resolved_tier INT DEFAULT 1,
  tier_label TEXT,
  bot_reply TEXT,
  handoff_status TEXT DEFAULT 'resolved',
  whatsapp_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

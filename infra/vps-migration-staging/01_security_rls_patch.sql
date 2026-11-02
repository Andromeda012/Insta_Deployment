-- NOVA security/RLS migration. Review README before applying.
BEGIN;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Remove known legacy policies, especially any public write policy.
DROP POLICY IF EXISTS "Public full access on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public read access on safe site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public upsert access on safe site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public read safe keys only" ON public.site_settings;
DROP POLICY IF EXISTS "Public upsert safe keys only" ON public.site_settings;
DROP POLICY IF EXISTS "Public read safe site_settings only" ON public.site_settings;
DROP POLICY IF EXISTS "Public upsert safe site_settings only" ON public.site_settings;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.site_settings;
DROP POLICY IF EXISTS "Allow public read" ON public.site_settings;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.site_settings;

-- Browser roles are read-only. Writes must go through trusted server-side service_role.
REVOKE INSERT, UPDATE, DELETE ON public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

CREATE POLICY "Public read safe site_settings only"
ON public.site_settings FOR SELECT TO anon, authenticated
USING (key IN (
  'company_info', 'contact_info', 'hero_banner', 'theme_settings',
  'product_transform_settings', 'social_campaign_assets', 'instagram_published_tracker'
));

DROP VIEW IF EXISTS public.v_public_bot_ui_state;

CREATE OR REPLACE FUNCTION public.sanitize_bot_credentials()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.site_settings
  SET data = (data #- '{config,access_token}') #- '{config,ig_access_token}'
  WHERE key = 'insta_bot_state'
    AND (data->'config' ? 'access_token' OR data->'config' ? 'ig_access_token');

  UPDATE public.site_settings
  SET data = (data #- '{config,page_access_token}') #- '{config,gemini_api_key}'
  WHERE key = 'fb_bot_state'
    AND (data->'config' ? 'page_access_token' OR data->'config' ? 'gemini_api_key');

  UPDATE public.site_settings
  SET data = (data #- '{config,client_secret}') #- '{config,refresh_token}'
  WHERE key = 'yt_bot_state'
    AND (data->'config' ? 'client_secret' OR data->'config' ? 'refresh_token');

  UPDATE public.site_settings
  SET data = data #- '{config,tiktok_access_token}'
  WHERE key = 'tt_bot_state' AND (data->'config' ? 'tiktok_access_token');
END;
$$;
REVOKE ALL ON FUNCTION public.sanitize_bot_credentials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sanitize_bot_credentials() TO service_role;

-- Execute sanitization as part of this migration.
SELECT public.sanitize_bot_credentials();

-- Expose only explicitly approved UI fields; never return the source JSON document.
CREATE OR REPLACE FUNCTION public.get_public_bot_ui_state(p_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE v_data jsonb;
BEGIN
  IF p_key IS NULL OR p_key NOT IN
    ('insta_bot_state', 'fb_bot_state', 'tt_bot_state', 'yt_bot_state') THEN
    RETURN NULL;
  END IF;
  SELECT s.data INTO v_data FROM public.site_settings AS s WHERE s.key = p_key LIMIT 1;
  IF v_data IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'key', p_key,
    'posting_slots', COALESCE(v_data->'config'->'posting_slots', '[]'::jsonb),
    'auto_publish_enabled', COALESCE(v_data->'config'->'auto_publish_enabled', 'false'::jsonb),
    'rules', COALESCE(v_data->'rules', '[]'::jsonb),
    'scheduled_posts', COALESCE(v_data->'scheduled_posts', '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_bot_ui_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_bot_ui_state(text) TO anon, authenticated, service_role;

CREATE VIEW public.v_public_bot_ui_state AS
SELECT s.key, public.get_public_bot_ui_state(s.key) AS data, s.updated_at
FROM public.site_settings AS s
WHERE s.key IN ('insta_bot_state', 'fb_bot_state', 'tt_bot_state', 'yt_bot_state');
REVOKE ALL ON public.v_public_bot_ui_state FROM PUBLIC;
GRANT SELECT ON public.v_public_bot_ui_state TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.server_secrets (
  key text PRIMARY KEY, secret_value text NOT NULL,
  description text, updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.server_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.server_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.server_secrets TO service_role;

COMMIT;

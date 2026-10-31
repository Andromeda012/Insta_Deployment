-- NOVA follow-up hardening migration
-- Mirrors the security changes applied and verified on the connected production project.
-- Safe to re-run. Admin write API is intentionally NOT included until an admin Auth user exists.

BEGIN;

-- Public catalogue: read-only for browser roles.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access on products" ON public.products;
DROP POLICY IF EXISTS "Public full access on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Public full access on gallery" ON public.gallery;
DROP POLICY IF EXISTS "Public full access on blogs" ON public.blogs;

DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Public read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Public read gallery" ON public.gallery;
DROP POLICY IF EXISTS "Public read blogs" ON public.blogs;

CREATE POLICY "Public read products" ON public.products
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read suppliers" ON public.suppliers
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read gallery" ON public.gallery
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read blogs" ON public.blogs
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.products, public.suppliers, public.gallery, public.blogs
  FROM anon, authenticated;
GRANT SELECT ON public.products, public.suppliers, public.gallery, public.blogs
  TO anon, authenticated;

-- Bot settings: browser roles may read only approved UI state; no direct writes.
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read safe site_settings only" ON public.site_settings;
CREATE POLICY "Public read safe site_settings only"
ON public.site_settings FOR SELECT TO anon, authenticated
USING (key = ANY (ARRAY[
  'company_info','contact_info','hero_banner','theme_settings',
  'product_transform_settings','social_campaign_assets',
  'instagram_published_tracker'
]::text[]));
REVOKE INSERT, UPDATE, DELETE ON public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

-- The public bot view must obey the querying role's permissions and RLS.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_public_bot_ui_state(p_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_data jsonb;
BEGIN
  IF p_key IS NULL OR p_key NOT IN ('insta_bot_state','fb_bot_state') THEN RETURN NULL; END IF;
  SELECT s.data INTO v_data FROM public.site_settings AS s WHERE s.key = p_key LIMIT 1;
  IF v_data IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'key', p_key,
    'posting_slots', COALESCE(v_data->'config'->'posting_slots','[]'::jsonb),
    'auto_publish_enabled', COALESCE(v_data->'config'->'auto_publish_enabled','false'::jsonb),
    'rules', COALESCE(v_data->'rules','[]'::jsonb),
    'scheduled_posts', COALESCE(v_data->'scheduled_posts','[]'::jsonb)
  );
END;
$function$;
REVOKE ALL ON FUNCTION private.get_public_bot_ui_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_public_bot_ui_state(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_bot_ui_state(p_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $function$
  SELECT private.get_public_bot_ui_state(p_key);
$function$;
REVOKE ALL ON FUNCTION public.get_public_bot_ui_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_bot_ui_state(text) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.v_public_bot_ui_state
WITH (security_invoker = true)
AS
SELECT k.key, public.get_public_bot_ui_state(k.key) AS data, NULL::timestamptz AS updated_at
FROM (VALUES ('insta_bot_state'::text), ('fb_bot_state'::text)) AS k(key);
REVOKE ALL ON public.v_public_bot_ui_state FROM PUBLIC;
GRANT SELECT ON public.v_public_bot_ui_state TO anon, authenticated;

-- Queue and server-side secrets are never accessible to browser roles.
ALTER TABLE public.social_publish_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_publish_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.social_publish_queue TO service_role;
DROP POLICY IF EXISTS "service_role_full_access_social_publish_queue" ON public.social_publish_queue;
CREATE POLICY "service_role_full_access_social_publish_queue" ON public.social_publish_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.server_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.server_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.server_secrets TO service_role;
DROP POLICY IF EXISTS "service_role_full_access_server_secrets" ON public.server_secrets;
CREATE POLICY "service_role_full_access_server_secrets" ON public.server_secrets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cover the queue's product foreign key to avoid unnecessary scans.
CREATE INDEX IF NOT EXISTS idx_social_publish_queue_product_slug
  ON public.social_publish_queue (product_slug);

COMMIT;

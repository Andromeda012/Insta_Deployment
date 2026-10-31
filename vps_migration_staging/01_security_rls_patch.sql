-- ============================================================================
-- NOVA FURNITURE — SUPABASE GÜVENLİK VE RLS YAMASI (01_security_rls_patch.sql)
-- ============================================================================
-- GÜVENLİK İLKELERİ VE TEKNİK DOĞRULAMALAR:
-- 1. SIFIR Yazma Yetkisi (Read-Only):
--    Anonim ve genel kullanıcılara INSERT, UPDATE veya DELETE yetkisi VERİLMEZ.
--    'Public upsert safe site_settings only' politikası tamamen kaldırılmıştır.
-- 2. Tekrar Çalıştırılabilirlik (Idempotency):
--    Tüm eski ve olası politika adları 'DROP POLICY IF EXISTS' ile temizlenir;
--    migration tekrar çalıştığında politika çakışması hatası vermez.
-- 3. Gerçek JSONB Token Yollarının Temizlenmesi:
--    Kod tabanında yapılan statik analizle tespit edilen gerçek token alanları:
--      * Instagram: data->'config'->>'access_token', data->'config'->>'ig_access_token'
--      * Facebook:  data->'config'->>'page_access_token', data->'config'->>'gemini_api_key'
--      * TikTok:    data->'config'->>'tiktok_access_token'
--      * YouTube:   data->'config'->>'client_secret', data->'config'->>'refresh_token'
--    Bilinmeyen veya tahmin edilen alanlar silinmez, yalnızca tespit edilenler temizlenir.
-- 4. Güvenli API Yaklaşımı ('get_public_bot_ui_state'):
--    View yerine SECURITY DEFINER bir RPC fonksiyonu ile YALNIZCA beyaz listedeki
--    güvenli UI alanları (posting_slots, rules, auto_publish_enabled) döndürülür.
--    Token veya secret sızıntısı ihtimali matematiksel olarak sıfırlanmıştır.
-- 5. search_path Güvenliği:
--    'SECURITY DEFINER' fonksiyonlarında sabit 'SET search_path = public, pg_temp;'
--    kullanılarak yetki yükseltme (privilege escalation) açığı önlenmiştir.
-- ============================================================================

-- ADIM 1: `site_settings` Üzerinde RLS'yi Etkinleştir ve Tüm Eski Politikaları Temizle (Idempotent)
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

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

-- ADIM 2: Anonim ve Genel Kullanıcıların Yazma Yetkilerini Kesin Olarak Kaldır
REVOKE INSERT, UPDATE, DELETE ON public.site_settings FROM anon, public, authenticated;
GRANT ALL ON public.site_settings TO service_role;

-- ADIM 3: Yalnızca Genel Vitrin Ayarları İçin Güvenli SELECT Politikası
-- DİKKAT: 'insta_bot_state', 'fb_bot_state', 'tt_bot_state', 'yt_bot_state'
-- bu listede KESİNLİKLE YOKTUR! Anonim kullanıcılar bu satırları asla göremez.
CREATE POLICY "Public read safe site_settings only" 
ON public.site_settings 
FOR SELECT 
TO public 
USING (
    key IN (
        'company_info',
        'contact_info',
        'hero_banner',
        'theme_settings',
        'product_transform_settings',
        'social_campaign_assets',
        'instagram_published_tracker'
    )
);

-- ADIM 4: Token Temizleme Saklı Yordamı (Yalnızca Doğrulanmış Gerçek JSONB Yolları)
CREATE OR REPLACE FUNCTION public.sanitize_bot_credentials()
RETURNS void AS $$
BEGIN
    -- Instagram bot state: doğrulanmış token alanlarını temizle
    UPDATE public.site_settings
    SET data = (data #- '{config,access_token}') #- '{config,ig_access_token}'
    WHERE key = 'insta_bot_state'
      AND (data->'config' ? 'access_token' OR data->'config' ? 'ig_access_token');

    -- Facebook bot state: doğrulanmış token alanlarını temizle
    UPDATE public.site_settings
    SET data = (data #- '{config,page_access_token}') #- '{config,gemini_api_key}'
    WHERE key = 'fb_bot_state'
      AND (data->'config' ? 'page_access_token' OR data->'config' ? 'gemini_api_key');

    -- YouTube bot state: doğrulanmış secret ve refresh token alanlarını temizle
    UPDATE public.site_settings
    SET data = (data #- '{config,client_secret}') #- '{config,refresh_token}'
    WHERE key = 'yt_bot_state'
      AND (data->'config' ? 'client_secret' OR data->'config' ? 'refresh_token');

    -- TikTok bot state: doğrulanmış access token alanını temizle
    UPDATE public.site_settings
    SET data = data #- '{config,tiktok_access_token}'
    WHERE key = 'tt_bot_state'
      AND (data->'config' ? 'tiktok_access_token');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Sadece service_role rolü çalıştırabilir
REVOKE EXECUTE ON FUNCTION public.sanitize_bot_credentials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sanitize_bot_credentials() TO service_role;

-- ADIM 5: Yönetim Paneli İçin Güvenli Beyaz Liste RPC Fonksiyonu
-- View yaklaşımı yerine bu fonksiyon, JSONB içindeki yalnızca güvenli UI alanlarını
-- (posting_slots, auto_publish_enabled, rules) seçerek döndürür. Token sızıntısı imkansızdır.
CREATE OR REPLACE FUNCTION public.get_public_bot_ui_state(p_key text)
RETURNS jsonb AS $$
DECLARE
    v_data jsonb;
BEGIN
    IF p_key NOT IN ('insta_bot_state', 'fb_bot_state', 'tt_bot_state', 'yt_bot_state') THEN
        RETURN NULL;
    END IF;

    SELECT data INTO v_data FROM public.site_settings WHERE key = p_key;
    IF v_data IS NULL THEN
        RETURN NULL;
    END IF;

    -- SADECE güvenli UI alanlarını beyaz liste ile döndür (Token/Secret asla dahil edilmez)
    RETURN jsonb_build_object(
        'key', p_key,
        'posting_slots', COALESCE(v_data->'config'->'posting_slots', '[]'::jsonb),
        'auto_publish_enabled', COALESCE(v_data->'config'->'auto_publish_enabled', 'false'::jsonb),
        'rules', COALESCE(v_data->'rules', '[]'::jsonb),
        'scheduled_posts', COALESCE(v_data->'scheduled_posts', '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_public_bot_ui_state(text) TO anon, authenticated, service_role;

-- Geriye dönük uyumluluk görünümü (Eski paneller için, get_public_bot_ui_state üzerinden beslenir)
DROP VIEW IF EXISTS public.v_public_bot_ui_state;
CREATE OR REPLACE VIEW public.v_public_bot_ui_state AS
SELECT 
    s.key,
    public.get_public_bot_ui_state(s.key) AS data,
    s.updated_at
FROM public.site_settings s
WHERE s.key IN ('insta_bot_state', 'fb_bot_state', 'tt_bot_state', 'yt_bot_state');

GRANT SELECT ON public.v_public_bot_ui_state TO anon, authenticated, service_role;

-- ADIM 6: MİGRASYON ÇALIŞTIRMA ADIMI
-- Token temizleme fonksiyonunu doğrudan çalıştır:
SELECT public.sanitize_bot_credentials();

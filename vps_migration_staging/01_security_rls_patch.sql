-- ============================================================================
-- NOVA FURNITURE — SUPABASE GÜVENLİK VE RLS YAMASI (01_security_rls_patch.sql)
-- ============================================================================
-- GÜVENLİK İLKELERİ VE DÜZELTMELER:
-- 1. Anonim Kullanıcıya SIFIR Yazma Yetkisi:
--    `site_settings` tablosundaki tüm INSERT, UPDATE ve DELETE politikaları
--    anonim ve public kullanıcılardan kaldırılmıştır. Anon kullanıcılara
--    asla yazma yetkisi verilmez (Tam Salt-Okunur).
-- 2. Tekrar Çalıştırılabilirlik (Idempotency):
--    Tüm eski ve olası politika adları 'DROP POLICY IF EXISTS' ile temizlenir;
--    migration tekrar çalıştığında isim çakışması hatası vermez.
-- 3. Token İzolasyonu ve Sökülmesi:
--    PostgreSQL RLS satır seviyesindedir. Hassas bot state kayıtları
--    ('insta_bot_state', 'fb_bot_state', 'tt_bot_state', 'yt_bot_state')
--    anonim erişiminden TAMAMEN ÇIKARILMIŞTIR.
-- 4. Korumalı Bot Durumu Görünümü ('v_public_bot_ui_state'):
--    Yönetim paneli vitrin ve slot verilerini okurken token sızıntısı olmaması
--    için tüm olası token/secret alanları view seviyesinde JSONB'den soyulur.
-- 5. search_path Güvenliği:
--    'SECURITY DEFINER' fonksiyonunda 'SET search_path = public, pg_temp;'
--    zorunlu kılınmış ve fonksiyon çalıştırma yetkisi yalnızca 'service_role'e verilmiştir.
-- 6. Token İptali Uyarısı:
--    Veritabanındaki tokenların silinmesi veya maskelenmesi, daha önce sızmış
--    olabilecek bir belirteci sağlayıcı (Meta, Google, TikTok) tarafında
--    GEÇERSİZ KILMAZ. Canlı geçişte sağlayıcı panellerinden yeni token üretilmelidir.
-- ============================================================================

-- ADIM 1: `site_settings` Üzerindeki Tüm Eski Politikaları Temizle (Idempotent)
DROP POLICY IF EXISTS "Public full access on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public read access on safe site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public upsert access on safe site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public read safe keys only" ON public.site_settings;
DROP POLICY IF EXISTS "Public upsert safe keys only" ON public.site_settings;
DROP POLICY IF EXISTS "Public read safe site_settings only" ON public.site_settings;
DROP POLICY IF EXISTS "Public upsert safe site_settings only" ON public.site_settings;

-- ADIM 2: Anonim Kullanıcıların Yazma Haklarını Tamamen Kaldır
REVOKE INSERT, UPDATE, DELETE ON public.site_settings FROM anon, public;

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

-- ADIM 4: Token Temizleme Saklı Yordamı (Tüm Olası Token Yollarını Söker)
CREATE OR REPLACE FUNCTION public.sanitize_bot_credentials()
RETURNS void AS $$
BEGIN
    -- Instagram bot state temizliği
    UPDATE public.site_settings
    SET data = ((((data #- '{config,access_token}') 
                       #- '{config,ig_access_token}') 
                       #- '{config,meta_access_token}') 
                       #- '{config,token}') 
                       #- '{config,gemini_api_key}'
    WHERE key = 'insta_bot_state';

    -- Facebook bot state temizliği
    UPDATE public.site_settings
    SET data = ((data #- '{config,page_access_token}') 
                      #- '{config,access_token}') 
                      #- '{config,gemini_api_key}'
    WHERE key = 'fb_bot_state';

    -- YouTube bot state temizliği
    UPDATE public.site_settings
    SET data = (((data #- '{config,client_secret}') 
                       #- '{config,refresh_token}') 
                       #- '{config,access_token}') 
                       #- '{config,gemini_api_key}'
    WHERE key = 'yt_bot_state';

    -- TikTok bot state temizliği
    UPDATE public.site_settings
    SET data = ((((data #- '{config,tiktok_access_token}') 
                        #- '{config,access_token}') 
                        #- '{config,client_secret}') 
                        #- '{config,refresh_token}') 
                        #- '{config,gemini_api_key}'
    WHERE key = 'tt_bot_state';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Sadece service_role rolü çalıştırabilir
REVOKE EXECUTE ON FUNCTION public.sanitize_bot_credentials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sanitize_bot_credentials() TO service_role;

-- ADIM 5: Yönetim Paneli İçin Güvenli Bot Görünümü (View)
-- Bu görünüm arayüzün bot kurallarını ve saat slotlarını okumasını sağlar;
-- ancak tüm gizli anahtarlar görünüm seviyesinde fiziksel olarak çıkartılır.
CREATE OR REPLACE VIEW public.v_public_bot_ui_state AS
SELECT 
    key,
    data - 'config' || jsonb_build_object(
        'config', (data->'config') 
            - 'access_token' 
            - 'ig_access_token' 
            - 'meta_access_token' 
            - 'token' 
            - 'page_access_token' 
            - 'tiktok_access_token' 
            - 'tiktok_client_secret' 
            - 'client_secret' 
            - 'refresh_token' 
            - 'gemini_api_key' 
            - 'api_key' 
            - 'photoroom_api_key'
    ) AS data,
    updated_at
FROM public.site_settings
WHERE key IN ('insta_bot_state', 'fb_bot_state', 'tt_bot_state', 'yt_bot_state');

GRANT SELECT ON public.v_public_bot_ui_state TO anon, authenticated;

-- ADIM 6: MİGRASYON ÇALIŞTIRMA ADIMI
-- Token temizleme fonksiyonunu migration anında doğrudan çalıştır:
SELECT public.sanitize_bot_credentials();

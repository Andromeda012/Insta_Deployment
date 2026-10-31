-- ============================================================================
-- GLOBAL MOBİLYA — SUPABASE GÜVENLİK VE RLS YAMASI v2 (01_security_rls_patch_v2.sql)
-- ============================================================================
-- TEKNİK DENETİM VE MİMARİ RAPORU:
-- 1. PostgreSQL RLS mekanizması SATIR (ROW) seviyesinde filtreleme yapar.
--    JSONB tipindeki 'data' sütununun içerisindeki belirli anahtarları ('access_token')
--    sıradan bir RLS 'USING' veya 'CHECK' kuralı ile sütun düzeyinde maskelemek
--    veya gizlemek teknik olarak MÜMKÜN DEĞİLDİR.
-- 2. Eğer 'site_settings' tablosundaki 'insta_bot_state' satırı public SELECT
--    yetkisine açılırsa, o satırdaki bütün JSONB içeriği anonim anahtarla okunabilir!
-- 3. ÇÖZÜM MİMARİSİ:
--    a) 'site_settings' tablosundaki tüm bot durumları içinden token ve gizli
--       anahtarlar FİZİKSEL OLARAK SİLİNİR (`#-` operatörü ile).
--    b) Sosyal medya token'ları ARTIK KESİNLİKLE 'site_settings' içinde tutulmaz.
--       Token'lar YALNIZCA VPS üzerindeki `.env` ortam değişkenlerinde barındırılır.
--    c) Eğer veritabanında token saklanmak istenirse, 'private.server_secrets'
--       adlı YENİ ve 'public/anon' rollerine %100 KAPALI bir tablo oluşturulur;
--       bu tabloya sadece VPS worker'larının kullandığı SERVICE_ROLE erişebilir.
-- ============================================================================

-- ADIM 1: `site_settings` tablosundaki eski aşırı izinli RLS politikalarını sıfırla
DROP POLICY IF EXISTS "Public full access on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public read access on safe site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public upsert access on safe site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public read safe keys only" ON public.site_settings;
DROP POLICY IF EXISTS "Public upsert safe keys only" ON public.site_settings;

-- ADIM 2: Token'ları `site_settings` tablosundan tamamen sök ve temizle
-- Not: Bu işlem 'data' JSON nesnesinden token anahtarlarını fiziksel olarak siler.
CREATE OR REPLACE FUNCTION public.sanitize_bot_credentials()
RETURNS void AS $$
BEGIN
    -- Instagram bot state: access_token ve ig_access_token anahtarlarını sil
    UPDATE public.site_settings
    SET data = (data #- '{config,access_token}') #- '{config,ig_access_token}'
    WHERE key = 'insta_bot_state'
      AND (data->'config' ? 'access_token' OR data->'config' ? 'ig_access_token');

    -- Facebook bot state: page_access_token anahtarını sil
    UPDATE public.site_settings
    SET data = data #- '{config,page_access_token}'
    WHERE key = 'fb_bot_state'
      AND (data->'config' ? 'page_access_token');

    -- YouTube bot state: client_secret ve refresh_token anahtarlarını sil
    UPDATE public.site_settings
    SET data = (data #- '{config,client_secret}') #- '{config,refresh_token}'
    WHERE key = 'yt_bot_state'
      AND (data->'config' ? 'client_secret' OR data->'config' ? 'refresh_token');

    -- TikTok bot state: tiktok_access_token anahtarını sil
    UPDATE public.site_settings
    SET data = data #- '{config,tiktok_access_token}'
    WHERE key = 'tt_bot_state'
      AND (data->'config' ? 'tiktok_access_token');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ADIM 3: Beyaz Liste Bazlı Satır Düzeyinde Güvenli Okuma (SELECT) Politikası
-- Frontend modüllerinin (Module 1, 2, 7 ve vitrin) yalnızca ihtiyaç duyduğu anahtarlar:
CREATE POLICY "Public read safe keys only" 
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
        'instagram_published_tracker',
        'insta_bot_state',
        'fb_bot_state',
        'tt_bot_state',
        'yt_bot_state'
    )
);

-- ADIM 4: Beyaz Liste Bazlı Panel Güncelleme (UPSERT/UPDATE) Politikası
-- Anonim kullanıcılar yalnızca beyaz listedeki anahtarları güncelleyebilir.
CREATE POLICY "Public upsert safe keys only" 
ON public.site_settings 
FOR ALL 
TO public 
USING (
    key IN (
        'company_info',
        'contact_info',
        'hero_banner',
        'theme_settings',
        'product_transform_settings',
        'social_campaign_assets',
        'instagram_published_tracker',
        'insta_bot_state',
        'fb_bot_state',
        'tt_bot_state',
        'yt_bot_state'
    )
) 
WITH CHECK (
    key IN (
        'company_info',
        'contact_info',
        'hero_banner',
        'theme_settings',
        'product_transform_settings',
        'social_campaign_assets',
        'instagram_published_tracker',
        'insta_bot_state',
        'fb_bot_state',
        'tt_bot_state',
        'yt_bot_state'
    )
);

-- ADIM 5: İsteğe Bağlı İzole Sunucu Sırları Tablosu (Sadece Service Role Erişebilir)
-- Bu tabloya 'anon' veya 'authenticated' rolleri KESİNLİKLE erişemez.
CREATE TABLE IF NOT EXISTS public.server_secrets (
    key TEXT PRIMARY KEY,
    secret_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.server_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.server_secrets FROM public, anon, authenticated;
-- Not: Supabase 'service_role' anahtarı RLS'yi otomatik olarak bypass eder.

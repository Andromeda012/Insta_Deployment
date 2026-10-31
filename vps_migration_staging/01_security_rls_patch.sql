-- ============================================================================
-- GLOBAL MOBİLYA — SUPABASE GÜVENLİK VE RLS YAMASI (01_security_rls_patch.sql)
-- ============================================================================
-- AMAÇ:
-- 1. `site_settings` içindeki hassas token ve anahtarların Anon Key ile
--    dünyaya açık olmasını önlemek.
-- 2. Mevcut yönetim panellerinin (Module 1, 2, 7) çalışma bütünlüğünü korumak.
-- 3. VPS Worker'larının SERVICE_ROLE anahtarı ile tam yetkili çalışmasını sağlamak.
-- ============================================================================

-- ADIM 1: `site_settings` tablosundaki mevcut aşırı izinli 'Public full access' kuralını kaldır
DROP POLICY IF EXISTS "Public full access on site_settings" ON public.site_settings;

-- ADIM 2: Güvenli Okuma (SELECT) Politikası:
-- Sadece genel vitrin ve panel ayarlarının anonim kullanıcılarca okunmasına izin ver.
-- Bot durumları içindeki tokenlar temizlendikten sonra anonim okuma güvenli hale gelir.
CREATE POLICY "Public read access on safe site_settings" 
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

-- ADIM 3: Panelden Ayar Kaydetme (UPSERT/INSERT/UPDATE) Politikası:
-- Sadece anonim/authenticated oturumların izin verilen anahtarları güncellemesine izin ver.
CREATE POLICY "Public upsert access on safe site_settings" 
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

-- ADIM 4: Token Temizleme (Sanitize) Fonksiyonu:
-- Mevcut `site_settings` içindeki `access_token`, `client_secret` gibi alanları maskeleyin.
-- (VPS ortam değişkenlerine taşındıktan sonra çalıştırılacaktır)
CREATE OR REPLACE FUNCTION public.sanitize_bot_credentials()
RETURNS void AS $$
BEGIN
    -- Instagram bot state temizliği
    UPDATE public.site_settings
    SET data = jsonb_set(
        jsonb_set(data, '{config,access_token}', '"[STORED_SECURELY_ON_VPS]"'::jsonb, true),
        '{config,ig_access_token}', '"[STORED_SECURELY_ON_VPS]"'::jsonb, true
    )
    WHERE key = 'insta_bot_state' AND data->'config'->>'access_token' IS NOT NULL;

    -- Facebook bot state temizliği
    UPDATE public.site_settings
    SET data = jsonb_set(data, '{config,page_access_token}', '"[STORED_SECURELY_ON_VPS]"'::jsonb, true)
    WHERE key = 'fb_bot_state' AND data->'config'->>'page_access_token' IS NOT NULL;

    -- YouTube bot state temizliği
    UPDATE public.site_settings
    SET data = jsonb_set(
        jsonb_set(data, '{config,client_secret}', '"[STORED_SECURELY_ON_VPS]"'::jsonb, true),
        '{config,refresh_token}', '"[STORED_SECURELY_ON_VPS]"'::jsonb, true
    )
    WHERE key = 'yt_bot_state' AND data->'config'->>'client_secret' IS NOT NULL;

    -- TikTok bot state temizliği
    UPDATE public.site_settings
    SET data = jsonb_set(data, '{config,tiktok_access_token}', '"[STORED_SECURELY_ON_VPS]"'::jsonb, true)
    WHERE key = 'tt_bot_state' AND data->'config'->>'tiktok_access_token' IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- NOVA FURNITURE — SUPABASE GÜVENLİK VE RLS YAMASI (01_security_rls_patch.sql)
-- ============================================================================
-- TEKNİK MİMARİ VE GÜVENLİK İLKELERİ:
-- 1. PostgreSQL RLS satır (row) seviyesinde çalışır. JSONB içindeki tekil alanları
--    (örneğin data->'config'->>'access_token') sıradan RLS ile filtrelemek
--    veya maskelemek MÜMKÜN DEĞİLDİR.
-- 2. ÇÖZÜM:
--    - Hassas bot state kayıtları ('insta_bot_state', 'fb_bot_state',
--      'tt_bot_state', 'yt_bot_state') anon erişiminden TAMAMEN ÇIKARILMIŞTIR.
--    - Genel site ayarları yalnızca güvenli beyaz liste üzerinden anon kullanıcılara açılmıştır.
--    - Bot durumlarının token harici panel verilerini (slotlar, kurallar) arayüzün
--      okuyabilmesi için güvenli bir VIEW ('v_public_bot_ui_state') tanımlanmıştır.
-- 3. Yetki Sınırlandırması:
--    - RPC fonksiyonlarında PUBLIC/anon execute yetkileri kaldırılmış,
--      yalnızca 'service_role' rolüne izin verilmiştir.
--    - 'SECURITY DEFINER' fonksiyonlarında search_path açığını önlemek için
--      sabit 'SET search_path = public, pg_temp;' zorunlu kılınmıştır.
-- 4. Token İptali Uyarısı:
--    - Veritabanındaki tokenların maskelenmesi veya silinmesi, sızmış tokenı
--      Meta/TikTok/Google tarafında GEÇERSİZ KILMAZ. Canlı geçişte tokenlar
--      ilgili sağlayıcı panelinden kesinlikle yeniden üretilmelidir.
-- ============================================================================

-- ADIM 1: `site_settings` Üzerindeki Eski İzinli Politikaları Sıfırla
DROP POLICY IF EXISTS "Public full access on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public read access on safe site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public upsert access on safe site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public read safe keys only" ON public.site_settings;
DROP POLICY IF EXISTS "Public upsert safe keys only" ON public.site_settings;

-- ADIM 2: Token Temizleme Saklı Yordamı (Sabit search_path & Sıkı Yetki)
CREATE OR REPLACE FUNCTION public.sanitize_bot_credentials()
RETURNS void AS $$
BEGIN
    -- Instagram bot state: access_token ve ig_access_token alanlarını tamamen sil
    UPDATE public.site_settings
    SET data = (data #- '{config,access_token}') #- '{config,ig_access_token}'
    WHERE key = 'insta_bot_state'
      AND (data->'config' ? 'access_token' OR data->'config' ? 'ig_access_token');

    -- Facebook bot state: page_access_token alanını tamamen sil
    UPDATE public.site_settings
    SET data = data #- '{config,page_access_token}'
    WHERE key = 'fb_bot_state'
      AND (data->'config' ? 'page_access_token');

    -- YouTube bot state: client_secret ve refresh_token alanlarını tamamen sil
    UPDATE public.site_settings
    SET data = (data #- '{config,client_secret}') #- '{config,refresh_token}'
    WHERE key = 'yt_bot_state'
      AND (data->'config' ? 'client_secret' OR data->'config' ? 'refresh_token');

    -- TikTok bot state: tiktok_access_token alanını tamamen sil
    UPDATE public.site_settings
    SET data = data #- '{config,tiktok_access_token}'
    WHERE key = 'tt_bot_state'
      AND (data->'config' ? 'tiktok_access_token');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fonksiyonun varsayılan PUBLIC/anon çalıştırma yetkisini kaldır, yalnızca service_role'e ver
REVOKE EXECUTE ON FUNCTION public.sanitize_bot_credentials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sanitize_bot_credentials() TO service_role;

-- ADIM 3: Beyaz Liste Satır Düzeyinde Güvenli Okuma (SELECT) Politikası
-- DİKKAT: 'insta_bot_state', 'fb_bot_state', 'tt_bot_state', 'yt_bot_state'
-- bu listeden TAMAMEN ÇIKARILMIŞTIR! Anonim kullanıcılar bu satırları ASLA göremez.
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

-- ADIM 4: Panel Güncelleme (UPSERT/UPDATE) Politikası
-- Anonim kullanıcılar yalnızca beyaz listedeki genel vitrin anahtarlarını güncelleyebilir.
CREATE POLICY "Public upsert safe site_settings only" 
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
        'instagram_published_tracker'
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
        'instagram_published_tracker'
    )
);

-- ADIM 5: Yönetim Paneli İçin Güvenli Bot Görünümü (View)
-- Bu görünüm, yönetim panelinin bot ayarlarını (saat slotları, kurallar, yayın kuyruğu)
-- token bilgisi sızmadan güvenle okumasını sağlar.
CREATE OR REPLACE VIEW public.v_public_bot_ui_state AS
SELECT 
    key,
    -- JSONB içinden token alanlarını ayıkla
    CASE 
        WHEN key = 'insta_bot_state' THEN ((data #- '{config,access_token}') #- '{config,ig_access_token}')
        WHEN key = 'fb_bot_state' THEN (data #- '{config,page_access_token}')
        WHEN key = 'yt_bot_state' THEN ((data #- '{config,client_secret}') #- '{config,refresh_token}')
        WHEN key = 'tt_bot_state' THEN (data #- '{config,tiktok_access_token}')
        ELSE data
    END AS data,
    updated_at
FROM public.site_settings
WHERE key IN ('insta_bot_state', 'fb_bot_state', 'tt_bot_state', 'yt_bot_state');

-- View okuma yetkisi public/anon rolüne verilir (hassas anahtarlar view seviyesinde soyulmuştur)
GRANT SELECT ON public.v_public_bot_ui_state TO anon, authenticated;

-- ADIM 6: İzole Sunucu Sırları Tablosu (Opsiyonel / Sadece Service Role Erişebilir)
CREATE TABLE IF NOT EXISTS public.server_secrets (
    key TEXT PRIMARY KEY,
    secret_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.server_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.server_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.server_secrets TO service_role;

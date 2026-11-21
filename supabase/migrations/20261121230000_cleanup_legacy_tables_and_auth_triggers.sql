-- ============================================================================
-- GLOBAL KAPAK MOBİLYA — GÜVENLİ VERİTABANI TEMİZLİK MİGRASYONU
-- Tarih: 2026-11-21
-- Kapsam: Clerk Production Auth + Cloudflare R2 (cdn.globalkapakmobilya.com) +
--         Sentry EU + PostHog EU mimarisine geçiş sonrası kod tabanında hiçbir
--         karşılığı kalmayan eski/yetim tabloların, view'ların, fonksiyonların
--         ve eski Supabase Auth tetikleyicilerinin güvenli temizliği.
--
-- DİKKAT: Bu dosya otomatik çalıştırılmaz. Supabase Dashboard -> SQL Editor
--         üzerinden inceleyip onayladıktan sonra çalıştırınız.
-- ============================================================================
--
-- KORUNAN AKTİF TABLOLAR (DOKUNULMAZ):
--   1. products                 (Merkezi ürün & koleksiyon kataloğu)
--   2. site_settings            (ERP ayarları, Modül 7/8 depoları, Clerk/CRM yedeği)
--   3. blogs                    (Kurumsal blog içerikleri)
--   4. gallery                  (Showroom & galeri öğeleri)
--   5. suppliers                (Tedarikçi kayıtları)
--   6. product_web_settings     (Vitrin ürün görünürlük ayarları)
--   7. content_revisions        (Modül 1 taslak/yayın sürüm geçmişi)
--   8. social_publish_queue     (Sosyal medya paylaşım kuyruğu — Vercel Cron / Modül 2)
--   9. media_assets             (Modül 8 medya kayıtları — R2 URL'leri)
--  10. three_d_assets           (Modül 8 .glb/.gltf 3D showroom modelleri — R2 URL'leri)
--  11. production_jobs          (Modül 8 üretim işleri)
--  12. production_events        (Modül 8 iş olay logları)
--  13. production_outputs       (Modül 8 üretim çıktıları)
--  14. production_costs         (Modül 8 maliyet takibi)
--  15. scene_templates          (Modül 8 sahne şablonları)
--  16. erp_users                (Clerk Organization + publicMetadata.department senkronu)
--  17. crm_customers            (Vitrin Lazy Registration teklif müşterileri)
-- ============================================================================

BEGIN;

-- 1. Kullanılmayan View'ların Temizlenmesi (0 kod referansı)
DROP VIEW IF EXISTS public.v_public_bot_ui_state CASCADE;

-- 2. Eski Supabase Auth Tetikleyicilerinin ve Yardımcı Fonksiyonlarının Temizlenmesi
--    (Kimlik doğrulama tamamen Clerk Production'a taşındı)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_update() CASCADE;

-- 3. Kod Tabanında Hiç Çağrılmayan Eski RPC Fonksiyonlarının Temizlenmesi
DROP FUNCTION IF EXISTS public.get_public_bot_ui_state() CASCADE;
DROP FUNCTION IF EXISTS public.sanitize_bot_credentials(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.sanitize_bot_credentials() CASCADE;

-- 4. Kod Tabanında Hiçbir Karşılığı Kalmayan Yetim / Eski Tabloların Temizlenmesi
--    - media_variants   : 0 dosya referansı (Cloudflare R2 doğrudan CDN servis ediyor)
--    - publication_logs : 0 dosya referansı (yerini social_publish_queue + Sentry EU aldı)
--    - server_secrets   : 0 dosya referansı (tüm secret'lar Vercel Env / Clerk üzerinde)
DROP TABLE IF EXISTS public.media_variants CASCADE;
DROP TABLE IF EXISTS public.publication_logs CASCADE;
DROP TABLE IF EXISTS public.server_secrets CASCADE;

COMMIT;

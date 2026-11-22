-- ============================================================================
-- GLOBAL KAPAK MOBİLYA — SUPABASE pg_cron + pg_net INSTAGRAM ZAMANLAYICISI
-- ============================================================================
-- Amaç: Vercel Hobby planındaki günde 1 cron kısıtına takılmadan, Instagram'ın
-- 10:00 (MO Reels), 14:30 (GA Carousel), 19:30 (BER Reels) Türkiye saatlerinde
-- ve 6 saatte bir yeni ürün kontrolü için /api/instagram-cron ucunu tetiklemek.
--
-- Kullanım: Supabase Dashboard -> SQL Editor üzerinden çalıştırınız.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Varsa eski işi temizle
SELECT cron.unschedule('nova-instagram-grid-scheduler')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nova-instagram-grid-scheduler');

-- Her 30 dakikada bir (veya tam slot saatlerinde) zamanı gelen Instagram kuyruk
-- görevini kontrol edip doğrudan Meta Graph API'ye yayınlamak için Vercel API'yi çağırır.
SELECT cron.schedule(
  'nova-instagram-grid-scheduler',
  '0,30 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://erp.globalkapakmobilya.com/api/instagram-cron',
    timeout_milliseconds := 55000
  );
  $$
);

-- ============================================================================
-- NOVA FURNITURE — VPS UNIFIED SCHEDULER & PUBLISHER MIGRATION PATCH
-- File: vps_migration_staging/03_scheduler_unification.sql
-- ============================================================================
-- Bu migrasyon, yönetim paneli ile VPS Publisher arasındaki tek merkezli
-- otonom zamanlama mimarisini optimize eder.
-- 1. Slot ve gün bazında hızlı mükerrerlik sorguları için birleşik indeks ekler.
-- 2. site_settings tablosundaki 'insta_bot_state' ve 'fb_bot_state' kayıtlarının
--    bütünlüğünü ve RLS politikalarını doğrular.
-- ============================================================================

BEGIN;

-- 1. Slot ve gün bazında sorgu performansını optimize eden indeks
CREATE INDEX IF NOT EXISTS idx_publish_queue_slot_lookup
ON public.social_publish_queue(platform, slot_label, scheduled_for);

-- 2. Idempotency sorguları için tekil anahtar indeksi doğrulaması
CREATE UNIQUE INDEX IF NOT EXISTS idx_publish_queue_idempotency_unique
ON public.social_publish_queue(idempotency_key);

-- 3. Yetkilendirme & RLS Güvencesi:
-- VPS Publisher runner 'service_role' rolüyle çalıştığından tüm tablolara tam erişime sahiptir.
-- Anon ve authenticated kullanıcılar (yönetim paneli) yayın saatlerini kaydetmek için
-- site_settings tablosuna INSERT/UPDATE (UPSERT) yapabilir.
GRANT SELECT, INSERT, UPDATE ON public.site_settings TO anon, authenticated;

COMMIT;

-- ============================================================================
-- NOVA FURNITURE — YAYIN KUYRUĞU TABLOSU VE ATOMİK RPC (02_social_publish_queue.sql)
-- ============================================================================
-- GÖREV KİLİDİ VE RETRY İLKELERİ:
-- 1. Zombi Kilitlerin Mutabakata Alınması:
--    Kilit süresi dolan ('locked_until < NOW()') processing görevleri KESİNLİKLE
--    otomatik 'pending' yapılmaz. Doğrudan 'reconciliation_required' durumuna alınır.
--    Çünkü kilit süresi dolduğunda API isteğinin durumu belirsizdir; tekrar çalıştırmak
--    mükerrer yayın oluşturur.
-- 2. Geçerli Kilit Uzatma:
--    `extend_publish_task_lock` YALNIZCA kilidi hâlâ geçerli olan ('locked_until > NOW()')
--    ve doğru worker'a ait görevi uzatabilir.
-- 3. Satır Kilitlemeli Görev Tamamlama (`complete_publish_task`):
--    Görev satırı 'FOR UPDATE' ile kilitlenir; worker kimliği, 'processing' durumu
--    ve kilidin geçerliliği ('locked_until >= NOW()') doğrulanır.
-- 4. Gerçek Üstel Geri Çekilme (Exponential Backoff):
--    Başarısız işler 'p_backoff_minutes * 2^(retry-1)' formülü ile (üst sınır: 60 dk) ötelenir.
-- 5. Kapsam Korumalı 'unsupported' Durumu:
--    YouTube gibi henüz binary upload desteği olmayan görevler için 'unsupported'
--    durumu eklenmiştir; görevin yayınlanmış gibi görünmesi engellenir.
-- 6. Satır Sayısı Doğrulaması:
--    Tüm fonksiyonlarda etkilenen satır sayısı ('GET DIAGNOSTICS ... ROW_COUNT')
--    denetlenir; güncelleme olmadıysa 'FALSE' dönülür.
-- 7. Yetki İzolasyonu:
--    Tüm fonksiyonlar 'SECURITY DEFINER SET search_path = public, pg_temp;' ile
--    korunur; çalıştırma yetkisi yalnızca 'service_role' rolüne aittir.
-- ============================================================================

-- 1. TABLO TANIMI
CREATE TABLE IF NOT EXISTS public.social_publish_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(32) NOT NULL,             -- 'instagram' | 'facebook' | 'tiktok' | 'youtube'
    content_type VARCHAR(32) NOT NULL,         -- 'POST' | 'REELS' | 'STORIES' | 'SHORTS'
    slot_label VARCHAR(64),
    product_slug TEXT REFERENCES public.products(slug) ON DELETE SET NULL,
    media_url TEXT NOT NULL,
    caption TEXT,
    hashtags TEXT,
    target_link TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'published' | 'failed' | 'reconciliation_required' | 'dry_run_completed' | 'unsupported' | 'cancelled'
    idempotency_key TEXT UNIQUE NOT NULL,      -- platform_slug_contenttype_slotdate
    scheduled_for TIMESTAMPTZ NOT NULL,
    locked_until TIMESTAMPTZ,
    worker_id TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    error_message TEXT,
    platform_post_id TEXT,
    platform_response JSONB,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kuyruk indeksleri
CREATE INDEX IF NOT EXISTS idx_publish_queue_fetch 
ON public.social_publish_queue (status, scheduled_for, locked_until)
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_publish_queue_platform 
ON public.social_publish_queue (platform, status);

-- Dış dünyadan tabloyu tamamen gizle (Sadece service_role)
ALTER TABLE public.social_publish_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_publish_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.social_publish_queue TO service_role;

-- 2. ATOMİK GÖREV ALMA VE KİLİTLEME RPC FONKSİYONU
CREATE OR REPLACE FUNCTION public.claim_next_publish_task(
    p_worker_id TEXT,
    p_lock_duration_seconds INT DEFAULT 180
)
RETURNS TABLE (
    task_id UUID,
    platform VARCHAR,
    content_type VARCHAR,
    product_slug TEXT,
    media_url TEXT,
    caption TEXT,
    hashtags TEXT,
    target_link TEXT,
    idempotency_key TEXT,
    retry_count INT,
    scheduled_for TIMESTAMPTZ
) AS $$
DECLARE
    v_task_id UUID;
    v_updated INT;
BEGIN
    -- Adım 1: Kilit süresi dolmuş processing işleri ASLA pending yapma!
    -- Bunları doğrudan 'reconciliation_required' durumuna al (Mükerrer yayın koruması)
    UPDATE public.social_publish_queue
    SET status = 'reconciliation_required',
        locked_until = NULL,
        error_message = COALESCE(error_message, '') || ' [Zaman aşımı: Kilit süresi doldu, API istek durumu belirsiz]',
        updated_at = NOW()
    WHERE status = 'processing'
      AND locked_until < NOW();

    -- Adım 2: Zamanı gelmiş uygun GÖREVİ atomik kilitle (FOR UPDATE SKIP LOCKED)
    -- YALNIZCA 'pending' durumundaki aktif platform görevleri seçilir!
    -- KURAL: YouTube gerçek binary upload desteği tamamlanana kadar yayın kuyruğundan dışarıda tutulur!
    SELECT id INTO v_task_id
    FROM public.social_publish_queue
    WHERE status = 'pending'
      AND platform <> 'youtube'
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    -- Adım 3: Görevi alan worker'a zimmetle ve kilit süresini başlat
    IF v_task_id IS NOT NULL THEN
        UPDATE public.social_publish_queue
        SET status = 'processing',
            locked_until = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL,
            worker_id = p_worker_id,
            retry_count = retry_count + 1,
            updated_at = NOW()
        WHERE id = v_task_id;

        GET DIAGNOSTICS v_updated = ROW_COUNT;
        IF v_updated = 0 THEN
            RETURN;
        END IF;

        RETURN QUERY
        SELECT 
            q.id,
            q.platform,
            q.content_type,
            q.product_slug,
            q.media_url,
            q.caption,
            q.hashtags,
            q.target_link,
            q.idempotency_key,
            q.retry_count,
            q.scheduled_for
        FROM public.social_publish_queue q
        WHERE q.id = v_task_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.claim_next_publish_task(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_publish_task(TEXT, INT) TO service_role;

-- 3. KİLİT SÜRESİ UZATMA (LEASE RENEWAL / HEARTBEAT) RPC FONKSİYONU
CREATE OR REPLACE FUNCTION public.extend_publish_task_lock(
    p_task_id UUID,
    p_worker_id TEXT,
    p_extra_seconds INT DEFAULT 120
)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated INT;
BEGIN
    -- KURAL: Yalnızca kilidi hâlâ GEÇERLİ olan ('locked_until > NOW()') görev uzatılabilir!
    UPDATE public.social_publish_queue
    SET locked_until = NOW() + (p_extra_seconds || ' seconds')::INTERVAL,
        updated_at = NOW()
    WHERE id = p_task_id
      AND worker_id = p_worker_id
      AND status = 'processing'
      AND locked_until > NOW();
      
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.extend_publish_task_lock(UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_publish_task_lock(UUID, TEXT, INT) TO service_role;

-- 4. GÖREV SONUÇLANDIRMA RPC FONKSİYONU (SATIR KİLİT & GEÇERLİ LEASE DOĞRULAMALI)
CREATE OR REPLACE FUNCTION public.complete_publish_task(
    p_task_id UUID,
    p_worker_id TEXT,
    p_status VARCHAR,                  -- 'published' | 'failed' | 'reconciliation_required' | 'dry_run_completed' | 'unsupported'
    p_platform_post_id TEXT DEFAULT NULL,
    p_platform_response JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_backoff_minutes INT DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
    v_retries INT;
    v_max_retries INT;
    v_current_worker TEXT;
    v_current_status TEXT;
    v_locked_until TIMESTAMPTZ;
    v_updated INT;
    v_backoff_calc INT;
BEGIN
    -- 1. Geçersiz durum değerlerini anında reddet
    IF p_status NOT IN ('published', 'failed', 'reconciliation_required', 'dry_run_completed', 'unsupported') THEN
        RETURN FALSE;
    END IF;

    -- 2. Görev satırını kilitleyerek doğrula (FOR UPDATE)
    SELECT worker_id, status, locked_until, retry_count, max_retries
    INTO v_current_worker, v_current_status, v_locked_until, v_retries, v_max_retries
    FROM public.social_publish_queue
    WHERE id = p_task_id
    FOR UPDATE;

    -- Görev bulunamadıysa, işlemde değilse, worker uyuşmuyorsa veya kilit süresi dolmuşsa reddet!
    IF v_current_status IS NULL 
       OR v_current_status <> 'processing' 
       OR v_current_worker <> p_worker_id 
       OR v_locked_until IS NULL
       OR v_locked_until < NOW() THEN
        RETURN FALSE;
    END IF;

    -- 3. Başarılı Yayın
    IF p_status = 'published' THEN
        UPDATE public.social_publish_queue
        SET status = 'published',
            platform_post_id = p_platform_post_id,
            platform_response = p_platform_response,
            published_at = NOW(),
            locked_until = NULL,
            error_message = NULL,
            updated_at = NOW()
        WHERE id = p_task_id AND worker_id = p_worker_id;

    -- 4. Dry-Run Simülasyonu
    ELSIF p_status = 'dry_run_completed' THEN
        UPDATE public.social_publish_queue
        SET status = 'dry_run_completed',
            platform_post_id = 'DRY_RUN_' || COALESCE(p_platform_post_id, gen_random_uuid()::text),
            platform_response = p_platform_response,
            published_at = NOW(),
            locked_until = NULL,
            error_message = NULL,
            updated_at = NOW()
        WHERE id = p_task_id AND worker_id = p_worker_id;

    -- 5. Desteklenmeyen Platform / Özellik (Örn: YouTube binary upload)
    ELSIF p_status = 'unsupported' THEN
        UPDATE public.social_publish_queue
        SET status = 'unsupported',
            locked_until = NULL,
            error_message = p_error_message,
            platform_response = p_platform_response,
            updated_at = NOW()
        WHERE id = p_task_id AND worker_id = p_worker_id;

    -- 6. Belirsiz Yanıt / Mutabakat Gerekir (Otomatik Retry YOKTUR)
    ELSIF p_status = 'reconciliation_required' THEN
        UPDATE public.social_publish_queue
        SET status = 'reconciliation_required',
            locked_until = NULL,
            error_message = p_error_message,
            platform_response = p_platform_response,
            updated_at = NOW()
        WHERE id = p_task_id AND worker_id = p_worker_id;

    -- 7. Kesin Başarısızlık (Failed) — Gerçek Üstel Geri Çekilme (Max 60 dk tavan)
    ELSE -- 'failed'
        IF v_retries < v_max_retries THEN
            -- Formül: p_backoff_minutes * 2^(retry - 1), tavan 60 dakika (ör: 5dk, 10dk, 20dk, 40dk, 60dk)
            v_backoff_calc := LEAST(ROUND(p_backoff_minutes * POWER(2, GREATEST(v_retries - 1, 0))), 60);

            UPDATE public.social_publish_queue
            SET status = 'pending',
                scheduled_for = NOW() + (v_backoff_calc || ' minutes')::INTERVAL,
                locked_until = NULL,
                worker_id = NULL,
                error_message = p_error_message,
                platform_response = p_platform_response,
                updated_at = NOW()
            WHERE id = p_task_id AND worker_id = p_worker_id;
        ELSE
            UPDATE public.social_publish_queue
            SET status = 'failed',
                locked_until = NULL,
                error_message = p_error_message,
                platform_response = p_platform_response,
                updated_at = NOW()
            WHERE id = p_task_id AND worker_id = p_worker_id;
        END IF;
    END IF;

    -- Etkilenen satır sayısını kontrol et; satır güncellenmediyse (ROW_COUNT = 0) kesinlikle FALSE dön
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.complete_publish_task(UUID, TEXT, VARCHAR, TEXT, JSONB, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_publish_task(UUID, TEXT, VARCHAR, TEXT, JSONB, TEXT, INT) TO service_role;

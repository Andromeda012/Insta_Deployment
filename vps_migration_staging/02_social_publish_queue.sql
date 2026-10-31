-- ============================================================================
-- GLOBAL MOBİLYA — YAYIN KUYRUĞU TABLOSU VE ATOMİK RPC (02_social_publish_queue.sql)
-- ============================================================================
-- AMAÇ:
-- 1. Redis'e ihtiyaç duymadan %100 PostgreSQL ACID uyumlu yayın kuyruğu sağlamak.
-- 2. `FOR UPDATE SKIP LOCKED` ile eşzamanlı çift yayınları kesin olarak önlemek.
-- 3. `locked_until` ile zaman aşımına uğrayan görevleri otomatik kurtarmak.
-- 4. Idempotency ve üstel geri çekilme (exponential backoff) mantığını işletmek.
-- ============================================================================

-- 1. TABLO TANIMI
CREATE TABLE IF NOT EXISTS public.social_publish_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(32) NOT NULL,             -- 'instagram' | 'facebook' | 'tiktok' | 'youtube'
    content_type VARCHAR(32) NOT NULL,         -- 'POST' | 'REELS' | 'STORIES' | 'SHORTS'
    slot_label VARCHAR(64),                    -- 'Sabah (10:00)' vb.
    product_slug TEXT REFERENCES public.products(slug) ON DELETE SET NULL,
    media_url TEXT NOT NULL,
    caption TEXT,
    hashtags TEXT,
    target_link TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'published' | 'failed' | 'cancelled'
    idempotency_key TEXT UNIQUE NOT NULL,      -- platform_product_slotdate örn: 'ig_porto-portmanto_reels_2026-11-01'
    scheduled_for TIMESTAMPTZ NOT NULL,
    locked_until TIMESTAMPTZ,                  -- Worker kilit süresi (örn: NOW() + 3 dakika)
    worker_id TEXT,                            -- Görevi alan worker instance etiketi
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    error_message TEXT,
    platform_post_id TEXT,                     -- Meta/TikTok/YT dönen ID
    platform_response JSONB,                   -- API tam yanıt gövdesi
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hızlı kuyruk tarama ve indeksler
CREATE INDEX IF NOT EXISTS idx_publish_queue_fetch 
ON public.social_publish_queue (status, scheduled_for, locked_until)
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_publish_queue_platform 
ON public.social_publish_queue (platform, status);

-- 2. ATOMİK GÖREV ALMA VE KİLİTLEME RPC FONKSİYONU
-- Tek çağrıda satırı bulur, kilitler ve processing durumuna geçirir.
CREATE OR REPLACE FUNCTION public.claim_next_publish_task(
    p_worker_id TEXT,
    p_lock_duration_seconds INT DEFAULT 180 -- Varsayılan 3 dakika
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
BEGIN
    -- 1. Adım: Süresi dolmuş (zombi/stalled) görevleri kurtar
    UPDATE public.social_publish_queue
    SET status = 'pending',
        locked_until = NULL,
        worker_id = NULL,
        error_message = COALESCE(error_message, '') || ' [Zaman aşımı nedeniyle görev kurtarıldı]',
        updated_at = NOW()
    WHERE status = 'processing'
      AND locked_until < NOW()
      AND retry_count < max_retries;

    -- 2. Adım: Maksimum denemeyi aşmış zombi görevleri 'failed' yap
    UPDATE public.social_publish_queue
    SET status = 'failed',
        locked_until = NULL,
        updated_at = NOW()
    WHERE status = 'processing'
      AND locked_until < NOW()
      AND retry_count >= max_retries;

    -- 3. Adım: Zamanı gelmiş bir sonraki uygun görevi atomik olarak kilitle (FOR UPDATE SKIP LOCKED)
    SELECT id INTO v_task_id
    FROM public.social_publish_queue
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    -- Eğer görev bulunduysa durumunu 'processing'e çek ve kilit süresini ayarla
    IF v_task_id IS NOT NULL THEN
        UPDATE public.social_publish_queue
        SET status = 'processing',
            locked_until = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL,
            worker_id = p_worker_id,
            retry_count = retry_count + 1,
            updated_at = NOW()
        WHERE id = v_task_id;

        -- Görev detaylarını döndür
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
$$ LANGUAGE plpgsql;

-- 3. GÖREV SONUÇLANDIRMA RPC FONKSİYONU
CREATE OR REPLACE FUNCTION public.complete_publish_task(
    p_task_id UUID,
    p_success BOOLEAN,
    p_platform_post_id TEXT DEFAULT NULL,
    p_platform_response JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_backoff_minutes INT DEFAULT 5
)
RETURNS VOID AS $$
DECLARE
    v_retries INT;
    v_max_retries INT;
BEGIN
    SELECT retry_count, max_retries INTO v_retries, v_max_retries
    FROM public.social_publish_queue
    WHERE id = p_task_id;

    IF p_success THEN
        UPDATE public.social_publish_queue
        SET status = 'published',
            platform_post_id = p_platform_post_id,
            platform_response = p_platform_response,
            published_at = NOW(),
            locked_until = NULL,
            error_message = NULL,
            updated_at = NOW()
        WHERE id = p_task_id;
    ELSE
        IF v_retries < v_max_retries THEN
            -- Üstel geri çekilme ile yeniden planla (5 dk, 10 dk, 20 dk...)
            UPDATE public.social_publish_queue
            SET status = 'pending',
                scheduled_for = NOW() + (p_backoff_minutes * v_retries || ' minutes')::INTERVAL,
                locked_until = NULL,
                error_message = p_error_message,
                platform_response = p_platform_response,
                updated_at = NOW()
            WHERE id = p_task_id;
        ELSE
            UPDATE public.social_publish_queue
            SET status = 'failed',
                locked_until = NULL,
                error_message = p_error_message,
                platform_response = p_platform_response,
                updated_at = NOW()
            WHERE id = p_task_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GLOBAL MOBİLYA — YAYIN KUYRUĞU TABLOSU VE ATOMİK RPC v2 (02_social_publish_queue_v2.sql)
-- ============================================================================
-- TEKNİK DENETİM VE İYİLEŞTİRMELER:
-- 1. `FOR UPDATE SKIP LOCKED`: Görev alma işlemi tek bir PL/pgSQL fonksiyonu
--    içinde atomik olarak satır kilitler ve anında 'processing' durumuna çeker.
--    İki worker'ın aynı görevi alması imkansızdır.
-- 2. Kilit Güvenliği ve Lease Yenileme (Heartbeat): Uzun süren video upload/transcoding
--    işlemleri için `extend_publish_task_lock` fonksiyonu eklendi.
-- 3. Split-Brain Koruması: `complete_publish_task` fonksiyonunda `worker_id` kontrolü
--    yapılır. Eğer kilit süresi dolup görev başka bir worker'a geçmişse, eski worker
--    sonucu ezemez.
-- 4. Belirsiz Yanıt Yönetimi (Reconciliation / Unknown): Ağ zaman aşımında API'nin
--    yayını yapıp yapmadığı kesinleşmemişse görev 'reconciliation_required' yapılır.
--    Otomatik tekrar denenmez, mükerrer paylaşım riski sıfırlanır.
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
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'published' | 'failed' | 'reconciliation_required' | 'cancelled'
    idempotency_key TEXT UNIQUE NOT NULL,      -- 'ig_porto-portmanto_reels_2026-11-01'
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

CREATE INDEX IF NOT EXISTS idx_publish_queue_fetch_v2 
ON public.social_publish_queue (status, scheduled_for, locked_until)
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_publish_queue_platform_v2 
ON public.social_publish_queue (platform, status);

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
BEGIN
    -- 1. Adım: Süresi dolmuş (zombi) kilitleri kurtar (reconciliation_required hariç!)
    UPDATE public.social_publish_queue
    SET status = 'pending',
        locked_until = NULL,
        worker_id = NULL,
        error_message = COALESCE(error_message, '') || ' [Zaman aşımı kurtarması: lease yenilenmedi]',
        updated_at = NOW()
    WHERE status = 'processing'
      AND locked_until < NOW()
      AND retry_count < max_retries;

    -- 2. Adım: Maksimum deneme hakkını dolduran zombi işleri 'failed' yap
    UPDATE public.social_publish_queue
    SET status = 'failed',
        locked_until = NULL,
        updated_at = NOW()
    WHERE status = 'processing'
      AND locked_until < NOW()
      AND retry_count >= max_retries;

    -- 3. Adım: Zamanı gelmiş uygun görevi atomik kilitle (FOR UPDATE SKIP LOCKED)
    SELECT id INTO v_task_id
    FROM public.social_publish_queue
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF v_task_id IS NOT NULL THEN
        UPDATE public.social_publish_queue
        SET status = 'processing',
            locked_until = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL,
            worker_id = p_worker_id,
            retry_count = retry_count + 1,
            updated_at = NOW()
        WHERE id = v_task_id;

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
    UPDATE public.social_publish_queue
    SET locked_until = NOW() + (p_extra_seconds || ' seconds')::INTERVAL,
        updated_at = NOW()
    WHERE id = p_task_id
      AND worker_id = p_worker_id
      AND status = 'processing';
      
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- 4. GÖREV SONUÇLANDIRMA RPC FONKSİYONU (SPLIT-BRAIN KORUMALI)
CREATE OR REPLACE FUNCTION public.complete_publish_task(
    p_task_id UUID,
    p_worker_id TEXT,
    p_status VARCHAR,                  -- 'published' | 'failed' | 'reconciliation_required'
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
BEGIN
    SELECT retry_count, max_retries, worker_id 
    INTO v_retries, v_max_retries, v_current_worker
    FROM public.social_publish_queue
    WHERE id = p_task_id;

    -- Eğer görev başka bir worker'a devredilmişse işlemi reddet (Split-Brain koruması)
    IF v_current_worker IS NOT NULL AND v_current_worker <> p_worker_id THEN
        RETURN FALSE;
    END IF;

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

    ELSIF p_status = 'reconciliation_required' THEN
        -- Belirsiz API yanıtı: Mükerrer yayını önlemek için otomatik retry durdurulur
        UPDATE public.social_publish_queue
        SET status = 'reconciliation_required',
            locked_until = NULL,
            error_message = p_error_message,
            platform_response = p_platform_response,
            updated_at = NOW()
        WHERE id = p_task_id AND worker_id = p_worker_id;

    ELSE -- 'failed'
        IF v_retries < v_max_retries THEN
            -- Üstel geri çekilme (5 dk, 10 dk, 15 dk...)
            UPDATE public.social_publish_queue
            SET status = 'pending',
                scheduled_for = NOW() + (p_backoff_minutes * v_retries || ' minutes')::INTERVAL,
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

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

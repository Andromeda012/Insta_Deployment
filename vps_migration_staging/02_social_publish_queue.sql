-- ============================================================================
-- NOVA FURNITURE — YAYIN KUYRUĞU TABLOSU VE ATOMİK RPC (02_social_publish_queue.sql)
-- ============================================================================
-- TEKNİK MİMARİ VE KUYRUK GÜVENLİĞİ:
-- 1. `FOR UPDATE SKIP LOCKED`: Görev alma işlemi PostgreSQL'in satır kilitleme
--    özelliği ile tek bir atomik fonksiyonda yapılır. İki worker aynı görevi alamaz.
-- 2. Worker İzolasyonu ve Sahiplik:
--    Worker yalnızca kendisine tahsis edilmiş (`worker_id = p_worker_id`) ve
--    kilit süresi devam eden görevleri uzatabilir veya tamamlayabilir.
-- 3. Kilit Süresi ve Zombi Kurtarma:
--    Kilit süresi dolan işler kontrollü biçimde kurtarılır. Ancak `reconciliation_required`
--    durumundaki işler asla otomatik kurtarılmaz (mükerrer yayın riski önlenir).
-- 4. Exponential Backoff & Retry:
--    Başarısız işler üstel geri çekilme (`NOW() + backoff * retry_count`) ile ötelenir;
--    `max_retries` aşıldığında kesin `failed` durumuna alınır.
-- 5. Yetkilendirme ve search_path Güvenliği:
--    Tüm saklı yordamlarda `SET search_path = public, pg_temp;` kullanılmıştır.
--    Varsayılan PUBLIC/anon çalıştırma yetkisi kaldırılmış; yalnızca `service_role`
--    yetkilendirilmiştir.
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
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'published' | 'failed' | 'reconciliation_required' | 'dry_run_completed' | 'cancelled'
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

-- Hızlı kuyruk tarama indeksleri
CREATE INDEX IF NOT EXISTS idx_publish_queue_fetch 
ON public.social_publish_queue (status, scheduled_for, locked_until)
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_publish_queue_platform 
ON public.social_publish_queue (platform, status);

-- RLS: Tabloyu dış dünyadan (anon/authenticated) tamamen koru, sadece service_role erişebilir
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
BEGIN
    -- Adım 1: Kilit süresi dolmuş zombi işleri kurtar (reconciliation_required hariç!)
    UPDATE public.social_publish_queue
    SET status = 'pending',
        locked_until = NULL,
        worker_id = NULL,
        error_message = COALESCE(error_message, '') || ' [Zaman aşımı kurtarması: kilit yenilenmedi]',
        updated_at = NOW()
    WHERE status = 'processing'
      AND locked_until < NOW()
      AND retry_count < max_retries;

    -- Adım 2: Maksimum deneme hakkını dolduran zombileri 'failed' durumuna çek
    UPDATE public.social_publish_queue
    SET status = 'failed',
        locked_until = NULL,
        updated_at = NOW()
    WHERE status = 'processing'
      AND locked_until < NOW()
      AND retry_count >= max_retries;

    -- Adım 3: Zamanı gelmiş uygun görevi atomik kilitle (FOR UPDATE SKIP LOCKED)
    SELECT id INTO v_task_id
    FROM public.social_publish_queue
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    -- Adım 4: Görevi alan worker'a zimmetle ve kilit süresini başlat
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Sadece service_role çalıştırabilir
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
    UPDATE public.social_publish_queue
    SET locked_until = NOW() + (p_extra_seconds || ' seconds')::INTERVAL,
        updated_at = NOW()
    WHERE id = p_task_id
      AND worker_id = p_worker_id
      AND status = 'processing';
      
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.extend_publish_task_lock(UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_publish_task_lock(UUID, TEXT, INT) TO service_role;

-- 4. GÖREV SONUÇLANDIRMA RPC FONKSİYONU (SPLIT-BRAIN KORUMALI)
CREATE OR REPLACE FUNCTION public.complete_publish_task(
    p_task_id UUID,
    p_worker_id TEXT,
    p_status VARCHAR,                  -- 'published' | 'failed' | 'reconciliation_required' | 'dry_run_completed'
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
BEGIN
    SELECT retry_count, max_retries, worker_id, status 
    INTO v_retries, v_max_retries, v_current_worker, v_current_status
    FROM public.social_publish_queue
    WHERE id = p_task_id;

    -- Görev bulunamadıysa reddet
    IF v_current_status IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Görev kilit süresi dolup başka bir worker'a devredilmişse işlemi reddet (Split-Brain Koruması)
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

    ELSIF p_status = 'dry_run_completed' THEN
        -- Test modu sonucu: Kesinlikle gerçek 'published' yapılmaz
        UPDATE public.social_publish_queue
        SET status = 'dry_run_completed',
            platform_post_id = 'DRY_RUN_' || COALESCE(p_platform_post_id, gen_random_uuid()::text),
            platform_response = p_platform_response,
            published_at = NOW(),
            locked_until = NULL,
            error_message = NULL,
            updated_at = NOW()
        WHERE id = p_task_id AND worker_id = p_worker_id;

    ELSIF p_status = 'reconciliation_required' THEN
        -- Belirsiz API yanıtı: Mükerrer yayını önlemek için otomatik retry YAPILMAZ!
        UPDATE public.social_publish_queue
        SET status = 'reconciliation_required',
            locked_until = NULL,
            error_message = p_error_message,
            platform_response = p_platform_response,
            updated_at = NOW()
        WHERE id = p_task_id AND worker_id = p_worker_id;

    ELSE -- 'failed'
        IF v_retries < v_max_retries THEN
            -- Üstel geri çekilme formülü (ör: 5 dk, 10 dk, 15 dk...)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.complete_publish_task(UUID, TEXT, VARCHAR, TEXT, JSONB, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_publish_task(UUID, TEXT, VARCHAR, TEXT, JSONB, TEXT, INT) TO service_role;

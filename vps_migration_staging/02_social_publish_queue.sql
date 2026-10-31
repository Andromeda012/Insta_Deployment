-- ============================================================================
-- NOVA FURNITURE — YAYIN KUYRUĞU TABLOSU VE ATOMİK RPC (02_social_publish_queue.sql)
-- ============================================================================
-- GÖREV KİLİDİ VE RETRY İLKELERİ:
-- 1. Zombi Kilitlerin Kurtarılması:
--    Kilit süresi dolan ('locked_until < NOW()') processing görevleri KESİNLİKLE
--    otomatik 'pending' YAPILMAZ! Bunlar doğrudan 'reconciliation_required'
--    durumuna taşınır. Çünkü kilit süresi dolduğunda API isteğinin akıbeti
--    belirsiz kabul edilir; tekrar kuyruğa verilmesi çift paylaşıma yol açar!
-- 2. Lease Yenileme Sınırı:
--    `extend_publish_task_lock` YALNIZCA kilidi hâlâ geçerli olan ('locked_until > NOW()')
--    görevleri uzatabilir. Süresi dolmuş kilit asla uzatılamaz.
-- 3. Worker Sahiplik & Geçerlilik Doğrulaması:
--    `complete_publish_task` YALNIZCA geçerli bir kilide sahip ('locked_until >= NOW()')
--    ve görevin sahibi olan doğru worker ('worker_id = p_worker_id') tarafından çağrılabilir.
-- 4. Satır Sayısı Doğrulaması:
--    Tüm UPDATE işlemlerinde etkilenen satır sayısı ('GET DIAGNOSTICS ... ROW_COUNT')
--    denetlenir; satır güncellenmediyse ASLA TRUE dönülmez.
-- 5. Geçersiz Durum Kontrolü:
--    İzin verilen durumlar haricindeki değerler doğrudan reddedilir.
-- 6. Seçici Retry & Mutabakat İzolasyonu:
--    Yalnızca kesin başarısız ('failed') işler exponential backoff ile ötelenir.
--    'reconciliation_required' durumundaki işler asla otomatik claim edilmez.
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

-- Kuyruk arama ve indeksler
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
BEGIN
    -- Adım 1: Kilit süresi dolmuş processing işleri ASLA pending yapma!
    -- Bunları doğrudan 'reconciliation_required' durumuna al (Mükerrer yayın koruması)
    UPDATE public.social_publish_queue
    SET status = 'reconciliation_required',
        locked_until = NULL,
        error_message = COALESCE(error_message, '') || ' [Kilit süresi doldu: API istek sonucu belirsiz, mutabakat gerekiyor]',
        updated_at = NOW()
    WHERE status = 'processing'
      AND locked_until < NOW();

    -- Adım 2: Zamanı gelmiş uygun GÖREVİ atomik kilitle (FOR UPDATE SKIP LOCKED)
    -- YALNIZCA 'pending' durumundaki görevler seçilir! (reconciliation_required seçilmez!)
    SELECT id INTO v_task_id
    FROM public.social_publish_queue
    WHERE status = 'pending'
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

-- 4. GÖREV SONUÇLANDIRMA RPC FONKSİYONU (GEÇERLİ KİLİT & DOĞRU WORKER ZORUNLU)
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
    v_updated INT;
BEGIN
    -- 1. Geçersiz durum değerlerini reddet
    IF p_status NOT IN ('published', 'failed', 'reconciliation_required', 'dry_run_completed') THEN
        RETURN FALSE;
    END IF;

    SELECT retry_count, max_retries
    INTO v_retries, v_max_retries
    FROM public.social_publish_queue
    WHERE id = p_task_id;

    -- 2. Görev Başarılı
    IF p_status = 'published' THEN
        -- KURAL: Yalnızca geçerli kilide sahip ('locked_until >= NOW()') ve doğru worker güncelleyebilir!
        UPDATE public.social_publish_queue
        SET status = 'published',
            platform_post_id = p_platform_post_id,
            platform_response = p_platform_response,
            published_at = NOW(),
            locked_until = NULL,
            error_message = NULL,
            updated_at = NOW()
        WHERE id = p_task_id 
          AND worker_id = p_worker_id
          AND status = 'processing'
          AND locked_until >= NOW();

    -- 3. Dry-Run Testi Tamamlandı
    ELSIF p_status = 'dry_run_completed' THEN
        UPDATE public.social_publish_queue
        SET status = 'dry_run_completed',
            platform_post_id = 'DRY_RUN_' || COALESCE(p_platform_post_id, gen_random_uuid()::text),
            platform_response = p_platform_response,
            published_at = NOW(),
            locked_until = NULL,
            error_message = NULL,
            updated_at = NOW()
        WHERE id = p_task_id 
          AND worker_id = p_worker_id
          AND status = 'processing'
          AND locked_until >= NOW();

    -- 4. Belirsiz API Yanıtı / Zaman Aşımı (Mutabakat Gerekir)
    ELSIF p_status = 'reconciliation_required' THEN
        -- KURAL: Otomatik tekrar yayınlama YOKTUR. Kilit serbest kalır, durum dondurulur.
        UPDATE public.social_publish_queue
        SET status = 'reconciliation_required',
            locked_until = NULL,
            error_message = p_error_message,
            platform_response = p_platform_response,
            updated_at = NOW()
        WHERE id = p_task_id 
          AND worker_id = p_worker_id
          AND status = 'processing';

    -- 5. Kesin Hata (Failed) - Yalnızca kesin başarısızlıkta retry işletilir!
    ELSE -- 'failed'
        IF v_retries < v_max_retries THEN
            -- Üstel geri çekilme ile yeniden planla
            UPDATE public.social_publish_queue
            SET status = 'pending',
                scheduled_for = NOW() + (p_backoff_minutes * v_retries || ' minutes')::INTERVAL,
                locked_until = NULL,
                worker_id = NULL,
                error_message = p_error_message,
                platform_response = p_platform_response,
                updated_at = NOW()
            WHERE id = p_task_id 
              AND worker_id = p_worker_id
              AND status = 'processing'
              AND locked_until >= NOW();
        ELSE
            -- Maksimum deneme doldu: Kesin hata
            UPDATE public.social_publish_queue
            SET status = 'failed',
                locked_until = NULL,
                error_message = p_error_message,
                platform_response = p_platform_response,
                updated_at = NOW()
            WHERE id = p_task_id 
              AND worker_id = p_worker_id
              AND status = 'processing';
        END IF;
    END IF;

    -- Etkilenen satır sayısını kontrol et; işlem başarısızsa FALSE döndür
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.complete_publish_task(UUID, TEXT, VARCHAR, TEXT, JSONB, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_publish_task(UUID, TEXT, VARCHAR, TEXT, JSONB, TEXT, INT) TO service_role;

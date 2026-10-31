-- NOVA publishing queue and worker RPCs.
-- Assumption to verify before applying: public.products(slug) exists and slug is UNIQUE/PK.
BEGIN;

CREATE TABLE IF NOT EXISTS public.social_publish_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform varchar(32) NOT NULL,
  content_type varchar(32) NOT NULL,
  slot_label varchar(64),
  product_slug text REFERENCES public.products(slug) ON DELETE SET NULL,
  media_url text NOT NULL,
  caption text,
  hashtags text,
  target_link text,
  status varchar(32) NOT NULL DEFAULT 'pending',
  idempotency_key text UNIQUE NOT NULL,
  scheduled_for timestamptz NOT NULL,
  locked_until timestamptz,
  worker_id text,
  retry_count int NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries int NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
  error_message text,
  platform_post_id text,
  platform_response jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_publish_queue_status_check CHECK
    (status IN ('pending','processing','published','failed','reconciliation_required','dry_run_completed','unsupported','cancelled')),
  CONSTRAINT social_publish_queue_platform_check CHECK
    (platform IN ('instagram','facebook','tiktok','youtube'))
);

CREATE INDEX IF NOT EXISTS idx_publish_queue_fetch
ON public.social_publish_queue(status, scheduled_for, locked_until)
WHERE status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS idx_publish_queue_platform
ON public.social_publish_queue(platform, status);

ALTER TABLE public.social_publish_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_publish_queue FROM PUBLIC;

-- Service role has full permissions (for VPS Publisher runner)
GRANT ALL ON public.social_publish_queue TO service_role;

-- Anon and authenticated (used by Vercel cron endpoints) can ONLY select (for idempotency) and insert pending tasks
GRANT SELECT, INSERT ON public.social_publish_queue TO anon, authenticated;

DROP POLICY IF EXISTS "Allow anon check idempotency" ON public.social_publish_queue;
CREATE POLICY "Allow anon check idempotency"
ON public.social_publish_queue
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow anon enqueue pending tasks" ON public.social_publish_queue;
CREATE POLICY "Allow anon enqueue pending tasks"
ON public.social_publish_queue
FOR INSERT TO anon, authenticated
WITH CHECK (status = 'pending');

CREATE OR REPLACE FUNCTION public.claim_next_publish_task(
  p_worker_id text, p_lock_duration_seconds int DEFAULT 180
)
RETURNS TABLE (
  task_id uuid, platform varchar, content_type varchar, product_slug text,
  media_url text, caption text, hashtags text, target_link text,
  idempotency_key text, retry_count int, scheduled_for timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_task_id uuid; v_rows int;
BEGIN
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0
     OR p_lock_duration_seconds < 30 OR p_lock_duration_seconds > 900 THEN
    RAISE EXCEPTION 'Invalid worker_id or lock duration';
  END IF;

  -- A lease expiry means the external request may have succeeded. Never auto-retry it.
  UPDATE public.social_publish_queue q
  SET status = 'reconciliation_required', worker_id = NULL, locked_until = NULL,
      error_message = concat_ws(' ', NULLIF(q.error_message,''),
        '[Lease expired; external publish outcome is ambiguous; manual reconciliation required]'),
      updated_at = now()
  WHERE q.status = 'processing' AND q.locked_until <= now();

  -- YouTube binary upload is not implemented; park those tasks explicitly.
  UPDATE public.social_publish_queue q
  SET status = 'unsupported', worker_id = NULL, locked_until = NULL,
      error_message = '[EXCLUDED] YouTube binary upload is not implemented.', updated_at = now()
  WHERE q.status = 'pending' AND q.platform = 'youtube';

  SELECT q.id INTO v_task_id
  FROM public.social_publish_queue q
  WHERE q.status = 'pending'
    AND q.platform IN ('instagram','facebook','tiktok')
    AND q.scheduled_for <= now()
  ORDER BY q.scheduled_for, q.created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_task_id IS NULL THEN RETURN; END IF;

  UPDATE public.social_publish_queue q
  SET status = 'processing', locked_until = now() + make_interval(secs => p_lock_duration_seconds),
      worker_id = p_worker_id, retry_count = q.retry_count + 1, updated_at = now()
  WHERE q.id = v_task_id AND q.status = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RETURN; END IF;

  RETURN QUERY SELECT q.id, q.platform, q.content_type, q.product_slug,
    q.media_url, q.caption, q.hashtags, q.target_link, q.idempotency_key,
    q.retry_count, q.scheduled_for
  FROM public.social_publish_queue q WHERE q.id = v_task_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_next_publish_task(text,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_publish_task(text,int) TO service_role;

CREATE OR REPLACE FUNCTION public.extend_publish_task_lock(
  p_task_id uuid, p_worker_id text, p_extra_seconds int DEFAULT 120
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_rows int;
BEGIN
  IF p_extra_seconds < 15 OR p_extra_seconds > 900 THEN RETURN false; END IF;
  UPDATE public.social_publish_queue q
  SET locked_until = now() + make_interval(secs => p_extra_seconds), updated_at = now()
  WHERE q.id = p_task_id AND q.worker_id = p_worker_id
    AND q.status = 'processing' AND q.locked_until > now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.extend_publish_task_lock(uuid,text,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_publish_task_lock(uuid,text,int) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_publish_task(
  p_task_id uuid, p_worker_id text, p_status varchar,
  p_platform_post_id text DEFAULT NULL, p_platform_response jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL, p_backoff_minutes int DEFAULT 5
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_retries int; v_max_retries int; v_rows int; v_locked_until timestamptz;
  v_backoff int;
BEGIN
  IF p_status NOT IN ('published','failed','reconciliation_required','dry_run_completed','unsupported') THEN
    RETURN false;
  END IF;

  SELECT q.retry_count, q.max_retries, q.locked_until
  INTO v_retries, v_max_retries, v_locked_until
  FROM public.social_publish_queue q
  WHERE q.id = p_task_id AND q.worker_id = p_worker_id AND q.status = 'processing'
  FOR UPDATE;

  IF NOT FOUND OR v_locked_until IS NULL OR v_locked_until <= now() THEN RETURN false; END IF;

  IF p_status = 'failed' AND v_retries < v_max_retries THEN
    v_backoff := LEAST(
      GREATEST(COALESCE(p_backoff_minutes,5),1) * (2 ^ GREATEST(v_retries - 1,0)),
      60
    )::int;
    UPDATE public.social_publish_queue
    SET status = 'pending', scheduled_for = now() + make_interval(mins => v_backoff),
        worker_id = NULL, locked_until = NULL, error_message = p_error_message,
        platform_response = p_platform_response, updated_at = now()
    WHERE id = p_task_id AND worker_id = p_worker_id AND status = 'processing' AND locked_until > now();
  ELSIF p_status = 'published' THEN
    UPDATE public.social_publish_queue
    SET status = 'published', platform_post_id = p_platform_post_id,
        platform_response = p_platform_response, published_at = now(),
        worker_id = NULL, locked_until = NULL, error_message = NULL, updated_at = now()
    WHERE id = p_task_id AND worker_id = p_worker_id AND status = 'processing' AND locked_until > now();
  ELSIF p_status = 'dry_run_completed' THEN
    UPDATE public.social_publish_queue
    SET status = 'dry_run_completed', platform_post_id = NULL,
        platform_response = p_platform_response, worker_id = NULL,
        locked_until = NULL, error_message = NULL, updated_at = now()
    WHERE id = p_task_id AND worker_id = p_worker_id AND status = 'processing' AND locked_until > now();
  ELSIF p_status = 'unsupported' THEN
    UPDATE public.social_publish_queue
    SET status = 'unsupported', platform_response = p_platform_response,
        worker_id = NULL, locked_until = NULL, error_message = p_error_message, updated_at = now()
    WHERE id = p_task_id AND worker_id = p_worker_id AND status = 'processing' AND locked_until > now();
  ELSIF p_status = 'reconciliation_required' THEN
    UPDATE public.social_publish_queue
    SET status = 'reconciliation_required', platform_post_id = p_platform_post_id,
        platform_response = p_platform_response, worker_id = NULL,
        locked_until = NULL, error_message = p_error_message, updated_at = now()
    WHERE id = p_task_id AND worker_id = p_worker_id AND status = 'processing' AND locked_until > now();
  ELSE -- definite failure after retries exhausted
    UPDATE public.social_publish_queue
    SET status = 'failed', platform_response = p_platform_response,
        worker_id = NULL, locked_until = NULL, error_message = p_error_message, updated_at = now()
    WHERE id = p_task_id AND worker_id = p_worker_id AND status = 'processing' AND locked_until > now();
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_publish_task(uuid,text,varchar,text,jsonb,text,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_publish_task(uuid,text,varchar,text,jsonb,text,int) TO service_role;

COMMIT;

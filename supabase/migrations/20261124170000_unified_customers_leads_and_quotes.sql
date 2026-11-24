-- ============================================================================
-- GLOBAL MOBİLYA — ORTAK OMNICHANNEL CRM, LAZY REGISTER & CLERK HESAP SAHİPLENME
-- Migration: 20261124170000_unified_customers_leads_and_quotes.sql
-- Kapsam:
--   1. public.customers (web + sosyal medya tüm kanallar için telefon bazlı birleşik müşteri)
--   2. public.leads_and_quotes (web, whatsapp, instagram, facebook, tiktok_youtube talepleri)
--   3. public.clerk_app_role() & public.normalize_tr_phone() yardımcı fonksiyonları
--   4. public.claim_customer_by_clerk() otomatik hesap sahiplenme (Account Claiming) RPC'si
--   5. Katı RLS (Row Level Security): customer sadece kendi talebini, staff/admin tümünü görür
-- ============================================================================

-- 1. Yardımcı Fonksiyonlar
CREATE OR REPLACE FUNCTION public.normalize_tr_phone(raw_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT;
BEGIN
  IF raw_phone IS NULL THEN
    RETURN NULL;
  END IF;
  digits := regexp_replace(trim(raw_phone), '\D', '', 'g');
  IF digits = '' THEN
    RETURN NULL;
  END IF;

  IF digits LIKE '00%' THEN
    digits := substr(digits, 3);
  END IF;

  -- Türkiye GSM/Sabit standartlaştırma -> +905XXXXXXXXX
  IF length(digits) = 10 AND digits LIKE '5%' THEN
    digits := '90' || digits;
  ELSIF length(digits) = 11 AND digits LIKE '05%' THEN
    digits := '9' || digits;
  ELSIF length(digits) = 11 AND digits LIKE '0%' THEN
    digits := '90' || substr(digits, 2);
  ELSIF length(digits) = 10 THEN
    digits := '90' || digits;
  END IF;

  RETURN '+' || digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.clerk_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(lower(current_setting('request.jwt.claims', true)::jsonb -> 'public_metadata' ->> 'role'), ''),
    NULLIF(lower(current_setting('request.jwt.claims', true)::jsonb -> 'metadata' ->> 'role'), ''),
    NULLIF(lower(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'), ''),
    CASE
      WHEN COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'org_role', '') IN ('org:admin', 'admin') THEN 'admin'
      WHEN COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '') <> ''
        OR COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'o' ->> 'id', '') <> '' THEN 'staff'
      ELSE 'customer'
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Ortak Müşteriler Tablosu (`customers`)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  city TEXT,
  instagram_handle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_clerk_user_id ON public.customers(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON public.customers(lower(email));
CREATE INDEX IF NOT EXISTS idx_customers_instagram_handle ON public.customers(lower(instagram_handle));
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at DESC);

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at_column();

-- 3. Ortak Talepler & Teklifler Tablosu (`leads_and_quotes`)
CREATE TABLE IF NOT EXISTS public.leads_and_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT UNIQUE NOT NULL DEFAULT (
    'GM-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 9000 + 1000))::text, 4, '0')
  ),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'whatsapp', 'instagram', 'facebook', 'tiktok_youtube')),
  collection_name TEXT NOT NULL DEFAULT '',
  product_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'yeni_talep'
    CHECK (status IN ('yeni_talep', 'inceleniyor', 'fiyat_verildi', 'onaylandi', 'iptal')),
  quoted_price NUMERIC(12, 2),
  staff_note TEXT,
  ai_summary TEXT,
  assigned_staff_id TEXT,
  erp_order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON public.leads_and_quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads_and_quotes(source);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads_and_quotes(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_staff ON public.leads_and_quotes(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads_and_quotes(created_at DESC);

DROP TRIGGER IF EXISTS trg_leads_and_quotes_updated_at ON public.leads_and_quotes;
CREATE TRIGGER trg_leads_and_quotes_updated_at
  BEFORE UPDATE ON public.leads_and_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at_column();

-- 4. Clerk Girişi Sonrası Otomatik Hesap Sahiplenme (Account Claiming) Fonksiyonu
-- Üyeliksiz teklif bırakmış veya sosyal medyadan (IG/WP/FB) eklenmiş customer satırını
-- Clerk user ID ile atomik olarak bağlar ve eski tüm talepleri müşteri hesabına devreder.
CREATE OR REPLACE FUNCTION public.claim_customer_by_clerk(
  p_clerk_user_id TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  customer_id UUID,
  claimed_now BOOLEAN,
  linked_leads_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_phone TEXT;
  v_clean_email TEXT;
  v_existing public.customers%ROWTYPE;
  v_by_phone public.customers%ROWTYPE;
  v_by_email public.customers%ROWTYPE;
  v_target_id UUID;
  v_claimed BOOLEAN := false;
BEGIN
  IF p_clerk_user_id IS NULL OR trim(p_clerk_user_id) = '' THEN
    RAISE EXCEPTION 'p_clerk_user_id zorunludur';
  END IF;

  v_norm_phone := public.normalize_tr_phone(p_phone);
  v_clean_email := NULLIF(lower(trim(COALESCE(p_email, ''))), '');

  -- A) Halihazırda Clerk ID ile bağlı kayıt var mı?
  SELECT * INTO v_existing FROM public.customers WHERE clerk_user_id = p_clerk_user_id LIMIT 1;

  -- B) Eşleşen telefon numarasıyla unclaimed veya mevcut kayıt ara
  IF v_norm_phone IS NOT NULL THEN
    SELECT * INTO v_by_phone FROM public.customers WHERE phone = v_norm_phone LIMIT 1;
  END IF;

  -- C) Telefon yoksa veya eşleşmediyse e-posta ile unclaimed kayıt ara
  IF v_by_phone.id IS NULL AND v_clean_email IS NOT NULL THEN
    SELECT * INTO v_by_email
    FROM public.customers
    WHERE lower(email) = v_clean_email
    ORDER BY (clerk_user_id IS NULL) DESC, created_at ASC
    LIMIT 1;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    v_target_id := v_existing.id;

    -- Kullanıcı önce Clerk açıp sonra aynı telefonlu eski misafir kaydını eşleştiriyorsa talepleri devret
    IF v_by_phone.id IS NOT NULL AND v_by_phone.id <> v_existing.id AND v_by_phone.clerk_user_id IS NULL THEN
      UPDATE public.leads_and_quotes SET customer_id = v_existing.id WHERE customer_id = v_by_phone.id;
      DELETE FROM public.customers WHERE id = v_by_phone.id;
      v_claimed := true;
    END IF;

    UPDATE public.customers
    SET
      full_name = COALESCE(NULLIF(trim(full_name), ''), p_full_name, full_name),
      email = COALESCE(NULLIF(trim(email), ''), v_clean_email, email),
      updated_at = now()
    WHERE id = v_existing.id;
  ELSIF v_by_phone.id IS NOT NULL AND v_by_phone.clerk_user_id IS NULL THEN
    UPDATE public.customers
    SET
      clerk_user_id = p_clerk_user_id,
      email = COALESCE(email, v_clean_email),
      full_name = COALESCE(NULLIF(trim(full_name), ''), p_full_name, full_name),
      updated_at = now()
    WHERE id = v_by_phone.id
    RETURNING id INTO v_target_id;
    v_claimed := true;
  ELSIF v_by_email.id IS NOT NULL AND v_by_email.clerk_user_id IS NULL THEN
    UPDATE public.customers
    SET
      clerk_user_id = p_clerk_user_id,
      phone = COALESCE(NULLIF(trim(phone), ''), v_norm_phone, phone),
      full_name = COALESCE(NULLIF(trim(full_name), ''), p_full_name, full_name),
      updated_at = now()
    WHERE id = v_by_email.id
    RETURNING id INTO v_target_id;
    v_claimed := true;
  ELSE
    -- Tamamen yeni Clerk müşterisi
    IF v_norm_phone IS NOT NULL OR v_clean_email IS NOT NULL THEN
      INSERT INTO public.customers (clerk_user_id, full_name, phone, email)
      VALUES (
        p_clerk_user_id,
        COALESCE(NULLIF(trim(COALESCE(p_full_name, '')), ''), 'Web Müşterisi'),
        COALESCE(v_norm_phone, 'clerk:' || p_clerk_user_id),
        v_clean_email
      )
      ON CONFLICT (phone) DO UPDATE SET
        clerk_user_id = COALESCE(public.customers.clerk_user_id, EXCLUDED.clerk_user_id),
        email = COALESCE(public.customers.email, EXCLUDED.email),
        updated_at = now()
      RETURNING id INTO v_target_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_target_id,
    v_claimed,
    COALESCE((SELECT count(*) FROM public.leads_and_quotes WHERE customer_id = v_target_id), 0::BIGINT);
END;
$$;

-- 5. RLS (Row Level Security) Politikaları
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_and_quotes ENABLE ROW LEVEL SECURITY;

-- CUSTOMERS POLICIES
DROP POLICY IF EXISTS "customers_service_role_all" ON public.customers;
CREATE POLICY "customers_service_role_all" ON public.customers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "customers_staff_admin_all" ON public.customers;
CREATE POLICY "customers_staff_admin_all" ON public.customers
  FOR ALL
  USING (
    public.clerk_app_role() IN ('admin', 'staff')
    OR public.clerk_department() IN ('admin', 'sales', 'factory', 'social_media')
    OR public.clerk_org_id() <> ''
  )
  WITH CHECK (
    public.clerk_app_role() IN ('admin', 'staff')
    OR public.clerk_department() IN ('admin', 'sales', 'factory', 'social_media')
    OR public.clerk_org_id() <> ''
  );

DROP POLICY IF EXISTS "customers_self_select" ON public.customers;
CREATE POLICY "customers_self_select" ON public.customers
  FOR SELECT
  USING (
    public.clerk_user_id() <> ''
    AND clerk_user_id = public.clerk_user_id()
  );

DROP POLICY IF EXISTS "customers_self_update" ON public.customers;
CREATE POLICY "customers_self_update" ON public.customers
  FOR UPDATE
  USING (
    public.clerk_user_id() <> ''
    AND clerk_user_id = public.clerk_user_id()
  )
  WITH CHECK (
    public.clerk_user_id() <> ''
    AND clerk_user_id = public.clerk_user_id()
  );

-- LEADS_AND_QUOTES POLICIES
DROP POLICY IF EXISTS "leads_service_role_all" ON public.leads_and_quotes;
CREATE POLICY "leads_service_role_all" ON public.leads_and_quotes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "leads_staff_admin_all" ON public.leads_and_quotes;
CREATE POLICY "leads_staff_admin_all" ON public.leads_and_quotes
  FOR ALL
  USING (
    public.clerk_app_role() IN ('admin', 'staff')
    OR public.clerk_department() IN ('admin', 'sales', 'factory', 'social_media')
    OR public.clerk_org_id() <> ''
  )
  WITH CHECK (
    public.clerk_app_role() IN ('admin', 'staff')
    OR public.clerk_department() IN ('admin', 'sales', 'factory', 'social_media')
    OR public.clerk_org_id() <> ''
  );

DROP POLICY IF EXISTS "leads_customer_self_select" ON public.leads_and_quotes;
CREATE POLICY "leads_customer_self_select" ON public.leads_and_quotes
  FOR SELECT
  USING (
    public.clerk_user_id() <> ''
    AND EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = leads_and_quotes.customer_id
        AND c.clerk_user_id = public.clerk_user_id()
    )
  );

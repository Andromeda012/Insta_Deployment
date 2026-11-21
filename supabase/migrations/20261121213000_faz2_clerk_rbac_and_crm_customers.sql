-- ============================================================================
-- GLOBAL KAPAK MOBİLYA — FAZ 2: CLERK AUTH, RBAC DEPARTMANLAR VE CRM MÜŞTERİLER
-- Migration: 20261121213000_faz2_clerk_rbac_and_crm_customers.sql
-- ============================================================================

-- 1. Clerk JWT Yardımcı Fonksiyonları (Supabase RLS Entegrasyonu)
CREATE OR REPLACE FUNCTION public.clerk_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.clerk_org_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'org_id',
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'o' ->> 'id',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.clerk_department()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'metadata' ->> 'department',
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'public_metadata' ->> 'department',
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'department',
    CASE
      WHEN (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'org_role') = 'org:admin' THEN 'admin'
      WHEN (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'o' ->> 'rol') = 'admin' THEN 'admin'
      ELSE ''
    END
  );
$$;

-- 2. Şirket İçi ERP Personel & Departman Tablosu (erp_users)
CREATE TABLE IF NOT EXISTS public.erp_users (
  clerk_user_id TEXT PRIMARY KEY,
  email TEXT,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  org_id TEXT,
  org_slug TEXT,
  org_role TEXT DEFAULT 'org:member',
  department TEXT DEFAULT 'viewer' CHECK (department IN ('admin', 'factory', 'sales', 'social_media', 'viewer')),
  public_metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_users_org_id ON public.erp_users(org_id);
CREATE INDEX IF NOT EXISTS idx_erp_users_department ON public.erp_users(department);

-- 3. B2C Vitrin Müşterileri & Teklif / Lazy Registration Tablosu (crm_customers)
CREATE TABLE IF NOT EXISTS public.crm_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE,
  email TEXT,
  full_name TEXT NOT NULL DEFAULT 'Müşteri',
  phone TEXT,
  city TEXT,
  interested_model TEXT,
  latest_quote_ref TEXT,
  notes TEXT,
  source TEXT DEFAULT 'b2c_lazy_quote',
  stage TEXT DEFAULT 'Yeni Teklif Talebi',
  assigned_department TEXT DEFAULT 'sales',
  metadata JSONB DEFAULT '{}'::jsonb,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_clerk_id ON public.crm_customers(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_email ON public.crm_customers(email);
CREATE INDEX IF NOT EXISTS idx_crm_customers_created_at ON public.crm_customers(created_at DESC);

-- 4. B2C Teklif Talepleri Tablosu (quote_requests)
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT UNIQUE NOT NULL,
  clerk_user_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_city TEXT,
  collection_id TEXT,
  selected_pieces JSONB DEFAULT '[]'::jsonb,
  custom_dimensions_note TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. RLS Politikaları
ALTER TABLE public.erp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_users_read_org" ON public.erp_users;
CREATE POLICY "erp_users_read_org" ON public.erp_users
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR public.clerk_org_id() <> ''
  );

DROP POLICY IF EXISTS "crm_customers_public_lazy_insert" ON public.crm_customers;
CREATE POLICY "crm_customers_public_lazy_insert" ON public.crm_customers
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "crm_customers_public_lazy_update" ON public.crm_customers;
CREATE POLICY "crm_customers_public_lazy_update" ON public.crm_customers
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR clerk_user_id = public.clerk_user_id()
    OR public.clerk_department() IN ('admin', 'sales')
  );

DROP POLICY IF EXISTS "crm_customers_select_sales_or_self" ON public.crm_customers;
CREATE POLICY "crm_customers_select_sales_or_self" ON public.crm_customers
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR true
  );

DROP POLICY IF EXISTS "quote_requests_public_insert" ON public.quote_requests;
CREATE POLICY "quote_requests_public_insert" ON public.quote_requests
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "quote_requests_select_all" ON public.quote_requests;
CREATE POLICY "quote_requests_select_all" ON public.quote_requests
  FOR SELECT
  USING (true);

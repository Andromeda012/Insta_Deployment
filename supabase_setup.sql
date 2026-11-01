-- ============================================================================
-- GLOBAL KAPAK MOBİLYA — SUPABASE DATABASE & STORAGE KURULUM BETİĞİ (SQL)
-- Bu kodu Supabase Dashboard -> SQL Editor ekranına yapıştırıp "Run" tuşuna basın.
-- ============================================================================

-- 1. ÜRÜNLER TABLOSU (products)
CREATE TABLE IF NOT EXISTS public.products (
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS web_gorunur BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS web_siralama INTEGER NOT NULL DEFAULT 0;
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    kategori TEXT DEFAULT 'Düz Membran Kapak',
    sku TEXT,
    kisa_aciklama TEXT DEFAULT '',
    body TEXT DEFAULT '',
    ana_resim TEXT DEFAULT '/resim/logo.png',
    anasayfada_goster BOOLEAN DEFAULT true,
    populer BOOLEAN DEFAULT false,
    yeni BOOLEAN DEFAULT false,
    renkler JSONB DEFAULT '[]'::jsonb,
    ozellikler JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ek kolon güvencesi
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS olculer TEXT DEFAULT '';

-- 2. TEDARİKÇİLER TABLOSU (suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
    slug TEXT PRIMARY KEY,
    ad TEXT NOT NULL,
    kategori TEXT DEFAULT 'Membran & Folyo',
    aciklama TEXT DEFAULT '',
    link TEXT,
    logo TEXT DEFAULT '/resim/logo.png',
    siralama INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. GALERİ TABLOSU (gallery)
CREATE TABLE IF NOT EXISTS public.gallery (
    slug TEXT PRIMARY KEY,
    baslik TEXT NOT NULL,
    kategori TEXT DEFAULT 'Mutfak',
    resim TEXT NOT NULL,
    anasayfada_goster BOOLEAN DEFAULT true,
    siralama BIGINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. BLOG / MAKALELER TABLOSU (blogs)
CREATE TABLE IF NOT EXISTS public.blogs (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    kategori TEXT DEFAULT 'Rehber & Bakım',
    tarih TIMESTAMPTZ DEFAULT now(),
    kapak_resim TEXT DEFAULT '/resim/logo.png',
    ozet TEXT DEFAULT '',
    body TEXT DEFAULT '',
    anasayfada_goster BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. SİTE & VİTRİN AYARLARI TABLOSU (site_settings)
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & PUBLIC ERİŞİM POLİTİKALARI
-- ============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Module 7 remains the canonical product master and retains its current write workflow.
DROP POLICY IF EXISTS "Public full access on products" ON public.products;
CREATE POLICY "Public full access on products" ON public.products FOR ALL TO public USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO public;

-- Module 1 blog/gallery/supplier content is read-only from browser roles.
DROP POLICY IF EXISTS "Public full access on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Public full access on gallery" ON public.gallery;
DROP POLICY IF EXISTS "Public full access on blogs" ON public.blogs;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.suppliers FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.gallery FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.blogs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.suppliers, public.gallery, public.blogs TO anon, authenticated;

DROP POLICY IF EXISTS "Module 1 public read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Public read suppliers" ON public.suppliers;
CREATE POLICY "Public read suppliers" ON public.suppliers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Module 1 public read gallery" ON public.gallery;
DROP POLICY IF EXISTS "Public read gallery" ON public.gallery;
CREATE POLICY "Public read gallery" ON public.gallery FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Module 1 public read blogs" ON public.blogs;
DROP POLICY IF EXISTS "Public read blogs" ON public.blogs;
CREATE POLICY "Public read blogs" ON public.blogs FOR SELECT TO anon, authenticated USING (true);

-- Module 2/7 retain writes to their own site_settings keys. Module 1 live keys are protected.
DROP POLICY IF EXISTS "Public full access on site_settings" ON public.site_settings;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO public;
DROP POLICY IF EXISTS "Module 1 public read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public read safe site_settings only" ON public.site_settings;
CREATE POLICY "Public read safe site_settings only" ON public.site_settings
FOR SELECT TO anon, authenticated
USING (key IN (
  'company_info','contact_info','hero_banner','theme_settings',
  'product_transform_settings','social_campaign_assets','instagram_published_tracker',
  'genel','anasayfa'
));

DROP POLICY IF EXISTS "Legacy non-Module-1 settings writes" ON public.site_settings;
DROP POLICY IF EXISTS "Legacy non-Module-1 settings insert" ON public.site_settings;
DROP POLICY IF EXISTS "Legacy non-Module-1 settings update" ON public.site_settings;
DROP POLICY IF EXISTS "Legacy non-Module-1 settings delete" ON public.site_settings;
CREATE POLICY "Legacy non-Module-1 settings insert" ON public.site_settings
FOR INSERT TO public WITH CHECK (key NOT IN ('genel','anasayfa'));
CREATE POLICY "Legacy non-Module-1 settings update" ON public.site_settings
FOR UPDATE TO public USING (key NOT IN ('genel','anasayfa'))
WITH CHECK (key NOT IN ('genel','anasayfa'));
CREATE POLICY "Legacy non-Module-1 settings delete" ON public.site_settings
FOR DELETE TO public USING (key NOT IN ('genel','anasayfa'));

-- Shared media storage remains compatible with Module 2 and Module 7 for now.
-- ============================================================================
-- SUPABASE STORAGE BUCKET (media) — FOTOĞRAF VE VİDEO DEPOLAMA ALANI
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read access on media bucket" ON storage.objects;
CREATE POLICY "Public read access on media bucket"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Public insert access on media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public update access on media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access on media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Legacy public media uploads outside Module 1" ON storage.objects;
DROP POLICY IF EXISTS "Legacy public media updates outside Module 1" ON storage.objects;
DROP POLICY IF EXISTS "Legacy public media deletes outside Module 1" ON storage.objects;
DROP POLICY IF EXISTS "Module 1 managers upload protected media" ON storage.objects;
DROP POLICY IF EXISTS "Module 1 managers update protected media" ON storage.objects;
DROP POLICY IF EXISTS "Module 1 managers delete protected media" ON storage.objects;

CREATE POLICY "Legacy public media uploads outside Module 1" ON storage.objects
FOR INSERT TO public WITH CHECK (
  bucket_id = 'media'
  AND COALESCE((storage.foldername(name))[1], '') NOT IN ('urunler','anasayfa','galeri','blog','tedarikciler')
);
CREATE POLICY "Legacy public media updates outside Module 1" ON storage.objects
FOR UPDATE TO public
USING (bucket_id = 'media' AND COALESCE((storage.foldername(name))[1], '') NOT IN ('urunler','anasayfa','galeri','blog','tedarikciler'))
WITH CHECK (bucket_id = 'media' AND COALESCE((storage.foldername(name))[1], '') NOT IN ('urunler','anasayfa','galeri','blog','tedarikciler'));
CREATE POLICY "Legacy public media deletes outside Module 1" ON storage.objects
FOR DELETE TO public
USING (bucket_id = 'media' AND COALESCE((storage.foldername(name))[1], '') NOT IN ('urunler','anasayfa','galeri','blog','tedarikciler'));

CREATE POLICY "Module 1 managers upload protected media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] IN ('urunler','anasayfa','galeri','blog','tedarikciler') AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','content_manager'));
CREATE POLICY "Module 1 managers update protected media" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'media' AND (storage.foldername(name))[1] IN ('urunler','anasayfa','galeri','blog','tedarikciler') AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','content_manager'))
WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] IN ('urunler','anasayfa','galeri','blog','tedarikciler') AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','content_manager'));
CREATE POLICY "Module 1 managers delete protected media" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'media' AND (storage.foldername(name))[1] IN ('urunler','anasayfa','galeri','blog','tedarikciler') AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','content_manager'));

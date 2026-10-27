-- ============================================================================
-- GLOBAL KAPAK MOBİLYA — SUPABASE DATABASE & STORAGE KURULUM BETİĞİ (SQL)
-- Bu kodu Supabase Dashboard -> SQL Editor ekranına yapıştırıp "Run" tuşuna basın.
-- ============================================================================

-- 1. ÜRÜNLER TABLOSU (products)
CREATE TABLE IF NOT EXISTS public.products (
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

DROP POLICY IF EXISTS "Public full access on products" ON public.products;
CREATE POLICY "Public full access on products" ON public.products FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on suppliers" ON public.suppliers;
CREATE POLICY "Public full access on suppliers" ON public.suppliers FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on gallery" ON public.gallery;
CREATE POLICY "Public full access on gallery" ON public.gallery FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on blogs" ON public.blogs;
CREATE POLICY "Public full access on blogs" ON public.blogs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access on site_settings" ON public.site_settings;
CREATE POLICY "Public full access on site_settings" ON public.site_settings FOR ALL TO public USING (true) WITH CHECK (true);

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
CREATE POLICY "Public insert access on media bucket"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "Public update access on media bucket" ON storage.objects;
CREATE POLICY "Public update access on media bucket"
ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Public delete access on media bucket" ON storage.objects;
CREATE POLICY "Public delete access on media bucket"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'media');

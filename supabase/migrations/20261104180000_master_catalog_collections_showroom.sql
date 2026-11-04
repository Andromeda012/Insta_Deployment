-- ============================================================================
-- GLOBAL MOBİLYA — MASTER PRODUCT CATALOG, COLLECTIONS & DIGITAL SHOWROOM
-- Migration: 20261104180000_master_catalog_collections_showroom.sql
-- ============================================================================
-- 1. collections (8 Yatak Odası Koleksiyonu ve Gelecek Bütünsel Mobilya Setleri)
-- 2. collection_products (Koleksiyon ve Parça İlişkisi - Many to Many)
-- 3. product_media (Çoklu Medya ve AI Onay Kütüphanesi)
-- 4. product_variants (Renk, Ölçü, Fiyat Görünürlüğü ve Üretim Durumu)
-- 5. marketing_profiles (AI Content Studio ve Sosyal Medya Stil Parametreleri)
-- 6. quote_requests (WhatsApp / Web Showroom Teklif Talepleri & CRM)
-- ============================================================================

-- 1. KOLEKSİYONLAR TABLOSU
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null default 'Yatak Odası',
  short_description text,
  design_story text,
  hero_image text not null,
  color_palette jsonb not null default '[]'::jsonb,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collections_slug on public.collections(slug);
create index if not exists idx_collections_visible_sort on public.collections(is_visible, sort_order);

-- 2. KOLEKSİYON - ÜRÜN İLİŞKİSİ (Parçalar hem koleksiyonda hem bağımsız)
create table if not exists public.collection_products (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_slug text not null references public.products(slug) on update cascade on delete cascade,
  role_in_collection text not null default 'part' check (role_in_collection in ('main_bed', 'wardrobe', 'nightstand', 'dresser', 'vanity', 'accent', 'part')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (collection_id, product_slug)
);

create index if not exists idx_collection_products_col on public.collection_products(collection_id);
create index if not exists idx_collection_products_prod on public.collection_products(product_slug);

-- 3. MEDYA KÜTÜPHANESİ VE AI GÖRSEL HAVUZU
create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_slug text references public.products(slug) on update cascade on delete cascade,
  collection_id uuid references public.collections(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'hero' check (media_type in ('hero', 'detail', 'isolated', 'texture', 'carousel', 'video', 'technical')),
  source_type text not null default 'original' check (source_type in ('original', 'ai_generated', 'ai_banana', 'cad_render')),
  approval_status text not null default 'approved' check (approval_status in ('draft', 'pending_review', 'approved', 'rejected')),
  aspect_ratio text default '1:1',
  sort_order integer not null default 0,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_media_prod on public.product_media(product_slug, media_type);
create index if not exists idx_product_media_col on public.product_media(collection_id);
create index if not exists idx_product_media_status on public.product_media(approval_status);

-- 4. ÜRÜN VARYANTLARI
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null references public.products(slug) on update cascade on delete cascade,
  variant_name text not null,
  sku text,
  dimensions jsonb,
  color_name text,
  material_name text,
  price numeric(12, 2) default null,
  price_visible boolean not null default false,
  production_status text default 'made_to_order' check (production_status in ('in_stock', 'made_to_order', 'discontinued')),
  lead_time_days integer default 14,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_variants_prod on public.product_variants(product_slug);

-- 5. AI PAZARLAMA VE SAHNELEME PROFİLLERİ (Modül 2 Entegrasyonu)
create table if not exists public.marketing_profiles (
  product_slug text primary key references public.products(slug) on update cascade on delete cascade,
  atmosphere text default 'Scandinavian Minimalist Luxury',
  lighting text default 'Golden hour warm sunlight with soft ambient LED',
  color_palette text default 'Cashmere greige, silk white, natural oak',
  camera_angle text default 'Straight-on front eye-level view, 8k Architectural Digest',
  room_scene text default 'Master bedroom vanity dressing nook with circular mirror',
  interior_style text default 'Venetian plaster wall with vertical oak slats',
  music_preference text default 'modern_acoustic',
  target_platforms jsonb default '["instagram", "facebook", "tiktok", "youtube"]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 6. TEKLİF TALEPLERİ VE CRM BAĞLANTISI (Sepetsiz, WhatsApp & Form)
create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique not null,
  product_slug text references public.products(slug) on update cascade on delete set null,
  collection_slug text references public.collections(slug) on update cascade on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_city text,
  request_type text not null default 'catalog_price' check (request_type in ('catalog_price', 'custom_dimension', 'project_deal', 'sample_request')),
  custom_notes text,
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  source_channel text not null default 'web_showroom' check (source_channel in ('web_showroom', 'whatsapp', 'instagram_dm', 'facebook_lead')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quote_requests_status on public.quote_requests(status, created_at desc);

-- ============================================================================
-- GÜVENLİK VE RLS POLİTİKALARI (ROW LEVEL SECURITY)
-- ============================================================================

alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
alter table public.product_media enable row level security;
alter table public.product_variants enable row level security;
alter table public.marketing_profiles enable row level security;
alter table public.quote_requests enable row level security;

-- collections: Herkes görebilir; yazma yalnızca service_role ve admin/product_manager
drop policy if exists "Public read collections" on public.collections;
create policy "Public read collections" on public.collections for select to anon, authenticated using (true);
grant select on table public.collections to anon, authenticated;
grant select, insert, update, delete on table public.collections to service_role;

-- collection_products: Herkes görebilir
drop policy if exists "Public read collection_products" on public.collection_products;
create policy "Public read collection_products" on public.collection_products for select to anon, authenticated using (true);
grant select on table public.collection_products to anon, authenticated;
grant select, insert, update, delete on table public.collection_products to service_role;

-- product_media: Herkes görebilir (onaylı olanlar veya genel vitrin)
drop policy if exists "Public read product_media" on public.product_media;
create policy "Public read product_media" on public.product_media for select to anon, authenticated using (true);
grant select on table public.product_media to anon, authenticated;
grant select, insert, update, delete on table public.product_media to service_role;

-- product_variants: Herkes görebilir
drop policy if exists "Public read product_variants" on public.product_variants;
create policy "Public read product_variants" on public.product_variants for select to anon, authenticated using (true);
grant select on table public.product_variants to anon, authenticated;
grant select, insert, update, delete on table public.product_variants to service_role;

-- marketing_profiles: Herkes okuyabilir (AI ve Katalog için)
drop policy if exists "Public read marketing_profiles" on public.marketing_profiles;
create policy "Public read marketing_profiles" on public.marketing_profiles for select to anon, authenticated using (true);
grant select on table public.marketing_profiles to anon, authenticated;
grant select, insert, update, delete on table public.marketing_profiles to service_role;

-- quote_requests: Anonim ve yetkili müşteriler yeni teklif talebi GÖNDEREBİLİR (INSERT)
drop policy if exists "Public insert quote_requests" on public.quote_requests;
create policy "Public insert quote_requests" on public.quote_requests for insert to anon, authenticated with check (true);
-- Teklifleri yalnızca yetkili yöneticiler veya service_role görebilir (Müşteri gizliliği)
grant insert on table public.quote_requests to anon, authenticated;
grant select, insert, update, delete on table public.quote_requests to service_role;

-- ============================================================================
-- PROTOTİP VERİLER: 8 YATAK ODASI KOLEKSİYONU
-- ============================================================================

insert into public.collections (slug, title, category, short_description, design_story, hero_image, color_palette, sort_order)
values
  ('siena-yatak-odasi-koleksiyonu', 'Siena Yatak Odası Koleksiyonu', 'Yatak Odası',
   'İskandinav dinginliği ve kavisli CNC membran işçiliğinin lüks buluşması.',
   'Siena Koleksiyonu, modern şehir hayatında sakinlik ve düzen arayanlar için tasarlandı. Yuvarlatılmış hatlar, 1. sınıf MDF gövde ve sessiz frenli mekanizmalar ile zamansız bir yatak odası atmosferi sunar.',
   'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/campaigns/imagen3-test-siena-vanity-1793737230969.jpg',
   '["Mat Antrasit", "Kaşmir", "İpek Beyaz", "Doğal Meşe"]'::jsonb, 1),

  ('porto-yatak-odasi-koleksiyonu', 'Porto Yatak Odası Koleksiyonu', 'Yatak Odası',
   'Doğal meşe sıcaklığı ve antrasit kontrastı ile mimari zarafet.',
   'Porto, akustik dikey çıta detayları ve geniş depolama alanlarıyla ferah bir dinlenme alanı oluşturur.',
   'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/porto-portmanto-56jk-1793451341659.png',
   '["Doğal Meşe", "Mat Antrasit", "Keten Bej"]'::jsonb, 2),

  ('milano-yatak-odasi-koleksiyonu', 'Milano Yatak Odası Koleksiyonu', 'Yatak Odası',
   'İtalyan minimalist çizgileri ve füme ayna derinliği.',
   'Milano Koleksiyonu, keskin hatları ve entegre aydınlatma detaylarıyla modern yatak odalarına sofistike bir dokunuş kazandırır.',
   'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/eren-portmanto-rzy4-1793451458911.png',
   '["Füme Aynalı Antrasit", "Ceviz", "Mat Siyah"]'::jsonb, 3),

  ('zurih-yatak-odasi-koleksiyonu', 'Zürih Yatak Odası Koleksiyonu', 'Yatak Odası',
   'Alp dağlarının duru sadeliği, masif meşe dokuları ve yumuşak formlar.',
   'Zürih serisi, doğal malzeme dokuları ile konforu ön planda tutan bir uyku sığınağı vaat eder.',
   'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/bahar-portmanto-ymz9.png',
   '["Açık Meşe", "Krem", "Kum Taşı"]'::jsonb, 4),

  ('verona-yatak-odasi-koleksiyonu', 'Verona Yatak Odası Koleksiyonu', 'Yatak Odası',
   'Klasik ve modernin uyumu, saten lake dokular ve pirinç detaylar.',
   'Verona, zarif çerçeveli kapakları ve şık metal aksesuarlarıyla yatak odanıza saray zarafetini getirir.',
   'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/campaigns/posts-post-detailed-siena-makyaj-masasi-7uht-1793733350708.png',
   '["Saten İnci", "Bronz Pirinç", "Aytaşı"]'::jsonb, 5),

  ('venedik-yatak-odasi-koleksiyonu', 'Venedik Yatak Odası Koleksiyonu', 'Yatak Odası',
   'Venedik sıva dokusu, koyu monokrom estetik ve gizli LED atmosferi.',
   'Venedik Koleksiyonu, koyu tonların asaletini yumuşak ışık geçişleriyle dengeleyen cesur bir tasarım diline sahiptir.',
   'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/campaigns/stories-story-siena-makyaj-masasi-7uht-1793733356611.png',
   '["Koyu Grafit", "Füme Meşe", "Mat Siyah"]'::jsonb, 6),

  ('kopenhag-yatak-odasi-koleksiyonu', 'Kopenhag Yatak Odası Koleksiyonu', 'Yatak Odası',
   'Nordic Hygge felsefesi: Hafiflik, ergonomi ve huzurlu detaylar.',
   'Kopenhag, fonksiyonel modüler dolap sistemleri ve yerden yüksek robot süpürge uyumlu ayak yapısıyla günlük hayatı kolaylaştırır.',
   'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/siena-makyaj-masasi-7uht-1793731691432.png',
   '["Kül Beyazı", "Açık Huş", "Açık Gri"]'::jsonb, 7),

  ('lizbon-yatak-odasi-koleksiyonu', 'Lizbon Yatak Odası Koleksiyonu', 'Yatak Odası',
   'Akdeniz esintisi, sıcak kaşmir tonları ve kavisli başlık tasarımı.',
   'Lizbon Koleksiyonu, kavisli başucu paneli ve dokulu kumaş kombinasyonuyla sıcak ve davetkar bir yaşam alanı sunar.',
   'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/campaigns/imagen3-test-siena-vanity-1793737230969.jpg',
   '["Sıcak Kaşmir", "Fındık Ceviz", "Keten Krem"]'::jsonb, 8)
on conflict (slug) do update set
  title = excluded.title,
  short_description = excluded.short_description,
  design_story = excluded.design_story,
  hero_image = excluded.hero_image,
  color_palette = excluded.color_palette,
  updated_at = now();

-- Mevcut Siena Makyaj Masasını Siena Koleksiyonuna Parça Olarak Bağla
insert into public.collection_products (collection_id, product_slug, role_in_collection, sort_order)
select id, 'siena-makyaj-masasi-7uht', 'vanity', 1
from public.collections
where slug = 'siena-yatak-odasi-koleksiyonu'
on conflict (collection_id, product_slug) do nothing;

-- Siena Makyaj Masası İçin Pazarlama Profilini Kaydet
insert into public.marketing_profiles (product_slug, atmosphere, lighting, color_palette, camera_angle, room_scene, interior_style)
values (
  'siena-makyaj-masasi-7uht',
  'Ultra-luxurious Scandinavian master bedroom vanity & dressing area',
  'Warm golden-hour sunlight from left window with subtle ambient LED glow behind circular brass mirror',
  'Cashmere greige, silk white, natural oak',
  'Architectural Digest quality, straight-on front eye-level view, 8k resolution',
  'Master bedroom vanity nook with backlit circular brass mirror',
  'Deep charcoal-greige Venetian plaster wall with vertical oak acoustic wood slats'
)
on conflict (product_slug) do update set
  atmosphere = excluded.atmosphere,
  lighting = excluded.lighting,
  updated_at = now();

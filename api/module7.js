import { authenticateRoles, apiError } from './_lib/auth.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PRODUCT_FIELDS = new Set([
  'slug', 'title', 'sku', 'kategori', 'kisa_aciklama', 'body', 'ana_resim',
  'populer', 'yeni', 'renkler', 'ozellikler', 'created_at', 'updated_at'
]);
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const SETTINGS_KEY = 'product_transform_settings';
const AI_STUDIO_KEY = 'ai_studio_profiles';

function error(message, status) { const e = new Error(message); e.status = status; return e; }
function validSlug(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,179}$/i.test(value); }
function validProduct(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) return false;
  return Object.keys(body).every(key => PRODUCT_FIELDS.has(key));
}
function actionOf(req) {
  return String(req.query?.action || new URL(req.url, 'https://local.invalid').searchParams.get('action') || 'products').toLowerCase();
}
async function supabase(path, key, options = {}) {
  if (!SUPABASE_URL || !key) throw error('Supabase configuration is incomplete.', 503);
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store'
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw error(data?.message || data?.hint || 'Supabase request failed.', response.status >= 500 ? 502 : 400);
  return data;
}

// ── 1. ÜRÜN CRUD (MEVCUT SÖZLEŞME %100 KORUNDU) ──────────────────────────────
async function products(req, res) {
  if (req.method === 'GET') {
    const rows = await supabase('/rest/v1/products?select=*&order=created_at.desc', ANON_KEY);
    return res.status(200).json({ ok: true, products: rows || [] });
  }
  if (!['POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateRoles(req, ['admin', 'product_manager']);
  const body = req.body || {};
  if (req.method === 'DELETE') {
    const slug = String(body.slug || '').trim();
    if (!validSlug(slug)) return res.status(400).json({ ok: false, error: 'Geçersiz ürün kodu.' });
    await supabase(`/rest/v1/products?slug=eq.${encodeURIComponent(slug)}`, SERVICE_KEY, { method: 'DELETE' });
    return res.status(200).json({ ok: true, deleted: true, slug });
  }
  if (!validProduct(body) || !validSlug(body.slug) || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 240) {
    return res.status(400).json({ ok: false, error: 'Ürün verisi geçersiz veya desteklenmeyen alan içeriyor.' });
  }
  if (body.sku != null && (typeof body.sku !== 'string' || body.sku.length > 100)) {
    return res.status(400).json({ ok: false, error: 'Ürün SKU değeri geçersiz.' });
  }
  for (const field of ['renkler', 'ozellikler']) {
    if (body[field] != null && !Array.isArray(body[field])) return res.status(400).json({ ok: false, error: `${field} bir dizi olmalıdır.` });
  }
  const now = new Date().toISOString();
  const payload = { ...body, title: body.title.trim(), updated_at: now };
  if (!payload.created_at) payload.created_at = now;
  const saved = await supabase('/rest/v1/products?on_conflict=slug', SERVICE_KEY, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
  return res.status(200).json({ ok: true, product: saved?.[0] || null });
}

// ── 2. DÖNÜŞTÜRME AYARLARI ──────────────────────────────────────────────────
async function settings(req, res) {
  if (req.method === 'GET') {
    const rows = await supabase(`/rest/v1/site_settings?key=eq.${SETTINGS_KEY}&select=data&limit=1`, ANON_KEY);
    return res.status(200).json({ ok: true, settings: rows?.[0]?.data || {} });
  }
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateRoles(req, ['admin', 'product_manager']);
  const value = req.body?.settings;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 1000) {
    return res.status(400).json({ ok: false, error: 'Dönüştürme ayarları geçersiz.' });
  }
  for (const [slug, enabled] of Object.entries(value)) {
    if (!validSlug(slug) || typeof enabled !== 'boolean') return res.status(400).json({ ok: false, error: 'Ayar anahtarı veya değeri geçersiz.' });
  }
  await supabase('/rest/v1/site_settings', SERVICE_KEY, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: SETTINGS_KEY, data: value, updated_at: new Date().toISOString() })
  });
  return res.status(200).json({ ok: true, settings: value });
}

// ── 3. AI STUDIO PROFİLLERİ ──────────────────────────────────────────────────
async function aiProfiles(req, res) {
  if (req.method === 'GET') {
    const rows = await supabase(`/rest/v1/site_settings?key=eq.${AI_STUDIO_KEY}&select=data&limit=1`, ANON_KEY);
    return res.status(200).json({ ok: true, profiles: rows?.[0]?.data || { categories: {}, products: {} } });
  }
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateRoles(req, ['admin', 'product_manager']);
  const profiles = req.body?.profiles;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles) ||
      !profiles.categories || typeof profiles.categories !== 'object' ||
      !profiles.products || typeof profiles.products !== 'object' ||
      Object.keys(profiles.categories).length > 100 || Object.keys(profiles.products).length > 1000 ||
      Buffer.byteLength(JSON.stringify(profiles), 'utf8') > 200000) {
    return res.status(400).json({ ok: false, error: 'AI Studio profil verisi geçersiz.' });
  }
  const clean = { categories: {}, products: {} };
  for (const [key, value] of Object.entries(profiles.categories)) {
    if (!key.trim() || !value || typeof value !== 'object' || Array.isArray(value)) return res.status(400).json({ ok: false, error: 'Kategori profili geçersiz.' });
    clean.categories[key.slice(0, 120)] = value;
  }
  for (const [slug, value] of Object.entries(profiles.products)) {
    if (!validSlug(slug) || !value || typeof value !== 'object' || Array.isArray(value)) return res.status(400).json({ ok: false, error: 'Ürün profili geçersiz.' });
    clean.products[slug] = value;
  }
  await supabase('/rest/v1/site_settings', SERVICE_KEY, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: AI_STUDIO_KEY, data: clean, updated_at: new Date().toISOString() })
  });
  return res.status(200).json({ ok: true, profiles: clean, saved: true });
}

// ── 4. RESİM YÜKLEME ────────────────────────────────────────────────────────
async function media(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateRoles(req, ['admin', 'product_manager']);
  const { slug, data_url } = req.body || {};
  if (!validSlug(slug)) return res.status(400).json({ ok: false, error: 'Geçersiz ürün kodu.' });
  if (typeof data_url !== 'string') return res.status(400).json({ ok: false, error: 'Görsel verisi eksik.' });
  const match = data_url.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ ok: false, error: 'Yalnızca PNG, JPEG veya WebP görselleri kabul edilir.' });
  const mime = match[1];
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return res.status(413).json({ ok: false, error: 'Görsel en fazla 3 MB olabilir.' });
  if (!SUPABASE_URL || !SERVICE_KEY) throw error('Storage server configuration is incomplete.', 503);
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
  const path = `products/${slug}-${Date.now()}.${ext}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': mime, 'x-upsert': 'true' },
    body: bytes,
    cache: 'no-store'
  });
  if (!response.ok) {
    const err = new Error((await response.text()) || 'Storage upload failed.');
    err.status = response.status >= 500 ? 502 : 400;
    throw err;
  }
  return res.status(201).json({ ok: true, path, public_url: `${SUPABASE_URL}/storage/v1/object/public/media/${path}` });
}

// ── 5. KOLEKSİYONLAR CRUD (YENİ SHOWROOM MİMARİSİ) ─────────────────────────
async function collections(req, res) {
  if (req.method === 'GET') {
    const slug = req.query?.slug ? String(req.query.slug).trim() : '';
    if (slug) {
      if (!validSlug(slug)) return res.status(400).json({ ok: false, error: 'Geçersiz koleksiyon slug.' });
      const rows = await supabase(`/rest/v1/collections?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`, ANON_KEY);
      const col = rows?.[0] || null;
      if (!col) return res.status(404).json({ ok: false, error: 'Koleksiyon bulunamadı.' });
      // Koleksiyona bağlı ürünleri de çek
      const parts = await supabase(`/rest/v1/collection_products?collection_id=eq.${encodeURIComponent(col.id)}&select=role_in_collection,sort_order,product_slug,products(*)&order=sort_order.asc`, ANON_KEY);
      return res.status(200).json({ ok: true, collection: col, parts: parts || [] });
    }
    const rows = await supabase('/rest/v1/collections?select=*&order=sort_order.asc,created_at.asc', ANON_KEY);
    return res.status(200).json({ ok: true, collections: rows || [] });
  }

  if (!['POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  await authenticateRoles(req, ['admin', 'product_manager']);
  const body = req.body || {};

  if (req.method === 'DELETE') {
    const slug = String(body.slug || '').trim();
    if (!validSlug(slug)) return res.status(400).json({ ok: false, error: 'Geçersiz koleksiyon kodu.' });
    await supabase(`/rest/v1/collections?slug=eq.${encodeURIComponent(slug)}`, SERVICE_KEY, { method: 'DELETE' });
    return res.status(200).json({ ok: true, deleted: true, slug });
  }

  // Create / Update
  const slug = String(body.slug || '').trim();
  const title = String(body.title || '').trim();
  const hero_image = String(body.hero_image || '').trim();
  if (!validSlug(slug) || !title || !hero_image) {
    return res.status(400).json({ ok: false, error: 'Koleksiyon kodu, başlığı ve ana görseli zorunludur.' });
  }

  const now = new Date().toISOString();
  const payload = {
    slug,
    title,
    category: String(body.category || 'Yatak Odası').trim(),
    short_description: body.short_description ? String(body.short_description).trim() : '',
    design_story: body.design_story ? String(body.design_story).trim() : '',
    hero_image,
    color_palette: Array.isArray(body.color_palette) ? body.color_palette : [],
    is_visible: body.is_visible !== false,
    sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
    updated_at: now
  };

  const saved = await supabase('/rest/v1/collections?on_conflict=slug', SERVICE_KEY, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
  return res.status(200).json({ ok: true, collection: saved?.[0] || null });
}

// ── 6. KOLEKSİYON PARÇA İLİŞKİLERİ ──────────────────────────────────────────
async function collectionProducts(req, res) {
  if (req.method === 'GET') {
    const colId = String(req.query?.collection_id || '').trim();
    if (!colId) return res.status(400).json({ ok: false, error: 'collection_id gerekli.' });
    const rows = await supabase(`/rest/v1/collection_products?collection_id=eq.${encodeURIComponent(colId)}&select=*,products(*)&order=sort_order.asc`, ANON_KEY);
    return res.status(200).json({ ok: true, items: rows || [] });
  }

  await authenticateRoles(req, ['admin', 'product_manager']);
  const body = req.body || {};

  if (req.method === 'DELETE') {
    const colId = String(body.collection_id || '').trim();
    const prodSlug = String(body.product_slug || '').trim();
    if (!colId || !prodSlug) return res.status(400).json({ ok: false, error: 'collection_id ve product_slug zorunlu.' });
    await supabase(`/rest/v1/collection_products?collection_id=eq.${encodeURIComponent(colId)}&product_slug=eq.${encodeURIComponent(prodSlug)}`, SERVICE_KEY, { method: 'DELETE' });
    return res.status(200).json({ ok: true, removed: true });
  }

  if (req.method === 'POST') {
    const colId = String(body.collection_id || '').trim();
    const prodSlug = String(body.product_slug || '').trim();
    if (!colId || !validSlug(prodSlug)) return res.status(400).json({ ok: false, error: 'collection_id ve geçerli product_slug zorunlu.' });

    const payload = {
      collection_id: colId,
      product_slug: prodSlug,
      role_in_collection: String(body.role_in_collection || 'part').toLowerCase(),
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0
    };

    const saved = await supabase('/rest/v1/collection_products?on_conflict=collection_id,product_slug', SERVICE_KEY, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload)
    });
    return res.status(200).json({ ok: true, item: saved?.[0] || null });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

// ── 7. ÇOKLU MEDYA KÜTÜPHANESİ VE ONAY HAVUZU ──────────────────────────────
async function productMedia(req, res) {
  if (req.method === 'GET') {
    const slug = req.query?.product_slug ? String(req.query.product_slug).trim() : '';
    const colId = req.query?.collection_id ? String(req.query.collection_id).trim() : '';
    let query = '/rest/v1/product_media?select=*&order=sort_order.asc,created_at.desc';
    if (slug) query += `&product_slug=eq.${encodeURIComponent(slug)}`;
    if (colId) query += `&collection_id=eq.${encodeURIComponent(colId)}`;
    const rows = await supabase(query, ANON_KEY);
    return res.status(200).json({ ok: true, media: rows || [] });
  }

  await authenticateRoles(req, ['admin', 'product_manager']);
  const body = req.body || {};

  if (req.method === 'DELETE') {
    const id = String(body.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'Medya ID gerekli.' });
    await supabase(`/rest/v1/product_media?id=eq.${encodeURIComponent(id)}`, SERVICE_KEY, { method: 'DELETE' });
    return res.status(200).json({ ok: true, deleted: true, id });
  }

  if (req.method === 'POST') {
    const media_url = String(body.media_url || '').trim();
    if (!media_url) return res.status(400).json({ ok: false, error: 'media_url zorunludur.' });

    const payload = {
      product_slug: body.product_slug ? String(body.product_slug).trim() : null,
      collection_id: body.collection_id ? String(body.collection_id).trim() : null,
      media_url,
      media_type: String(body.media_type || 'hero').toLowerCase(),
      source_type: String(body.source_type || 'original').toLowerCase(),
      approval_status: String(body.approval_status || 'approved').toLowerCase(),
      aspect_ratio: String(body.aspect_ratio || '1:1'),
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
      caption: body.caption ? String(body.caption).trim() : null
    };

    const saved = await supabase('/rest/v1/product_media', SERVICE_KEY, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    return res.status(201).json({ ok: true, media: saved?.[0] || null });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

// ── 8. TEKLİF TALEPLERİ & CRM BAĞLANTISI (HALKA AÇIK FORM + YÖNETİCİ LİSTESİ)
async function quotes(req, res) {
  // POST: Web sitesindeki müşteriler teklif talebi gönderebilir (Anonim erişim serbest!)
  if (req.method === 'POST') {
    const body = req.body || {};
    const name = String(body.customer_name || '').trim();
    const phone = String(body.customer_phone || '').trim();
    if (!name || !phone || phone.length < 7) {
      return res.status(400).json({ ok: false, error: 'Ad soyad ve geçerli telefon numarası zorunludur.' });
    }

    const quoteNumber = `GM-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const payload = {
      quote_number: quoteNumber,
      product_slug: body.product_slug ? String(body.product_slug).trim() : null,
      collection_slug: body.collection_slug ? String(body.collection_slug).trim() : null,
      variant_id: body.variant_id ? String(body.variant_id).trim() : null,
      customer_name: name,
      customer_phone: phone,
      customer_email: body.customer_email ? String(body.customer_email).trim() : null,
      customer_city: body.customer_city ? String(body.customer_city).trim() : null,
      request_type: String(body.request_type || 'catalog_price'),
      custom_notes: body.custom_notes ? String(body.custom_notes).slice(0, 2000) : null,
      status: 'new',
      source_channel: String(body.source_channel || 'web_showroom'),
      created_at: new Date().toISOString()
    };

    const saved = await supabase('/rest/v1/quote_requests', SERVICE_KEY, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });

    return res.status(201).json({
      ok: true,
      quote_number: quoteNumber,
      message: 'Teklif talebiniz başarıyla alındı. Fabrika satış temsilcimiz en kısa sürede sizinle iletişime geçecektir.',
      quote: saved?.[0] || null
    });
  }

  // GET & PATCH: Yalnızca yetkili yöneticiler görebilir ve durum güncelleyebilir
  await authenticateRoles(req, ['admin', 'product_manager']);

  if (req.method === 'GET') {
    const rows = await supabase('/rest/v1/quote_requests?select=*&order=created_at.desc&limit=100', SERVICE_KEY);
    return res.status(200).json({ ok: true, quotes: rows || [] });
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const id = String(req.body?.id || '').trim();
    const status = String(req.body?.status || '').trim();
    if (!id || !status) return res.status(400).json({ ok: false, error: 'Talep ID ve yeni durum zorunludur.' });

    const updated = await supabase(`/rest/v1/quote_requests?id=eq.${encodeURIComponent(id)}`, SERVICE_KEY, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() })
    });
    return res.status(200).json({ ok: true, quote: updated?.[0] || null });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

// ── 9. DİJİTAL SHOWROOM ENTEGRE ÇEKME (TEK HTTP İSTEĞİNDE TÜM SHOWROOM) ────
async function showroom(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    const [colsRes, prodsRes, colProdsRes, mediaRes] = await Promise.all([
      supabase('/rest/v1/collections?is_visible=eq.true&order=sort_order.asc,created_at.asc', ANON_KEY).catch(() => []),
      supabase('/rest/v1/products?order=created_at.desc', ANON_KEY).catch(() => []),
      supabase('/rest/v1/collection_products?select=*&order=sort_order.asc', ANON_KEY).catch(() => []),
      supabase('/rest/v1/product_media?approval_status=eq.approved&order=sort_order.asc', ANON_KEY).catch(() => [])
    ]);

    return res.status(200).json({
      ok: true,
      showroom: {
        brand: {
          name: 'Global Mobilya',
          title: 'Premium Dijital Showroom & Mimari Koleksiyonlar',
          phone: '0 (505) 015 1035',
          whatsapp: 'https://wa.me/905050151035'
        },
        collections: Array.isArray(colsRes) ? colsRes : [],
        products: Array.isArray(prodsRes) ? prodsRes : [],
        collection_products: Array.isArray(colProdsRes) ? colProdsRes : [],
        media: Array.isArray(mediaRes) ? mediaRes : []
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Showroom verileri yüklenemedi: ' + err.message });
  }
}

// ── ANA YÖNLENDİRİCİ ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const action = actionOf(req);
    if (action === 'products') return await products(req, res);
    if (action === 'settings') return await settings(req, res);
    if (action === 'ai-profiles') return await aiProfiles(req, res);
    if (action === 'media') return await media(req, res);
    if (action === 'collections') return await collections(req, res);
    if (action === 'collection-products') return await collectionProducts(req, res);
    if (action === 'product-media') return await productMedia(req, res);
    if (action === 'quote' || action === 'quotes') return await quotes(req, res);
    if (action === 'showroom') return await showroom(req, res);
    return res.status(400).json({ ok: false, error: 'Bilinmeyen Modül 7 işlemi: ' + action });
  } catch (err) {
    return apiError(res, err, 'Module 7');
  }
}

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const action = actionOf(req);
    if (action === 'products') return await products(req, res);
    if (action === 'settings') return await settings(req, res);
    if (action === 'media') return await media(req, res);
    return res.status(400).json({ ok: false, error: 'Bilinmeyen Modül 7 işlemi.' });
  } catch (err) {
    return apiError(res, err, 'Module 7');
  }
}

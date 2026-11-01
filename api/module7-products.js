import { authenticateRoles, apiError } from './_lib/auth.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PRODUCT_FIELDS = new Set([
  'slug', 'title', 'sku', 'kategori', 'kisa_aciklama', 'body', 'ana_resim',
  'anasayfada_goster', 'populer', 'yeni', 'renkler', 'ozellikler',
  'web_gorunur', 'web_siralama', 'created_at', 'updated_at'
]);
const MAX_BODY_BYTES = 1024 * 1024;

function error(message, status) { const e = new Error(message); e.status = status; return e; }
function validSlug(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,179}$/i.test(value); }
function validProduct(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) return false;
  return Object.keys(body).every(key => PRODUCT_FIELDS.has(key));
}
function serviceHeaders(extra = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw error('Supabase service configuration is incomplete.', 503);
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...extra };
}
async function supabase(path, options = {}, privileged = true) {
  const key = privileged ? SERVICE_KEY : ANON_KEY;
  if (!SUPABASE_URL || !key) throw error('Supabase configuration is incomplete.', 503);
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    cache: 'no-store'
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw error(data?.message || 'Supabase request failed.', response.status >= 500 ? 502 : 400);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    if (req.method === 'GET') {
      const rows = await supabase('/rest/v1/products?select=*&order=created_at.desc', {}, false);
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
      await supabase(`/rest/v1/products?slug=eq.${encodeURIComponent(slug)}`, { method: 'DELETE' });
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
    const saved = await supabase('/rest/v1/products?on_conflict=slug', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload)
    });
    return res.status(200).json({ ok: true, product: saved?.[0] || null });
  } catch (err) {
    return apiError(res, err, 'Module 7 Products');
  }
}

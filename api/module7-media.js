import { authenticateRoles, apiError } from './_lib/auth.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  try {
    await authenticateRoles(req, ['admin', 'product_manager']);
    const { slug, data_url } = req.body || {};
    if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,179}$/i.test(slug)) {
      return res.status(400).json({ ok: false, error: 'Geçersiz ürün kodu.' });
    }
    if (typeof data_url !== 'string') return res.status(400).json({ ok: false, error: 'Görsel verisi eksik.' });
    const match = data_url.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ ok: false, error: 'Yalnızca PNG, JPEG veya WebP görselleri kabul edilir.' });
    const mime = match[1];
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return res.status(413).json({ ok: false, error: 'Görsel en fazla 3 MB olabilir.' });
    if (!SUPABASE_URL || !SERVICE_KEY) throw Object.assign(new Error('Storage server configuration is incomplete.'), { status: 503 });
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
    const path = `products/${slug}-${Date.now()}.${ext}`;
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': mime,
        'x-upsert': 'true'
      },
      body: bytes,
      cache: 'no-store'
    });
    if (!response.ok) {
      const detail = await response.text();
      const err = new Error(detail || 'Storage upload failed.');
      err.status = response.status >= 500 ? 502 : 400;
      throw err;
    }
    return res.status(201).json({ ok: true, path, public_url: `${SUPABASE_URL}/storage/v1/object/public/media/${path}` });
  } catch (err) {
    return apiError(res, err, 'Module 7 Media');
  }
}

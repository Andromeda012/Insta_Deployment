import { authenticateRoles, apiError } from './_lib/auth.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SETTINGS_KEY = 'product_transform_settings';

async function request(path, key, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store'
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const err = new Error(data?.message || 'Settings request failed.');
    err.status = response.status >= 500 ? 502 : 400;
    throw err;
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) throw Object.assign(new Error('Supabase configuration is incomplete.'), { status: 503 });
    if (req.method === 'GET') {
      const rows = await request(`/rest/v1/site_settings?key=eq.${SETTINGS_KEY}&select=data&limit=1`, ANON_KEY);
      return res.status(200).json({ ok: true, settings: rows?.[0]?.data || {} });
    }
    if (req.method !== 'PUT') {
      res.setHeader('Allow', 'GET, PUT');
      return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    }
    await authenticateRoles(req, ['admin', 'product_manager']);
    const settings = req.body?.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) || Object.keys(settings).length > 1000) {
      return res.status(400).json({ ok: false, error: 'Dönüştürme ayarları geçersiz.' });
    }
    for (const [slug, enabled] of Object.entries(settings)) {
      if (!/^[a-z0-9][a-z0-9-]{0,179}$/i.test(slug) || typeof enabled !== 'boolean') {
        return res.status(400).json({ ok: false, error: 'Ayar anahtarı veya değeri geçersiz.' });
      }
    }
    await request('/rest/v1/site_settings', SERVICE_KEY, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: SETTINGS_KEY, data: settings, updated_at: new Date().toISOString() })
    });
    return res.status(200).json({ ok: true, settings });
  } catch (err) {
    return apiError(res, err, 'Module 7 Settings');
  }
}

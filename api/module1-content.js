const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ALLOWED_TYPES = new Set(['blog', 'gallery', 'supplier', 'site_setting', 'product_web_settings']);
const MAX_BODY_BYTES = 1024 * 1024;

function send(res, status, body) {
  return res.status(status).json(body);
}

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function bearerToken(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

async function authenticate(req) {
  const token = bearerToken(req);
  if (!token) throw fail('Oturum açmanız gerekiyor.', 401);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw fail('CMS sunucu ortam değişkenleri eksik.', 503);
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw fail('Oturum geçersiz veya süresi dolmuş.', 401);

  const user = await response.json();
  const role = user.app_metadata?.role;
  if (!['admin', 'content_manager'].includes(role)) {
    throw fail('Bu işlem için CMS yetkiniz bulunmuyor.', 403);
  }
  return user;
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    cache: 'no-store'
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || 'Supabase isteği başarısız.');
    error.status = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw error;
  }
  return data;
}

function validPayload(payload) {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    && Buffer.byteLength(JSON.stringify(payload), 'utf8') <= MAX_BODY_BYTES;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  try {
    const user = await authenticate(req);

    if (req.method === 'GET') {
      const id = String(req.query?.id || '').trim();
      if (id) {
        if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { ok: false, error: 'Geçersiz revision_id.' });
        const rows = await supabaseRequest(`/rest/v1/content_revisions?id=eq.${encodeURIComponent(id)}&select=*`);
        if (!rows?.length) return send(res, 404, { ok: false, error: 'Taslak bulunamadı.' });
        return send(res, 200, { ok: true, revision: rows[0] });
      }
      const rows = await supabaseRequest('/rest/v1/content_revisions?select=id,entity_type,entity_slug,status,revision_number,author_id,created_at,updated_at,published_at&order=created_at.desc&limit=100');
      return send(res, 200, { ok: true, revisions: rows || [] });
    }

    const body = req.body || {};
    if (!validPayload(body)) return send(res, 413, { ok: false, error: 'İstek içeriği geçersiz veya çok büyük.' });

    if (body.action === 'save-draft') {
      const entityType = String(body.entity_type || '');
      const slug = String(body.entity_slug || '').trim();
      const payload = body.payload;
      if (!ALLOWED_TYPES.has(entityType) || !slug || slug.length > 180 || !validPayload(payload)) {
        return send(res, 400, { ok: false, error: 'Taslak türü, slug veya içerik geçersiz.' });
      }
      if (entityType === 'site_setting' && !['genel', 'anasayfa'].includes(slug)) {
        return send(res, 400, { ok: false, error: 'Bu ayar anahtarı Modül 1 üzerinden yayınlanamaz.' });
      }
      if (entityType === 'product_web_settings' && !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
        return send(res, 400, { ok: false, error: 'Ürün kodu geçersiz.' });
      }

      const created = await supabaseRequest('/rest/v1/rpc/save_content_draft', {
        method: 'POST',
        body: JSON.stringify({
          p_entity_type: entityType,
          p_entity_slug: slug,
          p_payload: payload,
          p_author_id: user.id
        })
      });
      return send(res, 201, { ok: true, revision: created });
    }

    if (body.action === 'publish') {
      const revisionId = String(body.revision_id || '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(revisionId)) {
        return send(res, 400, { ok: false, error: 'Geçersiz revision_id.' });
      }
      const result = await supabaseRequest('/rest/v1/rpc/publish_content_revision', {
        method: 'POST',
        body: JSON.stringify({ p_revision_id: revisionId, p_actor_id: user.id })
      });
      return send(res, 200, { ok: true, result });
    }

    return send(res, 400, { ok: false, error: 'Bilinmeyen işlem.' });
  } catch (error) {
    if ((error.status || 500) >= 500) console.error('[Module 1 CMS]', error);
    const status = error.status || 500;
    return send(res, status, {
      ok: false,
      error: status >= 500 ? 'CMS işlemi tamamlanamadı. Sunucu yapılandırmasını kontrol edin.' : error.message
    });
  }
}

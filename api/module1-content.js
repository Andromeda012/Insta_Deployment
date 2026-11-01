const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ALLOWED_TYPES = new Set(['blog', 'gallery', 'supplier', 'site_setting', 'product_web_settings']);

function send(res, status, body) {
  return res.status(status).json(body);
}

function bearerToken(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

async function authenticate(req) {
  const token = bearerToken(req);
  if (!token) throw Object.assign(new Error('Oturum açmanız gerekiyor.'), { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw Object.assign(new Error('CMS sunucu ortam değişkenleri eksik.'), { status: 503 });
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw Object.assign(new Error('Oturum geçersiz veya süresi dolmuş.'), { status: 401 });

  const user = await response.json();
  const role = user.app_metadata?.role;
  if (!['admin', 'content_manager'].includes(role)) {
    throw Object.assign(new Error('Bu işlem için CMS yetkiniz bulunmuyor.'), { status: 403 });
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
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || 'Supabase isteği başarısız.';
    throw Object.assign(new Error(message), { status: response.status >= 400 && response.status < 500 ? 400 : 502 });
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  try {
    const user = await authenticate(req);

    if (req.method === 'GET') {
      const id = String(req.query?.id || '').trim();
      if (id) {
        const rows = await supabaseRequest(`/rest/v1/content_revisions?id=eq.${encodeURIComponent(id)}&select=*`);
        if (!rows?.length) return send(res, 404, { ok: false, error: 'Taslak bulunamadı.' });
        return send(res, 200, { ok: true, revision: rows[0] });
      }
      const rows = await supabaseRequest('/rest/v1/content_revisions?select=id,entity_type,entity_slug,status,revision_number,author_id,created_at,updated_at,published_at&order=created_at.desc&limit=100');
      return send(res, 200, { ok: true, revisions: rows || [] });
    }

    const body = req.body || {};
    if (body.action === 'save-draft') {
      const entityType = String(body.entity_type || '');
      const slug = String(body.entity_slug || '').trim();
      const payload = body.payload;
      if (!ALLOWED_TYPES.has(entityType) || !slug || slug.length > 180 || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return send(res, 400, { ok: false, error: 'Taslak türü, slug veya içerik geçersiz.' });
      }

      const existing = await supabaseRequest(
        `/rest/v1/content_revisions?entity_type=eq.${encodeURIComponent(entityType)}&entity_slug=eq.${encodeURIComponent(slug)}&select=revision_number&order=revision_number.desc&limit=1`
      );
      const revisionNumber = (existing?.[0]?.revision_number || 0) + 1;
      const created = await supabaseRequest('/rest/v1/content_revisions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([{
          entity_type: entityType,
          entity_slug: slug,
          payload,
          revision_number: revisionNumber,
          author_id: user.id
        }])
      });
      return send(res, 201, { ok: true, revision: created?.[0] || null });
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
    return send(res, error.status || 500, { ok: false, error: error.message || 'Beklenmeyen sunucu hatası.' });
  }
}

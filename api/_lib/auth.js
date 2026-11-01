const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function authenticateRoles(req, allowedRoles) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw httpError('Oturum açmanız gerekiyor.', 401);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw httpError('Kimlik doğrulama sunucu ayarları eksik.', 503);

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!response.ok) throw httpError('Oturum geçersiz veya süresi dolmuş.', 401);

  const user = await response.json();
  const role = user.app_metadata?.role;
  if (!allowedRoles.includes(role)) throw httpError('Bu işlem için yetkiniz bulunmuyor.', 403);
  return user;
}

export function apiError(res, error, label = 'API') {
  const status = error.status || 500;
  if (status >= 500) console.error(`[${label}]`, error);
  return res.status(status).json({
    ok: false,
    error: status >= 500 ? 'İşlem tamamlanamadı. Sunucu yapılandırmasını kontrol edin.' : error.message
  });
}

// ============================================================================
// GLOBAL KAPAK MOBİLYA — MERKEZİ CLERK AUTH, KURUM AYRIMI, DEPARTMAN RBAC & SVIX WEBHOOK
// Faz 2: Tek Clerk Production Uygulaması ile ERP (erp.globalkapakmobilya.com)
// ve Vitrin (beta.globalkapakmobilya.com) Kimlik Doğrulama & Yetkilendirme Katmanı
// ============================================================================

import crypto from 'node:crypto';

export const CLERK_PUBLISHABLE_KEY = (
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.CLERK_PUBLISHABLE_KEY ||
  'pk_live_Y2xlcmsuZ2xvYmFsa2FwYWttb2JpbHlhLmNvbSQ'
).trim();

const CLERK_SECRET_KEY = (
  process.env.CLERK_SECRET_KEY ||
  ''
).trim();

const CLERK_WEBHOOK_SECRET = (
  process.env.CLERK_WEBHOOK_SECRET ||
  ''
).trim();

const GLOBAL_KAPAK_ORG_ID = (
  process.env.CLERK_ORG_ID ||
  'org_3MQEn3zykDenqO7WuKDpWfKDInY'
).trim();

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://vrfujrpsjzqjthaqdalx.supabase.co'
).replace(/\/+$/, '');

const SUPABASE_SERVICE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim();

// ── DEPARTMAN BAZLI YETKİ MATRİSİ (publicMetadata.department) ────────────────
export const DEPARTMENT_DEFINITIONS = {
  admin: {
    id: 'admin',
    label: 'Sistem & Kurum Yöneticisi (Admin)',
    badge: 'org:admin',
    canWrite: true,
    allowedRoutes: ['website', 'social', 'crm', 'production', 'operations', 'analytics', 'products', 'studio', 'permissions'],
    defaultRoute: 'products',
    mappedRoles: ['admin', 'product_manager', 'content_manager', 'production_manager', 'mrp_manager', 'crm_sales', 'social_operator', 'factory', 'sales', 'social_media', 'viewer']
  },
  factory: {
    id: 'factory',
    label: 'Fabrika & Üretim Planlama (MRP)',
    badge: 'mrp_manager',
    canWrite: true,
    allowedRoutes: ['production', 'products', 'studio'],
    defaultRoute: 'production',
    mappedRoles: ['factory', 'mrp_manager', 'production_manager', 'product_manager']
  },
  sales: {
    id: 'sales',
    label: 'CRM, Satış & Teklif Yönetimi',
    badge: 'crm_sales',
    canWrite: true,
    allowedRoutes: ['crm', 'products'],
    defaultRoute: 'crm',
    mappedRoles: ['sales', 'crm_sales', 'product_manager']
  },
  social_media: {
    id: 'social_media',
    label: 'Sosyal Medya Botları & İçerik Stüdyosu',
    badge: 'social_operator',
    canWrite: true,
    allowedRoutes: ['social', 'website', 'studio'],
    defaultRoute: 'social',
    mappedRoles: ['social_media', 'social_operator', 'content_manager', 'production_manager']
  },
  viewer: {
    id: 'viewer',
    label: 'Salt Okunur Denetçi & Raporlama (Viewer)',
    badge: 'viewer',
    canWrite: false,
    allowedRoutes: ['website', 'social', 'crm', 'production', 'operations', 'analytics', 'products', 'studio'],
    defaultRoute: 'analytics',
    mappedRoles: ['viewer', 'product_manager', 'content_manager', 'production_manager', 'mrp_manager', 'crm_sales', 'social_operator', 'factory', 'sales', 'social_media']
  }
};

function httpError(message, status, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

export function normalizeDepartment(rawDept, orgRole = '') {
  const d = String(rawDept || '').toLowerCase().trim();
  const r = String(orgRole || '').toLowerCase().trim();

  if (r === 'org:admin' || r === 'admin' || d === 'admin') return 'admin';
  if (d === 'factory' || d === 'mrp_manager' || d === 'mrp' || d === 'production' || d === 'production_manager') return 'factory';
  if (d === 'sales' || d === 'crm_sales' || d === 'crm') return 'sales';
  if (d === 'social_media' || d === 'social_operator' || d === 'social' || d === 'content_manager') return 'social_media';
  if (d === 'viewer' || d === 'read_only' || d === 'readonly') return 'viewer';
  return '';
}

// ── CLERK JWKS & KULLANICI ÖNBELLEĞİ ─────────────────────────────────────────
let cachedJwks = null;
let cachedJwksAt = 0;
const userProfileCache = new Map();

async function getClerkJwks() {
  if (cachedJwks && (Date.now() - cachedJwksAt) < 10 * 60 * 1000) {
    return cachedJwks;
  }
  const endpoints = [
    'https://api.clerk.com/v1/jwks',
    'https://clerk.globalkapakmobilya.com/.well-known/jwks.json'
  ];
  for (const url of endpoints) {
    try {
      const headers = url.includes('api.clerk.com') && CLERK_SECRET_KEY
        ? { Authorization: `Bearer ${CLERK_SECRET_KEY}` }
        : {};
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.keys) && data.keys.length > 0) {
          cachedJwks = data.keys;
          cachedJwksAt = Date.now();
          return cachedJwks;
        }
      }
    } catch (_) {}
  }
  throw httpError('Clerk JWKS anahtarları alınamadı.', 503);
}

function decodeBase64UrlJson(b64u) {
  const norm = String(b64u || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = norm.padEnd(Math.ceil(norm.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function decodeBase64UrlBuffer(b64u) {
  const norm = String(b64u || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = norm.padEnd(Math.ceil(norm.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

export async function verifyClerkJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw httpError('Geçersiz Clerk oturum jetonu formatı.', 401);
  }

  let header, payload;
  try {
    header = decodeBase64UrlJson(parts[0]);
    payload = decodeBase64UrlJson(parts[1]);
  } catch (_) {
    throw httpError('Oturum jetonu çözümlenemedi.', 401);
  }

  const keys = await getClerkJwks();
  const jwk = keys.find(k => !header.kid || k.kid === header.kid) || keys[0];
  if (!jwk) {
    throw httpError('Clerk imza doğrulama anahtarı bulunamadı.', 401);
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
  const signature = decodeBase64UrlBuffer(parts[2]);

  const isValid = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
  if (!isValid) {
    throw httpError('Oturum imzası doğrulanamadı.', 401);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && nowSec > payload.exp + 30) {
    throw httpError('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.', 401);
  }

  return payload;
}

export async function fetchClerkUserAndOrgFromApi(clerkUserId) {
  if (!clerkUserId || !CLERK_SECRET_KEY) return null;
  const cached = userProfileCache.get(clerkUserId);
  if (cached && (Date.now() - cached.at) < 45 * 1000) {
    return cached.data;
  }

  const headers = { Authorization: `Bearer ${CLERK_SECRET_KEY}` };
  const [userRes, memRes] = await Promise.all([
    fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`, { headers }),
    fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}/organization_memberships?limit=20`, { headers })
  ]);

  if (!userRes.ok) return null;
  const userObj = await userRes.json();
  const memObj = memRes.ok ? await memRes.json() : { data: [] };
  const memberships = Array.isArray(memObj?.data) ? memObj.data : [];

  const targetMem = memberships.find(m => m.organization?.id === GLOBAL_KAPAK_ORG_ID) || memberships[0] || null;
  const primaryEmail = (userObj.email_addresses || []).find(e => e.id === userObj.primary_email_address_id)?.email_address
    || userObj.email_addresses?.[0]?.email_address
    || '';
  const primaryPhone = (userObj.phone_numbers || [])[0]?.phone_number || '';
  const fullName = [userObj.first_name, userObj.last_name].filter(Boolean).join(' ').trim()
    || userObj.username
    || primaryEmail
    || clerkUserId;

  const result = {
    id: userObj.id,
    username: userObj.username || '',
    email: primaryEmail,
    phone: primaryPhone,
    fullName,
    avatarUrl: userObj.image_url || '',
    publicMetadata: userObj.public_metadata || {},
    orgId: targetMem?.organization?.id || '',
    orgName: targetMem?.organization?.name || '',
    orgSlug: targetMem?.organization?.slug || '',
    orgRole: targetMem?.role || '',
    isOrganizationMember: Boolean(targetMem?.organization?.id)
  };

  userProfileCache.set(clerkUserId, { at: Date.now(), data: result });
  if (userProfileCache.size > 200) {
    const firstKey = userProfileCache.keys().next().value;
    userProfileCache.delete(firstKey);
  }
  return result;
}

/**
 * İstekten Clerk JWT'sini doğrular ve kullanıcının kurum üyeliği + departman profilini çözer.
 */
export async function resolveClerkAuthContext(req) {
  const authorization = req?.headers?.authorization || req?.headers?.Authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    throw httpError('Oturum açmanız gerekiyor.', 401, 'UNAUTHENTICATED');
  }

  const claims = await verifyClerkJwt(token);
  const clerkUserId = claims.sub;
  if (!clerkUserId) {
    throw httpError('Geçersiz kullanıcı oturumu (sub eksik).', 401, 'INVALID_SUB');
  }

  // 1. Önce JWT içindeki sessionClaims (metadata.department ve org_id / o.id) alanlarına bak
  let claimOrgId = claims.org_id || claims.o?.id || req?.headers?.['x-clerk-org-id'] || '';
  let claimOrgRole = claims.org_role || (claims.o?.rol ? `org:${claims.o.rol}` : '') || '';
  let claimDept = claims.metadata?.department || claims.public_metadata?.department || claims.app_metadata?.department || '';

  // 2. Clerk Backend API üzerinden kullanıcı profilini ve Global Kapak Mobilya kurum üyeliğini doğrula
  const apiProfile = await fetchClerkUserAndOrgFromApi(clerkUserId);

  const orgId = apiProfile?.orgId || claimOrgId || '';
  const orgRole = apiProfile?.orgRole || claimOrgRole || '';
  const rawDepartment = apiProfile?.publicMetadata?.department || claimDept || '';
  const department = normalizeDepartment(rawDepartment, orgRole);
  const isOrganizationMember = Boolean(orgId && (!GLOBAL_KAPAK_ORG_ID || orgId === GLOBAL_KAPAK_ORG_ID));

  const deptConfig = DEPARTMENT_DEFINITIONS[department] || DEPARTMENT_DEFINITIONS.viewer;

  return {
    id: clerkUserId,
    clerk_user_id: clerkUserId,
    email: apiProfile?.email || claims.email || `${apiProfile?.username || clerkUserId}@globalkapakmobilya.com`,
    username: apiProfile?.username || claims.username || '',
    fullName: apiProfile?.fullName || apiProfile?.username || clerkUserId,
    phone: apiProfile?.phone || '',
    avatarUrl: apiProfile?.avatarUrl || '',
    orgId,
    orgName: apiProfile?.orgName || 'Global Kapak Mobilya',
    orgRole,
    isOrganizationMember,
    department: department || (isOrganizationMember ? 'viewer' : 'b2c_customer'),
    departmentLabel: deptConfig.label,
    departmentBadge: deptConfig.badge,
    canWrite: isOrganizationMember ? deptConfig.canWrite : false,
    allowedRoutes: isOrganizationMember ? deptConfig.allowedRoutes : [],
    defaultRoute: isOrganizationMember ? deptConfig.defaultRoute : null,
    app_metadata: {
      department: department || 'b2c_customer',
      org_id: orgId,
      org_role: orgRole,
      roles: isOrganizationMember ? deptConfig.mappedRoles : []
    }
  };
}

/**
 * ERP API Endpoint Yetkilendirme Middleware'i:
 * 1. Giriş yapmamış kullanıcıları (401) reddeder.
 * 2. Global Kapak Mobilya Clerk Organization üyeliği (orgId) olmayan bireysel B2C müşterilerini (403) kesinlikle reddeder.
 * 3. 'viewer' departmanındaki kullanıcıların oluşturma/düzenleme/silme (POST/PUT/PATCH/DELETE) isteklerini (403) reddeder.
 * 4. Kullanıcının publicMetadata.department yetkisini ilgili modülün izin verilen rolleriyle eşleştirir.
 */
export async function authenticateRoles(req, allowedRoles = []) {
  const ctx = await resolveClerkAuthContext(req);

  // KURAL 1: Global Kapak Mobilya Clerk Organization (orgId) üyeliği zorunludur!
  if (!ctx.isOrganizationMember) {
    throw httpError(
      'Yetkisiz Erişim: Bireysel müşteri hesapları ERP yönetim paneline erişemez. Lütfen Global Kapak Mobilya kurumsal personel hesabınızla giriş yapın.',
      403,
      'ORG_MEMBERSHIP_REQUIRED'
    );
  }

  // KURAL 2: 'viewer' departmanı yalnızca okuma (GET/HEAD/OPTIONS) yapabilir; hiçbir yazma/silme işlemi yapamaz!
  const method = String(req?.method || 'GET').toUpperCase();
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (ctx.department === 'viewer' && isMutation) {
    throw httpError(
      'Salt Okunur Yetki (Viewer): Hesabınız yalnızca görüntüleme yetkisine sahiptir. Oluşturma, düzenleme veya silme işlemi yapılamaz.',
      403,
      'VIEWER_READ_ONLY'
    );
  }

  // KURAL 3: Admin (org:admin veya department=admin) tüm ERP uçlarına tam erişimlidir
  if (ctx.department === 'admin' || ctx.orgRole === 'org:admin') {
    return ctx;
  }

  // KURAL 4: Departman bazlı modül/uç kontrolü
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const userRoles = ctx.app_metadata?.roles || [];
    const hasMatch = allowedRoles.some(r => userRoles.includes(r) || r === ctx.department);
    if (!hasMatch) {
      throw httpError(
        `Departman Yetki Sınırı: "${ctx.departmentLabel}" departmanı bu modül üzerinde işlem yapma yetkisine sahip değildir.`,
        403,
        'DEPARTMENT_FORBIDDEN'
      );
    }
  }

  return ctx;
}

// ── SUPABASE YARDIMCISI (WEBHOOK & B2C LAZY REGISTRATION SENKRONİZASYONU) ────
async function supabaseServiceFetch(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { ok: false, status: 503, data: null };
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function readSiteSettingJson(key, fallback) {
  const res = await supabaseServiceFetch(`/rest/v1/site_settings?key=eq.${encodeURIComponent(key)}&select=data&limit=1`);
  if (res.ok && Array.isArray(res.data) && res.data[0]?.data) {
    return res.data[0].data;
  }
  return fallback;
}

async function writeSiteSettingJson(key, data) {
  const now = new Date().toISOString();
  await supabaseServiceFetch('/rest/v1/site_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, data, updated_at: now })
  });
}

/**
 * ERP Personel Kaydını Supabase `erp_users` tablosuna ve `site_settings('erp_users_store')` deposuna senkronize eder.
 */
export async function syncErpUserToSupabase(userRecord) {
  const now = new Date().toISOString();
  const normalizedDept = normalizeDepartment(userRecord.department, userRecord.org_role) || 'viewer';
  const row = {
    clerk_user_id: String(userRecord.clerk_user_id || userRecord.id || '').trim(),
    email: String(userRecord.email || '').trim(),
    username: String(userRecord.username || '').trim(),
    full_name: String(userRecord.full_name || userRecord.fullName || userRecord.username || '').trim(),
    avatar_url: String(userRecord.avatar_url || userRecord.avatarUrl || '').trim(),
    org_id: String(userRecord.org_id || userRecord.orgId || GLOBAL_KAPAK_ORG_ID).trim(),
    org_slug: String(userRecord.org_slug || userRecord.orgSlug || 'global-kapak-mobilya').trim(),
    org_role: String(userRecord.org_role || userRecord.orgRole || 'org:member').trim(),
    department: normalizedDept,
    public_metadata: userRecord.public_metadata || userRecord.publicMetadata || { department: normalizedDept },
    is_active: userRecord.is_active !== false,
    last_synced_at: now,
    updated_at: now
  };
  if (!row.clerk_user_id) return null;

  // 1. İlişkisel `erp_users` tablosuna upsert dene
  await supabaseServiceFetch('/rest/v1/erp_users', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row)
  }).catch(() => {});

  // 2. Her koşulda `site_settings('erp_users_store')` içinde de güncel tut
  const store = await readSiteSettingJson('erp_users_store', { users: {} });
  if (!store.users) store.users = {};
  store.users[row.clerk_user_id] = row;
  store.updated_at = now;
  await writeSiteSettingJson('erp_users_store', store);

  return row;
}

/**
 * B2C Vitrin Müşterisini (Organizasyona eklemeden!) doğrudan Supabase `crm_customers` tablosuna
 * ve `site_settings('crm_customers_store')` deposuna kaydeder.
 */
export async function upsertCrmCustomerToSupabase(customerInput) {
  const now = new Date().toISOString();
  const clerkId = String(customerInput.clerk_user_id || customerInput.clerkUserId || '').trim() || null;
  const email = String(customerInput.email || '').trim() || null;
  const fullName = String(customerInput.full_name || customerInput.name || 'Müşteri').trim();
  const phone = String(customerInput.phone || '').trim() || null;
  const city = String(customerInput.city || '').trim() || null;
  const interestedModel = String(customerInput.interested_model || customerInput.collection_id || customerInput.model || '').trim() || null;
  const notes = String(customerInput.notes || '').trim() || null;
  const quoteRef = String(customerInput.reference_code || '').trim()
    || (`GM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);

  const customerRecord = {
    clerk_user_id: clerkId,
    email,
    full_name: fullName,
    phone,
    city,
    interested_model: interestedModel,
    latest_quote_ref: quoteRef,
    notes,
    source: customerInput.source || 'b2c_lazy_quote',
    stage: customerInput.stage || 'Yeni Teklif Talebi',
    assigned_department: 'sales',
    metadata: {
      ...(customerInput.metadata || {}),
      from_b2c_storefront: true,
      organization_member: false,
      updated_at: now
    },
    last_active_at: now,
    updated_at: now
  };

  // 1. Eğer `crm_customers` tablosu mevcutsa oraya upsert et
  if (clerkId) {
    await supabaseServiceFetch(`/rest/v1/crm_customers?on_conflict=clerk_user_id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(customerRecord)
    }).catch(() => {});
  } else {
    await supabaseServiceFetch('/rest/v1/crm_customers', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(customerRecord)
    }).catch(() => {});
  }

  // 2. Aynı zamanda `site_settings('crm_customers_store')` içinde de tut (CRM ekranının anında okuması için)
  const store = await readSiteSettingJson('crm_customers_store', { customers: [], quotes: [] });
  if (!Array.isArray(store.customers)) store.customers = [];
  if (!Array.isArray(store.quotes)) store.quotes = [];

  const existingIdx = store.customers.findIndex(c =>
    (clerkId && c.clerk_user_id === clerkId) ||
    (email && c.email && c.email.toLowerCase() === email.toLowerCase())
  );

  const persistedCustomer = {
    id: existingIdx >= 0 ? store.customers[existingIdx].id : `CRM-${Date.now().toString(36).toUpperCase()}`,
    created_at: existingIdx >= 0 ? store.customers[existingIdx].created_at : now,
    ...customerRecord
  };

  if (existingIdx >= 0) {
    store.customers[existingIdx] = persistedCustomer;
  } else {
    store.customers.unshift(persistedCustomer);
  }

  if (interestedModel || notes || phone) {
    store.quotes.unshift({
      reference_code: quoteRef,
      clerk_user_id: clerkId,
      customer_name: fullName,
      customer_email: email,
      customer_phone: phone,
      customer_city: city,
      collection_id: interestedModel,
      notes,
      status: 'new',
      created_at: now
    });
  }

  store.updated_at = now;
  await writeSiteSettingJson('crm_customers_store', store);

  return {
    ok: true,
    reference_code: quoteRef,
    customer: persistedCustomer
  };
}

// ── SVIX İMZA DOĞRULAYICI VE CLERK WEBHOOK İŞLEYİCİSİ (/api/webhooks/clerk) ──
export function verifySvixWebhookSignature(rawBody, headers) {
  const svixId = headers['svix-id'] || headers['Svix-Id'];
  const svixTimestamp = headers['svix-timestamp'] || headers['Svix-Timestamp'];
  const svixSignature = headers['svix-signature'] || headers['Svix-Signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw httpError('Eksik Svix webhook başlıkları (svix-id, svix-timestamp, svix-signature).', 400);
  }

  const tsNum = Number(svixTimestamp);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Number.isNaN(tsNum) || Math.abs(nowSec - tsNum) > 300) {
    throw httpError('Svix webhook zaman damgası geçersiz veya süresi geçmiş.', 400);
  }

  const cleanSecret = CLERK_WEBHOOK_SECRET.replace(/^whsec_/, '');
  const secretBytes = Buffer.from(cleanSecret, 'base64');
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSigBase64 = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent, 'utf8')
    .digest('base64');

  const expectedBuf = Buffer.from(expectedSigBase64, 'utf8');
  const candidateSigs = String(svixSignature)
    .split(' ')
    .map(part => part.trim().split(',')[1])
    .filter(Boolean);

  const matched = candidateSigs.some(sig => {
    const sigBuf = Buffer.from(sig, 'utf8');
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });

  if (!matched) {
    throw httpError('Svix webhook imzası doğrulanamadı (Invalid signature).', 401);
  }
  return true;
}

export async function handleClerkWebhookRequest(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const rawBody = typeof req.body === 'string'
    ? req.body
    : (req.rawBody ? String(req.rawBody) : JSON.stringify(req.body || {}));

  try {
    verifySvixWebhookSignature(rawBody, req.headers || {});
  } catch (sigErr) {
    return res.status(sigErr.status || 400).json({ ok: false, error: sigErr.message });
  }

  const evt = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody);
  const eventType = String(evt.type || '').trim();
  const data = evt.data || {};

  // Kullanıcı önbelleğini temizle ki rol/departman değişiklikleri anında yansısın
  if (data.id) userProfileCache.delete(data.id);
  if (data.public_user_data?.user_id) userProfileCache.delete(data.public_user_data.user_id);

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const clerkUserId = data.id;
    const primaryEmail = (data.email_addresses || []).find(e => e.id === data.primary_email_address_id)?.email_address
      || data.email_addresses?.[0]?.email_address
      || '';
    const primaryPhone = (data.phone_numbers || [])[0]?.phone_number || '';
    const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
      || data.username
      || primaryEmail
      || clerkUserId;
    const pubMeta = data.public_metadata || {};

    // Clerk API'den kullanıcının kurum üyeliğini kontrol et
    const fullProfile = await fetchClerkUserAndOrgFromApi(clerkUserId);

    if (fullProfile?.isOrganizationMember || pubMeta.department) {
      const syncedErp = await syncErpUserToSupabase({
        clerk_user_id: clerkUserId,
        email: primaryEmail,
        username: data.username || '',
        full_name: fullName,
        avatar_url: data.image_url || '',
        org_id: fullProfile?.orgId || GLOBAL_KAPAK_ORG_ID,
        org_slug: fullProfile?.orgSlug || 'global-kapak-mobilya',
        org_role: fullProfile?.orgRole || 'org:member',
        department: pubMeta.department || 'viewer',
        public_metadata: pubMeta
      });
      return res.status(200).json({ ok: true, event: eventType, target: 'erp_users', user: syncedErp });
    } else {
      // Organizasyon üyesi olmayan bireysel B2C vitrin müşterisi -> crm_customers tablosuna kaydet
      const syncedCrm = await upsertCrmCustomerToSupabase({
        clerk_user_id: clerkUserId,
        email: primaryEmail,
        full_name: fullName,
        phone: primaryPhone,
        source: 'clerk_webhook_b2c',
        metadata: pubMeta
      });
      return res.status(200).json({ ok: true, event: eventType, target: 'crm_customers', customer: syncedCrm.customer });
    }
  }

  if (eventType === 'organizationMembership.created' || eventType === 'organizationMembership.updated') {
    const clerkUserId = data.public_user_data?.user_id || data.user_id;
    const orgId = data.organization?.id || GLOBAL_KAPAK_ORG_ID;
    const orgSlug = data.organization?.slug || 'global-kapak-mobilya';
    const orgRole = data.role || 'org:member';

    const fullProfile = await fetchClerkUserAndOrgFromApi(clerkUserId);
    const dept = fullProfile?.publicMetadata?.department || (orgRole === 'org:admin' ? 'admin' : 'viewer');

    const syncedErp = await syncErpUserToSupabase({
      clerk_user_id: clerkUserId,
      email: fullProfile?.email || data.public_user_data?.identifier || '',
      username: fullProfile?.username || data.public_user_data?.identifier || '',
      full_name: fullProfile?.fullName || [data.public_user_data?.first_name, data.public_user_data?.last_name].filter(Boolean).join(' ') || clerkUserId,
      avatar_url: fullProfile?.avatarUrl || data.public_user_data?.image_url || '',
      org_id: orgId,
      org_slug: orgSlug,
      org_role: orgRole,
      department: dept,
      public_metadata: fullProfile?.publicMetadata || { department: dept }
    });

    return res.status(200).json({ ok: true, event: eventType, target: 'erp_users', user: syncedErp });
  }

  return res.status(200).json({ ok: true, event: eventType, ignored: true });
}

export function apiError(res, error, label = 'API') {
  const status = error.status || 500;
  if (status >= 500) console.error(`[${label}]`, error);
  return res.status(status).json({
    ok: false,
    code: error.code || null,
    error: status >= 500 ? 'İşlem tamamlanamadı. Sunucu yapılandırmasını kontrol edin.' : error.message
  });
}

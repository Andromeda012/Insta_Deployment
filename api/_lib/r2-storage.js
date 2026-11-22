// ============================================================================
// NOVA FURNITURE — CLOUDFLARE R2 OBJECT STORAGE ADAPTER (AWS SigV4 / S3 API)
// Zero-dependency native Node.js crypto + fetch implementation for Vercel & VPS
// ============================================================================

import crypto from 'node:crypto';

const DEFAULT_CF_ACCOUNT_ID = 'acc85eed4fc7ca291657dcb808fc5578';
const DEFAULT_R2_ACCESS_KEY_ID = 'c72c243d6b276174be73b547d630928c';
const DEFAULT_R2_SECRET_ACCESS_KEY = '99a211277c8f991dda629f84378432d7d4f8242685962d3ae3fc0b0e4d57f39d';
const DEFAULT_R2_BUCKET_NAME = 'globalkapak-medya';
const DEFAULT_R2_PUBLIC_BASE_URL = 'https://cdn.globalkapakmobilya.com';
const DEFAULT_PUBLIC_APP_ORIGIN = 'https://erp.globalkapakmobilya.com';

export function getR2Config() {
  const accountId = (process.env.CF_ACCOUNT_ID || DEFAULT_CF_ACCOUNT_ID).trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || DEFAULT_R2_ACCESS_KEY_ID).trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || DEFAULT_R2_SECRET_ACCESS_KEY).trim();
  const bucketName = (process.env.R2_BUCKET_NAME || DEFAULT_R2_BUCKET_NAME).trim();
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;
  const envPublicBase = (process.env.R2_PUBLIC_BASE_URL || process.env.R2_CUSTOM_PUBLIC_DOMAIN || '').trim().replace(/\/+$/, '');
  const rawPublicBase = (envPublicBase && !envPublicBase.includes('.r2.cloudflarestorage.com'))
    ? envPublicBase
    : DEFAULT_R2_PUBLIC_BASE_URL;
  const hasCustomPublicDomain = Boolean(
    rawPublicBase &&
    !rawPublicBase.includes('.r2.cloudflarestorage.com')
  );
  const appOrigin = (process.env.PUBLIC_APP_ORIGIN || process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${String(process.env.PUBLIC_APP_ORIGIN || process.env.VERCEL_PROJECT_PRODUCTION_URL).replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
    : DEFAULT_PUBLIC_APP_ORIGIN);

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    host,
    endpoint,
    rawPublicBase: rawPublicBase || endpoint,
    hasCustomPublicDomain,
    appOrigin
  };
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSigningKey(secretAccessKey, dateStamp, region = 'auto', service = 's3') {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeS3UriPath(pathStr) {
  return String(pathStr || '')
    .split('/')
    .map(seg => encodeRfc3986(seg))
    .join('/');
}

/**
 * Her türlü dosya yolu veya eski Supabase URL'sini temiz R2 Object Key'e dönüştürür.
 */
export function normalizeR2Key(rawInput) {
  let s = String(rawInput || '').trim();
  if (!s) return '';

  // Eğer tam URL verilmişse içinden key'i ayıkla
  const extracted = extractR2KeyFromUrl(s);
  if (extracted) s = extracted;

  s = s.replace(/^\/+/, '');
  const { bucketName } = getR2Config();
  if (s.startsWith(`${bucketName}/`)) {
    s = s.slice(bucketName.length + 1);
  }
  if (s.startsWith('storage/v1/object/public/media/')) {
    s = s.slice('storage/v1/object/public/media/'.length);
  }
  if (s.startsWith('storage/v1/object/media/')) {
    s = s.slice('storage/v1/object/media/'.length);
  }
  return s.replace(/^\/+/, '');
}

/**
 * Bir URL eğer R2 veya eski Supabase Storage URL'si ise R2 Object Key'ini döner.
 */
export function extractR2KeyFromUrl(urlStr) {
  const raw = String(urlStr || '').trim();
  if (!raw) return null;

  try {
    if (raw.startsWith('/r2/')) {
      return decodeURIComponent(raw.slice(4).split('?')[0]);
    }
    if (raw.includes('action=r2-media') && raw.includes('key=')) {
      const qIdx = raw.indexOf('?');
      if (qIdx !== -1) {
        const params = new URLSearchParams(raw.slice(qIdx + 1));
        const k = params.get('key');
        if (k) return k.replace(/^\/+/, '');
      }
    }
    if (!/^https?:\/\//i.test(raw)) return null;

    const u = new URL(raw);
    if (u.searchParams.get('action') === 'r2-media' && u.searchParams.get('key')) {
      return u.searchParams.get('key').replace(/^\/+/, '');
    }
    if (u.pathname.startsWith('/r2/')) {
      return decodeURIComponent(u.pathname.slice(4)).replace(/^\/+/, '');
    }
    if (u.hostname.endsWith('.r2.cloudflarestorage.com')) {
      const { bucketName } = getR2Config();
      let p = decodeURIComponent(u.pathname).replace(/^\/+/, '');
      if (p.startsWith(`${bucketName}/`)) p = p.slice(bucketName.length + 1);
      return p;
    }
    const supaMatch = u.pathname.match(/\/storage\/v1\/object\/(?:public\/)?media\/(.+)$/i);
    if (supaMatch && supaMatch[1]) {
      return decodeURIComponent(supaMatch[1]).replace(/^\/+/, '');
    }
  } catch (_) {}
  return null;
}

/**
 * AWS Signature V4 ile imzalanmış Presigned URL (GET veya PUT) üretir.
 * Maksimum geçerlilik süresi S3 standardına göre 7 gündür (604800 saniye).
 */
export function createR2PresignedUrl(objectKey, method = 'GET', expiresInSec = 604800) {
  const cfg = getR2Config();
  const cleanKey = normalizeR2Key(objectKey);
  if (!cleanKey) throw new Error('R2 objectKey boş olamaz.');

  const clampedExpires = Math.max(1, Math.min(604800, Math.floor(Number(expiresInSec) || 604800)));
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalUri = `/${encodeRfc3986(cfg.bucketName)}/${encodeS3UriPath(cleanKey)}`;

  const queryEntries = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${cfg.accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(clampedExpires)],
    ['X-Amz-SignedHeaders', 'host']
  ];
  queryEntries.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalQueryString = queryEntries
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join('&');

  const canonicalHeaders = `host:${cfg.host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const signingKey = getSigningKey(cfg.secretAccessKey, dateStamp);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  return `${cfg.endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

/**
 * Nesne için genel erişim URL'si üretir:
 * - Eğer özel alan adı (örn. https://cdn.globalkapakmobilya.com) tanımlıysa doğrudan onu döner.
 * - `preferPresigned=true` ise (Meta/TikTok/YouTube API'lerine doğrudan R2 üzerinden medya gönderirken) 7 günlük doğrudan R2 Presigned URL döner.
 * - Kalıcı veritabanı kayıtları (ürün/koleksiyon görselleri, 3D modeller) için süresi asla dolmayan `/r2/<key>` CDN ağ geçidi URL'sini döner.
 */
export function getR2PublicUrl(objectKey, { preferPresigned = false, expiresInSec = 604800 } = {}) {
  const cfg = getR2Config();
  const cleanKey = normalizeR2Key(objectKey);
  if (!cleanKey) return '';

  if (cfg.hasCustomPublicDomain) {
    return `${cfg.rawPublicBase}/${encodeS3UriPath(cleanKey)}`;
  }
  if (preferPresigned) {
    return createR2PresignedUrl(cleanKey, 'GET', expiresInSec);
  }
  return `${cfg.appOrigin}/r2/${encodeS3UriPath(cleanKey)}`;
}

/**
 * İmzalı S3 HTTP isteği gönderir (PUT, GET, HEAD, DELETE).
 */
async function signedR2Fetch({ method, objectKey = '', query = {}, headers = {}, body = null, timeoutMs = 120000 }) {
  const cfg = getR2Config();
  const cleanKey = objectKey ? normalizeR2Key(objectKey) : '';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  const canonicalUri = cleanKey
    ? `/${encodeRfc3986(cfg.bucketName)}/${encodeS3UriPath(cleanKey)}`
    : `/${encodeRfc3986(cfg.bucketName)}`;

  const queryKeys = Object.keys(query).filter(k => query[k] !== undefined && query[k] !== null).sort();
  const canonicalQueryString = queryKeys
    .map(k => `${encodeRfc3986(k)}=${encodeRfc3986(String(query[k]))}`)
    .join('&');

  const payloadBuf = body
    ? (Buffer.isBuffer(body) ? body : Buffer.from(body))
    : Buffer.alloc(0);
  const payloadHash = sha256Hex(payloadBuf);

  const normHeaders = {
    host: cfg.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  };
  for (const [hk, hv] of Object.entries(headers)) {
    if (hv !== undefined && hv !== null) {
      normHeaders[hk.toLowerCase()] = String(hv).trim();
    }
  }

  const sortedHeaderNames = Object.keys(normHeaders).sort();
  const canonicalHeaders = sortedHeaderNames.map(k => `${k}:${normHeaders[k]}\n`).join('');
  const signedHeaders = sortedHeaderNames.join(';');

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const signingKey = getSigningKey(cfg.secretAccessKey, dateStamp);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const reqHeaders = { ...normHeaders, Authorization: authHeader };
  delete reqHeaders.host;

  const fullUrl = `${cfg.endpoint}${canonicalUri}${canonicalQueryString ? `?${canonicalQueryString}` : ''}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(fullUrl, {
      method: method.toUpperCase(),
      headers: reqHeaders,
      body: (method === 'GET' || method === 'HEAD' || method === 'DELETE') ? undefined : payloadBuf,
      signal: ctrl.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Buffer veya Uint8Array verisini Cloudflare R2'ye yükler.
 */
export async function uploadBufferToR2(objectKey, buffer, contentType = 'application/octet-stream', {
  cacheControl = 'public, max-age=31536000, immutable',
  preferPresignedUrl = false,
  expiresInSec = 604800
} = {}) {
  const cleanKey = normalizeR2Key(objectKey);
  if (!cleanKey) throw new Error('R2 yükleme için geçerli bir objectKey gerekli.');
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  const res = await signedR2Fetch({
    method: 'PUT',
    objectKey: cleanKey,
    headers: {
      'content-type': contentType || 'application/octet-stream',
      'cache-control': cacheControl
    },
    body: buf
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Cloudflare R2 PUT hatası (${res.status} - ${cleanKey}): ${errText.slice(0, 300)}`);
  }

  const etag = (res.headers.get('etag') || '').replace(/"/g, '');
  const permanentUrl = getR2PublicUrl(cleanKey, { preferPresigned: false });
  const presignedGetUrl = createR2PresignedUrl(cleanKey, 'GET', expiresInSec);

  return {
    ok: true,
    key: cleanKey,
    publicUrl: preferPresignedUrl ? presignedGetUrl : permanentUrl,
    permanentUrl,
    presignedGetUrl,
    sizeBytes: buf.length,
    contentType,
    etag
  };
}

/**
 * Cloudflare R2'den dosyayı Buffer olarak indirir.
 */
export async function downloadBufferFromR2(objectKey) {
  const cleanKey = normalizeR2Key(objectKey);
  if (!cleanKey) throw new Error('R2 indirme için objectKey gerekli.');

  const res = await signedR2Fetch({
    method: 'GET',
    objectKey: cleanKey
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Cloudflare R2 GET hatası (${res.status} - ${cleanKey}): ${errText.slice(0, 240)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const cacheControl = res.headers.get('cache-control') || 'public, max-age=31536000, immutable';
  const etag = res.headers.get('etag') || '';

  return {
    ok: true,
    key: cleanKey,
    buffer,
    sizeBytes: buffer.length,
    contentType,
    cacheControl,
    etag
  };
}

/**
 * Cloudflare R2'de dosyanın var olup olmadığını ve boyut/tür bilgisini kontrol eder.
 */
export async function headR2Object(objectKey) {
  const cleanKey = normalizeR2Key(objectKey);
  if (!cleanKey) return { exists: false };

  const res = await signedR2Fetch({
    method: 'HEAD',
    objectKey: cleanKey,
    timeoutMs: 15000
  });

  if (res.status === 404) return { exists: false, key: cleanKey };
  if (!res.ok) return { exists: false, key: cleanKey, status: res.status };

  return {
    exists: true,
    key: cleanKey,
    sizeBytes: Number(res.headers.get('content-length') || 0),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    etag: (res.headers.get('etag') || '').replace(/"/g, ''),
    lastModified: res.headers.get('last-modified') || null
  };
}

/**
 * Cloudflare R2'den dosya siler.
 */
export async function deleteR2Object(objectKey) {
  const cleanKey = normalizeR2Key(objectKey);
  if (!cleanKey) return { ok: false };

  const res = await signedR2Fetch({
    method: 'DELETE',
    objectKey: cleanKey,
    timeoutMs: 20000
  });

  return {
    ok: res.ok || res.status === 204 || res.status === 404,
    status: res.status,
    key: cleanKey
  };
}

/**
 * Cloudflare R2 üzerinde belirli bir prefix altındaki dosyaları listeler.
 */
export async function listR2Objects(prefix = '', maxKeys = 1000) {
  const cleanPrefix = String(prefix || '').replace(/^\/+/, '');
  const res = await signedR2Fetch({
    method: 'GET',
    query: {
      'list-type': '2',
      ...(cleanPrefix ? { prefix: cleanPrefix } : {}),
      'max-keys': String(maxKeys)
    },
    timeoutMs: 30000
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Cloudflare R2 LIST hatası (${res.status}): ${errText.slice(0, 240)}`);
  }

  const xml = await res.text();
  const items = [];
  const contentsRe = /<Contents>([\s\S]*?)<\/Contents>/g;
  let m;
  while ((m = contentsRe.exec(xml)) !== null) {
    const block = m[1];
    const keyMatch = block.match(/<Key>([\s\S]*?)<\/Key>/);
    const sizeMatch = block.match(/<Size>(\d+)<\/Size>/);
    const modMatch = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/);
    if (keyMatch && keyMatch[1]) {
      const key = keyMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      items.push({
        key,
        sizeBytes: sizeMatch ? Number(sizeMatch[1]) : 0,
        lastModified: modMatch ? modMatch[1] : null,
        publicUrl: getR2PublicUrl(key),
        presignedGetUrl: createR2PresignedUrl(key, 'GET', 604800)
      });
    }
  }
  return items;
}

export default {
  getR2Config,
  normalizeR2Key,
  extractR2KeyFromUrl,
  createR2PresignedUrl,
  getR2PublicUrl,
  uploadBufferToR2,
  downloadBufferFromR2,
  headR2Object,
  deleteR2Object,
  listR2Objects
};

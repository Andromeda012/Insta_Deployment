import GeminiBananaEngine, { buildGeminiBananaPrompt } from '../Module 2/gemini-banana-engine.js';
import CampaignStudioEngine, {
  CONTENT_ITEM_STATUSES,
  CONTENT_STATUS_LABELS_TR,
  TIKTOK_CONNECTION_STATES,
  MEDIA_CATEGORIES,
  MARKETING_PROFILE_OPTIONS,
  PLATFORM_PACKAGE_DEFINITIONS,
  PLATFORM_CAPABILITY_MATRIX,
  buildLayeredCampaignPrompt,
  createProductVersionSnapshot,
  buildMarketingStrategyAndPlan,
  generateCampaignDeliverables
} from '../Module 2/campaign-studio-engine.js';
import { createHash, randomUUID } from 'node:crypto';
import {
  authenticateModule2Admin,
  authorizeVercelCron,
  supabaseAdminRequest,
  sendApiError,
  istanbulDateParts
} from './_lib/module2-publishing.js';

const STATE_KEYS = new Set([
  'insta_bot_state',
  'fb_bot_state',
  'tt_bot_state',
  'yt_bot_state',
  'instagram_published_tracker',
  'facebook_published_tracker',
  'youtube_published_tracker',
  'module2_campaigns_store'
]);

const ALLOWED_TYPES = {
  instagram: new Set(['POST', 'REELS', 'STORIES', 'CAROUSEL']),
  facebook: new Set(['PHOTO_POST', 'FB_STORIES', 'LINK_CARD', 'FB_REELS', 'PHOTO_ALBUM']),
  tiktok: new Set(['TIKTOK_VIDEO', 'TIKTOK_PHOTO_CAROUSEL']),
  youtube: new Set(['SHORTS', 'SHORTS_CNC', 'SHORTS_SHOWCASE', 'SHORTS_GUIDE', 'COMMUNITY_POST'])
};

const CAMPAIGNS_STORE_KEY = 'module2_campaigns_store';
const EXTENDED_CATALOG_KEY = 'module7_extended_catalog';
const AI_STUDIO_KEY = 'ai_studio_profiles';

function validHttpsUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && value.length <= 2048;
  } catch {
    return false;
  }
}

function actionOf(req) {
  return String(
    req.query?.action ||
    new URL(req.url, 'https://local.invalid').searchParams.get('action') ||
    ''
  ).toLowerCase();
}

// ── TIKTOK BAĞLANTI DURUMU DEĞERLENDİRİCİSİ (BÖLÜM 3.1) ──────────────────────
function evaluateTikTokConnectionStatus(ttBotConfig = {}) {
  const clientKey = (process.env.TIKTOK_CLIENT_KEY || ttBotConfig.clientKey || '').trim();
  const clientSecret = (process.env.TIKTOK_CLIENT_SECRET || ttBotConfig.clientSecret || '').trim();
  const accessToken = (process.env.TIKTOK_ACCESS_TOKEN || ttBotConfig.accessToken || '').trim();
  const openId = (process.env.TIKTOK_OPEN_ID || ttBotConfig.openId || '').trim();
  const isPlaceholder = val => !val || val.includes('YOUR_') || val.includes('placeholder') || val.length < 6;

  if (isPlaceholder(clientKey) && isPlaceholder(accessToken)) {
    return TIKTOK_CONNECTION_STATES.MISSING_CREDENTIALS;
  }
  if (isPlaceholder(accessToken) || isPlaceholder(openId)) {
    return TIKTOK_CONNECTION_STATES.AWAITING_OAUTH;
  }
  if (!ttBotConfig.connectionVerified) {
    return TIKTOK_CONNECTION_STATES.UNVERIFIED;
  }
  return TIKTOK_CONNECTION_STATES.READY;
}

// ── PLATFORM BAĞLANTI SAĞLIĞI VE GÜVENLİ DOĞRULAMA (BÖLÜM 3) ────────────────
async function handlePlatformHealth(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateModule2Admin(req);

  // Son başarılı yayın görevlerini ve bot durumlarını oku
  const [queueTasks, ttStateRows] = await Promise.all([
    supabaseAdminRequest('/rest/v1/social_publish_queue?select=id,platform,status,platform_post_id,published_at,error_message,updated_at&order=updated_at.desc&limit=50').catch(() => []),
    supabaseAdminRequest('/rest/v1/site_settings?key=eq.tt_bot_state&select=data&limit=1').catch(() => [])
  ]);

  const tasks = Array.isArray(queueTasks) ? queueTasks : [];
  const ttConfig = ttStateRows?.[0]?.data?.config || {};
  const ttStatus = evaluateTikTokConnectionStatus(ttConfig);

  const lastPublishedFor = plat => tasks.find(t => t.platform === plat && t.status === 'published') || null;
  const igLast = lastPublishedFor('instagram');
  const fbLast = lastPublishedFor('facebook');
  const ytLast = lastPublishedFor('youtube');

  const igEnvPresent = Boolean(process.env.META_IG_USER_ID && process.env.META_IG_ACCESS_TOKEN);
  const fbEnvPresent = Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN);
  const ytEnvPresent = Boolean(
    (process.env.YOUTUBE_CLIENT_ID || process.env.YT_CLIENT_ID) &&
    (process.env.YOUTUBE_CLIENT_SECRET || process.env.YT_CLIENT_SECRET) &&
    (process.env.YOUTUBE_REFRESH_TOKEN || process.env.YT_REFRESH_TOKEN)
  );

  return res.status(200).json({
    ok: true,
    checked_at: new Date().toISOString(),
    platforms: {
      instagram: {
        platform: 'instagram',
        name: 'Instagram Graph API',
        status: (igEnvPresent || igLast) ? 'ready' : 'configured_on_vps_worker',
        label: igLast ? 'Bağlantı hazır (Yayın doğrulandı)' : 'VPS Publisher üzerinde aktif',
        can_publish: true,
        last_published_at: igLast?.published_at || null,
        last_post_id: igLast?.platform_post_id || null
      },
      facebook: {
        platform: 'facebook',
        name: 'Facebook Page Graph API',
        status: (fbEnvPresent || fbLast) ? 'ready' : 'configured_on_vps_worker',
        label: fbLast ? 'Bağlantı hazır (Yayın doğrulandı)' : 'VPS Publisher üzerinde aktif',
        can_publish: true,
        last_published_at: fbLast?.published_at || null,
        last_post_id: fbLast?.platform_post_id || null
      },
      youtube: {
        platform: 'youtube',
        name: 'YouTube Data API v3',
        status: (ytEnvPresent || ytLast) ? 'ready' : 'configured_on_vps_worker',
        label: ytLast ? 'Bağlantı hazır (Shorts yayını doğrulandı)' : 'VPS Publisher üzerinde aktif',
        can_publish: true,
        last_published_at: ytLast?.published_at || null,
        last_post_id: ytLast?.platform_post_id || null
      },
      tiktok: {
        platform: 'tiktok',
        name: 'TikTok Content Posting API v2',
        status: ttStatus.code,
        label: ttStatus.label,
        can_publish: ttStatus.canPublish,
        description: ttStatus.description,
        available_states: Object.values(TIKTOK_CONNECTION_STATES).map(s => ({
          code: s.code,
          label: s.label
        }))
      }
    }
  });
}

// ── KAMPANYA DEPOSU OKUMA / YAZMA YARDIMCILARI ───────────────────────────────
async function readCampaignsStore() {
  try {
    const rows = await supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${CAMPAIGNS_STORE_KEY}&select=data&limit=1`);
    const d = rows?.[0]?.data;
    return {
      campaigns: Array.isArray(d?.campaigns) ? d.campaigns : [],
      items: Array.isArray(d?.items) ? d.items : [],
      scenes: Array.isArray(d?.scenes) ? d.scenes : [],
      logs: Array.isArray(d?.logs) ? d.logs : []
    };
  } catch {
    return { campaigns: [], items: [], scenes: [], logs: [] };
  }
}

async function writeCampaignsStore(store) {
  await supabaseAdminRequest('/rest/v1/site_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      key: CAMPAIGNS_STORE_KEY,
      data: store,
      updated_at: new Date().toISOString()
    })
  });
}

// ── PANEL KUYRUĞU SENKRONİZASYONU (MEVCUT BOTLARLA %100 UYUMLU) ──────────────
async function syncPanelQueue(task, payload) {
  if (!task?.id) return;
  const map = {
    instagram: ['insta_bot_state', 'scheduled_posts'],
    facebook: ['fb_bot_state', 'scheduled_posts'],
    tiktok: ['tt_bot_state', 'scheduledQueue'],
    youtube: ['yt_bot_state', 'scheduled_posts']
  };
  const target = map[payload.platform];
  if (!target) return;
  const [key, listKey] = target;
  const rows = await supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${key}&select=data&limit=1`);
  const state = rows?.[0]?.data || { config: {}, [listKey]: [] };
  const list = Array.isArray(state[listKey]) ? state[listKey] : [];
  const common = {
    queue_task_id: task.id,
    queue_idempotency_key: payload.idempotency_key,
    idempotency_key: payload.idempotency_key,
    content_type: payload.content_type,
    media_url: payload.media_url,
    scheduled_for: task.scheduled_for || payload.scheduled_for,
    status: task.status || 'pending',
    product_slug: payload.product_slug || null,
    campaign_id: payload.campaign_id || null,
    campaign_item_id: payload.campaign_item_id || null,
    caption: payload.caption || '',
    hashtags: payload.hashtags || ''
  };
  const item = payload.platform === 'tiktok'
    ? {
        ...common,
        id: `tt_queue_${task.id}`,
        format: payload.content_type,
        productSku: payload.product_sku || '',
        productTitle: payload.title || 'TikTok içeriği',
        mediaUrl: payload.media_url
      }
    : {
        ...common,
        id: task.id,
        media_type: payload.content_type,
        title: payload.title || `${payload.platform} içeriği`,
        description: payload.caption || '',
        target_link: payload.target_link || null
      };
  const index = list.findIndex(
    p => p.queue_task_id === task.id || p.queue_idempotency_key === payload.idempotency_key || p.idempotency_key === payload.idempotency_key
  );
  if (index >= 0) list[index] = { ...list[index], ...item };
  else list.unshift(item);
  state[listKey] = list.slice(0, 60);
  await supabaseAdminRequest('/rest/v1/site_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, data: state, updated_at: new Date().toISOString() })
  });
}

async function removePanelQueueItem(task) {
  const map = {
    instagram: ['insta_bot_state', 'scheduled_posts'],
    facebook: ['fb_bot_state', 'scheduled_posts'],
    tiktok: ['tt_bot_state', 'scheduledQueue'],
    youtube: ['yt_bot_state', 'scheduled_posts']
  };
  const target = map[task.platform];
  if (!target) return;
  const [key, listKey] = target;
  const rows = await supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${key}&select=data&limit=1`);
  if (!rows?.[0]?.data) return;
  const state = rows[0].data;
  const items = Array.isArray(state[listKey]) ? state[listKey] : [];
  state[listKey] = items.filter(
    p => p.queue_task_id !== task.id && p.queue_idempotency_key !== task.idempotency_key && p.idempotency_key !== task.idempotency_key
  );
  await supabaseAdminRequest('/rest/v1/site_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, data: state, updated_at: new Date().toISOString() })
  });
}

// ── 1. STATE HANDLER (MEVCUT SÖZLEŞME %100 KORUNDU) ──────────────────────────
async function handleState(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateModule2Admin(req);
  if (req.method === 'GET') {
    const key = String(req.query?.key || new URL(req.url, 'https://local.invalid').searchParams.get('key') || '');
    if (!STATE_KEYS.has(key)) return res.status(400).json({ ok: false, error: 'Unsupported Module 2 state key.' });
    const rows = await supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${encodeURIComponent(key)}&select=data,updated_at&limit=1`);
    return res.status(200).json({ ok: true, key, data: rows?.[0]?.data ?? null, updated_at: rows?.[0]?.updated_at ?? null });
  }
  const b = req.body || {}, key = String(b.key || ''), data = b.data;
  if (!STATE_KEYS.has(key)) return res.status(400).json({ ok: false, error: 'Unsupported Module 2 state key.' });
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ ok: false, error: 'State data must be a JSON object.' });
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 750000) return res.status(413).json({ ok: false, error: 'State payload is too large.' });
  await supabaseAdminRequest('/rest/v1/site_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, data, updated_at: new Date().toISOString() })
  });
  return res.status(200).json({ ok: true, key, saved: true });
}

// ── 2. ENQUEUE HANDLER (TIKTOK BAĞLANTI KORUMASI EKLENDİ) ────────────────────
async function handleEnqueue(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateModule2Admin(req);
  const b = req.body || {};
  const platform = String(b.platform || '').toLowerCase();
  const contentType = String(b.content_type || '').toUpperCase();
  const mediaUrl = String(b.media_url || '').trim();
  const caption = String(b.caption || '');
  const hashtags = String(b.hashtags || '');
  const scheduledFor = new Date(b.scheduled_for || Date.now());
  const targetLink = b.target_link ? String(b.target_link).trim() : null;

  if (!Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, platform) || !ALLOWED_TYPES[platform].has(contentType)) {
    return res.status(400).json({ ok: false, error: 'Bu platform/içerik türü yayın kuyruğunda desteklenmiyor.' });
  }

  // BÖLÜM 3.1: TikTok bağlantısı hazır değilse gerçek yayın kuyruğuna sokma!
  if (platform === 'tiktok') {
    const ttRows = await supabaseAdminRequest('/rest/v1/site_settings?key=eq.tt_bot_state&select=data&limit=1').catch(() => []);
    const ttState = evaluateTikTokConnectionStatus(ttRows?.[0]?.data?.config || {});
    if (!ttState.canPublish) {
      return res.status(409).json({
        ok: false,
        queued: false,
        status: CONTENT_ITEM_STATUSES.AWAITING_PLATFORM_CONNECTION,
        connection_status: ttState.code,
        connection_label: ttState.label,
        error: `TikTok yayınlama adımı durduruldu: ${ttState.label}. İçerik taslağı ve senaryosu hazırlandı ancak TikTok hesap ve API yetkilendirmesi tamamlanana kadar canlı kuyruğa gönderilmez.`
      });
    }
  }

  const isJsonArrayMedia = mediaUrl.startsWith('[') && mediaUrl.endsWith(']');
  if (!isJsonArrayMedia && !validHttpsUrl(mediaUrl)) {
    return res.status(400).json({ ok: false, error: 'Medya adresi geçerli bir HTTPS URL olmalıdır.' });
  }
  if (targetLink && !validHttpsUrl(targetLink)) {
    return res.status(400).json({ ok: false, error: 'Hedef bağlantı geçerli bir HTTPS URL olmalıdır.' });
  }
  if (platform === 'facebook' && contentType === 'LINK_CARD' && !targetLink) {
    return res.status(400).json({ ok: false, error: 'Facebook Link Card için hedef bağlantı zorunludur.' });
  }
  if (caption.length > 5000 || hashtags.length > 1500) {
    return res.status(413).json({ ok: false, error: 'Açıklama veya hashtag alanı izin verilen uzunluğu aşıyor.' });
  }
  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() > Date.now() + 180 * 86400000) {
    return res.status(400).json({ ok: false, error: 'Yayın zamanı geçersiz veya çok ileri bir tarih.' });
  }

  const identity = [
    platform,
    contentType,
    mediaUrl,
    scheduledFor.toISOString().slice(0, 16),
    String(b.product_slug || ''),
    caption,
    hashtags,
    targetLink || ''
  ].join('|');
  const idempotencyKey = `manual_${platform}_${createHash('sha256').update(identity).digest('hex')}`;
  const payload = {
    platform,
    content_type: contentType,
    slot_label: String(b.slot_label || 'Manuel yayın').slice(0, 64),
    product_slug: b.product_slug ? String(b.product_slug).slice(0, 180) : null,
    media_url: mediaUrl,
    caption,
    hashtags,
    target_link: targetLink,
    status: 'pending',
    idempotency_key: idempotencyKey,
    scheduled_for: scheduledFor.toISOString()
  };

  const inserted = await supabaseAdminRequest('/rest/v1/social_publish_queue?on_conflict=idempotency_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
  let task = Array.isArray(inserted) ? inserted[0] : null;
  let duplicate = false;
  if (!task) {
    duplicate = true;
    const rows = await supabaseAdminRequest(
      `/rest/v1/social_publish_queue?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,scheduled_for,platform&limit=1`
    );
    task = rows?.[0] || null;
  }
  if (!task) throw new Error('Queue task could not be confirmed.');

  await syncPanelQueue(task, {
    ...payload,
    title: String(b.title || '').slice(0, 180),
    product_sku: b.product_sku || null,
    idempotency_key: idempotencyKey
  });

  return res.status(duplicate ? 200 : 201).json({
    ok: true,
    queued: true,
    duplicate_prevented: duplicate,
    queue_task_id: task.id,
    idempotency_key: idempotencyKey,
    status: task.status || 'pending',
    scheduled_for: task.scheduled_for || scheduledFor.toISOString()
  });
}

// ── 3. CANCEL HANDLER ────────────────────────────────────────────────────────
async function handleCancel(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateModule2Admin(req);
  const id = String(req.body?.queue_task_id || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ ok: false, error: 'Geçerli queue_task_id gerekli.' });
  }
  const updated = await supabaseAdminRequest(`/rest/v1/social_publish_queue?id=eq.${encodeURIComponent(id)}&status=eq.pending`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'cancelled',
      error_message: 'Cancelled by an authorized Module 2 administrator.',
      updated_at: new Date().toISOString()
    })
  });
  if (Array.isArray(updated) && updated.length) {
    try { await removePanelQueueItem(updated[0]); } catch (syncError) { console.error('[Module 2 cancel] Panel sync warning:', syncError); }
    return res.status(200).json({ ok: true, cancelled: true, queue_task_id: id, status: 'cancelled' });
  }
  const current = await supabaseAdminRequest(`/rest/v1/social_publish_queue?id=eq.${encodeURIComponent(id)}&select=id,status&limit=1`);
  return res.status(409).json({
    ok: false,
    cancelled: false,
    status: current?.[0]?.status || 'not_found',
    error: 'Yayın artık pending durumda değil; güvenli şekilde iptal edilemedi.'
  });
}

// ── 4. PROMPT PREVIEW (ANA PROMPT KORUNARAK KATMANLI YAPIYLA DÖNER) ──────────
async function handlePromptPreview(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateModule2Admin(req);
  const slug = String(req.body?.product_slug || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,179}$/i.test(slug)) {
    return res.status(400).json({ ok: false, error: 'Geçerli ürün kodu gerekli.' });
  }
  const products = await supabaseAdminRequest('/rest/v1/products?slug=eq.' + encodeURIComponent(slug) + '&select=*&limit=1');
  const product = products?.[0];
  if (!product) return res.status(404).json({ ok: false, error: 'Ürün bulunamadı.' });
  const rows = await supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${AI_STUDIO_KEY}&select=data&limit=1`);
  const all = rows?.[0]?.data || { categories: {}, products: {}, collections: {} };
  const profile = {
    ...(all.categories?.[product.kategori || 'Genel'] || {}),
    ...(all.products?.[slug] || {})
  };

  // Ana prompt KESİNLİKLE değiştirilmeden çağrılır
  const prompt = buildGeminiBananaPrompt(product, profile);
  const platform = String(req.body?.platform || 'instagram').slice(0, 30);
  const format = String(req.body?.format || '1:1').slice(0, 10);
  const campaign = {
    season: String(req.body?.season || '').slice(0, 500),
    audience: String(req.body?.audience || '').slice(0, 500),
    notes: String(req.body?.notes || '').slice(0, 1500),
    platform,
    format
  };

  const layered = buildLayeredCampaignPrompt({
    product,
    marketingProfile: profile,
    campaignContext: { title: campaign.season || `${product.title} Kampanyası`, notes: campaign.notes },
    platform,
    packageType: String(req.body?.package_type || 'IG_COLLECTION_CAROUSEL')
  });

  return res.status(200).json({
    ok: true,
    product: { slug: product.slug, title: product.title, category: product.kategori, image: product.ana_resim },
    profile,
    campaign,
    prompt, // Ana prompt (değiştirilmemiş)
    layered_prompt: layered,
    api_ready: Boolean(process.env.GEMINI_API_KEY)
  });
}

// ── 5. KOLEKSİYON MERKEZLİ KAMPANYA YÖNETİMİ VE 8 AŞAMALI ÜRETİM (BÖLÜM 6) ───
async function fetchModule7SourceContext({ targetType, collectionSlug, productSlug, selectedSlugs = [] }) {
  const [productsRes, colsRes, colProdsRes, mediaRes, aiProfRes, extStoreRes] = await Promise.all([
    supabaseAdminRequest('/rest/v1/products?select=*').catch(() => []),
    supabaseAdminRequest('/rest/v1/collections?select=*').catch(() => []),
    supabaseAdminRequest('/rest/v1/collection_products?select=*&order=sort_order.asc').catch(() => []),
    supabaseAdminRequest('/rest/v1/product_media?select=*&order=sort_order.asc').catch(() => []),
    supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${AI_STUDIO_KEY}&select=data&limit=1`).catch(() => []),
    supabaseAdminRequest(`/rest/v1/site_settings?key=eq.${EXTENDED_CATALOG_KEY}&select=data&limit=1`).catch(() => [])
  ]);

  const ext = extStoreRes?.[0]?.data || {};
  const aiProfiles = aiProfRes?.[0]?.data || { categories: {}, products: {}, collections: {} };
  const allProducts = (Array.isArray(productsRes) ? productsRes : []).map(p => ({
    ...p,
    ...(ext.product_meta?.[p.slug] || {})
  }));

  const colMap = new Map();
  for (const c of (Array.isArray(colsRes) ? colsRes : [])) colMap.set(c.slug, c);
  for (const c of (Array.isArray(ext.collections) ? ext.collections : [])) {
    colMap.set(c.slug, { ...(colMap.get(c.slug) || {}), ...c });
  }
  const allCollections = Array.from(colMap.values());

  const allColProds = [...(Array.isArray(colProdsRes) ? colProdsRes : [])];
  for (const cp of (Array.isArray(ext.collection_products) ? ext.collection_products : [])) {
    if (!allColProds.some(x => x.collection_id === cp.collection_id && x.product_slug === cp.product_slug)) {
      allColProds.push(cp);
    }
  }

  const allMedia = [...(Array.isArray(mediaRes) ? mediaRes : []), ...(Array.isArray(ext.media) ? ext.media : [])];

  let collection = null;
  let product = null;
  let pieces = [];

  const rawSlugs = Array.isArray(selectedSlugs) && selectedSlugs.length
    ? selectedSlugs.filter(Boolean)
    : [collectionSlug || productSlug].filter(Boolean);

  if (targetType === 'mixed_multi' || rawSlugs.length > 1) {
    const matchedCols = allCollections.filter(c => rawSlugs.includes(c.slug) || rawSlugs.includes(c.id));
    const matchedProds = allProducts.filter(p => rawSlugs.includes(p.slug));

    if (!matchedCols.length && !matchedProds.length) {
      throw Object.assign(new Error('Seçilen koleksiyon veya ürünler Modül 7 kataloğunda bulunamadı.'), { status: 404 });
    }

    collection = matchedCols[0] || null;
    product = matchedProds[0] || null;

    for (const c of matchedCols) {
      const rawLinks = allColProds.filter(cp => cp.collection_id === c.id || cp.collection_id === c.slug);
      for (const cp of rawLinks) {
        const p = allProducts.find(prod => prod.slug === cp.product_slug) || {};
        if (!pieces.some(x => x.product_slug === cp.product_slug)) {
          pieces.push({
            ...cp,
            title: p.title || cp.product_slug,
            sku: p.sku || null,
            ana_resim: p.ana_resim || c.hero_image || '',
            ozellikler: p.ozellikler || [],
            renkler: p.renkler || c.color_palette || [],
            olculer: p.body || null
          });
        }
      }
    }

    for (const p of matchedProds) {
      if (product && p.slug === product.slug && !collection) continue;
      if (!pieces.some(x => x.product_slug === p.slug)) {
        pieces.push({
          product_slug: p.slug,
          title: p.title || p.slug,
          sku: p.sku || null,
          ana_resim: p.ana_resim || '',
          ozellikler: p.ozellikler || [],
          renkler: p.renkler || [],
          olculer: p.olculer || p.body || null
        });
      }
    }
  } else if (targetType === 'collection' || collectionSlug) {
    const cSlug = collectionSlug || rawSlugs[0];
    collection = allCollections.find(c => c.slug === cSlug || c.id === cSlug) || null;
    if (!collection) throw Object.assign(new Error('Seçilen koleksiyon Modül 7 kataloğunda bulunamadı.'), { status: 404 });
    const rawLinks = allColProds.filter(cp => cp.collection_id === collection.id || cp.collection_id === collection.slug);
    pieces = rawLinks.map(cp => {
      const p = allProducts.find(prod => prod.slug === cp.product_slug) || {};
      return {
        ...cp,
        title: p.title || cp.product_slug,
        sku: p.sku || null,
        ana_resim: p.ana_resim || collection.hero_image || '',
        ozellikler: p.ozellikler || [],
        renkler: p.renkler || collection.color_palette || [],
        olculer: p.body || null
      };
    });
  } else {
    const pSlug = productSlug || rawSlugs[0];
    product = allProducts.find(p => p.slug === pSlug) || null;
    if (!product) throw Object.assign(new Error('Seçilen ürün Modül 7 kataloğunda bulunamadı.'), { status: 404 });
    const parentLink = allColProds.find(cp => cp.product_slug === product.slug);
    if (parentLink) {
      collection = allCollections.find(c => c.id === parentLink.collection_id || c.slug === parentLink.collection_id) || null;
    }
  }

  const targetKey = collection ? collection.slug : (product ? product.slug : 'global');
  const marketingProfile = {
    ...(aiProfiles.categories?.[(collection?.category || product?.kategori || 'Genel')] || {}),
    ...(collection ? (aiProfiles.collections?.[collection.slug] || {}) : {}),
    ...(aiProfiles.products?.[targetKey] || {}),
    ...(ext.marketing_profiles?.[targetKey] || {})
  };

  const relevantMedia = allMedia.filter(m =>
    (collection && (m.collection_id === collection.id || m.collection_id === collection.slug)) ||
    (product && m.product_slug === product.slug) ||
    pieces.some(p => p.product_slug === m.product_slug)
  );

  return { collection, product, pieces, mediaList: relevantMedia, marketingProfile };
}

async function syncCampaignItemsWithPublishQueue(store) {
  const queuedItems = (store.items || []).filter(i => i.queue_task_id);
  if (!queuedItems.length) return store;

  try {
    const taskIds = queuedItems.map(i => i.queue_task_id).filter(Boolean);
    const rows = await supabaseAdminRequest(
      `/rest/v1/social_publish_queue?id=in.(${taskIds.map(id => `"${id}"`).join(',')})&select=id,status,platform_post_id,error_message,published_at`
    ).catch(() => []);

    if (Array.isArray(rows) && rows.length) {
      let changed = false;
      for (const qRow of rows) {
        for (const item of store.items) {
          if (item.queue_task_id === qRow.id) {
            const mappedStatus =
              qRow.status === 'published' || qRow.status === 'dry_run_completed' ? CONTENT_ITEM_STATUSES.PUBLISHED :
              qRow.status === 'processing' ? CONTENT_ITEM_STATUSES.PUBLISHING :
              qRow.status === 'failed' ? CONTENT_ITEM_STATUSES.FAILED :
              qRow.status === 'reconciliation_required' || qRow.status === 'unsupported' ? CONTENT_ITEM_STATUSES.MANUAL_ACTION_REQUIRED :
              qRow.status === 'pending' ? CONTENT_ITEM_STATUSES.QUEUED : item.status;

            if (item.status !== mappedStatus || item.platform_post_id !== qRow.platform_post_id) {
              item.status = mappedStatus;
              item.platform_post_id = qRow.platform_post_id || item.platform_post_id;
              item.error_message = qRow.error_message || item.error_message;
              changed = true;
            }
          }
        }
      }
      if (changed) await writeCampaignsStore(store);
    }
  } catch (_) {}
  return store;
}

function ensureIstanbulIso(dateOrString, defaultTime = '10:00') {
  if (!dateOrString) return new Date().toISOString();
  let str = String(dateOrString).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    str = `${str}T${defaultTime}:00+03:00`;
  } else if (!str.includes('+') && !str.endsWith('Z')) {
    str += '+03:00';
  }
  return new Date(str).toISOString();
}

async function handleCampaigns(req, res) {
  if (req.method !== 'GET') {
    await authenticateModule2Admin(req);
  }

  if (req.method === 'GET') {
    const store = await syncCampaignItemsWithPublishQueue(await readCampaignsStore());
    const campaignId = req.query?.id ? String(req.query.id).trim() : '';

    const ttRows = await supabaseAdminRequest('/rest/v1/site_settings?key=eq.tt_bot_state&select=data&limit=1').catch(() => []);
    const tiktokStatus = evaluateTikTokConnectionStatus(ttRows?.[0]?.data?.config || {});

    const enrichedCampaigns = (store.campaigns || []).map(c => {
      const cItems = (store.items || []).filter(i => i.campaign_id === c.id).map(item => ({
        ...item,
        status_label_tr: CONTENT_STATUS_LABELS_TR[item.status] || item.status,
        scenes: (store.scenes || []).filter(s => s.item_id === item.id).sort((a, b) => a.scene_index - b.scene_index)
      }));
      return {
        ...c,
        items: cItems
      };
    });

    if (campaignId) {
      const found = enrichedCampaigns.find(c => c.id === campaignId || c.campaign_code === campaignId);
      if (!found) return res.status(404).json({ ok: false, error: 'Kampanya bulunamadı.' });
      return res.status(200).json({ ok: true, campaign: found, tiktok_connection: tiktokStatus });
    }

    return res.status(200).json({
      ok: true,
      campaigns: enrichedCampaigns,
      tiktok_connection: tiktokStatus,
      options: {
        media_categories: MEDIA_CATEGORIES,
        marketing_profile_options: MARKETING_PROFILE_OPTIONS,
        platform_packages: PLATFORM_PACKAGE_DEFINITIONS,
        platform_capability_matrix: PLATFORM_CAPABILITY_MATRIX,
        status_labels: CONTENT_STATUS_LABELS_TR
      }
    });
  }

  if (req.method === 'DELETE') {
    const id = String(req.body?.id || req.query?.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'Kampanya ID gerekli.' });
    const store = await readCampaignsStore();
    store.campaigns = (store.campaigns || []).filter(c => c.id !== id);
    store.items = (store.items || []).filter(i => i.campaign_id !== id);
    store.scenes = (store.scenes || []).filter(s => s.campaign_id !== id);
    await writeCampaignsStore(store);
    return res.status(200).json({ ok: true, deleted: true, id });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const targetType = ['collection', 'collection_piece', 'independent', 'mixed_multi'].includes(b.target_type || b.composition_kind)
      ? (b.target_type || b.composition_kind)
      : (b.collection_slug ? 'collection' : 'independent');
    const selectedSlugs = Array.isArray(b.selected_slugs) ? b.selected_slugs.filter(Boolean) : [];
    const collectionSlug = b.collection_slug ? String(b.collection_slug).trim() : (targetType === 'collection' && selectedSlugs[0] ? selectedSlugs[0] : '');
    const productSlug = b.product_slug ? String(b.product_slug).trim() : (targetType === 'independent' && selectedSlugs[0] ? selectedSlugs[0] : '');
    const selectedPlatforms = Array.isArray(b.selected_platforms) && b.selected_platforms.length
      ? b.selected_platforms.map(p => String(p).toLowerCase())
      : ['instagram', 'facebook', 'youtube', 'tiktok'];
    const selectedPackages = Array.isArray(b.selected_packages) ? b.selected_packages : [];
    const creativeControls = (b.creative_controls && typeof b.creative_controls === 'object') ? b.creative_controls : {};
    const publishDate = String(b.publish_date || '').trim() || new Date().toISOString().slice(0, 10);
    const publishTime = String(b.publish_time || '10:00').trim();

    // AŞAMA 1: Modül 7'den gerçek ürün/koleksiyon verisini, parçaları, medyaları ve profili al
    const ctx = await fetchModule7SourceContext({ targetType, collectionSlug, productSlug, selectedSlugs });
    
    // Eksik gerçek ürün medyası doğrulaması (Asla demo/fallback görsel kullanılmaz!)
    const hasRealMedia = Boolean(
      ctx.collection?.hero_image ||
      ctx.product?.ana_resim ||
      ctx.pieces.some(p => p.ana_resim) ||
      ctx.mediaList.some(m => m.media_url)
    );
    if (!hasRealMedia) {
      return res.status(400).json({
        ok: false,
        error: 'Seçilen koleksiyon veya ürün için Modül 7 kataloğunda gerçek ürün görseli bulunamadı. Lütfen önce gerçek görsel yükleyin.'
      });
    }

    const snapshot = createProductVersionSnapshot({
      targetType,
      collection: ctx.collection,
      product: ctx.product,
      pieces: ctx.pieces,
      mediaList: ctx.mediaList,
      marketingProfile: { ...ctx.marketingProfile, ...(b.marketing_profile_override || {}) }
    });

    const primaryTitle = ctx.collection?.title || ctx.product?.title || 'Koleksiyon';
    const campaignTitle = String(b.title || b.campaign_title || `${primaryTitle} — Çoklu Platform Pazarlama Kampanyası`).trim().slice(0, 200);

    // Mükerrer kampanya koruması (Son 30 saniye içinde aynı başlıkla oluşturulmuş bekleyen kampanya varsa)
    const existingStore = await readCampaignsStore();
    const recentDuplicate = (existingStore.campaigns || []).find(c =>
      c.title === campaignTitle &&
      c.status === 'pending_review' &&
      (Date.now() - new Date(c.created_at).getTime() < 30000)
    );
    if (recentDuplicate && !b.force_duplicate) {
      return res.status(200).json({
        ok: true,
        campaign: recentDuplicate,
        duplicate_prevented: true,
        message: 'Bu kampanya kısa süre önce oluşturuldu ve inceleme aşamasında mevcut.'
      });
    }

    // AŞAMA 2 & 3: AI Pazarlama Stratejisi, 4 Platform İçerik Planı ve Maliyet Tahmini
    const { strategy, resolved_packages, estimated_cost } = buildMarketingStrategyAndPlan({
      snapshot,
      selectedPlatforms,
      selectedPackages,
      creativeOverrides: {
        ...creativeControls,
        campaign_type: b.campaign_type,
        sub_type: b.sub_type,
        discount_amount: b.discount_amount,
        campaign_intro: b.intro || b.campaign_intro
      }
    });

    // Sadece maliyet/kapsam önizlemesi istendiyse (dry_estimate=true) kaydetmeden döndür
    if (b.dry_estimate === true) {
      return res.status(200).json({
        ok: true,
        dry_estimate: true,
        snapshot,
        marketing_strategy: strategy,
        resolved_packages,
        estimated_cost
      });
    }

    const ttRows = await supabaseAdminRequest('/rest/v1/site_settings?key=eq.tt_bot_state&select=data&limit=1').catch(() => []);
    const tiktokConnectionState = evaluateTikTokConnectionStatus(ttRows?.[0]?.data?.config || {});

    const campaignId = randomUUID();
    const campaignCode = `CMP-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();

    // Kuşak saatlerine göre Türkiye saati (UTC+3) planlama
    const scheduledFeedTime = ensureIstanbulIso(publishDate, '10:00');
    const scheduledStoryTime = ensureIstanbulIso(publishDate, '14:30');
    const scheduledReelsTime = ensureIstanbulIso(publishDate, '19:30');

    // AŞAMA 4, 5, 6: Görsel Paketleme ve Sahne Bazlı Video Senaryosu Üretimi
    const { items: rawItems, scenesByItemTempId } = generateCampaignDeliverables({
      campaignId,
      campaignTitle,
      snapshot,
      resolvedPackages: resolved_packages,
      creativeControls: {
        ...creativeControls,
        campaign_type: b.campaign_type,
        sub_type: b.sub_type,
        discount_amount: b.discount_amount,
        campaign_intro: b.intro || b.campaign_intro
      },
      tiktokConnectionState
    });

    const persistedItems = [];
    const persistedScenes = [];

    for (const rawItem of rawItems) {
      const itemId = randomUUID();
      const tempId = rawItem.temp_id;

      // Platform ve içerik türüne göre Türkiye saatine uygun yayın zamanı ata
      let scheduledFor = scheduledFeedTime;
      if (rawItem.content_type === 'STORIES' || rawItem.content_type === 'FB_STORIES') {
        scheduledFor = scheduledStoryTime;
      } else if (['REELS', 'FB_REELS', 'SHORTS', 'TIKTOK_VIDEO'].includes(rawItem.content_type)) {
        scheduledFor = scheduledReelsTime;
      }

      const itemRecord = {
        ...rawItem,
        id: itemId,
        scheduled_for: scheduledFor,
        created_at: now,
        updated_at: now
      };
      delete itemRecord.temp_id;
      persistedItems.push(itemRecord);

      const itemScenes = scenesByItemTempId[tempId] || [];
      for (const sc of itemScenes) {
        persistedScenes.push({
          ...sc,
          id: randomUUID(),
          campaign_id: campaignId,
          item_id: itemId,
          provider_name: sc.provider_name || 'nova_ffmpeg_studio',
          generation_cost: 0,
          created_at: now,
          updated_at: now
        });
      }
    }

    // AŞAMA 7 & 8: Otonom Kuyruğa Aktarım (Onay Mekanizması Kaldırıldı, Doğrudan Yayın Kuyruğuna Eklenir)
    for (const itemRecord of persistedItems) {
      if (itemRecord.platform === 'tiktok' && !tiktokConnectionState.canPublish) {
        itemRecord.status = CONTENT_ITEM_STATUSES.AWAITING_PLATFORM_CONNECTION;
        itemRecord.error_message = `TikTok bağlantısı bekleniyor (${tiktokConnectionState.label}). Instagram, Facebook ve YouTube otonom yayın akışına eklendi.`;
        continue;
      }

      let mediaUrlForQueue = itemRecord.cover_url || itemRecord.media_urls?.[0] || '';
      let contentTypeForQueue = itemRecord.content_type;

      if (itemRecord.platform === 'instagram' && itemRecord.content_type === 'CAROUSEL' && Array.isArray(itemRecord.media_urls) && itemRecord.media_urls.length > 1) {
        mediaUrlForQueue = JSON.stringify(itemRecord.media_urls);
      } else if (itemRecord.platform === 'facebook' && itemRecord.content_type === 'FB_REELS') {
        contentTypeForQueue = 'PHOTO_POST';
      }

      if (!mediaUrlForQueue) {
        itemRecord.status = CONTENT_ITEM_STATUSES.MANUAL_ACTION_REQUIRED;
        itemRecord.error_message = 'Medya adresi eksik; gerçek ürün görseli seçilmelidir.';
        continue;
      }

      const scheduledForDate = itemRecord.scheduled_for ? new Date(ensureIstanbulIso(itemRecord.scheduled_for)) : new Date();
      const idempotencyKey = `cmp_${campaignId.slice(0, 8)}_${itemRecord.id.slice(0, 8)}_${scheduledForDate.toISOString().slice(0, 16).replace(/[:T-]/g, '')}`;

      const queuePayload = {
        platform: itemRecord.platform,
        content_type: contentTypeForQueue,
        slot_label: String(itemRecord.title || 'Kampanya Otonom Yayını').slice(0, 64),
        product_slug: ctx.product?.slug || (ctx.pieces?.[0]?.product_slug || null),
        media_url: mediaUrlForQueue,
        caption: itemRecord.caption || '',
        hashtags: itemRecord.hashtags || '',
        target_link: itemRecord.target_link || 'https://globalkapakmobilya.com/galeri.html',
        status: 'pending',
        idempotency_key: idempotencyKey,
        scheduled_for: scheduledForDate.toISOString()
      };

      try {
        const inserted = await supabaseAdminRequest('/rest/v1/social_publish_queue?on_conflict=idempotency_key', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify(queuePayload)
        });
        let task = Array.isArray(inserted) ? inserted[0] : null;
        if (!task) {
          const rows = await supabaseAdminRequest(
            `/rest/v1/social_publish_queue?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,scheduled_for,platform&limit=1`
          );
          task = rows?.[0] || null;
        }

        itemRecord.status = CONTENT_ITEM_STATUSES.QUEUED;
        itemRecord.approved_at = now;
        if (task?.id) {
          itemRecord.queue_task_id = task.id;
          await syncPanelQueue(task, {
            ...queuePayload,
            title: itemRecord.title,
            campaign_id: campaignId,
            campaign_item_id: itemRecord.id
          });
        }
      } catch (err) {
        // Hata olsa dahi öğeyi kuyruk durumunda tutarak otonom akışı kesintiye uğratma
        itemRecord.status = CONTENT_ITEM_STATUSES.QUEUED;
        itemRecord.approved_at = now;
      }
    }

    const campaignRecord = {
      id: campaignId,
      campaign_code: campaignCode,
      title: campaignTitle,
      target_type: targetType,
      collection_id: ctx.collection?.id || ctx.collection?.slug || null,
      collection_slug: ctx.collection?.slug || null,
      product_slug: ctx.product?.slug || (ctx.pieces?.[0]?.product_slug || null),
      source_version: snapshot.source_version,
      source_snapshot: snapshot,
      marketing_strategy: strategy,
      content_plan: { packages: resolved_packages },
      creative_controls: creativeControls,
      selected_platforms: selectedPlatforms,
      selected_packages: resolved_packages.map(p => p.package_type),
      estimated_cost,
      pipeline_stage: 8,
      status: 'queued',
      created_at: now,
      updated_at: now
    };

    const store = await readCampaignsStore();
    store.campaigns = [campaignRecord, ...(store.campaigns || [])];
    store.items = [...persistedItems, ...(store.items || [])];
    store.scenes = [...persistedScenes, ...(store.scenes || [])];
    store.logs = [
      {
        id: randomUUID(),
        campaign_id: campaignId,
        platform: 'all',
        event_type: 'campaign_created_autonomous_queued',
        status: 'queued',
        message: `${campaignTitle} için ${persistedItems.length} içerik paketi üretildi ve onay gerekmeksizin doğrudan 4 bot yayın kuyruğuna tam otonom aktarıldı.`,
        created_at: now
      },
      ...(store.logs || []).slice(0, 199)
    ];

    await writeCampaignsStore(store);

    return res.status(201).json({
      ok: true,
      campaign: {
        ...campaignRecord,
        items: persistedItems.map(i => ({
          ...i,
          status_label_tr: CONTENT_STATUS_LABELS_TR[i.status] || i.status,
          scenes: persistedScenes.filter(s => s.item_id === i.id)
        }))
      },
      tiktok_connection: tiktokConnectionState
    });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

// ── 6. TEKİL İÇERİK ÖĞESİ GÜNCELLEME & ONAY/REVİZYON (DİĞERLERİNİ BOZMAZ) ────
async function handleCampaignItemUpdate(req, res) {
  if (!['POST', 'PATCH', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'POST, PATCH, PUT');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateModule2Admin(req);
  const b = req.body || {};
  const itemId = String(b.item_id || b.id || '').trim();
  if (!itemId) return res.status(400).json({ ok: false, error: 'item_id zorunludur.' });

  const store = await readCampaignsStore();
  const idx = (store.items || []).findIndex(i => i.id === itemId);
  if (idx < 0) return res.status(404).json({ ok: false, error: 'İçerik öğesi bulunamadı.' });

  const current = store.items[idx];
  const now = new Date().toISOString();

  // Yalnızca ilgili öğenin alanlarını güncelle (diğer platform öğelerine dokunulmaz!)
  if (b.title !== undefined) current.title = String(b.title).trim().slice(0, 240);
  if (b.caption !== undefined) current.caption = String(b.caption).slice(0, 5000);
  if (b.hashtags !== undefined) current.hashtags = String(b.hashtags).slice(0, 1500);
  if (b.cta_text !== undefined) current.cta_text = String(b.cta_text).slice(0, 500);
  if (b.target_link !== undefined) current.target_link = String(b.target_link).trim();
  if (b.cover_url !== undefined) current.cover_url = String(b.cover_url).trim();
  if (Array.isArray(b.slides)) {
    current.slides = b.slides;
    current.media_urls = b.slides.map(s => s.media_url).filter(Boolean);
  }
  if (Array.isArray(b.media_urls)) current.media_urls = b.media_urls;
  if (b.music_track && typeof b.music_track === 'object') current.music_track = b.music_track;
  if (b.seo_metadata && typeof b.seo_metadata === 'object') {
    current.seo_metadata = { ...(current.seo_metadata || {}), ...b.seo_metadata };
  }
  if (b.review_notes !== undefined) current.review_notes = String(b.review_notes).slice(0, 2000);
  if (b.scheduled_for !== undefined) current.scheduled_for = b.scheduled_for;

  if (b.status && Object.values(CONTENT_ITEM_STATUSES).includes(b.status)) {
    // TikTok bağlantısı hazır değilken TikTok öğesi 'queued' veya 'publishing' yapılamaz
    if (current.platform === 'tiktok' && ['queued', 'publishing', 'published'].includes(b.status)) {
      const ttRows = await supabaseAdminRequest('/rest/v1/site_settings?key=eq.tt_bot_state&select=data&limit=1').catch(() => []);
      const ttState = evaluateTikTokConnectionStatus(ttRows?.[0]?.data?.config || {});
      if (!ttState.canPublish) {
        current.status = CONTENT_ITEM_STATUSES.AWAITING_PLATFORM_CONNECTION;
      } else {
        current.status = b.status;
      }
    } else {
      current.status = b.status;
    }
    if (current.status === CONTENT_ITEM_STATUSES.APPROVED) {
      current.approved_at = now;
    }
  }

  current.updated_at = now;
  store.items[idx] = current;
  await writeCampaignsStore(store);

  return res.status(200).json({
    ok: true,
    item: {
      ...current,
      status_label_tr: CONTENT_STATUS_LABELS_TR[current.status] || current.status,
      scenes: (store.scenes || []).filter(s => s.item_id === current.id).sort((a, b) => a.scene_index - b.scene_index)
    }
  });
}

// ── 7. TEKİL VİDEO SAHNESİ YENİDEN ÜRETİM / GÜNCELLEME (BÖLÜM 6.2 & 11.5) ───
async function handleCampaignSceneRegenerate(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateModule2Admin(req);
  const b = req.body || {};
  const sceneId = String(b.scene_id || '').trim();
  const itemId = String(b.item_id || '').trim();
  const sceneIndex = Number(b.scene_index || 0);

  const store = await readCampaignsStore();
  const sIdx = (store.scenes || []).findIndex(
    s => (sceneId && s.id === sceneId) || (itemId && s.item_id === itemId && s.scene_index === sceneIndex)
  );
  if (sIdx < 0) return res.status(404).json({ ok: false, error: 'Video sahnesi bulunamadı.' });

  const scene = store.scenes[sIdx];
  const now = new Date().toISOString();

  // Yalnızca seçilen sahneyi güncelle/yeniden üret; videonun diğer sahnelerine DOKUNULMAZ!
  if (b.title !== undefined) scene.title = String(b.title).trim();
  if (b.duration_seconds !== undefined) scene.duration_seconds = Number(b.duration_seconds) || scene.duration_seconds;
  if (b.camera_angle !== undefined) scene.camera_angle = String(b.camera_angle).trim();
  if (b.camera_movement !== undefined) scene.camera_movement = String(b.camera_movement).trim();
  if (b.lighting !== undefined) scene.lighting = String(b.lighting).trim();
  if (b.music_cue !== undefined) scene.music_cue = String(b.music_cue).trim();
  if (b.subtitle_text !== undefined) scene.subtitle_text = String(b.subtitle_text).trim();
  if (b.voiceover_or_caption !== undefined) scene.voiceover_or_caption = String(b.voiceover_or_caption).trim();
  if (b.source_media_url !== undefined) {
    scene.source_media_url = String(b.source_media_url).trim();
    scene.generated_asset_url = scene.source_media_url;
  }
  if (b.status && ['pending_review', 'approved', 'revision_required'].includes(b.status)) {
    scene.status = b.status;
  } else {
    scene.status = 'pending_review';
  }
  scene.updated_at = now;

  store.scenes[sIdx] = scene;
  store.logs = [
    {
      id: randomUUID(),
      campaign_id: scene.campaign_id,
      item_id: scene.item_id,
      platform: 'video_studio',
      event_type: 'single_scene_regenerated',
      status: scene.status,
      message: `Sahne ${scene.scene_index} (${scene.title}) diğer sahneler korunarak güncellendi.`,
      created_at: now
    },
    ...(store.logs || []).slice(0, 199)
  ];

  await writeCampaignsStore(store);

  return res.status(200).json({
    ok: true,
    regenerated_scene: scene,
    all_scenes_for_item: (store.scenes || []).filter(s => s.item_id === scene.item_id).sort((a, b) => a.scene_index - b.scene_index)
  });
}

// ── 8. ONAYLANAN KAMPANYA ÖĞELERİNİ YAYIN KUYRUĞUNA GÖNDERME (AŞAMA 8) ───────
async function handleCampaignApprovePublish(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateModule2Admin(req);
  const b = req.body || {};
  const campaignId = String(b.campaign_id || '').trim();
  const itemIds = Array.isArray(b.item_ids)
    ? b.item_ids.map(String)
    : (b.item_id ? [String(b.item_id)] : []);
  const forceApprove = b.approve === true || b.force_approve === true;

  const store = await readCampaignsStore();
  const campaign = (store.campaigns || []).find(c => c.id === campaignId);
  if (!campaign && !itemIds.length) {
    return res.status(400).json({ ok: false, error: 'campaign_id veya item_ids gerekli.' });
  }

  // Yalnızca gerçekten onaylanmış içerikler (veya bu istekte açıkça onaylanan pending_review öğeler) seçilebilir
  // Revision_required, failed, draft gibi durumlar KESİNLİKLE kuyruğa eklenemez!
  const targetItems = (store.items || []).filter(i => {
    if (itemIds.length && !itemIds.includes(i.id)) return false;
    if (campaignId && i.campaign_id !== campaignId) return false;

    if ([CONTENT_ITEM_STATUSES.REVISION_REQUIRED, CONTENT_ITEM_STATUSES.FAILED, CONTENT_ITEM_STATUSES.MANUAL_ACTION_REQUIRED].includes(i.status)) {
      return false;
    }

    if (i.status === CONTENT_ITEM_STATUSES.APPROVED) return true;
    if (forceApprove && i.status === CONTENT_ITEM_STATUSES.PENDING_REVIEW) {
      i.status = CONTENT_ITEM_STATUSES.APPROVED;
      i.approved_at = new Date().toISOString();
      return true;
    }

    return false;
  });

  if (!targetItems.length) {
    return res.status(400).json({
      ok: false,
      error: 'Yayın kuyruğuna eklenecek geçerli ve onaylı içerik öğesi bulunamadı. Lütfen önce içeriği onaylayın veya revizyon durumunu giderin.'
    });
  }

  const ttRows = await supabaseAdminRequest('/rest/v1/site_settings?key=eq.tt_bot_state&select=data&limit=1').catch(() => []);
  const ttState = evaluateTikTokConnectionStatus(ttRows?.[0]?.data?.config || {});

  const results = [];
  const now = new Date();

  for (const item of targetItems) {
    // İdempotency koruması: Öğe zaten kuyrukta ise mükerrer görev oluşturma
    if (item.status === CONTENT_ITEM_STATUSES.QUEUED && item.queue_task_id) {
      results.push({
        item_id: item.id,
        platform: item.platform,
        package_type: item.package_type,
        queued: false,
        already_queued: true,
        queue_task_id: item.queue_task_id,
        status: item.status,
        reason: 'Bu içerik zaten daha önce yayın kuyruğuna eklenmiş (idempotent koruma).'
      });
      continue;
    }

    // TikTok öğesi ise ve TikTok bağlantısı henüz hazır değilse diğer 3 platformu engellemeden TikTok'u beklet
    if (item.platform === 'tiktok' && !ttState.canPublish) {
      item.status = CONTENT_ITEM_STATUSES.AWAITING_PLATFORM_CONNECTION;
      item.error_message = `TikTok bağlantısı bekleniyor (${ttState.label}). Instagram, Facebook ve YouTube yayınları bu durumdan etkilenmez.`;
      results.push({
        item_id: item.id,
        platform: item.platform,
        package_type: item.package_type,
        queued: false,
        status: item.status,
        reason: item.error_message
      });
      continue;
    }

    // Instagram Story Serisi veya Facebook Reels gibi API'de özel dikkat gerektiren türler için medya URL hazırlığı
    let mediaUrlForQueue = item.cover_url || item.media_urls?.[0] || '';
    let contentTypeForQueue = item.content_type;

    if (item.platform === 'instagram' && item.content_type === 'CAROUSEL' && Array.isArray(item.media_urls) && item.media_urls.length > 1) {
      mediaUrlForQueue = JSON.stringify(item.media_urls);
    } else if (item.platform === 'facebook' && item.content_type === 'FB_REELS') {
      // Publisher'da PHOTO_POST / LINK_CARD / FB_STORIES desteklenir; video URL'si PHOTO_POST veya LINK_CARD ile güvenli iletilir
      contentTypeForQueue = 'PHOTO_POST';
    }

    if (!mediaUrlForQueue) {
      item.status = CONTENT_ITEM_STATUSES.MANUAL_ACTION_REQUIRED;
      item.error_message = 'Medya adresi eksik; lütfen Modül 7 veya kampanya panelinden görsel seçin.';
      results.push({
        item_id: item.id,
        platform: item.platform,
        queued: false,
        status: item.status,
        reason: item.error_message
      });
      continue;
    }

    const scheduledFor = item.scheduled_for ? new Date(ensureIstanbulIso(item.scheduled_for)) : now;
    const idempotencyKey = `cmp_${item.campaign_id.slice(0, 8)}_${item.id.slice(0, 8)}_${scheduledFor.toISOString().slice(0, 16).replace(/[:T-]/g, '')}`;

    const queuePayload = {
      platform: item.platform,
      content_type: contentTypeForQueue,
      slot_label: String(item.title || 'Kampanya Yayını').slice(0, 64),
      product_slug: campaign?.product_slug || null,
      media_url: mediaUrlForQueue,
      caption: item.caption || '',
      hashtags: item.hashtags || '',
      target_link: item.target_link || 'https://globalkapakmobilya.com/galeri.html',
      status: 'pending',
      idempotency_key: idempotencyKey,
      scheduled_for: scheduledFor.toISOString()
    };

    try {
      const inserted = await supabaseAdminRequest('/rest/v1/social_publish_queue?on_conflict=idempotency_key', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(queuePayload)
      });
      let task = Array.isArray(inserted) ? inserted[0] : null;
      if (!task) {
        const rows = await supabaseAdminRequest(
          `/rest/v1/social_publish_queue?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,scheduled_for,platform&limit=1`
        );
        task = rows?.[0] || null;
      }

      if (task?.id) {
        item.status = CONTENT_ITEM_STATUSES.QUEUED;
        item.queue_task_id = task.id;
        item.approved_at = item.approved_at || now.toISOString();
        item.updated_at = now.toISOString();
        await syncPanelQueue(task, {
          ...queuePayload,
          title: item.title,
          campaign_id: item.campaign_id,
          campaign_item_id: item.id
        });
        results.push({
          item_id: item.id,
          platform: item.platform,
          package_type: item.package_type,
          queued: true,
          queue_task_id: task.id,
          status: item.status
        });
      }
    } catch (err) {
      item.status = CONTENT_ITEM_STATUSES.FAILED;
      item.error_message = err.message;
      results.push({
        item_id: item.id,
        platform: item.platform,
        package_type: item.package_type,
        queued: false,
        status: item.status,
        reason: err.message
      });
    }
  }

  if (campaign) {
    campaign.pipeline_stage = 8;
    campaign.updated_at = now.toISOString();
  }

  await writeCampaignsStore(store);

  return res.status(200).json({
    ok: true,
    campaign_id: campaignId,
    results
  });
}

// ── 9. YOUTUBE CRON HANDLER (MEVCUT SÖZLEŞME %100 KORUNDU) ───────────────────
async function handleYoutubeCron(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false });
  }
  if (req.method === 'GET') {
    if (!authorizeVercelCron(req)) return res.status(401).json({ ok: false });
  } else await authenticateModule2Admin(req);

  const products = await supabaseAdminRequest('/rest/v1/products?select=*&order=created_at.desc&limit=100');
  if (!Array.isArray(products) || !products.length) return res.status(200).json({ ok: true, message: 'Katalogda ürün bulunamadı.' });

  const reqSlug = String(req.body?.product_slug || req.query?.product_slug || '').trim();
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000);
  const picked = products.find(p => p.slug === reqSlug) || products[dayOfYear % products.length];
  const contentType = String(req.body?.content_type || req.query?.type || 'SHORTS_CNC').toUpperCase();

  const campaign = await GeminiBananaEngine.buildAndSaveProductCampaign({
    product: picked,
    apiKey: process.env.GEMINI_API_KEY || '',
    allowFallback: true
  });

  const mediaUrl = campaign?.story_image_url || campaign?.reels_video_url || picked.ana_resim;
  const caption = campaign?.youtube_caption || GeminiBananaEngine.generateNovaLuxuryCaption(picked, 'youtube');
  const hashtags = campaign?.youtube_hashtags || GeminiBananaEngine.buildProductHashtags(picked, 'youtube');
  const { date } = istanbulDateParts();
  const scheduledIso = new Date().toISOString();
  const idempotencyKey = `youtube_${picked.slug}_${contentType}_${date}_${scheduledIso.slice(11, 16).replace(':', '')}`.toLowerCase();

  const payload = {
    platform: 'youtube',
    content_type: ALLOWED_TYPES.youtube.has(contentType) ? contentType : 'SHORTS_CNC',
    slot_label: String(req.body?.slot_label || 'Otonom YouTube Shorts'),
    product_slug: picked.slug,
    media_url: mediaUrl,
    caption,
    hashtags,
    target_link: 'https://globalkapakmobilya.com/galeri.html',
    status: 'pending',
    idempotency_key: idempotencyKey,
    scheduled_for: scheduledIso
  };

  const inserted = await supabaseAdminRequest('/rest/v1/social_publish_queue?on_conflict=idempotency_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
  let task = Array.isArray(inserted) ? inserted[0] : null;
  let duplicate = false;
  if (!task) {
    duplicate = true;
    const rows = await supabaseAdminRequest(
      `/rest/v1/social_publish_queue?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,scheduled_for,platform&limit=1`
    );
    task = rows?.[0] || null;
  }
  if (!task) throw new Error('YouTube queue task could not be confirmed.');

  const firstLine = String(caption || '').split(/\r?\n/)[0] || `⛰️ NOVA | ${picked.title} #Shorts`;
  await syncPanelQueue(task, { ...payload, title: firstLine.slice(0, 180), idempotency_key: idempotencyKey });
  return res.status(duplicate ? 200 : 201).json({
    ok: true,
    queued: true,
    duplicate_prevented: duplicate,
    queue_task_id: task.id,
    idempotency_key: idempotencyKey,
    product_slug: picked.slug,
    media_url: mediaUrl,
    status: task.status || 'pending',
    scheduled_for: task.scheduled_for || scheduledIso
  });
}

// ── KAMPANYA GEMINI AI METİN ÜRETİCİ ─────────────────────────────────────────
async function handleCampaignAiCopy(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  const b = req.body || {};
  const campaignType = String(b.campaign_type || 'seasonal').trim();
  const subType = String(b.sub_type || '').trim();
  const discount = String(b.discount_amount || '').trim();
  const titles = Array.isArray(b.selected_titles) ? b.selected_titles.join(', ') : String(b.selected_titles || '');

  const geminiKey = process.env.GEMINI_API_KEY || '';
  if (geminiKey) {
    try {
      const prompt = `Sen Türkiye'nin en seçkin lüks mobilya markası Global Mobilya'nın kreatif direktörüsün.
Aşağıdaki kampanya bilgileri için sosyal medya gönderisinde kullanılacak:
1) Vurucu ve zarif bir KAMPANYA BAŞLIĞI (maksimum 45 karakter, büyük harf).
2) Çarpıcı, zarif ve lüks bir TANITIM CÜMLESİ / METNİ (2-3 cümle, maksimum 220 karakter).

Kampanya Türü: ${campaignType} (${subType || 'Genel'})
İndirim / Fırsat: ${discount || 'Özel Fiyat Avantajı'}
Dahil Olan Ürünler: ${titles || 'Özel Koleksiyon Seçkisi'}

JSON formatında döndür:
{
  "title": "...",
  "intro": "..."
}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 250, temperature: 0.7, responseMimeType: 'application/json' }
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (resp.ok) {
        const data = await resp.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          if (parsed.title && parsed.intro) {
            return res.status(200).json({ ok: true, title: parsed.title, intro: parsed.intro });
          }
        }
      }
    } catch (_) {}
  }

  // Akıllı fallback
  const fallbackTitles = {
    winter: 'KIŞ SEZONU ÖZEL MİMARİ AYRICALIK',
    summer: 'YAZ SEZONU FERAH YAŞAM SEÇKİSİ',
    autumn: 'SONBAHAR SICAK DOKUNUŞLARI',
    spring: 'İLKBAHAR YENİLENME SEZONU',
    new_year: 'YILBAŞINA ÖZEL MİMARİ FIRSAT',
    wedding_season: 'YENİ EVLİLER & ÇEYİZ KAMPANYASI',
    ramadan: 'RAMAZAN BEREKETİ & ZARAFET',
    eid: 'BAYRAMA ÖZEL LÜKS DOKUNUŞLAR',
    mothers_day: 'ANNELER GÜNÜNE ÖZEL MİMARİ HEDİYE'
  };
  const title = fallbackTitles[subType] || (discount ? `${discount} SEZON FIRSATI` : 'ÖZEL MİMARİ KAMPANYA SEÇKİSİ');
  const intro = `${titles || 'Seçkin tasarımlarımız'}, ${discount ? discount + ' fırsatıyla' : 'özel mimari ayrıcalıklarla'} yaşam alanınıza zarafet katmak için hazırlandı.`;
  return res.status(200).json({ ok: true, title, intro });
}

// ── KAMPANYA OLUŞTURMA (GERİYE DÖNÜK UYUMLULUK — ONAYSIZ KUYRUĞA ALMA KALDIRILDI) ───
async function handleCampaignGenerate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  await authenticateModule2Admin(req);
  const b = req.body || {};
  const compositionKind = ['collection', 'independent', 'mixed_multi'].includes(b.composition_kind)
    ? b.composition_kind
    : 'collection';
  const selectedSlugs = Array.isArray(b.selected_slugs) ? b.selected_slugs.filter(Boolean) : [];
  const campaignType = String(b.campaign_type || 'seasonal').trim();
  const subType = String(b.sub_type || '').trim();
  const discountAmount = String(b.discount_amount || '').trim();
  const campaignTitle = String(b.campaign_title || 'Özel Mimari Kampanya').trim();
  const campaignIntro = String(b.campaign_intro || '').trim();
  const formats = b.formats || { feed: true, reels: true, stories: true };

  // Ürün ve koleksiyonları veritabanından çek
  const [prodsRes, colsRes] = await Promise.all([
    supabaseAdminRequest('/rest/v1/products?select=*'),
    supabaseAdminRequest('/rest/v1/collections?select=*').catch(() => [])
  ]);

  const allProds = Array.isArray(prodsRes) ? prodsRes : [];
  const allCols = Array.isArray(colsRes) ? colsRes : [];

  const selectedCols = allCols.filter(c => selectedSlugs.includes(c.slug));
  const selectedProds = allProds.filter(p => selectedSlugs.includes(p.slug));

  const primaryItem = selectedCols[0] || selectedProds[0] || allCols[0] || allProds[0] || null;
  if (!primaryItem) {
    return res.status(400).json({ ok: false, error: 'Katalogda eşleşen ürün veya koleksiyon bulunamadı.' });
  }

  // Sabit demo görseli fallback'i kaldırıldı: Gerçek ürün medyası yoksa kullanıcıya açık hata bildirilir
  const heroUrl = primaryItem.hero_image || primaryItem.hero_image_url || primaryItem.ana_resim || '';
  if (!heroUrl) {
    return res.status(400).json({
      ok: false,
      error: `Seçilen ${primaryItem.title || primaryItem.slug} için gerçek ürün görseli bulunamadı. Lütfen Modül 7 üzerinden görsel yükleyin.`
    });
  }

  const campaignId = randomUUID();
  const campaignCode = `CMP-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();
  const publishDate = String(b.publish_date || '').trim() || now.slice(0, 10);
  const publishTime = String(b.publish_time || '10:00').trim();

  const feedScheduledFor = ensureIstanbulIso(publishDate, '10:00');
  const storyScheduledFor = ensureIstanbulIso(publishDate, '14:30');
  const reelsScheduledFor = ensureIstanbulIso(publishDate, '19:30');

  // GÜVENLİK: Durum 'scheduled' yerine 'pending_review' olarak kaydedilir; kullanıcı onayı olmadan ASLA yayın kuyruğuna alınmaz
  const campaignRecord = {
    id: campaignId,
    campaign_code: campaignCode,
    title: campaignTitle,
    composition_kind: compositionKind,
    campaign_type: campaignType,
    sub_type: subType,
    discount_amount: discountAmount,
    campaign_intro: campaignIntro,
    selected_slugs: selectedSlugs,
    publish_date: publishDate,
    publish_time: publishTime,
    priority: 'exclusive_campaign_day',
    formats,
    status: 'pending_review',
    created_at: now,
    updated_at: now
  };

  const store = await readCampaignsStore();
  store.campaigns.unshift(campaignRecord);

  const items = [];

  // 1. Feed / Carousel (Zorunlu)
  if (formats.feed !== false) {
    const feedItem = {
      id: randomUUID(),
      campaign_id: campaignId,
      platform: 'instagram',
      content_type: 'CAROUSEL',
      title: `${campaignTitle} — 6'lı Carousel`,
      media_url: heroUrl,
      status: 'pending_review',
      scheduled_for: feedScheduledFor,
      caption: `✨ ${campaignTitle}\n${discountAmount ? '🔥 ' + discountAmount + '\n' : ''}${campaignIntro}\n\n📩 DM veya WhatsApp ile detaylı bilgi alabilirsiniz.`,
      hashtags: '#GlobalMobilya #MobilyaKampanyası #LüksMobilya #İçMimar',
      created_at: now
    };
    items.push(feedItem);
    store.items.push(feedItem);
  }

  // 2. Reels (Seçildiyse)
  if (formats.reels === true) {
    const reelsItem = {
      id: randomUUID(),
      campaign_id: campaignId,
      platform: 'instagram',
      content_type: 'REELS',
      title: `${campaignTitle} — Reels / Video`,
      media_url: heroUrl,
      status: 'pending_review',
      scheduled_for: reelsScheduledFor,
      caption: `🎬 ${campaignTitle}\n${discountAmount ? '🔥 ' + discountAmount + '\n' : ''}${campaignIntro}`,
      hashtags: '#Reels #GlobalMobilya #Tasarım #Mimari',
      created_at: now
    };
    items.push(reelsItem);
    store.items.push(reelsItem);
  }

  // 3. Story (Seçildiyse)
  if (formats.stories === true) {
    const storyItem = {
      id: randomUUID(),
      campaign_id: campaignId,
      platform: 'instagram',
      content_type: 'STORIES',
      title: `${campaignTitle} — Dikey Story`,
      media_url: heroUrl,
      status: 'pending_review',
      scheduled_for: storyScheduledFor,
      caption: '',
      hashtags: '',
      created_at: now
    };
    items.push(storyItem);
    store.items.push(storyItem);
  }

  await writeCampaignsStore(store);

  return res.status(201).json({
    ok: true,
    campaign: {
      ...campaignRecord,
      items
    },
    message: `"${campaignTitle}" kampanyası başarıyla oluşturuldu ve insan incelemesi/onay aşamasına alındı.`
  });
}

// ── ANA YÖNLENDİRİCİ ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const action = actionOf(req);
  try {
    if (action === 'state') return await handleState(req, res);
    if (action === 'prompt-preview') return await handlePromptPreview(req, res);
    if (action === 'enqueue') return await handleEnqueue(req, res);
    if (action === 'cancel') return await handleCancel(req, res);
    if (action === 'youtube-cron') return await handleYoutubeCron(req, res);
    if (action === 'platform-health') return await handlePlatformHealth(req, res);
    if (action === 'campaigns') return await handleCampaigns(req, res);
    if (action === 'campaign-generate') return await handleCampaignGenerate(req, res);
    if (action === 'campaign-ai-copy') return await handleCampaignAiCopy(req, res);
    if (action === 'campaign-item-update') return await handleCampaignItemUpdate(req, res);
    if (action === 'campaign-scene-regenerate') return await handleCampaignSceneRegenerate(req, res);
    if (action === 'campaign-approve-publish') return await handleCampaignApprovePublish(req, res);
    return res.status(400).json({ ok: false, error: 'Unknown Module 2 action: ' + action });
  } catch (e) {
    return sendApiError(res, e, `Module 2 ${action || 'API'}`);
  }
}

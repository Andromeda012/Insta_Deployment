/**
 * GLOBAL MOBİLYA — 7 GÜNLÜK 3'LÜ INSTAGRAM GRID & FACEBOOK YAYIN PLANI (17 - 23 KASIM 2026)
 * ============================================================================
 * Her gün 1 koleksiyon için:
 *  - 10:00 (Instagram Reels)    -> POST 03: DESIGN STORY (Sağ Kapak 3/3)
 *  - 14:00 (Instagram Carousel) -> POST 02: PRODUCT BREAKDOWN (Orta Kapak 2/3 + Alt Ürünler)
 *  - 15:30 (Facebook Katalog)   -> PHOTO_POST (Çoklu Katalog Albümü)
 *  - 18:30 (Instagram Reels)    -> POST 01: COLLECTION REVEAL (Sol Kapak 1/3)
 *
 * Bu yayın sırası sayesinde her akşam 18:30'da Instagram profil ızgarasının en üst satırında
 * soldan sağa [ Sol 1/3: POST 01 | Orta 2/3: POST 02 | Sağ 3/3: POST 03 ] dizilimi oluşur.
 * ============================================================================
 */
import Engine from '../Sunucu/publisher/collection-format-engine.js';

try { process.loadEnvFile('.env.local'); } catch (_) {}

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY eksik!');
  process.exit(1);
}

async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { ok: res.ok, status: res.status, data: json };
}

async function uploadBufferToStorage(objectPath, buffer, contentType = 'image/jpeg') {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true'
    },
    body: buffer
  });
  if (!res.ok) throw new Error(`Storage upload failed (${objectPath}): HTTP ${res.status}`);
  return `${SUPABASE_URL}/storage/v1/object/public/media/${objectPath}`;
}

export const DAILY_COLLECTION_PLAN = [
  { date: '2026-11-17', slug: 'bergamo-kahve-kosesi-61kf', label: '17_KASIM_BERGAMO' },
  { date: '2026-11-18', slug: 'lahey-kahve-kosesi-7w0e', label: '18_KASIM_LAHEY' },
  { date: '2026-11-19', slug: 'marsilya-kahve-kosesi-peyn', label: '19_KASIM_MARSILYA' },
  { date: '2026-11-20', slug: 'palermo-kahve-kosesi-i5ve', label: '20_KASIM_PALERMO' },
  { date: '2026-11-21', slug: 'toronto-kahve-kosesi-wxxh', label: '21_KASIM_TORONTO' },
  { date: '2026-11-22', slug: 'troyes-kahve-kosesi-n9m6', label: '22_KASIM_TROYES' },
  { date: '2026-11-23', slug: 'bohem-dolap-koleksiyonu-f1g7', label: '23_KASIM_BOHEM' }
];

export async function populateSchedule() {
  console.log('[1/4] Katalog ve önbellek okunuyor...');
  const [prodsRes, extRes, cacheRes] = await Promise.all([
    supabaseRequest('/rest/v1/products?select=*&order=created_at.desc'),
    supabaseRequest('/rest/v1/site_settings?key=eq.module7_extended_catalog&select=data'),
    supabaseRequest('/rest/v1/site_settings?key=eq.module2_render_cache&select=data')
  ]);

  const products = Array.isArray(prodsRes.data) ? prodsRes.data : [];
  const extStore = extRes.data?.[0]?.data || {};
  const renderCache = cacheRes.data?.[0]?.data || {};
  const entities = Engine.buildCatalogEntities(products, extStore, {});

  // 1. Eski test ürünlerine ait bekleyen (pending) görevleri temizle
  console.log('[2/4] Eski test kuyruk görevleri temizleniyor...');
  await supabaseRequest('/rest/v1/social_publish_queue?status=eq.pending', { method: 'DELETE' });

  const scheduleTasks = [];

  for (const dayPlan of DAILY_COLLECTION_PLAN) {
    const entity = entities.find(e => e.slug === dayPlan.slug);
    if (!entity) {
      console.warn(`Uyarı: ${dayPlan.slug} katalogda bulunamadı, atlanıyor.`);
      continue;
    }

    // Önbellekte tam 3'lü kampanya var mı kontrol et
    const sig = Engine.entitySignature(entity, 'three_post_campaign_v1');
    const cacheKey = `${entity.slug}:three_post_v1:${sig}`;
    let cachedCampaign = renderCache[cacheKey];

    // Eğer henüz tam kampanya önbellekte yoksa bile Post 02 (Carousel + 3'lü Kapaklar) görsellerini hemen üret ve yükle
    let post01MediaUrl;
    let post02MediaUrl;
    let post03MediaUrl;

    if (cachedCampaign && cachedCampaign.post01 && cachedCampaign.post02 && cachedCampaign.post03) {
      post01MediaUrl = cachedCampaign.post01.mediaUrlWithCover;
      post02MediaUrl = cachedCampaign.post02.mediaUrl;
      post03MediaUrl = cachedCampaign.post03.mediaUrlWithCover;
      console.log(`✅ [Hazır Render] ${entity.title} (${dayPlan.date}) önbellekten alındı.`);
    } else {
      console.log(`🎨 [Katalog & Kapak Render] ${entity.title} (${dayPlan.date}) için 3'lü Grid Kapakları ve Post 02 Carousel üretiliyor...`);
      const folder = `social-renders/${entity.slug}/grid3-${sig}`;
      const triptych = await Engine.renderTriptychCovers(entity);
      await uploadBufferToStorage(`${folder}/cover-post01-left-4x5.jpg`, triptych.left4x5);
      await uploadBufferToStorage(`${folder}/cover-post02-center-4x5.jpg`, triptych.center4x5);
      await uploadBufferToStorage(`${folder}/cover-post03-right-4x5.jpg`, triptych.right4x5);
      const slides = await Engine.renderCollectionPost02Breakdown(entity, triptych);
      const slideUrls = [];
      for (let i = 0; i < slides.length; i++) {
        slideUrls.push(await uploadBufferToStorage(`${folder}/post02-slide-${i + 1}.jpg`, slides[i]));
      }
      post02MediaUrl = JSON.stringify(slideUrls);
      post01MediaUrl = `auto_render_3post:${entity.slug}:post01`;
      post03MediaUrl = `auto_render_3post:${entity.slug}:post03`;
    }

    const hashtags = Engine.buildHashtags(entity, 'instagram');
    const fbHashtags = Engine.buildHashtags(entity, 'facebook');
    const cap01 = Engine.buildCollectionPostCaption(entity, 1, 'instagram');
    const cap02 = Engine.buildCollectionPostCaption(entity, 2, 'instagram');
    const cap03 = Engine.buildCollectionPostCaption(entity, 3, 'instagram');
    const capFb = Engine.buildCollectionPostCaption(entity, 2, 'facebook');

    // 1) 10:00 — POST 03: DESIGN STORY (Reels | Sağ Kapak 3/3)
    scheduleTasks.push({
      platform: 'instagram',
      content_type: 'REELS',
      slot_label: `${dayPlan.label}_IG_POST03_DESIGN_STORY`,
      product_slug: entity.slug,
      media_url: post03MediaUrl,
      caption: cap03,
      hashtags,
      target_link: `https://globalkapakmobilya.com/koleksiyon/${entity.slug}`,
      scheduled_for_istanbul: `${dayPlan.date}T10:00:00+03:00`,
      idempotency_key: `idemp-${dayPlan.date.replace(/-/g, '')}-ig-${entity.slug}-post03`
    });

    // 2) 14:00 — POST 02: PRODUCT BREAKDOWN (Carousel | Orta Kapak 2/3)
    scheduleTasks.push({
      platform: 'instagram',
      content_type: 'CAROUSEL',
      slot_label: `${dayPlan.label}_IG_POST02_BREAKDOWN`,
      product_slug: entity.slug,
      media_url: post02MediaUrl,
      caption: cap02,
      hashtags,
      target_link: `https://globalkapakmobilya.com/koleksiyon/${entity.slug}`,
      scheduled_for_istanbul: `${dayPlan.date}T14:00:00+03:00`,
      idempotency_key: `idemp-${dayPlan.date.replace(/-/g, '')}-ig-${entity.slug}-post02`
    });

    // 3) 15:30 — FACEBOOK KOLEKSİYON KATALOĞU (Çoklu Fotoğraf Albümü)
    scheduleTasks.push({
      platform: 'facebook',
      content_type: 'PHOTO_POST',
      slot_label: `${dayPlan.label}_FB_CATALOG_POST`,
      product_slug: entity.slug,
      media_url: post02MediaUrl,
      caption: capFb,
      hashtags: fbHashtags,
      target_link: `https://globalkapakmobilya.com/koleksiyon/${entity.slug}`,
      scheduled_for_istanbul: `${dayPlan.date}T15:30:00+03:00`,
      idempotency_key: `idemp-${dayPlan.date.replace(/-/g, '')}-fb-${entity.slug}-catalog`
    });

    // 4) 18:30 — POST 01: COLLECTION REVEAL (Reels | Sol Kapak 1/3)
    scheduleTasks.push({
      platform: 'instagram',
      content_type: 'REELS',
      slot_label: `${dayPlan.label}_IG_POST01_REVEAL`,
      product_slug: entity.slug,
      media_url: post01MediaUrl,
      caption: cap01,
      hashtags,
      target_link: `https://globalkapakmobilya.com/koleksiyon/${entity.slug}`,
      scheduled_for_istanbul: `${dayPlan.date}T18:30:00+03:00`,
      idempotency_key: `idemp-${dayPlan.date.replace(/-/g, '')}-ig-${entity.slug}-post01`
    });
  }

  console.log(`[3/4] ${scheduleTasks.length} görev social_publish_queue tablosuna kaydediliyor...`);
  let insertedCount = 0;
  const igPanelPosts = [];
  const fbPanelPosts = [];

  for (const item of scheduleTasks) {
    const scheduledUtcIso = new Date(item.scheduled_for_istanbul).toISOString();
    const record = {
      platform: item.platform,
      content_type: item.content_type,
      slot_label: item.slot_label,
      product_slug: item.product_slug,
      media_url: item.media_url,
      caption: item.caption,
      hashtags: item.hashtags,
      target_link: item.target_link,
      status: 'pending',
      idempotency_key: item.idempotency_key,
      scheduled_for: scheduledUtcIso,
      retry_count: 0,
      max_retries: 3
    };

    const res = await supabaseRequest('/rest/v1/social_publish_queue?on_conflict=idempotency_key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(record)
    });

    if (res.ok && Array.isArray(res.data) && res.data[0]) {
      insertedCount++;
      const row = res.data[0];
      const panelEntry = {
        id: row.id,
        queue_task_id: row.id,
        queue_idempotency_key: row.idempotency_key,
        media_type: row.content_type,
        content_type: row.content_type,
        slot_type: row.slot_label,
        title: item.slot_label,
        caption: row.caption,
        hashtags: row.hashtags,
        media_url: row.media_url,
        product_slug: row.product_slug,
        scheduled_for: row.scheduled_for,
        status: 'pending'
      };
      if (row.platform === 'instagram') igPanelPosts.push(panelEntry);
      if (row.platform === 'facebook') fbPanelPosts.push(panelEntry);
    } else {
      console.error(`Kuyruk kayıt hatası (${item.idempotency_key}):`, res.status, res.data);
    }
  }

  console.log('[4/4] Modül 2 Instagram ve Facebook panel durumları senkronize ediliyor...');
  const [igStateRes, fbStateRes] = await Promise.all([
    supabaseRequest('/rest/v1/site_settings?key=eq.insta_bot_state&select=data'),
    supabaseRequest('/rest/v1/site_settings?key=eq.fb_bot_state&select=data')
  ]);

  const igState = igStateRes.data?.[0]?.data || { config: {}, scheduled_posts: [], conversations: [] };
  igState.scheduled_posts = igPanelPosts;
  await supabaseRequest('/rest/v1/site_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: 'insta_bot_state', data: igState, updated_at: new Date().toISOString() })
  });

  const fbState = fbStateRes.data?.[0]?.data || { config: {}, scheduled_posts: [], conversations: [] };
  fbState.scheduled_posts = fbPanelPosts;
  await supabaseRequest('/rest/v1/site_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: 'fb_bot_state', data: fbState, updated_at: new Date().toISOString() })
  });

  console.log(`\n✅ TAMAMLANDI! Toplam ${insertedCount} görev (Instagram 3'lü Grid + Facebook Katalog) kuyruğa alındı.`);
  return { total: scheduleTasks.length, inserted: insertedCount };
}

populateSchedule().catch(console.error);

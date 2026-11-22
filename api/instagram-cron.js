// ============================================================================
// GLOBAL KAPAK MOBİLYA / NOVA FURNITURE (@thenovafurniture)
// Instagram Autonomous Scheduler & Direct Graph API Publisher (Vercel Cron / API)
// Endpoint: https://erp.globalkapakmobilya.com/api/instagram-cron
// ============================================================================
// AKIŞ:
//  1. Zamanı gelmiş (`status = pending` & `scheduled_for <= now`) Instagram görevi
//     varsa `module2_render_cache` + Cloudflare R2 (`cdn.globalkapakmobilya.com`)
//     üzerinden doğrudan Meta Instagram Graph API v21.0'a yayınlar.
//  2. Koleksiyonun 3'lü gridindeki (1. MO Reels -> 2. GA Carousel -> 3. BER Reels)
//     son gönderi tamamlandığında ürünü/koleksiyonu `published` (Yayınlandı)
//     etiketiyle işaretler. Katalogdaki tüm öğeler `published` olduğunda kuyruk
//     otomatik durdurulur ve 6 saatte bir yeni ürün kontrolü yapar.
//  3. Kuyrukta bekleyen başka görev kalmadıysa bir sonraki `unpublished`
//     (Yayınlanmamış) koleksiyonu/ürünü 3'lü grid olarak sıraya alır.
// ============================================================================

import {
  scanAndReplyInstagramComments,
  scanAndReplyInstagramDms,
  ensureInstagramAppSubscribed
} from '../Module 2/Instagram/bot-engine.js';
import GeminiBananaEngine from '../Module 2/gemini-banana-engine.js';
import {
  pickNextUnpublishedCatalogItem,
  markCatalogItemPublished,
  getNormalizedPostingSlots,
  syncSocialPublishRegistry
} from './_lib/social-publish-registry.js';
import { captureSentryException } from './_lib/observability.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/+$/, '');
const DEFAULT_MEDIA_FALLBACK = 'https://cdn.globalkapakmobilya.com/products/bahar-portmanto-ymz9.png';

function getSupabaseKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
}

async function sbRequest(path, options = {}) {
  const key = getSupabaseKey();
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const txt = await res.text().catch(() => '');
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  return { ok: res.ok, status: res.status, data };
}

async function fetchProductsCatalog() {
  const res = await sbRequest('/rest/v1/products?select=*&order=created_at.desc');
  return res.ok && Array.isArray(res.data) ? res.data : [];
}

async function saveInstaState(state) {
  await sbRequest('/rest/v1/site_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      key: 'insta_bot_state',
      data: state,
      updated_at: new Date().toISOString()
    })
  }).catch(() => {});
}

async function resolveCached3PostMedia(slug, postKey) {
  const res = await sbRequest('/rest/v1/site_settings?key=eq.module2_render_cache&select=data&limit=1');
  const cache = (res.ok && Array.isArray(res.data) && res.data[0]?.data) ? res.data[0].data : {};
  const matchingKey = Object.keys(cache)
    .filter(k => k.startsWith(`${slug}:three_post_v`))
    .sort((a, b) => String(cache[b]?.created_at || '').localeCompare(String(cache[a]?.created_at || '')))[0];
  if (!matchingKey) return null;
  const campaign = cache[matchingKey];
  return {
    campaign,
    post: campaign?.[postKey] || null
  };
}

async function metaGraphFetch(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const txt = await res.text().catch(() => '');
    let data = null;
    try { data = txt ? JSON.parse(txt) : {}; } catch { data = { _raw: txt }; }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForIgContainerReady(creationId, igAccessToken, isVideo = false) {
  const maxAttempts = isVideo ? 16 : 6;
  const intervalMs = 2500;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const stRes = await metaGraphFetch(
      `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status`,
      { headers: { Authorization: `Bearer ${igAccessToken}` } }
    );
    const code = stRes.data?.status_code;
    if (code === 'FINISHED') return true;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`Instagram medya işleme hatası (${code}): ${stRes.data?.status || JSON.stringify(stRes.data)}`);
    }
  }
  throw new Error('Instagram medya işleme zaman aşımı.');
}

async function publishInstagramQueueTask(task, { igUserId, igAccessToken }) {
  let { content_type, media_url, caption, hashtags, product_slug } = task;

  if (typeof media_url === 'string' && media_url.startsWith('auto_render_3post:')) {
    const [, targetSlug, postKey] = media_url.split(':');
    const resolved = await resolveCached3PostMedia(targetSlug || product_slug, postKey || 'post02');
    if (!resolved?.post) {
      throw new Error(`Önbellekte hazır 3'lü kampanya bulunamadı (${targetSlug}:${postKey}).`);
    }
    media_url = resolved.post.mediaUrlWithCover || resolved.post.mediaUrl || resolved.post.videoUrl;
    if (!caption) caption = resolved.post.caption;
    if (!hashtags) hashtags = resolved.post.hashtags;
  }

  const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n');
  const isCarousel = String(content_type || '').toUpperCase() === 'CAROUSEL' ||
    (typeof media_url === 'string' && media_url.trim().startsWith('['));

  if (isCarousel) {
    let items = [];
    try {
      items = JSON.parse(media_url);
    } catch (_) {
      items = String(media_url || '').split(',').map(s => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(items) || items.length < 2) {
      throw new Error('Carousel görevi için en az 2 geçerli görsel URL gerekli.');
    }

    const childIds = [];
    for (let i = 0; i < items.length; i++) {
      const p = new URLSearchParams();
      p.set('access_token', igAccessToken);
      p.set('is_carousel_item', 'true');
      p.set('image_url', items[i]);
      const r = await metaGraphFetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, { method: 'POST', body: p });
      if (!r.ok || !r.data?.id) {
        throw new Error(`Meta Carousel öğe hatası (${i + 1}): ${r.data?.error?.message || r.status}`);
      }
      childIds.push(r.data.id);
    }

    const cp = new URLSearchParams();
    cp.set('access_token', igAccessToken);
    cp.set('media_type', 'CAROUSEL');
    cp.set('children', childIds.join(','));
    cp.set('caption', fullCaption);
    const cr = await metaGraphFetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, { method: 'POST', body: cp });
    if (!cr.ok || !cr.data?.id) {
      throw new Error(`Meta Carousel container hatası: ${cr.data?.error?.message || cr.status}`);
    }

    await waitForIgContainerReady(cr.data.id, igAccessToken, false);

    const pp = new URLSearchParams({ creation_id: cr.data.id, access_token: igAccessToken });
    const pr = await metaGraphFetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, { method: 'POST', body: pp });
    if (!pr.ok || !pr.data?.id) {
      throw new Error(`Meta Carousel publish hatası: ${pr.data?.error?.message || pr.status}`);
    }
    return { platformPostId: pr.data.id, rawResponse: pr.data };
  }

  let cleanMediaUrl = String(media_url || '').trim();
  let coverUrl = '';
  if (cleanMediaUrl.includes('#cover=')) {
    const [vPart, cPart] = cleanMediaUrl.split('#cover=');
    cleanMediaUrl = vPart;
    try { coverUrl = decodeURIComponent(cPart || ''); } catch (_) { coverUrl = cPart || ''; }
  }

  const cType = String(content_type || 'POST').toUpperCase();
  const isVideo = cType === 'REELS' || /\.(mp4|mov)(\?.*)?$/i.test(cleanMediaUrl);
  const cp = new URLSearchParams();
  cp.set('access_token', igAccessToken);

  if (cType === 'REELS') {
    cp.set('media_type', 'REELS');
    cp.set('video_url', cleanMediaUrl);
    if (coverUrl && /^https:\/\//i.test(coverUrl)) cp.set('cover_url', coverUrl);
    cp.set('share_to_feed', 'true');
    cp.set('caption', fullCaption);
  } else if (cType === 'STORIES') {
    cp.set('media_type', 'STORIES');
    if (isVideo) cp.set('video_url', cleanMediaUrl);
    else cp.set('image_url', cleanMediaUrl);
  } else {
    cp.set('image_url', cleanMediaUrl);
    cp.set('caption', fullCaption);
  }

  const cr = await metaGraphFetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, { method: 'POST', body: cp });
  if (!cr.ok || !cr.data?.id) {
    throw new Error(`Meta Container hatası (${cType}): ${cr.data?.error?.message || cr.status}`);
  }

  await waitForIgContainerReady(cr.data.id, igAccessToken, isVideo);

  const pp = new URLSearchParams({ creation_id: cr.data.id, access_token: igAccessToken });
  const pr = await metaGraphFetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, { method: 'POST', body: pp });
  if (!pr.ok || !pr.data?.id) {
    throw new Error(`Meta Publish hatası (${cType}): ${pr.data?.error?.message || pr.status}`);
  }
  return { platformPostId: pr.data.id, rawResponse: pr.data };
}

function getIstanbulParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const g = t => (parts.find(p => p.type === t) || {}).value || '00';
  const todayStr = `${g('year')}-${g('month')}-${g('day')}`;
  const currentHHMM = `${g('hour')}:${g('minute')}`;
  return { todayStr, currentHHMM };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const stateRes = await sbRequest('/rest/v1/site_settings?key=eq.insta_bot_state&select=data');
    const state = (stateRes.ok && Array.isArray(stateRes.data) && stateRes.data[0]?.data) || { config: {}, scheduled_posts: [], conversations: [] };
    const config = state.config || {};

    const igUserId = config.ig_user_id || process.env.META_IG_USER_ID || process.env.IG_USER_ID || '';
    const igAccessToken = process.env.META_IG_ACCESS_TOKEN || process.env.IG_ACCESS_TOKEN || config.access_token || config.ig_access_token || '';

    // Yorum & DM tarama alt işlemi
    if (req.query && (req.query.action === 'scan_comments' || req.query.action === 'scan_dms')) {
      if (!igAccessToken || !igUserId) {
        return res.status(400).json({ ok: false, error: 'Meta Instagram tokenı veya kullanıcı ID eksik.' });
      }
      const catalog = await fetchProductsCatalog();
      await ensureInstagramAppSubscribed({ igUserId, accessToken: igAccessToken });
      const commentResults = await scanAndReplyInstagramComments({ igUserId, accessToken: igAccessToken, config, productsCatalog: catalog });
      const dmResults = await scanAndReplyInstagramDms({ igUserId, accessToken: igAccessToken, config, productsCatalog: catalog });
      return res.status(200).json({ ok: true, commentResults, dmResults });
    }

    const nowIso = new Date().toISOString();

    // ── ADIM 1: ZAMANI GELMİŞ KUYRUK GÖREVİNİ DOĞRUDAN INSTAGRAM'A YAYINLA ──
    const dueRes = await sbRequest(
      `/rest/v1/social_publish_queue?platform=eq.instagram&status=eq.pending&scheduled_for=lte.${encodeURIComponent(nowIso)}&order=scheduled_for.asc&limit=1`
    );
    const dueTask = dueRes.ok && Array.isArray(dueRes.data) ? dueRes.data[0] : null;

    if (dueTask) {
      if (!igUserId || !igAccessToken) {
        return res.status(200).json({
          ok: true,
          queued_task_waiting: dueTask.id,
          warning: 'META_IG_USER_ID veya META_IG_ACCESS_TOKEN eksik; görev bekliyor.'
        });
      }

      // Görevi processing durumuna al (mükerrer çalışmayı önle)
      const lockRes = await sbRequest(`/rest/v1/social_publish_queue?id=eq.${dueTask.id}&status=eq.pending`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'processing', updated_at: nowIso })
      });
      if (!lockRes.ok || !Array.isArray(lockRes.data) || lockRes.data.length === 0) {
        return res.status(200).json({ ok: true, skipped: true, reason: 'TASK_ALREADY_CLAIMED', task_id: dueTask.id });
      }

      try {
        const pubResult = await publishInstagramQueueTask(dueTask, { igUserId, igAccessToken });
        const doneIso = new Date().toISOString();

        await sbRequest(`/rest/v1/social_publish_queue?id=eq.${dueTask.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: 'published',
            platform_post_id: String(pubResult.platformPostId),
            platform_response: pubResult.rawResponse || {},
            published_at: doneIso,
            updated_at: doneIso
          })
        });

        // Admin paneli scheduled_posts listesini güncelle
        if (!Array.isArray(state.scheduled_posts)) state.scheduled_posts = [];
        const panelMatch = state.scheduled_posts.find(p =>
          p.queue_task_id === dueTask.id || p.queue_idempotency_key === dueTask.idempotency_key
        );
        if (panelMatch) {
          panelMatch.status = 'published';
          panelMatch.platform_post_id = String(pubResult.platformPostId);
          panelMatch.published_at = doneIso;
        } else {
          state.scheduled_posts.unshift({
            queue_task_id: dueTask.id,
            queue_idempotency_key: dueTask.idempotency_key,
            media_type: dueTask.content_type,
            slot_type: dueTask.slot_label,
            title: dueTask.product_slug,
            product_slug: dueTask.product_slug,
            caption: dueTask.caption,
            hashtags: dueTask.hashtags,
            media_url: dueTask.media_url,
            scheduled_for: dueTask.scheduled_for,
            status: 'published',
            platform_post_id: String(pubResult.platformPostId),
            published_at: doneIso
          });
        }
        state.scheduled_posts = state.scheduled_posts.slice(0, 80);
        await saveInstaState(state);

        // Bu koleksiyon için kuyrukta başka bekleyen Instagram görevi kalmadıysa 'Yayınlandı' etiketi bas
        const remRes = await sbRequest(
          `/rest/v1/social_publish_queue?platform=eq.instagram&product_slug=eq.${encodeURIComponent(dueTask.product_slug)}&status=in.(pending,processing)&select=id&limit=1`
        );
        const hasRemainingForSlug = remRes.ok && Array.isArray(remRes.data) && remRes.data.length > 0;
        let registrySummary = null;
        if (!hasRemainingForSlug && dueTask.product_slug) {
          const marked = await markCatalogItemPublished(dueTask.product_slug, {
            platform: 'instagram',
            queueTaskId: dueTask.id
          });
          registrySummary = marked?.summary || null;
        }

        return res.status(200).json({
          ok: true,
          published: true,
          task_id: dueTask.id,
          product_slug: dueTask.product_slug,
          content_type: dueTask.content_type,
          slot_label: dueTask.slot_label,
          platform_post_id: pubResult.platformPostId,
          registry_summary: registrySummary
        });
      } catch (pubErr) {
        await sbRequest(`/rest/v1/social_publish_queue?id=eq.${dueTask.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: 'failed',
            error_message: pubErr.message,
            updated_at: new Date().toISOString()
          })
        }).catch(() => {});
        await captureSentryException(pubErr, { tags: { module: 'instagram-cron', product_slug: dueTask.product_slug } }).catch(() => {});
        return res.status(500).json({ ok: false, error: pubErr.message, task_id: dueTask.id });
      }
    }

    // ── ADIM 2: GELECEK SAATE PLANLANMIŞ BEKLEYEN GÖREV VARSA YENİ EKLEME ───
    const upcomingRes = await sbRequest(
      '/rest/v1/social_publish_queue?platform=eq.instagram&status=eq.pending&order=scheduled_for.asc&limit=3'
    );
    const upcomingTasks = upcomingRes.ok && Array.isArray(upcomingRes.data) ? upcomingRes.data : [];
    if (upcomingTasks.length > 0) {
      await syncSocialPublishRegistry({ forceCheck: false }).catch(() => {});
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'WAITING_FOR_SCHEDULED_TIME',
        next_scheduled_for: upcomingTasks[0].scheduled_for,
        next_product_slug: upcomingTasks[0].product_slug,
        pending_count: upcomingTasks.length
      });
    }

    // ── ADIM 3: KUYRUK BOŞSA SONRAKİ YAYINLANMAMIŞ KOLEKSİYONU 3'LÜ GRID OLARAK EKLE ──
    const forceCheck = req.query && (req.query.force_check === '1' || req.query.force === '1');
    const selection = await pickNextUnpublishedCatalogItem({ platform: 'instagram', forceCheck });
    if (selection.paused || !selection.item) {
      return res.status(200).json({
        ok: true,
        paused: true,
        reason: selection.reason || 'ALL_PRODUCTS_PUBLISHED',
        message: 'Veritabanındaki tüm ürün ve koleksiyonlar "Yayınlandı" etiketine sahip. Kuyruk otomatik durduruldu; yeni ürün kontrolü 6 saatlik döngüde devam ediyor.',
        next_check_at: selection.next_check_at,
        auto_resume_interval_hours: selection.auto_resume_interval_hours,
        summary: selection.summary
      });
    }

    const { todayStr } = getIstanbulParts();
    const defaultSlots = [
      { name: 'slot_mo',  time: '10:00', type: 'REELS',    enabled: true },
      { name: 'slot_ga',  time: '14:30', type: 'CAROUSEL', enabled: true },
      { name: 'slot_ber', time: '19:30', type: 'REELS',    enabled: true }
    ];
    const slots = getNormalizedPostingSlots(config, defaultSlots);
    const pickedSlug = selection.item.slug;
    const cached3 = await resolveCached3PostMedia(pickedSlug, 'post03');

    if (cached3?.campaign?.post01 && cached3?.campaign?.post02 && cached3?.campaign?.post03) {
      const c = cached3.campaign;
      const t0 = slots[0]?.time || '10:00';
      const t1 = slots[1]?.time || '14:30';
      const t2 = slots[2]?.time || '19:30';
      const tripletDefs = [
        { postKey: 'post03', contentType: 'REELS', slotLabel: `${t0}_IG_1_MO`, time: t0, post: c.post03 },
        { postKey: 'post02', contentType: 'CAROUSEL', slotLabel: `${t1}_IG_2_GA`, time: t1, post: c.post02 },
        { postKey: 'post01', contentType: 'REELS', slotLabel: `${t2}_IG_3_BER`, time: t2, post: c.post01 }
      ];

      const records = tripletDefs.map(td => ({
        platform: 'instagram',
        content_type: td.contentType,
        slot_label: td.slotLabel,
        product_slug: pickedSlug,
        media_url: td.post.mediaUrlWithCover || td.post.mediaUrl || td.post.videoUrl,
        caption: td.post.caption || c.title || pickedSlug,
        hashtags: td.post.hashtags || '#novafurniture #thenovafurniture #minimalistmobilya',
        target_link: null,
        status: 'pending',
        idempotency_key: `instagram_${pickedSlug}_3grid_${td.postKey}_${todayStr}`.toLowerCase(),
        scheduled_for: new Date(`${todayStr}T${td.time}:00+03:00`).toISOString()
      }));

      const insRes = await sbRequest('/rest/v1/social_publish_queue?on_conflict=idempotency_key', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(records)
      });

      return res.status(200).json({
        ok: true,
        queued_triplet: true,
        product_slug: pickedSlug,
        inserted_count: Array.isArray(insRes.data) ? insRes.data.length : 0,
        scheduled_date: todayStr
      });
    }

    // Bağımsız ürün / önbelleksiz öğe fallback (GeminiBananaEngine)
    const catalog = await fetchProductsCatalog();
    const pickedProduct = catalog.find(p => p.slug === pickedSlug) || {
      slug: pickedSlug,
      title: selection.item.title,
      kategori: selection.item.category,
      ana_resim: selection.item.image_url || DEFAULT_MEDIA_FALLBACK
    };

    const campaign = await GeminiBananaEngine.buildAndSaveProductCampaign({
      product: pickedProduct,
      apiKey: process.env.GEMINI_API_KEY,
      allowFallback: true
    });

    const slotTime = slots[0]?.time || '14:30';
    const scheduledForIso = new Date(`${todayStr}T${slotTime}:00+03:00`).toISOString();
    const idempotencyKey = `instagram_${pickedProduct.slug}_post_${todayStr}_${slotTime.replace(':', '')}`.toLowerCase();

    const insSingle = await sbRequest('/rest/v1/social_publish_queue?on_conflict=idempotency_key', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({
        platform: 'instagram',
        content_type: 'POST',
        slot_label: slotTime,
        product_slug: pickedProduct.slug,
        media_url: campaign.post_image_url || pickedProduct.ana_resim || DEFAULT_MEDIA_FALLBACK,
        caption: campaign.caption,
        hashtags: campaign.hashtags || '#novafurniture #minimalistmobilya',
        status: 'pending',
        idempotency_key: idempotencyKey,
        scheduled_for: scheduledForIso
      })
    });

    return res.status(200).json({
      ok: true,
      queued: true,
      product_slug: pickedProduct.slug,
      inserted: Array.isArray(insSingle.data) ? insSingle.data[0] : null
    });
  } catch (err) {
    console.error('Instagram Cron Hatası:', err);
    await captureSentryException(err, { tags: { module: 'instagram-cron' } }).catch(() => {});
    return res.status(500).json({ ok: false, error: err.message });
  }
}

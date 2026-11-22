// ============================================================================
// NOVA FURNITURE / GLOBAL KAPAK MOBİLYA — INSTAGRAM 7 KOLEKSİYON YAYIN BAŞLATICI
// 1. Ön-bellekteki (veya eksikse render edilen) 7 koleksiyonun 3'lü kampanyalarını doğrular.
// 2. Gün 1 (Bergamo Kahve Köşesi) 3'lü gridini sırayla (MO Reels -> GA Carousel -> BER Reels)
//    Instagram Graph API v21.0 üzerinden CANLI yayınlar ve "Yayınlandı" etiketi basar.
// 3. Kalan 6 koleksiyonu (Lahey, Marsilya, Palermo, Toronto, Troyes, Bohem) sıradaki
//    6 güne (10:00 / 14:30 / 19:30 TRT) planlı `pending` görevler olarak kuyruğa alır.
// ============================================================================

import { createRequire } from 'node:module';
const require = createRequire(new URL('../Sunucu/publisher/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
import {
  buildCatalogEntities,
  produceCollectionThreePostCampaign
} from '../Sunucu/publisher/collection-format-engine.js';
import {
  markCatalogItemPublished,
  syncSocialPublishRegistry
} from '../api/_lib/social-publish-registry.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IG_USER_ID = process.env.META_IG_USER_ID;
const IG_ACCESS_TOKEN = process.env.META_IG_ACCESS_TOKEN;

if (!SUPABASE_KEY || !IG_USER_ID || !IG_ACCESS_TOKEN) {
  console.error('SUPABASE_SERVICE_ROLE_KEY, META_IG_USER_ID ve META_IG_ACCESS_TOKEN gerekli!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const ORDERED_SLUGS = [
  'bergamo-kahve-kosesi-61kf',
  'lahey-kahve-kosesi-7w0e',
  'marsilya-kahve-kosesi-peyn',
  'palermo-kahve-kosesi-i5ve',
  'toronto-kahve-kosesi-wxxh',
  'troyes-kahve-kosesi-n9m6',
  'bohem-dolap-koleksiyonu-f1g7'
];

function getIstanbulYmd(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const g = t => (parts.find(p => p.type === t) || {}).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

async function graphFetch(url, options = {}) {
  const res = await fetch(url, options);
  const txt = await res.text().catch(() => '');
  let data = {};
  try { data = txt ? JSON.parse(txt) : {}; } catch { data = { _raw: txt }; }
  return { ok: res.ok, status: res.status, data };
}

async function waitContainer(creationId, isVideo = false) {
  const max = isVideo ? 36 : 12;
  for (let i = 0; i < max; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const r = await graphFetch(
      `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status`,
      { headers: { Authorization: `Bearer ${IG_ACCESS_TOKEN}` } }
    );
    const code = r.data?.status_code;
    if (code === 'FINISHED') return true;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`IG container failed (${code}): ${JSON.stringify(r.data)}`);
    }
  }
  throw new Error(`IG container timeout (${creationId})`);
}

async function publishLiveToInstagram({ contentType, mediaUrl, caption, hashtags }) {
  const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n');

  if (contentType === 'CAROUSEL') {
    const slides = typeof mediaUrl === 'string' && mediaUrl.trim().startsWith('[')
      ? JSON.parse(mediaUrl)
      : [mediaUrl];
    const childIds = [];
    for (let i = 0; i < slides.length; i++) {
      const p = new URLSearchParams({
        access_token: IG_ACCESS_TOKEN,
        is_carousel_item: 'true',
        image_url: slides[i]
      });
      const r = await graphFetch(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, { method: 'POST', body: p });
      if (!r.ok || !r.data?.id) throw new Error(`Carousel item ${i + 1} err: ${JSON.stringify(r.data)}`);
      childIds.push(r.data.id);
    }
    const cp = new URLSearchParams({
      access_token: IG_ACCESS_TOKEN,
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption: fullCaption
    });
    const cr = await graphFetch(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, { method: 'POST', body: cp });
    if (!cr.ok || !cr.data?.id) throw new Error(`Carousel container err: ${JSON.stringify(cr.data)}`);
    await waitContainer(cr.data.id, false);
    const pr = await graphFetch(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ access_token: IG_ACCESS_TOKEN, creation_id: cr.data.id })
    });
    if (!pr.ok || !pr.data?.id) throw new Error(`Carousel publish err: ${JSON.stringify(pr.data)}`);
    return pr.data;
  }

  let videoUrl = String(mediaUrl || '').trim();
  let coverUrl = '';
  if (videoUrl.includes('#cover=')) {
    const [v, c] = videoUrl.split('#cover=');
    videoUrl = v;
    try { coverUrl = decodeURIComponent(c || ''); } catch { coverUrl = c || ''; }
  }
  const cp = new URLSearchParams({
    access_token: IG_ACCESS_TOKEN,
    media_type: 'REELS',
    video_url: videoUrl,
    share_to_feed: 'true',
    caption: fullCaption
  });
  if (coverUrl && /^https:\/\//i.test(coverUrl)) cp.set('cover_url', coverUrl);
  const cr = await graphFetch(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, { method: 'POST', body: cp });
  if (!cr.ok || !cr.data?.id) throw new Error(`Reels container err: ${JSON.stringify(cr.data)}`);
  await waitContainer(cr.data.id, true);
  const pr = await graphFetch(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ access_token: IG_ACCESS_TOKEN, creation_id: cr.data.id })
  });
  if (!pr.ok || !pr.data?.id) throw new Error(`Reels publish err: ${JSON.stringify(pr.data)}`);
  return pr.data;
}

async function main() {
  const skipLive = process.argv.includes('--schedule-only');
  const day1Only = process.argv.includes('--day1-only');
  const restOnly = process.argv.includes('--rest-only');

  const [{ data: products }, { data: extRow }, { data: instaRow }] = await Promise.all([
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('site_settings').select('data').eq('key', 'module7_extended_catalog').maybeSingle(),
    supabase.from('site_settings').select('data').eq('key', 'insta_bot_state').maybeSingle()
  ]);

  const entities = buildCatalogEntities(products || [], extRow?.data || {}, {});
  const instaState = instaRow?.data || { config: {}, rules: [], scheduled_posts: [], conversations: [] };
  const slots = Array.isArray(instaState.config?.posting_slots) && instaState.config.posting_slots.length >= 3
    ? instaState.config.posting_slots
    : [{ time: '10:00' }, { time: '14:30' }, { time: '19:30' }];

  const t0Slot = slots[0]?.time || '10:00';
  const t1Slot = slots[1]?.time || '14:30';
  const t2Slot = slots[2]?.time || '19:30';

  if (!restOnly) {
    await supabase.from('site_settings').upsert({
      key: 'instagram_published_tracker',
      data: {},
      updated_at: new Date().toISOString()
    });
    await syncSocialPublishRegistry({ forceCheck: true });
    await supabase.from('social_publish_queue').delete().eq('platform', 'instagram').eq('status', 'pending');
  }

  const panelPosts = restOnly && Array.isArray(instaState.scheduled_posts)
    ? instaState.scheduled_posts.filter(p => p.status === 'published')
    : [];

  const startIdx = restOnly ? 1 : 0;
  const endIdx = day1Only ? 1 : ORDERED_SLUGS.length;

  for (let dayIdx = startIdx; dayIdx < endIdx; dayIdx++) {
    const slug = ORDERED_SLUGS[dayIdx];
    const entity = entities.find(e => e.slug === slug);
    if (!entity) continue;

    console.log(`\n📦 [Gün ${dayIdx + 1}/7] ${entity.title} (${slug})`);
    const campaign = await produceCollectionThreePostCampaign({ supabase, entity, log: m => console.log(`  ${m}`) });
    const ymd = getIstanbulYmd(dayIdx === 0 && !skipLive ? 0 : dayIdx + (skipLive ? 0 : 0));
    const scheduleYmd = getIstanbulYmd(dayIdx);

    const triplet = [
      { key: 'post03', type: 'REELS', slotLabel: `${t0Slot}_IG_1_MO`, time: t0Slot, p: campaign.post03 },
      { key: 'post02', type: 'CAROUSEL', slotLabel: `${t1Slot}_IG_2_GA`, time: t1Slot, p: campaign.post02 },
      { key: 'post01', type: 'REELS', slotLabel: `${t2Slot}_IG_3_BER`, time: t2Slot, p: campaign.post01 }
    ];

    if (dayIdx === 0 && !skipLive) {
      // GÜN 1 KICKOFF: İlk koleksiyonun 3'lü gridini sırayla (1. MO Reels -> 2. GA Carousel -> 3. BER Reels) CANLI yayınla!
      for (let i = 0; i < triplet.length; i++) {
        const step = triplet[i];
        const mUrl = step.p.mediaUrlWithCover || step.p.mediaUrl || step.p.videoUrl;
        console.log(`  🚀 [${i + 1}/3] Instagram'a yayınlanıyor: ${step.slotLabel} (${step.type})...`);
        const pub = await publishLiveToInstagram({
          contentType: step.type,
          mediaUrl: mUrl,
          caption: step.p.caption,
          hashtags: step.p.hashtags
        });
        const nowIso = new Date().toISOString();
        const idemKey = `instagram_${slug}_3grid_${step.key}_${ymd}`.toLowerCase();
        const { data: qRow } = await supabase.from('social_publish_queue').upsert({
          platform: 'instagram',
          content_type: step.type,
          slot_label: step.slotLabel,
          product_slug: slug,
          media_url: mUrl,
          caption: step.p.caption,
          hashtags: step.p.hashtags,
          status: 'published',
          idempotency_key: idemKey,
          scheduled_for: nowIso,
          published_at: nowIso,
          platform_post_id: String(pub.id),
          platform_response: pub
        }, { onConflict: 'idempotency_key' }).select('id').single();

        panelPosts.push({
          id: `${slug}_${step.key}`,
          queue_task_id: qRow?.id || null,
          queue_idempotency_key: idemKey,
          media_type: step.type,
          slot_type: step.slotLabel,
          title: `${entity.title} (${step.key.toUpperCase()})`,
          caption: step.p.caption,
          hashtags: step.p.hashtags,
          media_url: step.p.coverUrl || mUrl,
          product_slug: slug,
          scheduled_for: nowIso,
          published_at: nowIso,
          platform_post_id: String(pub.id),
          status: 'published'
        });
        console.log(`  ✅ Yayınlandı -> IG Post ID: ${pub.id}`);
        if (i < triplet.length - 1) await new Promise(r => setTimeout(r, 4000));
      }

      await markCatalogItemPublished(slug, { platform: 'instagram' });
      console.log(`  🏷️ "${slug}" -> Yayınlandı (published) etiketlendi.`);
    } else {
      // GÜN 2..7: Kuyruğa planlı 'pending' görevler olarak ekle
      for (const step of triplet) {
        const mUrl = step.p.mediaUrlWithCover || step.p.mediaUrl || step.p.videoUrl;
        const scheduledIso = new Date(`${scheduleYmd}T${step.time}:00+03:00`).toISOString();
        const idemKey = `instagram_${slug}_3grid_${step.key}_${scheduleYmd}`.toLowerCase();
        const { data: qRow } = await supabase.from('social_publish_queue').upsert({
          platform: 'instagram',
          content_type: step.type,
          slot_label: step.slotLabel,
          product_slug: slug,
          media_url: mUrl,
          caption: step.p.caption,
          hashtags: step.p.hashtags,
          status: 'pending',
          idempotency_key: idemKey,
          scheduled_for: scheduledIso
        }, { onConflict: 'idempotency_key' }).select('id').single();

        panelPosts.push({
          id: `${slug}_${step.key}`,
          queue_task_id: qRow?.id || null,
          queue_idempotency_key: idemKey,
          media_type: step.type,
          slot_type: step.slotLabel,
          title: `${entity.title} (${step.key.toUpperCase()})`,
          caption: step.p.caption,
          hashtags: step.p.hashtags,
          media_url: step.p.coverUrl || mUrl,
          product_slug: slug,
          scheduled_for: scheduledIso,
          status: 'pending'
        });
      }
      console.log(`  📅 Planlandı (${scheduleYmd}): ${t0Slot} MO Reels | ${t1Slot} GA Carousel | ${t2Slot} BER Reels`);
    }

    // Her koleksiyon bittiğinde panel durumunu anında güncelle
    instaState.scheduled_posts = panelPosts.slice(0, 80);
    instaState.config = { ...instaState.config, auto_publish_enabled: true };
    await supabase.from('site_settings').upsert({
      key: 'insta_bot_state',
      data: instaState,
      updated_at: new Date().toISOString()
    });
  }

  const reg = await syncSocialPublishRegistry({ forceCheck: true });
  console.log('\n====================================================================');
  console.log('TAMAMLANDI! Güncel Yayın Etiket Özeti:', JSON.stringify(reg.summary));
}

main().catch(err => {
  console.error('❌ Başlatma hatası:', err);
  process.exit(1);
});

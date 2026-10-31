// ============================================================================
// Nova Furniture (@thenovafurniture) — Instagram Autonomous Scheduler
// Endpoint: https://insta-deployment-rho.vercel.app/api/instagram-cron
// ============================================================================
// YAYINLAMA MİMARİSİ:
// 1. Cron doğrudan Meta Graph API'ye yayın YAPMAZ!
// 2. Ürün seçimi, içerik üretimi ve Gemini Banana mimari görsel hazırlığı yapar.
// 3. Görevleri 'social_publish_queue' SQL tablosuna deterministik idempotency_key
//    ve gerçek planlanan yayın saati (scheduled_for) ile ekler.
// 4. Görevler 'pending' olarak bırakılır; Meta yayınını VPS worker gerçekleştirir.
// ============================================================================
import {
  scanAndReplyInstagramComments,
  scanAndReplyInstagramDms,
  ensureInstagramAppSubscribed
} from '../Module 2/Instagram/bot-engine.js';
import GeminiBananaEngine from '../gemini-banana-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';
const DEFAULT_MEDIA_FALLBACK = 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/bahar-portmanto-ymz9.png';

async function fetchProductsCatalog() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.desc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.warn('Ürün kataloğu çekme hatası:', err);
  }
  return [];
}

async function saveInstaState(state) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/site_settings`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        key: 'insta_bot_state',
        data: state,
        updated_at: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn('Insta bot durumu kaydedilemedi:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.insta_bot_state&select=data`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const rows = stateRes.ok ? await stateRes.json() : [];
    const state = (rows && rows[0] && rows[0].data) || { config: {}, scheduled_posts: [], conversations: [] };
    const config = state.config || {};

    // Yorum ve DM Tarama / Otomatik Yanıtlama İsteği (Opsiyonel alt servis)
    if (req.query && (req.query.action === 'scan_comments' || req.query.action === 'scan_dms')) {
      const catalog = await fetchProductsCatalog();
      const igUserId = config.ig_user_id || process.env.META_IG_USER_ID || process.env.IG_USER_ID || '';
      const accessToken = config.access_token || config.ig_access_token || process.env.META_IG_ACCESS_TOKEN || process.env.IG_ACCESS_TOKEN || '';
      
      if (!accessToken || !igUserId) {
        return res.status(400).json({ ok: false, error: 'Meta Instagram tokenı veya kullanıcı ID eksik (yalnızca env üzerinden sağlanmalıdır).' });
      }

      await ensureInstagramAppSubscribed({ igUserId, accessToken });

      const commentResults = await scanAndReplyInstagramComments({
        igUserId,
        accessToken,
        config,
        productsCatalog: catalog
      });

      const dmResults = await scanAndReplyInstagramDms({
        igUserId,
        accessToken,
        config,
        productsCatalog: catalog
      });

      return res.status(200).json({ ok: true, commentResults, dmResults });
    }

    // ── OTONOM PLANLAMA VE SOCIAL_PUBLISH_QUEUE KUYRUĞUNA EKLEME ─────────────
    const catalog = await fetchProductsCatalog();
    if (!catalog || catalog.length === 0) {
      return res.status(200).json({ ok: true, message: 'Katalogda ürün bulunamadı.' });
    }

    const now = new Date();
    // Türkiye Yerel Saati (UTC+3)
    const trOffset = 3 * 60;
    const localNow = new Date(now.getTime() + (trOffset + now.getTimezoneOffset()) * 60000);
    const todayStr = localNow.toISOString().slice(0, 10); // YYYY-MM-DD
    const currentHHMM = `${String(localNow.getHours()).padStart(2, '0')}:${String(localNow.getMinutes()).padStart(2, '0')}`;

    const dynamicSlots = (config && Array.isArray(config.posting_slots) && config.posting_slots.length > 0)
      ? config.posting_slots.filter(s => s.enabled !== false && s.active !== false).map(s => ({ name: s.type, time: s.time, type: s.type }))
      : [];
    const slots = dynamicSlots.length > 0 ? dynamicSlots : [
      { name: 'morning_reels', time: '10:00', type: 'REELS' },
      { name: 'midday_post',   time: '14:30', type: 'POST' },
      { name: 'evening_story', time: '20:00', type: 'STORIES' }
    ];

    // Tetikleme modu: Belirli slot mu istendi yoksa saate göre en yakın slot mu?
    const forceType = req.query && req.query.type ? String(req.query.type).toUpperCase() : null;
    let activeSlot = null;

    if (forceType) {
      activeSlot = slots.find(s => s.type === forceType) || { name: 'forced_slot', time: currentHHMM, type: forceType };
    } else {
      // Mevcut saate uyan veya henüz tetiklenmemiş ilk slot
      for (const s of slots) {
        if (s.last_run_date !== todayStr) {
          activeSlot = s;
          break;
        }
      }
      if (!activeSlot) activeSlot = slots[1]; // Varsayılan: midday_post
    }

    const chosenType = activeSlot.type || 'POST';

    // Günün ürünü seçimi: Yılın gününe göre deterministik dağılım
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const pickedProduct = catalog[dayOfYear % catalog.length];

    if (!pickedProduct || !pickedProduct.slug) {
      return res.status(400).json({ ok: false, error: 'Ürün seçilemedi veya ürün slug eksik.' });
    }

    // Gemini Banana Mimari Kampanyasını Al / Üret
    let campaign = await GeminiBananaEngine.fetchActiveCampaignFromSupabase('instagram');
    const hasInvalidMedia = c => !c
      || /\.svg(\?.*)?$/i.test(c.post_image_url || '')
      || /\.svg(\?.*)?$/i.test(c.story_image_url || '')
      || !c.post_image_url;

    if (!campaign || campaign.product_slug !== pickedProduct.slug || hasInvalidMedia(campaign)) {
      try {
        campaign = await GeminiBananaEngine.buildAndSaveProductCampaign({
          product: pickedProduct,
          apiKey: process.env.GEMINI_API_KEY,
          allowFallback: true
        });
      } catch (genErr) {
        console.error('[Instagram Cron] Gemini Banana görsel üretimi başarısız:', genErr.message);
        return res.status(500).json({
          ok: false,
          error: `Görsel üretimi başarısız: ${genErr.message}`,
          product_slug: pickedProduct.slug
        });
      }
    }

    // Slota göre doğru varlığı seç (Meta yalnızca PNG/JPG ve MP4 kabul eder)
    const notSvg = u => (u && !/\.svg(\?.*)?$/i.test(u)) ? u : null;
    const imageFallback = pickedProduct.ana_resim && /^https?:\/\//.test(pickedProduct.ana_resim)
      ? pickedProduct.ana_resim
      : DEFAULT_MEDIA_FALLBACK;

    let finalType = chosenType;
    let targetMediaUrl = notSvg(campaign.post_image_url) || imageFallback;

    if (chosenType === 'REELS') {
      const isVideoUrl = u => /\.(mp4|mov)(\?.*)?$/i.test(u || '');
      const productVideo = [campaign.reels_video_url, pickedProduct.video_url].find(isVideoUrl);
      if (productVideo) {
        targetMediaUrl = productVideo;
      } else {
        finalType = 'POST';
        targetMediaUrl = notSvg(campaign.banana_hero_url) || notSvg(campaign.post_image_url) || imageFallback;
      }
    } else if (chosenType === 'STORIES') {
      targetMediaUrl = notSvg(campaign.story_image_url) || notSvg(campaign.post_image_url) || imageFallback;
    }

    // ── GERÇEK PLANLANAN YAYIN SAATİ HESAPLAMASI ────────────────────────────
    // scheduled_for cron tetiklenme anını DEĞİL, gerçek planlanan slot saatini temsil eder!
    const targetDate = new Date();
    const [slotH, slotM] = (activeSlot.time || '14:30').split(':').map(Number);
    targetDate.setHours(slotH || 14, slotM || 30, 0, 0);
    const scheduledForIso = targetDate.toISOString();

    // ── DETERMINİSTİK IDEMPOTENCY KEY OLUŞTURMA ─────────────────────────────
    // platform, product_slug, content_type, tarih ve slot için tekil anahtar
    const slotCode = (activeSlot.time || '1430').replace(':', '');
    const idempotencyKey = `instagram_${pickedProduct.slug}_${finalType}_${todayStr}_${slotCode}`.toLowerCase();

    // ── SOCIAL_PUBLISH_QUEUE KONTROLÜ VE EKLEME ─────────────────────────────
    // 1. Zaten kuyrukta bu anahtarla bir görev var mı?
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/social_publish_queue?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,scheduled_for`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const existingRows = checkRes.ok ? await checkRes.json() : [];
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      console.log(`[Instagram Cron] Idempotency: Görev zaten kuyrukta (${idempotencyKey}), mükerrer eklenmedi.`);
      return res.status(200).json({
        ok: true,
        duplicate_prevented: true,
        idempotency_key: idempotencyKey,
        existing_status: existingRows[0].status,
        scheduled_for: existingRows[0].scheduled_for,
        message: 'Mükerrer görev engellendi; kuyrukta zaten kayıtlı.'
      });
    }

    // 2. Yeni görevi social_publish_queue tablosuna PENDING olarak ekle
    const queuePayload = {
      platform: 'instagram',
      content_type: finalType,
      slot_label: activeSlot.time || '14:30',
      product_slug: pickedProduct.slug,
      media_url: targetMediaUrl,
      caption: campaign.caption,
      hashtags: campaign.hashtags || '#novafurniture #minimalistmobilya #icmimari',
      target_link: null,
      status: 'pending', // KRİTİK: Asla 'published' olarak işaretlenmez!
      idempotency_key: idempotencyKey,
      scheduled_for: scheduledForIso
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/social_publish_queue`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(queuePayload)
    });

    if (!insertRes.ok) {
      const errTxt = await insertRes.text().catch(() => '');
      console.error('[Instagram Cron] Kuyruğa yazma hatası:', errTxt);
      return res.status(500).json({ ok: false, error: `social_publish_queue ekleme hatası: ${errTxt}` });
    }

    const insertedRows = await insertRes.json().catch(() => []);
    const queueTaskId = insertedRows && insertedRows[0] && insertedRows[0].id;

    // ── ADMİN PANELİ DURUM SENKRONİZASYONU ─────────────────────────────────
    // scheduled_posts listesine 'pending' durumuyla eklenir
    activeSlot.last_run_date = todayStr;
    activeSlot.last_run_time = currentHHMM;

    const panelPostRecord = {
      id: campaign.id,
      queue_task_id: queueTaskId,
      queue_idempotency_key: idempotencyKey,
      media_type: finalType,
      slot_type: chosenType,
      title: campaign.product_title || pickedProduct.title,
      caption: campaign.caption,
      hashtags: campaign.hashtags,
      media_url: targetMediaUrl,
      auto_designed: true,
      product_slug: pickedProduct.slug,
      scheduled_for: scheduledForIso,
      status: 'pending', // Admin panelinde 'bekliyor' (pending) olarak görünür
      banana_campaign_id: campaign.id
    };

    if (!Array.isArray(state.scheduled_posts)) state.scheduled_posts = [];
    state.scheduled_posts.unshift(panelPostRecord);
    state.scheduled_posts = state.scheduled_posts.slice(0, 60);
    await saveInstaState(state);

    return res.status(200).json({
      ok: true,
      queued: true,
      platform: 'instagram',
      queue_task_id: queueTaskId,
      product_slug: pickedProduct.slug,
      content_type: finalType,
      idempotency_key: idempotencyKey,
      scheduled_for: scheduledForIso,
      status: 'pending',
      media_url: targetMediaUrl
    });
  } catch (err) {
    console.error('Instagram Cron Hatası:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

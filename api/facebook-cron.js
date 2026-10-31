import isAuthorizedCronRequest from '../lib/cron-auth.js';
// ============================================================================
// Nova Furniture (@thenovafurniture) — Facebook Autonomous Scheduler
// Endpoint: https://insta-deployment-rho.vercel.app/api/facebook-cron
// ============================================================================
// YAYINLAMA MİMARİSİ:
// 1. Cron doğrudan Meta Facebook Graph API'ye yayın YAPMAZ!
// 2. Ürün seçimi, içerik üretimi ve Gemini Banana mimari görsel hazırlığı yapar.
// 3. Görevleri 'social_publish_queue' SQL tablosuna deterministik idempotency_key
//    ve gerçek planlanan yayın saati (scheduled_for) ile ekler.
// 4. Görevler 'pending' olarak bırakılır; Meta yayınını VPS worker gerçekleştirir.
// ============================================================================
import GeminiBananaEngine from '../gemini-banana-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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
  } catch (_) {}
  return [];
}

async function saveFbState(state) {
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
        key: 'fb_bot_state',
        data: state,
        updated_at: new Date().toISOString()
      })
    });
  } catch (_) {}
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  if (!process.env.CRON_SECRET) {
    return res.status(503).json({ ok: false, error: 'CRON_SECRET yapılandırılmamış; zamanlayıcı güvenlik nedeniyle kapalı.' });
  }
  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  try {
    if (!SUPABASE_KEY) return res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY tanımlı değil; kuyruk işlemi durduruldu.' });
    const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.fb_bot_state&select=data`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const rows = stateRes.ok ? await stateRes.json() : [];
    const state = (rows && rows[0] && rows[0].data) || { config: {}, scheduled_posts: [], conversations: [] };

    // ── OTONOM PLANLAMA VE SOCIAL_PUBLISH_QUEUE KUYRUĞUNA EKLEME ─────────────
    const catalog = await fetchProductsCatalog();
    if (!catalog || catalog.length === 0) {
      return res.status(200).json({ ok: true, message: 'Katalogda ürün bulunamadı.' });
    }

    const now = new Date();
    const trParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).reduce((a,p) => (a[p.type]=p.value,a), {});
    const todayStr = `${trParts.year}-${trParts.month}-${trParts.day}`;
    const currentHHMM = `${trParts.hour}:${trParts.minute}`;
    const dayOfYear = Math.floor((Date.UTC(+trParts.year,+trParts.month-1,+trParts.day)-Date.UTC(+trParts.year,0,1))/86400000);

    const slots = [
      { name: 'fb_morning_post', time: '11:00', type: 'PHOTO_POST' },
      { name: 'fb_midday_post',  time: '14:00', type: 'PHOTO_POST' },
      { name: 'fb_evening_post', time: '18:00', type: 'PHOTO_POST' }
    ];

    const forceType = req.query && req.query.type ? String(req.query.type).toUpperCase() : null;
    let activeSlot = null;

    if (forceType) {
      activeSlot = slots.find(s => s.type === forceType) || { name: 'forced_slot', time: currentHHMM, type: forceType };
    } else {
      for (const s of slots) {
        if (s.last_run_date !== todayStr) {
          activeSlot = s;
          break;
        }
      }
      if (!activeSlot) activeSlot = slots[0];
    }

    const chosenType = activeSlot.type || 'PHOTO_POST';
    if (chosenType === 'VIDEO_REELS' || chosenType === 'REELS') return res.status(400).json({ ok: false, error: 'Facebook Reels/video publisher henüz desteklenmediği için görev oluşturulmadı.' });

    // Günün ürünü seçimi: Yılın gününe göre deterministik dağılım
    const pickedProduct = catalog[dayOfYear % catalog.length];

    if (!pickedProduct || !pickedProduct.slug) {
      return res.status(400).json({ ok: false, error: 'Ürün seçilemedi veya ürün slug eksik.' });
    }

    // Gemini Banana Mimari Üretim Pipeline'ından Varlığı Çek
    let campaign = await GeminiBananaEngine.fetchActiveCampaignFromSupabase('facebook');
    const hasInvalidMedia = c => !c
      || /\.svg(\?.*)?$/i.test(c.post_image_url || '')
      || !c.post_image_url;

    if (!campaign || campaign.product_slug !== pickedProduct.slug || hasInvalidMedia(campaign)) {
      try {
        campaign = await GeminiBananaEngine.buildAndSaveProductCampaign({
          product: pickedProduct,
          apiKey: process.env.GEMINI_API_KEY,
          allowFallback: false
        });
      } catch (genErr) {
        console.error('[Facebook Cron] Gemini Banana görsel üretimi başarısız:', genErr.message);
        return res.status(500).json({
          ok: false,
          error: `Görsel üretimi başarısız: ${genErr.message}`,
          product_slug: pickedProduct.slug
        });
      }
    }

    const finalType = 'PHOTO_POST';
    const targetMediaUrl = campaign.post_image_url;

    // ── GERÇEK PLANLANAN YAYIN SAATİ HESAPLAMASI ────────────────────────────
    const slotTime = activeSlot.time || '12:00';
    const slotIso = (dateStr) => new Date(`${dateStr}T${slotTime}:00+03:00`).toISOString();
    let scheduledForIso = slotIso(todayStr);
    if (new Date(scheduledForIso).getTime() <= now.getTime()) {
      const nextDay = new Date(Date.UTC(+trParts.year,+trParts.month-1,+trParts.day+1));
      const nextDate = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth()+1).padStart(2,'0')}-${String(nextDay.getUTCDate()).padStart(2,'0')}`;
      scheduledForIso = slotIso(nextDate);
    }

    // ── DETERMINİSTİK IDEMPOTENCY KEY OLUŞTURMA ─────────────────────────────
    const slotCode = (activeSlot.time || '1200').replace(':', '');
    const idempotencyKey = `facebook_${pickedProduct.slug}_${finalType}_${todayStr}_${slotCode}`.toLowerCase();

    // ── SOCIAL_PUBLISH_QUEUE KONTROLÜ VE EKLEME ─────────────────────────────
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/social_publish_queue?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,status,scheduled_for`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!checkRes.ok) throw new Error(`Idempotency kontrolü başarısız (HTTP ${checkRes.status}).`);
    const existingRows = await checkRes.json();
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      console.log(`[Facebook Cron] Idempotency: Görev zaten kuyrukta (${idempotencyKey}), mükerrer eklenmedi.`);
      return res.status(200).json({
        ok: true,
        duplicate_prevented: true,
        idempotency_key: idempotencyKey,
        existing_status: existingRows[0].status,
        scheduled_for: existingRows[0].scheduled_for,
        message: 'Mükerrer görev engellendi; kuyrukta zaten kayıtlı.'
      });
    }

    const queuePayload = {
      platform: 'facebook',
      content_type: finalType,
      slot_label: activeSlot.time || '12:00',
      product_slug: pickedProduct.slug,
      media_url: targetMediaUrl,
      caption: campaign.caption,
      hashtags: campaign.hashtags || '#novafurniture #minimalistmobilya',
      target_link: 'https://wa.me/905050151035',
      status: 'pending',
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
      if (insertRes.status === 409 || /23505|duplicate key/i.test(errTxt)) {
        return res.status(200).json({ ok: true, duplicate_prevented: true, idempotency_key: idempotencyKey, message: 'Eşzamanlı istek nedeniyle mükerrer görev engellendi.' });
      }
      console.error('[Facebook Cron] Kuyruğa yazma hatası:', errTxt);
      return res.status(500).json({ ok: false, error: `social_publish_queue ekleme hatası: ${errTxt}` });
    }

    const insertedRows = await insertRes.json().catch(() => []);
    const queueTaskId = insertedRows && insertedRows[0] && insertedRows[0].id;

    // ── ADMİN PANELİ DURUM SENKRONİZASYONU ─────────────────────────────────
    activeSlot.last_run_date = todayStr;
    activeSlot.last_run_time = currentHHMM;

    const panelPostRecord = {
      id: campaign.id,
      queue_task_id: queueTaskId,
      queue_idempotency_key: idempotencyKey,
      media_type: finalType,
      slot_type: chosenType,
      title: campaign.product_title || pickedProduct.title,
      target_link: 'https://wa.me/905050151035',
      caption: campaign.caption,
      hashtags: campaign.hashtags,
      media_url: targetMediaUrl,
      auto_designed: true,
      product_slug: pickedProduct.slug,
      scheduled_for: scheduledForIso,
      status: 'pending', // Admin panelinde 'bekliyor' (pending) görünür
      banana_campaign_id: campaign.id
    };

    if (!Array.isArray(state.scheduled_posts)) state.scheduled_posts = [];
    state.scheduled_posts.unshift(panelPostRecord);
    state.scheduled_posts = state.scheduled_posts.slice(0, 60);
    await saveFbState(state);

    return res.status(200).json({
      ok: true,
      queued: true,
      platform: 'facebook',
      queue_task_id: queueTaskId,
      product_slug: pickedProduct.slug,
      content_type: finalType,
      idempotency_key: idempotencyKey,
      scheduled_for: scheduledForIso,
      status: 'pending',
      media_url: targetMediaUrl
    });
  } catch (err) {
    console.error('Facebook Cron Hatası:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

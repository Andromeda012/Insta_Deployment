/**
 * NOVA FURNITURE — VPS UNIFIED AUTONOMOUS SCHEDULER (publisher/scheduler.js)
 * ============================================================================
 * MİMARİ İLKELERİ:
 * 1. Tek Yetkili Zamanlama Kaynağı:
 *    Yönetim paneli tarafından Supabase `site_settings` tablosuna yazılan
 *    `insta_bot_state` ve `fb_bot_state` kayıtlarını düzenli olarak okur.
 * 2. Dinamik Algılama (Sıfır Yeniden Başlatma):
 *    Panelden saat veya aktif/pasif durumu değiştirildiğinde, VPS servisi
 *    yeniden başlatılmadan yeni saatleri otomatik olarak uygular.
 * 3. Europe/Istanbul Saat Dilimi Güvencesi:
 *    Sunucu (VPS veya Docker) saati UTC olsa dahi, tüm slot zamanlamaları
 *    kesin olarak Europe/Istanbul (UTC+3) üzerinden hesaplanır.
 * 4. Mükerrer Görev Engelleme & Deterministik Idempotency:
 *    Her slot ve gün için tekil `idempotency_key` üretilir. Aynı slot için
 *    aynı gün ikinci bir görev oluşturulması veritabanı seviyesinde imkansızdır.
 * 5. Akıllı Ürün Dağıtımı:
 *    Katalogdaki ürünlerin format bazında (POST, STORIES, REELS) yayın geçmişi
 *    takip edilir. Henüz yayınlanmamış ürünlere öncelik verilir.
 * 6. Gemini Banana Güvencesi:
 *    Görsel üretiminde Gemini Banana kullanılır. API anahtarı yoksa veya hata
 *    alınırsa sessizce mock üretilmez; gerçek katalog görseline kontrollü fallback yapılır.
 * ============================================================================
 */

import GeminiBananaEngine from './gemini-banana-engine.js';

const EXCLUDED_PRODUCT_SLUGS = new Set(['bahar-portmanto']);

/**
 * Europe/Istanbul Saat Dilimi Hesaplayıcısı
 * Sunucunun yerel saati ne olursa olsun kesin UTC+3 Türkiye saatini üretir.
 */
export function getIstanbulTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(d);
  const get = type => (parts.find(p => p.type === type) || {}).value;

  const yyyy = get('year');
  const mm = get('month');
  const dd = get('day');
  const hours = get('hour') || '00';
  const minutes = get('minute') || '00';
  const seconds = get('second') || '00';

  const dateStr = `${yyyy}-${mm}-${dd}`;
  const timeStr = `${hours}:${minutes}`;

  return {
    dateStr,
    timeStr,
    hours: parseInt(hours, 10),
    minutes: parseInt(minutes, 10),
    seconds: parseInt(seconds, 10),
    isoIstanbul: `${dateStr}T${timeStr}:${seconds}+03:00`
  };
}

/**
 * Belirli bir tarih ve saat için Istanbul bazlı UTC ISO string üretir
 */
export function getIstanbulSlotIso(dateStr, timeStr) {
  const [h, m] = (timeStr || '12:00').split(':').map(x => String(x).padStart(2, '0'));
  // Istanbul UTC+3 olduğundan:
  const targetIsoStr = `${dateStr}T${h}:${m}:00+03:00`;
  const parsed = new Date(targetIsoStr);
  return parsed.toISOString();
}

/**
 * Supabase'den güncel ürün kataloğunu çeker
 */
export async function fetchProductsCatalog(supabase) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Scheduler] Ürün kataloğu sorgu hatası:', error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[Scheduler] Ürün kataloğu istisnası:', err.message);
    return [];
  }
}

/**
 * Supabase `site_settings` tablosundan platform ayarlarını okur
 */
export async function fetchSiteSetting(supabase, key) {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('data')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      console.warn(`[Scheduler] site_settings(${key}) okunamadı:`, error.message);
      return null;
    }
    return data && data.data ? data.data : null;
  } catch (err) {
    console.warn(`[Scheduler] site_settings(${key}) istisnası:`, err.message);
    return null;
  }
}

/**
 * NOVA Akıllı Ürün Dağıtım Algoritması
 * - Belirtilen platform ve format için henüz paylaşılmamış en yeni ürünü seçer.
 * - Tüm ürünler bu formatta yayınlandıysa döngüyü korumak için en eski yayınlanan veya rastgele seçer.
 */
export function selectProductForPublish({ catalog = [], tracker = {}, targetFormat = 'POST' }) {
  if (!catalog || catalog.length === 0) return null;

  // 1. Henüz bu formatta yayınlanmamış en yeni ürünü bul
  for (const product of catalog) {
    if (!product || !product.slug) continue;
    const publishedFormats = tracker[product.slug] || [];
    if (!publishedFormats.includes(targetFormat)) {
      return {
        product,
        format: targetFormat,
        isCycleFallback: false
      };
    }
  }

  // 2. Tüm ürünler bu formatta yayınlandıysa:
  // En az toplam yayın yapılmış ürünü veya en eski paylaşımı seç
  let leastPublishedProduct = catalog[0];
  let minCount = Infinity;

  for (const product of catalog) {
    if (!product || !product.slug) continue;
    const count = (tracker[product.slug] || []).length;
    if (count < minCount) {
      minCount = count;
      leastPublishedProduct = product;
    }
  }

  return {
    product: leastPublishedProduct || catalog[0],
    format: targetFormat,
    isCycleFallback: true
  };
}

/**
 * Format türünü platform standartlarına eşler
 */
export function normalizeContentType(platform, slotType) {
  const p = String(platform).toLowerCase();
  const t = String(slotType || 'POST').toUpperCase();

  if (p === 'instagram') {
    if (t.includes('REEL')) return 'REELS';
    if (t.includes('STOR')) return 'STORIES';
    return 'POST';
  } else if (p === 'facebook') {
    if (t.includes('REEL')) return 'FB_REELS';
    if (t.includes('STOR')) return 'FB_STORIES';
    if (t.includes('LINK')) return 'LINK_CARD';
    return 'PHOTO_POST';
  }
  return t;
}

/**
 * Görev için medya URL'i ve açıklama metnini hazırlar
 */
export async function prepareTaskPayload({ platform, slot, product, geminiApiKey = null }) {
  const contentType = normalizeContentType(platform, slot.type);
  const safeSlug = product.slug;
  const imageFallback = product.ana_resim && /^https?:\/\//.test(product.ana_resim)
    ? product.ana_resim
    : null;
  if (!imageFallback) throw new Error(`Ürünün geçerli ana görseli yok: ${safeSlug}`);

  let mediaUrl = imageFallback;
  let caption = `✨ ${product.title || 'Nova Furniture Özel Tasarım Koleksiyonu'} — Mekanınıza değer katan minimalist çizgiler ve kusursuz işçilik.`;
  let hashtags = '#novafurniture #minimalistmobilya #luxuryfurniture #icmimari #ozelolcumobilya';

  // Gemini Banana Entegrasyonu (API anahtarı tanımlı ise canlı mimari kampanya)
  if (geminiApiKey) {
    try {
      const campaign = await GeminiBananaEngine.buildAndSaveProductCampaign({
        product,
        apiKey: geminiApiKey,
        allowFallback: false
      });

      if (campaign) {
        if (campaign.caption) caption = campaign.caption;
        if (campaign.hashtags) hashtags = campaign.hashtags;

        if (contentType === 'REELS' || contentType === 'FB_REELS') {
          mediaUrl = campaign.reels_video_url || '';
        } else if (contentType === 'STORIES' || contentType === 'FB_STORIES') {
          mediaUrl = campaign.story_image_url || campaign.post_image_url || imageFallback;
        } else {
          mediaUrl = campaign.post_image_url || imageFallback;
        }
      }
    } catch (genErr) {
      console.error(`[Scheduler] Gemini Banana üretimi başarısız; görev kuyruğa alınmadı: ${genErr.message}`);
      throw genErr;
    }
  }

  if (contentType === 'REELS') {
    const videoUrl = (campaign && campaign.reels_video_url) || product.reels_video_url || product.video_url || '';
    if (!/\.(mp4|mov)(\?.*)?$/i.test(videoUrl)) {
      throw new Error('Instagram Reels için ürün videosu bulunamadı: ' + safeSlug);
    }
    mediaUrl = videoUrl;
  }
  if (contentType === 'FB_REELS') {
    throw new Error('Facebook Reels yayın desteği bu sürümde kapalıdır.');
  }

  // Meta API SVG formatını desteklemez; SVG gelirse daima PNG fallback kullan
  if (!mediaUrl || /\.svg(\?.*)?$/i.test(mediaUrl)) {
    throw new Error(`Yayın için geçerli medya URL'i hazırlanamadı: ${safeSlug}`);
  }

  return {
    contentType,
    mediaUrl,
    caption,
    hashtags
  };
}

/**
 * Tekil slotun yayın zamanı gelip gelmediğini kontrol eder ve gerekiyorsa kuyruğa ekler
 */
export async function checkAndEnqueueSlot({
  supabase,
  platform,
  slot,
  istanbulNow,
  catalog,
  geminiApiKey = null
}) {
  const isEnabled = slot.enabled !== false && slot.active !== false;
  if (!isEnabled) {
    return { status: 'skipped', reason: 'SLOT_DISABLED' };
  }

  const slotTime = (slot.time || '').trim();
  if (!slotTime || !slotTime.includes(':')) {
    return { status: 'skipped', reason: 'INVALID_SLOT_TIME' };
  }

  const { dateStr, timeStr } = istanbulNow;

  // Saat eşleşme kontrolü: Mevcut dakika slot dakikasıyla eşleşiyor mu?
  if (timeStr !== slotTime) {
    return { status: 'skipped', reason: 'TIME_NOT_MATCHED', expected: slotTime, current: timeStr };
  }

  // Bugün bu slot için bu platformda zaten bir görev oluşturulmuş mu?
  const slotCode = slotTime.replace(':', '');
  const dayStartIso = getIstanbulSlotIso(dateStr, '00:00');
  const dayEndIso = getIstanbulSlotIso(dateStr, '23:59');

  const { data: existingSlots, error: checkError } = await supabase
    .from('social_publish_queue')
    .select('id, idempotency_key, status, scheduled_for')
    .eq('platform', platform)
    .eq('slot_label', slotTime)
    .gte('scheduled_for', dayStartIso)
    .lte('scheduled_for', dayEndIso);

  if (checkError) {
    console.warn(`[Scheduler] Kuyruk kontrol hatası (${platform} ${slotTime}):`, checkError.message);
    return { status: 'error', error: checkError.message };
  }

  if (Array.isArray(existingSlots) && existingSlots.length > 0) {
    // Bugün zaten bu slot için görev açılmış, mükerrer oluşturma!
    return {
      status: 'skipped',
      reason: 'ALREADY_QUEUED_TODAY',
      existingId: existingSlots[0].id,
      idempotencyKey: existingSlots[0].idempotency_key
    };
  }

  // Yayınlanacak ürünü seç
  const trackerKey = `${platform}_published_tracker`;
  const tracker = (await fetchSiteSetting(supabase, trackerKey)) || {};
  const targetFormat = normalizeContentType(platform, slot.type);
  const requiredFormats = platform === 'instagram' ? ['POST', 'STORIES', 'REELS'] : ['PHOTO_POST', 'FB_STORIES'];
  const allProductsCompleted = catalog.length > 0 && catalog.every(p =>
    requiredFormats.every(format => Array.isArray(tracker[p.slug]) && tracker[p.slug].includes(format))
  );
  const isStory = targetFormat === 'STORIES' || targetFormat === 'FB_STORIES';
  if (allProductsCompleted && !isStory) return { status: 'skipped', reason: 'CYCLE_COMPLETE_STORY_ONLY' };
  const selected = selectProductForPublish({ catalog, tracker, targetFormat });

  if (!selected || !selected.product) {
    return { status: 'error', error: 'Katalogda uygun ürün bulunamadı' };
  }

  const pickedProduct = selected.product;
  const taskPayload = await prepareTaskPayload({
    platform,
    slot,
    product: pickedProduct,
    geminiApiKey
  });

  const scheduledForIso = getIstanbulSlotIso(dateStr, slotTime);
  const idempotencyKey = `${platform}_${pickedProduct.slug}_${taskPayload.contentType}_${dateStr}_${slotCode}`.toLowerCase();

  const queueRecord = {
    platform,
    content_type: taskPayload.contentType,
    slot_label: slotTime,
    product_slug: pickedProduct.slug,
    media_url: taskPayload.mediaUrl,
    caption: taskPayload.caption,
    hashtags: taskPayload.hashtags,
    target_link: null,
    status: 'pending',
    idempotency_key: idempotencyKey,
    scheduled_for: scheduledForIso
  };

  const { data: inserted, error: insertError } = await supabase
    .from('social_publish_queue')
    .insert([queueRecord])
    .select('id, idempotency_key, scheduled_for, status')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      // Unique constraint ihlali (idempotency engeli): Başka bir döngü tarafından eklenmiş
      console.log(`[Scheduler Idempotency] Mükerrer görev engellendi: ${idempotencyKey}`);
      return { status: 'skipped', reason: 'DUPLICATE_IDEMPOTENCY_KEY', idempotencyKey };
    }
    console.error(`[Scheduler] Görev kuyruğa eklenemedi (${platform}):`, insertError.message);
    return { status: 'error', error: insertError.message };
  }

  // Yayın geçmişi yalnızca Publisher Meta yayınını başarıyla tamamladığında güncellenir.

  console.log(
    `[Scheduler Görev Oluşturuldu] Platform: ${platform} | Slot: ${slotTime} | Ürün: ${pickedProduct.slug} | Tür: ${taskPayload.contentType} | Kuyruk ID: ${inserted.id} | Planlanan: ${scheduledForIso}`
  );

  return {
    status: 'enqueued',
    task: inserted
  };
}

/**
 * Tek bir otonom zamanlayıcı döngüsü
 */
export async function runSchedulerCycle(supabase, stateCache = {}, geminiApiKey = null) {
  const istanbulNow = getIstanbulTime();
  const catalog = (await fetchProductsCatalog(supabase)).filter(p => p && !EXCLUDED_PRODUCT_SLUGS.has(String(p.slug || '').toLowerCase()));

  // 1. INSTAGRAM AYARLARI KONTROLÜ
  const instaState = await fetchSiteSetting(supabase, 'insta_bot_state');
  const instaSlots = (instaState && instaState.config && instaState.config.posting_slots) || [
    { type: 'POST', time: '10:00', enabled: true },
    { type: 'STORIES', time: '14:30', enabled: true },
    { type: 'REELS', time: '19:30', enabled: true }
  ];

  // Ayar değişikliği algılama (Dinamik loglama)
  const currentInstaSlotsSig = JSON.stringify(instaSlots);
  if (stateCache.instaSlotsSig && stateCache.instaSlotsSig !== currentInstaSlotsSig) {
    console.log(`[Scheduler Dinamik Güncelleme] Instagram slot ayarları güncellendi:`, instaSlots);
  }
  stateCache.instaSlotsSig = currentInstaSlotsSig;

  // Instagram slotlarını değerlendir
  for (const slot of instaSlots) {
    try {
      await checkAndEnqueueSlot({
        supabase,
        platform: 'instagram',
        slot,
        istanbulNow,
        catalog,
        geminiApiKey
      });
    } catch (err) {
      console.warn(`[Scheduler Instagram Slot Hatası] ${slot.time}:`, err.message);
    }
  }

  // 2. FACEBOOK AYARLARI KONTROLÜ
  const fbState = await fetchSiteSetting(supabase, 'fb_bot_state');
  const fbSlots = (fbState && fbState.config && fbState.config.posting_slots) || [
    { type: 'PHOTO_POST', time: '11:00', active: true, label: 'Facebook Gönderi' },
    { type: 'FB_STORIES', time: '14:00', active: true, label: 'Facebook Hikaye' },
    { type: 'FB_REELS', time: '18:00', active: true, label: 'Facebook Reels' }
  ];

  const currentFbSlotsSig = JSON.stringify(fbSlots);
  if (stateCache.fbSlotsSig && stateCache.fbSlotsSig !== currentFbSlotsSig) {
    console.log(`[Scheduler Dinamik Güncelleme] Facebook slot ayarları güncellendi:`, fbSlots);
  }
  stateCache.fbSlotsSig = currentFbSlotsSig;

  // Facebook slotlarını değerlendir
  for (const slot of fbSlots) {
    try {
      await checkAndEnqueueSlot({
        supabase,
        platform: 'facebook',
        slot: {
          ...slot,
          enabled: slot.active !== false && slot.enabled !== false
        },
        istanbulNow,
        catalog,
        geminiApiKey
      });
    } catch (err) {
      console.warn(`[Scheduler Facebook Slot Hatası] ${slot.time}:`, err.message);
    }
  }

  return {
    istanbulNow,
    instaSlotsCount: instaSlots.length,
    fbSlotsCount: fbSlots.length
  };
}

/**
 * VPS Scheduler Sürecini Başlatır
 */
export function startAutonomousScheduler(supabase, intervalMs = 30000, geminiApiKey = null) {
  const stateCache = {};
  console.log(`[Nova Scheduler Engine] Başlatıldı. Döngü aralığı: ${intervalMs / 1000} sn. Saat dilimi: Europe/Istanbul (UTC+3)`);

  const runSafeCycle = async () => {
    try {
      await runSchedulerCycle(supabase, stateCache, geminiApiKey);
    } catch (cycleErr) {
      console.error('[Scheduler Döngü Hatası]:', cycleErr.message);
    }
  };

  // İlk döngüyü hemen başlat
  runSafeCycle();
  const intervalHandle = setInterval(runSafeCycle, intervalMs);

  return {
    stop: () => {
      console.log('[Scheduler Engine] Durduruldu.');
      clearInterval(intervalHandle);
    }
  };
}

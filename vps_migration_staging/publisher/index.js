/**
 * NOVA FURNITURE — VPS PUBLISHER RUNNER (publisher/index.js)
 * ============================================================================
 * TEKNİK MİMARİ VE ÇALIŞMA KURALLARI:
 * 1. SQL RPC İmzalarıyla %100 Uyum:
 *    - `claim_next_publish_task(p_worker_id, p_lock_duration_seconds)`
 *    - `extend_publish_task_lock(p_task_id, p_worker_id, p_extra_seconds)`
 *    - `complete_publish_task(p_task_id, p_worker_id, p_status, ...)`
 * 2. Worker Sahiplik Garantisi:
 *    Tüm RPC çağrılarına bu iş parçacığının tekil `WORKER_ID` değeri geçirilir.
 * 3. Dry-Run Modu:
 *    `DRY_RUN=true` iken sıfır dış API çağrısı yapılır; görevler kesinlikle
 *    'published' yapılmaz, 'dry_run_completed' olarak kaydedilir.
 * 4. TikTok Doğrulama Akışı:
 *    `publish_id` başlangıç biletidir; yayın durumu `/post/publish/status/fetch/`
 *    ile 'PUBLISH_COMPLETE' doğrulanmadan başarılı sayılmaz.
 * 5. Instagram Transcoding Beklemesi:
 *    Medya konteyneri 'FINISHED' olmadan asla `media_publish` çağrılmaz.
 *    Bekleme süresince `extend_publish_task_lock` ile kilit tazelenir.
 * 6. Reconciliation (Belirsiz Yanıt):
 *    Ağ zaman aşımı veya doğrulanamayan API yanıtlarında 'reconciliation_required'
 *    atanır; otomatik tekrar deneme durdurularak çift paylaşım önlenir.
 * 7. YouTube İzolasyonu:
 *    Gerçek video binary upload geliştirilmediği için görevler asla 'published'
 *    yapılmaz; açıkça 'reconciliation_required' olarak işaretlenir.
 * 8. Log Maskeleme:
 *    Tüm token ve gizli bilgiler loglardan temizlenir.
 * 9. Graceful Shutdown:
 *    SIGTERM / SIGINT sinyallerinde mevcut görev bitene kadar beklenir.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';
const POLL_INTERVAL_MS = (parseInt(process.env.POLL_INTERVAL_SECONDS, 10) || 15) * 1000;
const LOCK_DURATION_SEC = parseInt(process.env.LOCK_DURATION_SECONDS, 10) || 180;
const WORKER_ID = `nova_worker_${process.pid}_${Math.random().toString(36).substring(2, 8)}`;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[CRITICAL] SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanımlanmamış!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

console.log(`[Nova Publisher] Başlatıldı. Worker ID: ${WORKER_ID} | DRY_RUN: ${DRY_RUN}`);

// Graceful Shutdown Kontrolleri
let isShuttingDown = false;
let isTaskRunning = false;

// Token ve Gizli Bilgileri Loglardan Ayıklayan Fonksiyon
function sanitize(text) {
  if (!text) return '';
  return String(text)
    .replace(/access_token=[a-zA-Z0-9_\-\.]+/gi, 'access_token=***')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ***')
    .replace(/client_secret=[a-zA-Z0-9_\-\.]+/gi, 'client_secret=***')
    .replace(/client_key=[a-zA-Z0-9_\-\.]+/gi, 'client_key=***')
    .replace(/refresh_token=[a-zA-Z0-9_\-\.]+/gi, 'refresh_token=***');
}

// ── KİLİT SÜRESİ UZATMA (HEARTBEAT) ──────────────────────────────────────────
async function heartbeatLockExtension(taskId, extraSeconds = 120) {
  try {
    const { data: extended, error } = await supabase.rpc('extend_publish_task_lock', {
      p_task_id: taskId,
      p_worker_id: WORKER_ID,
      p_extra_seconds: extraSeconds
    });
    if (error) {
      console.warn(`[Heartbeat] Kilit uzatma uyarısı (${taskId}):`, sanitize(error.message));
      return false;
    }
    return Boolean(extended);
  } catch (err) {
    console.warn(`[Heartbeat] İstisna (${taskId}):`, sanitize(err.message));
    return false;
  }
}

// ── PLATFORM YAYIN MOTORU ───────────────────────────────────────────────────
async function executePublish(task) {
  const { task_id, platform, content_type, media_url, caption, hashtags, target_link } = task;
  const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n');

  console.log(`[Görev Başladı] Platform: ${platform} | Tür: ${content_type} | ID: ${task_id}`);

  // DRY-RUN GÜVENCESİ: Kesinlikle hiçbir gerçek platform API çağrısı yapma!
  if (DRY_RUN) {
    console.log(`[DRY-RUN] Simüle yayın doğrulandı: ${platform} -> ${media_url}`);
    return {
      status: 'dry_run_completed',
      platformPostId: `SIMULATED_${platform.toUpperCase()}_${Date.now()}`,
      rawResponse: { mode: 'DRY_RUN_SIMULATION', timestamp: new Date().toISOString() }
    };
  }

  switch (platform.toLowerCase()) {
    // ── 1. INSTAGRAM GRAPH API ──────────────────────────────────────────────
    case 'instagram': {
      const igUserId = process.env.META_IG_USER_ID;
      const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
      if (!igUserId || !accessToken) {
        throw new Error('Meta Instagram ortam değişkenleri (META_IG_USER_ID, META_PAGE_ACCESS_TOKEN) eksik!');
      }

      const isVideo = content_type === 'REELS' || /\.(mp4|mov)(\?.*)?$/i.test(media_url);
      const containerParams = new URLSearchParams();
      containerParams.set('access_token', accessToken);

      if (content_type === 'REELS') {
        containerParams.set('media_type', 'REELS');
        containerParams.set('video_url', media_url);
        containerParams.set('share_to_feed', 'true');
        containerParams.set('caption', fullCaption);
      } else if (content_type === 'STORIES') {
        containerParams.set('media_type', 'STORIES');
        if (isVideo) containerParams.set('video_url', media_url);
        else containerParams.set('image_url', media_url);
      } else {
        containerParams.set('image_url', media_url);
        containerParams.set('caption', fullCaption);
      }

      // Adım 1: Medya Konteyneri Başlat
      const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
        method: 'POST',
        body: containerParams
      });
      const containerData = await containerRes.json();
      if (!containerRes.ok || !containerData.id) {
        throw new Error(`Meta Container Hatası: ${sanitize(containerData?.error?.message || 'Konteyner oluşturulamadı')}`);
      }

      const creationId = containerData.id;

      // Adım 2: Medya İşleme Durumu (status_code) Doğrulanana Kadar Bekle
      const maxAttempts = isVideo ? 30 : 8;
      let isReady = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, 4000));

        // Transcoding sürerken her 12 saniyede bir kuyruk kilidini uzat
        if (attempt % 3 === 0) {
          await heartbeatLockExtension(task_id, 120);
        }

        const statusRes = await fetch(
          `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`
        );
        const statusData = await statusRes.json();

        if (statusData.status_code === 'FINISHED') {
          isReady = true;
          break;
        }

        if (statusData.status_code === 'ERROR') {
          throw new Error(`Instagram medya işleme hatası: ${sanitize(statusData.status || 'Bilinmeyen hata')}`);
        }
      }

      if (!isReady) {
        throw new Error('Instagram medya işleme zaman aşımı (Transcoding tamamlanamadı)');
      }

      // Adım 3: Medyayı Yayınla (media_publish)
      const pubParams = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken
      });

      const pubRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
        method: 'POST',
        body: pubParams
      });
      const pubData = await pubRes.json();

      if (!pubRes.ok || !pubData.id) {
        throw new Error(`Meta Publish Hatası: ${sanitize(pubData?.error?.message || 'Yayınlanamadı')}`);
      }

      return {
        status: 'published',
        platformPostId: pubData.id,
        rawResponse: pubData
      };
    }

    // ── 2. FACEBOOK PAGE GRAPH API ──────────────────────────────────────────
    case 'facebook': {
      const pageId = process.env.META_PAGE_ID;
      const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
      if (!pageId || !pageAccessToken) {
        throw new Error('Meta Facebook ortam değişkenleri (META_PAGE_ID, META_PAGE_ACCESS_TOKEN) eksik!');
      }

      const isStory = content_type === 'FB_STORIES' || content_type === 'STORIES';
      if (isStory) {
        // Önce unpublished fotoğraf yükle, sonra photo_stories üzerinden yayınla
        const upParams = new URLSearchParams({
          url: media_url,
          published: 'false',
          access_token: pageAccessToken
        });
        const upRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, { method: 'POST', body: upParams });
        const upData = await upRes.json();
        if (!upRes.ok || !upData.id) {
          throw new Error(`Facebook Story Yükleme Hatası: ${sanitize(upData?.error?.message)}`);
        }

        const stParams = new URLSearchParams({ photo_id: upData.id, access_token: pageAccessToken });
        const stRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photo_stories`, { method: 'POST', body: stParams });
        const stData = await stRes.json();
        if (!stRes.ok || (!stData.post_id && !stData.success)) {
          throw new Error(`Facebook Story Yayın Hatası: ${sanitize(stData?.error?.message)}`);
        }

        return { status: 'published', platformPostId: stData.post_id || upData.id, rawResponse: stData };
      }

      // Standart Fotoğraf Gönderisi
      const photoParams = new URLSearchParams({
        url: media_url,
        message: fullCaption,
        access_token: pageAccessToken
      });
      const fbRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
        method: 'POST',
        body: photoParams
      });
      const fbData = await fbRes.json();
      if (!fbRes.ok || (!fbData.id && !fbData.post_id)) {
        throw new Error(`Facebook Gönderi Hatası: ${sanitize(fbData?.error?.message)}`);
      }

      return {
        status: 'published',
        platformPostId: fbData.post_id || fbData.id,
        rawResponse: fbData
      };
    }

    // ── 3. TIKTOK CONTENT POSTING API v2 (DOĞRULAMALI AKIŞ) ───────────────────
    case 'tiktok': {
      const token = process.env.TIKTOK_ACCESS_TOKEN;
      if (!token) throw new Error('TikTok Access Token ortam değişkeni eksik!');

      const isPhoto = content_type === 'TIKTOK_PHOTO_CAROUSEL' || !/\.(mp4|mov)(\?.*)?$/i.test(media_url);
      const initEndpoint = isPhoto
        ? 'https://open.tiktokapis.com/v2/post/publish/content/init/'
        : 'https://open.tiktokapis.com/v2/post/publish/video/init/';

      const initPayload = isPhoto ? {
        post_info: { title: fullCaption.slice(0, 90), privacy_level: 'PUBLIC_TO_EVERYONE' },
        source_info: { source: 'PULL_FROM_URL', photo_images: [media_url] }
      } : {
        post_info: { title: fullCaption.slice(0, 2200), privacy_level: 'PUBLIC_TO_EVERYONE' },
        source_info: { source: 'PULL_FROM_URL', video_url: media_url }
      };

      // Adım 1: Gönderi Başlatma Talebi (Init)
      const initRes = await fetch(initEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(initPayload)
      });
      const initData = await initRes.json();

      if (!initRes.ok || initData.error?.code !== 'ok' || !initData.data?.publish_id) {
        throw new Error(`TikTok Başlatma Hatası: ${sanitize(initData.error?.message || 'Bilinmeyen TikTok hatası')}`);
      }

      const publishId = initData.data.publish_id;

      // Adım 2: Yayın Durumunu (/status/fetch/) Sorgulayarak Doğrula
      // TikTok publish_id yalnızca işlem biletidir; gerçek başarı PUBLISH_COMPLETE olmalıdır.
      let verifiedStatus = 'PROCESSING';
      let statusDetails = null;

      for (let attempt = 1; attempt <= 15; attempt++) {
        await new Promise(r => setTimeout(r, 4000));

        if (attempt % 2 === 0) {
          await heartbeatLockExtension(task_id, 120);
        }

        const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ publish_id: publishId })
        });
        const statusData = await statusRes.json();
        statusDetails = statusData;

        const currentStatus = statusData?.data?.status;
        if (currentStatus === 'PUBLISH_COMPLETE') {
          verifiedStatus = 'PUBLISH_COMPLETE';
          break;
        }

        if (currentStatus === 'FAILED') {
          throw new Error(`TikTok yayın işleme hatası: ${sanitize(statusData?.data?.fail_reason || 'Bilinmeyen neden')}`);
        }
      }

      if (verifiedStatus !== 'PUBLISH_COMPLETE') {
        // Durum henüz kesinleşmediyse belirsiz yanıt olarak işaretle
        return {
          status: 'reconciliation_required',
          platformPostId: publishId,
          rawResponse: statusDetails,
          errorMessage: 'TikTok yayın durumu henüz PUBLISH_COMPLETE olmadı. Durum doğrulama bekliyor.'
        };
      }

      return {
        status: 'published',
        platformPostId: publishId,
        rawResponse: statusDetails
      };
    }

    // ── 4. YOUTUBE DATA API v3 (KAPSAM KORUMASI) ─────────────────────────────
    case 'youtube': {
      // ÖNEMLİ KURAL: YouTube resumable binary video upload akışı bu aşamada
      // geliştirilmemiştir. Sahte ID ile 'published' yapılması engellenmiştir.
      return {
        status: 'reconciliation_required',
        platformPostId: null,
        rawResponse: { note: 'YouTube Data API v3 binary video upload geliştirme aşamasındadır.' },
        errorMessage: '[EXCLUDED_FROM_DEPLOYMENT] YouTube gerçek binary upload geliştirilmemiştir. Görev bekletiliyor.'
      };
    }

    default:
      throw new Error(`Desteklenmeyen platform: ${platform}`);
  }
}

// ── ANA KUYRUK DÖNGÜSÜ ───────────────────────────────────────────────────────
async function pollQueueCycle() {
  if (isShuttingDown || isTaskRunning) return;

  try {
    // Adım 1: Atomik Görev Talebi (FOR UPDATE SKIP LOCKED)
    const { data: tasks, error: claimError } = await supabase.rpc('claim_next_publish_task', {
      p_worker_id: WORKER_ID,
      p_lock_duration_seconds: LOCK_DURATION_SEC
    });

    if (claimError) {
      console.error('[Kuyruk RPC Hatası]:', sanitize(claimError.message));
      return;
    }

    if (!tasks || tasks.length === 0) {
      return; // Bekleyen görev yok
    }

    const task = tasks[0];
    isTaskRunning = true;

    try {
      const result = await executePublish(task);

      // Görev Başarıyla veya Tanımlı Durumla Tamamlandı
      await supabase.rpc('complete_publish_task', {
        p_task_id: task.task_id,
        p_worker_id: WORKER_ID,
        p_status: result.status,
        p_platform_post_id: result.platformPostId ? String(result.platformPostId) : null,
        p_platform_response: result.rawResponse || null,
        p_error_message: result.errorMessage || null,
        p_backoff_minutes: 5
      });

      console.log(`[Görev Tamamlandı] ID: ${task.task_id} -> Durum: ${result.status}`);
    } catch (execErr) {
      const isTimeout = execErr.name === 'AbortError' ||
                        execErr.message.includes('timeout') ||
                        execErr.message.includes('ETIMEDOUT') ||
                        execErr.message.includes('ECONNRESET');

      // Ağ zaman aşımında API'nin yayını yapıp yapmadığı belirsizdir:
      // Mükerrer yayını önlemek için 'reconciliation_required' yapılır!
      const finalStatus = isTimeout ? 'reconciliation_required' : 'failed';
      const cleanErrMsg = sanitize(execErr.message);

      console.error(`[Görev Sonucu: ${finalStatus.toUpperCase()}] ID: ${task.task_id} -> ${cleanErrMsg}`);

      await supabase.rpc('complete_publish_task', {
        p_task_id: task.task_id,
        p_worker_id: WORKER_ID,
        p_status: finalStatus,
        p_platform_post_id: null,
        p_platform_response: null,
        p_error_message: cleanErrMsg,
        p_backoff_minutes: 5
      });
    } finally {
      isTaskRunning = false;
    }
  } catch (cycleErr) {
    console.error('[Döngü Hatası]:', sanitize(cycleErr.message));
  }
}

// Zamanlayıcıyı Başlat
const pollIntervalHandle = setInterval(pollQueueCycle, POLL_INTERVAL_MS);
pollQueueCycle(); // İlk açılışta hemen tara

// ── GRACEFUL SHUTDOWN (KONTROLLÜ KAPATMA) ────────────────────────────────────
async function handleShutdown(signal) {
  console.log(`\n[Shutdown] ${signal} sinyali alındı. Servis güvenli biçimde kapatılıyor...`);
  isShuttingDown = true;
  clearInterval(pollIntervalHandle);

  if (isTaskRunning) {
    console.log('[Shutdown] Devam eden yayın görevinin tamamlanması bekleniyor (Maks 35 sn)...');
    let waitSeconds = 0;
    while (isTaskRunning && waitSeconds < 35) {
      await new Promise(r => setTimeout(r, 1000));
      waitSeconds++;
    }
  }

  console.log('[Shutdown] Nova Publisher güvenle sonlandırıldı.');
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

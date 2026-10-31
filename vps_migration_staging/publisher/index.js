/**
 * NOVA FURNITURE — VPS PUBLISHER RUNNER (publisher/index.js)
 * ============================================================================
 * TEKNİK GÜVENLİK VE GÜVENİLİRLİK KURALLARI:
 * 1. AbortController Tabanlı Timeout:
 *    Tüm platform API çağrıları makul bir zaman aşımı (varsayılan 25 sn) ile
 *    korunur; ağ kilitlenmelerinde worker askıda kalmaz.
 * 2. Kilit Kaybında Akışın Durdurulması:
 *    `heartbeatLockExtension` 'false' döndüğünde worker derhal hata fırlatır
 *    ve `media_publish` gibi geri dönüşü olmayan adıma ASLA geçmez.
 * 3. Instagram Token Güvenliği (Query String Önleme):
 *    GET isteklerinde token URL query string yerine `Authorization: Bearer`
 *    başlığında taşınır. POST isteklerinde body içinde iletilir.
 * 4. TikTok Hata Kontrolleri:
 *    HTTP durum kodları, JSON çözümleme ve API hata kodları (`error.code !== 'ok'`)
 *    katı biçimde doğrulanır.
 * 5. RPC Tamamlama Doğrulaması:
 *    `complete_publish_task` çağrısının hem `error` hem de dönüş değeri (`data === true`)
 *    denetlenir; güncelleme başarısızsa görev ASLA başarılı olarak loglanmaz.
 * 6. Graceful Shutdown İzolasyonu:
 *    35 saniyelik bekleme süresinde görev hala bitmediyse körlemesine exit(0)
 *    çağrılmaz; kritik uyarı verilerek `process.exit(1)` ile sonlandırılır.
 * 7. YouTube Kapsam Koruması:
 *    Resumable binary video upload geliştirilene kadar YouTube görevleri
 *    SQL enum uyumlu 'unsupported' durumuyla dondurulur; asla yayınlandı sayılmaz.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';
const POLL_INTERVAL_MS = (parseInt(process.env.POLL_INTERVAL_SECONDS, 10) || 15) * 1000;
const LOCK_DURATION_SEC = parseInt(process.env.LOCK_DURATION_SECONDS, 10) || 180;
const API_TIMEOUT_MS = 25000;
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
let currentRunningTaskId = null;

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

// ── ABORTCONTROLLER TABANLI GÜVENLİ FETCH YARDIMCISI ─────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutHandle);
  }
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
      console.warn(`[Heartbeat Uyarısı] Görev ${taskId}:`, sanitize(error.message));
      return false;
    }
    return Boolean(extended);
  } catch (err) {
    console.warn(`[Heartbeat İstisnası] Görev ${taskId}:`, sanitize(err.message));
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
      
      // Token URL yerine POST body içinde taşınır
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

      // Adım 1: Medya Konteyneri Başlat (AbortController korumalı)
      const containerRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
        method: 'POST',
        body: containerParams
      });
      const containerData = await containerRes.json().catch(() => ({}));
      if (!containerRes.ok || !containerData.id) {
        const errMsg = (containerData && containerData.error && containerData.error.message) || 'Konteyner oluşturulamadı';
        throw new Error(`Meta Container Hatası: ${sanitize(errMsg)}`);
      }

      const creationId = containerData.id;

      // Adım 2: Medya İşleme Durumu (status_code) Doğrulanana Kadar Bekle
      const maxAttempts = isVideo ? 30 : 8;
      let isReady = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, 4000));

        // Transcoding sürerken her 12 saniyede bir kuyruk kilidini uzat
        if (attempt % 3 === 0) {
          const lockOk = await heartbeatLockExtension(task_id, 120);
          if (!lockOk) {
            // Heartbeat başarısız olursa akışı derhal durdur (media_publish'e geçme!)
            throw new Error('[HeartbeatLost] Kilit süresi doldu veya uzatılamadı. Yayın akışı derhal durduruldu.');
          }
        }

        // Token URL query string yerine Authorization: Bearer başlığında taşınır
        const statusRes = await fetchWithTimeout(
          `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        const statusData = await statusRes.json().catch(() => ({}));

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

      // Adım 3: Medyayı Yayınla (media_publish) — Token body içinde gönderilir
      const pubParams = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken
      });

      const pubRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
        method: 'POST',
        body: pubParams
      });
      const pubData = await pubRes.json().catch(() => ({}));

      if (!pubRes.ok || !pubData.id) {
        const errMsg = (pubData && pubData.error && pubData.error.message) || 'Yayınlanamadı';
        throw new Error(`Meta Publish Hatası: ${sanitize(errMsg)}`);
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
        const upParams = new URLSearchParams({
          url: media_url,
          published: 'false',
          access_token: pageAccessToken
        });
        const upRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${pageId}/photos`, { method: 'POST', body: upParams });
        const upData = await upRes.json().catch(() => ({}));
        if (!upRes.ok || !upData.id) {
          const errMsg = (upData && upData.error && upData.error.message) || 'Bilinmeyen hata';
          throw new Error(`Facebook Story Yükleme Hatası: ${sanitize(errMsg)}`);
        }

        const stParams = new URLSearchParams({ photo_id: upData.id, access_token: pageAccessToken });
        const stRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${pageId}/photo_stories`, { method: 'POST', body: stParams });
        const stData = await stRes.json().catch(() => ({}));
        if (!stRes.ok || (!stData.post_id && !stData.success)) {
          const errMsg = (stData && stData.error && stData.error.message) || 'Bilinmeyen hata';
          throw new Error(`Facebook Story Yayın Hatası: ${sanitize(errMsg)}`);
        }

        return { status: 'published', platformPostId: stData.post_id || upData.id, rawResponse: stData };
      }

      // Standart Fotoğraf Gönderisi
      const photoParams = new URLSearchParams({
        url: media_url,
        message: fullCaption,
        access_token: pageAccessToken
      });
      const fbRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
        method: 'POST',
        body: photoParams
      });
      const fbData = await fbRes.json().catch(() => ({}));
      if (!fbRes.ok || (!fbData.id && !fbData.post_id)) {
        const errMsg = (fbData && fbData.error && fbData.error.message) || 'Bilinmeyen hata';
        throw new Error(`Facebook Gönderi Hatası: ${sanitize(errMsg)}`);
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
      const initRes = await fetchWithTimeout(initEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(initPayload)
      });
      const initData = await initRes.json().catch(() => ({}));

      const initErrCode = initData && initData.error ? initData.error.code : null;
      const initPublishId = initData && initData.data ? initData.data.publish_id : null;
      if (!initRes.ok || initErrCode !== 'ok' || !initPublishId) {
        const errMsg = (initData && initData.error && initData.error.message) || 'Bilinmeyen TikTok hatası';
        throw new Error(`TikTok Başlatma Hatası (HTTP ${initRes.status}): ${sanitize(errMsg)}`);
      }

      const publishId = initPublishId;

      // Adım 2: Yayın Durumunu (/status/fetch/) Sorgulayarak Doğrula
      let verifiedStatus = 'PROCESSING';
      let statusDetails = null;

      for (let attempt = 1; attempt <= 15; attempt++) {
        await new Promise(r => setTimeout(r, 4000));

        if (attempt % 2 === 0) {
          const lockOk = await heartbeatLockExtension(task_id, 120);
          if (!lockOk) {
            throw new Error('[HeartbeatLost] Kilit süresi doldu veya uzatılamadı. TikTok işlem akışı durduruldu.');
          }
        }

        const statusRes = await fetchWithTimeout('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ publish_id: publishId })
        });

        if (!statusRes.ok) {
          console.warn(`[TikTok Status HTTP ${statusRes.status}] Yeniden deneniyor...`);
          continue;
        }

        const statusData = await statusRes.json().catch(() => ({}));
        statusDetails = statusData;

        const statErrCode = statusData && statusData.error ? statusData.error.code : null;
        if (statErrCode !== 'ok') {
          const errMsg = (statusData && statusData.error && statusData.error.message) || 'Hata kodu alındı';
          throw new Error(`TikTok Status API Hatası: ${sanitize(errMsg)}`);
        }

        const currentStatus = statusData && statusData.data ? statusData.data.status : null;
        if (currentStatus === 'PUBLISH_COMPLETE') {
          verifiedStatus = 'PUBLISH_COMPLETE';
          break;
        }

        if (currentStatus === 'FAILED') {
          const failReason = (statusData && statusData.data && statusData.data.fail_reason) || 'Bilinmeyen neden';
          throw new Error(`TikTok yayın işleme hatası: ${sanitize(failReason)}`);
        }
      }

      if (verifiedStatus !== 'PUBLISH_COMPLETE') {
        return {
          status: 'reconciliation_required',
          platformPostId: publishId,
          rawResponse: statusDetails,
          errorMessage: 'TikTok yayın durumu henüz PUBLISH_COMPLETE olmadı. Durum mutabakatı gerekiyor.'
        };
      }

      return {
        status: 'published',
        platformPostId: publishId,
        rawResponse: statusDetails
      };
    }

    // ── 4. YOUTUBE DATA API v3 (KAPSAM KORUMASI / UNSUPPORTED) ───────────────
    case 'youtube': {
      // ÖNEMLİ: YouTube resumable binary video upload desteği geliştirilene kadar
      // görevler açıkça 'unsupported' durumuna alınır; asla yayınlandı sayılmaz.
      return {
        status: 'unsupported',
        platformPostId: null,
        rawResponse: { note: 'YouTube Data API v3 binary video upload desteği bu aşamada devre dışıdır.' },
        errorMessage: '[EXCLUDED_FROM_DEPLOYMENT] YouTube gerçek binary video upload desteği tamamlanana kadar devre dışıdır.'
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
    currentRunningTaskId = task.task_id;

    try {
      const result = await executePublish(task);

      // Görev Sonucunu Kaydet
      const { data: completedSuccessfully, error: completeError } = await supabase.rpc('complete_publish_task', {
        p_task_id: task.task_id,
        p_worker_id: WORKER_ID,
        p_status: result.status,
        p_platform_post_id: result.platformPostId ? String(result.platformPostId) : null,
        p_platform_response: result.rawResponse || null,
        p_error_message: result.errorMessage || null,
        p_backoff_minutes: 5
      });

      // KRİTİK DOĞRULAMA: Hem error hem de return değerini kontrol et
      if (completeError || completedSuccessfully !== true) {
        const errMsg = (completeError && completeError.message) || 'v_updated = 0';
        console.error(
          `[RPC Başarısız] Görev veritabanında güncellenemedi (Kilit süresi dolmuş veya başka worker devralmış olabilir) - Görev ID: ${task.task_id} - Hata: ${sanitize(errMsg)}`
        );
      } else {
        console.log(`[Görev Tamamlandı] ID: ${task.task_id} -> Durum: ${result.status}`);
      }
    } catch (execErr) {
      const lowerMsg = (execErr.message || '').toLowerCase();
      const isTimeout = execErr.name === 'AbortError' ||
                        lowerMsg.includes('timeout') ||
                        lowerMsg.includes('etimedout') ||
                        lowerMsg.includes('econnreset') ||
                        lowerMsg.includes('heartbeatlost');

      // Ağ zaman aşımında veya kilit kaybında API'nin yayını yapıp yapmadığı belirsizdir:
      // Mükerrer yayını önlemek için 'reconciliation_required' yapılır!
      const finalStatus = isTimeout ? 'reconciliation_required' : 'failed';
      const cleanErrMsg = sanitize(execErr.message);

      console.error(`[Görev Sonucu: ${finalStatus.toUpperCase()}] ID: ${task.task_id} -> ${cleanErrMsg}`);

      const { data: failCompleteOk, error: failCompleteErr } = await supabase.rpc('complete_publish_task', {
        p_task_id: task.task_id,
        p_worker_id: WORKER_ID,
        p_status: finalStatus,
        p_platform_post_id: null,
        p_platform_response: null,
        p_error_message: cleanErrMsg,
        p_backoff_minutes: 5
      });

      if (failCompleteErr || failCompleteOk !== true) {
        console.error(`[RPC Hata Kayıt Başarısız] Görev ID: ${task.task_id} veritabanına işlenemedi.`);
      }
    } finally {
      isTaskRunning = false;
      currentRunningTaskId = null;
    }
  } catch (cycleErr) {
    console.error('[Döngü Hatası]:', sanitize(cycleErr.message));
  }
}

// Zamanlayıcıyı Başlat
const pollIntervalHandle = setInterval(pollQueueCycle, POLL_INTERVAL_MS);
pollQueueCycle();

// ── GRACEFUL SHUTDOWN (KONTROLLÜ KAPATMA) ────────────────────────────────────
async function handleShutdown(signal) {
  console.log(`\n[Shutdown] ${signal} sinyali alındı. Yeni görev alımı durduruldu. Kapanıyor...`);
  isShuttingDown = true;
  clearInterval(pollIntervalHandle);

  if (isTaskRunning) {
    console.log('[Shutdown] Devam eden yayın görevinin tamamlanması bekleniyor (Maks 35 sn)...');
    let waitSeconds = 0;
    while (isTaskRunning && waitSeconds < 35) {
      await new Promise(r => setTimeout(r, 1000));
      waitSeconds++;
    }

    if (isTaskRunning) {
      console.error('[CRITICAL] Devam eden görev 35 saniyede bitmedi. Zorunlu kapatma öncesi belirsiz görev reconciliation_required durumuna alınıyor...');
      if (currentRunningTaskId) {
        try {
          await supabase.rpc('complete_publish_task', {
            p_task_id: currentRunningTaskId,
            p_worker_id: WORKER_ID,
            p_status: 'reconciliation_required',
            p_platform_post_id: null,
            p_platform_response: null,
            p_error_message: '[Shutdown Timeout] Süreç zorunlu kapatıldı (SIGTERM/SIGINT zaman aşımı). Görev durumu belirsiz.',
            p_backoff_minutes: 5
          });
        } catch (termRpcErr) {
          const errMsg = termRpcErr && termRpcErr.message ? termRpcErr.message : 'Bilinmeyen hata';
          console.error('[Shutdown RPC Hatası]:', sanitize(errMsg));
        }
      }
      process.exit(1);
    }
  }

  console.log('[Shutdown] Nova Publisher güvenle sonlandırıldı.');
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

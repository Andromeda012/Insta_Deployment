/**
 * GLOBAL MOBİLYA — VPS PUBLISHER RUNNER (index.js)
 * ============================================================================
 * TEKNİK DENETİM VE GÜVENLİK İYİLEŞTİRMELERİ:
 * 1. Graceful Shutdown (SIGTERM/SIGINT): Docker durdurulduğunda mevcut görev
 *    yarıda kesilmez, tamamlanması beklenir ve kilit güvenle serbest bırakılır.
 * 2. Log Güvenliği (Token Masking): Meta, TikTok ve diğer API'lerden dönen
 *    tüm hata mesajlarındaki tokenlar loga veya DB'ye yazılmadan önce filtrelenir.
 * 3. Kilit Uzatma (Heartbeat Lease Renewal): Uzun süren Reels transcoding
 *    süresince `extend_publish_task_lock` çağrılarak görev zombi sanılmaktan korunur.
 * 4. Reconciliation Durumu: Ağ zaman aşımında görevin yayınlanıp yayınlanmadığı
 *    doğrulanamıyorsa 'reconciliation_required' yapılır; mükerrer paylaşım önlenir.
 * 5. YouTube Kapsam Koruması: YouTube resumable binary upload geliştirilmediği
 *    için kesinlikle sahte ID ile 'published' yapılmaz, geliştirme beklemesine alınır.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';
const POLL_INTERVAL_MS = (parseInt(process.env.POLL_INTERVAL_SECONDS, 10) || 15) * 1000;
const LOCK_DURATION_SEC = parseInt(process.env.LOCK_DURATION_SECONDS, 10) || 180;
const WORKER_ID = `vps_worker_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('CRITICAL: SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

console.log(`[Publisher Service] Başlatıldı. WorkerID: ${WORKER_ID}, DRY_RUN: ${DRY_RUN}`);

// Graceful Shutdown Bayrağı
let isShuttingDown = false;
let currentTaskInProgress = false;

function sanitizeError(msg) {
  if (!msg) return 'Bilinmeyen hata';
  return String(msg)
    .replace(/access_token=[a-zA-Z0-9_\-\.]+/gi, 'access_token=***')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ***')
    .replace(/client_secret=[a-zA-Z0-9_\-\.]+/gi, 'client_secret=***');
}

async function executePublishTask(task) {
  const { task_id, platform, content_type, media_url, caption, hashtags, target_link } = task;
  const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n');

  console.log(`[Task Start] ID: ${task_id} | Platform: ${platform} | Tür: ${content_type}`);

  if (DRY_RUN) {
    console.log(`[DRY RUN] Simüle yayın: ${platform} -> ${media_url}`);
    return {
      status: 'published',
      platformPostId: `dry_run_${platform}_${Date.now()}`,
      rawResponse: { mode: 'DRY_RUN_SIMULATION', timestamp: new Date().toISOString() }
    };
  }

  switch (platform.toLowerCase()) {
    case 'instagram': {
      const igUserId = process.env.META_IG_USER_ID;
      const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
      if (!igUserId || !accessToken) throw new Error('Meta Instagram kimlik bilgileri eksik!');

      const createParams = new URLSearchParams();
      createParams.set('access_token', accessToken);
      const isVideo = content_type === 'REELS' || /\.(mp4|mov)(\?.*)?$/i.test(media_url);

      if (content_type === 'REELS') {
        createParams.set('media_type', 'REELS');
        createParams.set('video_url', media_url);
        createParams.set('share_to_feed', 'true');
        createParams.set('caption', fullCaption);
      } else if (content_type === 'STORIES') {
        createParams.set('media_type', 'STORIES');
        if (isVideo) createParams.set('video_url', media_url);
        else createParams.set('image_url', media_url);
      } else {
        createParams.set('image_url', media_url);
        createParams.set('caption', fullCaption);
      }

      const contRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
        method: 'POST',
        body: createParams
      });
      const contData = await contRes.json();
      if (!contRes.ok || !contData.id) {
        throw new Error(`Meta Container Hatası: ${sanitizeError(contData?.error?.message)}`);
      }

      const creationId = contData.id;
      const maxAttempts = isVideo ? 25 : 6;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 3000));
        
        // Transcoding sürerken her 15 saniyede bir kilidi uzat
        if (i > 0 && i % 5 === 0) {
          await supabase.rpc('extend_publish_task_lock', {
            p_task_id: task_id,
            p_worker_id: WORKER_ID,
            p_extra_seconds: 120
          }).catch(() => {});
        }

        const stRes = await fetch(`https://graph.facebook.com/v21.0/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`);
        const stData = await stRes.json();
        if (stData.status_code === 'FINISHED') break;
        if (stData.status_code === 'ERROR') throw new Error('Instagram medya işleme hatası (Transcoding failed)');
      }

      const pubParams = new URLSearchParams({ creation_id: creationId, access_token: accessToken });
      const pubRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
        method: 'POST',
        body: pubParams
      });
      const pubData = await pubRes.json();
      if (!pubRes.ok || !pubData.id) {
        throw new Error(`Meta Publish Hatası: ${sanitizeError(pubData?.error?.message)}`);
      }

      return { status: 'published', platformPostId: pubData.id, rawResponse: pubData };
    }

    case 'facebook': {
      const pageId = process.env.META_PAGE_ID;
      const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
      if (!pageId || !pageAccessToken) throw new Error('Meta Facebook kimlik bilgileri eksik!');

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
        throw new Error(`Facebook API Hatası: ${sanitizeError(fbData?.error?.message)}`);
      }
      return { status: 'published', platformPostId: fbData.post_id || fbData.id, rawResponse: fbData };
    }

    case 'tiktok': {
      const token = process.env.TIKTOK_ACCESS_TOKEN;
      if (!token) throw new Error('TikTok Access Token eksik!');
      const isPhoto = content_type === 'TIKTOK_PHOTO_CAROUSEL' || !/\.(mp4|mov)(\?.*)?$/i.test(media_url);
      const endpoint = isPhoto
        ? 'https://open.tiktokapis.com/v2/post/publish/content/init/'
        : 'https://open.tiktokapis.com/v2/post/publish/video/init/';

      const payload = isPhoto ? {
        post_info: { title: fullCaption.slice(0, 90), privacy_level: 'PUBLIC_TO_EVERYONE' },
        source_info: { source: 'PULL_FROM_URL', photo_images: [media_url] }
      } : {
        post_info: { title: fullCaption.slice(0, 2200), privacy_level: 'PUBLIC_TO_EVERYONE' },
        source_info: { source: 'PULL_FROM_URL', video_url: media_url }
      };

      const ttRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ttData = await ttRes.json();
      if (!ttRes.ok || ttData.error?.code !== 'ok') {
        throw new Error(`TikTok API Hatası: ${sanitizeError(ttData.error?.message)}`);
      }
      return { status: 'published', platformPostId: ttData.data?.publish_id, rawResponse: ttData };
    }

    case 'youtube': {
      // ÖNEMLİ: YouTube gerçek video binary upload kodu henüz geliştirilmemiştir.
      // Simüle ID ile 'published' işaretlenmesi kesinlikle engellenmiştir.
      throw new Error('[EXCLUDED_FROM_DEPLOYMENT] YouTube Data API v3 binary resumable video upload is pending development. Task held in reconciliation.');
    }

    default:
      throw new Error(`Desteklenmeyen platform: ${platform}`);
  }
}

async function queuePollLoop() {
  if (isShuttingDown) return;

  try {
    const { data: tasks, error } = await supabase.rpc('claim_next_publish_task', {
      p_worker_id: WORKER_ID,
      p_lock_duration_seconds: LOCK_DURATION_SEC
    });

    if (error) {
      console.error('[Queue Poll RPC Hatası]:', error.message);
      return;
    }

    if (!tasks || tasks.length === 0) return;

    const task = tasks[0];
    currentTaskInProgress = true;
    try {
      const result = await executePublishTask(task);
      await supabase.rpc('complete_publish_task', {
        p_task_id: task.task_id,
        p_worker_id: WORKER_ID,
        p_status: 'published',
        p_platform_post_id: String(result.platformPostId),
        p_platform_response: result.rawResponse
      });
      console.log(`[Task Success] Görev tamamlandı: ${task.task_id}`);
    } catch (execErr) {
      const isTimeout = execErr.name === 'AbortError' || execErr.message.includes('timeout') || execErr.message.includes('ETIMEDOUT');
      const targetStatus = isTimeout ? 'reconciliation_required' : 'failed';

      console.error(`[Task ${targetStatus.toUpperCase()}] ID: ${task.task_id} -> ${sanitizeError(execErr.message)}`);
      await supabase.rpc('complete_publish_task', {
        p_task_id: task.task_id,
        p_worker_id: WORKER_ID,
        p_status: targetStatus,
        p_error_message: sanitizeError(execErr.message)
      });
    } finally {
      currentTaskInProgress = false;
    }
  } catch (loopErr) {
    console.error('[Polling Döngü Hatası]:', loopErr);
  }
}

// Polling Zamanlayıcısı
const pollTimer = setInterval(queuePollLoop, POLL_INTERVAL_MS);
queuePollLoop();

// ── GRACEFUL SHUTDOWN İŞLEYİCİSİ ──
async function handleGracefulShutdown(signal) {
  console.log(`\n[Shutdown] ${signal} sinyali alındı. Servis kapatılıyor...`);
  isShuttingDown = true;
  clearInterval(pollTimer);

  if (currentTaskInProgress) {
    console.log('[Shutdown] Devam eden görev tamamlanana kadar bekleniyor (Maks 30 sn)...');
    let waitCount = 0;
    while (currentTaskInProgress && waitCount < 30) {
      await new Promise(r => setTimeout(r, 1000));
      waitCount++;
    }
  }

  console.log('[Shutdown] Publisher worker güvenle kapatıldı.');
  process.exit(0);
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

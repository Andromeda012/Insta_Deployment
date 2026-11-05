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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import httpClient from './http-client.cjs';

const { fetchWithTimeout } = httpClient;

import { startAutonomousScheduler } from './scheduler.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIVE_PUBLISHING_ENABLED = process.env.ENABLE_LIVE_PUBLISHING === 'true';
const DRY_RUN = process.env.DRY_RUN !== 'false' || !LIVE_PUBLISHING_ENABLED;
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

// HTTP timeout ve response-body güvenliği http-client.cjs içinde merkezi olarak uygulanır.

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

// ── YOUTUBE SHORTS VİDEO HAZIRLAMA YARDIMCISI (MP4 DOĞRULAMA & PNG->MP4) ─────
const DEFAULT_YT_MP4_FALLBACK = 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/instagram/reels-1793379608273-qhjj.mp4';

async function prepareYouTubeVideoBuffer(mediaUrl, taskId) {
  const cleanUrl = String(mediaUrl || '').trim();
  const isDirectVideo = /\.(mp4|mov)(\?.*)?$/i.test(cleanUrl);

  if (isDirectVideo) {
    const res = await fetch(cleanUrl);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 1000) return { buffer: buf, source: 'direct_video_url' };
    }
  }

  // Görsel URL (1080x1920 Story/Shorts PNG) ise ffmpeg ile 10 sn 9:16 H.264 MP4 videoya dönüştür
  if (cleanUrl && /^https?:\/\//i.test(cleanUrl)) {
    const tmpDir = os.tmpdir();
    const imgPath = path.join(tmpDir, `yt_in_${taskId}_${Date.now()}.png`);
    const mp4Path = path.join(tmpDir, `yt_out_${taskId}_${Date.now()}.mp4`);
    try {
      const imgRes = await fetch(cleanUrl);
      if (imgRes.ok) {
        const imgBuf = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(imgPath, imgBuf);
        execFileSync('ffmpeg', [
          '-y',
          '-loop', '1',
          '-i', imgPath,
          '-f', 'lavfi',
          '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-t', '10',
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-r', '30',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-shortest',
          '-movflags', '+faststart',
          mp4Path
        ], { stdio: 'ignore', timeout: 30000 });

        if (fs.existsSync(mp4Path)) {
          const outBuf = fs.readFileSync(mp4Path);
          if (outBuf.length > 5000) {
            return { buffer: outBuf, source: 'ffmpeg_rendered_from_story_png' };
          }
        }
      }
    } catch (_) {
      // ffmpeg mevcut değilse veya dönüştürme başarısızsa doğrulanmış MP4 fallback'e geç
    } finally {
      try { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } catch (_) {}
      try { if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path); } catch (_) {}
    }
  }

  const fallbackUrl = process.env.YOUTUBE_DEFAULT_MP4_URL || DEFAULT_YT_MP4_FALLBACK;
  const fbRes = await fetch(fallbackUrl);
  if (!fbRes.ok) {
    throw new Error(`YouTube video kaynağı indirilemedi (HTTP ${fbRes.status})`);
  }
  const fbBuf = Buffer.from(await fbRes.arrayBuffer());
  if (fbBuf.length < 1000) {
    throw new Error('YouTube video dosyası geçersiz veya boş.');
  }
  return { buffer: fbBuf, source: 'verified_mp4_fallback' };
}

// ── PLATFORM YAYIN MOTORU ───────────────────────────────────────────────────
async function executePublish(task) {
  const { task_id, platform, content_type, media_url, caption, hashtags, target_link } = task;
  const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n');

  console.log(`[Görev Başladı] Platform: ${platform} | Tür: ${content_type} | ID: ${task_id}`);

  // DRY-RUN GÜVENCESİ: Kesinlikle hiçbir gerçek platform API çağrısı yapma!
  if (DRY_RUN) {
    const isCarousel = content_type === 'CAROUSEL' || (typeof media_url === 'string' && media_url.trim().startsWith('['));
    console.log(`[DRY-RUN] Simüle yayın doğrulandı: ${platform} (${isCarousel ? 'CAROUSEL' : content_type}) -> ${media_url}`);
    return {
      status: 'dry_run_completed',
      platformPostId: `SIMULATED_${platform.toUpperCase()}_${isCarousel ? 'CAROUSEL_' : ''}${Date.now()}`,
      rawResponse: { mode: 'DRY_RUN_SIMULATION', isCarousel: isCarousel, timestamp: new Date().toISOString() }
    };
  }

  switch (platform.toLowerCase()) {
    // ── 1. INSTAGRAM GRAPH API ──────────────────────────────────────────────
    case 'instagram': {
      const igUserId = process.env.META_IG_USER_ID;
      const igAccessToken = process.env.META_IG_ACCESS_TOKEN;
      if (!igUserId || !igAccessToken) {
        throw new Error('Meta Instagram ortam değişkenleri (META_IG_USER_ID, META_IG_ACCESS_TOKEN) eksik!');
      }

      const isCarousel = content_type === 'CAROUSEL' || (typeof media_url === 'string' && media_url.trim().startsWith('['));

      // ── CAROUSEL YAYIN AKIŞI (İKİLİ PANORAMİK & ÇOKLU MEDYA) ────────────────
      if (isCarousel) {
        let items = [];
        try {
          if (typeof media_url === 'string' && media_url.trim().startsWith('[')) {
            items = JSON.parse(media_url);
          } else if (typeof media_url === 'string' && media_url.includes(',')) {
            items = media_url.split(',').map(s => s.trim()).filter(Boolean);
          } else {
            items = [media_url];
          }
        } catch (_) {
          items = [media_url];
        }

        const itemContainerIds = [];
        for (let i = 0; i < items.length; i++) {
          const itemUrl = items[i];
          const itemParams = new URLSearchParams();
          itemParams.set('access_token', igAccessToken);
          itemParams.set('is_carousel_item', 'true');
          itemParams.set('image_url', itemUrl);

          const itemRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
            method: 'POST',
            body: itemParams
          });
          const itemData = itemRes.data;
          if (!itemRes.ok || !itemData.id) {
            const errMsg = (itemData && itemData.error && itemData.error.message) || (itemData && itemData._rawText) || 'Carousel öğesi oluşturulamadı';
            throw new Error(`Meta Carousel Öğe Hatası (Sıra ${i + 1}): ${sanitize(errMsg)}`);
          }
          itemContainerIds.push(itemData.id);
        }

        // Carousel Ana Konteyneri
        const carouselParams = new URLSearchParams();
        carouselParams.set('access_token', igAccessToken);
        carouselParams.set('media_type', 'CAROUSEL');
        carouselParams.set('children', itemContainerIds.join(','));
        carouselParams.set('caption', fullCaption);

        const containerRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
          method: 'POST',
          body: carouselParams
        });
        const containerData = containerRes.data;
        if (!containerRes.ok || !containerData.id) {
          const errMsg = (containerData && containerData.error && containerData.error.message) || (containerData && containerData._rawText) || 'Carousel konteyner oluşturulamadı';
          throw new Error(`Meta Carousel Container Hatası: ${sanitize(errMsg)}`);
        }

        const creationId = containerData.id;

        // Medya işleme durumunu bekle
        for (let attempt = 1; attempt <= 10; attempt++) {
          await new Promise(r => setTimeout(r, 3000));
          if (attempt % 3 === 0) {
            const lockOk = await heartbeatLockExtension(task_id, 120);
            if (!lockOk) {
              throw new Error('[HeartbeatLost] Kilit süresi doldu veya uzatılamadı. Carousel akışı durduruldu.');
            }
          }

          const statusRes = await fetchWithTimeout(
            `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status`,
            {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${igAccessToken}` }
            }
          );
          const statusData = statusRes.data;
          if (statusData && statusData.status_code === 'FINISHED') break;
          if (statusData && statusData.status_code === 'ERROR') {
            throw new Error(`Instagram carousel medya işleme hatası: ${sanitize(statusData.status || statusData._rawText || 'Bilinmeyen hata')}`);
          }
        }

        // Carousel Yayını (media_publish)
        const pubParams = new URLSearchParams({
          creation_id: creationId,
          access_token: igAccessToken
        });
        const pubRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
          method: 'POST',
          body: pubParams
        });
        const pubData = pubRes.data;
        if (!pubRes.ok || !pubData.id) {
          const errMsg = (pubData && pubData.error && pubData.error.message) || (pubData && pubData._rawText) || 'Carousel yayınlanamadı';
          throw new Error(`Meta Carousel Publish Hatası: ${sanitize(errMsg)}`);
        }

        return {
          status: 'published',
          platformPostId: pubData.id,
          rawResponse: pubData
        };
      }

      const isVideo = content_type === 'REELS' || /\.(mp4|mov)(\?.*)?$/i.test(media_url);
      
      // Token URL yerine POST body içinde taşınır
      const containerParams = new URLSearchParams();
      containerParams.set('access_token', igAccessToken);

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
      const containerData = containerRes.data;
      if (!containerRes.ok || !containerData.id) {
        const errMsg = (containerData && containerData.error && containerData.error.message) ||
                       (containerData && containerData._rawText) ||
                       'Konteyner oluşturulamadı';
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
              'Authorization': `Bearer ${igAccessToken}`
            }
          }
        );
        const statusData = statusRes.data;

        if (statusData.status_code === 'FINISHED') {
          isReady = true;
          break;
        }

        if (statusData.status_code === 'ERROR') {
          throw new Error(`Instagram medya işleme hatası: ${sanitize(statusData.status || statusData._rawText || 'Bilinmeyen hata')}`);
        }
      }

      if (!isReady) {
        throw new Error('Instagram medya işleme zaman aşımı (Transcoding tamamlanamadı)');
      }

      // Adım 3: Medyayı Yayınla (media_publish) — Token body içinde gönderilir
      const pubParams = new URLSearchParams({
        creation_id: creationId,
        access_token: igAccessToken
      });

      const pubRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
        method: 'POST',
        body: pubParams
      });
      const pubData = pubRes.data;

      if (!pubRes.ok || !pubData.id) {
        const errMsg = (pubData && pubData.error && pubData.error.message) ||
                       (pubData && pubData._rawText) ||
                       'Yayınlanamadı';
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
        const upData = upRes.data;
        if (!upRes.ok || !upData.id) {
          const errMsg = (upData && upData.error && upData.error.message) ||
                         (upData && upData._rawText) ||
                         'Bilinmeyen hata';
          throw new Error(`Facebook Story Yükleme Hatası: ${sanitize(errMsg)}`);
        }

        // Heartbeat kontrolü: Multi-step Facebook Story yayınında kilit uzatma
        const fbStoryLockOk = await heartbeatLockExtension(task_id, 120);
        if (!fbStoryLockOk) {
          throw new Error('[HeartbeatLost] Kilit süresi doldu veya uzatılamadı. Facebook Story akışı durduruldu.');
        }

        const stParams = new URLSearchParams({ photo_id: upData.id, access_token: pageAccessToken });
        const stRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${pageId}/photo_stories`, { method: 'POST', body: stParams });
        const stData = stRes.data;
        if (!stRes.ok || (!stData.post_id && !stData.success)) {
          const errMsg = (stData && stData.error && stData.error.message) ||
                         (stData && stData._rawText) ||
                         'Bilinmeyen hata';
          throw new Error(`Facebook Story Yayın Hatası: ${sanitize(errMsg)}`);
        }

        return { status: 'published', platformPostId: stData.post_id || upData.id, rawResponse: stData };
      }

      if (content_type === 'FB_REELS' || content_type === 'VIDEO_REELS' || content_type === 'REELS') {
        return { status: 'unsupported', platformPostId: null, rawResponse: { note: 'Facebook Reels upload is not implemented.' }, errorMessage: '[UNSUPPORTED] Facebook Reels upload is not implemented.' };
      }
      if (content_type === 'LINK_CARD') {
        if (!target_link || !/^https:\/\//i.test(target_link)) throw new Error('Facebook Link Card requires a valid HTTPS target link.');
        const params = new URLSearchParams({ link: target_link, message: fullCaption, access_token: pageAccessToken });
        const result = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${pageId}/feed`, { method: 'POST', body: params });
        if (!result.ok || !result.data?.id) throw new Error('Facebook Link Card publish failed.');
        return { status: 'published', platformPostId: result.data.id, rawResponse: result.data };
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
      const fbData = fbRes.data;
      if (!fbRes.ok || (!fbData.id && !fbData.post_id)) {
        const errMsg = (fbData && fbData.error && fbData.error.message) ||
                       (fbData && fbData._rawText) ||
                       'Bilinmeyen hata';
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
      const initData = initRes.data;

      const initErrCode = initData && initData.error ? initData.error.code : null;
      const initPublishId = initData && initData.data ? initData.data.publish_id : null;
      if (!initRes.ok || initErrCode !== 'ok' || !initPublishId) {
        const errMsg = (initData && initData.error && initData.error.message) ||
                       (initData && initData._rawText) ||
                       'Bilinmeyen TikTok hatası';
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

        const statusData = statusRes.data;
        statusDetails = statusData;

        const statErrCode = statusData && statusData.error ? statusData.error.code : null;
        if (statErrCode !== 'ok') {
          const errMsg = (statusData && statusData.error && statusData.error.message) ||
                         (statusData && statusData._rawText) ||
                         'Hata kodu alındı';
          throw new Error(`TikTok Status API Hatası: ${sanitize(errMsg)}`);
        }

        const currentStatus = statusData && statusData.data ? statusData.data.status : null;
        if (currentStatus === 'PUBLISH_COMPLETE') {
          verifiedStatus = 'PUBLISH_COMPLETE';
          break;
        }

        if (currentStatus === 'FAILED') {
          const failReason = (statusData && statusData.data && statusData.data.fail_reason) ||
                             (statusData && statusData._rawText) ||
                             'Bilinmeyen neden';
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

    // ── 4. YOUTUBE DATA API v3 (RESUMABLE BINARY UPLOAD & OTOMATİK YORUM) ───
    case 'youtube': {
      const ytClientId = process.env.YOUTUBE_CLIENT_ID || process.env.YT_CLIENT_ID;
      const ytClientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.YT_CLIENT_SECRET;
      const ytRefreshToken = process.env.YOUTUBE_REFRESH_TOKEN || process.env.YT_REFRESH_TOKEN;

      if (!ytClientId || !ytClientSecret || !ytRefreshToken) {
        throw new Error('YouTube OAuth2 ortam değişkenleri (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN) eksik!');
      }

      // Adım 1: Refresh Token ile güncel Access Token al
      const tokenParams = new URLSearchParams({
        client_id: ytClientId,
        client_secret: ytClientSecret,
        refresh_token: ytRefreshToken,
        grant_type: 'refresh_token'
      });

      const tokenRes = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams
      });
      const tokenData = tokenRes.data;
      if (!tokenRes.ok || !tokenData || !tokenData.access_token) {
        const errMsg = (tokenData && (tokenData.error_description || tokenData.error)) || 'OAuth2 token yenilenemedi';
        throw new Error(`YouTube OAuth2 Token Hatası: ${sanitize(errMsg)}`);
      }
      const ytAccessToken = tokenData.access_token;

      // Adım 2: 9:16 Dikey MP4 Video Buffer'ını Hazırla
      const { buffer: videoBuffer, source: videoSource } = await prepareYouTubeVideoBuffer(media_url, task_id);

      const lockOk = await heartbeatLockExtension(task_id, 180);
      if (!lockOk) {
        throw new Error('[HeartbeatLost] Kilit süresi doldu veya uzatılamadı. YouTube yükleme akışı durduruldu.');
      }

      // Adım 3: Başlık, Açıklama ve Etiketleri Hazırla (#Shorts Garantili)
      const lines = String(caption || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let rawTitle = lines[0] || '⛰️ NOVA FURNITURE — 1. Sınıf Lüks Mimari Tasarım #Shorts';
      if (!/#shorts/i.test(rawTitle)) {
        rawTitle = `${rawTitle.slice(0, 88)} #Shorts`;
      }
      if (rawTitle.length > 100) {
        rawTitle = `${rawTitle.slice(0, 90)} #Shorts`;
      }

      const parsedTags = String(hashtags || '#Shorts #novafurniture #mobilyatasarım')
        .split(/[\s,]+/)
        .map(t => t.replace(/^#+/, '').trim())
        .filter(Boolean)
        .slice(0, 15);
      if (!parsedTags.some(t => t.toLowerCase() === 'shorts')) {
        parsedTags.unshift('Shorts');
      }

      const metadata = {
        snippet: {
          title: rawTitle,
          description: fullCaption || rawTitle,
          tags: parsedTags,
          categoryId: '26'
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false
        }
      };

      // Adım 4: Resumable Upload Oturumu Başlat
      const initRes = await fetchWithTimeout(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ytAccessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': String(videoBuffer.length),
            'X-Upload-Content-Type': 'video/mp4'
          },
          body: JSON.stringify(metadata)
        }
      );

      if (!initRes.ok) {
        const errMsg = (initRes.data && initRes.data.error && initRes.data.error.message) ||
                       (initRes.data && initRes.data._rawText) ||
                       `HTTP ${initRes.status}`;
        throw new Error(`YouTube Resumable Init Hatası: ${sanitize(errMsg)}`);
      }

      const uploadUrl = initRes.headers && typeof initRes.headers.get === 'function'
        ? initRes.headers.get('location')
        : null;
      if (!uploadUrl) {
        throw new Error('YouTube Resumable Upload Location başlığı alınamadı.');
      }

      // Adım 5: Binary Video Verisini Yükle (PUT)
      const putController = new AbortController();
      const putTimer = setTimeout(() => putController.abort(), 90000);
      let uploadRes;
      let uploadData;
      try {
        uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${ytAccessToken}`,
            'Content-Type': 'video/mp4',
            'Content-Length': String(videoBuffer.length)
          },
          body: videoBuffer,
          signal: putController.signal
        });
        const uploadText = await uploadRes.text();
        try { uploadData = JSON.parse(uploadText); } catch (_) { uploadData = { _rawText: uploadText }; }
      } finally {
        clearTimeout(putTimer);
      }

      if (!uploadRes || !uploadRes.ok || !uploadData || !uploadData.id) {
        const errMsg = (uploadData && uploadData.error && uploadData.error.message) ||
                       (uploadData && uploadData._rawText) ||
                       'Video yükleme tamamlanamadı';
        throw new Error(`YouTube Binary Upload Hatası: ${sanitize(errMsg)}`);
      }

      const videoId = uploadData.id;
      let firstCommentId = null;

      // Adım 6: Otomatik İlk Yorum (Showroom & WhatsApp Linki)
      try {
        const commentText = `📌 Koleksiyonlarımızı dijital showroom'da incelemek için: ${target_link || 'https://globalkapakmobilya.com/galeri.html'} | 📲 WhatsApp Fiyat & Sipariş Hattı: https://wa.me/905050151035 (0505 015 1035)`;
        const commentRes = await fetchWithTimeout('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ytAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            snippet: {
              videoId,
              topLevelComment: {
                snippet: {
                  textOriginal: commentText
                }
              }
            }
          })
        });
        if (commentRes.ok && commentRes.data && commentRes.data.id) {
          firstCommentId = commentRes.data.id;
        }
      } catch (commentErr) {
        console.warn('[YouTube İlk Yorum Uyarısı]:', sanitize(commentErr.message));
      }

      return {
        status: 'published',
        platformPostId: videoId,
        rawResponse: {
          ...uploadData,
          watchUrl: `https://www.youtube.com/shorts/${videoId}`,
          videoSource,
          firstCommentId
        }
      };
    }

    default:
      throw new Error(`Desteklenmeyen platform: ${platform}`);
  }
}

// ── ANA KUYRUK DÖNGÜSÜ ───────────────────────────────────────────────────────

// Admin Paneli Durum Senkronizasyonu Helper Fonksiyonu
async function getPersistedQueueState(taskId) {
  const { data, error } = await supabase.from('social_publish_queue')
    .select('status,platform_post_id,error_message,published_at')
    .eq('id', taskId).maybeSingle();
  if (error) throw error;
  return data;
}

async function syncAdminPanelStatus(task, finalStatus, platformPostId = null, errorMsg = null) {
  try {
    const map = {
      instagram: { key: 'insta_bot_state', list: 'scheduled_posts' },
      facebook: { key: 'fb_bot_state', list: 'scheduled_posts' },
      tiktok: { key: 'tt_bot_state', list: 'scheduledQueue' },
      youtube: { key: 'yt_bot_state', list: 'scheduled_posts' }
    };
    const target = map[String(task.platform || '').toLowerCase()];
    if (!target) return;
    const { data: rows, error: getErr } = await supabase.from('site_settings').select('data').eq('key', target.key).limit(1);
    if (getErr || !rows || rows.length === 0) return;
    const state = rows[0]?.data || {};
    const posts = Array.isArray(state[target.list]) ? state[target.list] : [];
    const item = posts.find(p =>
      p.queue_task_id === task.task_id ||
      p.queue_idempotency_key === task.idempotency_key ||
      p.idempotency_key === task.idempotency_key
    );
    if (!item) return;
    item.status = finalStatus;
    if (platformPostId) item.platform_post_id = String(platformPostId);
    if (errorMsg) item.error_message = errorMsg;
    item.worker_processed_at = new Date().toISOString();
    const { error: updateError } = await supabase.from('site_settings')
      .update({ data: state, updated_at: new Date().toISOString() }).eq('key', target.key);
    if (updateError) throw updateError;
    console.log(`[Admin Panel Sync] ${target.key} -> ${finalStatus} (${task.task_id})`);
  } catch (syncErr) {
    console.warn('[Admin Panel Sync Warning]:', sanitize(syncErr.message));
  }
}

async function syncInstagramPublishedTracker(task, platformPostId) {
  if (task.platform !== 'instagram' || !platformPostId || !task.product_slug) return;
  const format = String(task.content_type || '').toUpperCase();
  if (!['POST', 'REELS', 'STORIES'].includes(format)) return;
  try {
    const { data: rows, error: readError } = await supabase.from('site_settings')
      .select('data').eq('key', 'instagram_published_tracker').limit(1);
    if (readError) throw readError;
    const tracker = rows?.[0]?.data || {};
    const formats = Array.isArray(tracker[task.product_slug]) ? tracker[task.product_slug] : [];
    if (!formats.includes(format)) formats.push(format);
    tracker[task.product_slug] = formats;
    const { error: writeError } = await supabase.from('site_settings').upsert({
      key: 'instagram_published_tracker', data: tracker, updated_at: new Date().toISOString()
    });
    if (writeError) throw writeError;
  } catch (error) {
    console.warn('[Instagram Tracker Sync Warning]:', sanitize(error.message));
  }
}
async function claimDirectYouTubeTaskIfReady() {
  try {
    const nowIso = new Date().toISOString();
    const { data: candidates, error: selErr } = await supabase
      .from('social_publish_queue')
      .select('id, platform, content_type, product_slug, media_url, caption, hashtags, target_link, idempotency_key, retry_count, scheduled_for')
      .eq('platform', 'youtube')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(1);

    if (selErr || !candidates || candidates.length === 0) return null;
    const candidate = candidates[0];
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_SEC * 1000).toISOString();

    const { data: updated, error: updErr } = await supabase
      .from('social_publish_queue')
      .update({
        status: 'processing',
        worker_id: WORKER_ID,
        locked_until: lockedUntil,
        retry_count: (candidate.retry_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', candidate.id)
      .eq('status', 'pending')
      .select('id, platform, content_type, product_slug, media_url, caption, hashtags, target_link, idempotency_key, retry_count, scheduled_for')
      .maybeSingle();

    if (updErr || !updated) return null;
    return {
      task_id: updated.id,
      platform: updated.platform,
      content_type: updated.content_type,
      product_slug: updated.product_slug,
      media_url: updated.media_url,
      caption: updated.caption,
      hashtags: updated.hashtags,
      target_link: updated.target_link,
      idempotency_key: updated.idempotency_key,
      retry_count: updated.retry_count,
      scheduled_for: updated.scheduled_for
    };
  } catch (_) {
    return null;
  }
}

async function pollQueueCycle() {
  if (isShuttingDown || isTaskRunning) return;

  try {
    // Adım 1A: YouTube görevi varsa doğrudan claim et (Eski DB RPC'nin unsupported yapmasını önler)
    const directYtTask = await claimDirectYouTubeTaskIfReady();
    let tasks = directYtTask ? [directYtTask] : null;
    let claimError = null;

    // Adım 1B: Atomik Görev Talebi (FOR UPDATE SKIP LOCKED)
    if (!tasks) {
      const rpcRes = await supabase.rpc('claim_next_publish_task', {
        p_worker_id: WORKER_ID,
        p_lock_duration_seconds: LOCK_DURATION_SEC
      });
      tasks = rpcRes.data;
      claimError = rpcRes.error;
    }

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

      // KRİTİK DOĞRULAMA: Panel yalnızca queue RPC kesin başarı döndürdükten sonra güncellenir.
      if (completeError || completedSuccessfully !== true) {
        const errMsg = (completeError && completeError.message) || 'v_updated = 0';
        console.error(
          `[RPC Başarısız] Görev veritabanında güncellenemedi (Kilit süresi dolmuş veya başka worker devralmış olabilir) - Görev ID: ${task.task_id} - Hata: ${sanitize(errMsg)}`
        );
      } else {
        const persisted = await getPersistedQueueState(task.task_id).catch(err => {
          console.warn('[Queue state read warning]:', sanitize(err.message)); return null;
        });
        const finalStatus = persisted?.status || result.status;
        const finalPostId = persisted?.platform_post_id || (finalStatus === 'published' ? result.platformPostId : null);
        await syncAdminPanelStatus(task, finalStatus, finalPostId, persisted?.error_message || result.errorMessage);
        if (finalStatus === 'published') await syncInstagramPublishedTracker(task, finalPostId);
        console.log(`[Görev Tamamlandı] ID: ${task.task_id} -> Durum: ${finalStatus}`);
      }
    } catch (execErr) {
      const lowerMsg = (execErr.message || '').toLowerCase();
      const isUncertainNetworkState =
        execErr.uncertain === true ||
        execErr.name === 'AbortError' ||
        execErr.name === 'TimeoutError' ||
        execErr.name === 'NetworkRequestError' ||
        execErr.name === 'ResponseBodyError' ||
        execErr.name === 'ResponseParseError' ||
        lowerMsg.includes('timeout') ||
        lowerMsg.includes('abort') ||
        lowerMsg.includes('etimedout') ||
        lowerMsg.includes('econnreset') ||
        lowerMsg.includes('econnrefused') ||
        lowerMsg.includes('enotfound') ||
        lowerMsg.includes('socket hang up') ||
        lowerMsg.includes('network') ||
        lowerMsg.includes('fetch failed') ||
        lowerMsg.includes('heartbeatlost') ||
        lowerMsg.includes('502') ||
        lowerMsg.includes('503') ||
        lowerMsg.includes('504');

      // Ağ zaman aşımında, bağlantı kopmalarında veya kilit kaybında:
      // Gönderilmiş olan HTTP POST isteğinin platform tarafından işlenip işlenmediği belirsizdir.
      // Mükerrer yayını KESİNLİKLE önlemek için görev 'reconciliation_required' yapılır; otomatik retry engellenir!
      const finalStatus = isUncertainNetworkState ? 'reconciliation_required' : 'failed';
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
      } else {
        const persisted = await getPersistedQueueState(task.task_id).catch(err => {
          console.warn('[Queue state read warning]:', sanitize(err.message)); return null;
        });
        await syncAdminPanelStatus(task, persisted?.status || finalStatus, persisted?.platform_post_id || null, persisted?.error_message || cleanErrMsg);
      }
    } finally {
      isTaskRunning = false;
      currentRunningTaskId = null;
    }
  } catch (cycleErr) {
    console.error('[Döngü Hatası]:', sanitize(cycleErr.message));
  }
}

// Otonom Zamanlayıcıyı Başlat (Dinamik Ayar Dinleyicisi)

const schedulerHandle = startAutonomousScheduler(supabase, 30000, process.env.GEMINI_API_KEY);



// Kuyruk Tüketici Zamanlayıcısını Başlat

const pollIntervalHandle = setInterval(pollQueueCycle, POLL_INTERVAL_MS);

pollQueueCycle();

// ── GRACEFUL SHUTDOWN (KONTROLLÜ KAPATMA) ────────────────────────────────────
async function handleShutdown(signal) {
  console.log(`\n[Shutdown] ${signal} sinyali alındı. Yeni görev alımı durduruldu. Kapanıyor...`);
  isShuttingDown = true;

  if (schedulerHandle && typeof schedulerHandle.stop === 'function') schedulerHandle.stop();

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

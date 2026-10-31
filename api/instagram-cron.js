// ============================================================================
// Nova Furniture (@thenovafurniture) — Instagram Cloud Autonomous Publisher
// Endpoint: https://insta-deployment-rho.vercel.app/api/instagram-cron
// ============================================================================
import {
  generateAutonomousInstagramContent,
  publishToInstagramGraphApi,
  scanAndReplyInstagramComments,
  scanAndReplyInstagramDms,
  ensureInstagramAppSubscribed,
  DEFAULT_IG_USER_ID,
  DEFAULT_META_ACCESS_TOKEN
} from '../Module 2/Instagram/bot-engine.js';
import PhotoroomEngine from '../photoroom-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';
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

async function ensurePublicImageUrl(rawImg, slug = 'item') {
  if (!rawImg) {
    return DEFAULT_MEDIA_FALLBACK;
  }
  if (rawImg.startsWith('http://') || rawImg.startsWith('https://')) {
    if (rawImg.includes('.svg') || rawImg.includes('instagram-render')) {
      return DEFAULT_MEDIA_FALLBACK;
    }
    return rawImg;
  }
  if (rawImg.startsWith('data:image/')) {
    try {
      const cleanB64 = rawImg.replace(/^data:image\/\w+;base64,/, '');
      const mimeMatch = rawImg.match(/^data:(image\/\w+);base64,/);
      const ext = mimeMatch && mimeMatch[1].includes('jpeg') ? 'jpg' : 'png';
      const cType = mimeMatch ? mimeMatch[1] : 'image/png';
      const buf = Buffer.from(cleanB64, 'base64');
      const safeSlug = (slug || 'product').replace(/[^a-zA-Z0-9_-]/g, '');
      const fileName = `catalog-${safeSlug}-${Date.now()}.${ext}`;
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/media/instagram/${fileName}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': cType,
          'x-upsert': 'true'
        },
        body: buf
      });
      if (uploadRes.ok) {
        return `${SUPABASE_URL}/storage/v1/object/public/media/instagram/${fileName}`;
      }
    } catch (e) {
      console.warn('Base64 upload error:', e);
    }
    return DEFAULT_MEDIA_FALLBACK;
  }
  return DEFAULT_MEDIA_FALLBACK;
}

async function uploadAutonomousSvgToStorage(fileName, svgString) {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/media/instagram/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/svg+xml',
        'x-upsert': 'true'
      },
      body: svgString
    });
    if (res.ok) {
      return `${SUPABASE_URL}/storage/v1/object/public/media/instagram/${fileName}`;
    }
  } catch (_) {}
  return null;
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
    const state = rows?.[0]?.data || { config: {}, scheduled_posts: [], conversations: [] };
    const config = state.config || {};

    // Yorum ve DM Tarama / Otomatik Yanıtlama İsteği
    if (req.query?.action === 'scan_comments' || req.body?.action === 'scan_comments' || req.query?.action === 'scan_dms') {
      const catalog = await fetchProductsCatalog();
      const igUserId = config.ig_user_id || process.env.IG_USER_ID || DEFAULT_IG_USER_ID;
      const accessToken = config.access_token || config.ig_access_token || process.env.IG_ACCESS_TOKEN || DEFAULT_META_ACCESS_TOKEN;
      
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

    // Doğrudan UI'dan "Şimdi Yayınla" isteği geldiyse Meta Graph API'ye anında gönder
    if (req.method === 'POST' && (req.body?.action === 'publish' || req.body?.imageBase64 || req.body?.videoBase64 || req.body?.videoUrl || req.body?.mediaUrl)) {
      const body = req.body || {};
      let igUserId = body.igUserId || config.ig_user_id || process.env.IG_USER_ID;
      let accessToken = body.accessToken || config.access_token || config.ig_access_token || process.env.IG_ACCESS_TOKEN;
      let publicImageUrl = body.mediaUrl || body.imageUrl;
      let publicVideoUrl = body.videoUrl;
      const mediaType = (body.mediaType || (publicVideoUrl ? 'REELS' : 'POST')).toUpperCase();
      const caption = body.caption || '';

      if (!igUserId || !accessToken) {
        return res.status(400).json({ ok: false, error: 'Instagram Business ID veya Meta Access Token eksik!' });
      }

      // Eğer Base64 Video geldiyse MP4 olarak Supabase Storage'a kaydet
      if (body.videoBase64) {
        try {
          const cleanBase64 = body.videoBase64.replace(/^data:video\/\w+;base64,/, '');
          const buffer = Buffer.from(cleanBase64, 'base64');
          const fileName = `reels-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.mp4`;
          const storagePath = `instagram/${fileName}`;
          const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${storagePath}`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'video/mp4',
              'x-upsert': 'true'
            },
            body: buffer
          });
          if (uploadRes.ok) {
            publicVideoUrl = `${SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;
          }
        } catch (_) {}
      }

      // Eğer Base64 Görsel geldiyse PNG olarak Supabase Storage'a kaydet
      if (body.imageBase64 && !publicVideoUrl) {
        try {
          const cleanBase64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(cleanBase64, 'base64');
          const fileName = `post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.png`;
          const storagePath = `instagram/${fileName}`;
          const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${storagePath}`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'image/png',
              'x-upsert': 'true'
            },
            body: buffer
          });
          if (uploadRes.ok) {
            publicImageUrl = `${SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;
          }
        } catch (_) {}
      }

      // REELS VİDEOSU YAYINLAMA
      if (mediaType === 'REELS' || publicVideoUrl) {
        if (!publicVideoUrl) {
          return res.status(400).json({ ok: false, error: 'Reels için videoUrl veya videoBase64 verisi gereklidir!' });
        }

        // 1. Meta Reels Video Konteyneri Oluştur
        const createParams = new URLSearchParams();
        createParams.set('access_token', accessToken);
        createParams.set('media_type', 'REELS');
        createParams.set('video_url', publicVideoUrl);
        createParams.set('caption', caption);
        createParams.set('share_to_feed', 'true');

        const containerRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media`, {
          method: 'POST',
          body: createParams
        });
        const containerData = await containerRes.json();
        if (!containerRes.ok || !containerData.id) {
          return res.status(400).json({
            ok: false,
            error: `Meta Reels Hatası: ${containerData?.error?.message || 'Reels konteyneri oluşturulamadı'}`
          });
        }

        const containerId = containerData.id;

        // 2. Meta Video Transcoding Durumunu Bekle (status_code === 'FINISHED')
        let ready = false;
        for (let i = 0; i < 25; i++) {
          await new Promise(r => setTimeout(r, 2500));
          const checkRes = await fetch(`https://graph.facebook.com/v20.0/${containerId}?fields=status_code,status&access_token=${accessToken}`);
          const checkData = await checkRes.json();
          if (checkData.status_code === 'FINISHED') {
            ready = true;
            break;
          }
          if (checkData.status_code === 'ERROR') {
            return res.status(400).json({
              ok: false,
              error: `Meta Video İşleme Hatası: ${checkData.status || 'Reels videosu kodlanamadı'}`
            });
          }
        }

        if (!ready) {
          return res.status(400).json({
            ok: false,
            error: 'Meta Reels video işleme zaman aşımına uğradı, lütfen birkaç saniye sonra tekrar deneyin.'
          });
        }

        // 3. Meta Yayınla (media_publish)
        const pubParams = new URLSearchParams();
        pubParams.set('creation_id', containerId);
        pubParams.set('access_token', accessToken);
        const pubRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media_publish`, {
          method: 'POST',
          body: pubParams
        });
        const pubData = await pubRes.json();
        if (!pubRes.ok || !pubData.id) {
          return res.status(400).json({
            ok: false,
            error: `Meta Reels Yayın Hatası: ${pubData?.error?.message || 'Yayınlanamadı'}`
          });
        }

        return res.status(200).json({
          ok: true,
          publishedId: pubData.id,
          mediaUrl: publicVideoUrl,
          mediaType: 'REELS',
          message: 'Reels videosu hareketli kamera efektiyle başarıyla Instagram\'da yayınlandı!'
        });
      }

      // STANDART GÖNDERİ / HİKAYE YAYINLAMA
      if (!publicImageUrl || publicImageUrl.includes('.svg') || publicImageUrl.includes('instagram-render')) {
        publicImageUrl = DEFAULT_MEDIA_FALLBACK;
      }

      // 1. Meta Konteyner Oluştur
      const createParams = new URLSearchParams();
      createParams.set('access_token', accessToken);
      createParams.set('image_url', publicImageUrl);
      createParams.set('caption', caption);
      if (mediaType === 'STORIES') createParams.set('media_type', 'STORIES');

      const containerRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media`, {
        method: 'POST',
        body: createParams
      });
      const containerData = await containerRes.json();
      if (!containerRes.ok || !containerData.id) {
        return res.status(400).json({
          ok: false,
          error: `Meta Hatası: ${containerData?.error?.message || 'Medya konteyneri oluşturulamadı'}`
        });
      }

      // 2. Meta Yayınla
      const pubParams = new URLSearchParams();
      pubParams.set('creation_id', containerData.id);
      pubParams.set('access_token', accessToken);
      const pubRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media_publish`, {
        method: 'POST',
        body: pubParams
      });
      const pubData = await pubRes.json();
      if (!pubRes.ok || !pubData.id) {
        return res.status(400).json({
          ok: false,
          error: `Meta Yayın Hatası: ${pubData?.error?.message || 'Yayınlanamadı'}`
        });
      }

      return res.status(200).json({
        ok: true,
        publishedId: pubData.id,
        mediaUrl: publicImageUrl,
        mediaType,
        message: 'Gönderi başarıyla Instagram hesabınızda yayınlandı!'
      });
    }

    if (config.auto_publish_enabled === false) {
      return res.status(200).json({ ok: true, message: 'Otomatik paylaşım duraklatılmış durumda.', published: [] });
    }

    state.scheduled_posts = Array.isArray(state.scheduled_posts) ? state.scheduled_posts : [];
    const catalog = await fetchProductsCatalog();
    const forceGenerateType = req.query?.generate_type || req.body?.generate_type || null;

    const nowMs = Date.now();
    let duePosts = state.scheduled_posts.filter(
      p => (p.status === 'scheduled' || p.status === 'QUEUED') && new Date(p.scheduled_for).getTime() <= nowMs
    );

    // Eğer kuyrukta kullanıcı tarafından planlanmış bekleyen gönderi yoksa:
    // SADECE ve SADECE tanımlanmış zaman slotu (posting_slots) geldiyse otonom üret!
    if (duePosts.length === 0) {
      const defaultSlots = [
        { slot_id: 'slot_1', time: '10:00', type: 'REELS', active: true, label: 'Sabah (10:00) — Hareketli Reels Videosu (Otonom)' },
        { slot_id: 'slot_2', time: '14:30', type: 'POST', active: true, label: 'Öğle (14:30) — Detay Maddeli Gönderi (Otonom)' },
        { slot_id: 'slot_3', time: '20:00', type: 'STORIES', active: true, label: 'Akşam (20:00) — Detay Maddeli Hikaye (Otonom)' }
      ];
      const slots = (Array.isArray(config.posting_slots) && config.posting_slots.length > 0)
        ? config.posting_slots
        : defaultSlots;

      // Bozuk karakter kodlaması (ör. "Ã–ÄŸle", "â€”") içeren slot etiketlerini otomatik onar
      const typeLabels = { REELS: 'Hareketli Reels Videosu', POST: 'Detay Maddeli Gönderi', STORIES: 'Detay Maddeli Hikaye' };
      slots.forEach(s => {
        if (s.label && /Ã|Ä|Å|â€/.test(s.label)) {
          const h = parseInt(String(s.time).split(':')[0], 10);
          const part = h < 12 ? 'Sabah' : h < 17 ? 'Öğle' : 'Akşam';
          s.label = `${part} (${s.time}) — ${typeLabels[s.type] || 'Otonom Paylaşım'} (Otonom)`;
        }
      });

      const now = new Date();
      // Türkiye Saati (UTC+3) — tarih de Türkiye saatine göre hesaplanır
      const trNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const istHour = trNow.getUTCHours();
      const istMin = trNow.getUTCMinutes();
      const currentHHMM = String(istHour).padStart(2, '0') + ':' + String(istMin).padStart(2, '0');
      const todayStr = trNow.toISOString().slice(0, 10);

      // Slot kontrolü: Belirlenen saatten itibaren 4 saat içinde ve bugün henüz çalışmamışsa.
      // Geniş pencere sayesinde zamanlayıcı (GitHub Actions / Vercel Cron) gecikse bile paylaşım kaçmaz;
      // last_run_date kilidi sayesinde her slot günde en fazla 1 kez çalışır.
      const CATCH_UP_WINDOW_MIN = 240;
      const nowTotalMin = istHour * 60 + istMin;
      const activeSlot = slots
        .filter(s => {
          if (!s.active || !s.time) return false;
          if (s.last_run_date === todayStr) return false;
          const [sh, sm] = s.time.split(':').map(Number);
          const diffMin = nowTotalMin - (sh * 60 + sm);
          return diffMin >= 0 && diffMin <= CATCH_UP_WINDOW_MIN;
        })
        // Birden fazla slot gecikmişse en son saati gelen slot önceliklidir
        .sort((a, b) => b.time.localeCompare(a.time))[0];

      // Eğer şu an planlanmış bir saat slotu değilse VE panelden zorla (forceGenerateType) tetiklenmediyse: ASLA PAYLAŞMA!
      if (!forceGenerateType && !activeSlot) {
        return res.status(200).json({
          ok: true,
          checked_at: new Date().toISOString(),
          message: 'Şu an Instagram için planlanmış bir paylaşım saati değil ve kuyrukta bekleyen gönderi yok.',
          current_time: currentHHMM,
          published_count: 0,
          published: []
        });
      }

      const chosenType = forceGenerateType || activeSlot?.type || 'POST';

      if (activeSlot) {
        activeSlot.last_run_date = todayStr;
        activeSlot.last_run_time = currentHHMM;
        // Kilidi hemen kaydet: eşzamanlı tetiklemelerde (GitHub Actions + Vercel Cron) çift paylaşım olmasın
        await saveInstaState(state);
      }
      
      // Tek ürün 3 format: Gün boyunca aynı ürün kullanılır (Sabah 10:00 Reels, Öğle 14:30 Post, Akşam 20:00 Story)
      let pickedProduct = null;
      if (catalog && catalog.length > 0) {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
        pickedProduct = catalog[dayOfYear % catalog.length];
      }

      // Photoroom Mimari Üretim Pipeline'ından Varlıkları Al
      let campaign = await PhotoroomEngine.fetchActiveCampaignFromSupabase();
      const hasInvalidMedia = c => !c
        || /\.svg(\?.*)?$/i.test(c.post_image_url || '')
        || /\.svg(\?.*)?$/i.test(c.story_image_url || '');
      if (!campaign || campaign.product_slug !== pickedProduct?.slug || hasInvalidMedia(campaign)) {
        campaign = await PhotoroomEngine.buildAndSaveProductCampaign({
          product: pickedProduct,
          apiKey: config.photoroom_api_key || process.env.PHOTOROOM_API_KEY
        });
      }

      // Slota göre doğru Photoroom varlığını seç (Meta yalnızca PNG/JPG ve MP4 kabul eder)
      const isVideoUrl = u => /\.(mp4|mov)(\?.*)?$/i.test(u || '');
      const notSvg = u => (u && !/\.svg(\?.*)?$/i.test(u)) ? u : null;
      const imageFallback = pickedProduct?.ana_resim && /^https?:\/\//.test(pickedProduct.ana_resim)
        ? pickedProduct.ana_resim
        : DEFAULT_MEDIA_FALLBACK;
      let finalType = chosenType;
      let targetMediaUrl = notSvg(campaign.post_image_url) || imageFallback;
      if (chosenType === 'REELS') {
        // Bu ürüne ait gerçek MP4 Reels videosu: 1) kampanya 2) ürün video kütüphanesi 3) geçmiş paylaşımlar
        const slug = pickedProduct?.slug;
        const library = state.reels_video_library || {};
        const historyVideo = (state.scheduled_posts || []).find(p =>
          p.product_slug === slug && (p.media_type === 'REELS') && isVideoUrl(p.media_url)
        )?.media_url;
        const productVideo = [campaign.reels_video_url, slug && library[slug], historyVideo].find(isVideoUrl);
        if (productVideo) {
          targetMediaUrl = productVideo;
          if (slug) state.reels_video_library = { ...library, [slug]: productVideo };
        } else {
          // Bu ürün için henüz video yoksa yanlış ürün videosu paylaşmak yerine
          // ürünün işlenmiş mimari görseli feed gönderisi olarak paylaşılır.
          finalType = 'POST';
          targetMediaUrl = notSvg(campaign.photoroom_hero_url) || notSvg(campaign.post_image_url) || imageFallback;
        }
      } else if (chosenType === 'STORIES') {
        targetMediaUrl = notSvg(campaign.story_image_url) || notSvg(campaign.post_image_url) || imageFallback;
      }

      const newPostRecord = {
        id: campaign.id,
        media_type: finalType,
        slot_type: chosenType,
        title: campaign.product_title || pickedProduct?.title || 'Lüks Koleksiyon',
        caption: campaign.caption,
        hashtags: campaign.hashtags || '#novafurniture #minimalistmobilya #icmimari #luxuryfurniture',
        media_url: targetMediaUrl,
        auto_designed: true,
        product_slug: pickedProduct?.slug || null,
        scheduled_for: new Date().toISOString(),
        status: 'scheduled',
        photoroom_campaign_id: campaign.id
      };

      state.scheduled_posts.unshift(newPostRecord);
      duePosts = [newPostRecord];
    }

    const publishedList = [];
    const failedList = [];
    for (const post of duePosts) {
      const fullCaption = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
      try {
        let mType = (post.media_type || post.content_type || 'POST').toUpperCase();
        let mediaUrl = post.media_url;
        if (!mediaUrl || /\.svg(\?.*)?$/i.test(mediaUrl) || mediaUrl.includes('instagram-render')) {
          mediaUrl = DEFAULT_MEDIA_FALLBACK;
        }
        // Reels için video yoksa görsel feed gönderisi olarak paylaşılır (Meta görselli Reels kabul etmez)
        if (mType === 'REELS' && !/\.(mp4|mov)(\?.*)?$/i.test(mediaUrl)) {
          mType = 'POST';
          post.media_type = 'POST';
        }
        post.media_url = mediaUrl;

        const publishResult = await publishToInstagramGraphApi({
          igUserId: config.ig_user_id || process.env.IG_USER_ID || '17841435882645322',
          accessToken: config.access_token || config.ig_access_token || process.env.IG_ACCESS_TOKEN || 'EAAVytShbbJUBSZBpjyQk9JEpsliUSVgEGdZCyBl2bnzwN5SJgBJj0GsKArgux7QZAlLBbQcgykaoax6UoDiiZBiYRvAeZC0C9Mq06mal2NPPaJ2ZCUOZANPlwj3WWL6iFeIEH6KmOrW2GMann2cPD7MogvaYpvuKZCsZB7DmuUj87ZBRBnS3oVqi2umjEfh6NwGA6mMwZDZD',
          mediaType: mType,
          mediaUrl,
          caption: fullCaption
        });

        post.status = 'published';
        post.published_at = new Date().toISOString();
        post.ig_published_id = publishResult.publishedId;
        post.auto_approved = true;

        if (post.photoroom_campaign_id) {
          await PhotoroomEngine.markPlatformPublished(post.photoroom_campaign_id, 'instagram', post.media_type);
        }

        publishedList.push({
          id: post.id,
          title: post.title,
          media_type: post.media_type,
          auto_designed: !!post.auto_designed,
          media_url: post.media_url,
          publishedId: publishResult.publishedId,
          mode: publishResult.mode
        });
      } catch (pubErr) {
        console.error('Instagram publish error:', pubErr.message);
        post.status = 'failed';
        post.error_message = pubErr.message;
        post.failed_at = new Date().toISOString();
        failedList.push({ id: post.id, media_type: post.media_type, error: pubErr.message });
      }
    }

    state.scheduled_posts = state.scheduled_posts.slice(0, 60);
    await saveInstaState(state);

    return res.status(200).json({
      ok: failedList.length === 0,
      checked_at: new Date().toISOString(),
      autonomous_design: true,
      require_approval: false,
      published_count: publishedList.length,
      published: publishedList,
      failed: failedList
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
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
  } catch (e) {
    console.warn('insta_bot_state kaydetme hatası:', e.message);
  }
}

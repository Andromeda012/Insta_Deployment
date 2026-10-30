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
      const slots = config.posting_slots || [];
      const now = new Date();
      // Türkiye Saati (UTC+3)
      const istHour = (now.getUTCHours() + 3) % 24;
      const istMin = now.getUTCMinutes();
      const currentHHMM = String(istHour).padStart(2, '0') + ':' + String(istMin).padStart(2, '0');
      const todayStr = now.toISOString().slice(0, 10);

      // Slot kontrolü: Yalnızca kullanıcının ayarladığı saatte (veya son 15 dakika içinde) ve bugün henüz çalışmamışsa
      const activeSlot = slots.find(s => {
        if (!s.active || !s.time) return false;
        if (s.last_run_date === todayStr) return false;
        const [sh, sm] = s.time.split(':').map(Number);
        const diffMin = (istHour * 60 + istMin) - (sh * 60 + sm);
        return diffMin >= 0 && diffMin <= 15; // Belirlenen saatten itibaren maksimum 15 dakika tolerans
      });

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
      }
      
      let pickedProduct = null;
      if (catalog && catalog.length > 0) {
        pickedProduct = catalog[Math.floor(Math.random() * catalog.length)];
      }

      const autoDesigned = await generateAutonomousInstagramContent({
        mediaType: chosenType,
        productsCatalog: catalog,
        config
      });

      // Gerçek ürün görselini Meta Graph API için geçerli PNG/JPEG URL'ine dönüştür
      const mediaImg = await ensurePublicImageUrl(pickedProduct?.ana_resim, pickedProduct?.slug);
      autoDesigned.media_url = mediaImg;

      const newPostRecord = {
        id: autoDesigned.id,
        media_type: autoDesigned.media_type,
        title: autoDesigned.title,
        badge: autoDesigned.badge,
        headline: autoDesigned.headline,
        subheadline: autoDesigned.subheadline,
        door_style: autoDesigned.door_style,
        theme_id: autoDesigned.theme_id,
        caption: autoDesigned.caption,
        hashtags: autoDesigned.hashtags,
        media_url: autoDesigned.media_url,
        auto_designed: true,
        product_slug: pickedProduct?.slug || null,
        scheduled_for: new Date().toISOString(),
        status: 'scheduled'
      };

      state.scheduled_posts.unshift(newPostRecord);
      duePosts = [newPostRecord];
    }

    const publishedList = [];
    for (const post of duePosts) {
      const fullCaption = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
      const publishResult = await publishToInstagramGraphApi({
        igUserId: config.ig_user_id || process.env.IG_USER_ID || '17841435882645322',
        accessToken: config.access_token || config.ig_access_token || process.env.IG_ACCESS_TOKEN || 'EAAVytShbbJUBSZBpjyQk9JEpsliUSVgEGdZCyBl2bnzwN5SJgBJj0GsKArgux7QZAlLBbQcgykaoax6UoDiiZBiYRvAeZC0C9Mq06mal2NPPaJ2ZCUOZANPlwj3WWL6iFeIEH6KmOrW2GMann2cPD7MogvaYpvuKZCsZB7DmuUj87ZBRBnS3oVqi2umjEfh6NwGA6mMwZDZD',
        mediaType: post.media_type || post.content_type || 'POST',
        mediaUrl: post.media_url,
        caption: fullCaption
      });

      post.status = 'published';
      post.published_at = new Date().toISOString();
      post.ig_published_id = publishResult.publishedId;
      post.auto_approved = true;

      publishedList.push({
        id: post.id,
        title: post.title,
        media_type: post.media_type,
        auto_designed: !!post.auto_designed,
        media_url: post.media_url,
        publishedId: publishResult.publishedId,
        mode: publishResult.mode
      });
    }

    state.scheduled_posts = state.scheduled_posts.slice(0, 60);
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

    return res.status(200).json({
      ok: true,
      checked_at: new Date().toISOString(),
      autonomous_design: true,
      require_approval: false,
      published_count: publishedList.length,
      published: publishedList
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

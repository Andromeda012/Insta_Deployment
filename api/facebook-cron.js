// ============================================================================
// Nova Furniture (@thenovafurniture) — Facebook Cloud Autonomous Publisher
// Endpoint: https://insta-deployment-rho.vercel.app/api/facebook-cron
// ============================================================================
import {
  generateAutonomousFacebookContent,
  publishToFacebookPageGraphApi
} from '../Module 2/Facebook/bot-engine.js';
import GeminiBananaEngine from '../gemini-banana-engine.js';

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
  } catch (_) {}
  return [];
}

async function ensurePublicImageUrl(rawImg, slug = 'item') {
  if (!rawImg) {
    return DEFAULT_MEDIA_FALLBACK;
  }
  if (rawImg.startsWith('http://') || rawImg.startsWith('https://')) {
    if (rawImg.includes('.svg') || rawImg.includes('facebook-render')) {
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
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/media/facebook/${fileName}`, {
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
        return `${SUPABASE_URL}/storage/v1/object/public/media/facebook/${fileName}`;
      }
    } catch (_) {}
    return DEFAULT_MEDIA_FALLBACK;
  }
  return DEFAULT_MEDIA_FALLBACK;
}

async function uploadAutonomousFbSvgToStorage(fileName, svgString) {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/media/facebook/${fileName}`, {
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
      return `${SUPABASE_URL}/storage/v1/object/public/media/facebook/${fileName}`;
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
    const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.fb_bot_state&select=data`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const rows = stateRes.ok ? await stateRes.json() : [];
    const state = rows?.[0]?.data || { config: {}, scheduled_posts: [], conversations: [] };
    const config = state.config || {};

    // Doğrudan UI'dan "Şimdi Yayınla" isteği geldiyse Meta Graph API'ye anında gönder
    if (req.method === 'POST' && req.body?.action === 'publish') {
      const pageId = req.body.pageId || config.page_id || process.env.FB_PAGE_ID;
      const pageAccessToken = req.body.pageAccessToken || config.page_access_token || process.env.FB_PAGE_ACCESS_TOKEN;
      const mediaType = req.body.mediaType || 'PHOTO_POST';
      const mediaUrl = req.body.mediaUrl;
      const caption = req.body.caption || '';
      const targetLink = req.body.targetLink || 'https://wa.me/905050151035';

      if (!pageId || !pageAccessToken) {
        return res.status(400).json({ ok: false, error: 'Facebook Page ID veya Page Access Token eksik!' });
      }

      try {
        const publishResult = await publishToFacebookPageGraphApi({
          pageId,
          pageAccessToken,
          mediaType,
          mediaUrl,
          caption,
          targetLink
        });
        return res.status(200).json({
          ok: true,
          publishedId: publishResult.publishedId,
          mode: publishResult.mode
        });
      } catch (pubErr) {
        return res.status(200).json({
          ok: false,
          error: pubErr.message
        });
      }
    }

    if (config.auto_publish_enabled === false) {
      return res.status(200).json({ ok: true, message: 'Facebook otomatik paylaşım duraklatılmış durumda.', published: [] });
    }

    state.scheduled_posts = Array.isArray(state.scheduled_posts) ? state.scheduled_posts : [];
    const catalog = await fetchProductsCatalog();
    const forceGenerateType = req.query?.generate_type || req.body?.generate_type || null;

    const nowMs = Date.now();
    let duePosts = state.scheduled_posts.filter(
      p => (p.status === 'scheduled' || p.status === 'QUEUED') && new Date(p.scheduled_for).getTime() <= nowMs
    );

    // Eğer kuyrukta kullanıcı tarafından planlanmış bekleyen gönderi yoksa:
    // SADECE ve SADECE tanımlanmış Facebook zaman slotu (posting_slots) geldiyse otonom üret!
    if (duePosts.length === 0) {
      const slots = config.posting_slots || [];
      const now = new Date();
      // Türkiye Saati (UTC+3) — tarih de Türkiye saatine göre hesaplanır
      const trNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const istHour = trNow.getUTCHours();
      const istMin = trNow.getUTCMinutes();
      const currentHHMM = String(istHour).padStart(2, '0') + ':' + String(istMin).padStart(2, '0');
      const todayStr = trNow.toISOString().slice(0, 10);

      // 4 saatlik telafi penceresi: zamanlayıcı gecikse bile paylaşım kaçmaz (last_run_date kilidi ile günde 1 kez)
      const activeSlot = slots.find(s => {
        if (!s.active || !s.time) return false;
        if (s.last_run_date === todayStr) return false;
        const [sh, sm] = s.time.split(':').map(Number);
        const diffMin = (istHour * 60 + istMin) - (sh * 60 + sm);
        return diffMin >= 0 && diffMin <= 240;
      });

      // Eğer şu an planlanmış bir saat slotu değilse VE panelden zorla (forceGenerateType) tetiklenmediyse: ASLA PAYLAŞMA!
      if (!forceGenerateType && !activeSlot) {
        return res.status(200).json({
          ok: true,
          checked_at: new Date().toISOString(),
          message: 'Şu an Facebook için planlanmış bir paylaşım saati değil ve kuyrukta bekleyen gönderi yok.',
          current_time: currentHHMM,
          published_count: 0,
          published: []
        });
      }

      const chosenType = forceGenerateType || activeSlot?.type || 'PHOTO_POST';

      if (activeSlot) {
        activeSlot.last_run_date = todayStr;
        activeSlot.last_run_time = currentHHMM;
      }

      let pickedProduct = null;
      if (catalog && catalog.length > 0) {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
        pickedProduct = catalog[dayOfYear % catalog.length];
      }

      // Gemini Banana Mimari Üretim Pipeline'ından Varlığı Çek
      let campaign = await GeminiBananaEngine.fetchActiveCampaignFromSupabase('facebook');
      const hasInvalidMedia = c => !c
        || /\.svg(\?.*)?$/i.test(c.post_image_url || '')
        || !c.post_image_url;
      if (!campaign || campaign.product_slug !== pickedProduct?.slug || hasInvalidMedia(campaign)) {
        try {
          campaign = await GeminiBananaEngine.buildAndSaveProductCampaign({
            product: pickedProduct,
            apiKey: process.env.GEMINI_API_KEY
          });
        } catch (genErr) {
          console.error('[Facebook Cron] Gemini Banana görsel üretimi başarısız:', genErr.message);
          return res.status(500).json({
            ok: false,
            error: `Görsel üretimi başarısız: ${genErr.message}`,
            product_slug: pickedProduct?.slug
          });
        }
      }

      const isVideo = chosenType === 'VIDEO_REELS' || chosenType === 'REELS';
      const targetMediaUrl = isVideo ? (campaign.reels_video_url || campaign.banana_hero_vertical_url || campaign.photoroom_hero_vertical_url) : campaign.post_image_url;

      const newPostRecord = {
        id: campaign.id,
        media_type: isVideo ? 'VIDEO_REELS' : 'PHOTO_POST',
        title: campaign.product_title || pickedProduct?.title || 'Lüks Koleksiyon',
        target_link: 'https://wa.me/905050151035',
        caption: campaign.caption,
        hashtags: campaign.hashtags || '#novafurniture #minimalistmobilya #icmimari #luxuryfurniture',
        media_url: targetMediaUrl,
        auto_designed: true,
        product_slug: pickedProduct?.slug || null,
        scheduled_for: new Date().toISOString(),
        status: 'scheduled',
        banana_campaign_id: campaign.id,
        photoroom_campaign_id: campaign.id
      };

      state.scheduled_posts.unshift(newPostRecord);
      duePosts = [newPostRecord];
    }

    const publishedList = [];
    for (const post of duePosts) {
      const fullCaption = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
      try {
        const publishResult = await publishToFacebookPageGraphApi({
          pageId: config.page_id || process.env.FB_PAGE_ID || '1436666706190366',
          pageAccessToken: config.page_access_token || process.env.FB_PAGE_ACCESS_TOKEN || 'EAAVytShbbJUBS8UfPHT8aacyWnUEJAd1pVOfheayPPUoFTgzIXy9PVhATjHuytePm9xJHSXbvZCC3wq9H88Nj0vJl5AParFBPJcmUnUBYAEnxShy3O1T3qh6bWQDvS3TC5ZBRcngYHSMZBjESkMUKDLCuyWCC0mTnxSd4gb0iWZAunwZBpdqWpZC2DKDrrsb6LFpbk3y8Y',
          mediaType: post.media_type || 'PHOTO_POST',
          mediaUrl: post.media_url,
          caption: fullCaption,
          targetLink: post.target_link || 'https://wa.me/905050151035'
        });

        post.status = 'published';
        post.published_at = new Date().toISOString();
        post.fb_post_id = publishResult.publishedId;
        post.auto_approved = true;

        const campaignId = post.banana_campaign_id || post.photoroom_campaign_id;
        if (campaignId) {
          await GeminiBananaEngine.markPlatformPublished(campaignId, 'facebook', post.media_type);
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
      } catch (err) {
        console.error('Facebook publish error:', err.message);
        post.status = 'failed';
        post.last_error = err.message;
      }
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
        key: 'fb_bot_state',
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

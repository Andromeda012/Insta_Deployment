// ============================================================================
// Global Kapak Mobilya — Modül 2: Facebook Cloud Autonomous Designer & Publisher
// Endpoint: https://insta-deployment-rho.vercel.app/api/facebook-cron
// Özellik: Herhangi bir fotoğraf/video girişi olmadan Facebook Katalog Kartını,
//          Facebook Reels'ini, Story'sini ve B2B Bağlantı Postunu KENDİSİ TASARLAR
//          ve ONAYSIZ olarak Facebook Sayfasında paylaşır.
// ============================================================================
import {
  generateAutonomousFacebookContent,
  publishToFacebookPageGraphApi
} from '../Module 2/Facebook/bot-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';

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
    return 'https://globalmobilyaweb.vercel.app/resim/yonetilen/cerceveli-klasik-membran-kapak-yeni-1787670684996.png';
  }
  if (rawImg.startsWith('http://') || rawImg.startsWith('https://')) {
    if (rawImg.includes('.svg') || rawImg.includes('facebook-render')) {
      return 'https://globalmobilyaweb.vercel.app/resim/yonetilen/cerceveli-klasik-membran-kapak-yeni-1787670684996.png';
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
    return 'https://globalmobilyaweb.vercel.app/resim/yonetilen/cerceveli-klasik-membran-kapak-yeni-1787670684996.png';
  }
  if (rawImg.startsWith('/')) {
    return `https://globalmobilyaweb.vercel.app${rawImg}`;
  }
  return `https://globalmobilyaweb.vercel.app/${rawImg}`;
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
      const targetLink = req.body.targetLink || 'https://globalmobilyaweb.vercel.app/urunler.html';

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

    if (duePosts.length === 0) {
      const typesRotation = ['PHOTO_POST', 'FB_REELS', 'FB_STORIES', 'LINK_CARD'];
      const chosenType = forceGenerateType || typesRotation[Math.floor(Math.random() * typesRotation.length)];
      const autoDesigned = await generateAutonomousFacebookContent({
        mediaType: chosenType,
        productsCatalog: catalog,
        config
      });

      let pickedProduct = null;
      if (catalog && catalog.length > 0) {
        pickedProduct = catalog[Math.floor(Math.random() * catalog.length)];
      }

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
        target_link: autoDesigned.target_link,
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
      try {
        const publishResult = await publishToFacebookPageGraphApi({
          pageId: config.page_id || process.env.FB_PAGE_ID || '122127295833480422',
          pageAccessToken: config.page_access_token || process.env.FB_PAGE_ACCESS_TOKEN || 'EAAVytShbbJUBS6tyr3CzTGiCpHQtCdQ6ZBX4U6Djfk7PrXdZAENoGirkreW8AXxpkhGIcoJRbyeWm4c1e55GJYRkyybaSmzvGxkqZB6deaNjopdY2ZBHrKzt3s4ZC8mX9C0ne9uKjY6qIOH3QGCs8J7fq1VCEfCA1PfczxTC7t3Ps6E7mp4ujuaBPzmsQ5ZC0NLnmWjMn0a63fN7CtJind3aKTEZAtPrB8izZB1dAmhi',
          pageAccessToken: config.page_access_token || process.env.FB_PAGE_ACCESS_TOKEN || '',
          mediaType: post.media_type || 'PHOTO_POST',
          mediaUrl: post.media_url,
          caption: fullCaption,
          targetLink: post.target_link || 'https://globalmobilyaweb.vercel.app/urunler.html'
        });

        post.status = 'published';
        post.published_at = new Date().toISOString();
        post.fb_post_id = publishResult.publishedId;
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

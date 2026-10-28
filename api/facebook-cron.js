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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=slug,title,kategori,kisa_aciklama,ana_resim,renkler`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (res.ok) return await res.json();
  } catch (_) {}
  return [];
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

      const uploadedUrl = await uploadAutonomousFbSvgToStorage(
        `${autoDesigned.id}.svg`,
        autoDesigned.svg_markup
      );
      if (uploadedUrl) {
        autoDesigned.media_url = uploadedUrl;
      }

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
        scheduled_for: new Date().toISOString(),
        status: 'scheduled'
      };

      state.scheduled_posts.unshift(newPostRecord);
      duePosts = [newPostRecord];
    }

    const publishedList = [];
    for (const post of duePosts) {
      const fullCaption = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
      const publishResult = await publishToFacebookPageGraphApi({
        pageId: config.page_id || process.env.FB_PAGE_ID || '',
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

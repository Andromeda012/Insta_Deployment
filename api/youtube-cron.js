// ============================================================================
// Global Kapak Mobilya — Modül 2: YouTube Shorts Cloud Autonomous Producer & Publisher
// Endpoint: https://insta-deployment-rho.vercel.app/api/youtube-cron
// Özellik: Herhangi bir fotoğraf/video girişi olmadan YouTube Shorts sahnesini,
//          SEO başlığını (#Shorts), zaman damgalı açıklamasını, etiketlerini ve
//          sabitlenecek ilk yorumunu KENDİSİ TASARLAR ve ONAYSIZ YAYINLAR.
// ============================================================================
import {
  generateAutonomousYouTubeShortsContent,
  publishToYouTubeDataApi
} from '../Module 2/Youtube Shorts/bot-engine.js';

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

async function uploadAutonomousYtSvgToStorage(fileName, svgString) {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/media/youtube/${fileName}`, {
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
      return `${SUPABASE_URL}/storage/v1/object/public/media/youtube/${fileName}`;
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
    const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.yt_bot_state&select=data`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const rows = stateRes.ok ? await stateRes.json() : [];
    const state = rows?.[0]?.data || { config: {}, scheduled_posts: [], conversations: [] };
    const config = state.config || {};

    if (config.auto_publish_enabled === false) {
      return res.status(200).json({ ok: true, message: 'YouTube Shorts otomatik paylaşım duraklatılmış durumda.', published: [] });
    }

    state.scheduled_posts = Array.isArray(state.scheduled_posts) ? state.scheduled_posts : [];
    const catalog = await fetchProductsCatalog();
    const forceFormat = req.query?.format || req.body?.format || null;

    const nowMs = Date.now();
    let duePosts = state.scheduled_posts.filter(
      p => (p.status === 'scheduled' || p.status === 'QUEUED') && new Date(p.scheduled_for).getTime() <= nowMs
    );

    if (duePosts.length === 0) {
      const formatsRotation = ['SHORTS_CNC', 'SHORTS_SHOWCASE', 'SHORTS_GUIDE'];
      const chosenFormat = forceFormat || formatsRotation[Math.floor(Math.random() * formatsRotation.length)];
      const autoDesigned = await generateAutonomousYouTubeShortsContent({
        format: chosenFormat,
        productsCatalog: catalog,
        config
      });

      const uploadedUrl = await uploadAutonomousYtSvgToStorage(
        `${autoDesigned.id}.svg`,
        autoDesigned.svg_markup
      );
      if (uploadedUrl) {
        autoDesigned.media_url = uploadedUrl;
      }

      const newShortRecord = {
        id: autoDesigned.id,
        media_type: autoDesigned.media_type,
        title: autoDesigned.title,
        badge: autoDesigned.badge,
        headline: autoDesigned.headline,
        subheadline: autoDesigned.subheadline,
        door_style: autoDesigned.door_style,
        theme_id: autoDesigned.theme_id,
        scenes: autoDesigned.scenes,
        description: autoDesigned.description,
        tags: autoDesigned.tags,
        pinned_comment: autoDesigned.pinned_comment,
        target_link: autoDesigned.target_link,
        media_url: autoDesigned.media_url,
        auto_designed: true,
        scheduled_for: new Date().toISOString(),
        status: 'scheduled'
      };

      state.scheduled_posts.unshift(newShortRecord);
      duePosts = [newShortRecord];
    }

    const publishedList = [];
    for (const post of duePosts) {
      const publishResult = await publishToYouTubeDataApi({
        channelId: config.channel_id || process.env.YT_CHANNEL_ID || '',
        clientId: config.client_id || process.env.YT_CLIENT_ID || '',
        clientSecret: config.client_secret || process.env.YT_CLIENT_SECRET || '',
        refreshToken: config.refresh_token || process.env.YT_REFRESH_TOKEN || '',
        accessToken: config.access_token || process.env.YT_ACCESS_TOKEN || '',
        title: post.title,
        description: post.description,
        tags: post.tags,
        pinnedComment: post.pinned_comment,
        mediaUrl: post.media_url
      });

      post.status = 'published';
      post.published_at = new Date().toISOString();
      post.yt_video_id = publishResult.publishedId;
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
        key: 'yt_bot_state',
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

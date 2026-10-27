// ============================================================================
// Global Kapak Mobilya — Modül 2: Instagram Cloud Autonomous Designer & Publisher
// Endpoint: https://insta-deployment-rho.vercel.app/api/instagram-cron
// Özellik: Herhangi bir fotoğraf/video girişi olmadan kendi gönderisini,
//          hikayesini (Story) ve Reels içeriğini KENDİSİ TASARLAR ve ONAYSIZ PAYLAŞIR.
// ============================================================================
import {
  generateAutonomousInstagramContent,
  publishToInstagramGraphApi
} from '../Module 2/Instagram/bot-engine.js';

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

    // Eğer kuyrukta saati gelmiş gönderi yoksa (veya doğrudan otonom üretim tetiklendiyse):
    // Bot herhangi bir fotoğraf/video girişine ihtiyaç duymadan KENDİSİ TASARLAR ve yayın kuyruğuna alır!
    if (duePosts.length === 0) {
      const typesRotation = ['REELS', 'STORIES', 'POST'];
      const chosenType = forceGenerateType || typesRotation[Math.floor(Math.random() * typesRotation.length)];
      const autoDesigned = await generateAutonomousInstagramContent({
        mediaType: chosenType,
        productsCatalog: catalog,
        config
      });

      const uploadedUrl = await uploadAutonomousSvgToStorage(
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
      const publishResult = await publishToInstagramGraphApi({
        igUserId: config.ig_user_id || process.env.IG_USER_ID || '',
        accessToken: config.access_token || config.ig_access_token || process.env.IG_ACCESS_TOKEN || '',
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

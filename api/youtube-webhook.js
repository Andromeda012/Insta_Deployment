// ============================================================================
// Global Kapak Mobilya — Modül 2: YouTube Shorts Yorum & İletişim Bulut Uç Noktası
// Endpoint: https://insta-deployment-rho.vercel.app/api/youtube-webhook
// ============================================================================
import {
  evaluateYouTubeThreeTierCommunication,
  getYouTubeAccessTokenFromRefresh,
  sendYouTubeCommentReply
} from '../Module 2/Youtube Shorts/bot-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';

async function loadYtBotState() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.yt_bot_state&select=data`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0 && rows[0].data) {
        return rows[0].data;
      }
    }
  } catch (_) {}
  return null;
}

async function saveYtBotState(stateObj) {
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
        key: 'yt_bot_state',
        data: stateObj,
        updated_at: new Date().toISOString()
      })
    });
  } catch (_) {}
}

async function loadProductsCatalog() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=slug,title,kategori,kisa_aciklama,renkler`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) return await res.json();
  } catch (_) {}
  return [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. PubSubHubbub / YouTube Hub Challenge or Status Check (GET)
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'];
    if (challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(200).json({
      status: 'online',
      service: 'Global Kapak Mobilya — YouTube Shorts Cloud Comment & Automation Engine (7/24 Serverless)',
      autonomous_design: 'Aktif (Foto/Video girişi olmadan 9:16 Shorts sahnesi, #Shorts SEO başlığı ve sabitlenen ilk yorum üretir)',
      mode: '3-Stage Hybrid YouTube Comment Engine (Stage 1: Sabit -> Stage 2: Gemini AI -> Stage 3: WhatsApp/İnsan)',
      webhook_ready: true
    });
  }

  // 2. YouTube Comment Event or Direct Simulation (POST)
  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      const state = (await loadYtBotState()) || { config: {}, rules: [], conversations: [] };
      const config = state.config || {};
      const rules = state.rules || [];
      const catalog = await loadProductsCatalog();

      const commentText = payload.simulate_message || payload.comment_text || payload.text || '';
      const authorName = payload.author_name || '@youtube_izleyicisi';
      const videoTitle = payload.video_title || '0.01mm CNC Membran Kapak Üretimi #Shorts';
      const commentId = payload.comment_id || '';

      if (commentText) {
        const decision = await evaluateYouTubeThreeTierCommunication({
          incomingText: commentText,
          authorName,
          videoTitle,
          config,
          keywordRules: rules,
          productsCatalog: catalog
        });

        const activeToken = await getYouTubeAccessTokenFromRefresh({
          clientId: config.client_id || process.env.YT_CLIENT_ID,
          clientSecret: config.client_secret || process.env.YT_CLIENT_SECRET,
          refreshToken: config.refresh_token || process.env.YT_REFRESH_TOKEN,
          directAccessToken: config.access_token || process.env.YT_ACCESS_TOKEN
        });

        if (activeToken && commentId) {
          await sendYouTubeCommentReply({
            accessToken: activeToken,
            parentCommentId: commentId,
            replyText: decision.bot_reply
          });
        }

        state.conversations = Array.isArray(state.conversations) ? state.conversations : [];
        state.conversations.unshift({
          id: 'yt-conv-' + Date.now(),
          comment_id: commentId || 'sim',
          author_name: authorName,
          video_title: videoTitle,
          incoming_text: commentText,
          resolved_tier: decision.resolved_tier,
          tier_label: decision.tier_label,
          bot_reply: decision.bot_reply,
          whatsapp_link: decision.whatsapp_link || '',
          created_at: new Date().toISOString()
        });
        state.conversations = state.conversations.slice(0, 60);
        await saveYtBotState(state);

        return res.status(200).json({ ok: true, decision });
      }

      return res.status(200).json({ status: 'EVENT_RECEIVED' });
    } catch (err) {
      return res.status(200).json({ status: 'EVENT_HANDLED_WITH_WARNING', error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

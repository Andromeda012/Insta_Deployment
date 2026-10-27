// ============================================================================
// Global Kapak Mobilya — Modül 2: Instagram Cloud Bot Webhook Endpoint (Vercel Serverless)
// Endpoint: https://insta-deployment-rho.vercel.app/api/instagram-webhook
// ============================================================================
import {
  evaluateThreeTierCommunication,
  sendInstagramDmReply,
  sendInstagramCommentReply
} from '../Module 2/Instagram/bot-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';

async function loadCloudBotState() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.insta_bot_state&select=data`, {
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

async function saveCloudBotState(stateObj) {
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

  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const state = await loadCloudBotState();
    const verifyToken = state?.config?.webhook_verify_token || process.env.WEBHOOK_VERIFY_TOKEN || 'global_kapak_insta_verify_2026';

    if (mode === 'subscribe' && (token === verifyToken || token === 'global_kapak_insta_verify_2026')) {
      return res.status(200).send(challenge);
    }

    return res.status(200).json({
      status: 'online',
      service: 'Global Kapak Mobilya — Instagram Cloud Webhook (7/24 Serverless)',
      autonomous_design: 'Aktif (Fotoğraf/Video girişi olmadan kendi Reels/Story/Gönderi tasarımını üretir ve paylaşır)',
      mode: '3-Stage Hybrid Communication Engine (Stage 1: Fixed -> Stage 2: Gemini AI -> Stage 3: Human/WhatsApp)',
      webhook_ready: true
    });
  }

  // 2. Meta Webhook Event Processing or Direct Simulation (POST)
  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      const state = (await loadCloudBotState()) || { config: {}, rules: [], conversations: [] };
      const config = state.config || {};
      const rules = state.rules || state.keyword_rules || [];
      const catalog = await loadProductsCatalog();

      const igUserId = config.ig_user_id || process.env.IG_USER_ID || '';
      const igAccessToken = config.access_token || config.ig_access_token || process.env.IG_ACCESS_TOKEN || '';

      // Direct simulation test call from panel
      if (payload.simulate_message) {
        const decision = await evaluateThreeTierCommunication({
          incomingText: payload.simulate_message,
          channel: payload.channel || 'DM',
          senderUsername: payload.sender_username || '@ziyaretci',
          config,
          keywordRules: rules,
          productsCatalog: catalog
        });
        return res.status(200).json({ ok: true, decision });
      }

      // Standard Meta Instagram Webhook payload
      const results = [];
      if (payload.object === 'instagram' && Array.isArray(payload.entry)) {
        for (const entry of payload.entry) {
          // Direct Messages
          if (Array.isArray(entry.messaging)) {
            for (const event of entry.messaging) {
              if (event.message && event.message.text && !event.message.is_echo) {
                const senderId = event.sender?.id;
                const messageText = event.message.text;

                const decision = await evaluateThreeTierCommunication({
                  incomingText: messageText,
                  channel: 'DM',
                  senderUsername: senderId,
                  config,
                  keywordRules: rules,
                  productsCatalog: catalog
                });

                if (igUserId && igAccessToken && senderId) {
                  await sendInstagramDmReply({
                    igUserId,
                    accessToken: igAccessToken,
                    recipientId: senderId,
                    replyText: decision.bot_reply
                  });
                }

                results.push({ channel: 'DM', senderId, incomingText: messageText, decision });
              }
            }
          }

          // Feed / Reels Comments
          if (Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              if (change.field === 'comments' && change.value?.text) {
                const commentId = change.value.id;
                const fromUsername = change.value.from?.username || 'instagram_user';
                const commentText = change.value.text;

                if (fromUsername === 'globalkapak' || fromUsername === 'globalkapakmobilya') continue;

                const decision = await evaluateThreeTierCommunication({
                  incomingText: commentText,
                  channel: 'COMMENT',
                  senderUsername: fromUsername,
                  config,
                  keywordRules: rules,
                  productsCatalog: catalog
                });

                if (igAccessToken && commentId) {
                  await sendInstagramCommentReply({
                    accessToken: igAccessToken,
                    commentId,
                    replyText: decision.bot_reply
                  });
                }

                results.push({ channel: 'COMMENT', commentId, fromUsername, incomingText: commentText, decision });
              }
            }
          }
        }
      }

      if (results.length > 0) {
        state.conversations = Array.isArray(state.conversations) ? state.conversations : [];
        for (const r of results) {
          state.conversations.unshift({
            id: 'conv-' + Date.now(),
            channel: r.channel,
            sender_username: r.fromUsername || r.senderId || '@instagram_kullanicisi',
            incoming_text: r.incomingText || 'Instagram Mesajı',
            resolved_tier: r.decision.resolved_tier,
            tier_label: r.decision.tier_label,
            bot_reply: r.decision.bot_reply,
            whatsapp_link: r.decision.whatsapp_link || '',
            created_at: new Date().toISOString()
          });
        }
        state.conversations = state.conversations.slice(0, 60);
        await saveCloudBotState(state);
      }

      return res.status(200).json({ status: 'EVENT_RECEIVED', processed: results.length, results });
    } catch (err) {
      return res.status(200).json({ status: 'EVENT_HANDLED_WITH_WARNING', error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

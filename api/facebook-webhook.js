// ============================================================================
// Global Kapak Mobilya — Modül 2: Facebook Page Cloud Webhook (Vercel Serverless)
// Endpoint: https://insta-deployment-rho.vercel.app/api/facebook-webhook
// ============================================================================
import {
  evaluateFacebookThreeTierCommunication,
  sendFacebookCommentReply,
  sendFacebookMessengerReply
} from '../Module 2/Facebook/bot-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';

async function loadFbBotState() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.fb_bot_state&select=data`, {
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

async function saveFbBotState(stateObj) {
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
        key: 'fb_bot_state',
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

  // 1. Meta Facebook Page Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const state = await loadFbBotState();
    const verifyToken = state?.config?.webhook_verify_token || process.env.FB_WEBHOOK_VERIFY_TOKEN || 'global_kapak_fb_verify_2026';

    if (mode === 'subscribe' && (token === verifyToken || token === 'global_kapak_fb_verify_2026')) {
      return res.status(200).send(challenge);
    }

    return res.status(200).json({
      status: 'online',
      service: 'Global Kapak Mobilya — Facebook Page Cloud Webhook (7/24 Serverless)',
      autonomous_design: 'Aktif (Fotoğraf/Video girişi olmadan Katalog Gönderisi, Facebook Reels, Story ve B2B Bağlantı Kartı üretir ve paylaşır)',
      mode: '3-Stage Hybrid Communication Engine (Messenger DM + Sayfa Yorumları: Stage 1 Sabit -> Stage 2 Gemini AI -> Stage 3 WhatsApp/İnsan)',
      webhook_ready: true
    });
  }

  // 2. Meta Facebook Webhook Event Processing or Direct Simulation (POST)
  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      const state = (await loadFbBotState()) || { config: {}, rules: [], conversations: [] };
      const config = state.config || {};
      const rules = state.rules || [];
      const catalog = await loadProductsCatalog();

      const pageId = config.page_id || process.env.FB_PAGE_ID || '';
      const pageAccessToken = config.page_access_token || process.env.FB_PAGE_ACCESS_TOKEN || '';

      if (payload.simulate_message) {
        const decision = await evaluateFacebookThreeTierCommunication({
          incomingText: payload.simulate_message,
          channel: payload.channel || 'MESSENGER',
          senderName: payload.sender_name || 'Facebook Ziyaretçisi',
          config,
          keywordRules: rules,
          productsCatalog: catalog
        });
        return res.status(200).json({ ok: true, decision });
      }

      const results = [];
      if (payload.object === 'page' && Array.isArray(payload.entry)) {
        for (const entry of payload.entry) {
          // Facebook Messenger DMs
          if (Array.isArray(entry.messaging)) {
            for (const event of entry.messaging) {
              if (event.message && event.message.text && !event.message.is_echo) {
                const senderId = event.sender?.id;
                const messageText = event.message.text;

                const decision = await evaluateFacebookThreeTierCommunication({
                  incomingText: messageText,
                  channel: 'MESSENGER',
                  senderName: `Messenger #${(senderId || '').slice(-4)}`,
                  config,
                  keywordRules: rules,
                  productsCatalog: catalog
                });

                if (pageId && pageAccessToken && senderId) {
                  await sendFacebookMessengerReply({
                    pageId,
                    pageAccessToken,
                    recipientPsid: senderId,
                    replyText: decision.bot_reply
                  });
                }

                results.push({ channel: 'MESSENGER', senderId, incomingText: messageText, decision });
              }
            }
          }

          // Facebook Page Feed / Post / Reels Comments
          if (Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              if (change.field === 'feed' && change.value?.item === 'comment' && change.value?.verb === 'add' && change.value?.message) {
                const commentId = change.value.comment_id;
                const fromName = change.value.from?.name || 'Facebook Takipçisi';
                const commentText = change.value.message;

                if (fromName.toLowerCase().includes('global kapak')) continue;

                const decision = await evaluateFacebookThreeTierCommunication({
                  incomingText: commentText,
                  channel: 'COMMENT',
                  senderName: fromName,
                  config,
                  keywordRules: rules,
                  productsCatalog: catalog
                });

                if (pageAccessToken && commentId) {
                  await sendFacebookCommentReply({
                    pageAccessToken,
                    commentId,
                    replyText: decision.bot_reply
                  });
                }

                results.push({ channel: 'COMMENT', commentId, fromName, incomingText: commentText, decision });
              }
            }
          }
        }
      }

      if (results.length > 0) {
        state.conversations = Array.isArray(state.conversations) ? state.conversations : [];
        for (const r of results) {
          state.conversations.unshift({
            id: 'fb-conv-' + Date.now(),
            channel: r.channel,
            sender_name: r.fromName || r.senderId || 'Facebook Kullanıcısı',
            incoming_text: r.incomingText || 'Facebook Mesajı',
            resolved_tier: r.decision.resolved_tier,
            tier_label: r.decision.tier_label,
            bot_reply: r.decision.bot_reply,
            whatsapp_link: r.decision.whatsapp_link || '',
            created_at: new Date().toISOString()
          });
        }
        state.conversations = state.conversations.slice(0, 60);
        await saveFbBotState(state);
      }

      return res.status(200).json({ status: 'EVENT_RECEIVED', processed: results.length, results });
    } catch (err) {
      return res.status(200).json({ status: 'EVENT_HANDLED_WITH_WARNING', error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

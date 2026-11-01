/**
 * GLOBAL KAPAK MOBİLYA — MODULE 2: 7/24 BULUT INSTAGRAM BOT SUNUCUSU (server.js)
 *
 * Bu sunucu Render, Railway, Fly.io, Google Cloud Run veya Docker üzerinde
 * 7/24 hiçbir bilgisayara bağımlı olmadan çalışır.
 *
 * Görevleri:
 * 1. Belirli saat aralıklarında (Gönderi, Story, Reels) herhangi bir fotoğraf/video
 *    girişine ihtiyaç duymadan kendi içeriğini KENDİSİ TASARLAR (`generateAutonomousInstagramContent`)
 *    ve ONAY İSTEMEDEN otomatik olarak Instagram'da paylaşır.
 * 2. Meta Webhook (/webhook/instagram) üzerinden gelen DM ve yorumları anlık karşılar:
 *    - 1. Aşama: Basit sorulara sabit kural tabanlı anlık cevap verir.
 *    - 2. Aşama: Karmaşık sorularda Gemini AI + Supabase ürün kataloğu ile yanıt üretir.
 *    - 3. Aşama: Sipariş ve özel destek taleplerini gerçek insan temsilciye (WhatsApp) yönlendirir.
 */

import http from 'node:http';
import { URL } from 'node:url';
import {
  DEFAULT_TIER1_RULES,
  evaluateThreeTierCommunication,
  generateAutonomousInstagramContent,
  publishToInstagramGraphApi,
  supabaseRequest
} from './bot-engine.js';

const PORT = process.env.PORT || 8080;
const VERIFY_TOKEN = process.env.IG_WEBHOOK_VERIFY_TOKEN || '';
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

// Son tetiklenen slot anahtarlarını hafızada tut (aynı dakikada iki kez atmasın)
const triggeredSlotsMemory = new Set();

// ── BULUT ZAMANLAYICI: KENDİ GÖNDERİSİNİ / STORY / REELS'İNİ KENDİ TASARLAR VE ONAYSIZ YAYINLAR ──
async function checkAndPublishScheduledPosts() {
  // Outbound publishing is centralized in the authenticated queue + VPS Publisher.
  // Keep this legacy entry point inert to prevent duplicate direct platform posts.
  return { publishedCount: 0, skipped: true, reason: 'central_queue_only' };
}

async function sendInstagramReply({ igUserId, accessToken, recipientId, commentId, channel, messageText }) {
  if (!igUserId || !accessToken) {
    return { simulated: true };
  }
  if (channel === 'COMMENT' && commentId) {
    const params = new URLSearchParams({ message: messageText, access_token: accessToken });
    const res = await fetch(`${GRAPH_API_BASE}/${commentId}/replies`, { method: 'POST', body: params });
    return await res.json();
  }
  const res = await fetch(`${GRAPH_API_BASE}/${igUserId}/messages?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: messageText }
    })
  });
  return await res.json();
}

// ── GELEN MESAJ VEYA YORUMU 3 AŞAMALI İLETİŞİM MOTORUYLA İŞLE ───────────────
async function handleIncomingMessageEvent({ senderId, senderUsername, channel = 'DM', text, commentId = null }) {
  const [stateRows, productsRows] = await Promise.all([
    supabaseRequest('site_settings?select=data&key=eq.insta_bot_state&limit=1').catch(() => []),
    supabaseRequest('products?select=slug,title,kategori,kisa_aciklama&limit=15').catch(() => [])
  ]);

  const state = stateRows?.[0]?.data || { config: {}, rules: DEFAULT_TIER1_RULES, conversations: [] };
  const config = state.config || {};
  const rules = Array.isArray(state.rules) && state.rules.length > 0 ? state.rules : DEFAULT_TIER1_RULES;

  const decision = await evaluateThreeTierCommunication({
    incomingText: text,
    senderUsername,
    channel,
    config,
    keywordRules: rules,
    productsCatalog: productsRows || []
  });

  await sendInstagramReply({
    igUserId: config.ig_user_id || process.env.IG_USER_ID,
    accessToken: config.access_token || process.env.IG_ACCESS_TOKEN,
    recipientId: senderId,
    commentId,
    channel,
    messageText: decision.bot_reply
  });

  state.conversations = Array.isArray(state.conversations) ? state.conversations : [];
  state.conversations.unshift({
    id: 'conv-' + Date.now(),
    sender_id: senderId || 'anon',
    sender_username: senderUsername || '@instagram_kullanicisi',
    channel,
    incoming_text: text,
    resolved_tier: decision.resolved_tier,
    tier_label: decision.tier_label,
    bot_reply: decision.bot_reply,
    handoff_status: decision.handoff_status,
    whatsapp_link: decision.whatsapp_link || '',
    created_at: new Date().toISOString()
  });
  state.conversations = state.conversations.slice(0, 60);

  await supabaseRequest('site_settings', {
    method: 'POST',
    body: {
      key: 'insta_bot_state',
      data: state,
      updated_at: new Date().toISOString()
    }
  }).catch(() => {});

  return decision;
}

// ── HTTP SUNUCUSU (WEBHOOK + CRON + TEST API) ────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      service: 'Global Kapak Mobilya — Instagram Cloud Bot v2.0',
      cloud_mode: '24/7 Autonomous (Zero-Input Self-Designing Reels/Story/Post + Zero-Approval Publishing + 3-Tier Comms)',
      status: 'online',
      timestamp: new Date().toISOString()
    }));
  }

  if (parsedUrl.pathname === '/webhook/instagram' && req.method === 'GET') {
    const mode = parsedUrl.searchParams.get('hub.mode');
    const token = parsedUrl.searchParams.get('hub.verify_token');
    const challenge = parsedUrl.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(challenge);
    }
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (parsedUrl.pathname === '/webhook/instagram' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));

      try {
        const payload = JSON.parse(rawBody || '{}');
        for (const entry of payload.entry || []) {
          for (const msgEvent of entry.messaging || []) {
            if (msgEvent.message && msgEvent.message.text && !msgEvent.message.is_echo) {
              await handleIncomingMessageEvent({
                senderId: msgEvent.sender?.id,
                senderUsername: `@ig_${(msgEvent.sender?.id || '').slice(-5)}`,
                channel: 'DM',
                text: msgEvent.message.text
              });
            }
          }
          for (const change of entry.changes || []) {
            if (change.field === 'comments' && change.value?.text) {
              await handleIncomingMessageEvent({
                senderId: change.value?.from?.id || 'commenter',
                senderUsername: `@${change.value?.from?.username || 'takipci'}`,
                channel: 'COMMENT',
                text: change.value.text,
                commentId: change.value.id
              });
            }
          }
        }
      } catch (err) {
        console.error('Webhook işleme hatası:', err.message);
      }
    });
    return;
  }

  if (parsedUrl.pathname === '/api/cron/publish') {
    const result = await checkAndPublishScheduledPosts(true);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, ...result }));
  }

  if (parsedUrl.pathname === '/api/simulate-message' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(rawBody || '{}');
        const decision = await handleIncomingMessageEvent({
          senderId: 'sim_user',
          senderUsername: body.username || '@musteri_adayi',
          channel: body.channel || 'DM',
          text: body.text || 'Merhaba'
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, decision }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 Global Kapak Instagram Cloud Bot Sunucusu aktif: Port ${PORT}`);
  // Legacy outbound scheduler intentionally disabled; Vercel Cron is the sole producer.
});

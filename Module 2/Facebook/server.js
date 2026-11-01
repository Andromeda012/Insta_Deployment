/**
 * GLOBAL KAPAK MOBİLYA — MODULE 2: 7/24 BULUT FACEBOOK SAYFA BOTU SUNUCUSU (server.js)
 *
 * Bu sunucu Render, Railway, Fly.io, Google Cloud Run veya Docker üzerinde
 * 7/24 hiçbir bilgisayara bağımlı olmadan çalışır.
 *
 * Görevleri:
 * 1. Belirli saat aralıklarında (Katalog Gönderisi, Facebook Reels, Facebook Story, B2B Bağlantı Kartı)
 *    herhangi bir fotoğraf/video girişine ihtiyaç duymadan kendi içeriğini KENDİSİ TASARLAR
 *    (`generateAutonomousFacebookContent`) ve ONAY İSTEMEDEN otomatik olarak Facebook Sayfasında paylaşır.
 * 2. Meta Facebook Page Webhook (/webhook/facebook) üzerinden gelen Messenger DM ve yorumları anlık karşılar:
 *    - 1. Aşama: Basit sorulara sabit kural tabanlı anlık cevap verir.
 *    - 2. Aşama: Karmaşık sorularda Gemini AI + Supabase ürün kataloğu ile yanıt üretir.
 *    - 3. Aşama: Sipariş, B2B bayilik ve özel destek taleplerini gerçek insan temsilciye (WhatsApp) yönlendirir.
 */

import http from 'node:http';
import { URL } from 'node:url';
import {
  DEFAULT_FB_TIER1_RULES,
  evaluateFacebookThreeTierCommunication,
  generateAutonomousFacebookContent,
  publishToFacebookPageGraphApi,
  sendFacebookCommentReply,
  sendFacebookMessengerReply,
  supabaseRequest
} from './bot-engine.js';

const PORT = process.env.PORT || 8081;
const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN || '';

const triggeredSlotsMemory = new Set();

// ── BULUT ZAMANLAYICI: KENDİ FACEBOOK GÖNDERİSİNİ / STORY / REELS'İNİ TASARLAR VE ONAYSIZ YAYINLAR ──
async function checkAndPublishFacebookPosts() {
  // Outbound publishing is centralized in the authenticated queue + VPS Publisher.
  // Keep this legacy entry point inert to prevent duplicate direct platform posts.
  return { publishedCount: 0, skipped: true, reason: 'central_queue_only' };
}

async function handleIncomingFacebookEvent({ senderId, senderName, channel = 'MESSENGER', text, commentId = null }) {
  const [stateRows, productsRows] = await Promise.all([
    supabaseRequest('site_settings?select=data&key=eq.fb_bot_state&limit=1').catch(() => []),
    supabaseRequest('products?select=slug,title,kategori,kisa_aciklama&limit=15').catch(() => [])
  ]);

  const state = stateRows?.[0]?.data || { config: {}, rules: DEFAULT_FB_TIER1_RULES, conversations: [] };
  const config = state.config || {};
  const rules = Array.isArray(state.rules) && state.rules.length > 0 ? state.rules : DEFAULT_FB_TIER1_RULES;

  const decision = await evaluateFacebookThreeTierCommunication({
    incomingText: text,
    senderName,
    channel,
    config,
    keywordRules: rules,
    productsCatalog: productsRows || []
  });

  const pageId = config.page_id || process.env.FB_PAGE_ID;
  const pageToken = config.page_access_token || process.env.FB_PAGE_ACCESS_TOKEN;

  if (channel === 'COMMENT' && commentId) {
    await sendFacebookCommentReply({ pageAccessToken: pageToken, commentId, replyText: decision.bot_reply });
  } else {
    await sendFacebookMessengerReply({ pageId, pageAccessToken: pageToken, recipientPsid: senderId, replyText: decision.bot_reply });
  }

  state.conversations = Array.isArray(state.conversations) ? state.conversations : [];
  state.conversations.unshift({
    id: 'fb-conv-' + Date.now(),
    sender_id: senderId || 'anon',
    sender_name: senderName || 'Facebook Kullanıcısı',
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
      key: 'fb_bot_state',
      data: state,
      updated_at: new Date().toISOString()
    }
  }).catch(() => {});

  return decision;
}

// ── HTTP SUNUCUSU ────────────────────────────────────────────────────────────
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
      service: 'Global Kapak Mobilya — Facebook Page Cloud Bot v2.0',
      cloud_mode: '24/7 Autonomous (Zero-Input Self-Designing Photo/Reels/Story/LinkCard + 3-Tier Messenger & Comment Comms)',
      status: 'online',
      timestamp: new Date().toISOString()
    }));
  }

  if (parsedUrl.pathname === '/webhook/facebook' && req.method === 'GET') {
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

  if (parsedUrl.pathname === '/webhook/facebook' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));

      try {
        const payload = JSON.parse(rawBody || '{}');
        if (payload.object === 'page') {
          for (const entry of payload.entry || []) {
            // 1. Facebook Messenger DM Olayları
            for (const msgEvent of entry.messaging || []) {
              if (msgEvent.message && msgEvent.message.text && !msgEvent.message.is_echo) {
                await handleIncomingFacebookEvent({
                  senderId: msgEvent.sender?.id,
                  senderName: `FB Kullanıcısı #${(msgEvent.sender?.id || '').slice(-4)}`,
                  channel: 'MESSENGER',
                  text: msgEvent.message.text
                });
              }
            }
            // 2. Facebook Sayfa Gönderi / Reels Yorum Olayları (feed changes)
            for (const change of entry.changes || []) {
              if (change.field === 'feed' && change.value?.item === 'comment' && change.value?.verb === 'add' && change.value?.message) {
                await handleIncomingFacebookEvent({
                  senderId: change.value?.from?.id || 'commenter',
                  senderName: change.value?.from?.name || 'Facebook Takipçisi',
                  channel: 'COMMENT',
                  text: change.value.message,
                  commentId: change.value.comment_id
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('Facebook Webhook işleme hatası:', err.message);
      }
    });
    return;
  }

  if (parsedUrl.pathname === '/api/cron/publish') {
    const result = await checkAndPublishFacebookPosts(true);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, ...result }));
  }

  if (parsedUrl.pathname === '/api/simulate-message' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(rawBody || '{}');
        const decision = await handleIncomingFacebookEvent({
          senderId: 'sim_fb_user',
          senderName: body.username || 'Ahmet Yılmaz (Facebook)',
          channel: body.channel || 'MESSENGER',
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
  console.log(`🚀 Global Kapak Facebook Cloud Bot Sunucusu aktif: Port ${PORT}`);
  // Legacy outbound scheduler intentionally disabled; Vercel Cron is the sole producer.
});

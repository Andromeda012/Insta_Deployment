/**
 * GLOBAL KAPAK MOBİLYA — MODULE 2: 7/24 BULUT INSTAGRAM BOT SUNUCUSU (server.js)
 *
 * Bu sunucu Render, Railway, Fly.io, Google Cloud Run veya Docker üzerinde
 * 7/24 hiçbir bilgisayara bağımlı olmadan çalışır.
 *
 * Görevleri:
 * 1. Belirli saat aralıklarında (Gönderi, Story, Reels) Supabase kuyruğunu kontrol eder
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
  publishToInstagramGraphApi,
  supabaseRequest
} from './bot-engine.js';

const PORT = process.env.PORT || 8080;
const VERIFY_TOKEN = process.env.IG_WEBHOOK_VERIFY_TOKEN || 'global_kapak_insta_verify_2026';
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

// ── BULUT ZAMANLAYICI: BELİRLİ SAAT ARALIKLARINDA ONAYSIZ REELS / STORY / GÖNDERİ YAYINLA ──
async function checkAndPublishScheduledPosts() {
  try {
    const nowIso = new Date().toISOString();
    const duePosts = await supabaseRequest(
      `insta_scheduled_posts?select=*&status=eq.scheduled&scheduled_for=lte.${encodeURIComponent(nowIso)}&order=scheduled_for.asc&limit=5`
    );

    if (!Array.isArray(duePosts) || duePosts.length === 0) return { publishedCount: 0 };

    const cfgRows = await supabaseRequest('insta_bot_config?select=*&id=eq.default&limit=1').catch(() => []);
    const config = (Array.isArray(cfgRows) && cfgRows[0]) || {};

    // Eğer otomatik yayın kapalıysa çık
    if (config.auto_publish_enabled === false) return { publishedCount: 0, reason: 'auto_publish_disabled' };

    let publishedCount = 0;
    for (const post of duePosts) {
      try {
        await supabaseRequest(`insta_scheduled_posts?id=eq.${post.id}`, {
          method: 'PATCH',
          body: { status: 'publishing' }
        });

        const fullCaption = [post.caption, post.hashtags].filter(Boolean).join('\n\n');
        const pubResult = await publishToInstagramGraphApi({
          igUserId: config.ig_user_id || process.env.IG_USER_ID,
          accessToken: config.access_token || process.env.IG_ACCESS_TOKEN,
          mediaType: post.media_type || 'POST',
          mediaUrl: post.media_url,
          caption: fullCaption
        });

        await supabaseRequest(`insta_scheduled_posts?id=eq.${post.id}`, {
          method: 'PATCH',
          body: {
            status: 'published',
            ig_container_id: pubResult.containerId || '',
            ig_media_id: pubResult.mediaId || '',
            published_at: pubResult.publishedAt
          }
        });

        await supabaseRequest('insta_bot_logs', {
          method: 'POST',
          body: {
            event_type: 'CRON_PUBLISH',
            summary: `[Otonom Yayın] ${post.media_type} paylaşıldı: "${post.title}"`,
            details: { post_id: post.id, media_type: post.media_type, ig_media_id: pubResult.mediaId }
          }
        }).catch(() => {});

        publishedCount++;
      } catch (pubErr) {
        await supabaseRequest(`insta_scheduled_posts?id=eq.${post.id}`, {
          method: 'PATCH',
          body: {
            status: 'failed',
            error_message: pubErr.message
          }
        }).catch(() => {});
      }
    }

    return { publishedCount };
  } catch (err) {
    console.error('[Cloud Scheduler] Kontrol hatası:', err.message);
    return { publishedCount: 0, error: err.message };
  }
}

// ── INSTAGRAM DM VEYA YORUM YANITINI META GRAPH API İLE GÖNDER ──────────────
async function sendInstagramReply({ igUserId, accessToken, recipientId, commentId, channel, messageText }) {
  if (!igUserId || !accessToken) {
    return { simulated: true };
  }
  if (channel === 'COMMENT' && commentId) {
    const params = new URLSearchParams({ message: messageText, access_token: accessToken });
    const res = await fetch(`${GRAPH_API_BASE}/${commentId}/replies`, { method: 'POST', body: params });
    return await res.json();
  }
  // Instagram DM (Messenger API for Instagram)
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
  const [cfgRows, rulesRows, productsRows] = await Promise.all([
    supabaseRequest('insta_bot_config?select=*&id=eq.default&limit=1').catch(() => []),
    supabaseRequest('insta_keyword_rules?select=*&active=eq.true&order=priority.asc').catch(() => DEFAULT_TIER1_RULES),
    supabaseRequest('products?select=slug,title,kategori,kisa_aciklama&limit=15').catch(() => [])
  ]);

  const config = (Array.isArray(cfgRows) && cfgRows[0]) || {};
  const rules = Array.isArray(rulesRows) && rulesRows.length > 0 ? rulesRows : DEFAULT_TIER1_RULES;

  const decision = await evaluateThreeTierCommunication({
    incomingText: text,
    senderUsername,
    channel,
    config,
    keywordRules: rules,
    productsCatalog: productsRows || []
  });

  // Instagram Graph API üzerinden cevabı gönder
  await sendInstagramReply({
    igUserId: config.ig_user_id || process.env.IG_USER_ID,
    accessToken: config.access_token || process.env.IG_ACCESS_TOKEN,
    recipientId: senderId,
    commentId,
    channel,
    messageText: decision.bot_reply
  });

  // Supabase konuşma geçmişine kaydet
  await supabaseRequest('insta_conversations', {
    method: 'POST',
    body: {
      sender_id: senderId || 'anon',
      sender_username: senderUsername || '@instagram_kullanicisi',
      channel,
      incoming_text: text,
      resolved_tier: decision.resolved_tier,
      tier_label: decision.tier_label,
      bot_reply: decision.bot_reply,
      handoff_status: decision.handoff_status,
      whatsapp_link: decision.whatsapp_link || ''
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

  // 1. Sağlık Kontrolü (Bulut Uptime Monitor)
  if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      service: 'Global Kapak Mobilya — Instagram Cloud Bot v1.0',
      cloud_mode: '24/7 Autonomous (Zero-Approval Publishing + 3-Tier AI/Human Comms)',
      status: 'online',
      timestamp: new Date().toISOString()
    }));
  }

  // 2. Meta Webhook Doğrulaması (GET /webhook/instagram)
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

  // 3. Meta Webhook Mesaj & Yorum Alıcı (POST /webhook/instagram)
  if (parsedUrl.pathname === '/webhook/instagram' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));

      try {
        const payload = JSON.parse(rawBody || '{}');
        for (const entry of payload.entry || []) {
          // Instagram DM Olayları
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
          // Instagram Yorum Olayları
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

  // 4. Bulut Cron Tetikleyici (GET/POST /api/cron/publish)
  if (parsedUrl.pathname === '/api/cron/publish') {
    const result = await checkAndPublishScheduledPosts();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, ...result }));
  }

  // 5. Canlı 3 Aşamalı İletişim Simülasyon Uç Noktası (POST /api/simulate-message)
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
  // Her 60 saniyede bir zamanlanmış Reels, Story ve Gönderileri kontrol et ve onaysız yayınla
  setInterval(checkAndPublishScheduledPosts, 60 * 1000);
});

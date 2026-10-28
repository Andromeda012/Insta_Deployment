/**
 * GLOBAL KAPAK MOBİLYA — MODULE 2: 7/24 BULUT YOUTUBE SHORTS BOTU SUNUCUSU (server.js)
 *
 * Bu sunucu Render, Railway, Fly.io, Google Cloud Run veya Docker üzerinde
 * 7/24 hiçbir bilgisayara bağımlı olmadan çalışır.
 *
 * Görevleri:
 * 1. Belirli saat aralıklarında (CNC Üretim Shorts, Renk Kartelası Shorts, Canlı Tasarım Rehberi Shorts)
 *    herhangi bir fotoğraf/video girişine ihtiyaç duymadan kendi içeriğini KENDİSİ TASARLAR
 *    (`generateAutonomousYouTubeShortsContent`), SEO başlığını (#Shorts), açıklamasını, etiketlerini
 *    ve sabitlenecek ilk yorumunu üretir ve ONAY İSTEMEDEN YouTube kanalında yayınlar.
 * 2. YouTube Kanal Yorumlarını (/webhook/youtube veya periyodik yorum tarayıcı) anlık karşılar:
 *    - 1. Aşama: Basit sorulara sabit kural tabanlı anlık yorum yanıtı verir.
 *    - 2. Aşama: Karmaşık sorularda Gemini AI + Supabase ürün kataloğu ile yanıt üretir.
 *    - 3. Aşama: Sipariş, özel ölçü fiyat ve B2B bayilik taleplerini WhatsApp hattına yönlendirir.
 */

import http from 'node:http';
import { URL } from 'node:url';
import {
  DEFAULT_YT_TIER1_RULES,
  evaluateYouTubeThreeTierCommunication,
  generateAutonomousYouTubeShortsContent,
  getYouTubeAccessTokenFromRefresh,
  publishToYouTubeDataApi,
  sendYouTubeCommentReply,
  supabaseRequest
} from './bot-engine.js';

const PORT = process.env.PORT || 8082;
const triggeredSlotsMemory = new Set();

// ── BULUT ZAMANLAYICI: KENDİ YOUTUBE SHORTS İÇERİĞİNİ TASARLAR VE ONAYSIZ YAYINLAR ──
async function checkAndPublishYouTubeShorts(forceGenerate = false) {
  try {
    const rows = await supabaseRequest('site_settings?select=data&key=eq.yt_bot_state&limit=1').catch(() => []);
    const state = rows?.[0]?.data || { config: {}, scheduled_posts: [], rules: DEFAULT_YT_TIER1_RULES, conversations: [] };
    const config = state.config || {};

    if (config.auto_publish_enabled === false) {
      return { publishedCount: 0, reason: 'auto_publish_disabled' };
    }

    state.scheduled_posts = Array.isArray(state.scheduled_posts) ? state.scheduled_posts : [];
    const productsCatalog = await supabaseRequest('products?select=slug,title,kategori,kisa_aciklama,ana_resim,renkler&limit=20').catch(() => []);

    const now = new Date();
    const hhmm = now.toTimeString().slice(0, 5);
    const todayKey = now.toISOString().slice(0, 10);

    const activeSlots = (config.posting_slots || []).filter(s => s.active !== false);
    for (const slot of activeSlots) {
      const slotMemKey = `${todayKey}_${slot.time}_${slot.type}`;
      if (slot.time === hhmm && !triggeredSlotsMemory.has(slotMemKey)) {
        triggeredSlotsMemory.add(slotMemKey);
        const autoItem = await generateAutonomousYouTubeShortsContent({
          format: slot.type || 'SHORTS_CNC',
          productsCatalog,
          config,
          slotLabel: slot.label
        });
        state.scheduled_posts.unshift({
          ...autoItem,
          scheduled_for: new Date().toISOString(),
          status: 'scheduled'
        });
      }
    }

    const nowMs = Date.now();
    let duePosts = state.scheduled_posts.filter(
      p => p.status === 'scheduled' && new Date(p.scheduled_for).getTime() <= nowMs
    );

    if (forceGenerate && duePosts.length === 0) {
      const formats = ['SHORTS_CNC', 'SHORTS_SHOWCASE', 'SHORTS_GUIDE'];
      const pickedFormat = formats[Math.floor(Math.random() * formats.length)];
      const autoItem = await generateAutonomousYouTubeShortsContent({
        format: pickedFormat,
        productsCatalog,
        config
      });
      const record = {
        ...autoItem,
        scheduled_for: new Date().toISOString(),
        status: 'scheduled'
      };
      state.scheduled_posts.unshift(record);
      duePosts = [record];
    }

    if (duePosts.length === 0) return { publishedCount: 0 };

    let publishedCount = 0;
    for (const post of duePosts) {
      const pubResult = await publishToYouTubeDataApi({
        channelId: config.channel_id || process.env.YT_CHANNEL_ID,
        clientId: config.client_id || process.env.YT_CLIENT_ID,
        clientSecret: config.client_secret || process.env.YT_CLIENT_SECRET,
        refreshToken: config.refresh_token || process.env.YT_REFRESH_TOKEN,
        accessToken: config.access_token || process.env.YT_ACCESS_TOKEN,
        title: post.title,
        description: post.description,
        tags: post.tags,
        pinnedComment: post.pinned_comment,
        mediaUrl: post.media_url
      });

      post.status = 'published';
      post.published_at = pubResult.publishedAt;
      post.yt_video_id = pubResult.videoId;
      publishedCount++;
    }

    state.scheduled_posts = state.scheduled_posts.slice(0, 60);
    await supabaseRequest('site_settings', {
      method: 'POST',
      body: {
        key: 'yt_bot_state',
        data: state,
        updated_at: new Date().toISOString()
      }
    }).catch(() => {});

    return { publishedCount, autonomousDesign: true };
  } catch (err) {
    console.error('[YouTube Shorts Cloud Autonomous Scheduler] Hata:', err.message);
    return { publishedCount: 0, error: err.message };
  }
}

// ── GELEN YOUTUBE YORUMUNU 3 AŞAMALI MOTORLA İŞLE ───────────────────────────
async function handleIncomingYouTubeComment({ commentId, authorName, videoTitle = 'YouTube Shorts', text }) {
  const [stateRows, productsRows] = await Promise.all([
    supabaseRequest('site_settings?select=data&key=eq.yt_bot_state&limit=1').catch(() => []),
    supabaseRequest('products?select=slug,title,kategori,kisa_aciklama&limit=15').catch(() => [])
  ]);

  const state = stateRows?.[0]?.data || { config: {}, rules: DEFAULT_YT_TIER1_RULES, conversations: [] };
  const config = state.config || {};
  const rules = Array.isArray(state.rules) && state.rules.length > 0 ? state.rules : DEFAULT_YT_TIER1_RULES;

  const decision = await evaluateYouTubeThreeTierCommunication({
    incomingText: text,
    authorName,
    videoTitle,
    config,
    keywordRules: rules,
    productsCatalog: productsRows || []
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
    author_name: authorName || '@youtube_izleyicisi',
    video_title: videoTitle,
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
      key: 'yt_bot_state',
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
      service: 'Global Kapak Mobilya — YouTube Shorts Cloud Bot v2.0',
      cloud_mode: '24/7 Autonomous (Zero-Input Self-Designing Shorts + SEO Title/Tags + Pinned Comment + 3-Tier Comment Comms)',
      status: 'online',
      timestamp: new Date().toISOString()
    }));
  }

  if (parsedUrl.pathname === '/api/cron/publish') {
    const result = await checkAndPublishYouTubeShorts(true);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, ...result }));
  }

  if (parsedUrl.pathname === '/api/simulate-comment' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(rawBody || '{}');
        const decision = await handleIncomingYouTubeComment({
          commentId: 'sim_yt_comment',
          authorName: body.author_name || '@mimari_izleyici',
          videoTitle: body.video_title || '0.01mm CNC Membran Kapak Üretimi #Shorts',
          text: body.text || 'Elinize sağlık, teslimat kaç gün sürüyor?'
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
  console.log(`🚀 Global Kapak YouTube Shorts Cloud Bot Sunucusu aktif: Port ${PORT}`);
  setInterval(() => checkAndPublishYouTubeShorts(false), 60 * 1000);
});

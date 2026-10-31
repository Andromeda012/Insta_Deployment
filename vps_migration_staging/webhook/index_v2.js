/**
 * GLOBAL MOBİLYA — FAST META WEBHOOK INGESTION SERVICE v2 (index_v2.js)
 * ============================================================================
 * GÖZDEN GEÇİRME VE DÜZELTME NOTLARI:
 * 1. Mükerrer Mesaj Önleme (Deduplication): Meta bazen ağ gecikmesinde aynı
 *    webhook bildirimini 2-3 kez gönderir. Son işlenen 5.000 mesaj/yorum ID'si
 *    bellekte tutularak çift AI yanıtı üretilmesi %100 engellenir.
 * 2. HTTPS/SSL Zorunluluğu: Meta Graph API Webhook'ları SADECE geçerli SSL (HTTPS)
 *    üzerinden kabul eder. VPS üzerinde Caddy, Nginx + Let's Encrypt veya
 *    Cloudflare Tunnel arkasında çalışmalıdır.
 * 3. Hızlı 200 OK: Meta'nın 5 sn timeout mekanizmasına takılmamak için 500ms
 *    içinde HTTP 200 dönülür, işleme asenkron devam eder.
 * ============================================================================
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'global_kapak_insta_verify_2026';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null;

// Son işlenen ID'leri tutan sliding window (Çift webhook önleyici)
const processedEventIds = new Set();
function isDuplicateEvent(eventId) {
  if (!eventId) return false;
  if (processedEventIds.has(eventId)) return true;
  processedEventIds.add(eventId);
  if (processedEventIds.size > 5000) {
    const oldest = processedEventIds.values().next().value;
    processedEventIds.delete(oldest);
  }
  return false;
}

// 1. HEALTHCHECK
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'webhook-service-v2', time: new Date().toISOString() });
});

// 2. META WEBHOOK DOĞRULAMA (GET)
app.get('/webhook/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook GET] Meta handshake doğrulaması başarılı.');
    return res.status(200).send(challenge);
  }
  console.warn('[Webhook GET] Geçersiz verify_token denemesi.');
  return res.status(403).send('Forbidden');
});

// 3. META WEBHOOK OLAY KARŞILAMA (POST)
app.post('/webhook/instagram', (req, res) => {
  const body = req.body;

  // 1. Kural: Meta'ya anında HTTP 200 OK dön (Zaman aşımını önle)
  res.status(200).send('EVENT_RECEIVED');

  if (body?.object === 'instagram') {
    // 2. Kural: Arka planda asenkron işle
    setImmediate(async () => {
      try {
        await processInstagramEventSafely(body);
      } catch (err) {
        console.error('[Async Webhook Error]:', err.message);
      }
    });
  }
});

async function processInstagramEventSafely(body) {
  for (const entry of body.entry || []) {
    // A. DM İletişimi
    for (const msg of entry.messaging || []) {
      const mid = msg.message?.mid;
      if (mid && isDuplicateEvent(mid)) {
        console.log(`[Deduplication] Yinelenen DM atlandı: ${mid}`);
        continue;
      }

      if (msg.message && !msg.message.is_echo) {
        const senderId = msg.sender?.id;
        const text = msg.message?.text || '';
        console.log(`[Yeni DM] Gönderen: ${senderId} | Metin: "${text}"`);
        // Gemini AI ve 3 aşamalı yanıt akışı burada çalıştırılır
      }
    }

    // B. Gönderi / Reels Yorumları
    for (const change of entry.changes || []) {
      if (change.field === 'comments') {
        const val = change.value;
        const commentId = val?.id;
        if (commentId && isDuplicateEvent(commentId)) {
          console.log(`[Deduplication] Yinelenen Yorum atlandı: ${commentId}`);
          continue;
        }
        console.log(`[Yeni Yorum] ID: ${commentId} | Metin: "${val?.text}"`);
      }
    }
  }
}

app.listen(PORT, () => {
  console.log(`[Webhook Service v2] Port ${PORT} üzerinde dinliyor.`);
});

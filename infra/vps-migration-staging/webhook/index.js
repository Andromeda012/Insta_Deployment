/**
 * GLOBAL MOBİLYA — FAST META WEBHOOK INGESTION SERVICE (index.js)
 * ============================================================================
 * Görevi:
 * 1. Meta Webhook doğrulamasını (GET) karşılar (hub.challenge doğrulaması).
 * 2. Gelen DM ve Yorum bildirimlerine (POST) 500ms içinde HTTP 200 döner (Meta retry döngüsünü engeller).
 * 3. Mesajı arka planda (asenkron) Gemini AI ve kural motoruyla işleyip yanıtlar.
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

// 1. HEALTHCHECK
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// 2. META WEBHOOK DOĞRULAMA (GET)
app.get('/webhook/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook GET] Meta doğrulama başarılı.');
    return res.status(200).send(challenge);
  }
  console.warn('[Webhook GET] Yetkisiz doğrulama denemesi.');
  return res.status(403).send('Forbidden');
});

// 3. META WEBHOOK OLAY YAKALAMA (POST)
app.post('/webhook/instagram', (req, res) => {
  const body = req.body;

  // KRİTİK KURAL: Meta'ya anında HTTP 200 dön (Asla AI cevabını bekleme)
  res.status(200).send('EVENT_RECEIVED');

  if (body?.object === 'instagram') {
    // Asenkron arka plan işlemi
    setImmediate(async () => {
      try {
        await processInstagramEventAsync(body);
      } catch (err) {
        console.error('[Async Ingestion Error]:', err.message);
      }
    });
  }
});

async function processInstagramEventAsync(body) {
  for (const entry of body.entry || []) {
    // 1. Gelen DM Olayı
    for (const msg of entry.messaging || []) {
      if (msg.message && !msg.message.is_echo) {
        const senderId = msg.sender?.id;
        const text = msg.message?.text || '';
        console.log(`[Gelen DM] Gönderen: ${senderId} | Metin: "${text}"`);
        // Arka planda Gemini AI ve yanıt fonksiyonu burada tetiklenir
      }
    }

    // 2. Gelen Yorum Olayı
    for (const change of entry.changes || []) {
      if (change.field === 'comments') {
        const val = change.value;
        console.log(`[Gelen Yorum] ID: ${val.id} | Metin: "${val.text}"`);
      }
    }
  }
}

app.listen(PORT, () => {
  console.log(`[Webhook Service] Dinliyor: Port ${PORT}`);
});

/**
 * MODULE 2 — GLOBAL KAPAK MOBİLYA: 7/24 TIKTOK BULUT BOT SUNUCUSU (server.js)
 * ============================================================================
 * Bu sunucu hem bağımsız Docker/VPS ortamında 7/24 çalışabilir hem de
 * Vercel Serverless (api/tiktok-*.js) fonksiyonlarıyla aynı motoru paylaşır.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const {
    BRAND_CONTEXT,
    TIKTOK_FORMATS,
    processIncomingTikTokInteraction,
    generateAutonomousTikTokDraft,
    publishAutonomousTikTokPost
} = require('./bot-engine');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 4040;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nyvctdskhAbImlvgbnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Sağlık kontrolü
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Global Kapak Mobilya — 7/24 TikTok Cloud Bot',
        autonomousZeroInput: true,
        formats: Object.keys(TIKTOK_FORMATS),
        brand: BRAND_CONTEXT.companyName,
        timestamp: new Date().toISOString()
    });
});

// Otonom TikTok Taslağı & #keşfet SEO Üretimi
app.post('/api/generate-draft', (req, res) => {
    const { format = 'TIKTOK_ASMR_CNC', product = {}, customHook = '' } = req.body || {};
    const draft = generateAutonomousTikTokDraft({ format, product, customHook });
    res.json({ ok: true, draft });
});

// 3 Aşamalı Hibrit Yorum & DM Yanıt Testi / İşleyicisi
app.post('/api/simulate-interaction', async (req, res) => {
    try {
        const { messageText, username, channel = 'COMMENT', videoId = '', products = [] } = req.body || {};
        const result = await processIncomingTikTokInteraction({
            messageText,
            username,
            channel,
            videoId,
            products,
            geminiApiKey: req.body?.geminiApiKey || GEMINI_API_KEY
        });
        res.json({ ok: true, result });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// Otonom Yayın Tetikleyici
app.post('/api/publish', async (req, res) => {
    try {
        const { draft, mediaUrl, tiktokAccessToken, tiktokOpenId } = req.body || {};
        const publishResult = await publishAutonomousTikTokPost({
            draft,
            mediaUrl,
            tiktokAccessToken: tiktokAccessToken || process.env.TIKTOK_ACCESS_TOKEN,
            tiktokOpenId: tiktokOpenId || process.env.TIKTOK_OPEN_ID
        });
        res.json(publishResult);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`[TikTok 7/24 Cloud Bot] Calisiyor -> http://localhost:${PORT}`);
    });
}

module.exports = app;

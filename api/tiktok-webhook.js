/**
 * VERCEL SERVERLESS WEBHOOK ENDPOINT: /api/tiktok-webhook
 * ============================================================================
 * TikTok Developer Webhook (Yorum & Business DM) olaylarını karşılar ve
 * 3 Aşamalı Hibrit İletişim Motoruyla (Sabit Kural -> Gemini 2.5 Flash AI ->
 * WhatsApp & Canlı İnsan Devri) otomatik yanıtlar.
 */

const { processIncomingTikTokInteraction } = require('../Module 2/Tiktok/bot-engine');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nyvctdskhAbImlvgbnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function fetchCatalogProducts() {
    if (!SUPABASE_KEY) return [];
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=sku,title,kategori,renkler,kisa_aciklama&limit=25`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!res.ok) return [];
        return await res.json();
    } catch (_) {
        return [];
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tiktok-Signature');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // TikTok Webhook doğrulama (Challenge GET)
    if (req.method === 'GET') {
        const challenge = req.query?.challenge || req.query?.echostr;
        if (challenge) {
            return res.status(200).send(String(challenge));
        }
        return res.status(200).json({
            status: 'active',
            webhook: 'Global Kapak Mobilya — TikTok 3-Stage Hybrid Comment & Business DM Webhook'
        });
    }

    try {
        const body = req.body || {};
        const messageText = body.text || body.comment_text || body.content?.text || body.message || '';
        const username = body.username || body.user?.display_name || body.sender_id || 'tiktok_kullanicisi';
        const channel = body.event === 'direct_message' || body.channel === 'DM' ? 'DM' : 'COMMENT';
        const videoId = body.video_id || body.item_id || '';

        const products = await fetchCatalogProducts();
        const result = await processIncomingTikTokInteraction({
            messageText,
            username,
            channel,
            videoId,
            products,
            geminiApiKey: body.geminiApiKey || GEMINI_API_KEY
        });

        // Supabase tt_bot_state içerisine etkileşim kaydını ekle
        if (SUPABASE_KEY) {
            try {
                const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.tt_bot_state&select=data`, {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    }
                });
                const rows = stateRes.ok ? await stateRes.json() : [];
                const currentData = rows?.[0]?.data || { interactionLogs: [] };
                currentData.interactionLogs = [result, ...(currentData.interactionLogs || [])].slice(0, 60);

                await fetch(`${SUPABASE_URL}/rest/v1/site_settings`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify({
                        key: 'tt_bot_state',
                        data: currentData,
                        updated_at: new Date().toISOString()
                    })
                });
            } catch (_) {
                // state log hatası webhook yanıtını bloklamaz
            }
        }

        return res.status(200).json({
            ok: true,
            result
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
};

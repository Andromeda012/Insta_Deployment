// ============================================================================
// Global Kapak Mobilya — Modül 2: Instagram Cloud Autonomous Publisher Cron
// Endpoint: https://insta-deployment-rho.vercel.app/api/instagram-cron
// Otomatik olarak saat aralıkları gelen Reels, Story ve Gönderileri ONAYSIZ paylaşır.
// ============================================================================
import { publishToInstagramGraphApi } from '../Module 2/Instagram/bot-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.insta_bot_state&select=value`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!stateRes.ok) {
            return res.status(200).json({ ok: false, error: 'Supabase state okunamadı' });
        }

        const rows = await stateRes.json();
        const state = rows?.[0]?.value;
        if (!state || !Array.isArray(state.scheduled_posts)) {
            return res.status(200).json({ ok: true, message: 'Kuyrukta bekleyen gönderi bulunamadı.', published: [] });
        }

        const config = state.config || {};
        if (config.auto_publish_enabled === false) {
            return res.status(200).json({ ok: true, message: 'Otomatik paylaşım duraklatılmış durumda.', published: [] });
        }

        const nowMs = Date.now();
        const duePosts = state.scheduled_posts.filter(p => p.status === 'QUEUED' && new Date(p.scheduled_for).getTime() <= nowMs);

        const publishedList = [];
        for (const post of duePosts) {
            const publishResult = await publishToInstagramGraphApi({
                igUserId: config.ig_user_id || process.env.IG_USER_ID || '',
                accessToken: config.ig_access_token || process.env.IG_ACCESS_TOKEN || '',
                contentType: post.content_type,
                mediaUrl: post.media_url,
                caption: post.caption
            });

            post.status = 'PUBLISHED';
            post.published_at = new Date().toISOString();
            post.ig_published_id = publishResult.publishedId;
            post.auto_approved = true;

            state.logs = state.logs || [];
            state.logs.unshift({
                time: new Date().toLocaleTimeString('tr-TR'),
                level: 'SUCCESS',
                service: 'CLOUD_SCHEDULER',
                message: `[OTOMATİK ONAYSIZ PAYLAŞIM] ${post.content_type} ("${post.title}") bulut sunucu tarafından paylaşıldı. ID: ${publishResult.publishedId}`
            });

            publishedList.push({
                id: post.id,
                title: post.title,
                content_type: post.content_type,
                publishedId: publishResult.publishedId,
                mode: publishResult.mode
            });
        }

        if (publishedList.length > 0) {
            state.logs = (state.logs || []).slice(0, 80);
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
                    value: state,
                    updated_at: new Date().toISOString()
                })
            });
        }

        return res.status(200).json({
            ok: true,
            checked_at: new Date().toISOString(),
            require_approval: false,
            published_count: publishedList.length,
            published: publishedList
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
}

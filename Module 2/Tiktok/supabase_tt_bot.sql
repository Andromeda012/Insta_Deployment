-- ============================================================================
-- MODULE 2: GLOBAL KAPAK MOBİLYA — 7/24 TIKTOK BULUT BOTU SUPABASE KURULUMU
-- ============================================================================
-- Bu SQL betiği mevcut public.site_settings tablosuna 'tt_bot_state' anahtarını
-- ekler ve otonom TikTok zamanlayıcısı + 3 aşamalı yorum/DM geçmişini başlatır.

INSERT INTO public.site_settings (key, data, updated_at)
VALUES (
    'tt_bot_state',
    jsonb_build_object(
        'botActive', true,
        'autonomousMode', true,
        'zeroInputRender', true,
        'accountHandle', '@globalkapak',
        'scheduleTimes', jsonb_build_array('11:30', '16:30', '20:30'),
        'rotationFormats', jsonb_build_array(
            'TIKTOK_ASMR_CNC',
            'TIKTOK_PHOTO_CAROUSEL',
            'TIKTOK_POV_RENOVATION',
            'TIKTOK_B2B_DEALER'
        ),
        'stage1AutoReply', true,
        'stage2GeminiAi', true,
        'stage3WhatsappEscalation', true,
        'whatsappNumber', '905050151035',
        'scheduledQueue', jsonb_build_array(),
        'publishedHistory', jsonb_build_array(),
        'interactionLogs', jsonb_build_array()
    ),
    NOW()
)
ON CONFLICT (key) DO NOTHING;

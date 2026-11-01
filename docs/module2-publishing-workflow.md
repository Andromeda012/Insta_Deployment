# Module 2 — Publishing workflow

Outbound posts use authenticated API -> `social_publish_queue` -> VPS Publisher worker -> platform API. Browser clients never write directly to the queue or publish to platforms.

Instagram and Facebook have one daily Vercel Cron each (`0 0 * * *` and `0 1 * * *` UTC). Both producers queue all active slots for the day; the worker respects each task's `scheduled_for` value. TikTok supports manual queueing; automatic slots require a configured `tt_bot_state.config.posting_slots`. YouTube Shorts remains draft-only until resumable video upload is implemented.

Supported: Instagram Post/Stories and Reels only with MP4/MOV; Facebook Photo/Stories/Link Card; TikTok Video/Photo Carousel manually. Facebook Reels is skipped. YouTube API returns 501 unsupported.

Queue table access is service_role only. Manual endpoints require a Supabase Auth session with `app_metadata.role` equal to `admin` or `content_manager`. Module 2 bot state/campaign settings and Storage folders `instagram`, `facebook`, `tiktok`, `youtube`, `posts`, `stories` are protected for the same roles. Public media reads remain available.

The VPS Publisher defaults to dry-run. Live publishing requires both `DRY_RUN=false` and `ENABLE_LIVE_PUBLISHING=true`. Verify credentials and test tasks before enabling live mode. Required server variables include Supabase service role, Meta page/Instagram credentials, TikTok access token, and Gemini/Photoroom keys.

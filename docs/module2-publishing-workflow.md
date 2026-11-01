# Module 2 — Publishing workflow

Outbound posts use authenticated API -> `social_publish_queue` -> VPS Publisher worker -> platform API. Browser clients never write directly to the queue or publish to platforms.

Instagram and Facebook have one daily Vercel Cron each (`0 0 * * *` and `0 1 * * *` UTC). Both producers queue all active slots for the day; the worker respects each task's `scheduled_for` value. TikTok supports manual queueing; automatic slots require a configured `tt_bot_state.config.posting_slots`. YouTube Shorts remains draft-only until resumable video upload is implemented.

Supported: Instagram Post/Stories and Reels only with MP4/MOV; Facebook Photo/Stories/Link Card; TikTok Video/Photo Carousel manually. Facebook Reels is skipped. YouTube API returns 501 unsupported.

Queue table access is service_role only. Manual enqueue/cancel and bot-state reads/writes require a Supabase Auth session with `app_metadata.role` equal to `admin` or `content_manager`. Browser dashboards call the unified `/api/module2?action=state` handler (legacy state/enqueue/cancel paths are rewrites to this one function); they do not write bot-state rows with the anon key. Module 2 bot state/campaign settings and Storage folders `instagram`, `facebook`, `tiktok`, `youtube`, `posts`, `stories` are protected for the same roles. Public media reads remain available.

The VPS Publisher defaults to dry-run. Live publishing requires both `DRY_RUN=false` and `ENABLE_LIVE_PUBLISHING=true`. Verify credentials and test tasks before enabling live mode. Required server variables include Supabase service role, Meta page/Instagram credentials, TikTok access token, and Gemini/Photoroom keys.


## Legacy service compatibility

The old Instagram, Facebook, and YouTube standalone server schedulers are intentionally inert; their webhook/interaction handlers remain available. TikTok's old direct `/api/publish` endpoint returns HTTP 410. This prevents outbound publishing outside the central queue. Legacy server processes that handle inbound webhooks must be supplied with server-only `SUPABASE_SERVICE_ROLE_KEY` because browser/anon writes to protected bot-state rows are no longer allowed. Webhook verification tokens must be set explicitly and must not use example/default values.

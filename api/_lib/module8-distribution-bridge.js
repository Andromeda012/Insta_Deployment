// ============================================================================
// GLOBAL MOBİLYA — MODULE 8.5: NON-INVASIVE MEDIA DISTRIBUTION BRIDGE
// Module 8 (Multi-Platform Video Engine) <-> Module 2 (AI Content Studio) & Module 1 (Website CMS)
//
// CORE ARCHITECTURAL GUARANTEES:
// 1. Non-Invasive: Never touches Module 2 AI prompts, text generation, image generation,
//    marketing strategies, product atmosphere preferences, or existing publish queues.
// 2. Feature Flag & Fault Isolation: Controlled via MODULE8_DISTRIBUTION_ENABLED (default: true).
//    If disabled or if Module 8 encounters an error, Module 2 and Module 1 continue operating
//    100% identically to their original behavior without throwing errors.
// 3. Deduplication & Safety Validation: Validates storage paths, HTTPS URLs, platform profiles,
//    and prevents duplicate media distribution records via deterministic idempotency keys.
// ============================================================================

export const MODULE8_DISTRIBUTION_STORE_KEY = 'module8_media_distributions';

export const SUPPORTED_DISTRIBUTION_PLATFORMS = Object.freeze({
  instagram: {
    platform_profile: 'instagram',
    module2_platform: 'instagram',
    compatible_deliverables: ['IG_REELS', 'IG_STORY_SERIES', 'IG_CAROUSEL', 'REELS', 'STORIES'],
    aspect_ratio: '9:16',
    default_resolution: '1080x1920',
    label_tr: 'Instagram Reels (9:16)'
  },
  facebook: {
    platform_profile: 'facebook',
    module2_platform: 'facebook',
    compatible_deliverables: ['FB_VIDEO_POST', 'FB_CAROUSEL_POST'],
    aspect_ratio: '9:16',
    default_resolution: '1080x1920',
    label_tr: 'Facebook Reels / Video (9:16)'
  },
  tiktok: {
    platform_profile: 'tiktok',
    module2_platform: 'tiktok',
    compatible_deliverables: ['TT_COLLECTION_VIDEO', 'TT_VIRAL_HOOK_VIDEO'],
    aspect_ratio: '9:16',
    default_resolution: '1080x1920',
    label_tr: 'TikTok Vertical Video (9:16)'
  },
  youtube: {
    platform_profile: 'youtube',
    module2_platform: 'youtube',
    compatible_deliverables: ['YT_SHORTS', 'YT_BUMPER_TEASER'],
    aspect_ratio: '9:16',
    default_resolution: '1080x1920',
    label_tr: 'YouTube Shorts (9:16)'
  },
  website: {
    platform_profile: 'website',
    module2_platform: 'website',
    compatible_deliverables: ['WEBSITE_PREMIUM_FILM', 'PRODUCT_SHOWCASE_VIDEO', 'HERO_CINEMATIC_FILM'],
    aspect_ratio: '16:9',
    default_resolution: '1920x1080',
    label_tr: 'Website Premium Film (16:9)'
  }
});

/**
 * Checks whether the Module 8.5 non-invasive media distribution bridge is enabled.
 * Defaults to true unless MODULE8_DISTRIBUTION_ENABLED is explicitly set to 'false' or '0',
 * or overridden per-request for testing.
 */
export function isModule8DistributionEnabled(req = null) {
  const envVal = String(process.env.MODULE8_DISTRIBUTION_ENABLED ?? 'true').trim().toLowerCase();
  if (envVal === 'false' || envVal === '0' || envVal === 'off' || envVal === 'disabled') {
    return false;
  }
  if (req) {
    const headerOverride = String(req.headers?.['x-module8-distribution'] || '').trim().toLowerCase();
    const queryOverride = String(req.query?.module8_distribution || '').trim().toLowerCase();
    if (headerOverride === 'disabled' || headerOverride === 'false' || queryOverride === 'disabled' || queryOverride === 'false') {
      return false;
    }
  }
  return true;
}

/**
 * Normalizes a Module 8 video record into the canonical 10-field Module 8.5 transfer payload:
 * - product_id (and product_slug / collection_slug)
 * - cinematic_project_id
 * - video_output_id
 * - video_storage_path
 * - public_url / signed_url
 * - platform_profile
 * - encoding_format
 * - resolution
 * - duration
 * - created_at
 */
export function normalizeModule8VideoTransferPayload(video = {}, overrides = {}) {
  const raw = { ...(video || {}), ...(overrides || {}) };

  const videoOutputId = String(
    raw.video_output_id || raw.video_id || raw.id || `vid-out-${Date.now()}`
  ).trim();

  const cinematicProjectId = String(
    raw.cinematic_project_id || raw.source_cinematic_project || raw.cinematic_id || raw.project_id || 'cin-default'
  ).trim();

  const productId = String(
    raw.product_id || raw.product_slug || raw.collection_id || raw.collection_slug || 'genel-koleksiyon'
  ).trim();

  const productSlug = String(
    raw.product_slug || raw.product_id || raw.collection_id || raw.collection_slug || productId
  ).trim();

  const collectionSlug = String(
    raw.collection_slug || raw.collection_id || raw.product_slug || productId
  ).trim();

  const platformProfile = String(
    raw.platform_profile || raw.platform || 'instagram'
  ).trim().toLowerCase();

  const profileMeta = SUPPORTED_DISTRIBUTION_PLATFORMS[platformProfile] || SUPPORTED_DISTRIBUTION_PLATFORMS.instagram;

  const videoStoragePath = String(
    raw.video_storage_path || raw.storage_path || `studio/videos/${raw.project_id || cinematicProjectId}/${platformProfile}.mp4`
  ).trim();

  const publicUrl = String(
    raw.public_url || raw.signed_url || raw.output_public_url || ''
  ).trim();

  const signedUrl = raw.signed_url ? String(raw.signed_url).trim() : null;

  const encodingFormat = String(
    raw.encoding_format || raw.format || 'mp4'
  ).trim().toLowerCase();

  const resolution = String(
    raw.resolution || (raw.width_px && raw.height_px ? `${raw.width_px}x${raw.height_px}` : profileMeta.default_resolution)
  ).trim();

  const duration = Number(raw.duration ?? raw.duration_sec ?? 8) || 8;
  const createdAt = raw.created_at || new Date().toISOString();

  const targetModule = String(
    raw.target_module || (platformProfile === 'website' ? 'module1' : 'module2')
  ).trim().toLowerCase();

  const idempotencyKey = String(
    raw.idempotency_key || `m8dist-${targetModule}-${videoOutputId}-${platformProfile}-${productSlug}`
  ).trim();

  return {
    // 10 Mandatory Module 8.5 Transfer Fields
    product_id: productId,
    cinematic_project_id: cinematicProjectId,
    video_output_id: videoOutputId,
    video_storage_path: videoStoragePath,
    public_url: publicUrl,
    signed_url: signedUrl,
    platform_profile: platformProfile,
    encoding_format: encodingFormat,
    resolution,
    duration,
    created_at: createdAt,

    // Extended Cross-Module Compatibility Metadata
    id: raw.distribution_id || `dist-${videoOutputId}-${targetModule}`,
    distribution_id: raw.distribution_id || `dist-${videoOutputId}-${targetModule}`,
    idempotency_key: idempotencyKey,
    source: 'module8',
    source_module: 'module8_video_engine',
    target_module: targetModule,
    product_slug: productSlug,
    collection_slug: collectionSlug,
    collection_id: collectionSlug,
    project_id: raw.project_id || cinematicProjectId,
    scene_id: raw.scene_id || null,
    aspect_ratio: raw.aspect_ratio || profileMeta.aspect_ratio,
    fps: Number(raw.fps || 30),
    codec: raw.codec || 'h264',
    pixel_format: raw.pixel_format || 'yuv420p',
    preview_url: raw.preview_url || raw.thumbnail_url || null,
    label_tr: raw.label_tr || raw.platform_name_tr || profileMeta.label_tr,
    compatible_deliverables: profileMeta.compatible_deliverables,
    approval_status: raw.approval_status || 'ready_for_selection',
    updated_at: new Date().toISOString()
  };
}

/**
 * Validates that a normalized Module 8 transfer payload meets all security, path, and format rules.
 */
export function validateMediaTransferSafety(payload = {}) {
  const errors = [];

  if (!payload.video_output_id) {
    errors.push('video_output_id zorunludur.');
  }
  if (!payload.cinematic_project_id) {
    errors.push('cinematic_project_id zorunludur.');
  }
  if (!payload.product_id) {
    errors.push('product_id zorunludur.');
  }
  if (!SUPPORTED_DISTRIBUTION_PLATFORMS[payload.platform_profile]) {
    errors.push(`Geçersiz platform_profile: ${payload.platform_profile}`);
  }
  if (!payload.video_storage_path || payload.video_storage_path.includes('..') || !payload.video_storage_path.endsWith('.mp4')) {
    errors.push('Güvenli olmayan veya geçersiz video_storage_path (.mp4 ve path traversal içermemelidir).');
  }
  if (!payload.public_url && !payload.signed_url) {
    errors.push('public_url veya signed_url zorunludur.');
  }
  const activeUrl = payload.public_url || payload.signed_url || '';
  if (activeUrl && !/^https?:\/\//i.test(activeUrl)) {
    errors.push('Video URL geçerli bir HTTP/HTTPS adresi olmalıdır.');
  }
  if (payload.encoding_format !== 'mp4') {
    errors.push(`Desteklenmeyen encoding_format: ${payload.encoding_format} (yalnızca mp4).`);
  }
  if (!/^\d{3,4}x\d{3,4}$/.test(String(payload.resolution || ''))) {
    errors.push(`Geçersiz resolution formatı: ${payload.resolution}`);
  }
  if (!(Number(payload.duration) > 0 && Number(payload.duration) <= 300)) {
    errors.push(`Geçersiz video süresi (duration): ${payload.duration}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Inserts or updates a media distribution record without creating duplicates.
 * Matches by idempotency_key OR (video_output_id + target_module + product_id).
 */
export function deduplicateTransferredMedia(existingList = [], newRecord = {}) {
  const list = Array.isArray(existingList) ? [...existingList] : [];
  const matchIdx = list.findIndex(item =>
    (item.idempotency_key && newRecord.idempotency_key && item.idempotency_key === newRecord.idempotency_key) ||
    (
      item.video_output_id === newRecord.video_output_id &&
      item.target_module === newRecord.target_module &&
      item.platform_profile === newRecord.platform_profile &&
      item.product_id === newRecord.product_id
    )
  );

  if (matchIdx >= 0) {
    const merged = {
      ...list[matchIdx],
      ...newRecord,
      id: list[matchIdx].id || newRecord.id,
      distribution_id: list[matchIdx].distribution_id || newRecord.distribution_id,
      created_at: list[matchIdx].created_at || newRecord.created_at,
      updated_at: new Date().toISOString()
    };
    list[matchIdx] = merged;
    return { list, record: merged, deduplicated: true };
  }

  list.unshift(newRecord);
  return { list, record: newRecord, deduplicated: false };
}

/**
 * Non-invasively attaches a Module 8 video transfer record to a Module 2 campaign deliverable item.
 * Strictly preserves caption, hashtags, cta_text, layered_prompt, seo_metadata, and other items!
 */
export function applyModule8VideoToModule2Deliverable(item = {}, transferPayload = {}) {
  const normalized = normalizeModule8VideoTransferPayload(transferPayload);
  const videoUrl = normalized.public_url || normalized.signed_url;

  // Preserve original media URLs for easy rollback if user ever switches back to image/default
  const originalMediaBackup = item.original_media_backup || {
    cover_url: item.cover_url || item.media_url || null,
    media_urls: Array.isArray(item.media_urls) ? [...item.media_urls] : []
  };

  return {
    ...item,
    // Keep existing text, prompt, hashtags, CTA, and status untouched!
    title: item.title,
    caption: item.caption,
    hashtags: item.hashtags,
    cta_text: item.cta_text,
    layered_prompt: item.layered_prompt,
    cover_url: videoUrl,
    media_url: videoUrl,
    media_urls: [videoUrl],
    source_asset_id: normalized.video_output_id,
    original_media_backup: originalMediaBackup,
    asset_ref: {
      source: 'module8',
      attached_at: new Date().toISOString(),
      product_id: normalized.product_id,
      product_slug: normalized.product_slug,
      collection_slug: normalized.collection_slug,
      cinematic_project_id: normalized.cinematic_project_id,
      video_output_id: normalized.video_output_id,
      video_storage_path: normalized.video_storage_path,
      public_url: normalized.public_url,
      signed_url: normalized.signed_url,
      platform_profile: normalized.platform_profile,
      encoding_format: normalized.encoding_format,
      resolution: normalized.resolution,
      duration: normalized.duration,
      created_at: normalized.created_at,
      preview_url: normalized.preview_url
    },
    updated_at: new Date().toISOString()
  };
}

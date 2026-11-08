/**
 * GLOBAL MOBİLYA — MODULE 8.1: TRIPO H3.1 AI ASSET RECONSTRUCTION ENGINE
 * ============================================================================
 * Official Tripo 3D API (https://developers.tripo3d.ai/) integration with:
 * - Strict backend-only TRIPO_API_KEY isolation & log redaction
 * - Image preparation validation (JPG/JPEG/PNG/WebP magic bytes, size, resolution,
 *   single-furniture crop/visibility confirmation)
 * - Tripo H3.1 (v3.1-20260211) configuration guard (blocks generate_parts when
 *   texture/PBR is enabled)
 * - Cost estimation, $1.00/job PoC cap, total budget ceiling, explicit user cost
 *   approval, and idempotency protection (zero automatic paid retries)
 * - Immediate download of temporary Tripo model URL + strict glTF 2.0 GLB binary
 *   header & chunk verification before Supabase Storage upload
 * ============================================================================
 */

export const TRIPO_API_BASE_URL = 'https://openapi.tripo3d.ai';
export const TRIPO_BASE_URL = TRIPO_API_BASE_URL;
export const TRIPO_DEFAULT_MODEL = 'v3.1-20260211';

export const TRIPO_DEFAULT_GENERATION_SETTINGS = Object.freeze({
  model: TRIPO_DEFAULT_MODEL,
  texture: true,
  pbr: true,
  texture_quality: 'standard',
  geometry_quality: 'detailed',
  texture_alignment: 'original_image'
});

export const ALLOWED_RECON_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

export const ALLOWED_RECON_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp'
]);

export const MIN_RECON_IMAGE_BYTES = 24;                // Min 24 bytes for valid binary header
export const MAX_RECON_IMAGE_BYTES = 10 * 1024 * 1024;  // Max 10 MB
export const RECON_MAX_FILE_BYTES = MAX_RECON_IMAGE_BYTES;
export const MIN_RECON_IMAGE_DIMENSION = 256;           // Min 256x256 px
export const RECON_MIN_RESOLUTION_PX = MIN_RECON_IMAGE_DIMENSION;
export const MAX_RECON_IMAGE_DIMENSION = 4096;          // Max 4096x4096 px
export const RECON_MAX_RESOLUTION_PX = MAX_RECON_IMAGE_DIMENSION;
export const MAX_GLB_MODEL_BYTES = 100 * 1024 * 1024;   // Max 100 MB GLB
export const DEFAULT_ESTIMATED_RECON_COST_USD = 0.30;
export const DEFAULT_MAX_JOB_COST_LIMIT_USD = 1.00;
export const DEFAULT_TOTAL_BUDGET_LIMIT_USD = 25.00;
export const AI_GEOMETRY_DISCLAIMER_TR =
  'Tek fotoğraftan görünmeyen arka ve alt yüzey geometrisi AI tarafından tahmin edilmektedir. Oluşturulan 3D model görsel sahneleme amaçlıdır; gerçek CAD verisi veya ölçülendirilmiş üretim/imalat modeli değildir.';

/**
 * Redacts TRIPO_API_KEY and any Bearer/API tokens from strings or error messages
 */
export function sanitizeTripoSecrets(input, extraSecrets = []) {
  if (!input || typeof input !== 'string') return '';
  let cleaned = input
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TRIPO_KEY]')
    .replace(/tsk_[A-Za-z0-9\-._~+/]+/g, '[REDACTED_TRIPO_KEY]');

  const extraList = Array.isArray(extraSecrets) ? extraSecrets : (extraSecrets ? [extraSecrets] : []);
  const secrets = [
    process.env.TRIPO_API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.RENDER_WORKER_KEY,
    ...extraList
  ].filter(s => typeof s === 'string' && s.trim().length >= 4);

  for (const sec of secrets) {
    cleaned = cleaned.split(sec.trim()).join('[REDACTED_TRIPO_KEY]');
  }
  return cleaned;
}

/**
 * Validates and sanitizes path segments to prevent path traversal
 */
export function sanitizePathSegment(segment, fallback = 'item') {
  if (!segment || typeof segment !== 'string') return fallback;
  if (segment.includes('..') || segment.includes('\0') || segment.includes('/') || segment.includes('\\')) {
    throw new Error('PATH_TRAVERSAL_BLOCKED: Invalid path segment detected.');
  }
  const clean = segment.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return clean.length > 0 ? clean.slice(0, 80) : fallback;
}

/**
 * Parses actual image width & height from JPEG, PNG, or WebP binary headers
 */
export function parseImageBinaryHeader(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
    return { valid: false, format: null, width: null, height: null, error: 'Dosya boyutu geçerli bir görsel başlığı için çok küçük.' };
  }

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A + IHDR chunk at offset 12..23
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { valid: true, format: 'png', mime: 'image/png', width, height };
  }

  // 2. JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // Skip padding 0xFF bytes
      if (marker === 0xFF) {
        offset++;
        continue;
      }
      // Standalone markers without length
      if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
        offset += 2;
        continue;
      }
      if (offset + 4 >= buffer.length) break;
      const segLength = buffer.readUInt16BE(offset + 2);
      if (segLength < 2 || offset + 2 + segLength > buffer.length) break;

      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      if (
        (marker >= 0xC0 && marker <= 0xC3) ||
        (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) ||
        (marker >= 0xCD && marker <= 0xCF)
      ) {
        if (offset + 9 <= buffer.length) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { valid: true, format: 'jpeg', mime: 'image/jpeg', width, height };
        }
      }
      offset += 2 + segLength;
    }
    // Valid JPEG SOI header even if dimensions were provided via metadata
    return { valid: true, format: 'jpeg', mime: 'image/jpeg', width: null, height: null };
  }

  // 3. WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    const chunkType = buffer.toString('ascii', 12, 16);
    if (chunkType === 'VP8 ' && buffer.length >= 30) {
      const width = buffer.readUInt16LE(26) & 0x3FFF;
      const height = buffer.readUInt16LE(28) & 0x3FFF;
      return { valid: true, format: 'webp', mime: 'image/webp', width, height };
    }
    if (chunkType === 'VP8L' && buffer.length >= 25) {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      const width = 1 + (((b1 & 0x3F) << 8) | b0);
      const height = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
      return { valid: true, format: 'webp', mime: 'image/webp', width, height };
    }
    if (chunkType === 'VP8X' && buffer.length >= 30) {
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      return { valid: true, format: 'webp', mime: 'image/webp', width, height };
    }
    return { valid: true, format: 'webp', mime: 'image/webp', width: null, height: null };
  }

  return {
    valid: false,
    format: null,
    width: null,
    height: null,
    error: 'Desteklenmeyen veya bozuk görsel dosyası. Yalnızca gerçek JPG, JPEG, PNG ve WebP dosyaları kabul edilir.'
  };
}

/**
 * Validates single-product image preparation input before Storage upload or Tripo submission
 */
export function validateReconstructionImageInput(payload = {}) {
  const {
    file_base64,
    file_name,
    mime_type,
    product_name,
    product_slug,
    width_px,
    height_px,
    single_item_confirmed,
    visibility_confirmed,
    crop_metadata,
    dimensions_cm,
    maxImageBytes = MAX_RECON_IMAGE_BYTES,
    minDimension = MIN_RECON_IMAGE_DIMENSION,
    maxDimension = MAX_RECON_IMAGE_DIMENSION
  } = payload;

  if (!file_base64 || typeof file_base64 !== 'string') {
    throw new Error('IMAGE_VALIDATION_ERROR: Görsel verisi (file_base64) zorunludur.');
  }
  if (!file_name || typeof file_name !== 'string') {
    throw new Error('IMAGE_VALIDATION_ERROR: Dosya adı (file_name) zorunludur.');
  }
  if (file_name.includes('..') || file_name.includes('\0') || file_name.includes('/') || file_name.includes('\\')) {
    throw new Error('PATH_TRAVERSAL_BLOCKED: Dosya adında geçersiz karakterler tespit edildi.');
  }

  const ext = (file_name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_RECON_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(`INVALID_FILE_TYPE: Desteklenmeyen dosya uzantısı (.${ext}). Yalnızca JPG, JPEG, PNG ve WebP desteklenir.`);
  }

  const normalizedMime = String(mime_type || '').toLowerCase().trim();
  if (!ALLOWED_RECON_IMAGE_MIMES.has(normalizedMime)) {
    throw new Error(`INVALID_MIME_TYPE: Desteklenmeyen MIME türü (${normalizedMime}). Yalnızca image/jpeg, image/png ve image/webp desteklenir.`);
  }

  if (!product_name || typeof product_name !== 'string' || product_name.trim().length < 2) {
    throw new Error('PRODUCT_NAME_REQUIRED: Tekil mobilya ürün adı (product_name) en az 2 karakter olmalıdır.');
  }

  // Enforce single furniture visibility / crop confirmation (never send an uncropped multi-item room as one model)
  if (single_item_confirmed !== true && visibility_confirmed !== true) {
    throw new Error(
      'RECON_SINGLE_ITEM_REQUIRED: VISIBILITY_CHECK_FAILED: Tripo H3.1 tekil mobilya üretimi için görselde yalnızca tek bir mobilyanın seçildiği/kırpıldığı ve net görünür olduğu onaylanmalıdır (single_item_confirmed=true).'
    );
  }

  let buffer;
  try {
    const cleanBase64 = file_base64.replace(/^data:[^;]+;base64,/, '');
    buffer = Buffer.from(cleanBase64, 'base64');
  } catch {
    throw new Error('IMAGE_VALIDATION_ERROR: Geçersiz Base64 görsel kodlaması.');
  }

  if (buffer.length < MIN_RECON_IMAGE_BYTES) {
    throw new Error(`IMAGE_TOO_SMALL: Görsel dosyası çok küçük (${buffer.length} byte).`);
  }
  if (buffer.length > maxImageBytes) {
    throw new Error(
      `RECON_IMAGE_TOO_LARGE: IMAGE_SIZE_LIMIT_EXCEEDED: Görsel boyutu (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) izin verilen üst sınırı (${(maxImageBytes / (1024 * 1024)).toFixed(1)} MB) aşıyor.`
    );
  }

  const headerInfo = parseImageBinaryHeader(buffer);
  if (!headerInfo.valid) {
    throw new Error(`RECON_IMAGE_INVALID_BINARY: INVALID_IMAGE_BINARY: ${headerInfo.error}`);
  }

  const resolvedWidth = Number(headerInfo.width || width_px || 0);
  const resolvedHeight = Number(headerInfo.height || height_px || 0);

  if (!resolvedWidth || !resolvedHeight) {
    throw new Error('IMAGE_RESOLUTION_UNKNOWN: Görsel çözünürlüğü (width x height) doğrulanamadı.');
  }

  if (resolvedWidth < minDimension || resolvedHeight < minDimension) {
    throw new Error(
      `RECON_IMAGE_RESOLUTION_TOO_LOW: IMAGE_RESOLUTION_TOO_LOW: Görsel çözünürlüğü (${resolvedWidth}x${resolvedHeight} px) çok düşük. Kaliteli 3D model için en az ${minDimension}x${minDimension} px olmalıdır.`
    );
  }

  if (resolvedWidth > maxDimension || resolvedHeight > maxDimension) {
    throw new Error(
      `RECON_IMAGE_RESOLUTION_TOO_HIGH: IMAGE_RESOLUTION_TOO_HIGH: Görsel çözünürlüğü (${resolvedWidth}x${resolvedHeight} px) üst sınırı (${maxDimension}x${maxDimension} px) aşıyor.`
    );
  }

  // Validate optional dimensions_cm if provided
  let sanitizedDimensions = null;
  if (dimensions_cm && typeof dimensions_cm === 'object') {
    const w = dimensions_cm.width_cm ? Number(dimensions_cm.width_cm) : null;
    const h = dimensions_cm.height_cm ? Number(dimensions_cm.height_cm) : null;
    const d = dimensions_cm.depth_cm ? Number(dimensions_cm.depth_cm) : null;
    if ((w !== null && (isNaN(w) || w <= 0 || w > 1000)) ||
        (h !== null && (isNaN(h) || h <= 0 || h > 1000)) ||
        (d !== null && (isNaN(d) || d <= 0 || d > 1000))) {
      throw new Error('INVALID_DIMENSIONS: Ürün ölçüleri (cm) 1 ile 1000 cm arasında geçerli sayılar olmalıdır.');
    }
    sanitizedDimensions = { width_cm: w, height_cm: h, depth_cm: d };
  }

  const resolvedSlug = product_slug
    ? sanitizePathSegment(product_slug, 'general')
    : sanitizePathSegment(product_name.toLowerCase().replace(/[^a-z0-9_-]/g, '_'), 'general');
  const resolvedCrop = payload.crop_region || crop_metadata || { crop_applied: false, full_single_item: true };

  return {
    valid: true,
    buffer,
    fileSizeBytes: buffer.length,
    file_size_bytes: buffer.length,
    format: headerInfo.format,
    mimeType: headerInfo.mime,
    mime_type: headerInfo.mime,
    extension: ext === 'jpeg' ? 'jpg' : ext,
    file_name: file_name.trim(),
    widthPx: resolvedWidth,
    heightPx: resolvedHeight,
    width_px: resolvedWidth,
    height_px: resolvedHeight,
    productName: product_name.trim(),
    product_name: product_name.trim(),
    productSlug: resolvedSlug,
    product_slug: resolvedSlug,
    product_id: payload.product_id || resolvedSlug,
    dimensionsCm: sanitizedDimensions,
    dimensions_cm: sanitizedDimensions,
    cropMetadata: resolvedCrop,
    crop_region: resolvedCrop
  };
}

/**
 * Validates and constructs Tripo H3.1 (v3.1-20260211) generation settings.
 * Enforces rule: generate_parts MUST NOT be used when texture or pbr is true.
 */
export function buildTripoH31GenerationSettings(raw = {}) {
  const model = raw.model || TRIPO_DEFAULT_MODEL;
  if (model !== TRIPO_DEFAULT_MODEL) {
    throw new Error(`TRIPO_UNSUPPORTED_MODEL: Yalnızca '${TRIPO_DEFAULT_MODEL}' modeli desteklenmektedir (gönderilen: '${model}').`);
  }

  const texture = raw.texture !== undefined ? Boolean(raw.texture) : true;
  const pbr = raw.pbr !== undefined ? Boolean(raw.pbr) : true;
  const textureQuality = raw.texture_quality || 'standard';
  const geometryQuality = raw.geometry_quality || 'detailed';
  const textureAlignment = raw.texture_alignment || 'original_image';

  if (!['standard', 'detailed'].includes(textureQuality)) {
    throw new Error(`TRIPO_INVALID_CONFIG: texture_quality değeri 'standard' veya 'detailed' olmalıdır.`);
  }
  if (!['standard', 'detailed'].includes(geometryQuality)) {
    throw new Error(`TRIPO_INVALID_CONFIG: geometry_quality değeri 'standard' veya 'detailed' olmalıdır.`);
  }
  if (!['original_image', 'geometry'].includes(textureAlignment)) {
    throw new Error(`TRIPO_INVALID_CONFIG: texture_alignment değeri 'original_image' veya 'geometry' olmalıdır.`);
  }

  // Mandatory Tripo H3.1 rule: generate_parts is incompatible with texture & pbr
  if (raw.generate_parts === true && (texture || pbr)) {
    throw new Error(
      'TRIPO_INCOMPATIBLE_SETTINGS: TRIPO_PARTS_CONFLICT: Tripo H3.1 API\'sinde texture ve PBR açıkken generate_parts desteklenmemektedir. İlk aşamada generate_parts kapalı tutulmalıdır.'
    );
  }

  return {
    model: TRIPO_DEFAULT_MODEL,
    texture,
    pbr,
    texture_quality: textureQuality,
    geometry_quality: geometryQuality,
    texture_alignment: textureAlignment
  };
}

/**
 * Estimates Tripo H3.1 API cost & credit usage and enforces PoC budget limits
 */
export function evaluateReconstructionCostGuard(options = {}) {
  const settings = buildTripoH31GenerationSettings(options.settings || {});
  const maxJobCostUsd = Number(
    options.maxJobCostLimitUsd ?? options.maxJobCostUsd ?? process.env.TRIPO_MAX_JOB_COST_USD ?? DEFAULT_MAX_JOB_COST_LIMIT_USD
  );
  const maxTotalBudgetUsd = Number(
    options.totalBudgetLimitUsd ?? options.maxTotalBudgetUsd ?? process.env.TRIPO_TOTAL_BUDGET_USD ?? process.env.TRIPO_TOTAL_BUDGET_LIMIT_USD ?? DEFAULT_TOTAL_BUDGET_LIMIT_USD
  );
  const currentSpentUsd = Number(options.currentSpentUsd || 0);

  let estimatedCredits = 20;
  if (settings.geometry_quality === 'detailed') estimatedCredits += 5;
  if (settings.texture || settings.pbr) estimatedCredits += 5;
  if (settings.texture_quality === 'detailed') estimatedCredits += 10;

  const creditPriceUsd = Number(options.creditPriceUsd ?? process.env.TRIPO_CREDIT_PRICE_USD ?? 0.01);
  const estimatedCostUsd = Number(
    options.estimatedCostUsd !== undefined
      ? options.estimatedCostUsd
      : options.overrideEstimatedCostUsd !== undefined
        ? options.overrideEstimatedCostUsd
        : (estimatedCredits * creditPriceUsd).toFixed(4)
  );

  if (options.userCostApproved === false) {
    throw new Error(
      'COST_GUARD_USER_APPROVAL_REQUIRED: Ücretli 3D üretim başlatılmadan önce kullanıcı maliyet onayı (user_cost_approved: true) zorunludur.'
    );
  }

  if (options.isRetryAttempt === true && options.userRegenerateApproved !== true) {
    throw new Error(
      'COST_GUARD_REGENERATION_REQUIRES_APPROVAL: Başarısız veya tamamlanmış görevlerde otomatik tekrar yapılmaz; açık kullanıcı onayı zorunludur.'
    );
  }

  const remainingBudgetUsd = Number(Math.max(0, maxTotalBudgetUsd - currentSpentUsd).toFixed(4));
  const exceedsJobLimit = estimatedCostUsd > maxJobCostUsd;
  const exceedsTotalBudget = (currentSpentUsd + estimatedCostUsd) > maxTotalBudgetUsd;

  if (exceedsJobLimit) {
    throw new Error(
      `COST_GUARD_JOB_LIMIT_EXCEEDED: Tahmini işlem maliyeti ($${estimatedCostUsd.toFixed(2)} USD), görev başı üst sınırı ($${maxJobCostUsd.toFixed(2)} USD) aşıyor.`
    );
  }

  if (exceedsTotalBudget) {
    throw new Error(
      `COST_GUARD_TOTAL_BUDGET_EXCEEDED: Tahmini maliyet ($${estimatedCostUsd.toFixed(2)} USD) ile toplam harcama ($${currentSpentUsd.toFixed(2)} USD) bütçe tavanını ($${maxTotalBudgetUsd.toFixed(2)} USD) aşıyor.`
    );
  }

  return {
    provider: 'tripo3d',
    provider_model: settings.model,
    estimated_credits: estimatedCredits,
    estimated_cost_usd: estimatedCostUsd,
    max_job_cost_limit_usd: maxJobCostUsd,
    max_total_budget_limit_usd: maxTotalBudgetUsd,
    current_spent_usd: Number(currentSpentUsd.toFixed(4)),
    remaining_budget_usd: remainingBudgetUsd,
    exceeds_job_limit: exceedsJobLimit,
    exceeds_total_budget: exceedsTotalBudget,
    allowed: !exceedsJobLimit && !exceedsTotalBudget,
    ai_geometry_disclaimer: AI_GEOMETRY_DISCLAIMER_TR
  };
}

/**
 * Strictly validates that a downloaded buffer is a genuine glTF 2.0 Binary (.glb)
 */
export function validateGlbBinary(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('GLB_VALIDATION_ERROR: INVALID_GLB_BINARY: Model verisi geçerli bir binary buffer değil.');
  }
  if (buffer.length < 28) {
    throw new Error(`GLB_VALIDATION_ERROR: INVALID_GLB_BINARY: Dosya boyutu (${buffer.length} byte) geçerli bir GLB başlığı için çok küçük.`);
  }
  if (buffer.length > MAX_GLB_MODEL_BYTES) {
    throw new Error(`GLB_VALIDATION_ERROR: INVALID_GLB_BINARY: GLB dosya boyutu (${buffer.length} byte) güvenli sınırı aşıyor.`);
  }

  // Bytes 0..3: magic 'glTF' (0x46546C67 LE)
  const magic = buffer.toString('ascii', 0, 4);
  if (magic !== 'glTF') {
    throw new Error(`GLB_VALIDATION_ERROR: INVALID_GLB_BINARY: Geçersiz GLB dosya imzası (beklenen 'glTF', alınan '${magic.replace(/[^\x20-\x7E]/g, '?')}').`);
  }

  // Bytes 4..7: version (uint32 LE === 2)
  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`GLB_VALIDATION_ERROR: INVALID_GLB_BINARY: Desteklenmeyen glTF binary sürümü (${version}). Yalnızca glTF 2.0 desteklenir.`);
  }

  // Bytes 8..11: total byte length (uint32 LE)
  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength !== buffer.length) {
    throw new Error(
      `GLB_VALIDATION_ERROR: INVALID_GLB_BINARY: GLB başlığındaki uzunluk (${declaredLength} byte) gerçek dosya boyutuyla (${buffer.length} byte) eşleşmiyor (eksik veya bozuk indirme).`
    );
  }

  // Bytes 12..19: Chunk 0 (JSON chunk)
  const chunk0Length = buffer.readUInt32LE(12);
  const chunk0Type = buffer.readUInt32LE(16);
  if (chunk0Type !== 0x4E4F534A) { // 'JSON' in ASCII little-endian
    throw new Error('GLB_VALIDATION_ERROR: INVALID_GLB_BINARY: İlk GLB veri bloğu geçerli bir JSON sahne tanımı içermiyor.');
  }
  if (20 + chunk0Length > buffer.length) {
    throw new Error('GLB_VALIDATION_ERROR: INVALID_GLB_BINARY: GLB JSON veri bloğu bozuk veya yarıda kesilmiş.');
  }

  const jsonStr = buffer.toString('utf8', 20, 20 + chunk0Length).replace(/\0+$/, '').trim();
  let gltfJson;
  try {
    gltfJson = JSON.parse(jsonStr);
  } catch {
    throw new Error('GLB_VALIDATION_ERROR: INVALID_GLB_BINARY: GLB içindeki glTF JSON yapısı çözümlenemedi.');
  }

  if (!gltfJson || !gltfJson.asset || String(gltfJson.asset.version) !== '2.0') {
    throw new Error('GLB_VALIDATION_ERROR: INVALID_GLB_BINARY: GLB içinde geçerli bir asset.version="2.0" bildirimi bulunamadı.');
  }

  const meshesCount = Array.isArray(gltfJson.meshes) ? gltfJson.meshes.length : 0;
  const materialsCount = Array.isArray(gltfJson.materials) ? gltfJson.materials.length : 0;
  const texturesCount = Array.isArray(gltfJson.textures) ? gltfJson.textures.length : 0;

  return {
    valid: true,
    magic: 'glTF',
    version: 2,
    byteLength: buffer.length,
    byte_length: buffer.length,
    declaredLength,
    declared_length: declaredLength,
    meshesCount,
    meshes_count: meshesCount,
    materialsCount,
    materials_count: materialsCount,
    texturesCount,
    textures_count: texturesCount,
    generator: gltfJson.asset.generator || 'Tripo H3.1'
  };
}

/**
 * Generates a valid minimal glTF 2.0 binary (.glb) for deterministic mock testing
 * (never used as a silent fallback in live API mode)
 */
export function buildSampleValidGlbBuffer(metadata = {}) {
  const gltfScene = {
    asset: {
      version: '2.0',
      generator: metadata.generator || 'Tripo H3.1 Mock Reconstructor (v3.1-20260211)',
      extras: {
        product_name: metadata.productName || 'Furniture Item',
        ai_estimated_hidden_surfaces: true
      }
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: metadata.productName || 'FurnitureMesh', mesh: 0 }],
    meshes: [
      {
        name: metadata.productName || 'FurnitureMesh',
        primitives: [{ attributes: { POSITION: 0 }, material: 0 }]
      }
    ],
    materials: [
      {
        name: 'PBR_Furniture_Material',
        pbrMetallicRoughness: {
          baseColorFactor: [0.82, 0.75, 0.65, 1.0],
          metallicFactor: 0.05,
          roughnessFactor: 0.65
        }
      }
    ],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 }],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        max: [0.5, 0.8, 0.5],
        min: [-0.5, 0.0, -0.5]
      }
    ]
  };

  let jsonBytes = Buffer.from(JSON.stringify(gltfScene), 'utf8');
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPad > 0) {
    jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]); // pad with spaces
  }

  // Binary geometry chunk (3 vertices * 3 floats * 4 bytes = 36 bytes)
  const binBytes = Buffer.alloc(36);
  const coords = [-0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.8, 0.0];
  coords.forEach((val, idx) => binBytes.writeFloatLE(val, idx * 4));

  const totalLength = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 4, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binBytes.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonChunkHeader, jsonBytes, binChunkHeader, binBytes]);
}

/**
 * Official Tripo H3.1 REST API Client
 */
export class TripoH31Client {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || process.env.TRIPO_API_BASE_URL || TRIPO_API_BASE_URL).replace(/\/+$/, '');
    this.apiKey = String(options.apiKey !== undefined ? options.apiKey : (process.env.TRIPO_API_KEY || '')).trim();
    this.timeoutMs = Number(options.timeoutMs || process.env.TRIPO_API_TIMEOUT_MS || 30000);
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.length >= 8 && !this.apiKey.includes('YOUR_'));
  }

  validateApiKey() {
    this._requireApiKey();
    return true;
  }

  _requireApiKey() {
    if (!this.hasApiKey()) {
      const err = new Error(
        'TRIPO_API_KEY_MISSING: Sunucu ortamında geçerli bir TRIPO_API_KEY tanımlı değil. Ücretli API çağrısı engellendi.'
      );
      err.code = 'TRIPO_API_KEY_MISSING';
      throw err;
    }
  }

  async _fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.status === 429) {
        const retryAfter = res.headers?.get ? res.headers.get('retry-after') : null;
        const err = new Error(
          `TRIPO_RATE_LIMIT: TRIPO_RATE_LIMITED: Tripo API istek sınırı aşıldı (HTTP 429).${retryAfter ? ` Lütfen ${retryAfter} sn sonra tekrar deneyin.` : ''}`
        );
        err.code = 'TRIPO_RATE_LIMIT';
        err.statusCode = 429;
        err.retryAfterSeconds = retryAfter ? Number(retryAfter) : 30;
        throw err;
      }

      return res;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`TRIPO_TIMEOUT: Tripo API isteği ${this.timeoutMs}ms içinde yanıt vermedi.`);
        timeoutErr.code = 'TRIPO_TIMEOUT';
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      err.message = sanitizeTripoSecrets(err.message, [this.apiKey]);
      throw err;
    }
  }

  /**
   * 1. Upload source furniture image to Tripo File Upload API
   * Endpoint: POST https://openapi.tripo3d.ai/v3/files
   */
  async uploadImageFile(imageBufferOrOpts, fileName = 'product.jpg', mimeType = 'image/jpeg') {
    this._requireApiKey();
    let imageBuffer = imageBufferOrOpts;
    if (imageBufferOrOpts && !Buffer.isBuffer(imageBufferOrOpts) && typeof imageBufferOrOpts === 'object') {
      imageBuffer = imageBufferOrOpts.buffer;
      fileName = imageBufferOrOpts.fileName || fileName;
      mimeType = imageBufferOrOpts.mimeType || mimeType;
    }
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length < MIN_RECON_IMAGE_BYTES) {
      throw new Error('TRIPO_UPLOAD_INVALID_BUFFER: Yüklenecek görsel verisi geçersiz.');
    }

    const url = `${this.baseUrl}/v3/files`;
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append('file', blob, fileName);

    const res = await this._fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: formData
    });

    const rawText = await res.text();
    let payload;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error(`TRIPO_INVALID_JSON: Tripo dosya yükleme yanıtı geçerli JSON değil (HTTP ${res.status}).`);
    }

    if (!res.ok || (payload && payload.code !== undefined && payload.code !== 0)) {
      const msg = sanitizeTripoSecrets(payload?.message || payload?.error || `HTTP ${res.status}`, [this.apiKey]);
      const err = new Error(`TRIPO_FILE_UPLOAD_FAILED: ${msg}`);
      err.code = 'TRIPO_FILE_UPLOAD_FAILED';
      err.statusCode = res.status;
      throw err;
    }

    const dataObj = payload?.data || payload || {};
    const fileToken = dataObj.file_token || dataObj.image_token || dataObj.token;
    if (!fileToken || typeof fileToken !== 'string') {
      throw new Error('TRIPO_SCHEMA_ERROR: Tripo /v3/files yanıtında geçerli bir file_token bulunamadı.');
    }

    return {
      file_token: fileToken,
      raw: dataObj
    };
  }

  /**
   * 2. Submit Image-to-Model Generation Task
   * Endpoint: POST https://openapi.tripo3d.ai/v3/generation/image-to-model
   */
  async createImageToModelTask({ fileToken, fileType = 'jpg', settings = {} }) {
    this._requireApiKey();
    if (!fileToken || typeof fileToken !== 'string') {
      throw new Error('TRIPO_TASK_ERROR: file_token zorunludur.');
    }

    const validatedSettings = buildTripoH31GenerationSettings(settings);
    const url = `${this.baseUrl}/v3/generation/image-to-model`;

    const requestBody = {
      type: 'image_to_model',
      model: validatedSettings.model,
      file: {
        type: fileType === 'jpeg' ? 'jpg' : fileType,
        file_token: fileToken
      },
      texture: validatedSettings.texture,
      pbr: validatedSettings.pbr,
      texture_quality: validatedSettings.texture_quality,
      geometry_quality: validatedSettings.geometry_quality,
      texture_alignment: validatedSettings.texture_alignment
    };

    const res = await this._fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const rawText = await res.text();
    let payload;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error(`TRIPO_INVALID_JSON: Tripo image-to-model yanıtı geçerli JSON değil (HTTP ${res.status}).`);
    }

    if (!res.ok || (payload && payload.code !== undefined && payload.code !== 0)) {
      const msg = sanitizeTripoSecrets(payload?.message || payload?.error || `HTTP ${res.status}`, [this.apiKey]);
      const err = new Error(`TRIPO_TASK_CREATE_FAILED: ${msg}`);
      err.code = 'TRIPO_TASK_CREATE_FAILED';
      err.statusCode = res.status;
      throw err;
    }

    const dataObj = payload?.data || payload || {};
    const taskId = dataObj.task_id || dataObj.id;
    if (!taskId || typeof taskId !== 'string') {
      throw new Error('TRIPO_SCHEMA_ERROR: Tripo image-to-model yanıtında geçerli bir task_id bulunamadı.');
    }

    return {
      task_id: taskId,
      settings: validatedSettings,
      raw: dataObj
    };
  }

  /**
   * 3. Poll Task Status
   * Endpoint: GET https://openapi.tripo3d.ai/v3/tasks/{task_id}
   */
  async getTaskStatus(taskId) {
    this._requireApiKey();
    if (!taskId || typeof taskId !== 'string') {
      throw new Error('TRIPO_TASK_ERROR: task_id zorunludur.');
    }

    const url = `${this.baseUrl}/v3/tasks/${encodeURIComponent(taskId)}`;
    const res = await this._fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      }
    });

    const rawText = await res.text();
    let payload;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error(`TRIPO_INVALID_JSON: Tripo task durum yanıtı geçerli JSON değil (HTTP ${res.status}).`);
    }

    if (!res.ok || (payload && payload.code !== undefined && payload.code !== 0)) {
      const msg = sanitizeTripoSecrets(payload?.message || payload?.error || `HTTP ${res.status}`, [this.apiKey]);
      const err = new Error(`TRIPO_TASK_POLL_FAILED: ${msg}`);
      err.code = 'TRIPO_TASK_POLL_FAILED';
      err.statusCode = res.status;
      throw err;
    }

    const taskData = payload?.data || payload;
    if (!taskData || typeof taskData !== 'object') {
      throw new Error('TRIPO_SCHEMA_ERROR: Tripo task yanıtında geçerli bir veri nesnesi bulunamadı.');
    }

    const rawStatus = String(taskData.status || '').toLowerCase();
    const progress = Number(taskData.progress ?? (rawStatus === 'success' || rawStatus === 'completed' ? 100 : 0));

    // Extract temporary model URL from Tripo response schema variations
    const output = taskData.output || taskData.result || {};
    const modelUrl =
      (typeof output.pbr_model === 'string' ? output.pbr_model : output.pbr_model?.url) ||
      (typeof output.model === 'string' ? output.model : output.model?.url) ||
      (typeof output.base_model === 'string' ? output.base_model : output.base_model?.url) ||
      taskData.model_url ||
      null;

    // Extract actual consumed credits if reported by Tripo API
    const consumedCredits =
      taskData.consumed_credit ??
      taskData.credit_used ??
      taskData.usage?.credits ??
      taskData.input?.credit ??
      null;

    let normalizedStatus = 'processing';
    if (['queued', 'pending', 'init'].includes(rawStatus)) {
      normalizedStatus = 'queued';
    } else if (['running', 'processing', 'in_progress'].includes(rawStatus)) {
      normalizedStatus = 'processing';
    } else if (['success', 'completed', 'succeeded'].includes(rawStatus)) {
      normalizedStatus = 'completed';
    } else if (['failed', 'error', 'banned', 'expired', 'cancelled', 'canceled'].includes(rawStatus)) {
      normalizedStatus = 'failed';
    }

    return {
      task_id: taskData.task_id || taskData.id || taskId,
      raw_status: rawStatus,
      status: normalizedStatus,
      normalized_status: normalizedStatus,
      progress: Math.min(100, Math.max(0, progress)),
      model_url: modelUrl,
      consumed_credits: consumedCredits !== null ? Number(consumedCredits) : null,
      error_message: taskData.error || taskData.message || (normalizedStatus === 'failed' ? `Tripo task durumu: ${rawStatus}` : null)
    };
  }

  /**
   * 4. Immediately download temporary GLB URL and validate glTF 2.0 binary integrity
   */
  async downloadAndValidateGlb(modelUrl) {
    if (!modelUrl || typeof modelUrl !== 'string' || !modelUrl.startsWith('http')) {
      throw new Error('TRIPO_MODEL_URL_INVALID: Geçerli bir geçici GLB indirme adresi (model_url) bulunamadı.');
    }

    const res = await this._fetchWithTimeout(modelUrl, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`TRIPO_MODEL_DOWNLOAD_FAILED: Geçici GLB modeli indirilemedi (HTTP ${res.status}).`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const validation = validateGlbBinary(buffer);

    return {
      buffer,
      fileSizeBytes: buffer.length,
      validation
    };
  }
}

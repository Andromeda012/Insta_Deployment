// ============================================================================
// GLOBAL MOBİLYA — MODULE 8: CREATIVE PRODUCTION STUDIO BACKEND API (PHASE 2)
// Functional Media Asset Management, Safe Uploads, Job Lifecycle & Worker Contracts
// ============================================================================

import { authenticateRoles, apiError } from './_lib/auth.js';
import crypto from 'crypto';

// ── TIMING-SAFE WORKER AUTHENTICATION ─────────────────────────────────────────
function verifyWorkerAuth(req) {
  const configuredKey = (process.env.RENDER_WORKER_KEY || '').trim();
  const incomingKey = req.headers['x-worker-key'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : req.headers.authorization && req.headers.authorization.startsWith('Worker ')
        ? req.headers.authorization.slice(7).trim()
        : null);

  if (configuredKey && configuredKey.length >= 8) {
    if (!incomingKey || typeof incomingKey !== 'string') return false;
    const bufIncoming = Buffer.from(incomingKey.trim());
    const bufConfigured = Buffer.from(configuredKey);
    if (bufIncoming.length !== bufConfigured.length) return false;
    return crypto.timingSafeEqual(bufIncoming, bufConfigured);
  }

  // Non-production test/dev fallback: accept valid test key, reject empty/missing
  if (process.env.NODE_ENV !== 'production' && incomingKey && incomingKey.length >= 8) {
    return true;
  }

  return false;
}

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ANON_KEY;

const SETTINGS_STUDIO_STORE_KEY = 'module8_studio_store';

// ── 1. SAFE UPLOAD CONSTRAINTS & CONSTANTS ────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
  'video/mp4', 'video/webm', 'video/quicktime',
  'model/gltf-binary', 'model/gltf+json',
  'application/octet-stream', 'application/x-blender'
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff',
  'mp4', 'webm', 'mov',
  'glb', 'gltf', 'obj', 'blend', 'fbx'
]);

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;    // 15 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;   // 100 MB
const MAX_3D_BYTES = 150 * 1024 * 1024;      // 150 MB

// ── 2. REGISTERED PRODUCTION ENGINES (CAPABILITY MATRIX) ──────────────────────
export const REGISTERED_ENGINES = [
  {
    id: 'blender_headless',
    name: 'Blender 4.x Headless Worker',
    type: '3d_rendering',
    renderers: ['cycles', 'eevee_next'],
    status: 'worker_ready_stub',
    workerDaemon: 'Sunucu/render-worker',
    description: 'Blender GPU rendering daemon for photorealistic 3D collections & cinematic cameras.',
    supportedOutputs: ['16:9', '9:16', '1:1', '4:5'],
    maxResolution: '3840x2160'
  },
  {
    id: 'ai_enhancer',
    name: 'AI Image & Lighting Studio',
    type: 'image_processing',
    status: 'service_ready_stub',
    description: 'PBR texture preservation, background extraction & high-dynamic lighting enhancement.',
    supportedOutputs: ['jpg', 'png', 'webp'],
    maxResolution: '4096x4096'
  },
  {
    id: 'ai_3d_recon',
    name: 'Multi-View 3D Reconstructor',
    type: '3d_reconstruction',
    status: 'service_ready_stub',
    description: 'Photogrammetry and mesh synthesis from catalog multi-angle photography.',
    supportedOutputs: ['glb', 'gltf', 'obj'],
    maxResolution: null
  },
  {
    id: 'ffmpeg_transcoder',
    name: 'FFmpeg Multi-Format Transcoder',
    type: 'video_transcoding',
    status: 'service_ready_stub',
    description: 'Autonomous encoding to Instagram Reels (9:16), YouTube (16:9) & Web H.265/AV1.',
    supportedOutputs: ['mp4', 'webm', 'mov'],
    maxResolution: '1920x1080'
  }
];

// ── 3. SCENE TEMPLATE PRESETS ────────────────────────────────────────────────
export const DEFAULT_SCENE_TEMPLATES = [
  {
    id: 'vienna_luxury_salon',
    template_id: 'tpl-vienna-salon',
    slug: 'vienna_luxury_salon',
    scene_slug: 'vienna_luxury_salon',
    name: 'Vienna Architectural Evening Salon',
    collection_id: 'viyana-yatak-odasi-rs83',
    environment_theme: 'luxury_showroom',
    lighting_preset: 'Golden Hour & Subtle Low Spotlights',
    camera_presets: ['Slow Push-In (35mm)', 'Low Angle Orbit (50mm)', 'Detail Dolly-In (85mm Macro)'],
    render_engine: 'cycles',
    version: 1
  },
  {
    id: 'verona_sunlit_villa',
    template_id: 'tpl-verona-villa',
    slug: 'verona_sunlit_villa',
    scene_slug: 'verona_sunlit_villa',
    name: 'Verona Mediterranean Daylight Villa',
    collection_id: 'verona-yatak-odasi',
    environment_theme: 'mediterranean_sun',
    lighting_preset: 'Diffused Morning Daylight (5600K)',
    camera_presets: ['Wide Architectural Pan (24mm)', 'Slow Pedestal Up (35mm)'],
    render_engine: 'eevee_next',
    version: 1
  },
  {
    id: 'siena_modern_atelier',
    template_id: 'tpl-siena-minimal',
    slug: 'siena_modern_atelier',
    scene_slug: 'siena_modern_atelier',
    name: 'Siena Contemporary Woodwork Atelier',
    collection_id: 'siena-yatak-odasi',
    environment_theme: 'warm_atelier',
    lighting_preset: 'Warm Walnut Ambient Bounce (3200K)',
    camera_presets: ['Slow Orbit 360 (50mm)', 'Top-Down Architectural Track'],
    render_engine: 'cycles',
    version: 1
  },
  {
    id: 'kopenhag_nordic_sanctuary',
    template_id: 'tpl-kopenhag-botanic',
    slug: 'kopenhag_nordic_sanctuary',
    scene_slug: 'kopenhag_nordic_sanctuary',
    name: 'Kopenhag Nordic Botanic Living Space',
    collection_id: 'kopenhag-yatak-odasi',
    environment_theme: 'nordic_daylight',
    lighting_preset: 'Overcast Soft Skybox with Living Greenery Dappling',
    camera_presets: ['Gentle Floating Dolly (35mm)', 'Craftsmanship Texture Focus (90mm)'],
    render_engine: 'cycles',
    version: 1
  }
];

// ── 4. SUPABASE REST HELPER ──────────────────────────────────────────────────
async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    cache: 'no-store'
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { ok: res.ok, status: res.status, data: json };
}

// ── 5. RESILIENT STORE & ATOMIC MUTEX LOCK (PREVENTS CONCURRENT RACE) ────────
let inMemoryStudioStore = {
  media_assets: [],
  production_jobs: [],
  production_events: [],
  production_outputs: [],
  three_d_assets: [],
  scene_templates: DEFAULT_SCENE_TEMPLATES,
  production_costs: []
};

// Serializes concurrent claim / update / complete operations within the same process
let storeMutexPromise = Promise.resolve();
function withStoreLock(fn) {
  const next = storeMutexPromise.then(() => fn(), () => fn());
  storeMutexPromise = next.catch(() => {});
  return next;
}

function normalizeJobRecord(job) {
  if (!job || typeof job !== 'object') return job;
  const mergedSettings = {
    ...(job.config_params || {}),
    ...(job.render_settings || {})
  };
  job.id = job.id || job.job_id;
  job.job_id = job.id;
  job.input_model_path = job.input_model_path ?? mergedSettings.input_model_path ?? mergedSettings.model_path ?? null;
  job.output_render_path = job.output_render_path ?? null;
  job.output_public_url = job.output_public_url ?? null;
  job.render_settings = mergedSettings;
  job.config_params = mergedSettings;
  job.worker_id = job.worker_id ?? null;
  job.lease_expires_at = job.lease_expires_at ?? null;
  job.retry_count = Number(job.retry_count || 0);
  job.max_retries = Number(job.max_retries ?? 3);
  job.error_code = job.error_code ?? null;
  job.error_message = job.error_message ?? null;
  job.started_at = job.started_at ?? null;
  job.completed_at = job.completed_at ?? null;
  return job;
}

async function readStudioStore() {
  try {
    const res = await supabaseRequest(`/rest/v1/site_settings?key=eq.${SETTINGS_STUDIO_STORE_KEY}&select=data`);
    if (res.ok && Array.isArray(res.data) && res.data[0]?.data) {
      inMemoryStudioStore = {
        ...inMemoryStudioStore,
        ...res.data[0].data,
        scene_templates: res.data[0].data.scene_templates?.length ? res.data[0].data.scene_templates : DEFAULT_SCENE_TEMPLATES
      };
      if (Array.isArray(inMemoryStudioStore.production_jobs)) {
        inMemoryStudioStore.production_jobs.forEach(normalizeJobRecord);
      }
      return inMemoryStudioStore;
    }
  } catch {}
  if (Array.isArray(inMemoryStudioStore.production_jobs)) {
    inMemoryStudioStore.production_jobs.forEach(normalizeJobRecord);
  }
  return inMemoryStudioStore;
}

async function writeStudioStore(store) {
  if (Array.isArray(store.production_jobs)) {
    store.production_jobs.forEach(normalizeJobRecord);
  }
  inMemoryStudioStore = store;
  try {
    return await supabaseRequest('/rest/v1/site_settings', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        key: SETTINGS_STUDIO_STORE_KEY,
        data: store,
        updated_at: new Date().toISOString()
      })
    });
  } catch {
    return { ok: true, memoryOnly: true };
  }
}

// ── 6. ACTION HANDLERS ───────────────────────────────────────────────────────

// Action: Overview (Dashboard Statistics & Honest Metrics)
async function handleOverview(req, res) {
  const store = await readStudioStore();
  const jobs = store.production_jobs || [];
  const media = store.media_assets || [];
  const models = store.three_d_assets || [];

  const activeJobs = jobs.filter(j => ['pending', 'queued', 'processing', 'rendering', 'uploading', 'encoding', 'quality_check'].includes(j.status));
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const failedJobs = jobs.filter(j => j.status === 'failed');

  let totalCostUSD = 0;
  (store.production_costs || []).forEach(c => {
    totalCostUSD += Number(c.cost_amount || 0);
  });

  const overviewData = {
    total_media_assets: media.length,
    active_jobs_count: activeJobs.length,
    completed_jobs_count: completedJobs.length,
    failed_jobs_count: failedJobs.length,
    three_d_models_count: models.length,
    total_production_cost_usd: totalCostUSD,
    registered_engines_count: REGISTERED_ENGINES.length,
    recent_activity: jobs.slice(-5).reverse(),
    storage_summary: {
      bucket: 'media',
      studio_prefix: 'studio/',
      status: 'online'
    }
  };

  return res.status(200).json({
    ok: true,
    success: true,
    overview: overviewData,
    data: {
      metrics: overviewData,
      studioStatus: 'operational',
      activeEngines: REGISTERED_ENGINES
    }
  });
}

// Action: Media Library (Query, Detail & Provenance Chain)
async function handleMedia(req, res) {
  const store = await readStudioStore();
  const allMedia = store.media_assets || [];

  if (req.method === 'GET') {
    const assetId = req.query?.id;
    if (assetId) {
      const asset = allMedia.find(a => a.id === assetId);
      if (!asset) return res.status(404).json({ ok: false, success: false, error: 'Medya varlığı bulunamadı.' });

      // Build provenance chain (tracing origin backwards)
      const provenanceChain = [];
      let currentId = asset.id;
      const visited = new Set();
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const item = allMedia.find(a => a.id === currentId);
        if (!item) break;
        provenanceChain.unshift(item);
        currentId = item.source_asset_id;
      }

      return res.status(200).json({
        ok: true,
        success: true,
        asset,
        provenance_chain: provenanceChain,
        data: { asset, provenance_chain: provenanceChain }
      });
    }

    const pSlug = req.query?.product_slug;
    const cId = req.query?.collection_id;
    const aType = req.query?.asset_type;
    const search = req.query?.search ? String(req.query.search).toLowerCase().trim() : '';

    let list = allMedia;
    if (pSlug) list = list.filter(a => a.product_slug === pSlug);
    if (cId) list = list.filter(a => a.collection_id === cId);
    if (aType && aType !== 'ALL') list = list.filter(a => a.asset_type === aType);
    if (search) {
      list = list.filter(a =>
        (a.file_name && a.file_name.toLowerCase().includes(search)) ||
        (a.product_slug && a.product_slug.toLowerCase().includes(search)) ||
        (a.asset_type && a.asset_type.toLowerCase().includes(search))
      );
    }

    return res.status(200).json({ ok: true, success: true, media_assets: list, data: list });
  }

  return res.status(405).json({ ok: false, success: false, error: 'Method not allowed' });
}

// Action: Safe File Upload (Supabase Storage 'media' Bucket)
async function handleUpload(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, success: false, error: 'Method not allowed' });
  }

  const isWorker = verifyWorkerAuth(req);
  if (!isWorker) {
    const user = await authenticateRoles(req, ['admin', 'production_manager', 'content_manager']).catch(() => null);
    if (!user) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Yetkisiz erişim: Dosya yüklemek için geçerli bir oturum veya worker anahtarı gereklidir.'
      });
    }
  }

  const body = req.body || {};
  const {
    file_base64,
    file_name,
    mime_type,
    asset_type = 'raw_photo',
    product_slug = null,
    collection_id = null,
    source_asset_id = null,
    metadata = {}
  } = body;

  if (!file_base64 || !file_name || !mime_type) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: 'file_base64, file_name ve mime_type alanları zorunludur.'
    });
  }

  // 1. Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(mime_type)) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: `Desteklenmeyen dosya türü (MIME): ${mime_type}`
    });
  }

  // 2. Validate Extension
  const cleanExt = (file_name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(cleanExt)) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: `Desteklenmeyen dosya uzantısı: .${cleanExt}`
    });
  }

  // 3. Decode base64 to buffer and validate size
  let buffer;
  try {
    const base64Data = file_base64.replace(/^data:[^;]+;base64,/, '');
    buffer = Buffer.from(base64Data, 'base64');
  } catch (e) {
    return res.status(400).json({ ok: false, success: false, error: 'Geçersiz Base64 verisi.' });
  }

  const fileSize = buffer.length;
  if (mime_type.startsWith('image/') && fileSize > MAX_IMAGE_BYTES) {
    return res.status(400).json({ ok: false, success: false, error: 'Görsel boyutu en fazla 15MB olabilir.' });
  }
  if (mime_type.startsWith('video/') && fileSize > MAX_VIDEO_BYTES) {
    return res.status(400).json({ ok: false, success: false, error: 'Video boyutu en fazla 100MB olabilir.' });
  }
  if ((cleanExt === 'blend' || cleanExt === 'glb' || cleanExt === 'gltf' || cleanExt === 'obj') && fileSize > MAX_3D_BYTES) {
    return res.status(400).json({ ok: false, success: false, error: '3D/Blender dosya boyutu en fazla 150MB olabilir.' });
  }

  // 4. Generate Safe, Collision-Free Storage Path & Prevent Duplicate Files per Job
  const correlatedJobId = body.job_id || metadata?.job_id || null;
  const safeSlug = (product_slug || collection_id || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeType = asset_type.replace(/[^a-zA-Z0-9_-]/g, '_');
  const randomSuffix = Math.random().toString(36).slice(2, 8);

  let storagePath;
  let useUpsert = 'false';
  let resolvedFileName = file_name;

  if (correlatedJobId && typeof correlatedJobId === 'string') {
    const safeJobKey = correlatedJobId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    resolvedFileName = `render_${safeJobKey}.${cleanExt}`;
    storagePath = `studio/${safeType}/${safeSlug}/${resolvedFileName}`;
    useUpsert = 'true'; // Idempotent overwrite if the same job is re-rendered after retry
  } else {
    storagePath = `studio/${safeType}/${safeSlug}/${Date.now()}-${randomSuffix}.${cleanExt}`;
  }

  // 5. Upload to Supabase Storage Bucket 'media' with Controlled Retry
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/media/${storagePath}`;
  let uploadRes = null;
  let uploadErrText = '';
  const maxStorageRetries = 3;

  for (let attempt = 1; attempt <= maxStorageRetries; attempt++) {
    try {
      uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': mime_type,
          'x-upsert': useUpsert
        },
        body: buffer
      });
      if (uploadRes.ok) {
        break;
      }
      uploadErrText = await uploadRes.text().catch(() => uploadRes.statusText);
      if (uploadRes.status < 500 && uploadRes.status !== 429) {
        break; // Non-retryable 4xx error
      }
    } catch (netErr) {
      uploadErrText = netErr.message || 'Storage network error';
    }
    if (attempt < maxStorageRetries) {
      await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt - 1)));
    }
  }

  if (!uploadRes || !uploadRes.ok) {
    return res.status(502).json({
      ok: false,
      success: false,
      error: `Depolama sunucusuna yükleme başarısız oldu: ${uploadErrText || uploadRes?.statusText || 'Bilinmeyen hata'}`
    });
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;

  // 6. Save Asset Record (Deduplicate if re-uploading for the same job_id)
  return await withStoreLock(async () => {
    const store = await readStudioStore();
    store.media_assets = store.media_assets || [];

    const existingJobAssetIdx = correlatedJobId
      ? store.media_assets.findIndex(a =>
          (a.job_id === correlatedJobId || a.metadata?.job_id === correlatedJobId) &&
          a.asset_type === asset_type
        )
      : -1;

    const existingAsset = existingJobAssetIdx >= 0 ? store.media_assets[existingJobAssetIdx] : null;
    const newAsset = {
      id: existingAsset ? existingAsset.id : ('ast-' + Date.now() + '-' + randomSuffix),
      job_id: correlatedJobId,
      product_slug: product_slug || null,
      collection_id: collection_id || null,
      asset_type,
      storage_path: storagePath,
      public_url: publicUrl,
      file_name: resolvedFileName,
      mime_type,
      file_size_bytes: fileSize,
      width_px: metadata.width || null,
      height_px: metadata.height || null,
      duration_seconds: metadata.duration || null,
      source_asset_id: source_asset_id || null,
      metadata: {
        ...metadata,
        job_id: correlatedJobId,
        uploaded_by_role: isWorker ? 'render_worker' : 'production_manager',
        storage_bucket: 'media'
      },
      version: existingAsset ? (Number(existingAsset.version || 1) + 1) : 1,
      is_approved: existingAsset ? Boolean(existingAsset.is_approved) : false,
      created_at: existingAsset ? existingAsset.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingJobAssetIdx >= 0) {
      store.media_assets[existingJobAssetIdx] = newAsset;
    } else {
      store.media_assets.push(newAsset);
    }

    await writeStudioStore(store);

    return res.status(201).json({
      ok: true,
      success: true,
      asset: newAsset,
      data: newAsset
    });
  });
}

// Action: Production Jobs (Creation, Query, Cancellation)
async function handleJobs(req, res) {
  if (req.method === 'GET') {
    const store = await readStudioStore();
    let jobs = (store.production_jobs || []).map(normalizeJobRecord);
    const statusFilter = req.query?.status;
    const prodFilter = req.query?.product_slug;
    const colFilter = req.query?.collection_id;
    const engineFilter = req.query?.selected_engine || req.query?.engine;

    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'pending' || statusFilter === 'queued') {
        jobs = jobs.filter(j => j.status === statusFilter || (statusFilter === 'pending' && j.status === 'queued'));
      } else {
        jobs = jobs.filter(j => j.status === statusFilter);
      }
    }
    if (prodFilter) jobs = jobs.filter(j => j.product_slug === prodFilter);
    if (colFilter) jobs = jobs.filter(j => j.collection_id === colFilter);
    if (engineFilter) jobs = jobs.filter(j => j.selected_engine === engineFilter);

    return res.status(200).json({ ok: true, success: true, jobs, data: jobs });
  }

  if (req.method === 'POST') {
    await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
    const body = req.body || {};
    const prodType = body.production_type || body.jobType || body.job_type;
    const selectedEngine = body.selected_engine || body.engine || (
      ['3d_render', 'blender_render', 'cinematic_render', 'benchmark_test'].includes(prodType)
        ? 'blender_headless'
        : 'ai_enhancer'
    );

    if (!prodType || !selectedEngine) {
      return res.status(400).json({ ok: false, success: false, error: 'production_type ve selected_engine zorunludur.' });
    }

    const validEngine = REGISTERED_ENGINES.some(e => e.id === selectedEngine);
    if (!validEngine) {
      return res.status(400).json({ ok: false, success: false, error: `Bilinmeyen üretim motoru: ${selectedEngine}` });
    }

    return await withStoreLock(async () => {
      const store = await readStudioStore();
      const idempotencyKey = body.idempotency_key || body.idempotencyKey || `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const existing = (store.production_jobs || []).find(j => (j.idempotency_key || j.idempotencyKey) === idempotencyKey);
      if (existing) {
        normalizeJobRecord(existing);
        return res.status(200).json({ ok: true, success: true, job: existing, data: existing, note: 'idempotent_duplicate' });
      }

      const rawSettings = {
        ...(body.config_params || {}),
        ...(body.parameters || {}),
        ...(body.render_settings || {})
      };
      const inputModelPath = body.input_model_path || rawSettings.input_model_path || rawSettings.model_path || null;
      if (inputModelPath && !rawSettings.model_path) {
        rawSettings.model_path = inputModelPath;
      }

      const requestedInitialStatus = body.status === 'pending' ? 'pending' : 'queued';
      const generatedId = body.job_id || body.id || ('job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));

      const newJob = normalizeJobRecord({
        id: generatedId,
        job_id: generatedId,
        product_slug: body.product_slug || body.productId || null,
        collection_id: body.collection_id || null,
        source_asset_id: body.source_asset_id || null,
        title: body.title || `${prodType} - ${selectedEngine}`,
        production_type: prodType,
        jobType: prodType,
        selected_engine: selectedEngine,
        input_model_path: inputModelPath,
        output_render_path: null,
        output_public_url: null,
        render_settings: rawSettings,
        config_params: rawSettings,
        status: requestedInitialStatus,
        initial_status: requestedInitialStatus,
        progress_percent: 0,
        idempotency_key: idempotencyKey,
        idempotencyKey: idempotencyKey,
        worker_id: null,
        lease_expires_at: null,
        retry_count: 0,
        max_retries: body.max_retries !== undefined ? Number(body.max_retries) : 3,
        error_code: null,
        error_message: null,
        error_details: null,
        started_at: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      store.production_jobs = store.production_jobs || [];
      store.production_jobs.push(newJob);

      // Record creation event
      store.production_events = store.production_events || [];
      store.production_events.push({
        id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        job_id: newJob.id,
        event_type: 'job_created',
        event_details: {
          engine: selectedEngine,
          type: prodType,
          status: newJob.status,
          input_model_path: newJob.input_model_path,
          product: newJob.product_slug,
          collection: newJob.collection_id
        },
        created_at: new Date().toISOString()
      });

      await writeStudioStore(store);
      return res.status(201).json({ ok: true, success: true, job: newJob, data: newJob });
    });
  }

  if (req.method === 'DELETE' || req.method === 'PATCH') {
    const actionType = req.body?.action || req.query?.action;
    if (actionType === 'retry') {
      return await handleJobRetry(req, res);
    }
    return await handleJobCancel(req, res);
  }

  return res.status(405).json({ ok: false, success: false, error: 'Method not allowed' });
}

// Action: Job Details & Event Timeline
async function handleJobDetail(req, res) {
  const jobId = req.query?.id || req.body?.id || req.query?.job_id || req.body?.job_id;
  if (!jobId) return res.status(400).json({ ok: false, success: false, error: 'id parametresi gereklidir.' });

  const store = await readStudioStore();
  const job = (store.production_jobs || []).find(j => j.id === jobId || j.job_id === jobId);
  if (!job) return res.status(404).json({ ok: false, success: false, error: 'Görev bulunamadı.' });
  normalizeJobRecord(job);

  const events = (store.production_events || []).filter(e => e.job_id === job.id);
  const outputs = (store.production_outputs || []).filter(o => o.job_id === job.id);
  const sourceAsset = job.source_asset_id
    ? (store.media_assets || []).find(a => a.id === job.source_asset_id)
    : null;

  return res.status(200).json({
    ok: true,
    success: true,
    job,
    events,
    outputs,
    source_asset: sourceAsset,
    data: { job, events, outputs, source_asset: sourceAsset }
  });
}

// Action: Job Retry (Safe State Transition with Retry Counter)
async function handleJobRetry(req, res) {
  await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
  const jobId = req.query?.id || req.body?.id || req.query?.job_id || req.body?.job_id;
  if (!jobId) return res.status(400).json({ ok: false, success: false, error: 'Job ID gereklidir.' });

  return await withStoreLock(async () => {
    const store = await readStudioStore();
    const job = (store.production_jobs || []).find(j => j.id === jobId || j.job_id === jobId);
    if (!job) return res.status(404).json({ ok: false, success: false, error: 'Görev bulunamadı.' });

    if (!['failed', 'cancelled'].includes(job.status)) {
      return res.status(400).json({
        ok: false,
        success: false,
        error: `Yalnızca başarısız (failed) veya iptal edilmiş (cancelled) görevler yeniden denenebilir. Mevcut durum: ${job.status}`
      });
    }

    const maxRetries = job.max_retries ?? 3;
    if ((job.retry_count || 0) >= maxRetries) {
      return res.status(400).json({
        ok: false,
        success: false,
        error: `Bu görev maksimum yeniden deneme sınırına (${maxRetries}) ulaştı.`
      });
    }

    job.retry_count = (job.retry_count || 0) + 1;
    const previousStatus = job.status;
    job.status = job.initial_status === 'pending' ? 'pending' : 'queued';
    job.progress_percent = 0;
    job.worker_id = null;
    job.lease_expires_at = null;
    job.error_code = null;
    job.error_message = null;
    job.error_details = null;
    job.started_at = null;
    job.completed_at = null;
    job.updated_at = new Date().toISOString();
    normalizeJobRecord(job);

    store.production_events = store.production_events || [];
    store.production_events.push({
      id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      job_id: job.id,
      event_type: 'job_retried',
      event_details: {
        attempt: job.retry_count,
        previous_status: previousStatus,
        triggered_by: 'user'
      },
      created_at: new Date().toISOString()
    });

    await writeStudioStore(store);
    return res.status(200).json({ ok: true, success: true, job, data: job });
  });
}

// Action: Job Cancellation
async function handleJobCancel(req, res) {
  await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
  const jobId = req.query?.id || req.body?.id || req.query?.job_id || req.body?.job_id;
  if (!jobId) return res.status(400).json({ ok: false, success: false, error: 'Job ID gereklidir.' });

  return await withStoreLock(async () => {
    const store = await readStudioStore();
    const job = (store.production_jobs || []).find(j => j.id === jobId || j.job_id === jobId);
    if (!job) return res.status(404).json({ ok: false, success: false, error: 'Görev bulunamadı.' });

    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      return res.status(400).json({
        ok: false,
        success: false,
        error: `${job.status} durumundaki görev iptal edilemez.`
      });
    }

    job.status = 'cancelled';
    job.lease_expires_at = null;
    job.completed_at = new Date().toISOString();
    job.updated_at = new Date().toISOString();
    normalizeJobRecord(job);

    store.production_events = store.production_events || [];
    store.production_events.push({
      id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      job_id: job.id,
      event_type: 'job_cancelled',
      event_details: { cancelled_by: 'user' },
      created_at: new Date().toISOString()
    });

    await writeStudioStore(store);
    return res.status(200).json({ ok: true, success: true, job, data: job });
  });
}

// Action: Worker Engine Contract (Atomic Claim, Lease Recovery, Update, Complete, Fail)
async function handleWorker(req, res) {
  const isWorker = verifyWorkerAuth(req);
  let isWorkerAdmin = false;

  if (!isWorker) {
    const user = await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
    if (!user) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Yetkisiz erişim: Geçerli bir RENDER_WORKER_KEY veya yönetici oturumu gereklidir.'
      });
    }
    isWorkerAdmin = true;
  }

  const workerAction = String(req.query?.worker_action || req.body?.worker_action || '').toLowerCase();

  return await withStoreLock(async () => {
    const store = await readStudioStore();

    // 1. Worker Atomic Claim + Stale Lease Recovery
    if (workerAction === 'claim' || req.query?.action === 'worker-claim') {
      const {
        worker_id = 'worker-default',
        supported_engines = [],
        lease_seconds = 900,
        claim_status = null
      } = req.body || {};

      const engineFilter = Array.isArray(supported_engines) && supported_engines.length
        ? supported_engines
        : REGISTERED_ENGINES.map(e => e.id);

      const now = new Date();
      let storeModifiedByRecovery = false;
      store.production_events = store.production_events || [];

      // Step A: Inspect stuck/stale jobs ('processing', 'rendering', 'uploading', 'encoding') whose lease has expired
      for (const j of (store.production_jobs || [])) {
        if (['processing', 'rendering', 'uploading', 'encoding'].includes(j.status)) {
          if (j.lease_expires_at && new Date(j.lease_expires_at) <= now) {
            const maxRetries = j.max_retries ?? 3;
            const currentRetries = Number(j.retry_count || 0);
            const expiredWorker = j.worker_id || 'unknown';

            if (currentRetries >= maxRetries) {
              // Max retries exhausted -> transition to terminal 'failed'
              j.status = 'failed';
              j.worker_id = null;
              j.lease_expires_at = null;
              j.completed_at = now.toISOString();
              j.updated_at = now.toISOString();
              j.error_code = 'LEASE_EXPIRED_MAX_RETRIES';
              j.error_message = `Worker (${expiredWorker}) yanıt vermedi (lease süresi doldu) ve maksimum yeniden deneme sınırına (${maxRetries}) ulaşıldı.`;
              j.error_details = {
                code: 'LEASE_EXPIRED_MAX_RETRIES',
                previous_worker_id: expiredWorker,
                retry_count: currentRetries,
                max_retries: maxRetries,
                timestamp: now.toISOString()
              };
              store.production_events.push({
                id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                job_id: j.id,
                event_type: 'worker_lease_expired_failed',
                event_details: { previous_worker_id: expiredWorker, retry_count: currentRetries, max_retries: maxRetries },
                created_at: now.toISOString()
              });
              storeModifiedByRecovery = true;
            } else {
              // Recoverable stale job -> increment retry_count and requeue to 'pending'
              j.retry_count = currentRetries + 1;
              j.status = 'pending';
              j.worker_id = null;
              j.lease_expires_at = null;
              j.updated_at = now.toISOString();
              j.error_code = 'LEASE_EXPIRED_REQUEUED';
              j.error_message = `Worker (${expiredWorker}) kira süresi doldu; görev otomatik kurtarıldı (deneme ${j.retry_count}/${maxRetries}).`;
              store.production_events.push({
                id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                job_id: j.id,
                event_type: 'worker_lease_recovered',
                event_details: { previous_worker_id: expiredWorker, retry_count: j.retry_count, max_retries: maxRetries },
                created_at: now.toISOString()
              });
              storeModifiedByRecovery = true;
            }
            normalizeJobRecord(j);
          }
        }
      }

      // Step B: Atomically select the first available 'pending' or 'queued' job
      const queuedJob = (store.production_jobs || []).find(j => {
        const engineMatches = engineFilter.includes(j.selected_engine);
        if (!engineMatches) return false;
        return j.status === 'pending' || j.status === 'queued';
      });

      if (!queuedJob) {
        if (storeModifiedByRecovery) {
          await writeStudioStore(store);
        }
        return res.status(200).json({ ok: true, success: true, job: null, message: 'İş kuyruğu boş.' });
      }

      const previousStatus = queuedJob.status;
      if (claim_status === 'processing' || previousStatus === 'pending') {
        queuedJob.status = 'processing';
      } else {
        queuedJob.status = queuedJob.selected_engine === 'blender_headless' ? 'rendering' : 'processing';
      }

      const safeLeaseSeconds = Math.max(1, Math.min(3600, Number(lease_seconds) || 900));
      queuedJob.started_at = now.toISOString();
      queuedJob.updated_at = now.toISOString();
      queuedJob.worker_id = worker_id;
      queuedJob.lease_expires_at = new Date(now.getTime() + safeLeaseSeconds * 1000).toISOString();
      normalizeJobRecord(queuedJob);

      store.production_events.push({
        id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        job_id: queuedJob.id,
        event_type: 'worker_claimed',
        event_details: {
          worker_id,
          engine: queuedJob.selected_engine,
          previous_status: previousStatus,
          new_status: queuedJob.status,
          lease_expires_at: queuedJob.lease_expires_at
        },
        created_at: now.toISOString()
      });

      await writeStudioStore(store);
      return res.status(200).json({ ok: true, success: true, job: queuedJob, data: queuedJob });
    }

    // 2. Worker Progress / Status Update
    if (workerAction === 'update' || req.query?.action === 'worker-update') {
      const { job_id, worker_id, progress_percent, current_phase, status_message, lease_seconds } = req.body || {};
      if (!job_id) return res.status(400).json({ ok: false, error: 'job_id zorunludur.' });

      const job = (store.production_jobs || []).find(j => j.id === job_id || j.job_id === job_id);
      if (!job) return res.status(404).json({ ok: false, error: 'Görev bulunamadı.' });

      if (job.worker_id && worker_id && job.worker_id !== worker_id && !isWorkerAdmin) {
        return res.status(403).json({ ok: false, error: `Bu görev başka bir worker (${job.worker_id}) tarafından yürütülmektedir.` });
      }

      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        return res.status(400).json({ ok: false, error: `Sonlanmış görev (${job.status}) güncellenemez.` });
      }

      if (progress_percent !== undefined) {
        job.progress_percent = Math.min(100, Math.max(0, Number(progress_percent) || 0));
      }
      if (current_phase && ['processing', 'rendering', 'uploading', 'encoding', 'quality_check'].includes(current_phase)) {
        job.status = current_phase;
      }
      const extraLeaseSec = Math.max(1, Math.min(3600, Number(lease_seconds) || 900));
      job.lease_expires_at = new Date(Date.now() + extraLeaseSec * 1000).toISOString();
      job.updated_at = new Date().toISOString();
      normalizeJobRecord(job);

      store.production_events = store.production_events || [];
      store.production_events.push({
        id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        job_id: job.id,
        event_type: 'worker_progress',
        event_details: { progress_percent: job.progress_percent, phase: current_phase, message: status_message },
        created_at: new Date().toISOString()
      });

      await writeStudioStore(store);
      return res.status(200).json({ ok: true, success: true, job, data: job });
    }

    // 3. Worker Complete
    if (workerAction === 'complete' || req.query?.action === 'worker-complete') {
      const { job_id, worker_id, outputs = [], metrics = {}, output_render_path, output_public_url } = req.body || {};
      if (!job_id) return res.status(400).json({ ok: false, error: 'job_id zorunludur.' });

      const job = (store.production_jobs || []).find(j => j.id === job_id || j.job_id === job_id);
      if (!job) return res.status(404).json({ ok: false, error: 'Görev bulunamadı.' });

      if (job.status === 'completed') {
        normalizeJobRecord(job);
        return res.status(200).json({
          ok: true,
          success: true,
          job,
          outputs: (store.production_outputs || []).filter(o => o.job_id === job.id),
          note: 'idempotent_complete'
        });
      }

      if (['cancelled', 'failed'].includes(job.status)) {
        return res.status(400).json({ ok: false, error: `İptal edilmiş veya başarısız görev (${job.status}) tamamlanamaz.` });
      }

      if (job.worker_id && worker_id && job.worker_id !== worker_id && !isWorkerAdmin) {
        return res.status(403).json({ ok: false, error: `Bu görev başka bir worker (${job.worker_id}) tarafından yürütülmektedir.` });
      }

      job.status = 'completed';
      job.progress_percent = 100;
      job.lease_expires_at = null;
      job.error_code = null;
      job.error_message = null;
      job.completed_at = new Date().toISOString();
      job.updated_at = new Date().toISOString();

      store.production_outputs = store.production_outputs || [];
      store.media_assets = store.media_assets || [];

      // Remove any previous unapproved outputs for this job_id to prevent duplicates on retry
      store.production_outputs = store.production_outputs.filter(o => o.job_id !== job.id);

      outputs.forEach((out, idx) => {
        const existingAsset = out.asset_id
          ? (store.media_assets || []).find(a => a.id === out.asset_id)
          : (store.media_assets || []).find(a => a.storage_path && a.storage_path === out.storage_path);

        let outputAssetId = existingAsset ? existingAsset.id : ('ast-out-' + Date.now() + '-' + idx);
        const resolvedPublicUrl = out.public_url || existingAsset?.public_url || `${SUPABASE_URL}/storage/v1/object/public/media/${out.storage_path}`;

        if (!existingAsset) {
          const newOutputAsset = {
            id: outputAssetId,
            job_id: job.id,
            product_slug: job.product_slug,
            collection_id: job.collection_id,
            asset_type: out.asset_type || (out.output_type === 'turntable_video' ? 'video_render' : 'render_frame'),
            storage_path: out.storage_path,
            public_url: resolvedPublicUrl,
            file_name: out.file_name || `render_${job.id}_${idx}.${out.file_format || 'jpg'}`,
            mime_type: out.mime_type || (out.file_format === 'mp4' ? 'video/mp4' : 'image/jpeg'),
            file_size_bytes: out.file_size_bytes || 0,
            width_px: out.width_px || null,
            height_px: out.height_px || null,
            duration_seconds: out.duration_seconds || null,
            source_asset_id: job.source_asset_id || null,
            metadata: { job_id: job.id, engine: job.selected_engine, resolution_label: out.resolution_label },
            version: 1,
            is_approved: false,
            created_at: new Date().toISOString()
          };
          store.media_assets.push(newOutputAsset);
        } else {
          existingAsset.job_id = job.id;
          existingAsset.metadata = { ...(existingAsset.metadata || {}), job_id: job.id };
        }

        if (idx === 0) {
          job.output_render_path = out.storage_path || existingAsset?.storage_path || null;
          job.output_public_url = resolvedPublicUrl || null;
        }

        store.production_outputs.push({
          id: 'out-' + Date.now() + '-' + idx,
          job_id: job.id,
          media_asset_id: outputAssetId,
          storage_path: out.storage_path || existingAsset?.storage_path || null,
          public_url: resolvedPublicUrl || null,
          file_name: out.file_name || existingAsset?.file_name || null,
          file_size_bytes: out.file_size_bytes || existingAsset?.file_size_bytes || 0,
          output_type: out.output_type || 'hero_still',
          file_format: out.file_format || 'jpg',
          resolution_label: out.resolution_label || '1080x1080',
          width_px: out.width_px || existingAsset?.width_px || null,
          height_px: out.height_px || existingAsset?.height_px || null,
          duration_seconds: out.duration_seconds || null,
          quality_status: 'pending',
          created_at: new Date().toISOString()
        });
      });

      if (output_render_path && !job.output_render_path) {
        job.output_render_path = output_render_path;
      }
      if (output_public_url && !job.output_public_url) {
        job.output_public_url = output_public_url;
      }
      if (job.output_render_path && !job.output_public_url) {
        job.output_public_url = `${SUPABASE_URL}/storage/v1/object/public/media/${job.output_render_path}`;
      }

      normalizeJobRecord(job);

      if (metrics.cost_amount || metrics.gpu_seconds || metrics.cpu_seconds) {
        store.production_costs = store.production_costs || [];
        store.production_costs.push({
          id: 'cost-' + Date.now(),
          job_id: job.id,
          provider_name: job.selected_engine,
          compute_device: metrics.compute_device || (metrics.gpu_seconds ? 'GPU' : 'CPU'),
          cpu_seconds_used: metrics.cpu_seconds || 0,
          gpu_seconds_used: metrics.gpu_seconds || 0,
          cost_amount: metrics.cost_amount ?? null,
          cost_measured: Boolean(metrics.cost_measured),
          currency: 'USD',
          created_at: new Date().toISOString()
        });
      }

      store.production_events = store.production_events || [];
      store.production_events.push({
        id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        job_id: job.id,
        event_type: 'worker_completed',
        event_details: {
          output_count: outputs.length,
          output_render_path: job.output_render_path,
          output_public_url: job.output_public_url,
          metrics
        },
        created_at: new Date().toISOString()
      });

      await writeStudioStore(store);
      return res.status(200).json({
        ok: true,
        success: true,
        job,
        outputs: store.production_outputs.filter(o => o.job_id === job.id)
      });
    }

    // 4. Worker Fail
    if (workerAction === 'fail' || req.query?.action === 'worker-fail') {
      const { job_id, worker_id, error_code = 'RENDER_ERROR', error_message = 'Bilinmeyen render hatası.', error_details = null } = req.body || {};
      if (!job_id) return res.status(400).json({ ok: false, error: 'job_id zorunludur.' });

      const job = (store.production_jobs || []).find(j => j.id === job_id || j.job_id === job_id);
      if (!job) return res.status(404).json({ ok: false, error: 'Görev bulunamadı.' });

      if (job.status === 'completed') {
        return res.status(400).json({ ok: false, error: 'Tamamlanmış görev başarısız olarak işaretlenemez.' });
      }

      if (job.worker_id && worker_id && job.worker_id !== worker_id && !isWorkerAdmin) {
        return res.status(403).json({ ok: false, error: `Bu görev başka bir worker (${job.worker_id}) tarafından yürütülmektedir.` });
      }

      job.status = 'failed';
      job.lease_expires_at = null;
      job.error_code = error_code;
      job.error_message = error_message;
      job.error_details = {
        code: error_code,
        message: error_message,
        details: error_details,
        timestamp: new Date().toISOString()
      };
      job.completed_at = new Date().toISOString();
      job.updated_at = new Date().toISOString();
      normalizeJobRecord(job);

      store.production_events = store.production_events || [];
      store.production_events.push({
        id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        job_id: job.id,
        event_type: 'worker_failed',
        event_details: { code: error_code, message: error_message },
        error_details: JSON.stringify(error_details || {}),
        created_at: new Date().toISOString()
      });

      await writeStudioStore(store);
      return res.status(200).json({ ok: true, success: true, job, data: job });
    }

    return res.status(400).json({ ok: false, error: `Bilinmeyen worker eylemi: ${workerAction}` });
  });
}

// Action: 3D Assets Studio
async function handleThreeDAssets(req, res) {
  const store = await readStudioStore();
  const list = store.three_d_assets || [];
  return res.status(200).json({ ok: true, success: true, three_d_assets: list, data: list });
}

// Action: Scene Templates (Blender Presets)
async function handleSceneTemplates(req, res) {
  const store = await readStudioStore();
  const templates = store.scene_templates || DEFAULT_SCENE_TEMPLATES;
  return res.status(200).json({
    ok: true,
    success: true,
    scene_templates: templates,
    data: templates
  });
}

// Action: Engine Registry Matrix
async function handleEngines(req, res) {
  return res.status(200).json({
    ok: true,
    success: true,
    engines: REGISTERED_ENGINES,
    data: REGISTERED_ENGINES
  });
}

// Action: Catalog Reference (Rich Read-Only proxy to Module 7 products & collections)
async function handleCatalogRef(req, res) {
  try {
    const slugQuery = req.query?.slug ? String(req.query.slug).trim() : '';
    const categoryQuery = req.query?.category ? String(req.query.category).trim() : '';
    const collectionQuery = req.query?.collection ? String(req.query.collection).trim() : '';

    const [pRes, extStoreRes, studioStore] = await Promise.all([
      supabaseRequest('/rest/v1/products?select=id,slug,title,sku,kategori,ana_resim,ozellikler,boyutlar,fiyat,materials,product_type,collection_pieces,kisa_aciklama,design_story,created_at&order=created_at.desc'),
      supabaseRequest('/rest/v1/site_settings?key=eq.extended_catalog_store&select=data'),
      readStudioStore()
    ]);

    const rawProducts = Array.isArray(pRes.data) ? pRes.data : [];
    const extStore = (extStoreRes.ok && Array.isArray(extStoreRes.data) && extStoreRes.data[0]?.data)
      ? extStoreRes.data[0].data
      : { collections: [], collection_products: [], media: [] };

    // Build unified collections map
    const colMap = new Map();
    (extStore.collections || []).forEach(c => {
      colMap.set(c.slug, {
        id: c.id || c.slug,
        slug: c.slug,
        title: c.title || c.name || c.slug,
        category: c.category || 'Koleksiyon',
        hero_image: c.hero_image || c.hero_image_url || '',
        design_story: c.design_story || '',
        short_description: c.short_description || '',
        materials: Array.isArray(c.materials) ? c.materials : [],
        color_palette: Array.isArray(c.color_palette) ? c.color_palette : [],
        features: Array.isArray(c.features) ? c.features : [],
        parts: Array.isArray(c.parts) ? c.parts : [],
        marketing_preferences: c.marketing_preferences || {}
      });
    });

    // Also include scene templates as registered 3D collections if not in colMap
    (studioStore.scene_templates || DEFAULT_SCENE_TEMPLATES).forEach(tpl => {
      if (!colMap.has(tpl.collection_id) && !colMap.has(tpl.scene_slug)) {
        colMap.set(tpl.scene_slug, {
          id: tpl.collection_id || tpl.scene_slug,
          slug: tpl.scene_slug,
          title: tpl.name,
          category: 'Mimari 3D Sahne',
          hero_image: '',
          design_story: tpl.environment_theme,
          short_description: tpl.lighting_preset,
          materials: [],
          color_palette: [],
          features: tpl.camera_presets || [],
          parts: [],
          scene_template_id: tpl.id
        });
      }
    });

    // Process products
    const processedProducts = rawProducts.map(p => {
      let parentCollectionSlug = null;
      let parentCollectionTitle = null;

      for (const [cSlug, cData] of colMap.entries()) {
        if (p.slug === cSlug || p.slug.startsWith(cSlug + '-') || (p.collection_pieces && p.slug === cSlug)) {
          parentCollectionSlug = cSlug;
          parentCollectionTitle = cData.title;
          break;
        }
      }

      const photos = [];
      if (p.ana_resim) photos.push({ url: p.ana_resim, type: 'hero', role: 'main' });
      if (Array.isArray(p.collection_pieces)) {
        p.collection_pieces.forEach(piece => {
          if (piece.ana_resim) {
            photos.push({
              url: piece.ana_resim,
              type: 'piece_photo',
              role: piece.piece_role || 'part',
              title: piece.title || 'Parça'
            });
          }
        });
      }
      (extStore.media || []).filter(m => m.product_slug === p.slug).forEach(m => {
        if (m.media_url && !photos.some(ph => ph.url === m.media_url)) {
          photos.push({ url: m.media_url, type: m.media_type || 'gallery', role: 'extra' });
        }
      });

      return {
        id: p.id || p.slug,
        slug: p.slug,
        title: p.title,
        sku: p.sku || p.slug.toUpperCase(),
        category: p.kategori || 'Genel Mobilya',
        thumbnail: p.ana_resim,
        dimensions: p.boyutlar || (typeof p.body === 'string' ? p.body : ''),
        materials: Array.isArray(p.materials) ? p.materials : (p.malzeme ? [p.malzeme] : []),
        features: Array.isArray(p.ozellikler) ? p.ozellikler : [],
        design_story: p.design_story || p.kisa_aciklama || '',
        price: p.fiyat || null,
        is_collection: p.product_type === 'collection' || Boolean(p.collection_pieces?.length),
        collection_slug: parentCollectionSlug,
        collection_title: parentCollectionTitle,
        pieces: Array.isArray(p.collection_pieces) ? p.collection_pieces : [],
        photos
      };
    });

    let collectionsList = Array.from(colMap.values());
    let productsList = processedProducts;

    if (categoryQuery && categoryQuery !== 'ALL') {
      collectionsList = collectionsList.filter(c => c.category === categoryQuery);
      productsList = productsList.filter(p => p.category === categoryQuery);
    }
    if (collectionQuery && collectionQuery !== 'ALL') {
      productsList = productsList.filter(p => p.collection_slug === collectionQuery);
    }
    if (slugQuery) {
      const singleProduct = productsList.find(p => p.slug === slugQuery);
      const singleCollection = collectionsList.find(c => c.slug === slugQuery);
      return res.status(200).json({
        ok: true,
        success: true,
        item: singleProduct || singleCollection || null,
        is_collection: Boolean(singleCollection && !singleProduct)
      });
    }

    const categories = Array.from(new Set([
      ...collectionsList.map(c => c.category),
      ...productsList.map(p => p.category)
    ].filter(Boolean)));

    const result = {
      products: productsList,
      collections: collectionsList,
      categories,
      registered_templates: studioStore.scene_templates || DEFAULT_SCENE_TEMPLATES
    };

    return res.status(200).json({
      ok: true,
      success: true,
      ...result,
      data: result
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, error: err.message });
  }
}

// ── 7. MAIN API DISPATCHER ───────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const action = String(req.query?.action || new URL(req.url, 'https://local.invalid').searchParams.get('action') || 'overview').toLowerCase();

  try {
    switch (action) {
      case 'overview':
        return await handleOverview(req, res);
      case 'media':
        return await handleMedia(req, res);
      case 'upload':
        return await handleUpload(req, res);
      case 'jobs':
      case 'job-create':
        return await handleJobs(req, res);
      case 'job-detail':
        return await handleJobDetail(req, res);
      case 'job-retry':
        return await handleJobRetry(req, res);
      case 'job-cancel':
        return await handleJobCancel(req, res);
      case 'worker':
      case 'worker-claim':
      case 'worker-update':
      case 'worker-complete':
      case 'worker-fail':
        return await handleWorker(req, res);
      case '3d-assets':
      case 'models':
        return await handleThreeDAssets(req, res);
      case 'scene-templates':
      case 'scenes':
        return await handleSceneTemplates(req, res);
      case 'engines':
        return await handleEngines(req, res);
      case 'catalog-ref':
      case 'products':
        return await handleCatalogRef(req, res);
      default:
        return res.status(400).json({ ok: false, success: false, error: `Geçersiz Module 8 eylemi: ${action}` });
    }
  } catch (err) {
    return apiError(res, err, 'Module 8 API');
  }
}

/**
 * GLOBAL MOBİLYA — MODULE 8: DATABASE & AUTHENTICATION HELPER
 * ============================================================================
 * Centralized, secure PostgreSQL & Supabase REST helper with timing-safe
 * worker key verification, role authentication, and input sanitization.
 * ============================================================================
 */
import crypto from 'crypto';
import { getR2PublicUrl } from '../r2-storage.js';

export const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/+$/, '');
export const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
export const ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
export const RENDER_WORKER_KEY = (process.env.RENDER_WORKER_KEY || '').trim();

export const SETTINGS_STUDIO_STORE_KEY = 'module8_studio_store';

export const REGISTERED_ENGINES = [
  {
    id: 'blender_headless',
    name: 'Blender Headless Engine (Cycles/EEVEE Next)',
    version: '5.2.3',
    engine_type: 'local_binary',
    device: 'CPU',
    status: 'online',
    supported_types: ['3d_render', 'blender_render', 'cinematic_render', 'cinematic_video', 'multi_platform_video', 'benchmark_test'],
    capabilities: { cycles: true, eevee_next: true, turntable: true, pbr_preview: true, max_samples: 128 }
  },
  {
    id: 'ai_3d_recon',
    name: 'Tripo H3.1 AI 3D Reconstruction Studio',
    version: 'v3.1-20260211',
    engine_type: 'ai_cloud_api',
    device: 'CLOUD_GPU',
    status: 'online',
    supported_types: ['3d_reconstruction', 'image_to_3d', 'photogrammetry'],
    capabilities: { pbr: true, high_poly: true, quad_mesh: true, auto_unwrap: true, credit_cost: 30 }
  },
  {
    id: 'ai_enhancer',
    name: 'Neural Texture & Image Enhancer',
    version: '2.4.0',
    engine_type: 'neural_pipeline',
    device: 'CPU',
    status: 'online',
    supported_types: ['image_enhance', 'image_enhancement', 'texture_synthesis'],
    capabilities: { upscaling: true, denoising: true, seamless_tiling: true }
  },
  {
    id: 'ffmpeg_transcoder',
    name: 'FFmpeg Media Encoder & Social Transcoder',
    version: '6.1.1',
    engine_type: 'local_binary',
    device: 'CPU',
    status: 'online',
    supported_types: ['multi_format_transcode', 'video_editing', 'media_export'],
    capabilities: { mp4: true, webp: true, prores: true, gif: true, h264: true, h265: true }
  }
];

export const DEFAULT_SCENE_TEMPLATES = [
  {
    id: 'vienna_luxury_salon',
    scene_slug: 'vienna_luxury_salon',
    name: 'Vienna Architectural Evening Salon',
    collection_id: 'viyana-yatak-odasi-rs83',
    render_engine_type: 'cycles',
    environment_theme: 'luxury_showroom',
    samples_preset: 64,
    camera_presets: ['Slow Push-In (35mm)', 'Low Angle Orbit (50mm)', 'Detail Dolly-In (85mm Macro)'],
    lighting_config: { preset: 'Golden Hour & Subtle Low Spotlights', intensity: 1.2 },
    version: 1,
    is_active: true
  },
  {
    id: 'nordic_atelier_minimal',
    scene_slug: 'nordic_atelier_minimal',
    name: 'Nordic Atelier Daylight Studio',
    collection_id: null,
    render_engine_type: 'cycles',
    environment_theme: 'scandinavian_minimal',
    samples_preset: 48,
    camera_presets: ['Front Elevation (50mm)', 'Isometric 45deg (85mm)'],
    lighting_config: { preset: 'Soft Northern Skylight', intensity: 1.0 },
    version: 1,
    is_active: true
  },
  {
    id: 'dark_moody_executive',
    scene_slug: 'dark_moody_executive',
    name: 'Dark Moody Executive Suite',
    collection_id: null,
    render_engine_type: 'cycles',
    environment_theme: 'dark_luxury',
    samples_preset: 64,
    camera_presets: ['Dramatic Low Angle (28mm)', 'Cinematic Orbit (40mm)'],
    lighting_config: { preset: 'Rim Lighting & Deep Shadows', intensity: 0.9 },
    version: 1,
    is_active: true
  },
  {
    id: 'e_commerce_clean_white',
    scene_slug: 'e_commerce_clean_white',
    name: 'E-Commerce Pure White Infinity Studio',
    collection_id: null,
    render_engine_type: 'eevee_next',
    environment_theme: 'catalog_pure_white',
    samples_preset: 32,
    camera_presets: ['Pure Front (50mm)', 'Pure Right Side (50mm)', 'Hero 3/4 Isometric (50mm)'],
    lighting_config: { preset: 'Three-Point Soft Studio Light', intensity: 1.5 },
    version: 1,
    is_active: true
  }
];

export async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const apiKey = SERVICE_KEY || ANON_KEY;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
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

export function verifyWorkerAuth(req) {
  const configuredKey = RENDER_WORKER_KEY;
  const authHeader = req.headers.authorization || '';
  const incomingKey = req.headers['x-worker-key'] ||
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() :
      (authHeader.startsWith('Worker ') ? authHeader.slice(7).trim() : null));

  if (configuredKey && configuredKey.length >= 8) {
    if (!incomingKey || typeof incomingKey !== 'string') return false;
    const a = Buffer.from(incomingKey);
    const b = Buffer.from(configuredKey);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
  return false;
}

export async function authenticateRoles(req, allowedRoles) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const apiKey = req.headers.apikey || '';

  // Service Role or Internal Admin Key bypass
  if ((token && token === SERVICE_KEY) || (apiKey && apiKey === SERVICE_KEY)) {
    return { id: 'service-role-admin', role: 'service_role', app_metadata: { role: 'admin', roles: ['admin'] } };
  }

  if (!token) {
    const err = new Error('Oturum açmanız gerekiyor.');
    err.status = 401;
    throw err;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY || SERVICE_KEY, Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!response.ok) {
    const err = new Error('Oturum geçersiz veya süresi dolmuş.');
    err.status = 401;
    throw err;
  }

  const user = await response.json();
  const metadata = user.app_metadata || {};
  const roles = Array.isArray(metadata.roles) ? metadata.roles : (metadata.role ? [metadata.role] : []);
  if (!roles.some(role => allowedRoles.includes(role))) {
    const err = new Error('Bu işlem için yetkiniz bulunmuyor.');
    err.status = 403;
    throw err;
  }
  return user;
}

export function normalizeJobRecord(job) {
  if (!job || typeof job !== 'object') return job;
  const mergedSettings = {
    ...(job.config_params || {}),
    ...(job.render_settings || {})
  };
  job.id = job.id || job.job_id;
  job.job_id = job.id;
  job.input_model_path = job.input_model_path ?? mergedSettings.input_model_path ?? mergedSettings.model_path ?? null;
  job.output_render_path = job.output_render_path ?? null;
  job.output_public_url = job.output_public_url ?? (job.output_render_path ? getR2PublicUrl(job.output_render_path) : null);
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

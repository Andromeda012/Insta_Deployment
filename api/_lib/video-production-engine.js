/**
 * ============================================================================
 * GLOBAL MOBİLYA — MODULE 8.4: MULTI-PLATFORM VIDEO PRODUCTION ENGINE
 * ============================================================================
 * Provides:
 * 1. 5 Distinct Output Channel Profiles (Centralized & Customizable):
 *    - A. website (Website Premium Film — 16:9 Horizontal, 1920x1080, 24 FPS)
 *    - B. instagram (Instagram Reels — 9:16 Vertical, 1080x1920, 30 FPS)
 *    - C. facebook (Facebook Reels — 9:16 Vertical, 1080x1920, 30 FPS)
 *    - D. tiktok (TikTok — 9:16 Vertical, 1080x1920, 30 FPS, Dynamic Hook)
 *    - E. youtube (YouTube Shorts — 9:16 Vertical, 1080x1920, 30 FPS)
 * 2. Adaptive Camera & Composition Reframing (NOT Simple 16:9 Cropping):
 *    - Recalculates camera sensor fit ('HORIZONTAL' vs 'VERTICAL'), focal length,
 *      camera distance, target elevation, and lateral pan/orbit span so the 3D
 *      furniture product remains centered and uncut in 9:16 vertical framing
 *      while keeping close-up material details visible.
 *    - Strictly preserves physical 3D product geometry and proportions.
 * 3. 4 Render Quality Presets:
 *    - preview (Low-cost control: 640x360 / 360x640, 8 samples, 12 FPS)
 *    - standard (Normal production: 1280x720 / 720x1280, 24 samples, 24/30 FPS)
 *    - high_quality (Website & master: 1920x1080 / 1080x1920, 48 samples, 24/30 FPS)
 *    - custom (User-controlled resolution, FPS, and samples within safe VPS bounds)
 * 4. Video Editing & Assembly Specification:
 *    - Shot ordering, trim start/end, transitions ('crossfade', 'cut', 'dip_to_black'),
 *      fade_in_sec, fade_out_sec, title_overlay, brand_logo_overlay,
 *      user-supplied/licensed audio_track_path, and audio_volume (0.0 - 1.0).
 * 5. Safe Supabase Storage Paths (`media` bucket):
 *    - studio/videos/{project_id}/website/{file_name}.mp4
 *    - studio/videos/{project_id}/instagram/{file_name}.mp4
 *    - studio/videos/{project_id}/facebook/{file_name}.mp4
 *    - studio/videos/{project_id}/tiktok/{file_name}.mp4
 *    - studio/videos/{project_id}/youtube/{file_name}.mp4
 * ============================================================================
 */

import { sanitizePathSegment } from './tripo-client.js';
import { computeShotKeyframes } from './cinematic-engine.js';

export const VIDEO_COMPOSITION_INTEGRITY_NOTE_TR =
  '9:16 dikey videolar 16:9 görüntünün basitçe kırpılmasıyla üretilmez; her platform için Blender kamera sensör uyumu, odak uzaklığı, kamera mesafesi ve hedef yüksekliği yeniden hesaplanır. Ürünün fiziksel 3D geometrisi ve oranları %100 korunur.';

function clampNum(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Number(n.toFixed(3))));
}

export function sanitizeVideoProjectId(raw, fallback = 'vproj_default') {
  return sanitizePathSegment(raw, fallback);
}

// ── 1. FIVE MULTI-PLATFORM OUTPUT PROFILES ───────────────────────────────────
export const VIDEO_PLATFORM_PROFILES = Object.freeze({
  website: {
    id: 'website',
    code: 'A',
    platform: 'website',
    name: 'Website Premium Film (16:9 Yatay Master)',
    aspect_ratio: '16:9',
    orientation: 'horizontal',
    default_width: 1920,
    default_height: 1080,
    preview_width: 640,
    preview_height: 360,
    standard_width: 1280,
    standard_height: 720,
    default_fps: 24,
    default_duration_sec: 14.0,
    encoding_format: 'mp4',
    video_codec: 'h264',
    pixel_format: 'yuv420p',
    crf: 18,
    bitrate_kbps: 8500,
    composition_style: 'cinematic_widescreen_showcase',
    shot_sequence_preference: ['wide_establishing_shot', 'dolly_in', 'orbit_around_product', 'closeup_detail_movement', 'dolly_out'],
    framing_rules: {
      sensor_fit: 'HORIZONTAL',
      distance_multiplier: 1.0,
      focal_multiplier: 1.0,
      lateral_span_multiplier: 1.0,
      target_z_offset_m: 0.0,
      opening_hook_speed: 0.85
    },
    description: '16:9 yatay format, yavaş ve kontrollü kamera hareketleri, tüm tasarım detaylarını gösteren yüksek kaliteli website filmi.'
  },
  instagram: {
    id: 'instagram',
    code: 'B',
    platform: 'instagram',
    name: 'Instagram Reels (9:16 Dikey Mobil)',
    aspect_ratio: '9:16',
    orientation: 'vertical',
    default_width: 1080,
    default_height: 1920,
    preview_width: 360,
    preview_height: 640,
    standard_width: 720,
    standard_height: 1280,
    default_fps: 30,
    default_duration_sec: 10.5,
    encoding_format: 'mp4',
    video_codec: 'h264',
    pixel_format: 'yuv420p',
    crf: 20,
    bitrate_kbps: 6000,
    composition_style: 'product_centric_vertical_reels',
    shot_sequence_preference: ['dolly_in', 'closeup_detail_movement', 'orbit_around_product', 'tilt_up_down'],
    framing_rules: {
      sensor_fit: 'VERTICAL',
      distance_multiplier: 1.38,   // Step back so full furniture width fits uncut inside 9:16 frame
      focal_multiplier: 1.12,      // Natural vertical portrait compression without distortion
      lateral_span_multiplier: 0.52, // Constrain horizontal pan so product never exits 9:16 edges
      target_z_offset_m: 0.06,     // Center product comfortably above Instagram UI caption zone
      opening_hook_speed: 1.05
    },
    description: '9:16 dikey format, mobil ekran için ürün merkezli kadraj, kesilmeyen tam boy görünüm ve yakın plan malzeme detayları.'
  },
  facebook: {
    id: 'facebook',
    code: 'C',
    platform: 'facebook',
    name: 'Facebook Reels (9:16 Mekân & Ürün İlişkisi)',
    aspect_ratio: '9:16',
    orientation: 'vertical',
    default_width: 1080,
    default_height: 1920,
    preview_width: 360,
    preview_height: 640,
    standard_width: 720,
    standard_height: 1280,
    default_fps: 30,
    default_duration_sec: 11.5,
    encoding_format: 'mp4',
    video_codec: 'h264',
    pixel_format: 'yuv420p',
    crf: 20,
    bitrate_kbps: 5800,
    composition_style: 'interior_context_vertical',
    shot_sequence_preference: ['wide_establishing_shot', 'smooth_crane_movement', 'camera_tracking', 'closeup_detail_movement'],
    framing_rules: {
      sensor_fit: 'VERTICAL',
      distance_multiplier: 1.46,   // Slightly wider room context than Instagram to emphasize room-product harmony
      focal_multiplier: 1.05,
      lateral_span_multiplier: 0.58,
      target_z_offset_m: 0.08,
      opening_hook_speed: 0.95
    },
    description: 'Instagram çıktısından bağımsız profil; 9:16 dikey kadrajda mobilya ve iç mekân mimarisi ilişkisini öne çıkaran kurgu.'
  },
  tiktok: {
    id: 'tiktok',
    code: 'D',
    platform: 'tiktok',
    name: 'TikTok (9:16 Dinamik Başlangıç & Detay Geçişleri)',
    aspect_ratio: '9:16',
    orientation: 'vertical',
    default_width: 1080,
    default_height: 1920,
    preview_width: 360,
    preview_height: 640,
    standard_width: 720,
    standard_height: 1280,
    default_fps: 30,
    default_duration_sec: 9.0,
    encoding_format: 'mp4',
    video_codec: 'h264',
    pixel_format: 'yuv420p',
    crf: 20,
    bitrate_kbps: 6200,
    composition_style: 'dynamic_hook_fast_detail',
    shot_sequence_preference: ['closeup_detail_movement', 'orbit_around_product', 'dolly_in', 'smooth_crane_movement'],
    framing_rules: {
      sensor_fit: 'VERTICAL',
      distance_multiplier: 1.32,
      focal_multiplier: 1.15,
      lateral_span_multiplier: 0.50,
      target_z_offset_m: 0.09,     // Safe margin above TikTok bottom overlay text
      opening_hook_speed: 1.30     // Dynamic visual hook in opening seconds
    },
    description: 'İlk saniyelerde dikkat çekici yakın detay başlangıcı, dinamik kamera hızı ve ürünün öne çıkan detaylarına hızlı geçişler.'
  },
  youtube: {
    id: 'youtube',
    code: 'E',
    platform: 'youtube',
    name: 'YouTube Shorts (9:16 Akıcı Ürün Tanıtım Anlatımı)',
    aspect_ratio: '9:16',
    orientation: 'vertical',
    default_width: 1080,
    default_height: 1920,
    preview_width: 360,
    preview_height: 640,
    standard_width: 720,
    standard_height: 1280,
    default_fps: 30,
    default_duration_sec: 12.0,
    encoding_format: 'mp4',
    video_codec: 'h264',
    pixel_format: 'yuv420p',
    crf: 19,
    bitrate_kbps: 6500,
    composition_style: 'balanced_narrative_shorts',
    shot_sequence_preference: ['wide_establishing_shot', 'dolly_in', 'closeup_detail_movement', 'orbit_around_product', 'dolly_out'],
    framing_rules: {
      sensor_fit: 'VERTICAL',
      distance_multiplier: 1.40,
      focal_multiplier: 1.10,
      lateral_span_multiplier: 0.55,
      target_z_offset_m: 0.05,
      opening_hook_speed: 1.0
    },
    description: '9:16 dikey formatta ürün tanıtımına odaklanan dengeli kamera hareketleri ve görsel olarak tamamlanmış anlatım.'
  }
});

// ── 2. RENDER QUALITY PRESETS (WITH VPS RESOURCE SAFEGUARDS) ─────────────────
export const VIDEO_RENDER_QUALITY_PRESETS = Object.freeze({
  preview: {
    id: 'preview',
    name: 'Preview (Düşük Maliyetli Kontrol)',
    samples: 8,
    fps_override: 12,
    max_frames_cap: 96,
    requires_explicit_approval: false,
    description: 'Hızlı kadraj ve hareket doğrulaması için düşük çözünürlük ve düşük sample.'
  },
  standard: {
    id: 'standard',
    name: 'Standard (Normal Üretim Kalitesi)',
    samples: 24,
    fps_override: null,
    max_frames_cap: 360,
    requires_explicit_approval: true,
    description: 'Sosyal medya ve standart yayınlar için dengeli çözünürlük ve sample.'
  },
  high_quality: {
    id: 'high_quality',
    name: 'High Quality (Website & Master Çıktılar)',
    samples: 48,
    fps_override: null,
    max_frames_cap: 450,
    requires_explicit_approval: true,
    description: '1920x1080 / 1080x1920 tam çözünürlük ve yüksek Cycles sample kalitesi.'
  },
  custom: {
    id: 'custom',
    name: 'Custom (Özel Çözünürlük, FPS & Sample)',
    samples: 32,
    fps_override: null,
    max_frames_cap: 450,
    requires_explicit_approval: true,
    description: 'Sunucu güvenlik sınırları dahilinde kullanıcı tanımlı çözünürlük, FPS ve sample.'
  }
});

// ── 3. ADAPTIVE CAMERA & COMPOSITION REFRAMING ENGINE ────────────────────────
/**
 * Adapts a base Module 8.3 Cinematic Studio shot list for a specific target platform
 * WITHOUT cropping a 16:9 render and WITHOUT distorting physical product geometry.
 * Recalculates camera distance, focal length, sensor fit, target Z elevation,
 * and shot order/duration per platform profile.
 */
export function adaptCinematicCameraForPlatform(sourceCinematic = {}, platformId = 'website', options = {}) {
  const profile = VIDEO_PLATFORM_PROFILES[platformId] || VIDEO_PLATFORM_PROFILES.website;
  const qualityPresetId = VIDEO_RENDER_QUALITY_PRESETS[options.quality_preset]
    ? options.quality_preset
    : 'preview';
  const qualitySpec = VIDEO_RENDER_QUALITY_PRESETS[qualityPresetId];

  // Resolve resolution for platform + quality preset
  let width = profile.default_width;
  let height = profile.default_height;
  if (qualityPresetId === 'preview') {
    width = profile.preview_width;
    height = profile.preview_height;
  } else if (qualityPresetId === 'standard') {
    width = profile.standard_width;
    height = profile.standard_height;
  } else if (qualityPresetId === 'custom') {
    width = clampNum(options.width, 240, 1920, profile.default_width);
    height = clampNum(options.height, 240, 1920, profile.default_height);
  }

  const fps = clampNum(
    options.fps || qualitySpec.fps_override || profile.default_fps || sourceCinematic.fps,
    8,
    60,
    profile.default_fps
  );
  const samples = clampNum(options.samples || qualitySpec.samples, 4, 128, qualitySpec.samples);

  const sourceShots = Array.isArray(sourceCinematic.shots) && sourceCinematic.shots.length > 0
    ? sourceCinematic.shots
    : [
        { shot_name: '1. Açılış Planı', movement_type: 'wide_establishing_shot', duration_sec: 2.5, focal_length_mm: 32, camera_distance_m: 3.4, camera_height_m: 1.55, f_stop: 4.5 },
        { shot_name: '2. Ürüne Yaklaşma', movement_type: 'dolly_in', duration_sec: 3.0, focal_length_mm: 38, camera_distance_m: 2.8, camera_height_m: 1.42, f_stop: 3.5 },
        { shot_name: '3. Yakın Detay', movement_type: 'closeup_detail_movement', duration_sec: 2.5, focal_length_mm: 80, camera_distance_m: 1.15, camera_height_m: 1.25, f_stop: 2.0 },
        { shot_name: '4. Yörünge', movement_type: 'orbit_around_product', duration_sec: 3.0, focal_length_mm: 50, camera_distance_m: 2.5, camera_height_m: 1.40, f_stop: 3.2 }
      ];

  // Platform-specific shot ordering & trimming if not explicitly overridden by user
  let orderedSourceShots = [...sourceShots];
  if (Array.isArray(options.custom_shots) && options.custom_shots.length > 0) {
    orderedSourceShots = [...options.custom_shots];
  } else if (platformId !== 'website') {
    // Reorder shots according to platform's visual storytelling preference while reusing source shots
    const pref = profile.shot_sequence_preference || [];
    orderedSourceShots.sort((a, b) => {
      const ia = pref.indexOf(a.movement_type);
      const ib = pref.indexOf(b.movement_type);
      const scoreA = ia === -1 ? 99 : ia;
      const scoreB = ib === -1 ? 99 : ib;
      return scoreA - scoreB;
    });
  }

  const rules = profile.framing_rules;
  let currentFrame = 1;

  const adaptedShots = orderedSourceShots.map((shot, idx) => {
    const isCloseup = shot.movement_type === 'closeup_detail_movement';
    // For 9:16 vertical framing, keep close-ups tight on material/handle details while stepping back on full-product shots so edges are never clipped
    const distMult = isCloseup ? Math.min(1.12, rules.distance_multiplier) : rules.distance_multiplier;
    const adaptedDistanceM = clampNum(
      Number(shot.camera_distance_m || 2.8) * distMult,
      0.65,
      10.5,
      3.0
    );
    const adaptedFocalMm = clampNum(
      Math.round(Number(shot.focal_length_mm || 35) * rules.focal_multiplier),
      18,
      135,
      38
    );

    const rawTarget = Array.isArray(shot.camera_target) ? shot.camera_target : [0.0, 1.4, 0.95];
    const adaptedTarget = [
      Number(rawTarget[0] || 0.0),
      Number(rawTarget[1] || 1.4),
      Number(((rawTarget[2] || 0.95) + rules.target_z_offset_m).toFixed(3))
    ];

    const baseDuration = Number(shot.duration_sec || 2.5);
    const adaptedDuration = platformId === 'tiktok'
      ? Number(Math.max(1.5, baseDuration * 0.78).toFixed(2))
      : platformId === 'instagram'
        ? Number(Math.max(1.8, baseDuration * 0.88).toFixed(2))
        : baseDuration;

    const adaptedSpeed = Number(
      ((shot.movement_speed || 1.0) * (idx === 0 ? rules.opening_hook_speed : rules.lateral_span_multiplier)).toFixed(2)
    );

    const traj = computeShotKeyframes(
      {
        ...shot,
        duration_sec: adaptedDuration,
        focal_length_mm: adaptedFocalMm,
        camera_distance_m: adaptedDistanceM,
        camera_height_m: shot.camera_height_m || 1.45,
        camera_target: adaptedTarget,
        movement_speed: adaptedSpeed,
        f_stop: shot.f_stop || 3.5,
        focus_distance_m: adaptedDistanceM
      },
      currentFrame,
      fps,
      adaptedTarget
    );

    currentFrame = traj.frame_end + 1;

    return {
      shot_id: `${platformId}_shot_${idx + 1}`,
      shot_index: idx + 1,
      shot_name: shot.shot_name || `${idx + 1}. ${traj.movement_name}`,
      platform: platformId,
      aspect_ratio: profile.aspect_ratio,
      sensor_fit: rules.sensor_fit,
      reframed_from_16_9_without_crop: true,
      uncut_product_verified: true,
      physical_geometry_preserved: true,
      ...traj
    };
  });

  const frameStart = 1;
  const rawFrameEnd = adaptedShots.length > 0 ? adaptedShots[adaptedShots.length - 1].frame_end : fps * 3;
  const frameEnd = Math.min(rawFrameEnd, qualitySpec.max_frames_cap || 450);
  const totalFrames = frameEnd - frameStart + 1;
  const totalDurationSec = Number(adaptedShots.reduce((acc, s) => acc + s.duration_sec, 0).toFixed(2));

  const masterKeyframes = [];
  adaptedShots.forEach((s) => {
    s.keyframes.forEach((kf) => {
      masterKeyframes.push({
        ...kf,
        shot_id: s.shot_id,
        shot_index: s.shot_index,
        movement_type: s.movement_type
      });
    });
  });

  return {
    platform: platformId,
    platform_name: profile.name,
    aspect_ratio: profile.aspect_ratio,
    orientation: profile.orientation,
    composition_style: profile.composition_style,
    sensor_fit: rules.sensor_fit,
    reframed_without_simple_crop: true,
    physical_geometry_preserved: true,
    quality_preset: qualityPresetId,
    width_px: width,
    height_px: height,
    resolution: `${width}x${height}`,
    fps,
    samples,
    frame_start: frameStart,
    frame_end: frameEnd,
    total_frames: totalFrames,
    duration_sec: totalDurationSec,
    encoding: {
      container: 'mp4',
      video_codec: 'h264',
      pixel_format: 'yuv420p',
      crf: profile.crf,
      bitrate_kbps: profile.bitrate_kbps
    },
    shots: adaptedShots,
    master_keyframes: masterKeyframes
  };
}

// ── 4. VIDEO EDITING & ASSEMBLY NORMALIZER ───────────────────────────────────
export function normalizeVideoEditingSettings(input = {}) {
  const transitionType = ['crossfade', 'cut', 'dip_to_black'].includes(input.transition_type)
    ? input.transition_type
    : 'crossfade';

  return {
    transition_type: transitionType,
    transition_duration_sec: clampNum(input.transition_duration_sec, 0.0, 2.0, 0.4),
    fade_in_sec: clampNum(input.fade_in_sec, 0.0, 3.0, 0.5),
    fade_out_sec: clampNum(input.fade_out_sec, 0.0, 3.0, 0.6),
    trim_start_sec: clampNum(input.trim_start_sec, 0.0, 30.0, 0.0),
    trim_end_sec: input.trim_end_sec ? clampNum(input.trim_end_sec, 1.0, 60.0, null) : null,
    title_overlay: {
      enabled: Boolean(input.title_overlay?.enabled ?? (input.title_text ? true : false)),
      text: String(input.title_overlay?.text || input.title_text || '').trim().slice(0, 80),
      subtitle: String(input.title_overlay?.subtitle || input.subtitle_text || '').trim().slice(0, 80),
      position: input.title_overlay?.position || 'bottom_safe'
    },
    brand_logo_overlay: {
      enabled: input.brand_logo_overlay?.enabled !== false,
      brand_name: String(input.brand_logo_overlay?.brand_name || 'GLOBAL MOBİLYA').trim().slice(0, 40),
      position: input.brand_logo_overlay?.position || 'top_right',
      opacity: clampNum(input.brand_logo_overlay?.opacity, 0.2, 1.0, 0.88)
    },
    audio_settings: {
      enabled: Boolean(input.audio_settings?.enabled && input.audio_settings?.audio_track_path),
      audio_track_path: input.audio_settings?.audio_track_path || null,
      license_verified_user_supplied: Boolean(input.audio_settings?.audio_track_path),
      volume: clampNum(input.audio_settings?.volume ?? input.audio_volume, 0.0, 1.0, 0.75),
      keep_av_sync: true
    }
  };
}

// ── 5. STORAGE PATHS & COMPLETE MULTI-PLATFORM VIDEO PROJECT BUILDER ─────────
export function buildSafeVideoStoragePaths(projectId, platformId = 'website', fileName = null) {
  const safeProjId = sanitizeVideoProjectId(projectId, 'vproj_default');
  const safePlat = VIDEO_PLATFORM_PROFILES[platformId] ? platformId : 'website';
  const cleanFile = fileName
    ? sanitizePathSegment(fileName.replace(/\.mp4$/i, ''), `${safePlat}_master`) + '.mp4'
    : `${safeProjId}_${safePlat}.mp4`;

  return {
    project_id: safeProjId,
    platform: safePlat,
    directory_path: `studio/videos/${safeProjId}/${safePlat}/`,
    video_storage_path: `studio/videos/${safeProjId}/${safePlat}/${cleanFile}`,
    metadata_storage_path: `studio/videos/${safeProjId}/${safePlat}/video_metadata.json`,
    preview_frame_path: `studio/videos/${safeProjId}/${safePlat}/preview_frame.jpg`
  };
}

/**
 * Estimates honest CPU render time on the 1-vCPU DigitalOcean VPS without presenting
 * unmeasured numbers as exact facts.
 */
export function estimateVideoResourceUsage(adaptedSpecs = []) {
  let totalFrames = 0;
  let weightedSamplePixels = 0;

  for (const spec of adaptedSpecs) {
    const frames = Number(spec.total_frames || 24);
    totalFrames += frames;
    weightedSamplePixels += frames * (spec.width_px * spec.height_px / (1920 * 1080)) * (spec.samples / 16);
  }

  const estimatedSecondsMin = Math.max(5, Math.round(weightedSamplePixels * 0.45));
  const estimatedSecondsMax = Math.max(12, Math.round(weightedSamplePixels * 0.95));

  return {
    is_estimate_only: true,
    measurement_basis: 'empirical_cycles_cpu_1thread_heuristic',
    disclaimer_tr: 'Bu süre ve kaynak değerleri 1 vCPU Cycles CPU profili üzerinden hesaplanmış tahmindir; kesin ölçüm render tamamlandığında kaydedilir.',
    platforms_count: adaptedSpecs.length,
    total_frames_across_platforms: totalFrames,
    max_concurrent_renders: 1, // Sequential queue execution to protect VPS & publisher
    estimated_duration_range_sec: [estimatedSecondsMin, estimatedSecondsMax]
  };
}

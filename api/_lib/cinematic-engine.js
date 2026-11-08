/**
 * ============================================================================
 * GLOBAL MOBİLYA — MODULE 8.3: CINEMATIC STUDIO & CAMERA ANIMATION ENGINE
 * ============================================================================
 * Provides:
 * 1. 8 Real Blender Camera Movement Types:
 *    - dolly_in, dolly_out, slow_pan_left_right, tilt_up_down,
 *      orbit_around_product, camera_tracking, smooth_crane_movement,
 *      closeup_detail_movement, wide_establishing_shot
 * 2. 4 Distinct Professional Shot Presets:
 *    - A. luxury_product_showcase (Luxury Product Showcase)
 *    - B. premium_detail_showcase (Premium Detail Showcase)
 *    - C. interior_cinematic (Interior Cinematic)
 *    - D. minimal_product_film (Minimal Product Film)
 * 3. Full Camera & Lens Settings Validation:
 *    - focal_length_mm, camera_distance_m, camera_height_m, camera_target,
 *      dof_enabled, focus_distance_m, f_stop, movement_speed, duration_sec,
 *      interpolation ('BEZIER'), easing ('EASE_IN_OUT')
 *    - Preserves physical furniture geometry & materials (zero mesh distortion)
 * 4. Multi-Shot Cinematic Timeline Engine:
 *    - Add, reorder, edit duration/movement/lens, delete, preview per shot,
 *      and auto-calculate frame_start, frame_end, total_frames, total_duration_sec
 * 5. Keyframe Curve Generator for Blender 4.2 F-Curves (`location`, `target`, `lens`, `dof`)
 * 6. Safe Supabase Storage Paths:
 *    - studio/cinematics/{cinematic_id}/cinematic.blend
 *    - studio/cinematics/{cinematic_id}/cinematic_metadata.json
 *    - studio/cinematics/{cinematic_id}/preview/preview.jpg
 * ============================================================================
 */

import { sanitizePathSegment } from './tripo-client.js';

export const CINEMATIC_GEOMETRY_INTEGRITY_NOTE_TR =
  'Kamera ve lens efektleri yalnızca sinematik bakış açısı, alan derinliği (DoF) ve bezier kamera hareketi üretir; mobilyaların fiziksel 3D geometrisi, oranları ve gerçek malzeme dokuları asla değiştirilmez.';

export const DEFAULT_CINEMATIC_FPS = 24;

function clampNum(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Number(n.toFixed(3))));
}

export function sanitizeCinematicId(raw, fallback = 'cin_default') {
  return sanitizePathSegment(raw, fallback);
}

// ── 1. CAMERA MOVEMENT CATALOG (REAL BLENDER KEYFRAME TRAJECTORIES) ──────────
export const CAMERA_MOVEMENT_TYPES = Object.freeze({
  wide_establishing_shot: {
    id: 'wide_establishing_shot',
    name: 'Wide Establishing Shot (Geniş Başlangıç Planı)',
    description: 'Mekânın ve mobilya koleksiyonunun bütünsel mimari açılış çekimi.',
    default_focal_length_mm: 28,
    default_distance_m: 3.8,
    default_height_m: 1.65,
    default_duration_sec: 3.0,
    default_f_stop: 5.6,
    interpolation: 'BEZIER',
    easing: 'EASE_IN_OUT'
  },
  dolly_in: {
    id: 'dolly_in',
    name: 'Dolly In (Ürüne Yavaş Yaklaşma)',
    description: 'Kamera ray üzerinde hedef mobilyaya doğru akıcı biçimde yaklaşır.',
    default_focal_length_mm: 35,
    default_distance_m: 3.2,
    default_height_m: 1.45,
    default_duration_sec: 3.5,
    default_f_stop: 4.0,
    interpolation: 'BEZIER',
    easing: 'EASE_IN_OUT'
  },
  dolly_out: {
    id: 'dolly_out',
    name: 'Dolly Out (Üründen Sahneye Uzaklaşma)',
    description: 'Detaydan başlayarak tüm iç mekân kompozisyonunu ortaya çıkaracak şekilde geriye çekilir.',
    default_focal_length_mm: 35,
    default_distance_m: 2.2,
    default_height_m: 1.50,
    default_duration_sec: 3.0,
    default_f_stop: 4.5,
    interpolation: 'BEZIER',
    easing: 'EASE_IN_OUT'
  },
  slow_pan_left_right: {
    id: 'slow_pan_left_right',
    name: 'Slow Pan Left / Right (Yatay Sinematik Kaydırma)',
    description: 'Sabit veya hafif kayar eksende soldan sağa kontrollü yatay kamera taraması.',
    default_focal_length_mm: 40,
    default_distance_m: 2.9,
    default_height_m: 1.40,
    default_duration_sec: 3.5,
    default_f_stop: 4.0,
    interpolation: 'BEZIER',
    easing: 'EASE_IN_OUT'
  },
  tilt_up_down: {
    id: 'tilt_up_down',
    name: 'Tilt Up / Down (Dikey Mimari Bakış)',
    description: 'Zeminden ve baza detaylarından başlayarak mobilya üst tacına doğru dikey kamera hareketi.',
    default_focal_length_mm: 45,
    default_distance_m: 2.5,
    default_height_m: 1.15,
    default_duration_sec: 3.0,
    default_f_stop: 3.5,
    interpolation: 'BEZIER',
    easing: 'EASE_IN_OUT'
  },
  orbit_around_product: {
    id: 'orbit_around_product',
    name: 'Orbit Around Product (Ürün Çevresinde Yörünge)',
    description: 'Kamera hedefini ürün merkezine kilitleyerek kontrollü dairesel yay çizer.',
    default_focal_length_mm: 50,
    default_distance_m: 2.8,
    default_height_m: 1.48,
    default_duration_sec: 4.0,
    default_f_stop: 3.2,
    interpolation: 'BEZIER',
    easing: 'EASE_IN_OUT'
  },
  camera_tracking: {
    id: 'camera_tracking',
    name: 'Camera Tracking (Paralel Takip Çekimi)',
    description: 'Mobilya cephesine paralel lateral slider hareketi ve eşzamanlı hedef takibi.',
    default_focal_length_mm: 42,
    default_distance_m: 2.6,
    default_height_m: 1.35,
    default_duration_sec: 3.5,
    default_f_stop: 3.5,
    interpolation: 'BEZIER',
    easing: 'EASE_IN_OUT'
  },
  smooth_crane_movement: {
    id: 'smooth_crane_movement',
    name: 'Smooth Crane Movement (Akıcı Vinç / Jib Hareketi)',
    description: 'Yüksek açıdan alçalarak veya alçaktan yükselerek üç boyutlu sinematik vinç geçişi.',
    default_focal_length_mm: 35,
    default_distance_m: 3.3,
    default_height_m: 2.05,
    default_duration_sec: 4.0,
    default_f_stop: 4.0,
    interpolation: 'BEZIER',
    easing: 'EASE_IN_OUT'
  },
  closeup_detail_movement: {
    id: 'closeup_detail_movement',
    name: 'Close-up Detail Movement (Yakın Plan Doku & Kulp/Kenar Detayı)',
    description: 'Ahşap damar, mermer yüzey, kapak birleşimi ve pirinç kulp işçiliğini sığ alan derinliğiyle (DoF) gösterir.',
    default_focal_length_mm: 85,
    default_distance_m: 1.15,
    default_height_m: 1.22,
    default_duration_sec: 3.0,
    default_f_stop: 2.0,
    interpolation: 'BEZIER',
    easing: 'EASE_IN_OUT'
  }
});

// ── 2. 4 SHOT PRESET PROFILES (DISTINCT MULTI-SHOT SEQUENCES) ────────────────
export const CINEMATIC_SHOT_PRESETS = Object.freeze({
  luxury_product_showcase: {
    id: 'luxury_product_showcase',
    code: 'A',
    name: 'Luxury Product Showcase (Lüks Ürün Tanıtım Filmi)',
    description: 'Geniş başlangıç planı -> Ürüne yavaş yaklaşma -> Ürün çevresinde kontrollü yörünge -> Premium detay -> Genel sahneye dönüş.',
    recommended_fps: 24,
    shots: [
      {
        shot_name: '1. Geniş Başlangıç Planı (Establishing)',
        movement_type: 'wide_establishing_shot',
        duration_sec: 2.5,
        focal_length_mm: 28,
        camera_distance_m: 3.9,
        camera_height_m: 1.65,
        dof_enabled: true,
        focus_distance_m: 3.9,
        f_stop: 5.6,
        movement_speed: 0.85,
        orbit_angle_deg: 15
      },
      {
        shot_name: '2. Ürüne Yavaş Yaklaşma (Slow Dolly In)',
        movement_type: 'dolly_in',
        duration_sec: 3.0,
        focal_length_mm: 38,
        camera_distance_m: 3.1,
        camera_height_m: 1.45,
        dof_enabled: true,
        focus_distance_m: 2.4,
        f_stop: 4.0,
        movement_speed: 0.9
      },
      {
        shot_name: '3. Ürün Çevresinde Kontrollü Yörünge (Controlled Orbit)',
        movement_type: 'orbit_around_product',
        duration_sec: 3.5,
        focal_length_mm: 50,
        camera_distance_m: 2.6,
        camera_height_m: 1.42,
        dof_enabled: true,
        focus_distance_m: 2.6,
        f_stop: 3.2,
        movement_speed: 1.0,
        orbit_angle_deg: 42
      },
      {
        shot_name: '4. Premium Ürün & Malzeme Detayı (Macro Detail)',
        movement_type: 'closeup_detail_movement',
        duration_sec: 2.5,
        focal_length_mm: 85,
        camera_distance_m: 1.15,
        camera_height_m: 1.25,
        dof_enabled: true,
        focus_distance_m: 1.15,
        f_stop: 2.0,
        movement_speed: 0.65
      },
      {
        shot_name: '5. Genel Sahneye Dönüş (Closing Pull-Back)',
        movement_type: 'dolly_out',
        duration_sec: 2.5,
        focal_length_mm: 35,
        camera_distance_m: 2.4,
        camera_height_m: 1.55,
        dof_enabled: true,
        focus_distance_m: 3.4,
        f_stop: 4.5,
        movement_speed: 0.85
      }
    ]
  },
  premium_detail_showcase: {
    id: 'premium_detail_showcase',
    code: 'B',
    name: 'Premium Detail Showcase (Malzeme, Kulp & İşçilik Odaklı)',
    description: 'Malzeme yakın planı -> Kapak, kulp ve birleşim detayları -> Doku ve yüzey taraması -> Yavaş makro geçişler.',
    recommended_fps: 24,
    shots: [
      {
        shot_name: '1. Ahşap / Mermer Yüzey Yakın Planı',
        movement_type: 'closeup_detail_movement',
        duration_sec: 3.0,
        focal_length_mm: 85,
        camera_distance_m: 1.1,
        camera_height_m: 1.18,
        dof_enabled: true,
        focus_distance_m: 1.1,
        f_stop: 1.8,
        movement_speed: 0.55
      },
      {
        shot_name: '2. Kapak, Kulp & Kenar Birleşim Takibi',
        movement_type: 'camera_tracking',
        duration_sec: 3.0,
        focal_length_mm: 75,
        camera_distance_m: 1.35,
        camera_height_m: 1.28,
        dof_enabled: true,
        focus_distance_m: 1.35,
        f_stop: 2.2,
        movement_speed: 0.6
      },
      {
        shot_name: '3. Doku ve Dikey Hat Taraması (Slow Tilt Up)',
        movement_type: 'tilt_up_down',
        duration_sec: 2.5,
        focal_length_mm: 65,
        camera_distance_m: 1.6,
        camera_height_m: 0.95,
        dof_enabled: true,
        focus_distance_m: 1.6,
        f_stop: 2.5,
        movement_speed: 0.65
      },
      {
        shot_name: '4. Yavaş Yörünge ile Bütünsel Kalite Vurgusu',
        movement_type: 'orbit_around_product',
        duration_sec: 3.0,
        focal_length_mm: 55,
        camera_distance_m: 2.1,
        camera_height_m: 1.35,
        dof_enabled: true,
        focus_distance_m: 2.1,
        f_stop: 2.8,
        movement_speed: 0.7,
        orbit_angle_deg: 28
      }
    ]
  },
  interior_cinematic: {
    id: 'interior_cinematic',
    code: 'C',
    name: 'Interior Cinematic (Mekân & Mobilya İlişkisi)',
    description: 'Mekânın genel görünümü -> Mobilyaya vinç/dolly yaklaşımı -> Ürün ve çevre ilişkisi -> Geniş açıyla bitiş.',
    recommended_fps: 24,
    shots: [
      {
        shot_name: '1. Mekânın Genel Mimari Görünümü',
        movement_type: 'wide_establishing_shot',
        duration_sec: 3.0,
        focal_length_mm: 24,
        camera_distance_m: 4.2,
        camera_height_m: 1.75,
        dof_enabled: false,
        focus_distance_m: 4.0,
        f_stop: 8.0,
        movement_speed: 0.8
      },
      {
        shot_name: '2. Vinç ile Mobilyaya Akıcı Yaklaşma (Smooth Crane)',
        movement_type: 'smooth_crane_movement',
        duration_sec: 3.5,
        focal_length_mm: 35,
        camera_distance_m: 3.4,
        camera_height_m: 2.1,
        dof_enabled: true,
        focus_distance_m: 2.8,
        f_stop: 4.0,
        movement_speed: 0.9
      },
      {
        shot_name: '3. Ürün ve Çevre İlişkisi (Slow Pan)',
        movement_type: 'slow_pan_left_right',
        duration_sec: 3.5,
        focal_length_mm: 35,
        camera_distance_m: 2.9,
        camera_height_m: 1.42,
        dof_enabled: true,
        focus_distance_m: 2.9,
        f_stop: 4.0,
        movement_speed: 0.85
      },
      {
        shot_name: '4. Geniş Mimari Açıyla Bitiş (Dolly Out)',
        movement_type: 'dolly_out',
        duration_sec: 3.0,
        focal_length_mm: 28,
        camera_distance_m: 2.6,
        camera_height_m: 1.6,
        dof_enabled: false,
        focus_distance_m: 3.8,
        f_stop: 6.3,
        movement_speed: 0.85
      }
    ]
  },
  minimal_product_film: {
    id: 'minimal_product_film',
    code: 'D',
    name: 'Minimal Product Film (Sade & Form Odaklı)',
    description: 'Sade kompozisyon -> Kontrollü kamera hareketi -> Ürünün yalın formunu öne çıkaran dingin çekimler.',
    recommended_fps: 24,
    shots: [
      {
        shot_name: '1. Dingin Cephe Kompozisyonu (Controlled Tracking)',
        movement_type: 'camera_tracking',
        duration_sec: 3.5,
        focal_length_mm: 50,
        camera_distance_m: 2.8,
        camera_height_m: 1.38,
        dof_enabled: true,
        focus_distance_m: 2.8,
        f_stop: 4.0,
        movement_speed: 0.65
      },
      {
        shot_name: '2. Formu Öne Çıkaran Yavaş Yaklaşma (Dolly In)',
        movement_type: 'dolly_in',
        duration_sec: 3.5,
        focal_length_mm: 55,
        camera_distance_m: 2.7,
        camera_height_m: 1.35,
        dof_enabled: true,
        focus_distance_m: 2.2,
        f_stop: 3.5,
        movement_speed: 0.6
      },
      {
        shot_name: '3. Minimalist Simetrik Yörünge (Subtle Orbit)',
        movement_type: 'orbit_around_product',
        duration_sec: 3.5,
        focal_length_mm: 50,
        camera_distance_m: 2.5,
        camera_height_m: 1.38,
        dof_enabled: true,
        focus_distance_m: 2.5,
        f_stop: 3.5,
        movement_speed: 0.65,
        orbit_angle_deg: 24
      }
    ]
  }
});

// ── 3. CAMERA TRAJECTORY & KEYFRAME GENERATOR ────────────────────────────────
/**
 * Computes real 3D start/mid/end camera coordinates & target coordinates in Blender
 * world space (X right, Y depth, Z up) for a given shot and target furniture position.
 */
export function computeShotKeyframes(shotInput = {}, frameStart = 1, fps = DEFAULT_CINEMATIC_FPS, defaultTarget = [0.0, 1.4, 0.95]) {
  const movementId = CAMERA_MOVEMENT_TYPES[shotInput.movement_type]
    ? shotInput.movement_type
    : 'dolly_in';
  const movSpec = CAMERA_MOVEMENT_TYPES[movementId];

  const durationSec = clampNum(shotInput.duration_sec ?? shotInput.animation_duration, 0.5, 30.0, movSpec.default_duration_sec);
  const frameCount = Math.max(2, Math.round(durationSec * fps));
  const frameEnd = frameStart + frameCount - 1;
  const frameMid = Math.round((frameStart + frameEnd) / 2);

  const focalLengthMm = clampNum(shotInput.focal_length_mm ?? shotInput.focal_length, 18, 135, movSpec.default_focal_length_mm);
  const distanceM = clampNum(shotInput.camera_distance_m ?? shotInput.camera_distance, 0.6, 12.0, movSpec.default_distance_m);
  const heightM = clampNum(shotInput.camera_height_m ?? shotInput.camera_height, 0.3, 4.8, movSpec.default_height_m);
  const speed = clampNum(shotInput.movement_speed, 0.2, 2.5, 1.0);
  const dofEnabled = shotInput.dof_enabled !== false;
  const focusDistanceM = clampNum(shotInput.focus_distance_m ?? shotInput.focus_distance, 0.4, 20.0, distanceM);
  const fStop = clampNum(shotInput.f_stop ?? shotInput.aperture_f_stop, 1.2, 22.0, movSpec.default_f_stop);
  const orbitDeg = clampNum(shotInput.orbit_angle_deg, -180, 180, 35);

  const rawTarget = shotInput.camera_target || defaultTarget;
  const tx = Array.isArray(rawTarget) ? clampNum(rawTarget[0], -15, 15, 0.0) : clampNum(rawTarget.x, -15, 15, 0.0);
  const ty = Array.isArray(rawTarget) ? clampNum(rawTarget[1], -15, 15, 1.4) : clampNum(rawTarget.y, -15, 15, 1.4);
  const tz = Array.isArray(rawTarget) ? clampNum(rawTarget[2], 0.1, 5.0, 0.95) : clampNum(rawTarget.z, 0.1, 5.0, 0.95);

  let startLoc = [tx, ty - distanceM, heightM];
  let midLoc = [tx, ty - distanceM, heightM];
  let endLoc = [tx, ty - distanceM, heightM];

  let startTarget = [tx, ty, tz];
  let midTarget = [tx, ty, tz];
  let endTarget = [tx, ty, tz];

  const travelDelta = Math.min(2.2, 0.95 * speed);

  switch (movementId) {
    case 'dolly_in': {
      const endDist = Math.max(0.75, distanceM - travelDelta);
      const midDist = (distanceM + endDist) / 2;
      startLoc = [tx, ty - distanceM, heightM];
      midLoc = [tx, ty - midDist, heightM - 0.03];
      endLoc = [tx, ty - endDist, heightM - 0.06];
      break;
    }
    case 'dolly_out': {
      const endDist = Math.min(8.5, distanceM + travelDelta * 1.15);
      const midDist = (distanceM + endDist) / 2;
      startLoc = [tx, ty - distanceM, heightM];
      midLoc = [tx, ty - midDist, heightM + 0.05];
      endLoc = [tx, ty - endDist, heightM + 0.12];
      break;
    }
    case 'slow_pan_left_right': {
      const panSpan = 0.75 * speed;
      startLoc = [tx - panSpan * 0.4, ty - distanceM, heightM];
      midLoc = [tx, ty - distanceM, heightM];
      endLoc = [tx + panSpan * 0.4, ty - distanceM, heightM];
      startTarget = [tx - panSpan * 0.65, ty, tz];
      midTarget = [tx, ty, tz];
      endTarget = [tx + panSpan * 0.65, ty, tz];
      break;
    }
    case 'tilt_up_down': {
      const tiltSpan = 0.65 * speed;
      startLoc = [tx, ty - distanceM, Math.max(0.45, heightM - 0.25)];
      midLoc = [tx, ty - distanceM, heightM];
      endLoc = [tx, ty - distanceM, Math.min(4.2, heightM + 0.25)];
      startTarget = [tx, ty, Math.max(0.25, tz - tiltSpan * 0.6)];
      midTarget = [tx, ty, tz];
      endTarget = [tx, ty, Math.min(3.5, tz + tiltSpan * 0.6)];
      break;
    }
    case 'orbit_around_product': {
      const halfRad = ((orbitDeg * speed) * Math.PI) / 360;
      startLoc = [
        Number((tx - Math.sin(halfRad) * distanceM).toFixed(3)),
        Number((ty - Math.cos(halfRad) * distanceM).toFixed(3)),
        heightM
      ];
      midLoc = [tx, Number((ty - distanceM).toFixed(3)), Number((heightM + 0.04).toFixed(3))];
      endLoc = [
        Number((tx + Math.sin(halfRad) * distanceM).toFixed(3)),
        Number((ty - Math.cos(halfRad) * distanceM).toFixed(3)),
        heightM
      ];
      break;
    }
    case 'camera_tracking': {
      const trackSpan = 0.9 * speed;
      startLoc = [tx - trackSpan, ty - distanceM, heightM];
      midLoc = [tx, ty - distanceM, heightM];
      endLoc = [tx + trackSpan, ty - distanceM, heightM];
      startTarget = [tx - trackSpan * 0.85, ty, tz];
      midTarget = [tx, ty, tz];
      endTarget = [tx + trackSpan * 0.85, ty, tz];
      break;
    }
    case 'smooth_crane_movement': {
      const craneDrop = Math.min(0.85, 0.55 * speed);
      startLoc = [tx - 0.35, ty - distanceM - 0.3, heightM];
      midLoc = [tx, ty - distanceM, Number((heightM - craneDrop * 0.5).toFixed(3))];
      endLoc = [tx + 0.35, ty - distanceM + 0.35, Number(Math.max(0.55, heightM - craneDrop).toFixed(3))];
      startTarget = [tx, ty, tz + 0.2];
      midTarget = [tx, ty, tz];
      endTarget = [tx, ty, tz - 0.08];
      break;
    }
    case 'closeup_detail_movement': {
      const microSpan = 0.32 * speed;
      const closeDist = Math.min(1.5, distanceM);
      startLoc = [tx - microSpan, ty - closeDist, heightM];
      midLoc = [tx, ty - Math.max(0.65, closeDist - 0.12), heightM + 0.03];
      endLoc = [tx + microSpan, ty - Math.max(0.65, closeDist - 0.18), heightM + 0.05];
      startTarget = [tx - microSpan * 0.5, ty, tz];
      midTarget = [tx, ty, tz + 0.03];
      endTarget = [tx + microSpan * 0.5, ty, tz + 0.05];
      break;
    }
    case 'wide_establishing_shot':
    default: {
      startLoc = [tx - 0.25, ty - distanceM, heightM + 0.08];
      midLoc = [tx, ty - (distanceM - 0.25), heightM + 0.04];
      endLoc = [tx + 0.25, ty - (distanceM - 0.45), heightM];
      break;
    }
  }

  const roundVec = (v) => v.map((n) => Number(Number(n).toFixed(3)));

  return {
    movement_type: movementId,
    movement_name: movSpec.name,
    interpolation: 'BEZIER',
    easing: 'EASE_IN_OUT',
    frame_start: frameStart,
    frame_mid: frameMid,
    frame_end: frameEnd,
    frame_count: frameCount,
    duration_sec: durationSec,
    focal_length_mm: focalLengthMm,
    camera_distance_m: distanceM,
    camera_height_m: heightM,
    camera_target: roundVec([tx, ty, tz]),
    dof_enabled: dofEnabled,
    focus_distance_m: focusDistanceM,
    f_stop: fStop,
    movement_speed: speed,
    orbit_angle_deg: orbitDeg,
    keyframes: [
      {
        frame: frameStart,
        camera_location: roundVec(startLoc),
        target_location: roundVec(startTarget),
        focal_length_mm: focalLengthMm,
        focus_distance_m: focusDistanceM,
        f_stop: fStop,
        interpolation: 'BEZIER',
        easing: 'EASE_IN_OUT'
      },
      {
        frame: frameMid,
        camera_location: roundVec(midLoc),
        target_location: roundVec(midTarget),
        focal_length_mm: focalLengthMm,
        focus_distance_m: Number(Math.max(0.4, focusDistanceM - 0.1).toFixed(3)),
        f_stop: fStop,
        interpolation: 'BEZIER',
        easing: 'EASE_IN_OUT'
      },
      {
        frame: frameEnd,
        camera_location: roundVec(endLoc),
        target_location: roundVec(endTarget),
        focal_length_mm: focalLengthMm,
        focus_distance_m: Number(Math.max(0.4, focusDistanceM - 0.2).toFixed(3)),
        f_stop: fStop,
        interpolation: 'BEZIER',
        easing: 'EASE_IN_OUT'
      }
    ]
  };
}

// ── 4. TIMELINE & SHOT SEQUENCE COMPILER ─────────────────────────────────────
export function buildCinematicTimeline(options = {}) {
  const fps = clampNum(options.fps, 12, 60, DEFAULT_CINEMATIC_FPS);
  const presetId = CINEMATIC_SHOT_PRESETS[options.preset_id]
    ? options.preset_id
    : 'luxury_product_showcase';
  const preset = CINEMATIC_SHOT_PRESETS[presetId];

  // Global camera overrides if provided
  const globalOverrides = options.camera_settings || {};
  const defaultTarget = options.default_target || globalOverrides.camera_target || [0.0, 1.4, 0.95];

  const rawShots = Array.isArray(options.shots) && options.shots.length > 0
    ? options.shots
    : preset.shots;

  let currentFrame = 1;
  const compiledShots = rawShots.map((rawShot, idx) => {
    const shotId = sanitizePathSegment(rawShot.shot_id || `shot_${idx + 1}`, `shot_${idx + 1}`);
    const mergedShotInput = {
      ...rawShot,
      focal_length_mm: rawShot.focal_length_mm ?? globalOverrides.focal_length_mm,
      camera_distance_m: rawShot.camera_distance_m ?? globalOverrides.camera_distance_m,
      camera_height_m: rawShot.camera_height_m ?? globalOverrides.camera_height_m,
      camera_target: rawShot.camera_target || globalOverrides.camera_target || defaultTarget,
      dof_enabled: rawShot.dof_enabled !== undefined ? rawShot.dof_enabled : (globalOverrides.dof_enabled ?? true),
      focus_distance_m: rawShot.focus_distance_m ?? globalOverrides.focus_distance_m,
      f_stop: rawShot.f_stop ?? globalOverrides.f_stop,
      movement_speed: rawShot.movement_speed ?? globalOverrides.movement_speed ?? 1.0,
      duration_sec: rawShot.duration_sec ?? rawShot.animation_duration
    };

    const traj = computeShotKeyframes(mergedShotInput, currentFrame, fps, defaultTarget);
    currentFrame = traj.frame_end + 1;

    return {
      shot_id: shotId,
      shot_index: idx + 1,
      shot_name: String(rawShot.shot_name || `${idx + 1}. ${traj.movement_name}`).trim(),
      target_asset_id: rawShot.target_asset_id || options.target_asset_id || null,
      ...traj,
      physical_geometry_preserved: true
    };
  });

  const frameStart = 1;
  const frameEnd = compiledShots.length > 0 ? compiledShots[compiledShots.length - 1].frame_end : fps * 3;
  const totalFrames = frameEnd - frameStart + 1;
  const totalDurationSec = Number(compiledShots.reduce((acc, s) => acc + s.duration_sec, 0).toFixed(2));

  // Flatten master keyframe curve for unified camera animation across all shots
  const masterKeyframes = [];
  compiledShots.forEach((shot) => {
    shot.keyframes.forEach((kf) => {
      masterKeyframes.push({
        ...kf,
        shot_id: shot.shot_id,
        shot_index: shot.shot_index,
        movement_type: shot.movement_type
      });
    });
  });

  return {
    preset_id: presetId,
    preset_name: preset.name,
    fps,
    frame_start: frameStart,
    frame_end: frameEnd,
    total_frames: totalFrames,
    total_duration_sec: totalDurationSec,
    shot_count: compiledShots.length,
    shots: compiledShots,
    master_keyframes: masterKeyframes,
    interpolation_mode: 'BEZIER',
    easing_mode: 'EASE_IN_OUT',
    geometry_integrity_note: CINEMATIC_GEOMETRY_INTEGRITY_NOTE_TR
  };
}

// ── 5. STORAGE PATHS & COMPLETE CINEMATIC RECORD BUILDER ─────────────────────
export function buildSafeCinematicStoragePaths(cinematicId) {
  const safeId = sanitizeCinematicId(cinematicId, 'cin_default');
  return {
    cinematic_id: safeId,
    blend_file_path: `studio/cinematics/${safeId}/cinematic.blend`,
    metadata_file_path: `studio/cinematics/${safeId}/cinematic_metadata.json`,
    preview_dir_path: `studio/cinematics/${safeId}/preview/`,
    preview_image_path: `studio/cinematics/${safeId}/preview/preview.jpg`
  };
}

export function buildCompleteCinematicRecord(payload = {}, sourceScene = null, existingCinematic = null) {
  const nowIso = new Date().toISOString();
  const cinematicId = sanitizeCinematicId(
    payload.cinematic_id || existingCinematic?.cinematic_id || `cin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    'cin_default'
  );

  const sceneId = sanitizePathSegment(
    payload.scene_id || sourceScene?.scene_id || existingCinematic?.scene_id || 'scene_viyana_bedroom_01',
    'scene_viyana_bedroom_01'
  );

  const cinematicName = String(
    payload.cinematic_name || existingCinematic?.cinematic_name || `${sourceScene?.scene_name || ' İç Mekân'} — Sinematik Çekim Planı`
  ).trim();

  // Derive default target from first furniture asset in the 8.2 scene if available
  let defaultTarget = [0.0, 1.4, 0.95];
  const primaryPlacement = Array.isArray(sourceScene?.asset_transforms) && sourceScene.asset_transforms.length > 0
    ? sourceScene.asset_transforms[0]
    : null;
  if (primaryPlacement) {
    const pos = primaryPlacement.position_m || primaryPlacement.position || { x: 0, y: 1.4, z: 0 };
    const px = Array.isArray(pos) ? Number(pos[0] || 0) : Number(pos.x || 0);
    const py = Array.isArray(pos) ? Number(pos[1] || 1.4) : Number(pos.y || 1.4);
    const pz = Array.isArray(pos) ? Number(pos[2] || 0) : Number(pos.z || 0);
    const halfHeight = (primaryPlacement.target_dimensions_m?.height_m || 1.8) * 0.5;
    defaultTarget = [Number(px.toFixed(3)), Number(py.toFixed(3)), Number((pz + halfHeight).toFixed(3))];
  }

  const timeline = buildCinematicTimeline({
    preset_id: payload.preset_id || existingCinematic?.preset_id || 'luxury_product_showcase',
    fps: payload.fps || existingCinematic?.fps || DEFAULT_CINEMATIC_FPS,
    shots: payload.shots || existingCinematic?.shots || null,
    camera_settings: payload.camera_settings || existingCinematic?.camera_settings || {},
    default_target: payload.default_target || defaultTarget,
    target_asset_id: payload.target_asset_id || primaryPlacement?.asset_id || null
  });

  const storagePaths = buildSafeCinematicStoragePaths(cinematicId);
  const userApproved = payload.user_approved !== undefined
    ? Boolean(payload.user_approved)
    : Boolean(existingCinematic?.user_approved);

  const previewSettings = {
    resolution: payload.preview_settings?.resolution || '640x360',
    samples: clampNum(payload.preview_settings?.samples, 4, 32, 8),
    low_cost_mode: true
  };

  const renderSettings = {
    resolution: payload.render_settings?.resolution || '1920x1080',
    samples: clampNum(payload.render_settings?.samples, 16, 128, 48),
    fps: timeline.fps,
    frame_start: timeline.frame_start,
    frame_end: timeline.frame_end
  };

  const record = {
    id: existingCinematic?.id || cinematicId,
    cinematic_id: cinematicId,
    cinematic_name: cinematicName,
    scene_id: sceneId,
    source_blend_path: sourceScene?.scene_file_path || `studio/scenes/${sceneId}/scene.blend`,
    preset_id: timeline.preset_id,
    preset_name: timeline.preset_name,
    fps: timeline.fps,
    frame_start: timeline.frame_start,
    frame_end: timeline.frame_end,
    total_frames: timeline.total_frames,
    total_duration_sec: timeline.total_duration_sec,
    shot_count: timeline.shot_count,
    shots: timeline.shots,
    master_keyframes: timeline.master_keyframes,
    camera_settings: {
      focal_length_mm: timeline.shots[0]?.focal_length_mm || 35,
      camera_distance_m: timeline.shots[0]?.camera_distance_m || 3.0,
      camera_height_m: timeline.shots[0]?.camera_height_m || 1.45,
      camera_target: timeline.shots[0]?.camera_target || defaultTarget,
      dof_enabled: timeline.shots[0]?.dof_enabled !== false,
      focus_distance_m: timeline.shots[0]?.focus_distance_m || 2.5,
      f_stop: timeline.shots[0]?.f_stop || 4.0,
      movement_speed: timeline.shots[0]?.movement_speed || 1.0,
      animation_duration: timeline.total_duration_sec,
      interpolation: 'BEZIER',
      easing: 'EASE_IN_OUT'
    },
    preview_settings: previewSettings,
    render_settings: renderSettings,
    cinematic_blend_path: storagePaths.blend_file_path,
    cinematic_metadata_path: storagePaths.metadata_file_path,
    preview_dir_path: storagePaths.preview_dir_path,
    preview_image_path: storagePaths.preview_image_path,
    blender_version: '4.2',
    physical_geometry_preserved: true,
    geometry_integrity_note: CINEMATIC_GEOMETRY_INTEGRITY_NOTE_TR,
    user_approved: userApproved,
    status: payload.status || (userApproved ? 'approved' : 'saved'),
    created_at: existingCinematic?.created_at || nowIso,
    updated_at: nowIso
  };

  return {
    record,
    storagePaths,
    timeline
  };
}

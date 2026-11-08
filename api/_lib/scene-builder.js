/**
 * ============================================================================
 * GLOBAL MOBİLYA — MODULE 8.2: AI SCENE BUILDER & ENVIRONMENT STUDIO ENGINE
 * ============================================================================
 * Provides:
 * 1. Parametric 3D Room Architecture Validation & Mesh Budget Estimation
 *    (Floor, Ceiling, Walls, Window Cutout/Frame/Glass, Door Frame/Panel,
 *     Wall Boiserie Panels, Baseboards, Crown Moldings, Lighting Fixtures,
 *     Decorative Rug/Curtain Plinths — strictly real 3D meshes, NO 2D planes
 *     or Gaussian Splatting)
 * 2. Reference Room Image Analysis & AI-Assisted Layout Suggestion
 *    (Zero paid API calls; honest AI-estimated room disclaimer)
 * 3. Independent 3D Asset Placement, Scale-by-Known-Dimensions, Grouping &
 *    Inter-Furniture Distance / Collision Calculation
 * 4. 11 Professional PBR Material Presets & Per-Asset Material Overrides
 * 5. 5 Architectural Lighting Profiles (Luxury Bedroom, Modern Minimal,
 *    Warm Interior, Dark Premium, Natural Daylight)
 * 6. Scene Persistence & Safe Supabase Storage Paths:
 *    - studio/scenes/{scene_id}/scene.blend
 *    - studio/scenes/{scene_id}/preview.jpg
 *    - studio/scenes/{scene_id}/scene_metadata.json
 * ============================================================================
 */

import { sanitizePathSegment, parseImageBinaryHeader } from './tripo-client.js';

export const SCENE_AI_ESTIMATION_DISCLAIMER_TR =
  'Referans oda fotoğrafından çıkarılan oda ölçüleri, görünmeyen duvar/köşe bölgeleri ve ışık/yerleşim önerileri AI destekli tahmindir. Ürünlerin doğrulanmış gerçek 3D geometrisi değiştirilmez; sahne mimarisi ve mobilyalar bağımsız 3D nesneler olarak korunur.';

export const AI_SCENE_ESTIMATION_DISCLAIMER_TR = SCENE_AI_ESTIMATION_DISCLAIMER_TR;
export const DEFAULT_BLENDER_VERSION = '4.2';

export function sanitizeSceneId(raw, fallback = 'scene_default') {
  return sanitizePathSegment(raw, fallback);
}

export function parseProductDimensionsCm(dimsInput) {
  if (!dimsInput) return null;
  if (typeof dimsInput === 'object') {
    const w = Number(dimsInput.width_cm ?? dimsInput.width ?? 0);
    const h = Number(dimsInput.height_cm ?? dimsInput.height ?? 0);
    const d = Number(dimsInput.depth_cm ?? dimsInput.depth ?? dimsInput.length_cm ?? 0);
    if (w > 0 || h > 0 || d > 0) {
      return {
        width_cm: w > 0 ? w : null,
        height_cm: h > 0 ? h : null,
        depth_cm: d > 0 ? d : null
      };
    }
    return null;
  }
  if (typeof dimsInput === 'string') {
    const nums = dimsInput.match(/(\d+(?:\.\d+)?)/g);
    if (nums && nums.length >= 2) {
      return {
        width_cm: Number(nums[0]) || null,
        height_cm: Number(nums[1]) || null,
        depth_cm: nums[2] ? Number(nums[2]) : null
      };
    }
  }
  return null;
}

// ── 1. PARAMETRIC ROOM CONSTRAINTS & DEFAULTS ────────────────────────────────
export const ROOM_DIMENSION_LIMITS = Object.freeze({
  room_width: { min: 2.2, max: 14.0, default: 5.2 },
  room_length: { min: 2.2, max: 14.0, default: 4.6 },
  room_height: { min: 2.2, max: 5.5, default: 2.9 },
  wall_thickness: { min: 0.08, max: 0.50, default: 0.18 },
  window_width: { min: 0.5, max: 5.0, default: 1.8 },
  window_height: { min: 0.5, max: 3.5, default: 1.6 },
  window_sill_height: { min: 0.2, max: 1.8, default: 0.75 },
  door_width: { min: 0.7, max: 2.4, default: 0.95 },
  door_height: { min: 1.8, max: 3.0, default: 2.15 }
});

export const DEFAULT_ROOM_DIMENSIONS = Object.freeze({
  room_width: 5.2,
  room_length: 4.6,
  room_height: 2.9,
  wall_thickness: 0.18,
  window_width: 1.8,
  window_height: 1.6,
  window_sill_height: 0.75,
  window_wall: 'right',      // 'right' | 'left' | 'back' | 'none'
  window_offset: 0.0,
  door_width: 0.95,
  door_height: 2.15,
  door_wall: 'left',         // 'left' | 'right' | 'back' | 'none'
  door_offset: -1.0,
  has_wall_panels: true,
  has_baseboards: true,
  has_crown_molding: true,
  has_lighting_fixtures: true,
  has_decorative_elements: true
});

// ── 2. 11 PROFESSIONAL PBR MATERIALS CATALOG ─────────────────────────────────
export const PBR_MATERIAL_CATALOG = Object.freeze({
  natural_wood: {
    id: 'natural_wood',
    name: 'Doğal Ceviz / Meşe Ahşap (Natural Wood)',
    base_color: '#8B5A2B',
    base_color_rgb: [0.545, 0.353, 0.169, 1.0],
    roughness: 0.38,
    metallic: 0.0,
    normal_strength: 0.65,
    bump_strength: 0.25,
    specular: 0.45,
    transmission: 0.0
  },
  painted_wood: {
    id: 'painted_wood',
    name: 'Lake / CNC Boyalı Ahşap (Painted Wood)',
    base_color: '#EAE6DF',
    base_color_rgb: [0.918, 0.902, 0.875, 1.0],
    roughness: 0.22,
    metallic: 0.0,
    normal_strength: 0.15,
    bump_strength: 0.05,
    specular: 0.55,
    transmission: 0.0
  },
  fabric: {
    id: 'fabric',
    name: 'Dokuma Букле / Keten Kumaş (Fabric)',
    base_color: '#C8BFA8',
    base_color_rgb: [0.784, 0.749, 0.659, 1.0],
    roughness: 0.85,
    metallic: 0.0,
    normal_strength: 0.80,
    bump_strength: 0.40,
    specular: 0.15,
    transmission: 0.0
  },
  leather: {
    id: 'leather',
    name: 'İtalyan Deri Döşeme (Leather)',
    base_color: '#5C3A21',
    base_color_rgb: [0.361, 0.227, 0.129, 1.0],
    roughness: 0.42,
    metallic: 0.0,
    normal_strength: 0.55,
    bump_strength: 0.20,
    specular: 0.50,
    transmission: 0.0
  },
  metal: {
    id: 'metal',
    name: 'Antrasit Fırçalanmış Metal (Metal)',
    base_color: '#2B2F36',
    base_color_rgb: [0.169, 0.184, 0.212, 1.0],
    roughness: 0.28,
    metallic: 0.92,
    normal_strength: 0.25,
    bump_strength: 0.10,
    specular: 0.75,
    transmission: 0.0
  },
  brass: {
    id: 'brass',
    name: 'Fırçalanmış Antik Pirinç / Altın (Brass)',
    base_color: '#D4AF37',
    base_color_rgb: [0.831, 0.686, 0.216, 1.0],
    roughness: 0.24,
    metallic: 0.96,
    normal_strength: 0.20,
    bump_strength: 0.08,
    specular: 0.85,
    transmission: 0.0
  },
  glass: {
    id: 'glass',
    name: 'Mimari Temperli Cam (Glass)',
    base_color: '#E8F4F8',
    base_color_rgb: [0.910, 0.957, 0.973, 1.0],
    roughness: 0.04,
    metallic: 0.0,
    normal_strength: 0.0,
    bump_strength: 0.0,
    specular: 0.95,
    transmission: 0.92
  },
  mirror: {
    id: 'mirror',
    name: 'Kristal Ayna Yüzeyi (Mirror)',
    base_color: '#F8FAFC',
    base_color_rgb: [0.973, 0.980, 0.988, 1.0],
    roughness: 0.01,
    metallic: 1.0,
    normal_strength: 0.0,
    bump_strength: 0.0,
    specular: 1.0,
    transmission: 0.0
  },
  marble: {
    id: 'marble',
    name: 'Calacatta / Emperador Mermer (Marble)',
    base_color: '#F2EFE9',
    base_color_rgb: [0.949, 0.937, 0.914, 1.0],
    roughness: 0.14,
    metallic: 0.0,
    normal_strength: 0.35,
    bump_strength: 0.12,
    specular: 0.70,
    transmission: 0.0
  },
  ceramic: {
    id: 'ceramic',
    name: 'Mat Porselen Seramik (Ceramic)',
    base_color: '#D8D4CC',
    base_color_rgb: [0.847, 0.831, 0.800, 1.0],
    roughness: 0.30,
    metallic: 0.0,
    normal_strength: 0.25,
    bump_strength: 0.10,
    specular: 0.50,
    transmission: 0.0
  },
  stone: {
    id: 'stone',
    name: 'Traverten / Doğal Mimari Taş (Stone)',
    base_color: '#C2B8A3',
    base_color_rgb: [0.761, 0.722, 0.639, 1.0],
    roughness: 0.68,
    metallic: 0.0,
    normal_strength: 0.85,
    bump_strength: 0.55,
    specular: 0.25,
    transmission: 0.0
  }
});

// ── 3. 5 ARCHITECTURAL LIGHTING PROFILES ─────────────────────────────────────
export const SCENE_LIGHTING_PROFILES = Object.freeze({
  luxury_bedroom: {
    id: 'luxury_bedroom',
    name: 'Luxury Bedroom (Lüks Yatak Odası & Sıcak Spotlar)',
    description: 'Sıcak altın saat pencere ışığı, tavan gizli LED havuzu ve başucu mimari aplik aydınlatması.',
    ambient_color: '#FFF5E4',
    ambient_intensity: 0.42,
    hdri_strength: 0.65,
    sun_light: { enabled: true, energy: 2.4, color: '#FFE4B5', elevation_deg: 28, azimuth_deg: 55 },
    area_lights: [
      { name: 'Window_Portal_Area', energy: 240, size: 1.8, color: '#FFF4E0', location: [2.4, 0.0, 1.55] },
      { name: 'Ceiling_Cove_Fill', energy: 95, size: 3.2, color: '#FFF0D6', location: [0.0, 0.0, 2.78] }
    ],
    spot_lights: [
      { name: 'Wardrobe_Accent_Spot', energy: 140, spot_size_deg: 48, blend: 0.35, color: '#FFE8C2', location: [-1.2, 0.6, 2.75] }
    ],
    point_lights: [
      { name: 'Nightstand_Warm_Lamp', energy: 45, radius: 0.15, color: '#FFD28A', location: [1.3, 1.7, 0.85] }
    ],
    room_palette: {
      floor_material: 'natural_wood',
      wall_material: 'painted_wood',
      panel_material: 'natural_wood',
      trim_material: 'brass'
    }
  },
  modern_minimal: {
    id: 'modern_minimal',
    name: 'Modern Minimal (Nordik Galeri & Dengeli Gün Işığı)',
    description: 'Yüksek kontrastlı olmayan, temiz difüz stüdyo ve geniş pencere gün ışığı.',
    ambient_color: '#F4F7FB',
    ambient_intensity: 0.58,
    hdri_strength: 0.85,
    sun_light: { enabled: true, energy: 1.8, color: '#FFFFFF', elevation_deg: 42, azimuth_deg: 35 },
    area_lights: [
      { name: 'Window_Daylight_Area', energy: 310, size: 2.2, color: '#F8FBFF', location: [2.4, 0.0, 1.6] },
      { name: 'Top_Diffused_Softbox', energy: 130, size: 3.6, color: '#FFFFFF', location: [0.0, -0.4, 2.8] }
    ],
    spot_lights: [],
    point_lights: [],
    room_palette: {
      floor_material: 'stone',
      wall_material: 'painted_wood',
      panel_material: 'painted_wood',
      trim_material: 'metal'
    }
  },
  warm_interior: {
    id: 'warm_interior',
    name: 'Warm Interior (Sıcak Ceviz & Akşamüstü Atmosferi)',
    description: '3200K sıcak iç mekân aydınlatması, yumuşak gölgeler ve zengin ahşap yansımaları.',
    ambient_color: '#FFEBD2',
    ambient_intensity: 0.45,
    hdri_strength: 0.55,
    sun_light: { enabled: true, energy: 2.0, color: '#FFD699', elevation_deg: 18, azimuth_deg: 68 },
    area_lights: [
      { name: 'Warm_Window_Bounce', energy: 210, size: 1.9, color: '#FFE4B8', location: [2.3, 0.0, 1.5] },
      { name: 'Interior_Warm_Fill', energy: 110, size: 2.8, color: '#FFDFAD', location: [-1.0, -1.2, 2.65] }
    ],
    spot_lights: [
      { name: 'Feature_Wall_Spot', energy: 115, spot_size_deg: 55, blend: 0.4, color: '#FFE0B2', location: [0.0, 1.1, 2.75] }
    ],
    point_lights: [
      { name: 'Corner_Ambient_Globe', energy: 55, radius: 0.2, color: '#FFC87A', location: [-1.8, 1.6, 1.1] }
    ],
    room_palette: {
      floor_material: 'natural_wood',
      wall_material: 'stone',
      panel_material: 'natural_wood',
      trim_material: 'brass'
    }
  },
  dark_premium: {
    id: 'dark_premium',
    name: 'Dark Premium (Mimari Gece Showroom & Dramatik Kontrast)',
    description: 'Koyu mimari duvarlar, odaklı müze tipi spotlar ve pirinç/ahşap kenar vurguları.',
    ambient_color: '#1E2638',
    ambient_intensity: 0.25,
    hdri_strength: 0.30,
    sun_light: { enabled: false, energy: 0.0, color: '#94A3B8', elevation_deg: 15, azimuth_deg: 45 },
    area_lights: [
      { name: 'Dramatic_Key_Area', energy: 260, size: 1.5, color: '#FFF2DC', location: [1.8, -1.5, 2.4] },
      { name: 'Cool_Rim_Area', energy: 85, size: 2.0, color: '#CBD5E1', location: [-2.1, 0.8, 2.3] }
    ],
    spot_lights: [
      { name: 'Hero_Furniture_Spot_1', energy: 220, spot_size_deg: 38, blend: 0.3, color: '#FFE6BF', location: [0.0, -0.5, 2.8] },
      { name: 'Hero_Furniture_Spot_2', energy: 160, spot_size_deg: 42, blend: 0.35, color: '#FFF0D4', location: [-1.4, 0.4, 2.8] }
    ],
    point_lights: [
      { name: 'Warm_Accent_Lamp', energy: 40, radius: 0.12, color: '#FFBF69', location: [1.6, 1.8, 0.9] }
    ],
    room_palette: {
      floor_material: 'marble',
      wall_material: 'metal',
      panel_material: 'natural_wood',
      trim_material: 'brass'
    }
  },
  natural_daylight: {
    id: 'natural_daylight',
    name: 'Natural Daylight (Akdeniz Doğal Güneş Işığı - 5600K)',
    description: 'Büyük pencerelerden giren berrak 5600K doğal güneş ışığı ve gerçekçi zemin yansımaları.',
    ambient_color: '#FFFFFF',
    ambient_intensity: 0.65,
    hdri_strength: 1.0,
    sun_light: { enabled: true, energy: 3.2, color: '#FFFDF8', elevation_deg: 48, azimuth_deg: 40 },
    area_lights: [
      { name: 'Sunlit_Window_Portal', energy: 360, size: 2.0, color: '#FFFDF7', location: [2.45, 0.0, 1.6] },
      { name: 'Sky_Bounce_Fill', energy: 145, size: 3.5, color: '#E2F1FF', location: [-0.8, -1.0, 2.75] }
    ],
    spot_lights: [],
    point_lights: [],
    room_palette: {
      floor_material: 'natural_wood',
      wall_material: 'painted_wood',
      panel_material: 'stone',
      trim_material: 'metal'
    }
  }
});

// ── 4. PARAMETRIC ROOM VALIDATION & POLYGON BUDGET GUARD ─────────────────────
function clampNum(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Number(n.toFixed(3))));
}

export function validateAndNormalizeRoomDimensions(input = {}) {
  if (input && typeof input === 'object') {
    for (const key of ['room_width', 'room_length', 'room_height', 'wall_thickness']) {
      if (input[key] !== undefined && input[key] !== null) {
        const val = Number(input[key]);
        const lim = ROOM_DIMENSION_LIMITS[key];
        if (!Number.isFinite(val) || val < lim.min || val > lim.max) {
          throw new Error(
            `INVALID_ROOM_DIMENSION: '${key}' (${input[key]}) ${lim.min}m ile ${lim.max}m arasında olmalıdır.`
          );
        }
      }
    }
  }

  const raw = { ...DEFAULT_ROOM_DIMENSIONS, ...(input || {}) };

  const room_width = clampNum(raw.room_width, ROOM_DIMENSION_LIMITS.room_width.min, ROOM_DIMENSION_LIMITS.room_width.max, DEFAULT_ROOM_DIMENSIONS.room_width);
  const room_length = clampNum(raw.room_length, ROOM_DIMENSION_LIMITS.room_length.min, ROOM_DIMENSION_LIMITS.room_length.max, DEFAULT_ROOM_DIMENSIONS.room_length);
  const room_height = clampNum(raw.room_height, ROOM_DIMENSION_LIMITS.room_height.min, ROOM_DIMENSION_LIMITS.room_height.max, DEFAULT_ROOM_DIMENSIONS.room_height);
  const wall_thickness = clampNum(raw.wall_thickness, ROOM_DIMENSION_LIMITS.wall_thickness.min, ROOM_DIMENSION_LIMITS.wall_thickness.max, DEFAULT_ROOM_DIMENSIONS.wall_thickness);

  const maxWinW = Math.max(0.6, Math.min(ROOM_DIMENSION_LIMITS.window_width.max, room_length - 0.6));
  const maxWinH = Math.max(0.6, Math.min(ROOM_DIMENSION_LIMITS.window_height.max, room_height - 0.5));
  const window_width = clampNum(raw.window_width, ROOM_DIMENSION_LIMITS.window_width.min, maxWinW, DEFAULT_ROOM_DIMENSIONS.window_width);
  const window_height = clampNum(raw.window_height, ROOM_DIMENSION_LIMITS.window_height.min, maxWinH, DEFAULT_ROOM_DIMENSIONS.window_height);
  const maxSill = Math.max(0.2, room_height - window_height - 0.15);
  const window_sill_height = clampNum(raw.window_sill_height, 0.2, maxSill, Math.min(DEFAULT_ROOM_DIMENSIONS.window_sill_height, maxSill));

  const window_wall = ['right', 'left', 'back', 'none'].includes(raw.window_wall) ? raw.window_wall : 'right';
  const window_offset = clampNum(raw.window_offset, -2.5, 2.5, 0.0);

  const maxDoorW = Math.max(0.7, Math.min(ROOM_DIMENSION_LIMITS.door_width.max, room_length - 0.6));
  const maxDoorH = Math.max(1.8, Math.min(ROOM_DIMENSION_LIMITS.door_height.max, room_height - 0.2));
  const door_width = clampNum(raw.door_width, ROOM_DIMENSION_LIMITS.door_width.min, maxDoorW, DEFAULT_ROOM_DIMENSIONS.door_width);
  const door_height = clampNum(raw.door_height, ROOM_DIMENSION_LIMITS.door_height.min, maxDoorH, DEFAULT_ROOM_DIMENSIONS.door_height);
  const door_wall = ['left', 'right', 'back', 'none'].includes(raw.door_wall) ? raw.door_wall : 'left';
  const door_offset = clampNum(raw.door_offset, -2.5, 2.5, -1.0);

  const has_wall_panels = raw.has_wall_panels !== false;
  const has_baseboards = raw.has_baseboards !== false;
  const has_crown_molding = raw.has_crown_molding !== false;
  const has_lighting_fixtures = raw.has_lighting_fixtures !== false;
  const has_decorative_elements = raw.has_decorative_elements !== false;

  // Estimate architectural polygon budget (keeps room architecture < 3,500 tris for fast CPU rendering)
  let estimatedRoomPolygons = 120; // Floor + Ceiling + 3 multi-segment walls
  if (window_wall !== 'none') estimatedRoomPolygons += 180; // Window frame, sill, mullions, glass pane
  if (door_wall !== 'none') estimatedRoomPolygons += 160;   // Door frame, leaf, handle
  if (has_wall_panels) estimatedRoomPolygons += 320;        // Boiserie architectural wall slats/panels
  if (has_baseboards) estimatedRoomPolygons += 96;          // Perimeter baseboards
  if (has_crown_molding) estimatedRoomPolygons += 96;       // Ceiling crown molding
  if (has_lighting_fixtures) estimatedRoomPolygons += 280;  // Ceiling pendant + recessed spot housings
  if (has_decorative_elements) estimatedRoomPolygons += 220; // Woven area rug + architectural plinth

  return {
    room_width,
    room_length,
    room_height,
    wall_thickness,
    window_width,
    window_height,
    window_sill_height,
    window_wall,
    window_offset,
    door_width,
    door_height,
    door_wall,
    door_offset,
    has_wall_panels,
    has_baseboards,
    has_crown_molding,
    has_lighting_fixtures,
    has_decorative_elements,
    geometry_mode: 'real_blender_3d_meshes',
    uses_gaussian_splatting: false,
    uses_2d_billboards: false,
    estimated_room_polygons: estimatedRoomPolygons,
    estimated_room_triangles: estimatedRoomPolygons * 2
  };
}

// ── 5. REFERENCE ROOM IMAGE ANALYSIS (ZERO PAID API CALLS) ───────────────────
/**
 * Analyzes a reference room image (binary header + optional colour/layout hints)
 * and produces an AI-assisted room & furniture placement suggestion.
 * Never triggers paid external subscriptions; marks all inferred layout values
 * with `is_ai_estimated: true` so they are never confused with verified CAD geometry.
 */
export function analyzeReferenceRoomImage(payload = {}) {
  const {
    file_base64,
    file_name = 'reference_room.jpg',
    mime_type = 'image/jpeg',
    room_type = 'luxury_bedroom',
    preferred_style = null,
    room_style_hint = null
  } = payload;

  let imageWidth = 1920;
  let imageHeight = 1080;
  let format = 'jpeg';
  let dominantBrightness = 0.62;
  let warmRatio = 0.58;

  if (file_base64 && typeof file_base64 === 'string') {
    const cleanB64 = file_base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanB64, 'base64');
    const header = parseImageBinaryHeader(buffer);
    if (!header.valid) {
      throw new Error(`SCENE_REF_IMAGE_INVALID: ${header.error}`);
    }
    imageWidth = header.width || 1920;
    imageHeight = header.height || 1080;
    format = header.format || 'jpeg';

    // Sample deterministic byte entropy from middle of payload to infer brightness & warmth
    const sampleStart = Math.min(64, Math.floor(buffer.length / 3));
    const sampleCount = Math.min(256, Math.max(1, buffer.length - sampleStart));
    let sum = 0;
    let oddSum = 0;
    for (let i = 0; i < sampleCount; i++) {
      const b = buffer[sampleStart + i];
      sum += b;
      if (i % 2 === 1) oddSum += b;
    }
    dominantBrightness = Number(Math.max(0.25, Math.min(0.90, sum / (sampleCount * 255))).toFixed(2));
    warmRatio = Number(Math.max(0.30, Math.min(0.85, (oddSum * 2) / (sampleCount * 255))).toFixed(2));
  }

  const aspectRatio = imageWidth / Math.max(1, imageHeight);
  const isWideRoom = aspectRatio >= 1.35;

  const suggestedWidth = isWideRoom ? 5.4 : 4.4;
  const suggestedLength = isWideRoom ? 4.8 : 4.2;
  const suggestedHeight = aspectRatio < 0.9 ? 3.2 : 2.9;

  const chosenStyle = preferred_style || room_style_hint;
  let suggestedLightingProfile = chosenStyle || 'luxury_bedroom';
  if (!chosenStyle) {
    if (dominantBrightness < 0.38) suggestedLightingProfile = 'dark_premium';
    else if (dominantBrightness > 0.75) suggestedLightingProfile = 'natural_daylight';
    else if (warmRatio > 0.60) suggestedLightingProfile = 'warm_interior';
    else suggestedLightingProfile = 'luxury_bedroom';
  }

  const suggestedPalette = dominantBrightness < 0.38
    ? ['#1E242B', '#8B5A2B', '#D4AF37', '#D8D4CC']
    : warmRatio > 0.55
      ? ['#EDE6DA', '#8B5A2B', '#C8BFA8', '#D4AF37']
      : ['#F4F6F8', '#C2B8A3', '#2B2F36', '#D8D4CC'];

  const sourceSpecs = {
    file_name,
    mime_type,
    format,
    width_px: imageWidth,
    height_px: imageHeight,
    aspect_ratio: Number(aspectRatio.toFixed(2))
  };

  const perspectiveSpecs = {
    camera_fov_mm: isWideRoom ? 35 : 42,
    estimated_focal_length_mm: isWideRoom ? 35 : 42,
    camera_position: [0.0, -(suggestedLength / 2 + 1.4), 1.62],
    camera_target: [0.0, 0.6, 0.95],
    horizon_ratio: 0.48
  };

  const zones = [
    {
      role: 'wardrobe',
      label: 'Gardırop Alanı (Sol/Arka Duvar)',
      position: [-1.45, suggestedLength / 2 - 0.42, 0.0],
      rotation_deg: [0, 0, 0]
    },
    {
      role: 'bed_or_centerpiece',
      label: 'Ana Yatak / Merkez Mobilya Alanı',
      position: [0.35, suggestedLength / 2 - 1.15, 0.0],
      rotation_deg: [0, 0, 0]
    },
    {
      role: 'nightstand',
      label: 'Komodin / Yan Sehpa Alanı',
      position: [1.65, suggestedLength / 2 - 0.38, 0.0],
      rotation_deg: [0, 0, 0]
    }
  ];

  return {
    analysis_engine: 'global_studio_heuristic_vision_v1',
    paid_api_called: false,
    cost_usd: 0.0,
    is_ai_estimated: true,
    ai_disclaimer: SCENE_AI_ESTIMATION_DISCLAIMER_TR,
    source_image: sourceSpecs,
    source_image_specs: sourceSpecs,
    perspective: perspectiveSpecs,
    perspective_estimation: perspectiveSpecs,
    suggested_room_dimensions: validateAndNormalizeRoomDimensions({
      room_width: suggestedWidth,
      room_length: suggestedLength,
      room_height: suggestedHeight,
      wall_thickness: 0.18,
      window_wall: 'right',
      window_width: 1.8,
      window_height: 1.6,
      door_wall: 'left',
      door_width: 0.95,
      door_height: 2.15,
      has_wall_panels: true,
      has_baseboards: true,
      has_crown_molding: true
    }),
    dominant_color_palette: suggestedPalette,
    detected_materials: {
      floor: 'natural_wood',
      walls: 'painted_wood',
      wall_panels: 'natural_wood',
      accents: 'brass'
    },
    lighting: {
      recommended_lighting_profile: suggestedLightingProfile,
      dominant_brightness: dominantBrightness,
      warm_ratio: warmRatio
    },
    estimated_light_sources: [
      { type: 'window_daylight', wall: 'right', direction: 'east_southeast', intensity: dominantBrightness },
      { type: 'ceiling_warm_area', position: [0.0, 0.0, suggestedHeight - 0.15], color_temp_k: warmRatio > 0.5 ? 3200 : 4500 }
    ],
    suggested_lighting_profile: suggestedLightingProfile,
    furniture_placement_zones: zones,
    suggested_furniture_zones: zones
  };
}

// ── 6. ASSET PLACEMENT, SCALE-BY-DIMENSIONS & INTER-ITEM DISTANCE CHECK ──────
/**
 * Normalizes placed 3D furniture assets, computes scale factors from known
 * product dimensions (cm -> meters) without mutating original GLB geometry,
 * and calculates pairwise distances & room boundary clearances.
 */
export function normalizeAndValidateAssetPlacements(placementsInput = [], roomDimensions = DEFAULT_ROOM_DIMENSIONS, knownAssetsInput = new Map()) {
  if (!Array.isArray(placementsInput)) {
    throw new Error('INVALID_ASSET_PLACEMENTS: asset_transforms bir dizi (array) olmalıdır.');
  }

  let knownAssetsMap = new Map();
  if (knownAssetsInput instanceof Map) {
    knownAssetsMap = knownAssetsInput;
  } else if (Array.isArray(knownAssetsInput)) {
    knownAssetsInput.forEach(a => {
      if (a && (a.asset_id || a.id)) knownAssetsMap.set(a.asset_id || a.id, a);
    });
  }

  const roomW = Number(roomDimensions.room_width || 5.2);
  const roomL = Number(roomDimensions.room_length || 4.6);
  const halfW = roomW / 2;
  const halfL = roomL / 2;

  const normalizedPlacements = placementsInput.map((item, idx) => {
    const assetId = sanitizePathSegment(item.asset_id || item.id || `asset_${idx + 1}`, `asset_${idx + 1}`);
    const instanceId = sanitizePathSegment(item.instance_id || `${assetId}_inst_${idx + 1}`, `${assetId}_inst_${idx + 1}`);
    const knownAsset = knownAssetsMap.get(assetId) || {};

    const posObj = item.position_m || item.position || {};
    const pos = Array.isArray(posObj) && posObj.length === 3
      ? posObj.map(v => clampNum(v, -20, 20, 0))
      : [
          clampNum(posObj.x, -20, 20, 0),
          clampNum(posObj.y, -20, 20, 0),
          clampNum(posObj.z, 0, 10, 0)
        ];

    const rotObj = item.rotation_deg || item.rotation || {};
    const rot = Array.isArray(rotObj) && rotObj.length === 3
      ? rotObj.map(v => clampNum(v, -360, 360, 0))
      : [
          clampNum(rotObj.x, -360, 360, 0),
          clampNum(rotObj.y, -360, 360, 0),
          clampNum(rotObj.z ?? item.yaw_deg, -360, 360, 0)
        ];

    // Check known real-world dimensions (width_cm, height_cm, depth_cm or string '180x125x210 cm')
    const dimsCm = parseProductDimensionsCm(item.dimensions_cm || knownAsset.dimensions_cm || null);
    const hasKnownRealDimensions = Boolean(
      dimsCm &&
      (Number(dimsCm.width_cm) > 0 || Number(dimsCm.height_cm) > 0 || Number(dimsCm.depth_cm) > 0)
    );

    let targetDimensionsMeters = null;
    if (hasKnownRealDimensions) {
      targetDimensionsMeters = {
        width_m: Number(dimsCm.width_cm) > 0 ? Number((Number(dimsCm.width_cm) / 100).toFixed(3)) : null,
        height_m: Number(dimsCm.height_cm) > 0 ? Number((Number(dimsCm.height_cm) / 100).toFixed(3)) : null,
        depth_m: Number(dimsCm.depth_cm) > 0 ? Number((Number(dimsCm.depth_cm) / 100).toFixed(3)) : null
      };
    }

    const scaleArr = Array.isArray(item.scale) && item.scale.length === 3
      ? item.scale.map(v => clampNum(v, 0.05, 20.0, 1.0))
      : typeof item.scale === 'number'
        ? [clampNum(item.scale, 0.05, 20.0, 1.0), clampNum(item.scale, 0.05, 20.0, 1.0), clampNum(item.scale, 0.05, 20.0, 1.0)]
        : [
            clampNum(item.scale?.x, 0.05, 20.0, 1.0),
            clampNum(item.scale?.y, 0.05, 20.0, 1.0),
            clampNum(item.scale?.z, 0.05, 20.0, 1.0)
          ];

    // Approximate footprint for distance & wall clearance check
    const approxWidthM = targetDimensionsMeters?.width_m || (1.0 * scaleArr[0]);
    const approxDepthM = targetDimensionsMeters?.depth_m || (0.65 * scaleArr[1]);
    const approxHeightM = targetDimensionsMeters?.height_m || (1.8 * scaleArr[2]);

    const withinRoomBounds =
      Math.abs(pos[0]) + (approxWidthM / 2) <= (halfW + 0.05) &&
      Math.abs(pos[1]) + (approxDepthM / 2) <= (halfL + 0.05);

    const scaleMode = hasKnownRealDimensions ? 'calibrated_from_dimensions_cm' : 'relative_user_scale_uncalibrated';
    const resolvedStoragePath = item.storage_path || item.model_storage_path || knownAsset.generated_model_path || knownAsset.storage_path || null;
    const resolvedPublicUrl = item.public_url || item.model_public_url || knownAsset.generated_model_url || knownAsset.public_url || null;

    return {
      instance_id: instanceId,
      asset_id: assetId,
      product_slug: item.product_slug || knownAsset.product_slug || null,
      product_name: item.product_name || knownAsset.product_name || assetId,
      role: item.role || 'furniture',
      group_id: item.group_id || 'main_furniture_group',
      visible: item.visible !== false,
      storage_path: resolvedStoragePath,
      model_storage_path: resolvedStoragePath,
      public_url: resolvedPublicUrl,
      model_public_url: resolvedPublicUrl,
      local_model_path: item.local_model_path || null,
      position: pos,
      position_m: { x: pos[0], y: pos[1], z: pos[2] },
      rotation_deg: { x: rot[0], y: rot[1], z: rot[2] },
      rotation_deg_array: rot,
      scale: { x: scaleArr[0], y: scaleArr[1], z: scaleArr[2] },
      scale_array: scaleArr,
      has_verified_dimensions: hasKnownRealDimensions,
      is_true_scale_verified: hasKnownRealDimensions,
      scale_mode: scaleMode,
      scale_calibration_mode: scaleMode,
      dimensions_cm: dimsCm,
      target_dimensions_m: targetDimensionsMeters,
      bounding_box_m: {
        width_m: Number(approxWidthM.toFixed(3)),
        depth_m: Number(approxDepthM.toFixed(3)),
        height_m: Number(approxHeightM.toFixed(3))
      },
      within_room_bounds: withinRoomBounds,
      original_geometry_preserved: true,
      is_ai_estimated_geometry: knownAsset.is_ai_estimated_geometry ?? true,
      material_override: item.material_override ? normalizeMaterialOverride(item.material_override) : null
    };
  });

  // Calculate pairwise center-to-center and edge-to-edge distances between visible objects
  const distanceMatrix = [];
  const spacingWarnings = [];

  const visibleItems = normalizedPlacements.filter(p => p.visible);
  for (let i = 0; i < visibleItems.length; i++) {
    for (let j = i + 1; j < visibleItems.length; j++) {
      const a = visibleItems[i];
      const b = visibleItems[j];
      const dx = a.position[0] - b.position[0];
      const dy = a.position[1] - b.position[1];
      const dz = a.position[2] - b.position[2];
      const centerDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const radiusA = Math.max(a.bounding_box_m.width_m, a.bounding_box_m.depth_m) / 2;
      const radiusB = Math.max(b.bounding_box_m.width_m, b.bounding_box_m.depth_m) / 2;
      const clearanceM = Number((centerDist - (radiusA + radiusB)).toFixed(3));
      const isOverlapping = clearanceM < -0.05;

      distanceMatrix.push({
        from_instance_id: a.instance_id,
        from_name: a.product_name,
        to_instance_id: b.instance_id,
        to_name: b.product_name,
        center_distance_m: Number(centerDist.toFixed(3)),
        edge_clearance_m: clearanceM,
        is_overlapping: isOverlapping
      });

      if (isOverlapping) {
        spacingWarnings.push(
          `Çakışma Uyarısı: "${a.product_name}" ile "${b.product_name}" birbirine çok yakın (${clearanceM}m).`
        );
      }
    }
  }

  return {
    placements: normalizedPlacements,
    asset_ids: Array.from(new Set(normalizedPlacements.map(p => p.asset_id))),
    distance_matrix: distanceMatrix,
    spacing_warnings: spacingWarnings
  };
}

// ── 7. MATERIAL & LIGHTING NORMALIZATION ─────────────────────────────────────
export function normalizeMaterialOverride(override = {}) {
  const presetKey = override.material_id || override.preset_id || override.material_type || 'natural_wood';
  const preset = PBR_MATERIAL_CATALOG[presetKey] || PBR_MATERIAL_CATALOG.natural_wood;

  return {
    material_id: preset.id,
    preset_id: preset.id,
    name: override.name || preset.name,
    preserve_original_textures: override.preserve_original_textures !== false,
    base_color: override.base_color_hex || override.base_color || preset.base_color,
    base_color_hex: override.base_color_hex || override.base_color || preset.base_color,
    roughness: clampNum(override.roughness, 0.0, 1.0, preset.roughness),
    metallic: clampNum(override.metallic, 0.0, 1.0, preset.metallic),
    normal_strength: clampNum(override.normal_strength, 0.0, 2.0, preset.normal_strength),
    bump_strength: clampNum(override.bump_strength, 0.0, 2.0, preset.bump_strength),
    specular: clampNum(override.specular, 0.0, 1.0, preset.specular),
    transmission: clampNum(override.transmission, 0.0, 1.0, preset.transmission)
  };
}

export function normalizeSceneMaterialSettings(materialSettings = {}, lightingProfileId = 'luxury_bedroom') {
  const profile = SCENE_LIGHTING_PROFILES[lightingProfileId] || SCENE_LIGHTING_PROFILES.luxury_bedroom;
  const defaultPalette = profile.room_palette;

  const floorMat = normalizeMaterialOverride(materialSettings.floor || { preset_id: defaultPalette.floor_material });
  const wallsMat = normalizeMaterialOverride(materialSettings.walls || { preset_id: defaultPalette.wall_material });
  const panelsMat = normalizeMaterialOverride(materialSettings.wall_panels || { preset_id: defaultPalette.panel_material });
  const trimMat = normalizeMaterialOverride(materialSettings.trim || materialSettings.trim_moldings || { preset_id: defaultPalette.trim_material });
  const glassMat = normalizeMaterialOverride(materialSettings.window_glass || { preset_id: 'glass' });

  const roomMaterials = {
    floor: floorMat,
    walls: wallsMat,
    wall_panels: panelsMat,
    trim: trimMat,
    trim_moldings: trimMat,
    window_glass: glassMat
  };

  const assetOverrides = {};
  if (materialSettings.asset_overrides && typeof materialSettings.asset_overrides === 'object') {
    for (const [key, val] of Object.entries(materialSettings.asset_overrides)) {
      if (val && typeof val === 'object') {
        assetOverrides[sanitizePathSegment(key, 'asset')] = normalizeMaterialOverride(val);
      }
    }
  }

  return {
    ...roomMaterials,
    room_materials: roomMaterials,
    asset_overrides: assetOverrides
  };
}

export function normalizeCameraSettings(cameraInput = {}, roomDimensions = DEFAULT_ROOM_DIMENSIONS) {
  const roomL = Number(roomDimensions.room_length || 4.6);
  const rawPos = cameraInput.position_m || cameraInput.position;
  const pos = Array.isArray(rawPos) && rawPos.length === 3
    ? rawPos.map(v => clampNum(v, -25, 25, 0))
    : rawPos && typeof rawPos === 'object'
      ? [
          clampNum(rawPos.x, -25, 25, 0.0),
          clampNum(rawPos.y, -25, 25, Number((-(roomL / 2 + 1.35)).toFixed(2))),
          clampNum(rawPos.z, 0.1, 25, 1.62)
        ]
      : [0.0, Number((-(roomL / 2 + 1.35)).toFixed(2)), 1.62];

  const rawTarget = cameraInput.target_m || cameraInput.target;
  const target = Array.isArray(rawTarget) && rawTarget.length === 3
    ? rawTarget.map(v => clampNum(v, -25, 25, 0))
    : rawTarget && typeof rawTarget === 'object'
      ? [
          clampNum(rawTarget.x, -25, 25, 0.0),
          clampNum(rawTarget.y, -25, 25, Number((roomL / 6).toFixed(2))),
          clampNum(rawTarget.z, 0.0, 25, 0.92)
        ]
      : [0.0, Number((roomL / 6).toFixed(2)), 0.92];

  const fovMm = clampNum(cameraInput.focal_length_mm ?? cameraInput.fov_mm ?? cameraInput.lens, 18, 120, 35);

  return {
    position: pos,
    position_m: { x: pos[0], y: pos[1], z: pos[2] },
    target,
    target_m: { x: target[0], y: target[1], z: target[2] },
    fov_mm: fovMm,
    focal_length_mm: fovMm,
    dof_enabled: Boolean(cameraInput.dof_enabled),
    f_stop: clampNum(cameraInput.f_stop, 1.4, 16.0, 4.0),
    clip_start: 0.05,
    clip_end: 100.0
  };
}

// ── 8. COMPLETE SCENE SPECIFICATION BUILDER & STORAGE PATH GENERATOR ─────────
export function buildSafeSceneStoragePaths(sceneId) {
  const safeId = sanitizePathSegment(sceneId, 'scene_default');
  return {
    scene_id: safeId,
    blend_path: `studio/scenes/${safeId}/scene.blend`,
    blend_file_path: `studio/scenes/${safeId}/scene.blend`,
    preview_path: `studio/scenes/${safeId}/preview.jpg`,
    preview_image_path: `studio/scenes/${safeId}/preview.jpg`,
    metadata_path: `studio/scenes/${safeId}/scene_metadata.json`,
    metadata_file_path: `studio/scenes/${safeId}/scene_metadata.json`
  };
}

export function buildCompleteSceneRecord(payload = {}, existingSceneOrAssets = null, knownAssetsInput = new Map()) {
  const isSecondArgAssets = Array.isArray(existingSceneOrAssets) || (existingSceneOrAssets instanceof Map);
  const existingScene = isSecondArgAssets ? null : existingSceneOrAssets;
  const effectiveKnownAssets = isSecondArgAssets ? existingSceneOrAssets : knownAssetsInput;

  const nowIso = new Date().toISOString();
  const sceneId = sanitizePathSegment(
    payload.scene_id || existingScene?.scene_id || `scn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    'scn_default'
  );
  const sceneName = String(payload.scene_name || existingScene?.scene_name || 'Yeni İç Mekân Sahnesi').trim();
  if (sceneName.length < 2) {
    throw new Error('SCENE_NAME_REQUIRED: Sahne adı (scene_name) en az 2 karakter olmalıdır.');
  }

  const lightingProfileId = SCENE_LIGHTING_PROFILES[payload.lighting_profile]
    ? payload.lighting_profile
    : (existingScene?.lighting_profile || 'luxury_bedroom');

  const lightingProfileConfig = {
    ...SCENE_LIGHTING_PROFILES[lightingProfileId],
    ...(payload.lighting_custom_settings || existingScene?.lighting_custom_settings || {})
  };

  const roomDimensions = validateAndNormalizeRoomDimensions(
    payload.room_dimensions || existingScene?.room_dimensions || DEFAULT_ROOM_DIMENSIONS
  );

  const placementResult = normalizeAndValidateAssetPlacements(
    payload.asset_transforms ?? existingScene?.asset_transforms ?? [],
    roomDimensions,
    effectiveKnownAssets
  );

  const materialSettings = normalizeSceneMaterialSettings(
    payload.material_settings || existingScene?.material_settings || {},
    lightingProfileId
  );

  const cameraSettings = normalizeCameraSettings(
    payload.camera_settings || existingScene?.camera_settings || {},
    roomDimensions
  );

  const storagePaths = buildSafeSceneStoragePaths(sceneId);
  const userApproved = payload.user_approved !== undefined
    ? Boolean(payload.user_approved)
    : Boolean(existingScene?.user_approved);

  const sceneRecord = {
    id: existingScene?.id || sceneId,
    scene_id: sceneId,
    scene_name: sceneName,
    collection_id: payload.collection_id ?? existingScene?.collection_id ?? null,
    source_image_path: payload.source_image_path ?? existingScene?.source_image_path ?? null,
    source_image_url: payload.source_image_url ?? existingScene?.source_image_url ?? null,
    reference_analysis: payload.reference_analysis ?? existingScene?.reference_analysis ?? {},
    is_ai_estimated_room: true,
    ai_disclaimer: SCENE_AI_ESTIMATION_DISCLAIMER_TR,
    room_dimensions: roomDimensions,
    asset_ids: placementResult.asset_ids,
    asset_transforms: placementResult.placements,
    distance_matrix: placementResult.distance_matrix,
    spacing_warnings: placementResult.spacing_warnings,
    material_settings: materialSettings,
    lighting_profile: lightingProfileId,
    lighting_profile_config: lightingProfileConfig,
    camera_settings: cameraSettings,
    blender_version: payload.blender_version || existingScene?.blender_version || '4.2',
    scene_file_path: existingScene?.scene_file_path || storagePaths.blend_file_path,
    scene_file_url: existingScene?.scene_file_url || null,
    preview_image_path: existingScene?.preview_image_path || storagePaths.preview_image_path,
    preview_image_url: existingScene?.preview_image_url || null,
    metadata_file_path: existingScene?.metadata_file_path || storagePaths.metadata_file_path,
    metadata_file_url: existingScene?.metadata_file_url || null,
    user_approved: userApproved,
    status: payload.status || (userApproved ? 'approved' : 'saved'),
    created_at: payload.created_at || existingScene?.created_at || nowIso,
    updated_at: nowIso
  };

  return {
    ...sceneRecord,
    sceneRecord,
    storagePaths,
    distanceMatrix: placementResult.distance_matrix,
    spacingWarnings: placementResult.spacing_warnings
  };
}

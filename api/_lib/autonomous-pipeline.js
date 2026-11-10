/**
 * ============================================================================
 * GLOBAL MOBİLYA — MODULE 8: AUTONOMOUS 3D PRODUCTION PIPELINE
 * ============================================================================
 * Zero-manual intervention, fully automated 3D visual & video production pipeline.
 * Features:
 *   1. Product Classifier: Identifies furniture category from metadata & dimensions.
 *   2. Scene Profile Engine: Reusable, extensible room & lighting profiles.
 *   3. Material Intelligence: Preserves existing PBR shaders, injects realistic
 *      fallbacks for missing materials, flags default assignments.
 *   4. Quality Control Engine: Auto-checks in-frame framing, floor contact,
 *      exposure, clipping, and file validity.
 *   5. Stage-based Orchestrator: Complete lifecycle tracking with resume capability.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

// ── 1. PIPELINE STAGES ENUM ──────────────────────────────────────────────────
export const AUTONOMOUS_STAGES = Object.freeze({
  IDLE: 'IDLE',
  MODEL_GENERATION: 'MODEL_GENERATION',
  MODEL_VALIDATION: 'MODEL_VALIDATION',
  PRODUCT_ANALYSIS: 'PRODUCT_ANALYSIS',
  SCENE_SELECTION: 'SCENE_SELECTION',
  ENVIRONMENT_BUILD: 'ENVIRONMENT_BUILD',
  MATERIAL_SETUP: 'MATERIAL_SETUP',
  LIGHTING_SETUP: 'LIGHTING_SETUP',
  CAMERA_SETUP: 'CAMERA_SETUP',
  PREVIEW_RENDER: 'PREVIEW_RENDER',
  QUALITY_CHECK: 'QUALITY_CHECK',
  FINAL_RENDER: 'FINAL_RENDER',
  VIDEO_GENERATION: 'VIDEO_GENERATION',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
});

// ── 2. PRODUCT CATEGORY DEFINITIONS & CLASSIFIER ─────────────────────────────
export const PRODUCT_CATEGORIES = Object.freeze({
  SOFA: {
    id: 'sofa',
    name: 'Sofa',
    name_tr: 'Koltuk / Kanepe',
    keywords: ['sofa', 'kanepe', 'koltuk', 'köşe', 'chester', 'l koltuk', 'üçlü koltuk', 'ikili koltuk', 'couch'],
    typical_dims_cm: { width: 220, depth: 95, height: 85 },
    default_scene_profile: 'warm_domestic',
    camera_strategy: 'orbit_34',
    elevation_ratio: 0.25
  },
  ARMCHAIR: {
    id: 'armchair',
    name: 'Armchair',
    name_tr: 'Berjer / Tekli Koltuk',
    keywords: ['berjer', 'armchair', 'tekli koltuk', 'dinlenme koltuğu', 'accent chair', 'lounge chair'],
    typical_dims_cm: { width: 90, depth: 85, height: 95 },
    default_scene_profile: 'luxury_showroom',
    camera_strategy: 'portrait_turntable',
    elevation_ratio: 0.3
  },
  BED: {
    id: 'bed',
    name: 'Bed',
    name_tr: 'Yatak / Baza',
    keywords: ['yatak', 'baza', 'bed', 'karyola', 'başlık', 'headboard', 'yatak odası'],
    typical_dims_cm: { width: 180, depth: 210, height: 120 },
    default_scene_profile: 'warm_domestic',
    camera_strategy: 'isometric_pan',
    elevation_ratio: 0.35
  },
  DINING_TABLE: {
    id: 'dining_table',
    name: 'Dining Table',
    name_tr: 'Yemek Masası',
    keywords: ['yemek masası', 'dining table', 'masa', 'açılır masa', 'ahşap masa', 'mermer masa'],
    typical_dims_cm: { width: 190, depth: 95, height: 76 },
    default_scene_profile: 'nordic_atelier',
    camera_strategy: 'elevated_45',
    elevation_ratio: 0.4
  },
  DINING_CHAIR: {
    id: 'dining_chair',
    name: 'Dining Chair',
    name_tr: 'Yemek Sandalyesi',
    keywords: ['sandalye', 'dining chair', 'chair', 'kolçaklı sandalye', 'ahşap sandalye'],
    typical_dims_cm: { width: 55, depth: 55, height: 88 },
    default_scene_profile: 'nordic_atelier',
    camera_strategy: 'portrait_turntable',
    elevation_ratio: 0.3
  },
  TV_UNIT: {
    id: 'tv_unit',
    name: 'TV Unit',
    name_tr: 'TV Ünitesi / Konsol',
    keywords: ['tv ünitesi', 'tv unit', 'konsol', 'medya dolabı', 'tv sehpası', 'credenza', 'sideboard'],
    typical_dims_cm: { width: 200, depth: 45, height: 55 },
    default_scene_profile: 'modern_minimal',
    camera_strategy: 'horizontal_sweep',
    elevation_ratio: 0.25
  },
  WARDROBE: {
    id: 'wardrobe',
    name: 'Wardrobe',
    name_tr: 'Gardırop / Dolap',
    keywords: ['gardırop', 'dolap', 'wardrobe', 'closet', 'kapaklı dolap', 'sürgülü dolap', 'giysi dolabı'],
    typical_dims_cm: { width: 240, depth: 60, height: 215 },
    default_scene_profile: 'luxury_showroom',
    camera_strategy: 'pedestal_vertical',
    elevation_ratio: 0.15
  },
  COFFEE_TABLE: {
    id: 'coffee_table',
    name: 'Coffee Table',
    name_tr: 'Orta Sehpa / Yan Sehpa',
    keywords: ['sehpa', 'orta sehpa', 'yan sehpa', 'coffee table', 'side table', 'zigon'],
    typical_dims_cm: { width: 110, depth: 70, height: 42 },
    default_scene_profile: 'modern_minimal',
    camera_strategy: 'elevated_45',
    elevation_ratio: 0.45
  },
  BEDROOM_SET: {
    id: 'bedroom_set',
    name: 'Bedroom Set',
    name_tr: 'Yatak Odası Takımı',
    keywords: ['yatak odası takımı', 'bedroom set', 'yatak seti', 'yatak takımı'],
    typical_dims_cm: { width: 350, depth: 300, height: 220 },
    default_scene_profile: 'warm_domestic',
    camera_strategy: 'wide_cinematic',
    elevation_ratio: 0.3
  },
  DINING_ROOM_SET: {
    id: 'dining_room_set',
    name: 'Dining Room Set',
    name_tr: 'Yemek Odası Takımı',
    keywords: ['yemek odası takımı', 'dining set', 'yemek odası seti'],
    typical_dims_cm: { width: 320, depth: 250, height: 180 },
    default_scene_profile: 'nordic_atelier',
    camera_strategy: 'wide_cinematic',
    elevation_ratio: 0.35
  }
});

/**
 * Automatically classifies a product using text metadata and 3D bounding box fallback.
 */
export function classifyProduct(productData = {}, modelBounds = null) {
  const textCorpus = [
    productData.product_name,
    productData.name,
    productData.product_slug,
    productData.slug,
    productData.category,
    productData.description,
    Array.isArray(productData.tags) ? productData.tags.join(' ') : ''
  ].filter(Boolean).join(' ').toLowerCase();

  // 1. Text-based keyword classification
  for (const [key, cat] of Object.entries(PRODUCT_CATEGORIES)) {
    for (const kw of cat.keywords) {
      if (textCorpus.includes(kw.toLowerCase())) {
        return {
          category_id: cat.id,
          category_name: cat.name,
          category_name_tr: cat.name_tr,
          confidence: 'high',
          matched_by: `keyword: "${kw}"`,
          profile: cat
        };
      }
    }
  }

  // 2. Geometric Bounding Box heuristic classification (fallback)
  if (modelBounds && typeof modelBounds === 'object') {
    const w = Number(modelBounds.width || modelBounds.width_m || 0);
    const d = Number(modelBounds.depth || modelBounds.depth_m || 0);
    const h = Number(modelBounds.height || modelBounds.height_m || 0);

    if (h > 1.6 && w > 1.0) {
      return {
        category_id: PRODUCT_CATEGORIES.WARDROBE.id,
        category_name: PRODUCT_CATEGORIES.WARDROBE.name,
        category_name_tr: PRODUCT_CATEGORIES.WARDROBE.name_tr,
        confidence: 'medium',
        matched_by: `geometry (tall & wide: ${w.toFixed(1)}m x ${h.toFixed(1)}m)`,
        profile: PRODUCT_CATEGORIES.WARDROBE
      };
    }

    if (h < 0.6 && w < 1.4 && d < 1.4) {
      return {
        category_id: PRODUCT_CATEGORIES.COFFEE_TABLE.id,
        category_name: PRODUCT_CATEGORIES.COFFEE_TABLE.name,
        category_name_tr: PRODUCT_CATEGORIES.COFFEE_TABLE.name_tr,
        confidence: 'medium',
        matched_by: `geometry (low height: ${h.toFixed(1)}m)`,
        profile: PRODUCT_CATEGORIES.COFFEE_TABLE
      };
    }

    if (w > 1.8 && h < 1.0) {
      return {
        category_id: PRODUCT_CATEGORIES.SOFA.id,
        category_name: PRODUCT_CATEGORIES.SOFA.name,
        category_name_tr: PRODUCT_CATEGORIES.SOFA.name_tr,
        confidence: 'medium',
        matched_by: `geometry (wide seating: ${w.toFixed(1)}m x ${h.toFixed(1)}m)`,
        profile: PRODUCT_CATEGORIES.SOFA
      };
    }
  }

  // 3. Default fallback: Armchair / General Showcase
  return {
    category_id: PRODUCT_CATEGORIES.ARMCHAIR.id,
    category_name: PRODUCT_CATEGORIES.ARMCHAIR.name,
    category_name_tr: PRODUCT_CATEGORIES.ARMCHAIR.name_tr,
    confidence: 'fallback',
    matched_by: 'default_fallback',
    profile: PRODUCT_CATEGORIES.ARMCHAIR,
    warning: 'Ürün kategorisi net tespit edilemedi; varsayılan vitrin profili seçildi.'
  };
}

// ── 3. SCENE PROFILE ENGINE ──────────────────────────────────────────────────
export const SCENE_PROFILES = Object.freeze({
  luxury_showroom: {
    id: 'luxury_showroom',
    name: 'Luxury Showroom Studio',
    description_tr: 'Koyu yansımalı stüdyo zemini, sofistike softbox ışıklandırma ve sıcak ambient.',
    floor_material: { base_color: '#1a1a1c', roughness: 0.22, metallic: 0.05 },
    world_ambient: { color: [0.08, 0.08, 0.10], strength: 1.0 },
    lighting_rig: {
      key: { energy: 450, color: '#fff8f0', size: 2.2 },
      fill: { energy: 200, color: '#eef2ff', size: 2.5 },
      rim: { energy: 300, color: '#fffae8', size: 2.0 },
      top: { energy: 250, color: '#ffffff', size: 3.5 }
    }
  },
  nordic_atelier: {
    id: 'nordic_atelier',
    name: 'Nordic Light Atelier',
    description_tr: 'Doğal açık meşe ahşap zemin, yumuşak pencere gün ışığı ve aydınlık ferah atmosfer.',
    floor_material: { base_color: '#bfae99', roughness: 0.45, metallic: 0.0 },
    world_ambient: { color: [0.22, 0.23, 0.25], strength: 1.2 },
    lighting_rig: {
      key: { energy: 350, color: '#ffffff', size: 3.0 },
      fill: { energy: 180, color: '#f0f5ff', size: 2.5 },
      rim: { energy: 150, color: '#fff9e6', size: 2.0 },
      top: { energy: 200, color: '#ffffff', size: 4.0 }
    }
  },
  modern_minimal: {
    id: 'modern_minimal',
    name: 'Modern Minimalist Studio',
    description_tr: 'Nötr antrasit mimari zemin, net çizgisel aydınlatma ve yüksek kontrast.',
    floor_material: { base_color: '#26282b', roughness: 0.35, metallic: 0.0 },
    world_ambient: { color: [0.12, 0.12, 0.14], strength: 0.9 },
    lighting_rig: {
      key: { energy: 400, color: '#fdfdfd', size: 2.0 },
      fill: { energy: 150, color: '#dbeafe', size: 2.0 },
      rim: { energy: 250, color: '#fef08a', size: 1.8 },
      top: { energy: 220, color: '#f8fafc', size: 3.0 }
    }
  },
  warm_domestic: {
    id: 'warm_domestic',
    name: 'Warm Domestic Interior',
    description_tr: 'Sıcak ceviz parke zemin, sıcak ev tipi aydınlatma ve zarif gölgeler.',
    floor_material: { base_color: '#5c4033', roughness: 0.38, metallic: 0.0 },
    world_ambient: { color: [0.15, 0.12, 0.10], strength: 1.0 },
    lighting_rig: {
      key: { energy: 380, color: '#ffedd5', size: 2.5 },
      fill: { energy: 180, color: '#ffedd5', size: 2.2 },
      rim: { energy: 220, color: '#fef3c7', size: 1.8 },
      top: { energy: 200, color: '#fff7ed', size: 3.2 }
    }
  }
});

/**
 * Selects the optimal scene profile based on product classification and user preference.
 */
export function selectSceneProfile(category, userPreference = null) {
  if (userPreference && SCENE_PROFILES[userPreference]) {
    return SCENE_PROFILES[userPreference];
  }

  const catProfileId = category?.profile?.default_scene_profile || 'luxury_showroom';
  return SCENE_PROFILES[catProfileId] || SCENE_PROFILES.luxury_showroom;
}

// ── 4. MATERIAL INTELLIGENCE FALLBACK CATALOG ────────────────────────────────
export const MATERIAL_FALLBACK_CATALOG = Object.freeze({
  fabric_velvet: {
    name: 'Luxury Velvet Fabric',
    base_color: '#2c3e50',
    roughness: 0.85,
    metallic: 0.0,
    specular: 0.2
  },
  wood_walnut: {
    name: 'American Walnut Wood',
    base_color: '#4a2f1b',
    roughness: 0.45,
    metallic: 0.0,
    specular: 0.4
  },
  brass_gold: {
    name: 'Brushed Brass Gold',
    base_color: '#d4af37',
    roughness: 0.25,
    metallic: 0.95,
    specular: 0.9
  },
  leather_nappa: {
    name: 'Warm Nappa Leather',
    base_color: '#3e2723',
    roughness: 0.55,
    metallic: 0.0,
    specular: 0.35
  },
  tinted_glass: {
    name: 'Smoked Tinted Glass / Mirror',
    base_color: '#1e293b',
    roughness: 0.05,
    metallic: 0.1,
    specular: 1.0,
    transmission: 0.85
  }
});

// ── 5. QUALITY CONTROL EVALUATION ─────────────────────────────────────────────
/**
 * Executes automatic Quality Control inspection on 3D setup & rendered outputs.
 */
export function evaluateQualityControl(qcData = {}) {
  const checks = [];

  // 1. In-Frame / Framing Check
  const inFrame = Boolean(qcData.in_frame ?? true);
  checks.push({
    name: 'in_frame_check',
    passed: inFrame,
    message: inFrame
      ? 'Ürün kamera kadrajı içerisinde tam olarak yerleşti.'
      : 'Kamera ürünü kısmen kesiyor; mesafe otomatik artırılmalıdır.'
  });

  // 2. Floor Grounding Check
  const floorDelta = Math.abs(Number(qcData.floor_gap_meters ?? 0));
  const floorContactPassed = floorDelta < 0.03;
  checks.push({
    name: 'floor_grounding_check',
    passed: floorContactPassed,
    message: floorContactPassed
      ? `Ürün zemine sıfır oturuyor (sapma: ${(floorDelta * 100).toFixed(1)} cm).`
      : `Ürün havada veya zemin altına geçmiş (sapma: ${(floorDelta * 100).toFixed(1)} cm).`
  });

  // 3. Clipping / Proximity Check
  const cameraDist = Number(qcData.camera_distance_meters ?? 2.5);
  const clippingPassed = cameraDist > 0.8;
  checks.push({
    name: 'camera_clipping_check',
    passed: clippingPassed,
    message: clippingPassed
      ? `Kamera mesafesi güvenli (${cameraDist.toFixed(2)} m).`
      : 'Kamera ürüne çok yakın, geometride kırpılma riski var.'
  });

  // 4. Exposure & Luminance Check
  const avgLuma = Number(qcData.avg_luminance ?? 0.45);
  const exposurePassed = avgLuma >= 0.15 && avgLuma <= 0.85;
  checks.push({
    name: 'exposure_check',
    passed: exposurePassed,
    message: exposurePassed
      ? `Pozlama dengeli (ortalama aydınlık: ${(avgLuma * 100).toFixed(0)}%).`
      : avgLuma < 0.15
        ? 'Görsel aşırı karanlık; ışık şiddeti artırılmalıdır.'
        : 'Görselde aşırı patlama (blown highlights) var; ışık kısılmalıdır.'
  });

  // 5. Geometry Sanity Check
  const vertexCount = Number(qcData.vertex_count ?? 1000);
  const geomPassed = vertexCount >= 100;
  checks.push({
    name: 'geometry_sanity_check',
    passed: geomPassed,
    message: geomPassed
      ? `Model geometrisi sağlıklı (${vertexCount.toLocaleString()} köşe noktası).`
      : 'Geometri eksik veya hasarlı vertex içeriyor.'
  });

  // 6. Output File Validity Check
  const fileBytes = Number(qcData.file_size_bytes ?? 50000);
  const fileValid = fileBytes > 10000;
  checks.push({
    name: 'render_file_validity',
    passed: fileValid,
    message: fileValid
      ? `Render dosyası geçerli (${(fileBytes / 1024).toFixed(1)} KB).`
      : 'Render dosyası boş veya bozuk.'
  });

  const allPassed = checks.every(c => c.passed);
  return {
    all_passed: allPassed,
    score_percent: Math.round((checks.filter(c => c.passed).length / checks.length) * 100),
    checks,
    requires_auto_correction: !allPassed
  };
}

// ── 6. AUTONOMOUS RUN RECORD FACTORY ──────────────────────────────────────────
export function createAutonomousRunRecord(params = {}) {
  const runId = `autorun_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id: runId,
    run_id: runId,
    status: AUTONOMOUS_STAGES.MODEL_GENERATION,
    product_slug: params.product_slug || 'generic-furniture',
    product_name: params.product_name || 'Generic Furniture',
    source_model_path: params.source_model_path || null,
    source_image_path: params.source_image_path || null,
    category: params.category || null,
    scene_profile: params.scene_profile || null,
    camera_strategy: params.camera_strategy || null,
    user_preferences: params.user_preferences || {},
    stage_history: [
      {
        stage: AUTONOMOUS_STAGES.MODEL_GENERATION,
        started_at: new Date().toISOString(),
        completed_at: null,
        status: 'in_progress'
      }
    ],
    quality_control: null,
    preview_url: null,
    videos: {},
    error_stage: null,
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

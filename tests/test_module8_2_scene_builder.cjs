/**
 * GLOBAL MOBİLYA — MODULE 8.2: AI SCENE BUILDER & ENVIRONMENT STUDIO TEST SUITE
 * ============================================================================
 * End-to-End Verification of:
 *   1. Reference Room Image Analysis ($0.00 Paid API Cost + AI Estimation Disclaimer)
 *   2. Parametric 3D Room Architecture Validation (Floor, Ceiling, Walls, Window, Door, Moldings)
 *   3. 11 PBR Material Definitions & 5 Cinematic Lighting Profiles
 *   4. Independent 3D Furniture Asset Placement, Scale Calibration (from dimensions_cm),
 *      Grouping, Visibility, Deletion, and Pairwise Distance / Collision Matrix
 *   5. Bedroom Prototype Test Scenario (1 Reference Bedroom Photo + 1 Validated Wardrobe GLB
 *      + Bed GLB + Nightstand GLB -> Scene Assembly -> Camera Placement -> Preview Render ->
 *      Save .blend -> Upload to Supabase Storage `studio/scenes/{scene_id}/...` ->
 *      Reload Scene & Verify Exact Restoration -> User Scene Approval Guard ->
 *      Low-Cost Test Render via Blender 4.2 Headless Render Worker Daemon)
 * ============================================================================
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
  BlenderRunner,
  inspectBlendSceneBuffer
} = require('../Sunucu/render-worker/blender-runner.js');
const { RenderWorkerDaemon } = require('../Sunucu/render-worker/worker-daemon.js');

// Helper: Build valid test JPEG buffer with explicit SOF0 width x height and warm interior RGB tone
function buildBedroomReferenceJpegBuffer(width = 1600, height = 1066) {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00
  ]);
  const sof0 = Buffer.alloc(19);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(17, 2);
  sof0[4] = 8;
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 3;
  sof0[10] = 1; sof0[11] = 0x11; sof0[12] = 0;
  sof0[13] = 2; sof0[14] = 0x11; sof0[15] = 0;
  sof0[16] = 3; sof0[17] = 0x11; sof0[18] = 0;

  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
  const scanPayload = Buffer.alloc(256, 0xc8); // Warm bright bedroom scan bytes
  const eoi = Buffer.from([0xff, 0xd9]);

  return Buffer.concat([soi, app0, sof0, sos, scanPayload, eoi]);
}

// Helper: Build valid GLB 2.0 binary buffer for Module 8.1 Furniture Assets
function buildValidFurnitureGlbBuffer(assetName = 'Viyana_Gardrop') {
  const gltfJson = JSON.stringify({
    asset: { version: '2.0', generator: 'Tripo H3.1 / Global Mobilya Module 8.1' },
    scene: 0,
    scenes: [{ name: assetName, nodes: [0] }],
    nodes: [{ name: assetName, mesh: 0 }],
    meshes: [{ name: `${assetName}_Mesh`, primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{
      name: `${assetName}_PBR`,
      pbrMetallicRoughness: { baseColorFactor: [0.55, 0.38, 0.22, 1.0], metallicFactor: 0.05, roughnessFactor: 0.38 }
    }],
    buffers: [{ byteLength: 36 }]
  });
  const jsonBytes = Buffer.from(gltfJson, 'utf8');
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);

  const binPayload = Buffer.alloc(36, 0);
  const totalLength = 12 + 8 + paddedJson.length + 8 + binPayload.length;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(paddedJson.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binPayload.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonChunkHeader, paddedJson, binChunkHeader, binPayload]);
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

async function runModule82Tests() {
  console.log('============================================================================');
  console.log('GLOBAL MOBİLYA — MODULE 8.2 SCENE BUILDER & ENVIRONMENT STUDIO TESTS');
  console.log('============================================================================');

  const sceneBuilderLib = await import('../api/_lib/scene-builder.js');
  const module8Mod = await import('../api/module8.js');
  const handler = module8Mod.default;

  let passed = 0;
  const totalTests = 12;

  // Intercept Supabase Storage uploads to verify exact paths & binary payloads
  const uploadedStorageObjects = new Map();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/storage/v1/object/media/')) {
      const storagePath = urlStr.split('/storage/v1/object/media/')[1];
      const bodyBuf = Buffer.isBuffer(options.body)
        ? options.body
        : Buffer.from(options.body || '');
      uploadedStorageObjects.set(storagePath, {
        path: storagePath,
        contentType: options.headers?.['Content-Type'] || options.headers?.['content-type'] || 'application/octet-stream',
        buffer: bodyBuf,
        size: bodyBuf.length
      });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Key: `media/${storagePath}` }),
        json: async () => ({ Key: `media/${storagePath}` })
      };
    }
    if (urlStr.includes('/rest/v1/')) {
      return {
        ok: true,
        status: 200,
        text: async () => '[]',
        json: async () => []
      };
    }
    return originalFetch(url, options);
  };

  try {
    // ── TEST 1: Catalog Verification (11 PBR Materials & 5 Scene Lighting Profiles) ──
    {
      const req = { method: 'GET', url: '/api/module8?action=scene-builder-catalog', query: { action: 'scene-builder-catalog' }, headers: {} };
      const res = createMockRes();
      await handler(req, res);

      assert.strictEqual(res.statusCode, 200, 'Catalog endpoint must return HTTP 200');
      assert.strictEqual(res.body.ok, true);

      const requiredMaterials = [
        'natural_wood', 'painted_wood', 'fabric', 'leather', 'metal',
        'brass', 'glass', 'mirror', 'marble', 'ceramic', 'stone'
      ];
      for (const matKey of requiredMaterials) {
        const mat = res.body.pbr_materials[matKey];
        assert.ok(mat, `PBR Material '${matKey}' must exist in catalog`);
        assert.strictEqual(typeof mat.roughness, 'number');
        assert.strictEqual(typeof mat.metallic, 'number');
        assert.strictEqual(typeof mat.normal_strength, 'number');
        assert.strictEqual(typeof mat.bump_strength, 'number');
        assert.strictEqual(typeof mat.specular, 'number');
      }

      const requiredProfiles = [
        'luxury_bedroom', 'modern_minimal', 'warm_interior', 'dark_premium', 'natural_daylight'
      ];
      for (const profKey of requiredProfiles) {
        const prof = res.body.lighting_profiles[profKey];
        assert.ok(prof, `Lighting profile '${profKey}' must exist in catalog`);
        assert.ok(Array.isArray(prof.area_lights) && prof.area_lights.length >= 2, `Profile '${profKey}' must define area_lights`);
      }

      console.log('✓ [1/12] Scene Builder Catalog verified (11 PBR Materials & 5 Lighting Profiles)');
      passed++;
    }

    // ── TEST 2: Reference Room Photo Analysis ($0.00 Paid API Cost + Perspective/Lighting/Zones) ──
    let analyzedRoomData = null;
    let referenceImageStoragePath = null;
    {
      const refJpeg = buildBedroomReferenceJpegBuffer(1600, 1066);
      const req = {
        method: 'POST',
        url: '/api/module8?action=scene-analyze-ref',
        query: { action: 'scene-analyze-ref' },
        headers: {},
        body: {
          file_base64: refJpeg.toString('base64'),
          file_name: 'viyana_bedroom_reference.jpg',
          mime_type: 'image/jpeg',
          room_type_hint: 'bedroom',
          room_style_hint: 'luxury_bedroom'
        }
      };
      const res = createMockRes();
      await handler(req, res);

      assert.strictEqual(res.statusCode, 200, 'Reference image analysis must succeed with 200');
      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.paid_api_called, false, 'Must NOT call any paid external API');
      assert.strictEqual(res.body.cost_usd, 0, 'Reference analysis cost must be $0.00');
      assert.strictEqual(res.body.analysis.is_ai_estimated, true, 'Must explicitly mark room estimation as AI-estimated');
      assert.strictEqual(res.body.analysis.source_image.width_px, 1600);
      assert.strictEqual(res.body.analysis.source_image.height_px, 1066);
      assert.ok(res.body.analysis.suggested_room_dimensions.room_width >= 4.0);
      assert.ok(Array.isArray(res.body.analysis.furniture_placement_zones) && res.body.analysis.furniture_placement_zones.length >= 3);
      assert.ok(res.body.ai_scene_disclaimer.includes('AI'), 'Disclaimer must inform user about AI-estimated unseen room areas');

      analyzedRoomData = res.body.analysis;
      referenceImageStoragePath = res.body.source_image_path;
      console.log('✓ [2/12] Reference Bedroom Photo Analysis verified ($0.00 cost, 1600x1066px, perspective & zones extracted)');
      passed++;
    }

    // ── TEST 3: Parametric 3D Room Dimensions Validation & Polygon Budget Guard ──
    {
      const validRoom = sceneBuilderLib.validateAndNormalizeRoomDimensions({
        room_width: 5.6,
        room_length: 4.9,
        room_height: 3.05,
        wall_thickness: 0.2,
        window_wall: 'right',
        window_width: 2.2,
        window_height: 1.7,
        door_wall: 'left',
        door_width: 0.95,
        door_height: 2.15
      });

      assert.strictEqual(validRoom.room_width, 5.6);
      assert.strictEqual(validRoom.room_length, 4.9);
      assert.strictEqual(validRoom.room_height, 3.05);
      assert.strictEqual(validRoom.wall_thickness, 0.2);
      assert.strictEqual(validRoom.window_wall, 'right');
      assert.strictEqual(validRoom.door_wall, 'left');
      assert.ok(validRoom.estimated_room_triangles < 15000, 'Room geometry must remain lightweight and clean');

      assert.throws(() => {
        sceneBuilderLib.validateAndNormalizeRoomDimensions({ room_width: 99 });
      }, /INVALID_ROOM_DIMENSION/, 'Out-of-bounds room width must be rejected');

      console.log('✓ [3/12] Parametric 3D Room Dimensions & Lightweight Polygon Budget verified');
      passed++;
    }

    // ── TEST 4: Register Module 8.1 Validated 3D Furniture Assets (Wardrobe + Bed + Nightstand) ──
    const wardrobeGlbBuffer = buildValidFurnitureGlbBuffer('Viyana_6_Kapakli_Gardrop');
    const bedGlbBuffer = buildValidFurnitureGlbBuffer('Viyana_Kapitoneli_Karyola');
    const nightstandGlbBuffer = buildValidFurnitureGlbBuffer('Viyana_Mermer_Komodin');
    {
      const uploadAssets = [
        {
          id: 'asset_viyana_gardrop_01',
          asset_id: 'asset_viyana_gardrop_01',
          product_slug: 'viyana-gardrop',
          product_name: 'Viyana 6 Kapaklı Aynalı Gardırop',
          dimensions_cm: { width_cm: 240, height_cm: 215, depth_cm: 62 },
          buffer: wardrobeGlbBuffer
        },
        {
          id: 'asset_viyana_karyola_01',
          asset_id: 'asset_viyana_karyola_01',
          product_slug: 'viyana-karyola',
          product_name: 'Viyana Kapitoneli Başlıklı Karyola',
          dimensions_cm: { width_cm: 180, height_cm: 125, depth_cm: 210 },
          buffer: bedGlbBuffer
        },
        {
          id: 'asset_viyana_komodin_01',
          asset_id: 'asset_viyana_komodin_01',
          product_slug: 'viyana-komodin',
          product_name: 'Viyana Mermer Üstlü Komodin',
          dimensions_cm: { width_cm: 58, height_cm: 52, depth_cm: 45 },
          buffer: nightstandGlbBuffer
        }
      ];

      for (const item of uploadAssets) {
        const req = {
          method: 'POST',
          url: '/api/module8?action=upload',
          query: { action: 'upload' },
          headers: { 'x-worker-key': 'test_worker_secret_key_82_scene' },
          body: {
            product_slug: item.product_slug,
            asset_type: '3d_model',
            file_name: `${item.asset_id}.glb`,
            mime_type: 'model/gltf-binary',
            file_base64: item.buffer.toString('base64'),
            title: item.product_name,
            metadata: {
              asset_id: item.asset_id,
              dimensions_cm: item.dimensions_cm
            }
          }
        };
        const res = createMockRes();
        await handler(req, res);
        assert.strictEqual(res.statusCode, 201, `3D asset upload for ${item.asset_id} must succeed`);
      }

      console.log('✓ [4/12] Validated Module 8.1 3D Furniture GLB Assets (Wardrobe + Bed + Nightstand) registered');
      passed++;
    }

    // ── TEST 5: Scale Calibration from Product Dimensions & Inter-Product Distance / Collision Check ──
    {
      const roomDims = sceneBuilderLib.validateAndNormalizeRoomDimensions({
        room_width: 5.4,
        room_length: 4.8,
        room_height: 3.0
      });

      const placementRes = sceneBuilderLib.normalizeAndValidateAssetPlacements([
        {
          instance_id: 'inst_wardrobe_01',
          asset_id: 'asset_viyana_gardrop_01',
          product_slug: 'viyana-gardrop',
          product_name: 'Viyana 6 Kapaklı Gardırop',
          storage_path: 'studio/assets/viyana-gardrop/asset_viyana_gardrop_01/model.glb',
          position_m: { x: -1.15, y: 1.95, z: 0.0 },
          rotation_deg: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          dimensions_cm: { width_cm: 240, height_cm: 215, depth_cm: 62 },
          material_override: { material_id: 'natural_wood', roughness: 0.36 },
          group_id: 'viyana_bedroom_suite',
          visible: true
        },
        {
          instance_id: 'inst_bed_02',
          asset_id: 'asset_viyana_karyola_01',
          product_slug: 'viyana-karyola',
          product_name: 'Viyana Kapitoneli Karyola',
          storage_path: 'studio/assets/viyana-karyola/asset_viyana_karyola_01/model.glb',
          position_m: { x: 0.85, y: 1.25, z: 0.0 },
          rotation_deg: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          dimensions_cm: '180x125x210 cm',
          material_override: { material_id: 'fabric', roughness: 0.78 },
          group_id: 'viyana_bedroom_suite',
          visible: true
        },
        {
          instance_id: 'inst_unscaled_decor_03',
          asset_id: 'asset_decor_vase',
          product_name: 'Ölçüsüz Dekoratif Vazo',
          position_m: { x: 2.05, y: 1.98, z: 0.52 },
          scale: { x: 1, y: 1, z: 1 }
        }
      ], roomDims);

      assert.strictEqual(placementRes.placements.length, 3);
      assert.strictEqual(placementRes.placements[0].scale_calibration_mode, 'calibrated_from_dimensions_cm');
      assert.strictEqual(placementRes.placements[0].is_true_scale_verified, true);
      assert.deepStrictEqual(placementRes.placements[0].target_dimensions_m, { width_m: 2.4, height_m: 2.15, depth_m: 0.62 });
      assert.strictEqual(placementRes.placements[0].original_geometry_preserved, true);

      // Unscaled asset must be honestly marked as relative_user_scale_uncalibrated (no false real-scale claim)
      assert.strictEqual(placementRes.placements[2].scale_calibration_mode, 'relative_user_scale_uncalibrated');
      assert.strictEqual(placementRes.placements[2].is_true_scale_verified, false);
      assert.strictEqual(placementRes.distance_matrix.length, 3, 'Must compute pairwise distances for 3 visible assets');

      console.log('✓ [5/12] Scale calibration (dimensions_cm -> meters) & pairwise distance matrix verified');
      passed++;
    }

    // ── TEST 6: Save Complete Bedroom Prototype Scene to Supabase Storage (`studio/scenes/{scene_id}/...`) ──
    const testSceneId = 'scene_viyana_bedroom_prototype_01';
    {
      const saveReq = {
        method: 'POST',
        url: '/api/module8?action=scene-save',
        query: { action: 'scene-save' },
        headers: {},
        body: {
          scene_id: testSceneId,
          scene_name: 'Viyana Lüks Yatak Odası Prototip Sahnesi',
          source_image_path: referenceImageStoragePath,
          reference_analysis: analyzedRoomData,
          is_ai_estimated_room: true,
          room_dimensions: {
            room_width: 5.4,
            room_length: 4.8,
            room_height: 3.0,
            wall_thickness: 0.18,
            window_wall: 'right',
            window_width: 2.1,
            window_height: 1.65,
            window_sill_height: 0.85,
            door_wall: 'left',
            door_width: 0.95,
            door_height: 2.15,
            include_ceiling_molding: true,
            include_baseboard: true,
            include_wall_panels: true,
            include_pendant_light: true,
            include_decorative_rug: true
          },
          asset_transforms: [
            {
              instance_id: 'inst_wardrobe_01',
              asset_id: 'asset_viyana_gardrop_01',
              product_slug: 'viyana-gardrop',
              product_name: 'Viyana 6 Kapaklı Aynalı Gardırop',
              storage_path: 'studio/assets/viyana-gardrop/asset_viyana_gardrop_01/model.glb',
              position_m: { x: -1.15, y: 1.95, z: 0.0 },
              rotation_deg: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              dimensions_cm: { width_cm: 240, height_cm: 215, depth_cm: 62 },
              material_override: { material_id: 'natural_wood', base_color_hex: '#8C6239', roughness: 0.36, metallic: 0.02 },
              group_id: 'bedroom_suite',
              visible: true
            },
            {
              instance_id: 'inst_bed_02',
              asset_id: 'asset_viyana_karyola_01',
              product_slug: 'viyana-karyola',
              product_name: 'Viyana Kapitoneli Başlıklı Karyola',
              storage_path: 'studio/assets/viyana-karyola/asset_viyana_karyola_01/model.glb',
              position_m: { x: 0.85, y: 1.25, z: 0.0 },
              rotation_deg: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              dimensions_cm: { width_cm: 180, height_cm: 125, depth_cm: 210 },
              material_override: { material_id: 'fabric', base_color_hex: '#D8CFC2', roughness: 0.78, metallic: 0.0 },
              group_id: 'bedroom_suite',
              visible: true
            },
            {
              instance_id: 'inst_nightstand_03',
              asset_id: 'asset_viyana_komodin_01',
              product_slug: 'viyana-komodin',
              product_name: 'Viyana Mermer Üstlü Komodin',
              storage_path: 'studio/assets/viyana-komodin/asset_viyana_komodin_01/model.glb',
              position_m: { x: 2.05, y: 1.98, z: 0.0 },
              rotation_deg: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              dimensions_cm: { width_cm: 58, height_cm: 52, depth_cm: 45 },
              material_override: { material_id: 'marble', base_color_hex: '#F3F1ED', roughness: 0.18, metallic: 0.0 },
              group_id: 'bedroom_suite',
              visible: true
            }
          ],
          material_settings: {
            floor: { material_id: 'natural_wood', roughness: 0.38 },
            walls: { material_id: 'painted_wood', base_color_hex: '#EDEAE4' },
            trim: { material_id: 'brass' }
          },
          lighting_profile: 'luxury_bedroom',
          camera_settings: {
            focal_length_mm: 35,
            position_m: { x: 0.0, y: -2.15, z: 1.55 },
            target_m: { x: 0.0, y: 1.0, z: 1.05 }
          },
          user_approved: false
        }
      };

      const saveRes = createMockRes();
      await handler(saveReq, saveRes);

      assert.strictEqual(saveRes.statusCode, 200, 'Scene save must return HTTP 200');
      assert.strictEqual(saveRes.body.ok, true);

      const savedScene = saveRes.body.scene;
      assert.strictEqual(savedScene.scene_id, testSceneId);
      assert.strictEqual(savedScene.scene_file_path, `studio/scenes/${testSceneId}/scene.blend`);
      assert.strictEqual(savedScene.preview_image_path, `studio/scenes/${testSceneId}/preview.jpg`);
      assert.strictEqual(savedScene.metadata_file_path, `studio/scenes/${testSceneId}/scene_metadata.json`);
      assert.strictEqual(savedScene.blender_version, '4.2');
      assert.strictEqual(savedScene.status, 'saved');
      assert.deepStrictEqual(savedScene.asset_ids, [
        'asset_viyana_gardrop_01',
        'asset_viyana_karyola_01',
        'asset_viyana_komodin_01'
      ]);

      console.log('✓ [6/12] Bedroom Prototype Scene saved with all 15 required metadata fields');
      passed++;
    }

    // ── TEST 7: Verify Supabase Storage Upload Artifacts (`scene.blend`, `preview.jpg`, `scene_metadata.json`) ──
    {
      const blendObj = uploadedStorageObjects.get(`studio/scenes/${testSceneId}/scene.blend`);
      const previewObj = uploadedStorageObjects.get(`studio/scenes/${testSceneId}/preview.jpg`);
      const metaObj = uploadedStorageObjects.get(`studio/scenes/${testSceneId}/scene_metadata.json`);

      assert.ok(blendObj, 'scene.blend must be uploaded to Supabase Storage');
      assert.ok(previewObj, 'preview.jpg must be uploaded to Supabase Storage');
      assert.ok(metaObj, 'scene_metadata.json must be uploaded to Supabase Storage');

      const blendInspection = inspectBlendSceneBuffer(blendObj.buffer);
      assert.strictEqual(blendInspection.valid, true, 'Uploaded .blend file must have valid BLENDER magic header');
      assert.strictEqual(blendInspection.magic, 'BLENDER');
      assert.strictEqual(blendInspection.versionCode, '402');
      assert.strictEqual(blendInspection.manifest.scene_id, testSceneId);
      assert.strictEqual(blendInspection.manifest.collections.Furniture_Assets.length, 3);
      assert.ok(blendInspection.manifest.collections.Room_Architecture.includes('Room_Floor'));
      assert.ok(blendInspection.manifest.collections.Room_Architecture.includes('Window_Glass_Pane'));

      // Verify preview.jpg is a valid JPEG (SOI 0xFF 0xD8 0xFF)
      assert.strictEqual(previewObj.buffer[0], 0xff);
      assert.strictEqual(previewObj.buffer[1], 0xd8);
      assert.strictEqual(previewObj.buffer[2], 0xff);

      // Verify scene_metadata.json contains all required fields from Section 10
      const parsedMeta = JSON.parse(metaObj.buffer.toString('utf8'));
      const requiredFields = [
        'scene_id', 'scene_name', 'source_image_path', 'room_dimensions',
        'asset_ids', 'asset_transforms', 'material_settings', 'lighting_profile',
        'camera_settings', 'blender_version', 'scene_file_path', 'preview_image_path',
        'status', 'created_at', 'updated_at'
      ];
      for (const field of requiredFields) {
        assert.ok(parsedMeta[field] !== undefined, `scene_metadata.json must include '${field}'`);
      }

      console.log('✓ [7/12] Supabase Storage artifacts verified (`scene.blend` BLENDER-v402 + `preview.jpg` + `scene_metadata.json`)');
      passed++;
    }

    // ── TEST 8: Reload Saved Scene & Verify Exact Restoration ──
    {
      const loadReq = {
        method: 'GET',
        url: `/api/module8?action=scene-load&scene_id=${testSceneId}`,
        query: { action: 'scene-load', scene_id: testSceneId },
        headers: {}
      };
      const loadRes = createMockRes();
      await handler(loadReq, loadRes);

      assert.strictEqual(loadRes.statusCode, 200);
      assert.strictEqual(loadRes.body.ok, true);
      assert.strictEqual(loadRes.body.reload_verification.scene_id_verified, true);
      assert.strictEqual(loadRes.body.reload_verification.assets_restored_count, 3);
      assert.strictEqual(loadRes.body.reload_verification.room_dimensions_restored, true);
      assert.strictEqual(loadRes.body.reload_verification.materials_restored, true);
      assert.strictEqual(loadRes.body.reload_verification.lighting_profile_restored, 'luxury_bedroom');
      assert.strictEqual(loadRes.body.reload_verification.camera_restored, true);
      assert.strictEqual(loadRes.body.scene.asset_transforms[0].asset_id, 'asset_viyana_gardrop_01');
      assert.deepStrictEqual(loadRes.body.scene.asset_transforms[0].position_m, { x: -1.15, y: 1.95, z: 0 });

      console.log('✓ [8/12] Scene reload & full state restoration verified');
      passed++;
    }

    // ── TEST 9: Final Render Guard (Blocks Unapproved Scene Render) ──
    {
      const unapprovedRenderReq = {
        method: 'POST',
        url: '/api/module8?action=scene-final-render',
        query: { action: 'scene-final-render' },
        headers: {},
        body: {
          scene_id: testSceneId,
          render_tier: 'final'
        }
      };
      const unapprovedRes = createMockRes();
      await handler(unapprovedRenderReq, unapprovedRes);

      assert.strictEqual(unapprovedRes.statusCode, 400, 'Unapproved scene final render must be blocked with HTTP 400');
      assert.strictEqual(unapprovedRes.body.error_code, 'SCENE_APPROVAL_REQUIRED_FOR_FINAL_RENDER');

      console.log('✓ [9/12] Final Render Guard verified (blocks unapproved expensive renders)');
      passed++;
    }

    // ── TEST 10: BlenderRunner.buildInteriorScene() Local `.blend` + Preview Generation ──
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm8_2_scene_test_'));
    const localBlendFilePath = path.join(tempDir, `${testSceneId}.blend`);
    const localPreviewFilePath = path.join(tempDir, `${testSceneId}_preview.jpg`);
    {
      const runner = new BlenderRunner({
        nodeEnv: 'development',
        allowSimulation: true,
        allowedTempDir: tempDir
      });

      const buildRes = await runner.buildInteriorScene({
        sceneSpec: {
          scene_id: testSceneId,
          scene_name: 'Viyana Lüks Yatak Odası Prototip Sahnesi',
          room_dimensions: { room_width: 5.4, room_length: 4.8, room_height: 3.0 },
          lighting_profile: 'luxury_bedroom',
          asset_transforms: [
            {
              instance_id: 'inst_wardrobe_01',
              asset_id: 'asset_viyana_gardrop_01',
              product_name: 'Viyana 6 Kapaklı Gardırop',
              position_m: { x: -1.15, y: 1.95, z: 0 },
              rotation_deg: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              dimensions_cm: { width_cm: 240, height_cm: 215, depth_cm: 62 }
            }
          ]
        },
        outputBlendPath: localBlendFilePath,
        outputPreviewPath: localPreviewFilePath,
        width: 960,
        height: 540,
        samples: 16
      });

      assert.strictEqual(buildRes.success, true);
      assert.ok(fs.existsSync(localBlendFilePath), 'Local .blend file must exist on disk');
      assert.ok(fs.existsSync(localPreviewFilePath), 'Local preview.jpg file must exist on disk');

      const checkBlend = inspectBlendSceneBuffer(localBlendFilePath);
      assert.strictEqual(checkBlend.valid, true);
      assert.strictEqual(checkBlend.manifest.scene_id, testSceneId);

      console.log('✓ [10/12] BlenderRunner.buildInteriorScene() (.blend + preview.jpg) verified');
      passed++;
    }

    // ── TEST 11: User Approves Scene -> Queues Low-Cost Cycles Render Job ──
    let queuedSceneRenderJob = null;
    {
      const approveReq = {
        method: 'POST',
        url: '/api/module8?action=scene-approve',
        query: { action: 'scene-approve' },
        headers: {},
        body: {
          scene_id: testSceneId,
          user_approved: true
        }
      };
      const approveRes = createMockRes();
      await handler(approveReq, approveRes);
      assert.strictEqual(approveRes.statusCode, 200);
      assert.strictEqual(approveRes.body.scene.user_approved, true);
      assert.strictEqual(approveRes.body.scene.status, 'approved');

      const renderReq = {
        method: 'POST',
        url: '/api/module8?action=scene-final-render',
        query: { action: 'scene-final-render' },
        headers: {},
        body: {
          scene_id: testSceneId,
          render_tier: 'test_low_cost',
          local_blend_path: localBlendFilePath,
          resolution: '960x540',
          samples: 16
        }
      };
      const renderRes = createMockRes();
      await handler(renderReq, renderRes);

      assert.strictEqual(renderRes.statusCode, 201, 'Approved scene render job creation must return HTTP 201');
      assert.strictEqual(renderRes.body.ok, true);
      assert.strictEqual(renderRes.body.job.production_type, 'scene_render');
      assert.strictEqual(renderRes.body.job.selected_engine, 'blender_headless');
      assert.strictEqual(renderRes.body.job.input_model_path, localBlendFilePath);
      assert.strictEqual(renderRes.body.job.render_settings.scene_id, testSceneId);

      queuedSceneRenderJob = renderRes.body.job;
      console.log(`✓ [11/12] User Scene Approval & Low-Cost Scene Render Job queued (${queuedSceneRenderJob.id})`);
      passed++;
    }

    // ── TEST 12: Execute Queued `.blend` Scene Render via Blender Headless Worker Daemon ──
    {
      const testWorkerKey = 'test_worker_secret_key_82_scene';
      process.env.RENDER_WORKER_KEY = testWorkerKey;

      const inProcessFetch = async (url, options = {}) => {
        const parsedUrl = new URL(url, 'http://localhost:3000');
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        const bodyObj = options.body ? JSON.parse(options.body) : {};
        const req = {
          method: options.method || 'GET',
          url: parsedUrl.pathname + parsedUrl.search,
          query,
          headers: {
            'x-worker-key': options.headers?.['X-Worker-Key'] || options.headers?.['x-worker-key'] || testWorkerKey,
            authorization: options.headers?.Authorization || options.headers?.authorization || `Bearer ${testWorkerKey}`
          },
          body: bodyObj
        };
        const res = createMockRes();
        await handler(req, res);
        return {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: async () => JSON.stringify(res.body),
          json: async () => res.body
        };
      };

      const daemon = new RenderWorkerDaemon({
        nodeEnv: 'development',
        apiBaseUrl: 'http://localhost:3000',
        workerKey: testWorkerKey,
        tempDir,
        allowSimulation: true,
        allowSimulatedUploads: true,
        fetchImpl: inProcessFetch
      });

      // Override host guard for deterministic CI/local execution
      daemon.isHostHealthy = () => true;

      const claimedJob = await daemon.runCycle();
      assert.ok(claimedJob, 'Blender Worker Daemon must claim and process the queued .blend scene render job');
      assert.strictEqual(claimedJob.id, queuedSceneRenderJob.id);

      // Verify job reached 'completed' with verified output_render_path in Supabase Storage
      const detailReq = {
        method: 'GET',
        url: `/api/module8?action=job-detail&id=${queuedSceneRenderJob.id}`,
        query: { action: 'job-detail', id: queuedSceneRenderJob.id },
        headers: {}
      };
      const detailRes = createMockRes();
      await handler(detailReq, detailRes);

      assert.strictEqual(detailRes.statusCode, 200);
      assert.strictEqual(detailRes.body.job.status, 'completed', 'Scene render job must complete');
      assert.ok(detailRes.body.job.output_render_path.startsWith('studio/render'), 'Rendered scene output must be stored under studio/render*');
      assert.strictEqual(detailRes.body.outputs[0].width_px, 960);
      assert.strictEqual(detailRes.body.outputs[0].height_px, 540);

      console.log(`✓ [12/12] Blender Worker rendered saved .blend scene & uploaded output (${detailRes.body.job.output_render_path})`);
      passed++;
    }

    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    console.log('============================================================================');
    console.log(`ALL ${passed}/${totalTests} MODULE 8.2 SCENE BUILDER TESTS PASSED SUCCESSFULLY!`);
    console.log('============================================================================');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runModule82Tests().catch((err) => {
  console.error('❌ MODULE 8.2 TEST SUITE FAILED:', err);
  process.exit(1);
});

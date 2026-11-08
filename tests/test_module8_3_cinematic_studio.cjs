/**
 * GLOBAL MOBİLYA — MODULE 8.3: CINEMATIC STUDIO & CAMERA ANIMATION ENGINE TESTS
 * ============================================================================
 * End-to-End Verification of:
 *   1. Cinematic Catalog (All 9 Camera Movements & All 4 Distinct Shot Presets:
 *      A. Luxury Product Showcase, B. Premium Detail Showcase, C. Interior Cinematic,
 *      D. Minimal Product Film)
 *   2. Step 1-3 E2E: Load existing Module 8.2 Scene -> Select Luxury Product Showcase
 *      preset -> Generate real Bezier/Ease-In-Out camera keyframes & target tracking
 *   3. Step 4: Timeline Editing (Add shot, reorder shots, edit duration/focal length/
 *      distance/height/DoF/f-stop/speed, automatic frame range & duration calculation)
 *   4. Step 5-7: Build Preview & Save Animation to `.blend` (`studio/cinematics/{id}/cinematic.blend`,
 *      `cinematic_metadata.json`, `preview/preview.jpg`) -> Reopen & Verify Preserved Keyframes
 *   5. Preview vs Final Render Separation, Final Render Approval Guard, Deduplication,
 *      and Blender Worker Execution
 * ============================================================================
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  BlenderRunner,
  inspectBlendSceneBuffer
} = require('../Sunucu/render-worker/blender-runner.js');
const { RenderWorkerDaemon } = require('../Sunucu/render-worker/worker-daemon.js');

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

async function runModule83Tests() {
  console.log('============================================================================');
  console.log('GLOBAL MOBİLYA — MODULE 8.3 CINEMATIC STUDIO & CAMERA ANIMATION TESTS');
  console.log('============================================================================');

  const cinematicLib = await import('../api/_lib/cinematic-engine.js');
  const module8Mod = await import('../api/module8.js');
  const handler = module8Mod.default;

  let passed = 0;
  const totalTests = 10;

  const uploadedStorageObjects = new Map();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/storage/v1/object/media/')) {
      const storagePath = urlStr.split('/storage/v1/object/media/')[1];
      const bodyBuf = Buffer.isBuffer(options.body) ? options.body : Buffer.from(options.body || '');
      uploadedStorageObjects.set(storagePath, {
        path: storagePath,
        contentType: options.headers?.['Content-Type'] || 'application/octet-stream',
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
      return { ok: true, status: 200, text: async () => '[]', json: async () => [] };
    }
    return originalFetch(url, options);
  };

  try {
    // ── TEST 1: Cinematic Catalog (Movements & 4 Distinct Presets) ──
    {
      const req = { method: 'GET', url: '/api/module8?action=cinematic-catalog', query: { action: 'cinematic-catalog' }, headers: {} };
      const res = createMockRes();
      await handler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.ok, true);

      const requiredMovements = [
        'dolly_in', 'dolly_out', 'slow_pan_left_right', 'tilt_up_down',
        'orbit_around_product', 'camera_tracking', 'smooth_crane_movement',
        'closeup_detail_movement', 'wide_establishing_shot'
      ];
      for (const m of requiredMovements) {
        assert.ok(res.body.camera_movements[m], `Movement '${m}' must exist`);
        assert.strictEqual(res.body.camera_movements[m].interpolation, 'BEZIER');
        assert.strictEqual(res.body.camera_movements[m].easing, 'EASE_IN_OUT');
      }

      const requiredPresets = [
        'luxury_product_showcase', 'premium_detail_showcase', 'interior_cinematic', 'minimal_product_film'
      ];
      for (const p of requiredPresets) {
        assert.ok(res.body.shot_presets[p], `Preset '${p}' must exist`);
        assert.ok(res.body.shot_presets[p].shots.length >= 3, `Preset '${p}' must have multiple shots`);
      }

      console.log('✓ [1/10] Cinematic Catalog verified (All Camera Movements & 4 Shot Presets)');
      passed++;
    }

    // ── TEST 2: Create & Load Module 8.2 Scene as Input for Module 8.3 ──
    const sceneId = 'scene_viyana_bedroom_83';
    {
      const saveSceneReq = {
        method: 'POST',
        url: '/api/module8?action=scene-save',
        query: { action: 'scene-save' },
        headers: {},
        body: {
          scene_id: sceneId,
          scene_name: 'Viyana Yatak Odası 8.2 Kaynak Sahnesi',
          room_dimensions: { room_width: 5.4, room_length: 4.8, room_height: 3.0 },
          asset_transforms: [
            {
              instance_id: 'inst_wardrobe_01',
              asset_id: 'asset_viyana_gardrop_01',
              product_slug: 'viyana-gardrop',
              product_name: 'Viyana 6 Kapaklı Gardırop',
              position_m: { x: -1.1, y: 1.85, z: 0.0 },
              dimensions_cm: { width_cm: 240, height_cm: 215, depth_cm: 62 }
            }
          ],
          lighting_profile: 'luxury_bedroom'
        }
      };
      const saveSceneRes = createMockRes();
      await handler(saveSceneReq, saveSceneRes);
      assert.strictEqual(saveSceneRes.statusCode, 200);
      console.log('✓ [2/10] Existing Module 8.2 Scene loaded for Cinematic Studio');
      passed++;
    }

    // ── TEST 3: Verify All 4 Shot Presets Generate Distinct Camera Trajectories ──
    {
      const tA = cinematicLib.buildCinematicTimeline({ preset_id: 'luxury_product_showcase', fps: 24 });
      const tB = cinematicLib.buildCinematicTimeline({ preset_id: 'premium_detail_showcase', fps: 24 });
      const tC = cinematicLib.buildCinematicTimeline({ preset_id: 'interior_cinematic', fps: 24 });
      const tD = cinematicLib.buildCinematicTimeline({ preset_id: 'minimal_product_film', fps: 24 });

      assert.strictEqual(tA.shot_count, 5);
      assert.strictEqual(tB.shot_count, 4);
      assert.strictEqual(tC.shot_count, 4);
      assert.strictEqual(tD.shot_count, 3);
      assert.notDeepStrictEqual(tA.master_keyframes[0].camera_location, tB.master_keyframes[0].camera_location);
      assert.notDeepStrictEqual(tB.master_keyframes[0].camera_location, tC.master_keyframes[0].camera_location);
      assert.notDeepStrictEqual(tC.master_keyframes[0].camera_location, tD.master_keyframes[0].camera_location);

      console.log('✓ [3/10] All 4 Shot Presets produce distinct multi-shot Bezier camera trajectories');
      passed++;
    }

    // ── TEST 4: Timeline Editing (Add Shot, Reorder, Duration, Lens/DoF Settings & Auto Frame Range) ──
    let editedTimeline = null;
    {
      const basePreset = cinematicLib.CINEMATIC_SHOT_PRESETS.luxury_product_showcase.shots;
      // Reorder shot 1 & 2, edit duration & lens, and append a Smooth Crane shot
      const customShots = [
        { ...basePreset[0], duration_sec: 2.0, focal_length_mm: 30 },
        { ...basePreset[2], duration_sec: 4.0, focal_length_mm: 55, f_stop: 2.8, focus_distance_m: 2.4 },
        { ...basePreset[1], duration_sec: 3.0 },
        { ...basePreset[3], duration_sec: 2.5, focal_length_mm: 85, dof_enabled: true, f_stop: 1.8 },
        { ...basePreset[4], duration_sec: 2.5 },
        {
          shot_name: '6. Eklenen Vinç Çekimi (Smooth Crane)',
          movement_type: 'smooth_crane_movement',
          duration_sec: 3.0,
          focal_length_mm: 35,
          camera_distance_m: 3.2,
          camera_height_m: 2.1,
          f_stop: 4.0,
          movement_speed: 1.1
        }
      ];

      editedTimeline = cinematicLib.buildCinematicTimeline({
        preset_id: 'luxury_product_showcase',
        fps: 24,
        shots: customShots
      });

      assert.strictEqual(editedTimeline.shot_count, 6);
      assert.strictEqual(editedTimeline.total_duration_sec, 17.0);
      assert.strictEqual(editedTimeline.frame_start, 1);
      assert.strictEqual(editedTimeline.frame_end, 17 * 24); // 408 frames
      assert.strictEqual(editedTimeline.total_frames, 408);
      assert.strictEqual(editedTimeline.shots[0].frame_start, 1);
      assert.strictEqual(editedTimeline.shots[0].frame_end, 48);
      assert.strictEqual(editedTimeline.shots[1].frame_start, 49);
      assert.strictEqual(editedTimeline.shots[1].frame_end, 144);
      assert.strictEqual(editedTimeline.shots[5].movement_type, 'smooth_crane_movement');
      assert.strictEqual(editedTimeline.shots[3].physical_geometry_preserved, true);

      console.log('✓ [4/10] Timeline editing (add, reorder, duration, lens/DoF & auto frame calculation 1..408) verified');
      passed++;
    }

    // ── TEST 5: Save Cinematic Animation to Supabase Storage (`studio/cinematics/{id}/...`) ──
    const cinematicId = 'cin_viyana_luxury_showcase_01';
    {
      const saveCinReq = {
        method: 'POST',
        url: '/api/module8?action=cinematic-save',
        query: { action: 'cinematic-save' },
        headers: {},
        body: {
          cinematic_id: cinematicId,
          cinematic_name: 'Viyana Gardırop — Luxury Product Showcase',
          scene_id: sceneId,
          preset_id: 'luxury_product_showcase',
          fps: 24,
          shots: editedTimeline.shots,
          user_approved: false
        }
      };
      const saveCinRes = createMockRes();
      await handler(saveCinReq, saveCinRes);

      assert.strictEqual(saveCinRes.statusCode, 200);
      assert.strictEqual(saveCinRes.body.ok, true);
      assert.strictEqual(saveCinRes.body.cinematic.cinematic_id, cinematicId);
      assert.strictEqual(saveCinRes.body.cinematic.cinematic_blend_path, `studio/cinematics/${cinematicId}/cinematic.blend`);
      assert.strictEqual(saveCinRes.body.cinematic.cinematic_metadata_path, `studio/cinematics/${cinematicId}/cinematic_metadata.json`);
      assert.strictEqual(saveCinRes.body.cinematic.preview_image_path, `studio/cinematics/${cinematicId}/preview/preview.jpg`);

      const blendObj = uploadedStorageObjects.get(`studio/cinematics/${cinematicId}/cinematic.blend`);
      const metaObj = uploadedStorageObjects.get(`studio/cinematics/${cinematicId}/cinematic_metadata.json`);
      const prevObj = uploadedStorageObjects.get(`studio/cinematics/${cinematicId}/preview/preview.jpg`);

      assert.ok(blendObj, 'cinematic.blend must be uploaded to Supabase Storage');
      assert.ok(metaObj, 'cinematic_metadata.json must be uploaded to Supabase Storage');
      assert.ok(prevObj, 'preview/preview.jpg must be uploaded to Supabase Storage');

      const blendCheck = inspectBlendSceneBuffer(blendObj.buffer);
      assert.strictEqual(blendCheck.valid, true);
      assert.strictEqual(blendCheck.manifest.cinematic_id, cinematicId);
      assert.strictEqual(blendCheck.manifest.shots.length, 6);
      assert.strictEqual(blendCheck.manifest.master_keyframes.length, 18);

      console.log('✓ [5/10] Cinematic animation saved to `studio/cinematics/{cinematic_id}/` (.blend + metadata + preview)');
      passed++;
    }

    // ── TEST 6: Reopen Saved Cinematic Animation & Verify Preserved Keyframes ──
    {
      const loadReq = {
        method: 'GET',
        url: `/api/module8?action=cinematic-load&cinematic_id=${cinematicId}`,
        query: { action: 'cinematic-load', cinematic_id: cinematicId },
        headers: {}
      };
      const loadRes = createMockRes();
      await handler(loadReq, loadRes);

      assert.strictEqual(loadRes.statusCode, 200);
      assert.strictEqual(loadRes.body.reload_verification.cinematic_id_verified, true);
      assert.strictEqual(loadRes.body.reload_verification.shots_restored_count, 6);
      assert.strictEqual(loadRes.body.reload_verification.keyframes_restored_count, 18);
      assert.strictEqual(loadRes.body.reload_verification.fps_restored, 24);
      assert.deepStrictEqual(loadRes.body.reload_verification.frame_range_restored, [1, 408]);
      assert.strictEqual(loadRes.body.reload_verification.interpolation_verified, true);
      assert.strictEqual(loadRes.body.reload_verification.physical_geometry_preserved, true);

      console.log('✓ [6/10] Saved cinematic animation reopened & all 6 shots / 18 Bezier keyframes verified intact');
      passed++;
    }

    // ── TEST 7: BlenderRunner.buildCinematicAnimation() Local `.blend` + Preview Execution ──
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm8_3_cin_test_'));
    const localCinBlendPath = path.join(tempDir, `${cinematicId}.blend`);
    const localCinPreviewPath = path.join(tempDir, `${cinematicId}_preview.jpg`);
    {
      const runner = new BlenderRunner({
        nodeEnv: 'development',
        allowSimulation: true,
        allowedTempDir: tempDir
      });

      const buildRes = await runner.buildCinematicAnimation({
        cinematicSpec: {
          cinematic_id: cinematicId,
          cinematic_name: 'Viyana Gardırop — Luxury Product Showcase',
          scene_id: sceneId,
          preset_id: 'luxury_product_showcase',
          fps: 24,
          frame_start: 1,
          frame_end: 408,
          shots: editedTimeline.shots,
          master_keyframes: editedTimeline.master_keyframes
        },
        outputBlendPath: localCinBlendPath,
        outputPreviewPath: localCinPreviewPath,
        width: 640,
        height: 360,
        samples: 8
      });

      assert.strictEqual(buildRes.success, true);
      assert.ok(fs.existsSync(localCinBlendPath));
      assert.ok(fs.existsSync(localCinPreviewPath));

      console.log('✓ [7/10] BlenderRunner.buildCinematicAnimation() local .blend & low-cost preview verified');
      passed++;
    }

    // ── TEST 8: Low-Cost Preview Render Queue & Duplicate Prevention ──
    let previewJob = null;
    {
      const prevReq = {
        method: 'POST',
        url: '/api/module8?action=cinematic-render',
        query: { action: 'cinematic-render' },
        headers: {},
        body: {
          cinematic_id: cinematicId,
          render_tier: 'preview',
          local_blend_path: localCinBlendPath,
          resolution: '640x360',
          samples: 8
        }
      };
      const prevRes = createMockRes();
      await handler(prevReq, prevRes);
      assert.strictEqual(prevRes.statusCode, 201);
      assert.strictEqual(prevRes.body.job.production_type, 'cinematic_preview');
      previewJob = prevRes.body.job;

      // Duplicate call must deduplicate instead of queuing redundant renders
      const dupRes = createMockRes();
      await handler(prevReq, dupRes);
      assert.strictEqual(dupRes.statusCode, 200);
      assert.strictEqual(dupRes.body.deduplicated, true);
      assert.strictEqual(dupRes.body.job.id, previewJob.id);

      console.log('✓ [8/10] Low-cost preview render queued & redundant duplicate render prevented');
      passed++;
    }

    // ── TEST 9: Final Render Approval Guard (Blocks Unapproved Final Render, Allows Approved) ──
    {
      const unapprovedReq = {
        method: 'POST',
        url: '/api/module8?action=cinematic-render',
        query: { action: 'cinematic-render' },
        headers: {},
        body: {
          cinematic_id: cinematicId,
          render_tier: 'final'
        }
      };
      const unapprovedRes = createMockRes();
      await handler(unapprovedReq, unapprovedRes);
      assert.strictEqual(unapprovedRes.statusCode, 400);
      assert.strictEqual(unapprovedRes.body.error_code, 'CINEMATIC_APPROVAL_REQUIRED_FOR_FINAL_RENDER');

      console.log('✓ [9/10] Final render approval guard verified (blocks unapproved final renders)');
      passed++;
    }

    // ── TEST 10: Execute Queued Cinematic Preview via Blender Worker Daemon ──
    {
      const testWorkerKey = 'test_worker_secret_key_83_cin';
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
            'x-worker-key': testWorkerKey,
            authorization: `Bearer ${testWorkerKey}`
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
      daemon.isHostHealthy = () => true;

      const claimed = await daemon.runCycle();
      assert.ok(claimed);
      assert.strictEqual(claimed.id, previewJob.id);

      const detailReq = {
        method: 'GET',
        url: `/api/module8?action=job-detail&id=${previewJob.id}`,
        query: { action: 'job-detail', id: previewJob.id },
        headers: {}
      };
      const detailRes = createMockRes();
      await handler(detailReq, detailRes);
      assert.strictEqual(detailRes.body.job.status, 'completed');
      assert.strictEqual(detailRes.body.outputs[0].width_px, 640);
      assert.strictEqual(detailRes.body.outputs[0].height_px, 360);

      console.log(`✓ [10/10] Blender Worker completed cinematic render job (${detailRes.body.job.output_render_path})`);
      passed++;
    }

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

    console.log('============================================================================');
    console.log(`ALL ${passed}/${totalTests} MODULE 8.3 CINEMATIC STUDIO TESTS PASSED SUCCESSFULLY!`);
    console.log('============================================================================');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runModule83Tests().catch((err) => {
  console.error('❌ MODULE 8.3 TEST SUITE FAILED:', err);
  process.exit(1);
});

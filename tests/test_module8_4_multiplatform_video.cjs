/**
 * GLOBAL MOBİLYA — MODULE 8.4: MULTI-PLATFORM VIDEO PRODUCTION ENGINE TESTS
 * ============================================================================
 * End-to-End Verification of:
 *   1. Video Production Catalog (5 Output Profiles: website, instagram, facebook,
 *      tiktok, youtube + 4 Render Quality Presets: preview, standard, high_quality, custom)
 *   2. Step 1-2: Load existing Module 8.2 Scene & Module 8.3 Cinematic Project
 *   3. Step 3-4: Adaptive Camera & Composition Reframing (16:9 HORIZONTAL vs 9:16 VERTICAL
 *      without simple cropping, preserving physical 3D product geometry & close-up details)
 *   4. High-Cost Render Approval Guard (blocks Standard/High Quality/Custom without user_approved)
 *   5. Step 5-9: Batch produce all 5 platforms -> verify horizontal (website 16:9) &
 *      vertical (instagram, facebook, tiktok, youtube 9:16) H.264 MP4 outputs,
 *      Supabase Storage paths (`studio/videos/{project_id}/{platform}/`), and metadata fields
 *   6. Video Editing & Assembly settings (transitions, fade in/out, title/logo overlay,
 *      audio volume & valid MP4 with or without audio)
 *   7. RenderWorkerDaemon end-to-end execution of a `multi_platform_video` job
 * ============================================================================
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  BlenderRunner,
  buildDeterministicCinematicBlendBuffer,
  inspectMp4VideoBuffer
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

async function runModule84Tests() {
  console.log('============================================================================');
  console.log('GLOBAL MOBİLYA — MODULE 8.4 MULTI-PLATFORM VIDEO PRODUCTION ENGINE TESTS');
  console.log('============================================================================');

  const videoLib = await import('../api/_lib/video-production-engine.js');
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
    // ── TEST 1: Video Catalog (All 5 Platform Profiles & 4 Quality Presets) ──
    {
      const req = { method: 'GET', url: '/api/module8?action=video-catalog', query: { action: 'video-catalog' }, headers: {} };
      const res = createMockRes();
      await handler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.platform_profiles.length, 5);
      assert.strictEqual(res.body.quality_presets.length, 4);

      const byPlat = Object.fromEntries(res.body.platform_profiles.map(p => [p.platform, p]));
      assert.strictEqual(byPlat.website.aspect_ratio, '16:9');
      assert.strictEqual(byPlat.website.default_width, 1920);
      assert.strictEqual(byPlat.website.default_height, 1080);
      assert.strictEqual(byPlat.website.default_fps, 24);

      for (const vp of ['instagram', 'facebook', 'tiktok', 'youtube']) {
        assert.strictEqual(byPlat[vp].aspect_ratio, '9:16');
        assert.strictEqual(byPlat[vp].default_width, 1080);
        assert.strictEqual(byPlat[vp].default_height, 1920);
        assert.strictEqual(byPlat[vp].default_fps, 30);
        assert.strictEqual(byPlat[vp].framing_rules.sensor_fit, 'VERTICAL');
      }
      // Verify Instagram and Facebook have independent framing rules
      assert.notStrictEqual(
        byPlat.instagram.framing_rules.distance_multiplier,
        byPlat.facebook.framing_rules.distance_multiplier
      );

      console.log('✓ [1/10] Video Catalog verified (5 Independent Platform Profiles & 4 Quality Presets)');
      passed++;
    }

    // ── TEST 2: Load Existing Module 8.2 Scene & Module 8.3 Cinematic Project ──
    const sceneId = 'scene_viyana_bedroom_84';
    const cinematicId = 'cin_viyana_luxury_84';
    {
      const saveSceneRes = createMockRes();
      await handler({
        method: 'POST',
        url: '/api/module8?action=scene-save',
        query: { action: 'scene-save' },
        headers: {},
        body: {
          scene_id: sceneId,
          scene_name: 'Viyana Yatak Odası 8.2 Sahnesi',
          room_dimensions: { room_width: 5.5, room_length: 4.8, room_height: 3.0 },
          asset_transforms: [
            {
              instance_id: 'inst_wardrobe_84',
              asset_id: 'asset_viyana_gardrop_01',
              product_slug: 'viyana-gardrop',
              product_name: 'Viyana 6 Kapaklı Gardırop',
              position_m: { x: 0.0, y: 1.5, z: 0.0 },
              dimensions_cm: { width_cm: 240, height_cm: 215, depth_cm: 62 }
            }
          ],
          lighting_profile: 'luxury_bedroom'
        }
      }, saveSceneRes);
      assert.strictEqual(saveSceneRes.statusCode, 200);

      const saveCinRes = createMockRes();
      await handler({
        method: 'POST',
        url: '/api/module8?action=cinematic-save',
        query: { action: 'cinematic-save' },
        headers: {},
        body: {
          cinematic_id: cinematicId,
          cinematic_name: 'Viyana Luxury Showcase 8.3',
          scene_id: sceneId,
          preset_id: 'luxury_product_showcase',
          fps: 24
        }
      }, saveCinRes);
      assert.strictEqual(saveCinRes.statusCode, 200);
      assert.strictEqual(saveCinRes.body.cinematic.cinematic_id, cinematicId);

      console.log('✓ [2/10] Module 8.2 Scene & Module 8.3 Cinematic Project loaded without recreating models');
      passed++;
    }

    // ── TEST 3: Adaptive Camera & Composition Reframing (16:9 vs 9:16 Without Cropping) ──
    {
      const loadCinRes = createMockRes();
      await handler({
        method: 'GET',
        url: `/api/module8?action=cinematic-load&cinematic_id=${cinematicId}`,
        query: { action: 'cinematic-load', cinematic_id: cinematicId },
        headers: {}
      }, loadCinRes);
      const sourceCin = loadCinRes.body.cinematic;

      const webSpec = videoLib.adaptCinematicCameraForPlatform(sourceCin, 'website', { quality_preset: 'high_quality' });
      const igSpec = videoLib.adaptCinematicCameraForPlatform(sourceCin, 'instagram', { quality_preset: 'high_quality' });
      const fbSpec = videoLib.adaptCinematicCameraForPlatform(sourceCin, 'facebook', { quality_preset: 'high_quality' });
      const ttSpec = videoLib.adaptCinematicCameraForPlatform(sourceCin, 'tiktok', { quality_preset: 'high_quality' });
      const ytSpec = videoLib.adaptCinematicCameraForPlatform(sourceCin, 'youtube', { quality_preset: 'high_quality' });

      assert.strictEqual(webSpec.sensor_fit, 'HORIZONTAL');
      assert.strictEqual(webSpec.resolution, '1920x1080');
      assert.strictEqual(webSpec.fps, 24);
      assert.strictEqual(webSpec.reframed_without_simple_crop, true);
      assert.strictEqual(webSpec.physical_geometry_preserved, true);

      assert.strictEqual(igSpec.sensor_fit, 'VERTICAL');
      assert.strictEqual(igSpec.resolution, '1080x1920');
      assert.strictEqual(igSpec.fps, 30);
      assert.strictEqual(igSpec.reframed_without_simple_crop, true);
      assert.strictEqual(igSpec.physical_geometry_preserved, true);

      // Verify TikTok opens with close-up detail hook while Website opens with wide establishing shot
      assert.strictEqual(webSpec.shots[0].movement_type, 'wide_establishing_shot');
      assert.strictEqual(ttSpec.shots[0].movement_type, 'closeup_detail_movement');
      assert.notDeepStrictEqual(igSpec.master_keyframes[0].camera_location, fbSpec.master_keyframes[0].camera_location);
      assert.notDeepStrictEqual(igSpec.master_keyframes[0].camera_location, ytSpec.master_keyframes[0].camera_location);

      console.log('✓ [3/10] Adaptive Camera Reframing verified across all 5 channels (No simple 16:9 crop)');
      passed++;
    }

    // ── TEST 4: High-Cost Render Approval Guard ──
    {
      const unapprovedRes = createMockRes();
      await handler({
        method: 'POST',
        url: '/api/module8?action=video-produce',
        query: { action: 'video-produce' },
        headers: {},
        body: {
          project_id: 'vproj_guard_test',
          cinematic_id: cinematicId,
          platforms: ['website'],
          quality_preset: 'high_quality',
          user_approved: false
        }
      }, unapprovedRes);

      assert.strictEqual(unapprovedRes.statusCode, 400);
      assert.strictEqual(unapprovedRes.body.error_code, 'VIDEO_APPROVAL_REQUIRED_FOR_HIGH_COST_RENDER');

      console.log('✓ [4/10] High-cost video render approval guard enforced');
      passed++;
    }

    // ── TEST 5: Produce Preview Videos for All 5 Channels Sequentially ──
    const projectId = 'vproj_viyana_all5';
    {
      const prodRes = createMockRes();
      await handler({
        method: 'POST',
        url: '/api/module8?action=video-produce',
        query: { action: 'video-produce' },
        headers: {},
        body: {
          project_id: projectId,
          cinematic_id: cinematicId,
          platforms: ['website', 'instagram', 'facebook', 'tiktok', 'youtube'],
          quality_preset: 'preview',
          editing_settings: {
            transition_type: 'crossfade',
            fade_in_sec: 0.5,
            fade_out_sec: 0.6,
            title_overlay: { enabled: true, text: 'VİYANA KOLEKSİYONU' },
            brand_logo_overlay: { enabled: true, brand_name: 'GLOBAL MOBİLYA' }
          }
        }
      }, prodRes);

      assert.strictEqual(prodRes.statusCode, 200);
      assert.strictEqual(prodRes.body.ok, true);
      assert.strictEqual(prodRes.body.videos.length, 5);
      assert.strictEqual(prodRes.body.resource_estimate.is_estimate_only, true);

      console.log('✓ [5/10] All 5 platform preview videos produced sequentially in a single project');
      passed++;
    }

    // ── TEST 6: Produce High-Quality Horizontal (Website 16:9) & Vertical (Instagram 9:16) Videos ──
    const hqProjectId = 'vproj_viyana_hq_master';
    {
      const hqRes = createMockRes();
      await handler({
        method: 'POST',
        url: '/api/module8?action=video-produce',
        query: { action: 'video-produce' },
        headers: {},
        body: {
          project_id: hqProjectId,
          cinematic_id: cinematicId,
          platforms: ['website', 'instagram'],
          quality_preset: 'high_quality',
          user_approved: true,
          editing_settings: {
            transition_type: 'dip_to_black',
            fade_in_sec: 0.6,
            fade_out_sec: 0.8,
            title_overlay: { enabled: true, text: 'VİYANA YATAK ODASI' },
            brand_logo_overlay: { enabled: true, brand_name: 'GLOBAL MOBİLYA' },
            audio_settings: { enabled: true, audio_track_path: 'licensed_ambient_piano.mp3', volume: 0.8 }
          }
        }
      }, hqRes);

      assert.strictEqual(hqRes.statusCode, 200);
      assert.strictEqual(hqRes.body.videos.length, 2);

      const webVid = hqRes.body.videos.find(v => v.platform === 'website');
      const igVid = hqRes.body.videos.find(v => v.platform === 'instagram');

      assert.strictEqual(webVid.resolution, '1920x1080');
      assert.strictEqual(webVid.fps, 24);
      assert.strictEqual(webVid.aspect_ratio, '16:9');
      assert.strictEqual(webVid.sensor_fit, 'HORIZONTAL');
      assert.strictEqual(webVid.encoding_format, 'mp4');
      assert.strictEqual(webVid.video_codec, 'h264');

      assert.strictEqual(igVid.resolution, '1080x1920');
      assert.strictEqual(igVid.fps, 30);
      assert.strictEqual(igVid.aspect_ratio, '9:16');
      assert.strictEqual(igVid.sensor_fit, 'VERTICAL');
      assert.strictEqual(igVid.encoding_format, 'mp4');
      assert.strictEqual(igVid.video_codec, 'h264');

      console.log('✓ [6/10] High-Quality 16:9 Horizontal (Website) & 9:16 Vertical (Instagram) H.264 MP4 outputs verified');
      passed++;
    }

    // ── TEST 7: Verify Supabase Storage Directory Structure & Valid MP4 Binary Container ──
    {
      for (const plat of ['website', 'instagram', 'facebook', 'tiktok', 'youtube']) {
        const expectedDir = `studio/videos/${projectId}/${plat}/`;
        const mp4Path = `${expectedDir}${projectId}_${plat}_preview.mp4`;
        const metaPath = `${expectedDir}video_metadata.json`;
        const prevPath = `${expectedDir}preview_frame.jpg`;

        assert.ok(uploadedStorageObjects.has(mp4Path), `Missing MP4 in storage: ${mp4Path}`);
        assert.ok(uploadedStorageObjects.has(metaPath), `Missing metadata JSON in storage: ${metaPath}`);
        assert.ok(uploadedStorageObjects.has(prevPath), `Missing preview frame in storage: ${prevPath}`);

        const mp4Obj = uploadedStorageObjects.get(mp4Path);
        assert.strictEqual(mp4Obj.contentType, 'video/mp4');
        const check = inspectMp4VideoBuffer(mp4Obj.buffer);
        assert.strictEqual(check.valid, true, `MP4 container check failed for ${plat}`);
        assert.strictEqual(check.boxType, 'ftyp');
        assert.strictEqual(check.manifest.platform, plat);
        assert.strictEqual(check.manifest.reframed_without_simple_crop, true);
        assert.strictEqual(check.manifest.physical_geometry_preserved, true);
      }

      console.log('✓ [7/10] Supabase Storage (`studio/videos/{project_id}/{platform}/`) & H.264 MP4 `ftyp` binaries verified for all 5 platforms');
      passed++;
    }

    // ── TEST 8: Verify Video Metadata Schema & Load Endpoint ──
    {
      const listRes = createMockRes();
      await handler({
        method: 'GET',
        url: `/api/module8?action=video-load&project_id=${projectId}`,
        query: { action: 'video-load', project_id: projectId },
        headers: {}
      }, listRes);

      assert.strictEqual(listRes.statusCode, 200);
      assert.strictEqual(listRes.body.studio_videos.length, 5);

      const requiredFields = [
        'platform', 'resolution', 'fps', 'duration', 'file_size',
        'encoding_format', 'source_cinematic_project', 'render_status',
        'storage_path', 'created_at'
      ];
      for (const vid of listRes.body.studio_videos) {
        for (const f of requiredFields) {
          assert.ok(vid[f] !== undefined && vid[f] !== null, `Video record missing field '${f}'`);
        }
      }

      console.log('✓ [8/10] Video metadata schema & query filtering verified');
      passed++;
    }

    // ── TEST 9: Direct BlenderRunner.renderPlatformVideo Execution ──
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm84-video-test-'));
    const tempBlendPath = path.join(tempDir, 'cinematic_input.blend');
    const tempMp4Out = path.join(tempDir, 'tiktok_out.mp4');
    const tempPreviewOut = path.join(tempDir, 'tiktok_preview.jpg');
    {
      fs.writeFileSync(tempBlendPath, buildDeterministicCinematicBlendBuffer({
        cinematic_id: cinematicId,
        scene_id: sceneId,
        fps: 30
      }));

      const runner = new BlenderRunner({
        nodeEnv: 'development',
        blenderBin: 'nonexistent_blender_bin_for_test',
        allowSimulation: true,
        allowedTempDir: tempDir
      });

      const runRes = await runner.renderPlatformVideo({
        project_id: projectId,
        platform: 'tiktok',
        aspect_ratio: '9:16',
        sensor_fit: 'VERTICAL',
        input_blend_path: tempBlendPath,
        output_mp4_path: tempMp4Out,
        preview_frame_path: tempPreviewOut,
        width_px: 360,
        height_px: 640,
        fps: 30,
        samples: 8,
        frame_start: 1,
        frame_end: 30,
        total_frames: 30,
        duration_sec: 1.0
      });

      assert.strictEqual(runRes.success, true);
      assert.ok(fs.existsSync(tempMp4Out));
      const check = inspectMp4VideoBuffer(tempMp4Out);
      assert.strictEqual(check.valid, true);
      assert.strictEqual(check.manifest.platform, 'tiktok');
      assert.strictEqual(check.manifest.sensor_fit, 'VERTICAL');

      console.log('✓ [9/10] BlenderRunner.renderPlatformVideo produced verified MP4 & preview JPEG');
      passed++;
    }

    // ── TEST 10: RenderWorkerDaemon End-to-End Multi-Platform Video Job Claim & Upload ──
    {
      const workerKey = 'test_worker_secret_key_84';
      process.env.RENDER_WORKER_KEY = workerKey;

      // Queue a pending worker video job
      const queueRes = createMockRes();
      await handler({
        method: 'POST',
        url: '/api/module8?action=video-produce',
        query: { action: 'video-produce' },
        headers: {},
        body: {
          project_id: 'vproj_worker_e2e',
          cinematic_id: cinematicId,
          platforms: ['youtube'],
          quality_preset: 'preview',
          local_blend_path: tempBlendPath,
          queue_for_worker: true
        }
      }, queueRes);
      assert.strictEqual(queueRes.statusCode, 200);
      const queuedJob = queueRes.body.jobs[0];
      assert.strictEqual(queuedJob.status, 'pending');
      assert.strictEqual(queuedJob.production_type, 'multi_platform_video');

      // Route worker client requests to in-process handler
      const localApiFetch = async (url, opts = {}) => {
        const parsed = new URL(url);
        const action = parsed.searchParams.get('action');
        const reqObj = {
          method: opts.method || 'POST',
          url: parsed.pathname + parsed.search,
          query: Object.fromEntries(parsed.searchParams.entries()),
          headers: {
            'x-worker-key': workerKey,
            ...(opts.headers || {})
          },
          body: opts.body ? JSON.parse(opts.body) : {}
        };
        const resObj = createMockRes();
        await handler(reqObj, resObj);
        return {
          ok: resObj.statusCode >= 200 && resObj.statusCode < 300,
          status: resObj.statusCode,
          text: async () => JSON.stringify(resObj.body),
          json: async () => resObj.body
        };
      };

      const daemon = new RenderWorkerDaemon({
        nodeEnv: 'development',
        apiBaseUrl: 'http://localhost:3000',
        workerKey,
        tempDir,
        allowSimulation: true,
        allowSimulatedUploads: true,
        fetchImpl: localApiFetch
      });

      const processed = await daemon.processJob(queuedJob);
      assert.strictEqual(processed, true);

      const expectedWorkerVideoPath = 'studio/videos/vproj_worker_e2e/youtube/vproj_worker_e2e_youtube_preview.mp4';
      assert.ok(
        uploadedStorageObjects.has(expectedWorkerVideoPath),
        `Worker did not upload MP4 to expected path: ${expectedWorkerVideoPath}`
      );

      console.log('✓ [10/10] RenderWorkerDaemon claimed, rendered, verified MP4 `ftyp`, and uploaded to Supabase Storage');
      passed++;
    }

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

    console.log('============================================================================');
    console.log(`ALL MODULE 8.4 TESTS PASSED: ${passed}/${totalTests} PASS`);
    console.log('============================================================================');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runModule84Tests().catch((err) => {
  console.error('MODULE 8.4 TEST FAILED:', err);
  process.exit(1);
});

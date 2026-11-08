/**
 * ============================================================================
 * GLOBAL MOBİLYA — MODULE 8.1: AI ASSET RECONSTRUCTION ENGINE (TRIPO H3.1)
 * Comprehensive Mock & Security Test Suite (Zero Paid Live API Calls)
 * ============================================================================
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const results = [];

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     -> ${err.message}`);
  }
}

/**
 * Helper to create a valid minimal JPEG buffer with explicit SOF0 width & height
 */
function buildTestJpegBuffer(width = 512, height = 512, extraPaddingBytes = 128) {
  const header = Buffer.from([
    0xFF, 0xD8, // SOI
    0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    0xFF, 0xC0, 0x00, 0x11, 0x08, // SOF0 marker, length 17, 8-bit precision
    (height >> 8) & 0xFF, height & 0xFF,
    (width >> 8) & 0xFF, width & 0xFF,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01
  ]);
  const padding = Buffer.alloc(Math.max(0, extraPaddingBytes), 0x55);
  const eoi = Buffer.from([0xFF, 0xD9]);
  return Buffer.concat([header, padding, eoi]);
}

/**
 * Helper to create a valid minimal PNG buffer with explicit IHDR width & height
 */
function buildTestPngBuffer(width = 640, height = 640, extraPaddingBytes = 128) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);
  const ihdrTag = Buffer.from('IHDR', 'ascii');
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  const crc = Buffer.alloc(4, 0);
  const idatPad = Buffer.alloc(Math.max(0, extraPaddingBytes), 0x42);
  const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
  return Buffer.concat([sig, ihdrLen, ihdrTag, ihdrData, crc, idatPad, iend]);
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(data) { this.body = data; return this; }
  };
}

async function main() {
  console.log('\n============================================================================');
  console.log('GLOBAL MOBİLYA — MODULE 8.1: TRIPO H3.1 AI ASSET RECONSTRUCTION TEST SUITE');
  console.log('============================================================================\n');

  const tripoLib = await import('../api/_lib/tripo-client.js');
  const module8Mod = await import('../api/module8.js');
  const module8Handler = module8Mod.default;
  const { RenderWorkerDaemon } = require('../Sunucu/render-worker/worker-daemon.js');

  // Set mock environment variables (NEVER a real paid key)
  const MOCK_TRIPO_SECRET = 'tsk_mock_tripo_secret_key_998877665544';
  process.env.TRIPO_API_KEY = MOCK_TRIPO_SECRET;
  process.env.RENDER_WORKER_KEY = 'worker_secret_key_test_12345678';
  process.env.TRIPO_MAX_JOB_COST_USD = '1.00';
  process.env.TRIPO_TOTAL_BUDGET_USD = '25.00';

  // Intercept global fetch for Supabase Storage / site_settings and Mocked Tripo API
  const uploadedStorageObjects = new Map();
  let mockStudioStoreState = null;
  let tripoUploadCalls = 0;
  let tripoCreateTaskCalls = 0;
  let tripoPollCalls = 0;
  let tripoGlbDownloadCalls = 0;
  let mockTripoBehavior = 'success'; // 'success' | 'failed' | 'rate_limit' | 'timeout' | 'corrupt_glb'

  const validSampleGlbBuffer = tripoLib.buildSampleValidGlbBuffer();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);

    // 1. Mock Supabase Storage uploads: /storage/v1/object/media/...
    if (urlStr.includes('/storage/v1/object/media/')) {
      const storagePath = urlStr.split('/storage/v1/object/media/')[1];
      const buf = Buffer.isBuffer(options.body) ? options.body : Buffer.from(options.body || '');
      uploadedStorageObjects.set(storagePath, {
        buffer: buf,
        contentType: options.headers?.['Content-Type'] || 'application/octet-stream',
        upsert: options.headers?.['x-upsert'] || 'false'
      });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Key: `media/${storagePath}` })
      };
    }

    // 2. Mock Supabase site_settings persistence
    if (urlStr.includes('/rest/v1/site_settings')) {
      if ((options.method || 'GET').toUpperCase() === 'POST') {
        const parsed = JSON.parse(options.body);
        if (parsed.key === 'module8_studio_store') {
          mockStudioStoreState = parsed.data;
        }
        return { ok: true, status: 201, text: async () => '' };
      }
      if (mockStudioStoreState) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify([{ data: mockStudioStoreState }])
        };
      }
      return { ok: true, status: 200, text: async () => '[]' };
    }

    // 3. Mock Tripo H3.1 File Upload: POST https://openapi.tripo3d.ai/v3/files
    if (urlStr.includes('openapi.tripo3d.ai/v3/files')) {
      tripoUploadCalls++;
      if (mockTripoBehavior === 'rate_limit') {
        return {
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ message: `Rate limit exceeded for key ${MOCK_TRIPO_SECRET}` })
        };
      }
      if (mockTripoBehavior === 'timeout') {
        const abortErr = new Error('The operation was aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 0,
          data: { image_token: `ftok_${Date.now()}_${tripoUploadCalls}` }
        })
      };
    }

    // 4. Mock Tripo H3.1 Task Creation: POST https://openapi.tripo3d.ai/v3/generation/image-to-model
    if (urlStr.includes('openapi.tripo3d.ai/v3/generation/image-to-model')) {
      tripoCreateTaskCalls++;
      const reqBody = JSON.parse(options.body || '{}');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 0,
          data: {
            task_id: `tripo_task_${Date.now()}_${tripoCreateTaskCalls}`,
            echo_model: reqBody.model_version
          }
        })
      };
    }

    // 5. Mock Tripo H3.1 Task Polling: GET https://openapi.tripo3d.ai/v3/tasks/{task_id}
    if (urlStr.includes('openapi.tripo3d.ai/v3/tasks/')) {
      tripoPollCalls++;
      const taskId = urlStr.split('/v3/tasks/')[1];
      if (mockTripoBehavior === 'rate_limit') {
        return {
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ message: 'Too Many Requests (429)' })
        };
      }
      if (mockTripoBehavior === 'failed') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            code: 0,
            data: {
              task_id: taskId,
              status: 'failed',
              progress: 40,
              message: `Reconstruction mesh failed (auth=${MOCK_TRIPO_SECRET})`
            }
          })
        };
      }
      if (mockTripoBehavior === 'running_once') {
        mockTripoBehavior = 'success';
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            code: 0,
            data: {
              task_id: taskId,
              status: 'running',
              progress: 68
            }
          })
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 0,
          data: {
            task_id: taskId,
            status: 'success',
            progress: 100,
            consumed_credit: 30,
            output: {
              pbr_model: `https://temp-cdn.tripo3d.ai/signed/${taskId}/model.glb?expires=300`
            }
          }
        })
      };
    }

    // 6. Mock Temporary GLB Download URL
    if (urlStr.includes('temp-cdn.tripo3d.ai/signed/')) {
      tripoGlbDownloadCalls++;
      const outBuf = mockTripoBehavior === 'corrupt_glb'
        ? Buffer.from('NOT_A_VALID_GLB_FILE_HEADER_1234567890')
        : validSampleGlbBuffer;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => outBuf.buffer.slice(outBuf.byteOffset, outBuf.byteOffset + outBuf.byteLength)
      };
    }

    return originalFetch(url, options);
  };

  try {
    // ── TEST 1: Valid JPG & PNG Single-Furniture Upload & Preparation (Zero Tripo API Calls) ──
    await runTest('1. Valid JPG & PNG upload preparation succeeds and makes ZERO Tripo API calls', async () => {
      const jpgBuf = buildTestJpegBuffer(1024, 768, 512);
      const pngBuf = buildTestPngBuffer(800, 800);

      const beforeCalls = tripoUploadCalls + tripoCreateTaskCalls;

      // Test JPG prepare
      const reqJpg = {
        method: 'POST',
        url: '/api/module8?action=recon-prepare',
        query: { action: 'recon-prepare' },
        headers: {},
        body: {
          product_slug: 'viyana-berjer',
          product_name: 'Viyana Lüks Berjer',
          file_name: 'viyana_berjer.jpg',
          mime_type: 'image/jpeg',
          file_base64: jpgBuf.toString('base64'),
          single_item_confirmed: true,
          dimensions_cm: { width_cm: 85, height_cm: 92, depth_cm: 88 }
        }
      };
      const resJpg = createMockRes();
      await module8Handler(reqJpg, resJpg);

      assert.strictEqual(resJpg.statusCode, 201, `Expected 201, got ${resJpg.statusCode}: ${JSON.stringify(resJpg.body)}`);
      assert.strictEqual(resJpg.body.ok, true);
      assert.strictEqual(resJpg.body.job.status, 'draft_prepared');
      assert.strictEqual(resJpg.body.job.source_width_px, 1024);
      assert.strictEqual(resJpg.body.job.source_height_px, 768);
      assert.ok(resJpg.body.job.source_image_path.startsWith('studio/assets/viyana-berjer/'));

      // Test PNG prepare
      const reqPng = {
        method: 'POST',
        url: '/api/module8?action=recon-prepare',
        query: { action: 'recon-prepare' },
        headers: {},
        body: {
          product_slug: 'siena-komodin',
          product_name: 'Siena Masif Komodin',
          file_name: 'siena_komodin.png',
          mime_type: 'image/png',
          file_base64: pngBuf.toString('base64'),
          single_item_confirmed: true
        }
      };
      const resPng = createMockRes();
      await module8Handler(reqPng, resPng);
      assert.strictEqual(resPng.statusCode, 201);
      assert.strictEqual(resPng.body.job.source_width_px, 800);

      // Verify ZERO Tripo API calls occurred during upload/prepare
      const afterCalls = tripoUploadCalls + tripoCreateTaskCalls;
      assert.strictEqual(afterCalls, beforeCalls, 'Upload/Prepare MUST NOT trigger any Tripo API call');
    });

    // ── TEST 2: Invalid File Type & Magic Byte Mismatch Rejection ──
    await runTest('2. Invalid file type (.exe/.gif) and spoofed binary headers are rejected', async () => {
      const fakeJpg = Buffer.from('GIF89a_spoofed_as_jpeg_file_content_1234567890');
      const reqSpoof = {
        method: 'POST',
        url: '/api/module8?action=recon-prepare',
        query: { action: 'recon-prepare' },
        headers: {},
        body: {
          product_slug: 'test-chair',
          product_name: 'Test Koltuk',
          file_name: 'chair.jpg',
          mime_type: 'image/jpeg',
          file_base64: fakeJpg.toString('base64'),
          single_item_confirmed: true
        }
      };
      const resSpoof = createMockRes();
      await module8Handler(reqSpoof, resSpoof);
      assert.strictEqual(resSpoof.statusCode, 400);
      assert.ok(resSpoof.body.error.includes('Desteklenmeyen') || resSpoof.body.error.includes('RECON_IMAGE'));

      // Also test multi-furniture / unconfirmed single item rejection
      const validJpg = buildTestJpegBuffer(512, 512);
      const reqMulti = {
        method: 'POST',
        url: '/api/module8?action=recon-prepare',
        query: { action: 'recon-prepare' },
        headers: {},
        body: {
          product_slug: 'full-bedroom',
          product_name: 'Viyana Yatak Odası',
          file_name: 'room.jpg',
          mime_type: 'image/jpeg',
          file_base64: validJpg.toString('base64'),
          single_item_confirmed: false
        }
      };
      const resMulti = createMockRes();
      await module8Handler(reqMulti, resMulti);
      assert.strictEqual(resMulti.statusCode, 400);
      assert.ok(resMulti.body.error.includes('RECON_SINGLE_ITEM_REQUIRED'));
    });

    // ── TEST 3: File Size Limit (>10MB) & Resolution Bounds (256..4096) Enforcement ──
    await runTest('3. File size limit (>10 MB) and resolution bounds (<256px or >4096px) are strictly enforced', async () => {
      // Too small resolution (128x128)
      const tinyJpg = buildTestJpegBuffer(128, 128);
      assert.throws(() => {
        tripoLib.validateReconstructionImageInput({
          file_base64: tinyJpg.toString('base64'),
          file_name: 'tiny.jpg',
          mime_type: 'image/jpeg',
          product_name: 'Küçük Puf',
          single_item_confirmed: true
        });
      }, /RECON_IMAGE_RESOLUTION_TOO_LOW/);

      // Too high resolution (5000x5000)
      const hugeResJpg = buildTestJpegBuffer(5000, 5000);
      assert.throws(() => {
        tripoLib.validateReconstructionImageInput({
          file_base64: hugeResJpg.toString('base64'),
          file_name: 'huge_res.jpg',
          mime_type: 'image/jpeg',
          product_name: 'Büyük Dolap',
          single_item_confirmed: true
        });
      }, /RECON_IMAGE_RESOLUTION_TOO_HIGH/);

      // >10MB file size rejection
      const over10MbJpg = buildTestJpegBuffer(512, 512, 10 * 1024 * 1024 + 1024);
      assert.throws(() => {
        tripoLib.validateReconstructionImageInput({
          file_base64: over10MbJpg.toString('base64'),
          file_name: 'over10mb.jpg',
          mime_type: 'image/jpeg',
          product_name: 'Ağır Dosya',
          single_item_confirmed: true
        });
      }, /RECON_IMAGE_TOO_LARGE/);
    });

    // ── TEST 4: Tripo H3.1 Generation Settings Validation (generate_parts incompatibility) ──
    await runTest('4. Tripo H3.1 generation settings enforce v3.1-20260211 and block generate_parts with texture/pbr', async () => {
      const defaults = tripoLib.buildTripoH31GenerationSettings({});
      assert.strictEqual(defaults.model, 'v3.1-20260211');
      assert.strictEqual(defaults.texture, true);
      assert.strictEqual(defaults.pbr, true);
      assert.strictEqual(defaults.texture_quality, 'standard');
      assert.strictEqual(defaults.geometry_quality, 'detailed');
      assert.strictEqual(defaults.texture_alignment, 'original_image');
      assert.strictEqual(defaults.generate_parts, undefined);

      assert.throws(() => {
        tripoLib.buildTripoH31GenerationSettings({
          texture: true,
          pbr: true,
          generate_parts: true
        });
      }, /TRIPO_INCOMPATIBLE_SETTINGS/);
    });

    // ── TEST 5: Cost Control — Unapproved Generation & Per-Job ($1.00) / Total Budget Limits ──
    await runTest('5. Cost control blocks unapproved calls, >$1.00 per-job cost, and budget overflows', async () => {
      const jpgBuf = buildTestJpegBuffer(600, 600);

      // Missing user_cost_approved -> rejected with zero Tripo calls
      const beforeTripo = tripoCreateTaskCalls;
      const reqNoApprove = {
        method: 'POST',
        url: '/api/module8?action=recon-start',
        query: { action: 'recon-start' },
        headers: {},
        body: {
          product_slug: 'verona-berjer',
          product_name: 'Verona Berjer',
          file_name: 'verona.jpg',
          mime_type: 'image/jpeg',
          file_base64: jpgBuf.toString('base64'),
          single_item_confirmed: true,
          user_cost_approved: false
        }
      };
      const resNoApprove = createMockRes();
      await module8Handler(reqNoApprove, resNoApprove);
      assert.strictEqual(resNoApprove.statusCode, 400);
      assert.strictEqual(resNoApprove.body.error_code, 'COST_GUARD_REJECTED');
      assert.strictEqual(tripoCreateTaskCalls, beforeTripo, 'Must not call Tripo when user_cost_approved is false');

      // Per-job cost exceeding $1.00 limit -> rejected
      const reqOverJobLimit = {
        method: 'POST',
        url: '/api/module8?action=recon-start',
        query: { action: 'recon-start' },
        headers: {},
        body: {
          product_slug: 'verona-berjer-2',
          product_name: 'Verona Berjer 2',
          file_name: 'verona2.jpg',
          mime_type: 'image/jpeg',
          file_base64: jpgBuf.toString('base64'),
          single_item_confirmed: true,
          user_cost_approved: true,
          estimated_cost: 1.50,
          max_cost_limit_usd: 1.00
        }
      };
      const resOverLimit = createMockRes();
      await module8Handler(reqOverJobLimit, resOverLimit);
      assert.strictEqual(resOverLimit.statusCode, 400);
      assert.ok(resOverLimit.body.error.includes('COST_GUARD_JOB_LIMIT_EXCEEDED'));

      // Total budget ceiling exceeded -> rejected
      assert.throws(() => {
        tripoLib.evaluateReconstructionCostGuard({
          userCostApproved: true,
          estimatedCostUsd: 0.40,
          maxJobCostLimitUsd: 1.00,
          currentSpentUsd: 24.80,
          totalBudgetLimitUsd: 25.00
        });
      }, /COST_GUARD_TOTAL_BUDGET_EXCEEDED/);
    });

    // ── TEST 6: Full End-to-End Mocked Tripo H3.1 Flow (Upload -> Task Create -> Poll -> GLB Download -> Validate -> Supabase Storage) ──
    let completedJobId = null;
    let completedAssetId = null;
    await runTest('6. Full E2E flow: Tripo upload -> task create -> poll -> GLB download -> binary validation -> Supabase Storage upload & metadata persistence', async () => {
      mockTripoBehavior = 'running_once';
      const jpgBuf = buildTestJpegBuffer(1024, 1024, 256);

      // Step A: Prepare
      const prepReq = {
        method: 'POST',
        url: '/api/module8?action=recon-prepare',
        query: { action: 'recon-prepare' },
        headers: {},
        body: {
          asset_id: 'ast3d_viyana_berjer_01',
          job_id: 'recon_job_viyana_01',
          product_slug: 'viyana-berjer',
          product_id: 'prod_viyana_01',
          product_name: 'Viyana Lüks Berjer',
          file_name: 'viyana_berjer.jpg',
          mime_type: 'image/jpeg',
          file_base64: jpgBuf.toString('base64'),
          single_item_confirmed: true,
          dimensions_cm: { width_cm: 80, height_cm: 90, depth_cm: 85 },
          idempotency_key: 'idem_viyana_001'
        }
      };
      const prepRes = createMockRes();
      await module8Handler(prepReq, prepRes);
      assert.strictEqual(prepRes.statusCode, 201);
      completedJobId = prepRes.body.job.id;
      completedAssetId = prepRes.body.job.asset_id;

      // Step B: Start Generation (with explicit user cost approval)
      const startReq = {
        method: 'POST',
        url: '/api/module8?action=recon-start',
        query: { action: 'recon-start' },
        headers: {},
        body: {
          job_id: completedJobId,
          user_cost_approved: true
        }
      };
      const startRes = createMockRes();
      await module8Handler(startReq, startRes);
      assert.strictEqual(startRes.statusCode, 200);
      assert.strictEqual(startRes.body.job.status, 'processing');
      assert.ok(startRes.body.job.provider_file_token.startsWith('ftok_'));
      assert.ok(startRes.body.job.provider_task_id.startsWith('tripo_task_'));

      // Step C: First Poll -> 'running' (68%)
      const pollReq1 = {
        method: 'GET',
        url: `/api/module8?action=recon-poll&job_id=${completedJobId}`,
        query: { action: 'recon-poll', job_id: completedJobId },
        headers: {}
      };
      const pollRes1 = createMockRes();
      await module8Handler(pollReq1, pollRes1);
      assert.strictEqual(pollRes1.statusCode, 200);
      assert.strictEqual(pollRes1.body.job.status, 'processing');
      assert.strictEqual(pollRes1.body.job.progress_percent, 68);

      // Step D: Second Poll -> 'success' -> downloads temporary GLB -> validates binary -> uploads to studio/assets/{product_slug}/{asset_id}/model.glb
      const pollRes2 = createMockRes();
      await module8Handler(pollReq1, pollRes2);
      assert.strictEqual(pollRes2.statusCode, 200);
      assert.strictEqual(pollRes2.body.job.status, 'completed');
      assert.strictEqual(pollRes2.body.job.progress_percent, 100);

      const expectedGlbPath = 'studio/assets/viyana-berjer/ast3d_viyana_berjer_01/model.glb';
      assert.strictEqual(pollRes2.body.job.generated_model_path, expectedGlbPath);
      assert.ok(uploadedStorageObjects.has(expectedGlbPath), 'GLB must be uploaded to Supabase Storage at exact required path');

      const storedGlbObj = uploadedStorageObjects.get(expectedGlbPath);
      assert.strictEqual(storedGlbObj.contentType, 'model/gltf-binary');
      assert.strictEqual(storedGlbObj.buffer.length, validSampleGlbBuffer.length);

      // Verify metadata record in three_d_assets
      const tdAsset = pollRes2.body.three_d_asset;
      assert.ok(tdAsset, 'three_d_asset record must be returned');
      assert.strictEqual(tdAsset.asset_id, 'ast3d_viyana_berjer_01');
      assert.strictEqual(tdAsset.product_id, 'prod_viyana_01');
      assert.strictEqual(tdAsset.source_image_path, 'studio/assets/viyana-berjer/ast3d_viyana_berjer_01/source.jpg');
      assert.strictEqual(tdAsset.generated_model_path, expectedGlbPath);
      assert.strictEqual(tdAsset.provider, 'tripo3d');
      assert.strictEqual(tdAsset.provider_model, 'v3.1-20260211');
      assert.ok(tdAsset.provider_task_id.startsWith('tripo_task_'));
      assert.strictEqual(tdAsset.file_size_bytes, validSampleGlbBuffer.length);
      assert.strictEqual(tdAsset.estimated_cost, 0.30);
      assert.strictEqual(tdAsset.actual_cost, 0.30);
      assert.strictEqual(tdAsset.status, 'completed');
      assert.strictEqual(tdAsset.blender_ready, true);
      assert.ok(tdAsset.created_at);
      assert.ok(tdAsset.completed_at);
    });

    // ── TEST 7: Idempotency Guard Prevents Duplicate Paid Tasks ──
    await runTest('7. Idempotency guard blocks duplicate Tripo task creation for an existing job', async () => {
      const tasksBefore = tripoCreateTaskCalls;
      const dupStartReq = {
        method: 'POST',
        url: '/api/module8?action=recon-start',
        query: { action: 'recon-start' },
        headers: {},
        body: {
          job_id: completedJobId,
          user_cost_approved: true
        }
      };
      const dupRes = createMockRes();
      await module8Handler(dupStartReq, dupRes);
      assert.strictEqual(dupRes.statusCode, 200);
      assert.strictEqual(dupRes.body.note, 'idempotent_existing_task');
      assert.strictEqual(tripoCreateTaskCalls, tasksBefore, 'Idempotent call MUST NOT create a second paid Tripo task');
    });

    // ── TEST 8: Failed Task Handling & Zero Automatic Retries Without User Confirmation ──
    await runTest('8. Failed Tripo task is recorded cleanly and NEVER auto-retried without explicit user_regenerate_approved', async () => {
      mockTripoBehavior = 'failed';
      const jpgBuf = buildTestJpegBuffer(512, 512);

      const startReq = {
        method: 'POST',
        url: '/api/module8?action=recon-start',
        query: { action: 'recon-start' },
        headers: {},
        body: {
          job_id: 'recon_job_fail_test',
          asset_id: 'ast3d_fail_01',
          product_slug: 'kopenhag-puf',
          product_name: 'Kopenhag Puf',
          file_name: 'puf.jpg',
          mime_type: 'image/jpeg',
          file_base64: jpgBuf.toString('base64'),
          single_item_confirmed: true,
          user_cost_approved: true
        }
      };
      const startRes = createMockRes();
      await module8Handler(startReq, startRes);
      assert.strictEqual(startRes.statusCode, 200);

      // Poll -> transitions to 'failed'
      const pollReq = {
        method: 'GET',
        url: '/api/module8?action=recon-poll&job_id=recon_job_fail_test',
        query: { action: 'recon-poll', job_id: 'recon_job_fail_test' },
        headers: {}
      };
      const pollRes = createMockRes();
      await module8Handler(pollReq, pollRes);
      assert.strictEqual(pollRes.body.job.status, 'failed');
      assert.strictEqual(pollRes.body.job.error_code, 'TRIPO_TASK_FAILED');
      assert.ok(!pollRes.body.job.error_message.includes(MOCK_TRIPO_SECRET), 'Error message must redact TRIPO_API_KEY');

      // Attempt to restart failed job WITHOUT user_regenerate_approved -> must be blocked!
      const tasksBeforeRetry = tripoCreateTaskCalls;
      const retryWithoutApprovalReq = {
        method: 'POST',
        url: '/api/module8?action=recon-start',
        query: { action: 'recon-start' },
        headers: {},
        body: {
          job_id: 'recon_job_fail_test',
          user_cost_approved: true,
          user_regenerate_approved: false
        }
      };
      const retryBlockedRes = createMockRes();
      await module8Handler(retryWithoutApprovalReq, retryBlockedRes);
      assert.strictEqual(retryBlockedRes.statusCode, 400);
      assert.strictEqual(retryBlockedRes.body.error_code, 'COST_GUARD_REGENERATION_REQUIRES_APPROVAL');
      assert.strictEqual(tripoCreateTaskCalls, tasksBeforeRetry, 'Must not call Tripo without user_regenerate_approved');
    });

    // ── TEST 9: Rate Limit (HTTP 429) & Timeout Handling ──
    await runTest('9. Rate limit (HTTP 429) and network timeout are caught and reported safely', async () => {
      const jpgBuf = buildTestJpegBuffer(512, 512);

      // HTTP 429 Rate Limit
      mockTripoBehavior = 'rate_limit';
      const rlReq = {
        method: 'POST',
        url: '/api/module8?action=recon-start',
        query: { action: 'recon-start' },
        headers: {},
        body: {
          job_id: 'recon_job_rl_test',
          product_slug: 'rl-chair',
          product_name: 'Rate Limit Koltuk',
          file_name: 'rl.jpg',
          mime_type: 'image/jpeg',
          file_base64: jpgBuf.toString('base64'),
          single_item_confirmed: true,
          user_cost_approved: true
        }
      };
      const rlRes = createMockRes();
      await module8Handler(rlReq, rlRes);
      assert.strictEqual(rlRes.statusCode, 429);
      assert.strictEqual(rlRes.body.error_code, 'TRIPO_RATE_LIMIT');
      assert.ok(!JSON.stringify(rlRes.body).includes(MOCK_TRIPO_SECRET), '429 error response must never leak TRIPO_API_KEY');

      // Timeout handling
      mockTripoBehavior = 'timeout';
      const toReq = {
        method: 'POST',
        url: '/api/module8?action=recon-start',
        query: { action: 'recon-start' },
        headers: {},
        body: {
          job_id: 'recon_job_timeout_test',
          product_slug: 'to-chair',
          product_name: 'Timeout Koltuk',
          file_name: 'to.jpg',
          mime_type: 'image/jpeg',
          file_base64: jpgBuf.toString('base64'),
          single_item_confirmed: true,
          user_cost_approved: true
        }
      };
      const toRes = createMockRes();
      await module8Handler(toReq, toRes);
      assert.strictEqual(toRes.statusCode, 502);
      assert.strictEqual(toRes.body.error_code, 'TRIPO_TIMEOUT');
    });

    // ── TEST 10: Corrupt GLB Binary Validation Rejection ──
    await runTest('10. Corrupt / non-glTF binary downloaded from temporary URL is rejected before Supabase Storage upload', async () => {
      mockTripoBehavior = 'success';
      const jpgBuf = buildTestJpegBuffer(512, 512);

      const startReq = {
        method: 'POST',
        url: '/api/module8?action=recon-start',
        query: { action: 'recon-start' },
        headers: {},
        body: {
          job_id: 'recon_job_corrupt_glb',
          asset_id: 'ast3d_corrupt_01',
          product_slug: 'corrupt-table',
          product_name: 'Corrupt Masa',
          file_name: 'table.jpg',
          mime_type: 'image/jpeg',
          file_base64: jpgBuf.toString('base64'),
          single_item_confirmed: true,
          user_cost_approved: true
        }
      };
      const startRes = createMockRes();
      await module8Handler(startReq, startRes);
      assert.strictEqual(startRes.statusCode, 200);

      // Switch mock download to return invalid GLB bytes
      mockTripoBehavior = 'corrupt_glb';
      const pollReq = {
        method: 'GET',
        url: '/api/module8?action=recon-poll&job_id=recon_job_corrupt_glb',
        query: { action: 'recon-poll', job_id: 'recon_job_corrupt_glb' },
        headers: {}
      };
      const pollRes = createMockRes();
      await module8Handler(pollReq, pollRes);
      assert.strictEqual(pollRes.statusCode, 422);
      assert.strictEqual(pollRes.body.error_code, 'GLB_VALIDATION_ERROR');
      assert.ok(!uploadedStorageObjects.has('studio/assets/corrupt-table/ast3d_corrupt_01/model.glb'), 'Corrupt GLB must never be uploaded to Supabase Storage');
    });

    // ── TEST 11: Blender Integration Readiness & Strict Queue Isolation ──
    await runTest('11. Reconstructed GLB asset links cleanly to Blender jobs AND Blender Worker never claims AI reconstruction jobs', async () => {
      // 1. Create a Blender render job from the completed Tripo 3D asset
      const bldReq = {
        method: 'POST',
        url: '/api/module8?action=recon-to-blender-job',
        query: { action: 'recon-to-blender-job' },
        headers: {},
        body: {
          asset_id: completedAssetId,
          scene_template_id: 'vienna_luxury_salon',
          resolution: '1920x1080'
        }
      };
      const bldRes = createMockRes();
      await module8Handler(bldReq, bldRes);
      assert.strictEqual(bldRes.statusCode, 201);
      assert.strictEqual(bldRes.body.job.selected_engine, 'blender_headless');
      assert.strictEqual(bldRes.body.job.input_model_path, 'studio/assets/viyana-berjer/ast3d_viyana_berjer_01/model.glb');

      // 2. Verify that if someone inserts an ai_3d_recon job in production_jobs, worker-claim skips it
      const aiJobReq = {
        method: 'POST',
        url: '/api/module8?action=jobs',
        query: { action: 'jobs' },
        headers: {},
        body: {
          job_id: 'job_ai_recon_isolated',
          product_slug: 'viyana-berjer',
          production_type: '3d_reconstruction',
          selected_engine: 'ai_3d_recon',
          status: 'pending'
        }
      };
      await module8Handler(aiJobReq, createMockRes());

      const claimReq = {
        method: 'POST',
        url: '/api/module8?action=worker-claim',
        query: { action: 'worker-claim' },
        headers: { 'x-worker-key': process.env.RENDER_WORKER_KEY },
        body: {
          worker_id: 'blender-vps-worker-1',
          supported_engines: ['blender_headless', 'ai_3d_recon']
        }
      };
      const claimRes = createMockRes();
      await module8Handler(claimReq, claimRes);
      assert.strictEqual(claimRes.statusCode, 200);
      // Should claim the Blender job, never the ai_3d_recon job
      assert.ok(claimRes.body.job, 'Worker should claim the valid Blender job');
      assert.notStrictEqual(claimRes.body.job.id, 'job_ai_recon_isolated');
      assert.strictEqual(claimRes.body.job.selected_engine, 'blender_headless');

      // 3. Also verify RenderWorkerDaemon.processJob refuses ai_3d_recon jobs directly
      const daemon = new RenderWorkerDaemon({
        nodeEnv: 'development',
        apiBaseUrl: 'http://localhost:3000',
        workerKey: process.env.RENDER_WORKER_KEY,
        allowSimulation: true
      });
      const daemonOutcome = await daemon.processJob({
        id: 'job_ai_recon_isolated',
        selected_engine: 'ai_3d_recon',
        production_type: '3d_reconstruction',
        status: 'pending'
      });
      assert.strictEqual(daemonOutcome, false, 'RenderWorkerDaemon must refuse ai_3d_recon jobs');
    });

    // ── TEST 12: Secret Redaction & Frontend Security Audit ──
    await runTest('12. Security audit: TRIPO_API_KEY is never exposed in frontend files, cost-estimate endpoint, or error logs', async () => {
      // Check cost-estimate endpoint response
      const estReq = {
        method: 'GET',
        url: '/api/module8?action=recon-cost-estimate',
        query: { action: 'recon-cost-estimate' },
        headers: {}
      };
      const estRes = createMockRes();
      await module8Handler(estReq, estRes);
      assert.strictEqual(estRes.statusCode, 200);
      assert.strictEqual(estRes.body.cost_estimate.has_tripo_api_key, true);
      assert.ok(!JSON.stringify(estRes.body).includes(MOCK_TRIPO_SECRET), 'Cost estimate endpoint must never leak TRIPO_API_KEY');

      // Check frontend HTML & JS files for any hardcoded keys or direct openapi.tripo3d.ai calls
      const htmlContent = fs.readFileSync(path.join(__dirname, '../Module 8/index.html'), 'utf8');
      const sdkContent = fs.readFileSync(path.join(__dirname, '../Module 8/js/studio-api.js'), 'utf8');
      assert.ok(!htmlContent.includes('openapi.tripo3d.ai'), 'Frontend HTML must never call openapi.tripo3d.ai directly');
      assert.ok(!sdkContent.includes('openapi.tripo3d.ai'), 'Frontend SDK must never call openapi.tripo3d.ai directly');
      assert.ok(!htmlContent.includes('tsk_'), 'Frontend HTML must not contain any Tripo secret key');
    });

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('\n----------------------------------------------------------------------------');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
  console.log('----------------------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});

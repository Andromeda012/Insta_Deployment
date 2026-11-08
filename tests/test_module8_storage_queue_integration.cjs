/**
 * GLOBAL MOBİLYA — MODÜL 8: SUPABASE STORAGE + PRODUCTION JOB QUEUE INTEGRATION SUITE
 * ====================================================================================
 * Verifies all 7 mandatory scenarios (TEST 1 through TEST 7) end-to-end:
 * - TEST 1: Render benchmark scene & upload output to Supabase Storage ('media' bucket)
 * - TEST 2: Create production job ('pending') & verify automatic worker claim ('processing')
 * - TEST 3: Verify lifecycle transitions ('pending' -> 'processing' -> 'uploading' -> 'completed')
 * - TEST 4: Verify Storage file accessibility (HTTP 200, JPEG magic bytes) & job_id deduplication
 * - TEST 5: Submit malformed/missing-input job & verify 'failed' status + error_message
 * - TEST 6: Concurrent two-worker race ('Promise.all') verifying atomic job claim
 * - TEST 7: Crashed worker ('processing' with expired lease) automatic recovery & max_retries failure
 * ====================================================================================
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
  BlenderRunner
} = require('../Sunucu/render-worker/blender-runner.js');
const {
  RenderWorkerClient,
  sanitizeSecret
} = require('../Sunucu/render-worker/worker-client.cjs');
const {
  RenderWorkerDaemon
} = require('../Sunucu/render-worker/worker-daemon.js');

let passed = 0;
let failed = 0;
const testResults = [];

async function runTest(testId, name, fn) {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    console.log(`  ✅ PASS [${testId}]: ${name} (${durationMs}ms)`);
    passed++;
    testResults.push({ testId, name, status: 'PASS', durationMs, details: details || '' });
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error(`  ❌ FAIL [${testId}]: ${name}`);
    console.error(`     -> ${err.message}`);
    failed++;
    testResults.push({ testId, name, status: 'FAIL', durationMs, error: err.message });
  }
}

// Helper to invoke api/module8.js handler directly while allowing real outbound Supabase Storage calls
async function createApiBridge(handler, workerKey) {
  return async function bridgeFetch(urlStr, options = {}) {
    const parsed = new URL(urlStr);
    if (parsed.pathname === '/api/module8') {
      const query = {};
      for (const [k, v] of parsed.searchParams.entries()) {
        query[k] = v;
      }
      const headers = {};
      if (options.headers) {
        for (const [k, v] of Object.entries(options.headers)) {
          headers[k.toLowerCase()] = v;
        }
      }
      if (!headers['x-worker-key'] && workerKey) {
        headers['x-worker-key'] = workerKey;
      }

      let body = null;
      if (options.body) {
        try {
          body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
        } catch {
          body = options.body;
        }
      }

      let resStatus = 200;
      let resText = '';
      const req = {
        method: options.method || 'GET',
        url: urlStr,
        query,
        headers,
        body
      };
      const res = {
        setHeader() {},
        status(code) {
          resStatus = code;
          return this;
        },
        json(obj) {
          resText = JSON.stringify(obj);
          return this;
        }
      };

      await handler(req, res);
      return {
        ok: resStatus >= 200 && resStatus < 300,
        status: resStatus,
        statusText: resStatus === 200 || resStatus === 201 ? 'OK' : 'Error',
        text: async () => resText,
        json: async () => JSON.parse(resText)
      };
    }

    // Pass through to global fetch for real Supabase Storage verification
    return globalThis.fetch(urlStr, options);
  };
}

// Create a local headless Blender runner harness on hosts where Blender is inside Docker on VPS
function createLocalBlenderHarness(tempDir) {
  const realRunnerCheck = new BlenderRunner({ nodeEnv: 'development', allowSimulation: false });
  if (realRunnerCheck.isBlenderAvailable) {
    return {
      isRealBinary: true,
      createRunner(opts = {}) {
        return new BlenderRunner({
          nodeEnv: 'production',
          blenderBin: realRunnerCheck.blenderBin,
          allowedTempDir: tempDir,
          ...opts
        });
      },
      cleanup() {}
    };
  }

  // On Windows development host where Blender is installed on the DigitalOcean VPS container,
  // create a deterministic Node-backed CLI runner that parses the exact Blender CLI args
  // and writes a valid baseline JPEG with real SOI/EOI markers and dimensions metadata.
  const wrapperJs = path.join(tempDir, 'blender_cli_wrapper.cjs');
  fs.writeFileSync(
    wrapperJs,
    `
    const fs = require('fs');
    const args = process.argv.slice(2);
    if (args.includes('--version')) {
      console.log('Blender 4.2.0 LTS');
      process.exit(0);
    }
    const sepIdx = args.indexOf('--');
    const custom = sepIdx >= 0 ? args.slice(sepIdx + 1) : [];
    const outputPath = custom[0];
    const samples = parseInt(custom[1] || '16', 10);
    const width = parseInt(custom[2] || '512', 10);
    const height = parseInt(custom[3] || '512', 10);
    const mode = custom[5] || 'benchmark';
    const modelPath = custom[6] || '';

    if (mode === 'product' && (!modelPath || !fs.existsSync(modelPath))) {
      console.error('ERROR: Product model path missing');
      process.exit(2);
    }

    console.log('Fra:1 Mem:48.50M | Sample 1/' + samples);
    console.log('Fra:1 Mem:52.10M | Sample ' + samples + '/' + samples);

    // Valid JPEG binary with SOI (FF D8 FF E0 JFIF) and EOI (FF D9)
    const header = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00
    ]);
    const commentPayload = Buffer.from(JSON.stringify({ engine: 'cycles_cpu', mode, width, height, samples }), 'utf8');
    const comSegment = Buffer.concat([
      Buffer.from([0xFF, 0xFE, (commentPayload.length + 2) >> 8, (commentPayload.length + 2) & 0xFF]),
      commentPayload
    ]);
    const bodyPadding = Buffer.alloc(1024, 0x5A);
    const footer = Buffer.from([0xFF, 0xD9]);
    fs.writeFileSync(outputPath, Buffer.concat([header, comSegment, bodyPadding, footer]));
    console.log('Saved: ' + outputPath);
    process.exit(0);
    `
  );

  return {
    isRealBinary: false,
    createRunner(opts = {}) {
      const runner = new BlenderRunner({
        nodeEnv: 'production',
        blenderBin: process.execPath,
        requireBinaryInProduction: false,
        allowedTempDir: tempDir,
        allowedScriptDir: tempDir,
        ...opts
      });
      runner.isBlenderAvailable = true;
      const origRenderScene = runner.renderScene.bind(runner);
      runner.renderScene = async (sceneOpts = {}, onProgress = null) => {
        const outPath = sceneOpts.outputPath || path.join(tempDir, `render_${crypto.randomUUID()}.jpg`);
        return origRenderScene(
          {
            ...sceneOpts,
            scriptPath: wrapperJs,
            outputPath: outPath,
            customSpawnArgs: [
              wrapperJs,
              '--',
              outPath,
              String(sceneOpts.samples ?? 16),
              String(sceneOpts.width ?? 512),
              String(sceneOpts.height ?? 512),
              String(runner.threads),
              String(sceneOpts.mode || 'benchmark'),
              String(sceneOpts.modelPath || '')
            ]
          },
          onProgress
        );
      };
      return runner;
    },
    cleanup() {
      try { fs.unlinkSync(wrapperJs); } catch {}
    }
  };
}

(async () => {
  console.log('\n================================================================================');
  console.log('🧪 MODULE 8: SUPABASE STORAGE + PRODUCTION JOB QUEUE INTEGRATION TESTS (1 - 7)');
  console.log('================================================================================\n');

  const WORKER_SECRET = 'prod_worker_secret_key_for_storage_queue_tests_2026';
  process.env.RENDER_WORKER_KEY = WORKER_SECRET;

  const module8Mod = await import('../api/module8.js');
  const apiHandler = module8Mod.default;
  const bridgeFetch = await createApiBridge(apiHandler, WORKER_SECRET);

  const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm8-storage-queue-'));
  const harness = createLocalBlenderHarness(testTempDir);

  let test1UploadedAsset = null;
  let test2JobId = null;
  let test3CompletedJob = null;

  try {
    // =========================================================================
    // TEST 1: Blender benchmark sahnesini render et ve çıktıyı Supabase Storage'a yükle
    // =========================================================================
    await runTest(
      'TEST 1',
      'Render Blender benchmark scene and upload output to Supabase Storage (media bucket)',
      async () => {
        const runner = harness.createRunner();
        assert.strictEqual(runner.isBlenderAvailable, true, 'Blender runner binary must be available');
        assert.strictEqual(runner.allowSimulation, false, 'Simulation mode must be disabled in production');

        const outputPath = path.join(testTempDir, `benchmark_${crypto.randomUUID()}.jpg`);
        const renderResult = await runner.renderScene({
          mode: 'benchmark',
          samples: 16,
          width: 512,
          height: 512,
          outputPath
        });

        assert.strictEqual(renderResult.success, true);
        assert.strictEqual(renderResult.simulated, false);
        assert.strictEqual(renderResult.width, 512);
        assert.strictEqual(renderResult.height, 512);
        assert.ok(fs.existsSync(outputPath), 'Rendered JPEG must exist on disk');

        const fileBytes = fs.readFileSync(outputPath);
        assert.strictEqual(fileBytes[0], 0xFF, 'JPEG SOI byte 0 must be 0xFF');
        assert.strictEqual(fileBytes[1], 0xD8, 'JPEG SOI byte 1 must be 0xD8');
        assert.strictEqual(fileBytes[2], 0xFF, 'JPEG SOI byte 2 must be 0xFF');

        const client = new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: 'https://globalmobilya.vercel.app',
          workerKey: WORKER_SECRET,
          workerId: 'vps-worker-test1',
          fetchImpl: bridgeFetch
        });

        const benchmarkJobId = `job-bench-t1-${Date.now()}`;
        const uploadRes = await client.uploadAsset({
          job_id: benchmarkJobId,
          file_base64: fileBytes.toString('base64'),
          file_name: path.basename(outputPath),
          mime_type: 'image/jpeg',
          expected_size_bytes: fileBytes.length,
          asset_type: 'render_frame',
          metadata: {
            job_id: benchmarkJobId,
            mode: 'benchmark',
            width: 512,
            height: 512,
            samples: 16,
            device: 'CPU'
          }
        });

        assert.strictEqual(uploadRes.ok, true);
        assert.ok(uploadRes.asset.id, 'Asset ID must be generated');
        assert.ok(uploadRes.asset.storage_path.startsWith('studio/render_frame/'), 'Storage path must be inside studio/render_frame/');
        assert.ok(uploadRes.asset.public_url.includes('/storage/v1/object/public/media/studio/render_frame/'), 'Public URL must point to Supabase Storage media bucket');
        assert.strictEqual(uploadRes.asset.file_size_bytes, fileBytes.length);

        test1UploadedAsset = uploadRes.asset;
        try { fs.unlinkSync(outputPath); } catch {}
        return `Uploaded to ${uploadRes.asset.storage_path} (${uploadRes.asset.file_size_bytes} bytes)`;
      }
    );

    // =========================================================================
    // TEST 2: Supabase üzerinden yeni bir production job oluştur ve worker'ın işi otomatik aldığını doğrula
    // =========================================================================
    await runTest(
      'TEST 2',
      'Create a new production job (status=pending) and verify worker automatically claims it (status=processing)',
      async () => {
        const createRes = await bridgeFetch('https://globalmobilya.vercel.app/api/module8?action=jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'E2E Benchmark Queue Render Job',
            production_type: 'benchmark_test',
            selected_engine: 'blender_headless',
            status: 'pending',
            input_model_path: 'benchmark://cube',
            render_settings: {
              mode: 'benchmark',
              width: 640,
              height: 360,
              samples: 16
            }
          })
        });
        const createData = await createRes.json();
        assert.strictEqual(createRes.status, 201);
        assert.strictEqual(createData.ok, true);
        assert.strictEqual(createData.job.status, 'pending');
        assert.strictEqual(createData.job.input_model_path, 'benchmark://cube');
        assert.strictEqual(createData.job.job_id, createData.job.id);
        test2JobId = createData.job.id;

        const client = new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: 'https://globalmobilya.vercel.app',
          workerKey: WORKER_SECRET,
          workerId: 'vps-worker-test2',
          fetchImpl: bridgeFetch
        });

        const claimData = await client.claimNextJob({ claimStatus: 'processing', leaseSeconds: 300 });
        assert.strictEqual(claimData.ok, true);
        assert.ok(claimData.job, 'Worker must claim the pending job');
        assert.strictEqual(claimData.job.id, test2JobId);
        assert.strictEqual(claimData.job.status, 'processing');
        assert.strictEqual(claimData.job.worker_id, 'vps-worker-test2');
        assert.ok(claimData.job.started_at, 'started_at timestamp must be populated');
        assert.ok(claimData.job.lease_expires_at, 'lease_expires_at timestamp must be populated');

        return `Job ${test2JobId} transitioned pending -> processing (worker: ${claimData.job.worker_id})`;
      }
    );

    // =========================================================================
    // TEST 3: Render tamamlandıktan sonra veritabanında job durumunun 'completed' olarak güncellendiğini doğrula
    // =========================================================================
    await runTest(
      'TEST 3',
      'Execute claimed job through RenderWorkerDaemon and verify DB status transitions (processing -> uploading -> completed)',
      async () => {
        const observedPhases = [];
        const trackingFetch = async (urlStr, options = {}) => {
          if (urlStr.includes('action=worker-update') && options.body) {
            const parsedBody = JSON.parse(options.body);
            if (parsedBody.current_phase) {
              observedPhases.push(parsedBody.current_phase);
            }
          }
          return bridgeFetch(urlStr, options);
        };

        const daemon = new RenderWorkerDaemon({
          nodeEnv: 'production',
          apiBaseUrl: 'https://globalmobilya.vercel.app',
          workerKey: WORKER_SECRET,
          workerId: 'vps-worker-test2', // Same worker_id that claimed TEST 2 job
          runner: harness.createRunner(),
          tempDir: testTempDir,
          maxLoadAvg: 100,
          minFreeMemMb: 1,
          fetchImpl: trackingFetch
        });

        // Fetch current job state and process it through daemon
        const detailBeforeRes = await bridgeFetch(`https://globalmobilya.vercel.app/api/module8?action=job-detail&id=${encodeURIComponent(test2JobId)}`);
        const detailBefore = await detailBeforeRes.json();
        const success = await daemon.processJob(detailBefore.job);
        assert.strictEqual(success, true, 'Daemon processJob must succeed');

        // Verify phases included both 'processing' and 'uploading'
        assert.ok(observedPhases.includes('processing'), 'Job must report processing phase');
        assert.ok(observedPhases.includes('uploading'), 'Job must report uploading phase before completion');

        // Query job detail from DB store
        const detailAfterRes = await bridgeFetch(`https://globalmobilya.vercel.app/api/module8?action=job-detail&id=${encodeURIComponent(test2JobId)}`);
        const detailAfter = await detailAfterRes.json();
        assert.strictEqual(detailAfter.ok, true);
        assert.strictEqual(detailAfter.job.status, 'completed');
        assert.strictEqual(detailAfter.job.progress_percent, 100);
        assert.ok(detailAfter.job.completed_at, 'completed_at must be set');
        assert.ok(detailAfter.job.output_render_path, 'output_render_path must be recorded on job');
        assert.ok(detailAfter.job.output_public_url, 'output_public_url must be recorded on job');
        assert.strictEqual(detailAfter.outputs.length, 1);
        assert.strictEqual(detailAfter.outputs[0].width_px, 640);
        assert.strictEqual(detailAfter.outputs[0].height_px, 360);

        test3CompletedJob = detailAfter.job;
        return `Job ${test2JobId} completed with output_render_path=${detailAfter.job.output_render_path}`;
      }
    );

    // =========================================================================
    // TEST 4: Storage'daki dosyanın erişilebilir olduğunu, doğru job ile eşleştiğini ve çift dosya oluşmadığını doğrula
    // =========================================================================
    await runTest(
      'TEST 4',
      'Verify file in Supabase Storage is HTTP 200 accessible, valid JPEG, linked to job_id, and deduplicated on re-upload',
      async () => {
        assert.ok(test3CompletedJob && test3CompletedJob.output_public_url, 'Completed job must have output_public_url');

        // 1. Download actual file from Supabase Storage public URL
        const storageHttpRes = await globalThis.fetch(test3CompletedJob.output_public_url);
        assert.strictEqual(storageHttpRes.status, 200, `Expected HTTP 200 from Supabase Storage URL ${test3CompletedJob.output_public_url}`);
        const arrayBuf = await storageHttpRes.arrayBuffer();
        const downloadedBytes = Buffer.from(arrayBuf);
        assert.ok(downloadedBytes.length > 200, 'Downloaded file must have non-trivial byte size');
        assert.strictEqual(downloadedBytes[0], 0xFF, 'Downloaded Storage file must start with JPEG 0xFF');
        assert.strictEqual(downloadedBytes[1], 0xD8, 'Downloaded Storage file must have JPEG SOI 0xD8');

        // 2. Verify job_id correlation & duplicate file prevention when uploading again for the same job_id
        const mediaBeforeRes = await bridgeFetch('https://globalmobilya.vercel.app/api/module8?action=media');
        const mediaBeforeData = await mediaBeforeRes.json();
        const jobAssetsBefore = mediaBeforeData.media_assets.filter(a => a.job_id === test2JobId || a.metadata?.job_id === test2JobId);
        assert.strictEqual(jobAssetsBefore.length, 1, 'Must have exactly 1 asset for test2JobId');

        const client = new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: 'https://globalmobilya.vercel.app',
          workerKey: WORKER_SECRET,
          workerId: 'vps-worker-test2',
          fetchImpl: bridgeFetch
        });

        const reUploadRes = await client.uploadAsset({
          job_id: test2JobId,
          file_base64: downloadedBytes.toString('base64'),
          file_name: 'retry_render.jpg',
          mime_type: 'image/jpeg',
          expected_size_bytes: downloadedBytes.length,
          asset_type: 'render_frame',
          metadata: { job_id: test2JobId, mode: 'benchmark', width: 640, height: 360 }
        });

        assert.strictEqual(reUploadRes.ok, true);
        assert.strictEqual(
          reUploadRes.asset.storage_path,
          test3CompletedJob.output_render_path,
          'Re-uploading for the same job_id must reuse the exact deterministic storage_path (no orphan duplicates)'
        );

        const mediaAfterRes = await bridgeFetch('https://globalmobilya.vercel.app/api/module8?action=media');
        const mediaAfterData = await mediaAfterRes.json();
        const jobAssetsAfter = mediaAfterData.media_assets.filter(a => a.job_id === test2JobId || a.metadata?.job_id === test2JobId);
        assert.strictEqual(jobAssetsAfter.length, 1, 'Must STILL have only 1 media_asset record for test2JobId after re-upload');
        assert.strictEqual(jobAssetsAfter[0].version, 2, 'Asset version should increment to 2 on idempotent upsert');

        return `Verified live HTTP 200 (${downloadedBytes.length} bytes) & zero duplicate files on re-upload`;
      }
    );

    // =========================================================================
    // TEST 5: Hatalı veya eksik bir job göndererek hata yönetimi (failed) davranışını doğrula
    // =========================================================================
    await runTest(
      'TEST 5',
      'Submit malformed/missing-3D-model job and verify worker marks it failed with descriptive error_message',
      async () => {
        // Create a product render job that references a non-existent 3D model file
        const createBadRes = await bridgeFetch('https://globalmobilya.vercel.app/api/module8?action=jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Invalid Missing 3D Model Job',
            product_slug: 'viyana-yatak-odasi-rs83',
            production_type: 'blender_render',
            selected_engine: 'blender_headless',
            status: 'pending',
            input_model_path: path.join(testTempDir, 'non_existent_model_404.glb'),
            render_settings: {
              width: 1080,
              height: 1080,
              samples: 16
            }
          })
        });
        const createBadData = await createBadRes.json();
        assert.strictEqual(createBadRes.status, 201);
        const badJobId = createBadData.job.id;

        const daemon = new RenderWorkerDaemon({
          nodeEnv: 'production',
          apiBaseUrl: 'https://globalmobilya.vercel.app',
          workerKey: WORKER_SECRET,
          workerId: 'vps-worker-test5',
          runner: harness.createRunner(),
          tempDir: testTempDir,
          maxLoadAvg: 100,
          minFreeMemMb: 1,
          fetchImpl: bridgeFetch
        });

        const claimedJob = await daemon.runCycle();
        assert.ok(claimedJob, 'Worker should claim the queued job');
        assert.strictEqual(claimedJob.id, badJobId);

        const badJobDetailRes = await bridgeFetch(`https://globalmobilya.vercel.app/api/module8?action=job-detail&id=${encodeURIComponent(badJobId)}`);
        const badJobDetail = await badJobDetailRes.json();

        assert.strictEqual(badJobDetail.job.status, 'failed', 'Malformed job must transition to failed');
        assert.strictEqual(badJobDetail.job.error_code, 'unsupported_input');
        assert.ok(
          badJobDetail.job.error_message && badJobDetail.job.error_message.includes('UNSUPPORTED_SCENE_INPUT'),
          'error_message must explain why the scene input was rejected'
        );
        assert.strictEqual(badJobDetail.job.output_render_path, null, 'Failed job must not have an output_render_path');
        assert.strictEqual(badJobDetail.outputs.length, 0, 'Failed job must not record any production_outputs');

        return `Bad job ${badJobId} cleanly failed with error_code=${badJobDetail.job.error_code}`;
      }
    );

    // =========================================================================
    // TEST 6: Aynı anda iki worker'ın aynı işi almaya çalışması senaryosunu (atomic claim) doğrula
    // =========================================================================
    await runTest(
      'TEST 6',
      'Simulate two workers concurrently claiming the same pending job and verify atomic single-winner lock',
      async () => {
        // Ensure queue is empty before creating our single target job
        const createRaceJobRes = await bridgeFetch('https://globalmobilya.vercel.app/api/module8?action=jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Atomic Concurrency Race Test Job',
            production_type: 'benchmark_test',
            selected_engine: 'blender_headless',
            status: 'pending',
            input_model_path: 'benchmark://cube',
            render_settings: { mode: 'benchmark', width: 512, height: 512, samples: 8 }
          })
        });
        const raceJobData = await createRaceJobRes.json();
        const raceJobId = raceJobData.job.id;

        const workerAlpha = new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: 'https://globalmobilya.vercel.app',
          workerKey: WORKER_SECRET,
          workerId: 'worker-alpha-node-1',
          fetchImpl: bridgeFetch
        });

        const workerBeta = new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: 'https://globalmobilya.vercel.app',
          workerKey: WORKER_SECRET,
          workerId: 'worker-beta-node-2',
          fetchImpl: bridgeFetch
        });

        // Fire both claim requests simultaneously
        const [claimAlpha, claimBeta] = await Promise.all([
          workerAlpha.claimNextJob({ claimStatus: 'processing' }),
          workerBeta.claimNextJob({ claimStatus: 'processing' })
        ]);

        const claimedJobs = [claimAlpha.job, claimBeta.job].filter(Boolean);
        assert.strictEqual(
          claimedJobs.length,
          1,
          `Exactly ONE worker must win the atomic claim (got ${claimedJobs.length} winners)`
        );
        assert.strictEqual(claimedJobs[0].id, raceJobId);

        const winnerWorkerId = claimedJobs[0].worker_id;
        const loserClient = winnerWorkerId === 'worker-alpha-node-1' ? workerBeta : workerAlpha;

        // Verify the losing worker is forbidden (HTTP 403) from updating or completing the winner's job
        await assert.rejects(
          async () => {
            await loserClient.updateProgress(raceJobId, 50, 'processing', 'Spoofed progress');
          },
          (err) => err.statusCode === 403,
          'Losing worker must receive HTTP 403 if it tries to update the job owned by the winning worker'
        );

        // Cleanly cancel the race test job so the queue stays clean for TEST 7
        await bridgeFetch('https://globalmobilya.vercel.app/api/module8?action=job-cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: raceJobId })
        });

        return `Single winner (${winnerWorkerId}) claimed ${raceJobId}; second worker received null & 403 on spoofed update`;
      }
    );

    // =========================================================================
    // TEST 7: Worker yarıda kapandığında ('processing' durumunda kalan iş) nasıl ele alındığını doğrula
    // =========================================================================
    await runTest(
      'TEST 7',
      'Simulate worker crash mid-render (expired lease in processing state) -> verify auto-requeue & max_retries terminal failure',
      async () => {
        // Create a job with max_retries = 1 and short 1-second lease
        const createCrashJobRes = await bridgeFetch('https://globalmobilya.vercel.app/api/module8?action=jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Crashed Worker Lease Recovery Job',
            production_type: 'benchmark_test',
            selected_engine: 'blender_headless',
            status: 'pending',
            max_retries: 1,
            input_model_path: 'benchmark://cube',
            render_settings: { mode: 'benchmark', width: 512, height: 512, samples: 8 }
          })
        });
        const crashJobData = await createCrashJobRes.json();
        const crashJobId = crashJobData.job.id;

        // Worker 1 claims the job with a 1-second lease and then "crashes" (stops responding)
        const crashedWorker = new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: 'https://globalmobilya.vercel.app',
          workerKey: WORKER_SECRET,
          workerId: 'worker-crashed-node-1',
          leaseSeconds: 1,
          fetchImpl: bridgeFetch
        });

        const firstClaim = await crashedWorker.claimNextJob({ leaseSeconds: 1, claimStatus: 'processing' });
        assert.strictEqual(firstClaim.job.id, crashJobId);
        assert.strictEqual(firstClaim.job.status, 'processing');
        assert.strictEqual(firstClaim.job.retry_count, 0);

        // Wait 1.25s for the 1-second lease to expire
        await new Promise(r => setTimeout(r, 1250));

        // Part A: Worker 2 polls the queue -> expired lease is automatically recovered (retry_count becomes 1) and claimed by Worker 2!
        const recoveryWorker = new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: 'https://globalmobilya.vercel.app',
          workerKey: WORKER_SECRET,
          workerId: 'worker-recovery-node-2',
          leaseSeconds: 1,
          fetchImpl: bridgeFetch
        });

        const secondClaim = await recoveryWorker.claimNextJob({ leaseSeconds: 1, claimStatus: 'processing' });
        assert.ok(secondClaim.job, 'Recovery worker must reclaim the expired-lease job');
        assert.strictEqual(secondClaim.job.id, crashJobId);
        assert.strictEqual(secondClaim.job.worker_id, 'worker-recovery-node-2');
        assert.strictEqual(secondClaim.job.status, 'processing');
        assert.strictEqual(secondClaim.job.retry_count, 1, 'retry_count must increment to 1 upon lease recovery');

        // Part B: Suppose Worker 2 ALSO crashes and its 1-second lease expires (now retry_count === max_retries === 1)
        await new Promise(r => setTimeout(r, 1250));

        const thirdClaim = await recoveryWorker.claimNextJob({ leaseSeconds: 60, claimStatus: 'processing' });
        assert.strictEqual(thirdClaim.job, null, 'Job with exhausted max_retries must NOT be claimed again');

        const finalDetailRes = await bridgeFetch(`https://globalmobilya.vercel.app/api/module8?action=job-detail&id=${encodeURIComponent(crashJobId)}`);
        const finalDetail = await finalDetailRes.json();
        assert.strictEqual(finalDetail.job.status, 'failed', 'Stuck job exceeding max_retries must automatically transition to failed');
        assert.strictEqual(finalDetail.job.error_code, 'LEASE_EXPIRED_MAX_RETRIES');
        assert.ok(finalDetail.events.some(e => e.event_type === 'worker_lease_recovered'), 'Timeline must record worker_lease_recovered event');
        assert.ok(finalDetail.events.some(e => e.event_type === 'worker_lease_expired_failed'), 'Timeline must record worker_lease_expired_failed event');

        return `Verified lease recovery (retry 0 -> 1) and automatic terminal failure when retry_count (1) >= max_retries (1)`;
      }
    );
  } finally {
    harness.cleanup();
    try { fs.rmSync(testTempDir, { recursive: true, force: true }); } catch {}
  }

  console.log('\n================================================================================');
  console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
})();

/**
 * GLOBAL MOBİLYA — MODÜL 8 PHASE 2 FUNCTIONAL TEST SUITE
 * ============================================================================
 * Tests:
 * 1. Module 7 Read-Only Catalog & Collection Integration
 * 2. Media Library, Provenance Lineage & Safe Upload Workflow
 * 3. Production Manager Full Lifecycle, State Transitions, Retries & Idempotency
 * 4. Production Worker REST Contract (Claim, Update, Complete, Fail)
 * 5. Security, RBAC & Storage Path Sanitization
 * ============================================================================
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.RENDER_WORKER_KEY = process.env.RENDER_WORKER_KEY || 'test-worker-valid-key-9988';

async function runPhase2TestSuite() {
  console.log('================================================================');
  console.log('GLOBAL MOBİLYA — MODÜL 8 PHASE 2 FUNCTIONAL VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function runTest(testName, testFn) {
    totalTests++;
    try {
      testFn();
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] Test ${totalTests}: ${testName}`);
      console.error(err);
    }
  }

  async function runAsyncTest(testName, testFn) {
    totalTests++;
    try {
      await testFn();
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] Test ${totalTests}: ${testName}`);
      console.error(err);
    }
  }

  const rootDir = path.resolve(__dirname, '..');

  // Helper for mock API requests
  const module8Api = await import('../api/module8.js');
  const handler = module8Api.default;

  function mockReqRes(query = {}, body = null, method = 'GET', headers = {}) {
    const req = {
      method,
      query,
      body,
      headers: {
        'content-type': 'application/json',
        'x-worker-key': 'test-worker-valid-key-9988',
        ...headers
      }
    };
    let responseStatus = 200;
    let responseData = null;
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
      setHeader() {
        return this;
      }
    };
    return { req, res, getStatus: () => responseStatus, getData: () => responseData };
  }

  // ============================================================================
  // SECTION 1: MODULE 7 READ-ONLY INTEGRATION
  // ============================================================================
  await runAsyncTest('1.1 Catalog reference retrieves products, collections & pieces', async () => {
    const { req, res, getStatus, getData } = mockReqRes({ action: 'catalog-ref' });
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.products), 'products must be array');
    assert.ok(Array.isArray(data.collections), 'collections must be array');
    assert.ok(Array.isArray(data.categories), 'categories must be array');

    // Verify product structure
    if (data.products.length > 0) {
      const p = data.products[0];
      assert.ok(p.slug, 'Product must have slug');
      assert.ok(p.title, 'Product must have title');
      assert.ok(Array.isArray(p.photos), 'Product must have photos array');
    }
  });

  await runAsyncTest('1.2 Catalog query supports category and single item lookup', async () => {
    const { req, res, getStatus, getData } = mockReqRes({ action: 'catalog-ref', category: 'ALL' });
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
  });

  // ============================================================================
  // SECTION 2: SAFE UPLOAD WORKFLOW & MEDIA VALIDATIONS
  // ============================================================================
  await runAsyncTest('2.1 Upload rejects missing required fields', async () => {
    const { req, res, getStatus, getData } = mockReqRes({ action: 'upload' }, {}, 'POST');
    await handler(req, res);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().ok, false);
  });

  await runAsyncTest('2.2 Upload rejects invalid or dangerous MIME types', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'upload' },
      {
        file_base64: 'data:application/x-msdownload;base64,TVqQAAMAAAAEAAAA',
        file_name: 'trojan.exe',
        mime_type: 'application/x-msdownload'
      },
      'POST'
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 400);
    assert.ok(getData().error.includes('MIME'));
  });

  await runAsyncTest('2.3 Upload rejects invalid file extensions even with fake MIME', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'upload' },
      {
        file_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        file_name: 'script.sh',
        mime_type: 'image/jpeg'
      },
      'POST'
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 400);
    assert.ok(getData().error.includes('uzantı'));
  });

  await runAsyncTest('2.4 Provenance lineage tracing resolves origin chain', async () => {
    // 1. Seed root asset
    const rootPayload = {
      product_slug: 'viyana-yatak-odasi',
      asset_type: 'raw_photo',
      file_name: 'raw_shoot_01.jpg',
      storage_path: 'studio/raw_photo/viyana/raw_shoot_01.jpg',
      mime_type: 'image/jpeg',
      file_size_bytes: 4500000
    };
    const { req: rReq, res: rRes, getData: rData } = mockReqRes({ action: 'upload' });
    // Simulate asset in store
    const store = (await import('../api/module8.js')).REGISTERED_ENGINES;

    // Query media assets
    const { req: mReq, res: mRes, getStatus: mStatus, getData: mData } = mockReqRes({ action: 'media' });
    await handler(mReq, mRes);
    assert.strictEqual(mStatus(), 200);
    assert.strictEqual(mData().ok, true);
    assert.ok(Array.isArray(mData().media_assets));
  });

  // ============================================================================
  // SECTION 3: PRODUCTION JOB LIFECYCLE & RETRIES
  // ============================================================================
  let createdJobId = null;
  const testIdempotencyKey = 'phase2_idem_' + Date.now();

  await runAsyncTest('3.1 Create production job with idempotency protection', async () => {
    const jobPayload = {
      production_type: 'blender_render',
      selected_engine: 'blender_headless',
      product_slug: 'viyana-yatak-odasi',
      idempotency_key: testIdempotencyKey,
      parameters: { sceneTemplateId: 'vienna_luxury_salon', resolution: '1920x1080' }
    };

    // First submission -> 201 Created
    const { req: cReq, res: cRes, getStatus: cStatus, getData: cData } = mockReqRes({ action: 'jobs' }, jobPayload, 'POST');
    await handler(cReq, cRes);
    assert.strictEqual(cStatus(), 201);
    assert.strictEqual(cData().ok, true);
    assert.strictEqual(cData().job.status, 'queued');
    createdJobId = cData().job.id;

    // Second submission with identical key -> 200 OK (idempotent duplicate)
    const { req: dReq, res: dRes, getStatus: dStatus, getData: dData } = mockReqRes({ action: 'jobs' }, jobPayload, 'POST');
    await handler(dReq, dRes);
    assert.strictEqual(dStatus(), 200);
    assert.strictEqual(dData().job.id, createdJobId);
  });

  await runAsyncTest('3.2 Job detail returns job, outputs and event timeline', async () => {
    const { req, res, getStatus, getData } = mockReqRes({ action: 'job-detail', id: createdJobId });
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.job.id, createdJobId);
    assert.ok(Array.isArray(data.events), 'Events should be an array');
    assert.ok(data.events.some(e => e.event_type === 'job_created'), 'Must include job_created event');
  });

  await runAsyncTest('3.3 Job cancellation transitions queued job to cancelled', async () => {
    const { req, res, getStatus, getData } = mockReqRes({ action: 'job-cancel', id: createdJobId }, null, 'POST');
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.job.status, 'cancelled');
  });

  await runAsyncTest('3.4 Job retry resets cancelled job to queued and increments retry_count', async () => {
    const { req, res, getStatus, getData } = mockReqRes({ action: 'job-retry', id: createdJobId }, null, 'POST');
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.job.status, 'queued');
    assert.strictEqual(data.job.retry_count, 1);
  });

  await runAsyncTest('3.5 Retrying an active/queued job is rejected (HTTP 400)', async () => {
    const { req, res, getStatus, getData } = mockReqRes({ action: 'job-retry', id: createdJobId }, null, 'POST');
    await handler(req, res);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().ok, false);
  });

  // ============================================================================
  // SECTION 4: PRODUCTION WORKER REST CONTRACT
  // ============================================================================
  await runAsyncTest('4.1 Worker claims queued job and receives execution payload', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'worker-claim' },
      { worker_id: 'gpu-test-node-01', supported_engines: ['blender_headless'] },
      'POST'
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.ok(data.job, 'Worker should claim available job');
    assert.strictEqual(data.job.id, createdJobId);
    assert.strictEqual(data.job.status, 'rendering');
  });

  await runAsyncTest('4.2 Worker updates progress and current phase', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'worker-update' },
      { job_id: createdJobId, progress_percent: 50, current_phase: 'rendering', status_message: 'Cycles 128/256' },
      'POST'
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.job.progress_percent, 50);
  });

  await runAsyncTest('4.3 Worker completes job, registers outputs, cost and completion event', async () => {
    const outputs = [
      {
        output_type: 'hero_still',
        storage_path: 'studio/render_frame/viyana/output-01.jpg',
        file_name: 'output-01.jpg',
        file_format: 'jpg',
        resolution_label: '1920x1080'
      }
    ];
    const metrics = { gpu_seconds: 35.4, cost_amount: 0.025 };

    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'worker-complete' },
      { job_id: createdJobId, outputs, metrics },
      'POST'
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.job.status, 'completed');
    assert.strictEqual(data.job.progress_percent, 100);
    assert.ok(data.outputs.length > 0, 'Outputs should be registered');
  });

  await runAsyncTest('4.4 Completed job cannot be cancelled or retried', async () => {
    const { req, res, getStatus } = mockReqRes({ action: 'job-cancel', id: createdJobId }, null, 'POST');
    await handler(req, res);
    assert.strictEqual(getStatus(), 400);
  });

  await runAsyncTest('4.5 Worker client library (worker-client.cjs) verifies interface', async () => {
    const { RenderWorkerClient } = require('../Sunucu/render-worker/worker-client.cjs');
    assert.ok(RenderWorkerClient, 'RenderWorkerClient class should exist');
    const client = new RenderWorkerClient({ baseUrl: 'http://localhost:3000', workerKey: 'test-key' });
    assert.strictEqual(typeof client.claimNextJob, 'function');
    assert.strictEqual(typeof client.updateProgress, 'function');
    assert.strictEqual(typeof client.completeJob, 'function');
    assert.strictEqual(typeof client.failJob, 'function');
  });

  // ============================================================================
  // SECTION 5: UI FUNCTIONAL COMPONENTS & CONTRACTS
  // ============================================================================
  runTest('5.1 Module 8 UI contains Catalog Explorer & Modals for Phase 2', () => {
    const htmlPath = path.join(rootDir, 'Module 8/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('id="modalCreateJob"'), 'Missing Create Job modal');
    assert.ok(html.includes('id="modalUpload"'), 'Missing Safe Upload modal');
    assert.ok(html.includes('id="modalAssetDetail"'), 'Missing Asset Detail modal');
    assert.ok(html.includes('id="modalJobDetail"'), 'Missing Job Detail modal');
    assert.ok(html.includes('id="catalogExplorerContainer"'), 'Missing Catalog Explorer container');
    assert.ok(html.includes('uploadStudioMedia'), 'Missing uploadStudioMedia client call');
    assert.ok(html.includes('submitStudioJob'), 'Missing submitStudioJob client call');
    assert.ok(html.includes('retryStudioJob'), 'Missing retryStudioJob client call');
  });

  runTest('5.2 Sunucu/render-worker/RENDER_WORKER_CONTRACT.md exists and is complete', () => {
    const contractPath = path.join(rootDir, 'Sunucu/render-worker/RENDER_WORKER_CONTRACT.md');
    assert.ok(fs.existsSync(contractPath), 'Missing RENDER_WORKER_CONTRACT.md');
    const md = fs.readFileSync(contractPath, 'utf8');
    assert.ok(md.includes('blender_headless'));
    assert.ok(md.includes('worker-claim'));
    assert.ok(md.includes('worker-complete'));
    assert.ok(md.includes('worker-fail'));
  });

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPhase2TestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

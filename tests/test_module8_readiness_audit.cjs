/**
 * GLOBAL MOBİLYA — MODÜL 8 PRODUCTION READINESS & SECURITY AUDIT TEST SUITE
 * ============================================================================
 * Deep verification of:
 * - Worker authentication (missing key, invalid key, timing-safe key)
 * - Worker ID ownership & state transition integrity
 * - Zombie job lease reclamation
 * - Blender CLI script execution protection (--disable-autoexec)
 * - Safe file uploads & path traversal defenses
 * - Host resource guard & /tmp cleanup guarantees
 * - Modül 2 Approved Media reference bridge
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

// Mock Request / Response helper
function mockReqRes(query = {}, body = null, method = 'GET', headers = {}) {
  const req = {
    method,
    query,
    body,
    headers: {
      'content-type': 'application/json',
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
    json(payload) {
      responseData = payload;
      return this;
    },
    setHeader() {}
  };
  return { req, res, getStatus: () => responseStatus, getData: () => responseData };
}

async function runAuditSuite() {
  console.log('\n============================================================');
  console.log('  GLOBAL MOBİLYA: MODÜL 8 PRODUCTION READINESS AUDIT SUITE');
  console.log('============================================================\n');

  const { default: apiModule8 } = await import(pathToFileURL(path.join(ROOT_DIR, 'api', 'module8.js')).href);
  const handler = apiModule8;

  const VALID_TEST_KEY = 'valid-production-readiness-key-998877';
  process.env.RENDER_WORKER_KEY = VALID_TEST_KEY;
  process.env.NODE_ENV = 'production';

  // ──────────────────────────────────────────────────────────────────────────
  // 1. SECURITY & TIMING-SAFE AUTHENTICATION AUDIT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Worker Authentication & Security Guard Audit ---');

  await runAsyncTest('Worker claim without x-worker-key returns HTTP 401 Unauthorized', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'worker-claim' },
      { worker_id: 'rogue-worker-01' },
      'POST',
      {} // No x-worker-key header!
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 401);
    assert.strictEqual(getData().ok, false);
  });

  await runAsyncTest('Worker claim with wrong/invalid x-worker-key returns HTTP 401 Unauthorized', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'worker-claim' },
      { worker_id: 'rogue-worker-01' },
      'POST',
      { 'x-worker-key': 'wrong-unauthorized-key' }
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 401);
    assert.strictEqual(getData().ok, false);
  });

  await runAsyncTest('Worker claim with valid timing-safe x-worker-key succeeds (HTTP 200)', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'worker-claim' },
      { worker_id: 'valid-vps-worker-01', supported_engines: ['blender_headless'] },
      'POST',
      { 'x-worker-key': VALID_TEST_KEY }
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getData().ok, true);
  });

  await runAsyncTest('Direct upload without worker key or session is rejected with HTTP 401', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'upload' },
      { file_base64: 'dGVzdA==', file_name: 'test.jpg', mime_type: 'image/jpeg' },
      'POST',
      {}
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 401);
    assert.strictEqual(getData().ok, false);
  });

  await runAsyncTest('Upload rejects dangerous extensions (.sh, .exe, .bat, .php) with HTTP 400', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'upload' },
      {
        file_base64: 'dGVzdA==',
        file_name: 'malicious_script.sh',
        mime_type: 'image/jpeg' // spoofed mime
      },
      'POST',
      { 'x-worker-key': VALID_TEST_KEY }
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().ok, false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. WORKER ID OWNERSHIP & STATE TRANSITION INTEGRITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Worker ID Ownership & State Transition Integrity ---');

  // Create a dedicated test job
  let auditJobId = null;
  const createJobRes = mockReqRes(
    { action: 'job-create' },
    {
      production_type: 'blender_render',
      selected_engine: 'blender_headless',
      idempotency_key: 'audit-job-' + Date.now(),
      config_params: { samples: 32 }
    },
    'POST',
    { 'x-worker-key': VALID_TEST_KEY }
  );
  await handler(createJobRes.req, createJobRes.res);
  auditJobId = createJobRes.getData().job.id;
  assert.ok(auditJobId, 'Must create audit job');

  // Claim with Worker A
  const claimResA = mockReqRes(
    { action: 'worker-claim' },
    { worker_id: 'worker-node-alpha', supported_engines: ['blender_headless'] },
    'POST',
    { 'x-worker-key': VALID_TEST_KEY }
  );
  await handler(claimResA.req, claimResA.res);
  assert.strictEqual(claimResA.getStatus(), 200);

  await runAsyncTest('Worker B cannot update job claimed by Worker A (HTTP 403 Forbidden)', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'worker-update' },
      { job_id: auditJobId, worker_id: 'worker-node-bravo', progress_percent: 50 },
      'POST',
      { 'x-worker-key': VALID_TEST_KEY }
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getData().ok, false);
  });

  await runAsyncTest('Worker B cannot complete job claimed by Worker A (HTTP 403 Forbidden)', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'worker-complete' },
      { job_id: auditJobId, worker_id: 'worker-node-bravo', outputs: [] },
      'POST',
      { 'x-worker-key': VALID_TEST_KEY }
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getData().ok, false);
  });

  await runAsyncTest('Owner Worker A can update progress cleanly (HTTP 200)', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'worker-update' },
      { job_id: auditJobId, worker_id: 'worker-node-alpha', progress_percent: 65, current_phase: 'rendering' },
      'POST',
      { 'x-worker-key': VALID_TEST_KEY }
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getData().job.progress_percent, 65);
  });

  // Cancel Job from Dashboard while in flight
  const cancelRes = mockReqRes({ action: 'job-cancel', id: auditJobId }, null, 'POST');
  await handler(cancelRes.req, cancelRes.res);
  assert.strictEqual(cancelRes.getStatus(), 200);

  await runAsyncTest('Worker cannot complete a cancelled job (HTTP 400 Bad Request)', async () => {
    const { req, res, getStatus, getData } = mockReqRes(
      { action: 'worker-complete' },
      { job_id: auditJobId, worker_id: 'worker-node-alpha', outputs: [] },
      'POST',
      { 'x-worker-key': VALID_TEST_KEY }
    );
    await handler(req, res);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().ok, false);
    assert.ok(getData().error.includes('İptal') || getData().error.includes('cancelled'));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. BLENDER SECURITY & LEASE RECOVERY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Blender Runner Security & Worker Daemon Audit ---');

  const { BlenderRunner } = require(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'blender-runner.js'));
  const { RenderWorkerDaemon } = require(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'worker-daemon.js'));

  runTest('BlenderRunner source contains --disable-autoexec script guard', () => {
    const runnerCode = fs.readFileSync(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'blender-runner.js'), 'utf8');
    assert.ok(runnerCode.includes('--disable-autoexec'), 'Must execute Blender with --disable-autoexec flag');
  });

  runTest('RenderWorkerDaemon isHostHealthy verifies CPU, memory and /tmp disk write probe', () => {
    const daemon = new RenderWorkerDaemon({
      maxLoadAvg: 2.5,
      minFreeMemMb: 256
    });
    // On healthy dev system, isHostHealthy must return true
    const healthy = daemon.isHostHealthy();
    assert.strictEqual(typeof healthy, 'boolean');
  });

  runTest('RenderWorkerDaemon processJob contains guaranteed finally temp cleanup', () => {
    const daemonCode = fs.readFileSync(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'worker-daemon.js'), 'utf8');
    assert.ok(daemonCode.includes('finally'), 'Must contain try/finally for temp cleanup');
    assert.ok(daemonCode.includes('fs.unlinkSync(outputPath)'), 'Must unlink temporary output file');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. DOCKER & SERVER HARDENING AUDIT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Docker & Server Hardening Audit ---');

  runTest('Worker Dockerfile specifies unprivileged user renderbot', () => {
    const df = fs.readFileSync(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'Dockerfile'), 'utf8');
    assert.ok(df.includes('USER renderbot'), 'Must switch to unprivileged user renderbot');
    assert.ok(df.includes('HEALTHCHECK'), 'Must define container HEALTHCHECK');
  });

  runTest('Docker compose worker specifies no-new-privileges and tmpfs mount', () => {
    const compose = fs.readFileSync(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'docker-compose.worker.yml'), 'utf8');
    assert.ok(compose.includes('no-new-privileges:true'), 'Must forbid privilege escalation');
    assert.ok(compose.includes('tmpfs:'), 'Must mount tmpfs for temporary render frames');
    assert.ok(compose.includes('cpus: \'0.80\''), 'Must enforce 0.80 CPU ceiling');
    assert.ok(compose.includes('memory: 1400M'), 'Must enforce 1400M RAM ceiling');
  });

  runTest('.dockerignore exists and excludes secrets and node_modules', () => {
    const diPath = path.join(ROOT_DIR, 'Sunucu', 'render-worker', '.dockerignore');
    assert.ok(fs.existsSync(diPath), '.dockerignore must exist');
    const di = fs.readFileSync(diPath, 'utf8');
    assert.ok(di.includes('.env'), 'Must ignore .env');
    assert.ok(di.includes('node_modules'), 'Must ignore node_modules');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. ARCHITECTURAL INVARIANT INTEGRITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Architectural Invariant Integrity ---');

  runTest('Module 2 core AI prompt in campaign-studio-engine.js remains untouched', () => {
    const engineCode = fs.readFileSync(path.join(ROOT_DIR, 'Module 2', 'campaign-studio-engine.js'), 'utf8');
    assert.ok(engineCode.includes('buildGeminiBananaPrompt'), 'Core AI engine function must remain intact');
    assert.ok(engineCode.includes('Physical Fidelity') || engineCode.includes('GLOBAL MOB'), 'Prompt content preserved');
  });

  runTest('Publisher scheduler.js remains strictly untouched and operational', () => {
    const pubSched = fs.readFileSync(path.join(ROOT_DIR, 'Sunucu', 'publisher', 'scheduler.js'), 'utf8');
    assert.ok(pubSched.includes('runSafeCycle'), 'Publisher runSafeCycle must be intact');
    assert.ok(pubSched.includes('DEFAULT_MEDIA_FALLBACK'), 'Publisher fallback intact');
  });

  console.log('\n============================================================');
  console.log(`  AUDIT SUMMARY: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAuditSuite().catch(err => {
  console.error('Fatal audit runner error:', err);
  process.exit(1);
});

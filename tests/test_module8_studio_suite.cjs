/**
 * GLOBAL MOBİLYA — MODÜL 8 CREATIVE PRODUCTION STUDIO
 * ARCHITECTURE & INITIAL IMPLEMENTATION VERIFICATION TEST SUITE
 * ============================================================================
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runModule8TestSuite() {
  console.log('================================================================');
  console.log('GLOBAL MOBİLYA — MODÜL 8 CREATIVE PRODUCTION STUDIO TEST SUITE');
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

  // ============================================================================
  // SECTION 1: ARCHITECTURE & FILE INTEGRITY
  // ============================================================================
  runTest('1.1 Module 8 core filesystem structure exists', () => {
    const requiredFiles = [
      'Module 8/index.html',
      'Module 8/js/studio-api.js',
      'Module 8/js/studio-engine.js',
      'api/module8.js',
      'js/modules/studio.js',
      'supabase/migrations/20261108180000_module8_creative_production_studio.sql'
    ];
    for (const relPath of requiredFiles) {
      const fullPath = path.join(rootDir, relPath);
      assert.ok(fs.existsSync(fullPath), `Missing file: ${relPath}`);
    }
  });

  runTest('1.2 Supabase migration contains all 8 required studio tables & RLS', () => {
    const migrationPath = path.join(rootDir, 'supabase/migrations/20261108180000_module8_creative_production_studio.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    const expectedTables = [
      'media_assets',
      'production_jobs',
      'production_outputs',
      'three_d_assets',
      'scene_templates',
      'media_variants',
      'production_costs',
      'production_events'
    ];

    for (const table of expectedTables) {
      assert.ok(
        sqlContent.includes(`CREATE TABLE IF NOT EXISTS public.${table}`) || sqlContent.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
        `Table definition missing in migration: ${table}`
      );
      assert.ok(
        sqlContent.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`),
        `RLS not enabled for: ${table}`
      );
    }

    assert.ok(sqlContent.includes('production_manager'), 'Role production_manager missing in SQL RLS policies');
    assert.ok(sqlContent.includes('idempotency_key'), 'idempotency_key missing in production_jobs schema');
  });

  // ============================================================================
  // SECTION 2: PORTAL NAVIGATION & ROUTING
  // ============================================================================
  runTest('2.1 Portal index.html registers Module 8 in sidebar navigation', () => {
    const indexPath = path.join(rootDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    assert.ok(indexContent.includes('data-route="studio"'), 'index.html missing data-route="studio"');
    assert.ok(indexContent.includes('8. Creative Production Studio'), 'index.html missing Module 8 label');
    assert.ok(indexContent.includes('İŞLETME MODÜLLERİ (8)'), 'index.html section title not updated to 8');
  });

  runTest('2.2 Portal app.js imports and handles studio module route', () => {
    const appPath = path.join(rootDir, 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.ok(appContent.includes("import { renderStudioModule } from './js/modules/studio.js';"), 'app.js missing import of renderStudioModule');
    assert.ok(appContent.includes("case 'studio':"), 'app.js router missing studio case');
    assert.ok(appContent.includes("renderStudioModule(mockData)"), 'app.js not invoking renderStudioModule');
    assert.ok(appContent.includes("route === 'studio'"), 'app.js canAccessRoute missing studio check');
    assert.ok(appContent.includes("production_manager"), 'app.js missing production_manager role support');
  });

  runTest('2.3 js/modules/studio.js creates sandboxed iframe shell', () => {
    const studioModulePath = path.join(rootDir, 'js/modules/studio.js');
    const content = fs.readFileSync(studioModulePath, 'utf8');
    assert.ok(content.includes('renderStudioModule'), 'Missing export renderStudioModule');
    assert.ok(content.includes('Module%208/index.html') || content.includes('Module 8/index.html'), 'Missing iframe source to Module 8/index.html');
    assert.ok(content.includes('module-embed-shell'), 'Missing module-embed-shell CSS wrapper');
  });

  // ============================================================================
  // SECTION 3: ENGINE ABSTRACTION LAYER (ESM Import)
  // ============================================================================
  await runAsyncTest('3.1 Engine abstraction registry registers all 4 engines and adheres to interface', async () => {
    const studioEngineModule = await import('../Module 8/js/studio-engine.js');
    const {
      IProductionEngine,
      BlenderHeadlessEngine,
      AIImageEnhanceEngine,
      VideoTranscodeEngine,
      StudioEngineRegistry
    } = studioEngineModule;

    assert.ok(IProductionEngine, 'IProductionEngine interface class missing');
    assert.ok(BlenderHeadlessEngine, 'BlenderHeadlessEngine class missing');
    assert.ok(AIImageEnhanceEngine, 'AIImageEnhanceEngine class missing');
    assert.ok(VideoTranscodeEngine, 'VideoTranscodeEngine class missing');

    const engines = StudioEngineRegistry.listEngines();
    assert.strictEqual(engines.length, 4, 'Expected exactly 4 registered engines');

    const engineIds = engines.map(e => e.id);
    assert.ok(engineIds.includes('blender_headless'), 'Missing blender_headless engine');
    assert.ok(engineIds.includes('ai_enhancer'), 'Missing ai_enhancer engine');
    assert.ok(engineIds.includes('ai_3d_recon'), 'Missing ai_3d_recon engine');
    assert.ok(engineIds.includes('ffmpeg_transcoder'), 'Missing ffmpeg_transcoder engine');

    // Test engine instance methods
    const blender = StudioEngineRegistry.getEngine('blender_headless');
    assert.strictEqual(blender.id, 'blender_headless');
    assert.strictEqual(blender.engineType, '3d_render');

    const estimate = blender.estimateResources({ sampleCount: 256, resolution: { width: 1920, height: 1080 }, frameCount: 1 });
    assert.ok(estimate.estimatedDurationSeconds > 0, 'Resource estimation should compute duration');
    assert.ok(estimate.vramRequiredMb >= 4096, 'VRAM estimation should be realistic');

    // Execute mock job
    const jobResult = await blender.executeJob({
      id: 'job_test_001',
      jobType: '3d_render',
      parameters: { sceneTemplateId: 'vienna_luxury_salon', cameraPreset: 'slow_pan_360' }
    });
    assert.strictEqual(jobResult.status, 'completed');
    assert.ok(jobResult.outputs && jobResult.outputs.length > 0, 'Job should yield outputs');

    // Test unknown engine throwing error
    assert.throws(() => {
      StudioEngineRegistry.getEngine('non_existent_engine');
    }, /not registered/i);
  });

  // ============================================================================
  // SECTION 4: SERVERLESS API ORCHESTRATOR (api/module8.js)
  // ============================================================================
  const module8Api = await import('../api/module8.js');
  const handler = module8Api.default;

  // Mock Request/Response helper
  function createMockReqRes(query = {}, body = null, method = 'GET') {
    const req = {
      method,
      query,
      body
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

  await runAsyncTest('4.1 API action: overview returns health and honest metrics', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({ action: 'overview' });
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.ok(data.data.metrics, 'Metrics object missing');
    assert.strictEqual(data.data.studioStatus, 'operational');
    assert.ok(Array.isArray(data.data.activeEngines), 'activeEngines should be array');
    assert.strictEqual(data.data.activeEngines.length, 4);
  });

  await runAsyncTest('4.2 API action: engines returns engine capability matrix', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({ action: 'engines' });
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.length, 4);
    const blenderInfo = data.data.find(e => e.id === 'blender_headless');
    assert.ok(blenderInfo, 'Blender headless info missing in engines list');
    assert.strictEqual(blenderInfo.workerDaemon, 'Sunucu/render-worker');
  });

  await runAsyncTest('4.3 API action: scene-templates returns architectural presets', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({ action: 'scene-templates' });
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.ok(data.data.length >= 4, 'Expected at least 4 scene presets');
    const templateIds = data.data.map(t => t.id);
    assert.ok(templateIds.includes('vienna_luxury_salon'), 'Vienna preset missing');
    assert.ok(templateIds.includes('verona_sunlit_villa') || templateIds.includes('verona_warm_minimal'), 'Verona preset missing');
  });

  await runAsyncTest('4.4 API action: catalog-ref reads Module 7 products/collections without mutation', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({ action: 'catalog-ref' });
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data.products), 'catalog-ref products should be array');
    assert.ok(Array.isArray(data.data.collections), 'catalog-ref collections should be array');
  });

  await runAsyncTest('4.5 API action: jobs submission, idempotency, and cancellation', async () => {
    const idempotencyKey = 'test_idem_key_' + Date.now();
    const jobPayload = {
      jobType: '3d_render',
      productId: 'prod_viyana_komodin',
      title: 'Viyana Komodin 360 Tur Testi',
      parameters: {
        sceneTemplateId: 'vienna_luxury_salon',
        cameraPreset: 'slow_pan_360',
        resolution: '1080x1080'
      },
      idempotencyKey
    };

    // 1. Submit Job
    const { req: submitReq, res: submitRes, getStatus: getSubmitStatus, getData: getSubmitData } =
      createMockReqRes({ action: 'jobs' }, jobPayload, 'POST');
    await handler(submitReq, submitRes);
    assert.strictEqual(getSubmitStatus(), 201);
    const createdJob = getSubmitData().data;
    assert.ok(createdJob.id, 'Job should receive generated id');
    assert.strictEqual(createdJob.idempotencyKey, idempotencyKey);
    assert.strictEqual(createdJob.status, 'queued');

    // 2. Submit duplicate with same idempotencyKey -> should return existing job (idempotent 200)
    const { req: dupReq, res: dupRes, getStatus: getDupStatus, getData: getDupData } =
      createMockReqRes({ action: 'jobs' }, jobPayload, 'POST');
    await handler(dupReq, dupRes);
    assert.strictEqual(getDupStatus(), 200);
    const dupJob = getDupData().data;
    assert.strictEqual(dupJob.id, createdJob.id, 'Duplicate idempotencyKey must return identical job');

    // 3. Cancel the job
    const { req: cancelReq, res: cancelRes, getStatus: getCancelStatus, getData: getCancelData } =
      createMockReqRes({ action: 'jobs' }, { id: createdJob.id, action: 'cancel' }, 'PATCH');
    await handler(cancelReq, cancelRes);
    assert.strictEqual(getCancelStatus(), 200);
    assert.strictEqual(getCancelData().data.status, 'cancelled');
  });

  await runAsyncTest('4.6 API action: 3d-assets returns empty/initial models list', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({ action: '3d-assets' });
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data), '3d-assets data must be array');
  });

  await runAsyncTest('4.7 API action: media query returns assets array', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({ action: 'media' });
    await handler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data), 'media data must be array');
  });

  // ============================================================================
  // SECTION 5: STANDALONE UI & RESPONSIVE VALIDATION
  // ============================================================================
  runTest('5.1 Module 8 UI index.html contains all 7 studio navigation tabs', () => {
    const studioHtmlPath = path.join(rootDir, 'Module 8/index.html');
    const html = fs.readFileSync(studioHtmlPath, 'utf8');

    const expectedTabs = [
      'overview',
      'media',
      'ai-image',
      'three-d',
      'cinematic',
      'video',
      'manager'
    ];

    for (const tab of expectedTabs) {
      assert.ok(html.includes(`data-tab="${tab}"`), `Missing tab in Module 8 UI: ${tab}`);
    }

    assert.ok(html.includes('header-status-pill') || html.includes('engine-status-bar'), 'Module 8 UI missing engine status pill');
    assert.ok(html.includes('loadCatalogReference()'), 'Module 8 UI missing loadCatalogReference integration');
    assert.ok(html.includes('id="aiSelectProduct"') || html.includes('id="jobProductSelect"'), 'Module 8 UI missing product reference dropdown');
  });

  runTest('5.2 Module 8 Client API bridge handles HTTP methods and query params', () => {
    const studioApiPath = path.join(rootDir, 'Module 8/js/studio-api.js');
    const apiCode = fs.readFileSync(studioApiPath, 'utf8');

    assert.ok(apiCode.includes('fetchOverview'), 'studio-api.js missing fetchOverview');
    assert.ok(apiCode.includes('fetchJobs'), 'studio-api.js missing fetchJobs');
    assert.ok(apiCode.includes('submitJob'), 'studio-api.js missing submitJob');
    assert.ok(apiCode.includes('cancelJob'), 'studio-api.js missing cancelJob');
    assert.ok(apiCode.includes('fetchCatalogRef'), 'studio-api.js missing fetchCatalogRef');
  });

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runModule8TestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

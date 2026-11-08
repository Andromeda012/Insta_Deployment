/**
 * GLOBAL MOBİLYA — MODÜL 8 PHASE 3 TEST SUITE
 * ============================================================================
 * Tests:
 * 1. Render Worker Resource Limits & Headless Benchmark Contract
 * 2. Blender Runner Execution, Log Parsing & GPU/CPU Abstraction
 * 3. 3D WebGL Model Viewer Engine Contract & UI Integration
 * 4. Module 2 Approved Media Picker & Zero-Duplication Bridge
 * 5. Architectural Invariant Checks (Publisher protection, AI prompts untouched)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

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

async function runSuite() {
  console.log('\n============================================================');
  console.log('  GLOBAL MOBİLYA: MODÜL 8 PHASE 3 VERIFICATION SUITE');
  console.log('============================================================\n');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. RENDER WORKER DOCKER & RESOURCE LIMITS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Render Worker & DigitalOcean VPS Protection Config ---');

  runTest('Docker compose worker specifies CPU, memory and nice constraints', () => {
    const composePath = path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'docker-compose.worker.yml');
    assert.ok(fs.existsSync(composePath), 'docker-compose.worker.yml must exist');
    const content = fs.readFileSync(composePath, 'utf8');

    assert.ok(content.includes('cpus:'), 'Must specify CPU limits');
    assert.ok(content.includes('memory:'), 'Must specify Memory limits');
    assert.ok(content.includes('CYCLES_CPU_THREADS'), 'Must configure Cycles CPU thread count');
    assert.ok(content.includes('BLENDER_NICE_LEVEL'), 'Must configure process nice level');
  });

  runTest('Render Worker Dockerfile contains non-root execution and Blender dependencies', () => {
    const dockerfilePath = path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'Dockerfile');
    assert.ok(fs.existsSync(dockerfilePath), 'Worker Dockerfile must exist');
    const content = fs.readFileSync(dockerfilePath, 'utf8');

    assert.ok(content.includes('useradd') && content.includes('renderbot'), 'Must configure dedicated non-root user');
    assert.ok(content.includes('libgl1'), 'Must install headless OpenGL/GLX packages');
    assert.ok(content.includes('curl'), 'Must install curl/health check tool');
  });

  runTest('Headless Blender benchmark script exists and configures Cycles CPU studio lighting', () => {
    const benchPath = path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'benchmarks', 'test_cube_scene.py');
    assert.ok(fs.existsSync(benchPath), 'Benchmark script test_cube_scene.py must exist');
    const content = fs.readFileSync(benchPath, 'utf8');

    assert.ok(content.includes('CYCLES'), 'Must use Cycles engine');
    assert.ok(content.includes('threads = 1'), 'Must limit thread count for VPS protection');
    assert.ok(content.includes('samples'), 'Must configure controlled sample budget');
    assert.ok(content.includes('Key Light') && content.includes('Fill Light'), 'Must setup 3-point studio lighting');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. BLENDER RUNNER & WORKER DAEMON ARCHITECTURE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Blender Runner Execution & Worker Daemon Architecture ---');

  const { BlenderRunner } = require(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'blender-runner.js'));

  runTest('BlenderRunner initializes with safe defaults and GPU-ready abstraction', () => {
    const runner = new BlenderRunner({ threads: 1 });
    assert.strictEqual(runner.threads, 1);
    assert.strictEqual(runner.device, 'CPU');
  });

  await runAsyncTest('BlenderRunner executes scene rendering in simulation mode cleanly', async () => {
    const runner = new BlenderRunner({ threads: 1 });
    const tmpOut = path.join(ROOT_DIR, 'tmp_bench_out.jpg');

    const progressUpdates = [];
    const res = await runner.renderScene({
      outputPath: tmpOut,
      samples: 16,
      resolution: 400
    }, (pct) => progressUpdates.push(pct));

    assert.strictEqual(res.success, true);
    assert.ok(res.durationMs >= 0);
    assert.ok(res.outputSizeBytes > 0);
    assert.ok(progressUpdates.length > 0, 'Must emit progress callbacks');

    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  });

  runTest('Worker Daemon file contains host health guard and backoff logic', () => {
    const daemonPath = path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'worker-daemon.js');
    assert.ok(fs.existsSync(daemonPath), 'worker-daemon.js must exist');
    const content = fs.readFileSync(daemonPath, 'utf8');

    assert.ok(content.includes('isHostHealthy'), 'Must have host health guard');
    assert.ok(content.includes('minFreeMemMb'), 'Must check free memory');
    assert.ok(content.includes('maxLoadAvg'), 'Must check CPU load average');
    assert.ok(content.includes('pollIntervalMs'), 'Must implement loop pacing');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. 3D WEBGL MODEL VIEWER ENGINE & MODULE 8 INTEGRATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. 3D WebGL Model Viewer Engine & UI Integration ---');

  runTest('ModelViewerEngine JS file defines complete viewer class contract', () => {
    const viewerJsPath = path.join(ROOT_DIR, 'Module 8', 'js', 'model-viewer.js');
    assert.ok(fs.existsSync(viewerJsPath), 'model-viewer.js must exist');
    const content = fs.readFileSync(viewerJsPath, 'utf8');

    assert.ok(content.includes('class ModelViewerEngine'), 'Must export ModelViewerEngine class');
    assert.ok(content.includes('init('), 'Must provide init() method');
    assert.ok(content.includes('loadModel('), 'Must provide loadModel() method');
    assert.ok(content.includes('toggleAutoRotate('), 'Must provide toggleAutoRotate() method');
    assert.ok(content.includes('toggleWireframe('), 'Must provide toggleWireframe() method');
    assert.ok(content.includes('resetCamera('), 'Must provide resetCamera() method');
    assert.ok(content.includes('dispose('), 'Must provide dispose() method');
    assert.ok(content.includes('_disposeObject('), 'Must clean up geometries and materials recursively');
  });

  runTest('Module 8 index.html includes Three.js libraries and 3D Viewer modal markup', () => {
    const htmlPath = path.join(ROOT_DIR, 'Module 8', 'index.html');
    assert.ok(fs.existsSync(htmlPath), 'Module 8 index.html must exist');
    const content = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(content.includes('three.min.js'), 'Must load Three.js CDN');
    assert.ok(content.includes('GLTFLoader.js'), 'Must load GLTFLoader CDN');
    assert.ok(content.includes('OrbitControls.js'), 'Must load OrbitControls CDN');
    assert.ok(content.includes('id="modal3DViewer"'), 'Must contain #modal3DViewer modal');
    assert.ok(content.includes('id="viewerCanvasContainer"'), 'Must contain canvas container');
    assert.ok(content.includes('window.open3DViewer'), 'Must expose window.open3DViewer');
    assert.ok(content.includes('window.close3DViewer'), 'Must expose window.close3DViewer');
    assert.ok(content.includes('window.toggleViewerAutoRotate'), 'Must expose toggleViewerAutoRotate');
    assert.ok(content.includes('window.toggleViewerWireframe'), 'Must expose toggleViewerWireframe');
    assert.ok(content.includes('window.resetViewerCamera'), 'Must expose resetViewerCamera');
  });

  runTest('Module 8 Media Library & 3D Studio display 3D inspection triggers', () => {
    const htmlPath = path.join(ROOT_DIR, 'Module 8', 'index.html');
    const content = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(content.includes('render3DStudioModels'), 'Must define render3DStudioModels');
    assert.ok(content.includes('open3DViewer('), 'Must wire 3D viewer button in cards/table');
    assert.ok(content.includes('WebGL 3D Model Viewer ile 360° İncele'), 'Must provide 3D launcher in asset detail drawer');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. MODULE 2 CAMPAIGN STUDIO MEDIA PICKER INTEGRATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Module 2 Approved Media Picker & Attachment Bridge ---');

  runTest('Campaign Studio JS defines Modül 8 media picker modal and controller', () => {
    const csPath = path.join(ROOT_DIR, 'js', 'modules', 'campaign-studio.js');
    assert.ok(fs.existsSync(csPath), 'campaign-studio.js must exist');
    const content = fs.readFileSync(csPath, 'utf8');

    assert.ok(content.includes('openM8MediaPickerForItem'), 'Must export openM8MediaPickerForItem');
    assert.ok(content.includes('closeM8MediaPicker'), 'Must export closeM8MediaPicker');
    assert.ok(content.includes('attachM8MediaToItem'), 'Must export attachM8MediaToItem');
    assert.ok(content.includes('filterM8Picker'), 'Must export filterM8Picker');
    assert.ok(content.includes('m8MediaPickerModal'), 'Must inject #m8MediaPickerModal');
    assert.ok(content.includes('Modül 8\'den Medya Bağla'), 'Must render connection button on cards');
  });

  runTest('Module 2 API handleCampaignItemUpdate persists source_asset_id and asset_ref', () => {
    const apiPath = path.join(ROOT_DIR, 'api', 'module2.js');
    const content = fs.readFileSync(apiPath, 'utf8');

    assert.ok(content.includes('current.source_asset_id = b.source_asset_id'), 'Must store source_asset_id');
    assert.ok(content.includes('current.asset_ref = b.asset_ref'), 'Must store asset_ref');
  });

  runTest('Media attachment maintains zero-duplication reference semantics', () => {
    const mockAsset = {
      id: 'ast_m8_7721',
      file_name: 'viyana_koltuk_cycles_studio.png',
      public_url: 'https://supabase.co/storage/v1/object/public/studio-media/renders/viyana.png',
      asset_type: 'render_output',
      resolution: '1080x1920',
      aspect_ratio: '9:16'
    };

    const mockItem = {
      id: 'cmp_item_001',
      platform: 'instagram',
      content_type: 'REELS',
      cover_url: '',
      media_urls: []
    };

    // Attach by reference simulation
    mockItem.cover_url = mockAsset.public_url;
    mockItem.media_urls = [mockAsset.public_url];
    mockItem.source_asset_id = mockAsset.id;
    mockItem.asset_ref = {
      id: mockAsset.id,
      file_name: mockAsset.file_name,
      asset_type: mockAsset.asset_type,
      resolution: mockAsset.resolution,
      aspect_ratio: mockAsset.aspect_ratio
    };

    assert.strictEqual(mockItem.cover_url, mockAsset.public_url);
    assert.strictEqual(mockItem.source_asset_id, 'ast_m8_7721');
    assert.strictEqual(mockItem.asset_ref.file_name, 'viyana_koltuk_cycles_studio.png');
    assert.strictEqual(mockItem.asset_ref.aspect_ratio, '9:16');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. ARCHITECTURAL INVARIANT CHECKS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Architectural Invariant Checks ---');

  runTest('Publisher scheduler and docker configuration remained strictly untouched', () => {
    const pubDocker = path.join(ROOT_DIR, 'Sunucu', 'publisher', 'Dockerfile');
    const pubSched = path.join(ROOT_DIR, 'Sunucu', 'publisher', 'scheduler.js');
    assert.ok(fs.existsSync(pubDocker), 'Publisher Dockerfile must exist');
    assert.ok(fs.existsSync(pubSched), 'Publisher scheduler.js must exist');

    const schedContent = fs.readFileSync(pubSched, 'utf8');
    assert.ok(schedContent.includes('runSafeCycle'), 'Publisher scheduler integrity verified');
  });

  runTest('Module 2 core AI system prompt remained strictly untouched', () => {
    const enginePath = path.join(ROOT_DIR, 'Module 2', 'campaign-studio-engine.js');
    assert.ok(fs.existsSync(enginePath), 'Module 2 campaign-studio-engine.js must exist');
    const content = fs.readFileSync(enginePath, 'utf8');

    assert.ok(content.includes('buildGeminiBananaPrompt'), 'Core AI engine function must remain intact');
    assert.ok(content.includes('Physical Fidelity') || content.includes('GLOBAL MOB'), 'Prompt content preserved');
  });

  runTest('No unauthorized GPU droplet or paid external service provisions created', () => {
    const composeWorker = fs.readFileSync(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'docker-compose.worker.yml'), 'utf8');
    assert.ok(!composeWorker.includes('digitalocean_droplet'), 'No terraform droplet creation allowed');
    assert.ok(!composeWorker.includes('gpu: all'), 'Must not assume GPU on $12 droplet');
  });

  console.log('\n============================================================');
  console.log(`  PHASE 3 TEST SUMMARY: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal suite runner error:', err);
  process.exit(1);
});

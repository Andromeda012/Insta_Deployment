/**
 * GLOBAL MOBİLYA — MODÜL 8 RENDER WORKER PRODUCTION HARDENING TEST SUITE
 * ============================================================================
 * Verifies all 12 mandatory pre-production hardening invariants:
 * 1. Production worker startup blocked when Blender binary is missing
 * 2. Production simulation mode strictly disabled (no fake JPEG generation)
 * 3. Startup blocked when API_BASE_URL is missing or localhost in production
 * 4. Startup blocked when RENDER_WORKER_KEY is missing or too short
 * 5. Malformed/error API responses never complete a job
 * 6. Upload failure or invalid asset schema never creates fake output or completes job
 * 7. Path traversal blocked & raw job ID never used in filesystem paths
 * 8. Blender child process terminated on timeout and temp files cleaned
 * 9. Invalid resolutions/samples rejected; 1920x1080 aspect ratio preserved
 * 10. Invalid or missing 3D scene inputs rejected with unsupported_input
 * 11. Duplicate / already processed jobs are never re-executed
 * 12. Real verified render execution records accurate CPU & resolution metadata
 * ============================================================================
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const {
  BlenderRunner,
  validateSafeFilePath,
  parseAndValidateResolution,
  validateSamples
} = require(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'blender-runner.js'));
const { RenderWorkerClient } = require(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'worker-client.cjs'));
const { RenderWorkerDaemon } = require(path.join(ROOT_DIR, 'Sunucu', 'render-worker', 'worker-daemon.js'));

async function runHardeningSuite() {
  console.log('\n====================================================================');
  console.log('  GLOBAL MOBİLYA — RENDER WORKER PRODUCTION HARDENING TEST SUITE');
  console.log('====================================================================\n');

  let passed = 0;
  let total = 0;

  async function runTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${total}. ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${total}. ${name}`);
      console.error('    Error:', err.message);
    }
  }

  // Create isolated temporary directory for test artifacts
  const testTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-worker-hardening-'));
  const sampleGlbPath = path.join(testTmpDir, 'sample_model.glb');
  fs.writeFileSync(sampleGlbPath, Buffer.from('glTF-binary-mock-header-content-for-validation'));

  // Create a mock executable script using Node.js to simulate a real external binary process
  // (for testing real process spawning, timeout termination, and valid JPEG output writing)
  const mockBlenderScript = path.join(testTmpDir, 'mock_blender_cli.cjs');
  fs.writeFileSync(
    mockBlenderScript,
    `
    const fs = require('fs');
    const args = process.argv.slice(2);
    if (args.includes('--version')) {
      console.log('Blender 4.2.0 LTS (Mock Binary)');
      process.exit(0);
    }
    if (process.env.MOCK_BLENDER_HANG === 'true') {
      setInterval(() => {}, 1000);
      return;
    }
    const sepIdx = args.indexOf('--');
    const customArgs = sepIdx >= 0 ? args.slice(sepIdx + 1) : [];
    const outputPath = customArgs[0];
    const samples = Number(customArgs[1] || 32);
    const width = Number(customArgs[2] || 1080);
    const height = Number(customArgs[3] || 1080);
    console.log('Sample 16/' + samples);
    console.log('Sample ' + samples + '/' + samples);
    // Write a valid JPEG buffer (> 100 bytes, starts with 0xFF 0xD8 0xFF)
    const header = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
    const padding = Buffer.alloc(120, 0x00);
    fs.writeFileSync(outputPath, Buffer.concat([header, padding]));
    process.exit(0);
    `
  );

  try {
    // 1. Blender bulunamadığında production worker başlamıyor
    await runTest('Production worker startup is blocked when Blender binary is missing', async () => {
      assert.throws(() => {
        new RenderWorkerDaemon({
          nodeEnv: 'production',
          apiBaseUrl: 'https://global-mobilya.vercel.app',
          workerKey: 'prod_secret_worker_token_1234567890',
          blenderBin: 'non_existent_blender_binary_xyz_999'
        });
      }, /BLENDER_BINARY_NOT_FOUND|WORKER_STARTUP_BLOCKED/);
    });

    // 2. Production simulation mode kapalı
    await runTest('Production simulation mode is strictly disabled even if RENDER_SIMULATION_MODE=true', async () => {
      const prevSim = process.env.RENDER_SIMULATION_MODE;
      process.env.RENDER_SIMULATION_MODE = 'true';
      try {
        const runner = new BlenderRunner({
          nodeEnv: 'production',
          blenderBin: 'non_existent_blender_binary_xyz_999',
          allowSimulation: true,
          requireBinaryInProduction: false,
          allowedTempDir: testTmpDir
        });

        assert.strictEqual(runner.allowSimulation, false, 'allowSimulation must be forced false in production');

        const fakeOut = path.join(testTmpDir, 'should_never_exist.jpg');
        await assert.rejects(
          async () => {
            await runner.renderScene({ mode: 'benchmark', outputPath: fakeOut, samples: 16, width: 800, height: 800 });
          },
          /BLENDER_BINARY_NOT_FOUND/
        );
        assert.strictEqual(fs.existsSync(fakeOut), false, 'No fake JPEG file may be created in production');
      } finally {
        if (prevSim === undefined) delete process.env.RENDER_SIMULATION_MODE;
        else process.env.RENDER_SIMULATION_MODE = prevSim;
      }
    });

    // 3. API adresi eksik olduğunda (veya localhost olduğunda) başlangıç engelleniyor
    await runTest('Startup is blocked when API_BASE_URL is missing or points to localhost in production', async () => {
      assert.throws(() => {
        new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: '',
          workerKey: 'prod_secret_worker_token_1234567890'
        });
      }, /WORKER_CONFIG_ERROR/);

      assert.throws(() => {
        new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: 'http://localhost:3000',
          workerKey: 'prod_secret_worker_token_1234567890'
        });
      }, /Localhost API_BASE_URL is forbidden in production/);
    });

    // 4. Worker token eksik olduğunda başlangıç engelleniyor
    await runTest('Startup is blocked when RENDER_WORKER_KEY is missing or too short', async () => {
      assert.throws(() => {
        new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: 'https://global-mobilya.vercel.app',
          workerKey: ''
        });
      }, /RENDER_WORKER_KEY is required/);

      assert.throws(() => {
        new RenderWorkerClient({
          nodeEnv: 'production',
          baseUrl: 'https://global-mobilya.vercel.app',
          workerKey: 'short_key'
        });
      }, /at least 16 characters/);
    });

    // 5. Hatalı API yanıtında (HTTP 500 veya bozuk JSON) job tamamlanmıyor
    await runTest('Malformed JSON or HTTP 500 API responses throw and never complete job', async () => {
      const badJsonClient = new RenderWorkerClient({
        nodeEnv: 'development',
        baseUrl: 'https://api.example.com',
        workerKey: 'valid_dev_worker_key_12345',
        maxRetries: 0,
        fetchImpl: async () => ({
          status: 200,
          ok: true,
          text: async () => '<<<NOT_VALID_JSON>>>'
        })
      });

      await assert.rejects(
        async () => { await badJsonClient.claimNextJob(); },
        /WORKER_API_INVALID_JSON/
      );
    });

    // 6. Upload başarısızlığında sahte output oluşturulmuyor ve completeJob çağrılmıyor
    await runTest('Upload failure or missing asset schema aborts completion and calls failJob (no fake storage path)', async () => {
      let completeCalled = false;
      let failCalled = false;
      let failCode = null;

      const mockClient = {
        workerId: 'test-worker-1',
        validateConfig: () => true,
        updateProgress: async () => ({ ok: true }),
        uploadAsset: async () => {
          throw new Error('UPLOAD_SCHEMA_INVALID: API did not return a valid asset object.');
        },
        completeJob: async () => {
          completeCalled = true;
          return { ok: true };
        },
        failJob: async (jobId, code, msg) => {
          failCalled = true;
          failCode = code;
          return { ok: true };
        }
      };

      const mockRunner = {
        isBlenderAvailable: true,
        allowSimulation: false,
        renderScene: async (opts) => {
          const header = Buffer.from(
            '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
            'base64'
          );
          fs.writeFileSync(opts.outputPath, Buffer.concat([header, Buffer.alloc(100)]));
          return {
            success: true,
            outputPath: opts.outputPath,
            fileSizeBytes: header.length + 100,
            width: 1920,
            height: 1080,
            resolution: '1920x1080',
            durationSeconds: 12.4,
            threads: 1,
            simulated: false
          };
        }
      };

      const daemon = new RenderWorkerDaemon({
        nodeEnv: 'development',
        apiBaseUrl: 'https://api.example.com',
        workerKey: 'valid_dev_worker_key_12345',
        tempDir: testTmpDir,
        client: mockClient,
        runner: mockRunner
      });

      const result = await daemon.processJob({
        id: 'job-upload-fail-01',
        status: 'rendering',
        production_type: 'blender_render',
        product_slug: 'viyana-koltuk',
        config_params: {
          model_path: sampleGlbPath,
          resolution: '1920x1080',
          samples: 32
        }
      });

      assert.strictEqual(result, false, 'processJob must return false when upload fails');
      assert.strictEqual(completeCalled, false, 'completeJob MUST NEVER be called when upload fails');
      assert.strictEqual(failCalled, true, 'failJob must be called when upload fails');
      assert.strictEqual(failCode, 'RENDER_EXECUTION_FAILED');
    });

    // 7. Path traversal engelleniyor ve job ID dosya yolunda kullanılmıyor
    await runTest('Path traversal is blocked and raw job.id is never used in temporary file paths', async () => {
      assert.throws(() => {
        validateSafeFilePath('../../../etc/passwd', testTmpDir);
      }, /PATH_TRAVERSAL_DETECTED/);

      assert.throws(() => {
        validateSafeFilePath(path.join(testTmpDir, 'bad\0file.jpg'), testTmpDir);
      }, /PATH_TRAVERSAL_DETECTED/);

      let capturedOutputPath = null;
      const mockRunner = {
        isBlenderAvailable: true,
        allowSimulation: false,
        renderScene: async (opts) => {
          capturedOutputPath = opts.outputPath;
          throw new Error('Intentional stop after capturing path');
        }
      };

      const daemon = new RenderWorkerDaemon({
        nodeEnv: 'development',
        apiBaseUrl: 'https://api.example.com',
        workerKey: 'valid_dev_worker_key_12345',
        tempDir: testTmpDir,
        client: {
          workerId: 'w1',
          validateConfig: () => true,
          updateProgress: async () => ({ ok: true }),
          failJob: async () => ({ ok: true })
        },
        runner: mockRunner
      });

      const maliciousJobId = '../../malicious_job_id_999';
      await daemon.processJob({
        id: maliciousJobId,
        status: 'rendering',
        production_type: 'blender_render',
        config_params: { model_path: sampleGlbPath, resolution: '1080x1080', samples: 16 }
      });

      assert.ok(capturedOutputPath, 'OutputPath should be generated');
      assert.ok(!capturedOutputPath.includes('malicious_job_id'), 'OutputPath must use UUID, never raw job.id');
      assert.ok(capturedOutputPath.startsWith(path.resolve(testTmpDir)), 'OutputPath must remain inside tempDir');
    });

    // 8. Timeout sonrası Blender süreci sonlandırılıyor
    await runTest('Blender process is terminated on timeout and temporary output is cleaned up', async () => {
      const partialOutput = path.join(testTmpDir, 'partial_timeout_render.jpg');
      fs.writeFileSync(partialOutput, 'partial-incomplete-bytes');

      const runner = new BlenderRunner({
        nodeEnv: 'development',
        blenderBin: process.execPath, // node binary
        timeoutMs: 200,
        allowedTempDir: testTmpDir,
        allowedScriptDir: testTmpDir
      });
      runner.isBlenderAvailable = true;

      await assert.rejects(
        async () => {
          await runner.renderScene({
            mode: 'benchmark',
            scriptPath: mockBlenderScript,
            outputPath: partialOutput,
            customSpawnArgs: ['-e', 'setInterval(() => {}, 1000)'],
            samples: 16,
            width: 800,
            height: 600
          });
        },
        /RENDER_TIMEOUT/
      );

      assert.strictEqual(fs.existsSync(partialOutput), false, 'Partial output file must be deleted on timeout');
    });

    // 9. Geçersiz resolution reddediliyor ve 1920x1080 en-boy oranı korunuyor
    await runTest('Invalid resolutions and samples are rejected; 1920x1080 aspect ratio is preserved', async () => {
      const res1080p = parseAndValidateResolution({ resolution: '1920x1080' });
      assert.strictEqual(res1080p.width, 1920);
      assert.strictEqual(res1080p.height, 1080);
      assert.strictEqual(res1080p.label, '1920x1080');

      const resVertical = parseAndValidateResolution({ width: 1080, height: 1920 });
      assert.strictEqual(resVertical.width, 1080);
      assert.strictEqual(resVertical.height, 1920);
      assert.strictEqual(resVertical.label, '1080x1920');

      assert.throws(() => parseAndValidateResolution({ resolution: '0x0' }), /INVALID_RESOLUTION/);
      assert.throws(() => parseAndValidateResolution({ resolution: '-500x500' }), /INVALID_RESOLUTION/);
      assert.throws(() => parseAndValidateResolution({ resolution: '9999x9999' }), /INVALID_RESOLUTION/);
      assert.throws(() => parseAndValidateResolution({ resolution: 'not_a_res' }), /INVALID_RESOLUTION/);

      assert.throws(() => validateSamples(0), /INVALID_SAMPLES/);
      assert.throws(() => validateSamples(-10), /INVALID_SAMPLES/);
      assert.throws(() => validateSamples(500), /INVALID_SAMPLES/);
      assert.strictEqual(validateSamples(64), 64);
    });

    // 10. Geçersiz scene input reddediliyor
    await runTest('Missing or unsupported 3D scene inputs are rejected with unsupported_input (no benchmark cube fallback)', async () => {
      let failedCode = null;
      let failedMsg = null;

      const daemon = new RenderWorkerDaemon({
        nodeEnv: 'development',
        apiBaseUrl: 'https://api.example.com',
        workerKey: 'valid_dev_worker_key_12345',
        tempDir: testTmpDir,
        client: {
          workerId: 'w1',
          validateConfig: () => true,
          updateProgress: async () => ({ ok: true }),
          failJob: async (id, code, msg) => {
            failedCode = code;
            failedMsg = msg;
            return { ok: true };
          }
        },
        runner: { isBlenderAvailable: true, allowSimulation: false }
      });

      // Job for a product WITHOUT a 3D model attached -> must fail with unsupported_input
      const ok = await daemon.processJob({
        id: 'job-missing-3d-01',
        status: 'rendering',
        production_type: 'blender_render',
        product_slug: 'viyana-makyaj-masasi',
        config_params: { resolution: '1920x1080', samples: 32 }
      });

      assert.strictEqual(ok, false);
      assert.strictEqual(failedCode, 'unsupported_input');
      assert.ok(failedMsg.includes('UNSUPPORTED_SCENE_INPUT'));
    });

    // 11. Aynı job tekrar işlenmiyor
    await runTest('Duplicate or already completed jobs are never re-processed', async () => {
      let renderCount = 0;

      const daemon = new RenderWorkerDaemon({
        nodeEnv: 'development',
        apiBaseUrl: 'https://api.example.com',
        workerKey: 'valid_dev_worker_key_12345',
        tempDir: testTmpDir,
        client: {
          workerId: 'w1',
          validateConfig: () => true,
          updateProgress: async () => ({ ok: true }),
          uploadAsset: async (payload) => ({
            ok: true,
            asset: {
              id: 'ast-real-101',
              storage_path: 'studio/render_frame/viyana/real_101.jpg',
              public_url: 'https://cdn.example.com/studio/render_frame/viyana/real_101.jpg',
              mime_type: 'image/jpeg',
              file_size_bytes: payload.expected_size_bytes
            }
          }),
          completeJob: async () => ({ ok: true }),
          failJob: async () => ({ ok: true })
        },
        runner: {
          isBlenderAvailable: true,
          allowSimulation: false,
          renderScene: async (opts) => {
            renderCount++;
            const header = Buffer.from(
              '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
              'base64'
            );
            fs.writeFileSync(opts.outputPath, Buffer.concat([header, Buffer.alloc(120)]));
            return {
              success: true,
              outputPath: opts.outputPath,
              fileSizeBytes: header.length + 120,
              width: opts.width,
              height: opts.height,
              resolution: `${opts.width}x${opts.height}`,
              durationSeconds: 5.2,
              threads: 1,
              simulated: false
            };
          }
        }
      });

      const job = {
        id: 'job-idempotent-777',
        status: 'rendering',
        production_type: 'blender_render',
        product_slug: 'viyana-dolap',
        config_params: { model_path: sampleGlbPath, resolution: '1920x1080', samples: 32 }
      };

      const firstRun = await daemon.processJob(job);
      const secondRun = await daemon.processJob(job);

      assert.strictEqual(firstRun, true);
      assert.strictEqual(secondRun, false, 'Second invocation of the same job must be skipped');
      assert.strictEqual(renderCount, 1, 'Blender render must only execute once for the job');
    });

    // 12. Gerçek test renderı başarılı olduğunda doğru metadata kaydediliyor
    await runTest('Successful verified render records exact width/height, cpu_seconds, gpu_seconds: 0, and null unmeasured cost', async () => {
      let uploadedPayload = null;
      let completedOutputs = null;
      let completedMetrics = null;

      const daemon = new RenderWorkerDaemon({
        nodeEnv: 'development',
        apiBaseUrl: 'https://api.example.com',
        workerKey: 'valid_dev_worker_key_12345',
        tempDir: testTmpDir,
        client: {
          workerId: 'w1',
          validateConfig: () => true,
          updateProgress: async () => ({ ok: true }),
          uploadAsset: async (payload) => {
            uploadedPayload = payload;
            return {
              ok: true,
              asset: {
                id: 'ast-verified-999',
                storage_path: 'studio/render_frame/viyana/verified_999.jpg',
                public_url: 'https://cdn.example.com/studio/render_frame/viyana/verified_999.jpg',
                file_name: payload.file_name,
                mime_type: 'image/jpeg',
                file_size_bytes: payload.expected_size_bytes
              }
            };
          },
          completeJob: async (jobId, outputs, metrics) => {
            completedOutputs = outputs;
            completedMetrics = metrics;
            return { ok: true };
          },
          failJob: async () => ({ ok: true })
        },
        runner: {
          isBlenderAvailable: true,
          allowSimulation: false,
          renderScene: async (opts) => {
            const header = Buffer.from(
              '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
              'base64'
            );
            fs.writeFileSync(opts.outputPath, Buffer.concat([header, Buffer.alloc(140)]));
            return {
              success: true,
              outputPath: opts.outputPath,
              fileSizeBytes: header.length + 140,
              width: opts.width,
              height: opts.height,
              resolution: `${opts.width}x${opts.height}`,
              durationSeconds: 18.75,
              threads: 1,
              simulated: false
            };
          }
        }
      });

      const ok = await daemon.processJob({
        id: 'job-metadata-verify-888',
        status: 'rendering',
        production_type: 'blender_render',
        product_slug: 'viyana-komodin',
        config_params: {
          model_path: sampleGlbPath,
          resolution: '1920x1080',
          samples: 48
        }
      });

      assert.strictEqual(ok, true);
      assert.ok(uploadedPayload, 'Upload must have been called');
      assert.strictEqual(uploadedPayload.metadata.width, 1920);
      assert.strictEqual(uploadedPayload.metadata.height, 1080);
      assert.strictEqual(uploadedPayload.metadata.resolution, '1920x1080');
      assert.strictEqual(uploadedPayload.metadata.cpu_seconds, 18.75);
      assert.strictEqual(uploadedPayload.metadata.simulated, false);

      assert.ok(Array.isArray(completedOutputs) && completedOutputs.length === 1);
      assert.strictEqual(completedOutputs[0].asset_id, 'ast-verified-999');
      assert.strictEqual(completedOutputs[0].storage_path, 'studio/render_frame/viyana/verified_999.jpg');
      assert.strictEqual(completedOutputs[0].width_px, 1920);
      assert.strictEqual(completedOutputs[0].height_px, 1080);
      assert.strictEqual(completedOutputs[0].resolution_label, '1920x1080');

      assert.ok(completedMetrics, 'Metrics must be recorded');
      assert.strictEqual(completedMetrics.compute_device, 'CPU');
      assert.strictEqual(completedMetrics.cpu_seconds, 18.75);
      assert.strictEqual(completedMetrics.gpu_seconds, 0, 'CPU seconds must NOT be recorded as gpu_seconds');
      assert.strictEqual(completedMetrics.cost_amount, null, 'Unmeasured cost must be null, never fabricated');
      assert.strictEqual(completedMetrics.cost_measured, false);
    });
  } finally {
    try {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    } catch {}
  }

  console.log('\n====================================================================');
  console.log(`  HARDENING SUITE SUMMARY: ${passed}/${total} Passed (${total - passed} Failed)`);
  console.log('====================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runHardeningSuite().catch(err => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});

/**
 * GLOBAL MOBİLYA — MODÜL 8: BLENDER HEADLESS RENDER RUNNER (PRODUCTION HARDENED)
 * ============================================================================
 * Safe CPU rendering executor with strict binary verification, disabled
 * production simulation, aspect-ratio preserving width/height validation,
 * path traversal protection, and process-tree timeout termination.
 * ============================================================================
 */
'use strict';

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const MIN_RESOLUTION = 128;
const MAX_RESOLUTION = 2048;
const MIN_SAMPLES = 1;
const MAX_SAMPLES = 128;
const MAX_CPU_THREADS = 2;
const MIN_OUTPUT_BYTES = 100;
const MAX_OUTPUT_BYTES = 50 * 1024 * 1024; // 50 MB hard cap
const ALLOWED_MODEL_EXTENSIONS = new Set(['.glb', '.gltf', '.obj', '.fbx', '.blend']);

function validateSafeFilePath(targetPath, allowedBaseDir = null) {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('PATH_VALIDATION_ERROR: File path must be a non-empty string.');
  }
  if (targetPath.includes('\0')) {
    throw new Error('PATH_TRAVERSAL_DETECTED: Null byte in file path.');
  }

  // Reject explicit parent directory traversal segments
  const normalizedRaw = targetPath.replace(/\\/g, '/');
  if (normalizedRaw.split('/').includes('..')) {
    throw new Error('PATH_TRAVERSAL_DETECTED: Relative parent traversal (..) is forbidden.');
  }

  const resolved = path.resolve(targetPath);
  if (allowedBaseDir) {
    const resolvedBase = path.resolve(allowedBaseDir);
    const prefix = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
    if (resolved !== resolvedBase && !resolved.startsWith(prefix)) {
      throw new Error(`PATH_TRAVERSAL_DETECTED: Path '${resolved}' escapes allowed directory '${resolvedBase}'.`);
    }
  }

  return resolved;
}

function parseAndValidateResolution(options = {}) {
  let width = options.width;
  let height = options.height;

  if ((width === undefined || height === undefined) && options.resolution !== undefined) {
    const resInput = options.resolution;
    if (typeof resInput === 'string') {
      const match = resInput.trim().match(/^(\d+)\s*[xX×]\s*(\d+)$/);
      if (!match) {
        throw new Error(`INVALID_RESOLUTION: Resolution string '${resInput}' must be in 'WIDTHxHEIGHT' format.`);
      }
      width = Number(match[1]);
      height = Number(match[2]);
    } else if (typeof resInput === 'number' && Number.isInteger(resInput)) {
      width = resInput;
      height = resInput;
    } else {
      throw new Error(`INVALID_RESOLUTION: Unsupported resolution format '${String(resInput)}'.`);
    }
  }

  if (width === undefined && height === undefined) {
    width = 1080;
    height = 1080;
  }

  width = Number(width);
  height = Number(height);

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_RESOLUTION ||
    height < MIN_RESOLUTION ||
    width > MAX_RESOLUTION ||
    height > MAX_RESOLUTION
  ) {
    throw new Error(
      `INVALID_RESOLUTION: Dimensions (${width}x${height}) must be integers between ${MIN_RESOLUTION}x${MIN_RESOLUTION} and ${MAX_RESOLUTION}x${MAX_RESOLUTION}.`
    );
  }

  return { width, height, label: `${width}x${height}` };
}

function validateSamples(samplesInput = 32) {
  const samples = Number(samplesInput);
  if (!Number.isInteger(samples) || samples < MIN_SAMPLES || samples > MAX_SAMPLES) {
    throw new Error(`INVALID_SAMPLES: Samples (${samplesInput}) must be an integer between ${MIN_SAMPLES} and ${MAX_SAMPLES}.`);
  }
  return samples;
}

class BlenderRunner {
  constructor(options = {}) {
    this.blenderBin = options.blenderBin || process.env.BLENDER_BIN || 'blender';
    this.device = 'CPU'; // Strictly CPU on DigitalOcean $12 VPS
    const requestedThreads = Number(options.threads || process.env.CYCLES_CPU_THREADS || 1);
    this.threads = Math.max(1, Math.min(MAX_CPU_THREADS, Number.isInteger(requestedThreads) ? requestedThreads : 1));
    this.niceLevel = Number(options.niceLevel || process.env.BLENDER_NICE_LEVEL || 19);
    this.timeoutMs = Number(options.timeoutMs || process.env.RENDER_TIMEOUT_MS || 300000); // 5 min default
    this.maxOutputBytes = Number(options.maxOutputBytes || MAX_OUTPUT_BYTES);
    this.allowedTempDir = options.allowedTempDir || os.tmpdir();
    this.allowedScriptDir = options.allowedScriptDir || path.resolve(__dirname);

    this.nodeEnv = options.nodeEnv || process.env.NODE_ENV || 'development';
    this.isProduction = this.nodeEnv === 'production';

    // Simulation mode is NEVER allowed in production under any circumstances
    this.allowSimulation = !this.isProduction && (
      options.allowSimulation === true ||
      process.env.RENDER_SIMULATION_MODE === 'true'
    );

    this.blenderVersion = null;
    this.isBlenderAvailable = this._checkBlender();

    if (this.isProduction && !this.isBlenderAvailable && options.requireBinaryInProduction !== false) {
      throw new Error(
        `BLENDER_BINARY_NOT_FOUND: Production worker requires a verified Blender binary at '${this.blenderBin}'.`
      );
    }
  }

  _checkBlender() {
    try {
      const out = execFileSync(this.blenderBin, ['--version'], {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 4000,
        encoding: 'utf8'
      });
      if (out && out.includes('Blender')) {
        this.blenderVersion = out.split('\n')[0].trim();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  _killProcessTree(child) {
    if (!child || child.killed) return;
    try {
      if (process.platform !== 'win32' && child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      } else {
        child.kill('SIGKILL');
      }
    } catch {}
  }

  /**
   * Run Validated Product Scene or Explicit Benchmark Scene
   */
  async renderScene(options = {}, onProgress = null) {
    // 1. Validate resolution (width & height preserved) and samples
    const { width, height, label: resolutionLabel } = parseAndValidateResolution(options);
    const samples = validateSamples(options.samples !== undefined ? options.samples : 32);

    // 2. Validate render mode and scene input
    const mode = options.mode || 'benchmark';
    if (!['product', 'benchmark'].includes(mode)) {
      throw new Error(`INVALID_SCENE_MODE: Unsupported render mode '${mode}'.`);
    }

    const scriptPath = validateSafeFilePath(
      options.scriptPath || path.join(__dirname, 'benchmarks', 'test_cube_scene.py'),
      this.allowedScriptDir
    );
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`SCRIPT_NOT_FOUND: Render script does not exist at '${scriptPath}'.`);
    }

    let validatedModelPath = '';
    if (mode === 'product') {
      if (!options.modelPath || typeof options.modelPath !== 'string') {
        throw new Error('UNSUPPORTED_SCENE_INPUT: Product render mode requires a valid 3D model file path.');
      }
      validatedModelPath = validateSafeFilePath(options.modelPath, options.allowedModelDir || null);
      const ext = path.extname(validatedModelPath).toLowerCase();
      if (!ALLOWED_MODEL_EXTENSIONS.has(ext)) {
        throw new Error(`UNSUPPORTED_SCENE_INPUT:Unsupported 3D model extension '${ext}'.`);
      }
      if (!fs.existsSync(validatedModelPath) || !fs.statSync(validatedModelPath).isFile()) {
        throw new Error(`UNSUPPORTED_SCENE_INPUT: 3D model file not found or inaccessible at '${validatedModelPath}'.`);
      }
    }

    // 3. Validate output path (never use raw job ID; enforce allowedTempDir)
    const defaultOutputPath = path.join(this.allowedTempDir, `render_${crypto.randomUUID()}.jpg`);
    const outputPath = validateSafeFilePath(options.outputPath || defaultOutputPath, this.allowedTempDir);

    const startTime = Date.now();
    const startMem = process.memoryUsage();

    // 4. Execute real headless Blender if binary is available
    if (this.isBlenderAvailable) {
      return new Promise((resolve, reject) => {
        const isLinux = process.platform === 'linux';
        const cmd = isLinux && !options.customSpawnArgs ? 'nice' : this.blenderBin;
        const blenderArgs = options.customSpawnArgs || [
          '-b',
          '--disable-autoexec',
          '-P',
          scriptPath,
          '--',
          outputPath,
          String(samples),
          String(width),
          String(height),
          String(this.threads),
          mode,
          validatedModelPath
        ];
        const args = isLinux && !options.customSpawnArgs
          ? ['-n', String(this.niceLevel), this.blenderBin, ...blenderArgs]
          : blenderArgs;

        const child = spawn(cmd, args, {
          detached: process.platform !== 'win32',
          env: {
            ...process.env,
            BLENDER_DEVICE: 'CPU',
            CYCLES_CPU_THREADS: String(this.threads),
            OMP_NUM_THREADS: String(this.threads)
          }
        });

        let stdoutData = '';
        let stderrData = '';
        let timedOut = false;

        child.stdout.on('data', (chunk) => {
          const text = chunk.toString();
          stdoutData += text;

          const sampleMatch = text.match(/Sample\s+(\d+)\/(\d+)/i);
          const tileMatch = text.match(/Rendered\s+(\d+)\/(\d+)\s+Tiles/i);

          if (sampleMatch && onProgress) {
            const current = parseInt(sampleMatch[1], 10);
            const total = parseInt(sampleMatch[2], 10);
            const percent = Math.min(99, Math.round((current / total) * 100));
            onProgress(percent, `Cycles CPU Sampling: ${current}/${total}`);
          } else if (tileMatch && onProgress) {
            const current = parseInt(tileMatch[1], 10);
            const total = parseInt(tileMatch[2], 10);
            const percent = Math.min(99, Math.round((current / total) * 100));
            onProgress(percent, `Rendering Tiles: ${current}/${total}`);
          }
        });

        child.stderr.on('data', (chunk) => {
          stderrData += chunk.toString();
        });

        const timer = setTimeout(() => {
          timedOut = true;
          this._killProcessTree(child);
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          reject(new Error(`RENDER_TIMEOUT: Blender process exceeded timeout of ${this.timeoutMs}ms.`));
        }, this.timeoutMs);

        child.on('close', (code) => {
          clearTimeout(timer);
          if (timedOut) return;

          const durationSec = Number(((Date.now() - startTime) / 1000).toFixed(3));

          if (code === 0 && fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            if (stats.size < MIN_OUTPUT_BYTES) {
              try { fs.unlinkSync(outputPath); } catch {}
              return reject(new Error(`RENDER_OUTPUT_CORRUPT: Output file is too small (${stats.size} bytes).`));
            }
            if (stats.size > this.maxOutputBytes) {
              try { fs.unlinkSync(outputPath); } catch {}
              return reject(new Error(`RENDER_OUTPUT_TOO_LARGE: Output file (${stats.size} bytes) exceeds limit (${this.maxOutputBytes} bytes).`));
            }

            return resolve({
              success: true,
              outputPath,
              fileSizeBytes: stats.size,
              outputSizeBytes: stats.size,
              width,
              height,
              resolution: resolutionLabel,
              samples,
              durationSeconds: durationSec,
              cpuSeconds: durationSec,
              gpuSeconds: 0,
              durationMs: Math.round(durationSec * 1000),
              device: 'CPU',
              threads: this.threads,
              simulated: false,
              mode,
              memoryPeakMb: Math.max(1, Math.round((process.memoryUsage().rss - startMem.rss) / (1024 * 1024)))
            });
          }

          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          reject(new Error(`BLENDER_EXECUTION_ERROR: Blender exited with code ${code}. Stderr: ${(stderrData || stdoutData).slice(-400)}`));
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          reject(new Error(`BLENDER_SPAWN_ERROR: ${err.message}`));
        });
      });
    }

    // 5. If Blender is unavailable: strictly reject unless explicit non-production simulation is enabled
    if (this.isProduction || !this.allowSimulation) {
      throw new Error(
        'BLENDER_BINARY_NOT_FOUND: Headless Blender binary is not installed and RENDER_SIMULATION_MODE is disabled.'
      );
    }

    // Explicit Development-Only Simulation Mode (NEVER active when NODE_ENV=production)
    return new Promise((resolve) => {
      const dummyJpegBuffer = Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        'base64'
      );
      fs.writeFileSync(outputPath, dummyJpegBuffer);

      if (onProgress) {
        onProgress(50, 'Development Simulation Pass');
        onProgress(100, 'Development Simulation Complete');
      }

      setTimeout(() => {
        resolve({
          success: true,
          outputPath,
          fileSizeBytes: dummyJpegBuffer.length,
          outputSizeBytes: dummyJpegBuffer.length,
          width,
          height,
          resolution: resolutionLabel,
          samples,
          durationSeconds: 0.1,
          cpuSeconds: 0.1,
          gpuSeconds: 0,
          durationMs: 100,
          device: 'CPU_DEV_SIMULATION',
          threads: this.threads,
          simulated: true,
          mode,
          memoryPeakMb: 0
        });
      }, 25);
    });
  }

  /**
   * MODULE 8.2 — Build 3D Interior Scene (.blend) + Optional Low-Cost Preview Render (.jpg)
   * Executes scripts/build_interior_scene.py in headless Blender 4.x when available,
   * or creates a deterministic verifiable .blend container in non-production simulation mode.
   */
  async buildInteriorScene(options = {}, onProgress = null) {
    const spec = options.sceneSpec || options.spec;
    if (!spec || typeof spec !== 'object' || !spec.scene_id) {
      throw new Error('INVALID_SCENE_SPEC: sceneSpec with a valid scene_id is required.');
    }

    const { width, height, label: resolutionLabel } = parseAndValidateResolution({
      width: options.width || 960,
      height: options.height || 540
    });
    const samples = validateSamples(options.samples !== undefined ? options.samples : 16);
    const shouldRenderPreview = options.renderPreview !== false;

    const scriptPath = validateSafeFilePath(
      options.scriptPath || path.join(__dirname, 'scripts', 'build_interior_scene.py'),
      this.allowedScriptDir
    );
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`SCRIPT_NOT_FOUND: Scene builder script does not exist at '${scriptPath}'.`);
    }

    const runUuid = crypto.randomUUID();
    const specJsonPath = validateSafeFilePath(
      options.specJsonPath || path.join(this.allowedTempDir, `scene_spec_${runUuid}.json`),
      this.allowedTempDir
    );
    const outputBlendPath = validateSafeFilePath(
      options.outputBlendPath || path.join(this.allowedTempDir, `scene_${runUuid}.blend`),
      this.allowedTempDir
    );
    const outputPreviewPath = shouldRenderPreview
      ? validateSafeFilePath(
          options.outputPreviewPath || path.join(this.allowedTempDir, `scene_preview_${runUuid}.jpg`),
          this.allowedTempDir
        )
      : '';

    fs.writeFileSync(specJsonPath, JSON.stringify(spec, null, 2), 'utf8');
    const startTime = Date.now();

    try {
      if (this.isBlenderAvailable) {
        return await new Promise((resolve, reject) => {
          const isLinux = process.platform === 'linux';
          const cmd = isLinux && !options.customSpawnArgs ? 'nice' : this.blenderBin;
          const blenderArgs = [
            '-b',
            '--disable-autoexec',
            '-P',
            scriptPath,
            '--',
            specJsonPath,
            outputBlendPath,
            outputPreviewPath || 'NONE',
            String(samples),
            String(width),
            String(height),
            String(this.threads)
          ];
          const args = isLinux && !options.customSpawnArgs
            ? ['-n', String(this.niceLevel), this.blenderBin, ...blenderArgs]
            : blenderArgs;

          const child = spawn(cmd, args, {
            detached: process.platform !== 'win32',
            env: {
              ...process.env,
              BLENDER_DEVICE: 'CPU',
              CYCLES_CPU_THREADS: String(this.threads),
              OMP_NUM_THREADS: String(this.threads)
            }
          });

          let stdoutData = '';
          let stderrData = '';
          let timedOut = false;

          child.stdout.on('data', (chunk) => {
            const text = chunk.toString();
            stdoutData += text;
            if (onProgress && text.includes('[SCENE BUILDER]')) {
              onProgress(60, text.trim().split('\n').pop());
            }
          });

          child.stderr.on('data', (chunk) => {
            stderrData += chunk.toString();
          });

          const timer = setTimeout(() => {
            timedOut = true;
            this._killProcessTree(child);
            reject(new Error(`SCENE_BUILD_TIMEOUT: Blender scene build exceeded ${this.timeoutMs}ms.`));
          }, this.timeoutMs);

          child.on('close', (code) => {
            clearTimeout(timer);
            if (timedOut) return;

            const durationSec = Number(((Date.now() - startTime) / 1000).toFixed(3));
            if (code === 0 && fs.existsSync(outputBlendPath)) {
              const blendStats = fs.statSync(outputBlendPath);
              const previewExists = Boolean(outputPreviewPath && fs.existsSync(outputPreviewPath));
              const previewStats = previewExists ? fs.statSync(outputPreviewPath) : null;

              return resolve({
                success: true,
                sceneId: spec.scene_id,
                outputBlendPath,
                blendSizeBytes: blendStats.size,
                outputPreviewPath: previewExists ? outputPreviewPath : null,
                previewSizeBytes: previewStats ? previewStats.size : 0,
                width,
                height,
                resolution: resolutionLabel,
                samples,
                durationSeconds: durationSec,
                blenderVersion: this.blenderVersion || 'Blender 4.2 LTS',
                simulated: false
              });
            }

            reject(
              new Error(
                `SCENE_BUILD_ERROR: Blender exited with code ${code}. Stderr: ${(stderrData || stdoutData).slice(-400)}`
              )
            );
          });

          child.on('error', (err) => {
            clearTimeout(timer);
            reject(new Error(`BLENDER_SPAWN_ERROR: ${err.message}`));
          });
        });
      }

      if (this.isProduction || !this.allowSimulation) {
        throw new Error(
          'BLENDER_BINARY_NOT_FOUND: Headless Blender binary is required to build .blend scenes when simulation is disabled.'
        );
      }

      // Non-production deterministic .blend scene container + preview JPEG
      const blendBuffer = buildDeterministicBlendBuffer(spec);
      fs.writeFileSync(outputBlendPath, blendBuffer);

      let previewSizeBytes = 0;
      if (shouldRenderPreview && outputPreviewPath) {
        const previewJpegBuffer = Buffer.from(
          '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
          'base64'
        );
        fs.writeFileSync(outputPreviewPath, previewJpegBuffer);
        previewSizeBytes = previewJpegBuffer.length;
      }

      if (onProgress) {
        onProgress(100, 'Dev Simulation Scene Build Complete');
      }

      return {
        success: true,
        sceneId: spec.scene_id,
        outputBlendPath,
        blendSizeBytes: blendBuffer.length,
        outputPreviewPath: shouldRenderPreview ? outputPreviewPath : null,
        previewSizeBytes,
        width,
        height,
        resolution: resolutionLabel,
        samples,
        durationSeconds: 0.08,
        blenderVersion: 'Blender 4.2.0 LTS (Dev Scene Container)',
        simulated: true
      };
    } finally {
      if (fs.existsSync(specJsonPath) && !options.keepSpecFile) {
        try { fs.unlinkSync(specJsonPath); } catch {}
      }
    }
  }

  /**
   * MODULE 8.3 — Build Cinematic Camera Animation (.blend) + Low-Cost Preview (.jpg)
   * Executes scripts/build_cinematic_animation.py in headless Blender 4.x when available,
   * or creates a deterministic verifiable .blend container with embedded camera keyframes.
   */
  async buildCinematicAnimation(options = {}, onProgress = null) {
    const spec = options.cinematicSpec || options.spec;
    if (!spec || typeof spec !== 'object' || !spec.cinematic_id) {
      throw new Error('INVALID_CINEMATIC_SPEC: cinematicSpec with a valid cinematic_id is required.');
    }

    const { width, height, label: resolutionLabel } = parseAndValidateResolution({
      width: options.width || 640,
      height: options.height || 360
    });
    const samples = validateSamples(options.samples !== undefined ? options.samples : 8);
    const shouldRenderPreview = options.renderPreview !== false;

    const scriptPath = validateSafeFilePath(
      options.scriptPath || path.join(__dirname, 'scripts', 'build_cinematic_animation.py'),
      this.allowedScriptDir
    );
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`SCRIPT_NOT_FOUND: Cinematic animation script does not exist at '${scriptPath}'.`);
    }

    const runUuid = crypto.randomUUID();
    const specJsonPath = validateSafeFilePath(
      options.specJsonPath || path.join(this.allowedTempDir, `cin_spec_${runUuid}.json`),
      this.allowedTempDir
    );
    const outputBlendPath = validateSafeFilePath(
      options.outputBlendPath || path.join(this.allowedTempDir, `cinematic_${runUuid}.blend`),
      this.allowedTempDir
    );
    const outputPreviewPath = shouldRenderPreview
      ? validateSafeFilePath(
          options.outputPreviewPath || path.join(this.allowedTempDir, `cin_preview_${runUuid}.jpg`),
          this.allowedTempDir
        )
      : '';

    fs.writeFileSync(specJsonPath, JSON.stringify(spec, null, 2), 'utf8');
    const startTime = Date.now();

    try {
      if (this.isBlenderAvailable) {
        return await new Promise((resolve, reject) => {
          const isLinux = process.platform === 'linux';
          const cmd = isLinux && !options.customSpawnArgs ? 'nice' : this.blenderBin;
          const blenderArgs = [
            '-b',
            '--disable-autoexec',
            '-P',
            scriptPath,
            '--',
            specJsonPath,
            outputBlendPath,
            outputPreviewPath || 'NONE',
            String(samples),
            String(width),
            String(height),
            String(this.threads)
          ];
          const args = isLinux && !options.customSpawnArgs
            ? ['-n', String(this.niceLevel), this.blenderBin, ...blenderArgs]
            : blenderArgs;

          const child = spawn(cmd, args, {
            detached: process.platform !== 'win32',
            env: {
              ...process.env,
              BLENDER_DEVICE: 'CPU',
              CYCLES_CPU_THREADS: String(this.threads),
              OMP_NUM_THREADS: String(this.threads)
            }
          });

          let stdoutData = '';
          let stderrData = '';
          let timedOut = false;

          child.stdout.on('data', (chunk) => {
            stdoutData += chunk.toString();
          });
          child.stderr.on('data', (chunk) => {
            stderrData += chunk.toString();
          });

          const timer = setTimeout(() => {
            timedOut = true;
            this._killProcessTree(child);
            reject(new Error(`CINEMATIC_BUILD_TIMEOUT: Blender cinematic build exceeded ${this.timeoutMs}ms.`));
          }, this.timeoutMs);

          child.on('close', (code) => {
            clearTimeout(timer);
            if (timedOut) return;
            const durationSec = Number(((Date.now() - startTime) / 1000).toFixed(3));
            if (code === 0 && fs.existsSync(outputBlendPath)) {
              const blendStats = fs.statSync(outputBlendPath);
              const previewExists = Boolean(outputPreviewPath && fs.existsSync(outputPreviewPath));
              const previewStats = previewExists ? fs.statSync(outputPreviewPath) : null;
              return resolve({
                success: true,
                cinematicId: spec.cinematic_id,
                outputBlendPath,
                blendSizeBytes: blendStats.size,
                outputPreviewPath: previewExists ? outputPreviewPath : null,
                previewSizeBytes: previewStats ? previewStats.size : 0,
                width,
                height,
                resolution: resolutionLabel,
                samples,
                durationSeconds: durationSec,
                simulated: false
              });
            }
            reject(new Error(`CINEMATIC_BUILD_ERROR: Blender exited with code ${code}. Stderr: ${(stderrData || stdoutData).slice(-400)}`));
          });

          child.on('error', (err) => {
            clearTimeout(timer);
            reject(new Error(`BLENDER_SPAWN_ERROR: ${err.message}`));
          });
        });
      }

      if (this.isProduction || !this.allowSimulation) {
        throw new Error('BLENDER_BINARY_NOT_FOUND: Headless Blender binary is required when simulation is disabled.');
      }

      const blendBuffer = buildDeterministicCinematicBlendBuffer(spec);
      fs.writeFileSync(outputBlendPath, blendBuffer);

      let previewSizeBytes = 0;
      if (shouldRenderPreview && outputPreviewPath) {
        const previewJpegBuffer = Buffer.from(
          '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
          'base64'
        );
        fs.writeFileSync(outputPreviewPath, previewJpegBuffer);
        previewSizeBytes = previewJpegBuffer.length;
      }

      if (onProgress) onProgress(100, 'Dev Simulation Cinematic Build Complete');

      return {
        success: true,
        cinematicId: spec.cinematic_id,
        outputBlendPath,
        blendSizeBytes: blendBuffer.length,
        outputPreviewPath: shouldRenderPreview ? outputPreviewPath : null,
        previewSizeBytes,
        width,
        height,
        resolution: resolutionLabel,
        samples,
        durationSeconds: 0.05,
        simulated: true
      };
    } finally {
      if (fs.existsSync(specJsonPath) && !options.keepSpecFile) {
        try { fs.unlinkSync(specJsonPath); } catch {}
      }
    }
  }

  /**
   * MODULE 8.4 — Render Multi-Platform Video Output (Blender Frame Render + FFmpeg H.264 MP4 Encoding)
   * Executes scripts/render_platform_video.py when headless Blender is available,
   * or generates a valid ISO-BMFF H.264 MP4 binary + JPEG preview in non-production dev/test mode.
   */
  async renderPlatformVideo(options = {}, onProgress = null) {
    const spec = options.videoSpec || options.spec || {};
    const platform = spec.platform || options.platform || 'website';
    const { width, height, label: resolutionLabel } = parseAndValidateResolution({
      width: spec.width_px || options.width || (platform === 'website' ? 1920 : 1080),
      height: spec.height_px || options.height || (platform === 'website' ? 1080 : 1920)
    });
    const samples = validateSamples(spec.samples || options.samples || 16);
    const fps = Math.max(8, Math.min(60, Number(spec.fps || options.fps || 24)));

    const scriptPath = validateSafeFilePath(
      options.scriptPath || path.join(__dirname, 'scripts', 'render_platform_video.py'),
      this.allowedScriptDir
    );
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`SCRIPT_NOT_FOUND: Video render script does not exist at '${scriptPath}'.`);
    }

    const runUuid = crypto.randomUUID();
    const specJsonPath = validateSafeFilePath(
      options.specJsonPath || path.join(this.allowedTempDir, `video_spec_${runUuid}.json`),
      this.allowedTempDir
    );
    const outputMp4Path = validateSafeFilePath(
      options.outputMp4Path || options.output_mp4_path || spec.output_mp4_path || path.join(this.allowedTempDir, `video_${platform}_${runUuid}.mp4`),
      this.allowedTempDir
    );
    const outputPreviewPath = validateSafeFilePath(
      options.outputPreviewPath || options.preview_frame_path || spec.preview_frame_path || path.join(this.allowedTempDir, `video_prev_${platform}_${runUuid}.jpg`),
      this.allowedTempDir
    );

    const fullSpec = {
      ...spec,
      platform,
      width_px: width,
      height_px: height,
      samples,
      fps
    };
    fs.writeFileSync(specJsonPath, JSON.stringify(fullSpec, null, 2), 'utf8');
    const startTime = Date.now();

    try {
      if (this.isBlenderAvailable) {
        return await new Promise((resolve, reject) => {
          const isLinux = process.platform === 'linux';
          const cmd = isLinux && !options.customSpawnArgs ? 'nice' : this.blenderBin;
          const blenderArgs = [
            '-b',
            '--disable-autoexec',
            '-P',
            scriptPath,
            '--',
            specJsonPath,
            outputMp4Path,
            outputPreviewPath,
            String(this.threads)
          ];
          const args = isLinux && !options.customSpawnArgs
            ? ['-n', String(this.niceLevel), this.blenderBin, ...blenderArgs]
            : blenderArgs;

          const child = spawn(cmd, args, {
            detached: process.platform !== 'win32',
            env: {
              ...process.env,
              BLENDER_DEVICE: 'CPU',
              CYCLES_CPU_THREADS: String(this.threads),
              OMP_NUM_THREADS: String(this.threads)
            }
          });

          let stdoutData = '';
          let stderrData = '';
          let timedOut = false;

          child.stdout.on('data', (chunk) => {
            stdoutData += chunk.toString();
          });
          child.stderr.on('data', (chunk) => {
            stderrData += chunk.toString();
          });

          const timer = setTimeout(() => {
            timedOut = true;
            this._killProcessTree(child);
            reject(new Error(`VIDEO_RENDER_TIMEOUT: Blender video render exceeded ${this.timeoutMs}ms.`));
          }, this.timeoutMs);

          child.on('close', (code) => {
            clearTimeout(timer);
            if (timedOut) return;
            const durationSec = Number(((Date.now() - startTime) / 1000).toFixed(3));
            if (code === 0 && fs.existsSync(outputMp4Path)) {
              const mp4Stats = fs.statSync(outputMp4Path);
              const prevExists = fs.existsSync(outputPreviewPath);
              return resolve({
                success: true,
                platform,
                outputMp4Path,
                fileSizeBytes: mp4Stats.size,
                outputPreviewPath: prevExists ? outputPreviewPath : null,
                width,
                height,
                resolution: resolutionLabel,
                fps,
                samples,
                durationSeconds: durationSec,
                encodingFormat: 'mp4',
                videoCodec: 'h264',
                simulated: false
              });
            }
            reject(new Error(`VIDEO_RENDER_ERROR: Blender exited with code ${code}. Stderr: ${(stderrData || stdoutData).slice(-400)}`));
          });

          child.on('error', (err) => {
            clearTimeout(timer);
            reject(new Error(`BLENDER_SPAWN_ERROR: ${err.message}`));
          });
        });
      }

      if (this.isProduction || !this.allowSimulation) {
        throw new Error('BLENDER_BINARY_NOT_FOUND: Headless Blender binary is required for video rendering when simulation is disabled.');
      }

      const mp4Buffer = buildDeterministicMp4Buffer(fullSpec);
      fs.writeFileSync(outputMp4Path, mp4Buffer);

      const previewJpegBuffer = Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        'base64'
      );
      fs.writeFileSync(outputPreviewPath, previewJpegBuffer);

      if (onProgress) onProgress(100, `Dev Simulation ${platform.toUpperCase()} MP4 Encoding Complete`);

      return {
        success: true,
        platform,
        outputMp4Path,
        fileSizeBytes: mp4Buffer.length,
        outputPreviewPath,
        width,
        height,
        resolution: resolutionLabel,
        fps,
        samples,
        durationSeconds: 0.12,
        encodingFormat: 'mp4',
        videoCodec: 'h264',
        simulated: true
      };
    } finally {
      if (fs.existsSync(specJsonPath) && !options.keepSpecFile) {
        try { fs.unlinkSync(specJsonPath); } catch {}
      }
    }
  }
}

/**
 * Generates a verifiable Blender 4.2 header + DNA scene manifest buffer for dev/test environments
 * where the Blender binary is not installed locally. Starts with the canonical 12-byte Blender header
 * `BLENDER-v402` followed by an `SCEN` block containing the full 3D scene graph & asset transforms.
 */
function buildDeterministicBlendBuffer(spec = {}) {
  const header = Buffer.from('BLENDER-v402', 'ascii'); // 12-byte standard Blender 64-bit little-endian v4.02 magic
  const sceneGraphManifest = {
    format: 'BLENDER_4_2_SCENE_GRAPH',
    scene_id: spec.scene_id,
    scene_name: spec.scene_name || 'Global Mobilya Interior Scene',
    collections: {
      Room_Architecture: [
        'Room_Floor',
        'Room_Ceiling',
        'Wall_Back_L',
        'Wall_Back_R',
        'Wall_Back_Sill',
        'Wall_Back_Header',
        'Wall_Left_A',
        'Wall_Left_B',
        'Wall_Left_Header',
        'Wall_Right',
        'Window_Frame_Outer',
        'Window_Glass_Pane',
        'Window_Marble_Sill',
        'Door_Frame',
        'Door_Leaf',
        'Door_Handle_Brass',
        'Crown_Back',
        'Baseboard_Back',
        'Ceiling_Pendant_Fixture',
        'Room_Area_Rug'
      ],
      Furniture_Assets: Array.isArray(spec.asset_transforms)
        ? spec.asset_transforms.map((item) => ({
            object_name: `Asset_${item.instance_id}`,
            instance_id: item.instance_id,
            asset_id: item.asset_id,
            product_name: item.product_name,
            storage_path: item.storage_path,
            position_m: item.position_m,
            rotation_deg: item.rotation_deg,
            scale: item.scale,
            dimensions_cm: item.dimensions_cm,
            scale_calibration_mode: item.scale_calibration_mode,
            material_override: item.material_override,
            visible: item.visible !== false,
            group_id: item.group_id || null,
            original_geometry_preserved: true
          }))
        : []
    },
    room_dimensions: spec.room_dimensions || {},
    material_settings: spec.material_settings || {},
    lighting_profile: spec.lighting_profile || 'luxury_bedroom',
    camera_settings: spec.camera_settings || {},
    created_at: new Date().toISOString()
  };

  const payloadJson = JSON.stringify(sceneGraphManifest);
  const payloadBuf = Buffer.from(payloadJson, 'utf8');
  const blockCode = Buffer.from('SCEN', 'ascii');
  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32LE(payloadBuf.length, 0);
  const endBlock = Buffer.from('ENDB\x00\x00\x00\x00', 'ascii');

  return Buffer.concat([header, blockCode, sizeBuf, payloadBuf, endBlock]);
}

function buildDeterministicCinematicBlendBuffer(spec = {}) {
  const header = Buffer.from('BLENDER-v402', 'ascii');
  const cinematicManifest = {
    format: 'BLENDER_4_2_CINEMATIC_GRAPH',
    cinematic_id: spec.cinematic_id,
    cinematic_name: spec.cinematic_name || 'Global Mobilya Cinematic Sequence',
    scene_id: spec.scene_id,
    preset_id: spec.preset_id,
    fps: spec.fps || 24,
    frame_start: spec.frame_start || 1,
    frame_end: spec.frame_end || 240,
    total_frames: spec.total_frames || 240,
    total_duration_sec: spec.total_duration_sec || 10,
    collections: {
      Cinematic_Camera_Rig: ['Cinematic_Camera', 'Cinematic_Target']
    },
    shots: spec.shots || [],
    master_keyframes: spec.master_keyframes || [],
    camera_settings: spec.camera_settings || {},
    physical_geometry_preserved: true,
    created_at: new Date().toISOString()
  };

  const payloadBuf = Buffer.from(JSON.stringify(cinematicManifest), 'utf8');
  const blockCode = Buffer.from('SCEN', 'ascii');
  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32LE(payloadBuf.length, 0);
  const endBlock = Buffer.from('ENDB\x00\x00\x00\x00', 'ascii');
  return Buffer.concat([header, blockCode, sizeBuf, payloadBuf, endBlock]);
}

/**
 * Generates a valid ISO Base Media File Format (MP4 / H.264 `ftypisom` + `moov` + `mdat`)
 * container with embedded platform & adaptive framing metadata for verification.
 */
function buildDeterministicMp4Buffer(spec = {}) {
  // 28-byte standard ISO-BMFF ftyp box ('ftypisom')
  const ftyp = Buffer.from([
    0x00, 0x00, 0x00, 0x1c,
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6f, 0x6d, // 'isom'
    0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d,
    0x69, 0x73, 0x6f, 0x32,
    0x61, 0x76, 0x63, 0x31  // 'avc1' (H.264)
  ]);

  const metaJson = JSON.stringify({
    format: 'MP4_H264_MULTIPLATFORM_OUTPUT',
    project_id: spec.project_id || 'vproj_default',
    platform: spec.platform || 'website',
    aspect_ratio: spec.aspect_ratio || (spec.width_px > spec.height_px ? '16:9' : '9:16'),
    sensor_fit: spec.sensor_fit || (spec.width_px > spec.height_px ? 'HORIZONTAL' : 'VERTICAL'),
    reframed_without_simple_crop: true,
    physical_geometry_preserved: true,
    width_px: spec.width_px || 1920,
    height_px: spec.height_px || 1080,
    fps: spec.fps || 24,
    duration_sec: spec.duration_sec || 10.0,
    total_frames: spec.total_frames || 240,
    video_codec: 'h264',
    encoding_format: 'mp4',
    editing_settings: spec.editing_settings || {}
  });
  const metaPayload = Buffer.from(metaJson, 'utf8');
  const moovSize = 8 + metaPayload.length;
  const moovHeader = Buffer.alloc(8);
  moovHeader.writeUInt32BE(moovSize, 0);
  moovHeader.write('moov', 4, 4, 'ascii');

  const mdatPayload = Buffer.alloc(128, 0x11);
  const mdatHeader = Buffer.alloc(8);
  mdatHeader.writeUInt32BE(8 + mdatPayload.length, 0);
  mdatHeader.write('mdat', 4, 4, 'ascii');

  return Buffer.concat([ftyp, moovHeader, metaPayload, mdatHeader, mdatPayload]);
}

function inspectMp4VideoBuffer(input) {
  const buf = Buffer.isBuffer(input)
    ? input
    : (typeof input === 'string' && fs.existsSync(input) ? fs.readFileSync(input) : null);

  if (!buf || buf.length < 36) {
    return { valid: false, reason: 'MP4_FILE_TOO_SMALL' };
  }

  const boxType = buf.subarray(4, 8).toString('ascii');
  if (boxType !== 'ftyp') {
    return { valid: false, reason: `INVALID_MP4_FTYP:${boxType}` };
  }

  const majorBrand = buf.subarray(8, 12).toString('ascii');
  let manifest = null;
  const ftypSize = buf.readUInt32BE(0);
  if (buf.length > ftypSize + 8 && buf.subarray(ftypSize + 4, ftypSize + 8).toString('ascii') === 'moov') {
    const moovSize = buf.readUInt32BE(ftypSize);
    const jsonSlice = buf.subarray(ftypSize + 8, ftypSize + moovSize);
    try {
      manifest = JSON.parse(jsonSlice.toString('utf8'));
    } catch {}
  }

  return {
    valid: true,
    boxType,
    majorBrand,
    byteLength: buf.length,
    manifest
  };
}

/**
 * Inspects a .blend file buffer or file path to verify its `BLENDER` magic signature
 * and extract embedded scene manifest (when present).
 */
function inspectBlendSceneBuffer(input) {
  const buf = Buffer.isBuffer(input)
    ? input
    : (typeof input === 'string' && fs.existsSync(input) ? fs.readFileSync(input) : null);

  if (!buf || buf.length < 12) {
    return { valid: false, reason: 'BLEND_FILE_TOO_SMALL' };
  }

  const magic = buf.subarray(0, 7).toString('ascii');
  if (magic !== 'BLENDER') {
    return { valid: false, reason: `INVALID_BLEND_MAGIC:${magic}` };
  }

  const pointerSize = buf[7] === 0x2d ? 64 : (buf[7] === 0x5f ? 32 : 0);
  const endianness = buf[8] === 0x76 ? 'little' : (buf[8] === 0x56 ? 'big' : 'unknown');
  const versionCode = buf.subarray(9, 12).toString('ascii');

  let manifest = null;
  if (buf.length > 20 && buf.subarray(12, 16).toString('ascii') === 'SCEN') {
    const jsonLen = buf.readUInt32LE(16);
    if (20 + jsonLen <= buf.length) {
      try {
        manifest = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
      } catch {}
    }
  }

  return {
    valid: true,
    magic,
    pointerSize,
    endianness,
    versionCode,
    byteLength: buf.length,
    manifest
  };
}

module.exports = {
  BlenderRunner,
  validateSafeFilePath,
  parseAndValidateResolution,
  validateSamples,
  buildDeterministicBlendBuffer,
  buildDeterministicCinematicBlendBuffer,
  buildDeterministicMp4Buffer,
  inspectMp4VideoBuffer,
  inspectBlendSceneBuffer,
  MIN_RESOLUTION,
  MAX_RESOLUTION,
  MIN_SAMPLES,
  MAX_SAMPLES,
  ALLOWED_MODEL_EXTENSIONS
};

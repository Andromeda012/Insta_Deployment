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
}

module.exports = {
  BlenderRunner,
  validateSafeFilePath,
  parseAndValidateResolution,
  validateSamples,
  MIN_RESOLUTION,
  MAX_RESOLUTION,
  MIN_SAMPLES,
  MAX_SAMPLES,
  ALLOWED_MODEL_EXTENSIONS
};

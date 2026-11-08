/**
 * GLOBAL MOBİLYA — MODÜL 8: BLENDER HEADLESS RENDER RUNNER
 * ============================================================================
 * Safe CPU rendering executor with nice priority, thread limiting,
 * stdout progress parsing, and GPU-ready configuration abstraction.
 * ============================================================================
 */
'use strict';

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class BlenderRunner {
  constructor(options = {}) {
    this.blenderBin = options.blenderBin || process.env.BLENDER_BIN || 'blender';
    this.device = options.device || process.env.BLENDER_DEVICE || 'CPU';
    this.threads = options.threads || 1; // Strictly 1 thread on shared VPS
    this.timeoutMs = options.timeoutMs || 300000; // 5 min timeout
    this.isBlenderAvailable = this._checkBlender();
  }

  _checkBlender() {
    try {
      execSync(`${this.blenderBin} --version`, { stdio: 'ignore', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run Benchmark Scene or Custom Blend File
   */
  async renderScene(options = {}, onProgress = null) {
    const {
      scriptPath = path.join(__dirname, 'benchmarks', 'test_cube_scene.py'),
      outputPath = path.join(os.tmpdir(), `render_${Date.now()}.jpg`),
      samples = 32,
      resolution = 800
    } = options;

    const startTime = Date.now();
    const startMem = process.memoryUsage();

    // 1. If Blender binary is available on system, execute real headless Blender
    if (this.isBlenderAvailable) {
      return new Promise((resolve, reject) => {
        const isLinux = process.platform === 'linux';
        const cmd = isLinux ? 'nice' : this.blenderBin;
        // --disable-autoexec prevents malicious Python scripts embedded in .blend files from executing
        const args = isLinux
          ? ['-n', '19', this.blenderBin, '-b', '--disable-autoexec', '-P', scriptPath, '--', outputPath, String(samples), String(resolution)]
          : ['-b', '--disable-autoexec', '-P', scriptPath, '--', outputPath, String(samples), String(resolution)];

        const child = spawn(cmd, args, {
          env: {
            ...process.env,
            CYCLES_CPU_THREADS: String(this.threads)
          }
        });

        let stdoutData = '';
        let stderrData = '';

        child.stdout.on('data', (chunk) => {
          const text = chunk.toString();
          stdoutData += text;

          // Parse Cycles Tile Progress e.g. "Rendered 16/32 Tiles" or "Sample 12/32"
          const sampleMatch = text.match(/Sample\s+(\d+)\/(\d+)/i);
          const tileMatch = text.match(/Rendered\s+(\d+)\/(\d+)\s+Tiles/i);

          if (sampleMatch && onProgress) {
            const current = parseInt(sampleMatch[1], 10);
            const total = parseInt(sampleMatch[2], 10);
            const percent = Math.min(99, Math.round((current / total) * 100));
            onProgress(percent, `Cycles Sampling: ${current}/${total}`);
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
          try { child.kill('SIGKILL'); } catch {}
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          reject(new Error(`Render timed out after ${this.timeoutMs / 1000} seconds.`));
        }, this.timeoutMs);

        child.on('close', (code) => {
          clearTimeout(timer);
          const durationSec = (Date.now() - startTime) / 1000;

          if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100) {
            const stats = fs.statSync(outputPath);
            resolve({
              success: true,
              outputPath,
              fileSizeBytes: stats.size,
              outputSizeBytes: stats.size,
              durationSeconds: durationSec,
              durationMs: Math.round(durationSec * 1000),
              device: this.device,
              threads: this.threads,
              simulated: false,
              memoryPeakMb: Math.round((process.memoryUsage().rss - startMem.rss) / (1024 * 1024))
            });
          } else {
            if (fs.existsSync(outputPath)) {
              try { fs.unlinkSync(outputPath); } catch {}
            }
            reject(new Error(`Blender exited with code ${code}. Stderr: ${stderrData || stdoutData.slice(-400)}`));
          }
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
          }
          reject(err);
        });
      });
    }

    // 2. Realistic Simulation Mode (when Blender is not installed locally on development machine)
    // Generates a valid test JPEG image and benchmark statistics
    return new Promise((resolve) => {
      // Create a minimal 1x1 or test JPEG buffer
      const dummyJpegBuffer = Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        'base64'
      );
      fs.writeFileSync(outputPath, dummyJpegBuffer);

      // Report staged progress
      if (onProgress) {
        onProgress(30, 'Cycles Scene Initialized (Simulated CPU)');
        setTimeout(() => onProgress(75, 'Rendering 32 Samples on CPU...'), 50);
        setTimeout(() => onProgress(100, 'Denoising Pass Complete'), 100);
      }

      setTimeout(() => {
        resolve({
          success: true,
          outputPath,
          fileSizeBytes: dummyJpegBuffer.length,
          outputSizeBytes: dummyJpegBuffer.length,
          durationSeconds: 1.25,
          durationMs: 1250,
          device: 'CPU (Simulated Bench)',
          threads: 1,
          simulated: true,
          memoryPeakMb: 42
        });
      }, 120);
    });
  }
}

module.exports = { BlenderRunner };

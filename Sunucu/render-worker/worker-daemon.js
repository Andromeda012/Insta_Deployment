/**
 * GLOBAL MOBİLYA — MODÜL 8 RENDER WORKER DAEMON
 * ============================================================================
 * Autonomous production worker daemon decoupled from the social publisher.
 * Polls Module 8 API queue, checks host load, renders via BlenderRunner,
 * uploads outputs to Supabase Storage, and completes jobs.
 * ============================================================================
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { RenderWorkerClient } = require('./worker-client.cjs');
const { BlenderRunner } = require('./blender-runner.js');

class RenderWorkerDaemon {
  constructor(config = {}) {
    this.apiBaseUrl = config.apiBaseUrl || process.env.API_BASE_URL || 'http://localhost:3000';
    this.workerKey = config.workerKey || process.env.RENDER_WORKER_KEY || '';
    this.pollIntervalMs = config.pollIntervalMs || 10000;
    this.maxLoadAvg = config.maxLoadAvg || 2.5; // Guard VPS publisher!
    this.minFreeMemMb = config.minFreeMemMb || 256; // 256MB headroom
    this.isRunning = false;

    this.client = new RenderWorkerClient({
      baseUrl: this.apiBaseUrl,
      workerKey: this.workerKey,
      workerId: `vps-worker-${os.hostname()}-${process.pid}`,
      supportedEngines: ['blender_headless', 'ffmpeg_transcoder']
    });

    this.runner = new BlenderRunner({
      device: process.env.BLENDER_DEVICE || 'CPU',
      threads: 1
    });
  }

  /**
   * Health & Host Resource Guard
   * Protects the social media publisher container from being starved of CPU or RAM.
   */
  isHostHealthy() {
    const freeMemMb = os.freemem() / (1024 * 1024);
    if (freeMemMb < this.minFreeMemMb) {
      console.warn(`[WORKER GUARD] Low free memory (${Math.round(freeMemMb)} MB < ${this.minFreeMemMb} MB). Skipping job claim.`);
      return false;
    }

    const load1m = os.loadavg()[0];
    if (load1m > this.maxLoadAvg) {
      console.warn(`[WORKER GUARD] Host CPU load is high (${load1m.toFixed(2)} > ${this.maxLoadAvg}). Backing off.`);
      return false;
    }

    // Disk write probe to verify /tmp filesystem has space and is writable
    try {
      const probePath = path.join(os.tmpdir(), `probe_${process.pid}.tmp`);
      fs.writeFileSync(probePath, 'probe');
      fs.unlinkSync(probePath);
    } catch (diskErr) {
      console.warn(`[WORKER GUARD] Disk /tmp probe failed (low disk space or read-only):`, diskErr.message);
      return false;
    }

    return true;
  }

  /**
   * Process a Single Job
   */
  async processJob(job) {
    console.log(`[WORKER] Starting execution of job: ${job.id} (${job.production_type} on ${job.selected_engine})`);
    const outputPath = path.join(os.tmpdir(), `output_${job.id}.jpg`);

    try {
      // 1. Initial heartbeat
      await this.client.updateProgress(job.id, 10, 'rendering', 'Render Worker başlatıldı.');

      // 2. Prepare render options
      const params = job.config_params || {};
      const samples = params.samples || 32;
      const resolution = params.resolution === '1920x1080' ? 1080 : 800;

      // 3. Execute Blender render
      const renderResult = await this.runner.renderScene(
        { samples, resolution, outputPath },
        async (percent, message) => {
          // Throttled progress report
          await this.client.updateProgress(job.id, percent, 'rendering', message).catch(() => null);
        }
      );

      console.log(`[WORKER] Render finished in ${renderResult.durationSeconds}s. Size: ${renderResult.fileSizeBytes} bytes.`);

      // 4. Read rendered file
      const fileBytes = fs.readFileSync(outputPath);
      const fileBase64 = fileBytes.toString('base64');

      // 5. Upload rendered image to Supabase Storage via Module 8 safe upload API
      const safeSlug = job.product_slug || job.collection_id || 'general';
      const uploadRes = await fetch(`${this.apiBaseUrl}/api/module8?action=upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-key': this.workerKey
        },
        body: JSON.stringify({
          file_base64: fileBase64,
          file_name: `render_${job.id}.jpg`,
          mime_type: 'image/jpeg',
          asset_type: 'render_frame',
          product_slug: job.product_slug,
          collection_id: job.collection_id,
          source_asset_id: job.source_asset_id,
          metadata: {
            samples,
            resolution: `${resolution}x${resolution}`,
            device: renderResult.device,
            durationSeconds: renderResult.durationSeconds
          }
        })
      });

      const uploadData = await uploadRes.json();
      const storagePath = uploadData?.asset?.storage_path || `studio/render_frame/${safeSlug}/render_${job.id}.jpg`;
      const publicUrl = uploadData?.asset?.public_url || '';

      // 6. Complete Job
      const compRes = await this.client.completeJob(
        job.id,
        [
          {
            output_type: 'hero_still',
            storage_path: storagePath,
            public_url: publicUrl,
            file_name: `render_${job.id}.jpg`,
            file_format: 'jpg',
            resolution_label: `${resolution}x${resolution}`,
            duration_seconds: null
          }
        ],
        {
          gpu_seconds: renderResult.durationSeconds,
          cost_amount: 0.0050 // Minimal estimated CPU compute cost
        }
      );

      if (compRes?.error && compRes.error.includes('İptal')) {
        console.warn(`[WORKER] Job ${job.id} was cancelled by user during render.`);
      } else {
        console.log(`[WORKER] Successfully completed and registered job: ${job.id}`);
      }

      return true;

    } catch (err) {
      console.error(`[WORKER ERROR] Job ${job.id} failed:`, err.message);
      await this.client.failJob(job.id, 'RENDER_EXECUTION_FAILED', err.message, { stack: err.stack }).catch(() => null);
      return false;
    } finally {
      // Guaranteed temp file cleanup
      if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch {}
      }
    }
  }

  /**
   * Run Once (Single polling cycle)
   */
  async runCycle() {
    if (!this.isHostHealthy()) {
      return null;
    }

    try {
      const claimRes = await this.client.claimNextJob();
      if (claimRes?.ok && claimRes.job) {
        await this.processJob(claimRes.job);
        return claimRes.job;
      }
    } catch (err) {
      console.warn(`[WORKER] Poll error:`, err.message);
    }
    return null;
  }

  /**
   * Start Standalone Daemon Loop
   */
  async start() {
    this.isRunning = true;
    console.log(`[WORKER DAEMON] Started on ${this.client.workerId}. Polling ${this.apiBaseUrl}...`);

    while (this.isRunning) {
      await this.runCycle();
      await new Promise(r => setTimeout(r, this.pollIntervalMs));
    }
  }

  stop() {
    this.isRunning = false;
    console.log(`[WORKER DAEMON] Stopping gracefully...`);
  }
}

// Standalone execution entry point
if (require.main === module) {
  const daemon = new RenderWorkerDaemon();
  daemon.start().catch(console.error);

  process.on('SIGINT', () => { daemon.stop(); process.exit(0); });
  process.on('SIGTERM', () => { daemon.stop(); process.exit(0); });
}

module.exports = { RenderWorkerDaemon };

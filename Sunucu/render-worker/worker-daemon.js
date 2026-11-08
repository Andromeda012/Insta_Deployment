/**
 * GLOBAL MOBİLYA — MODÜL 8 RENDER WORKER DAEMON (PRODUCTION HARDENED)
 * ============================================================================
 * Autonomous headless render worker decoupled from the social publisher.
 * Enforces:
 * - Mandatory production config & Blender binary verification
 * - Real 3D scene input validation (no fake benchmark fallback for products)
 * - UUID temporary paths & path traversal protection
 * - Verified Storage upload before job completion (zero fake storage paths)
 * - Accurate width x height metadata & honest CPU metrics (gpu_seconds: 0)
 * ============================================================================
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { RenderWorkerClient, sanitizeSecret } = require('./worker-client.cjs');
const {
  BlenderRunner,
  validateSafeFilePath,
  parseAndValidateResolution,
  validateSamples,
  inspectMp4VideoBuffer,
  ALLOWED_MODEL_EXTENSIONS
} = require('./blender-runner.js');

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB max safe memory buffer for upload

class RenderWorkerDaemon {
  constructor(config = {}) {
    this.nodeEnv = config.nodeEnv || process.env.NODE_ENV || 'development';
    this.isProduction = this.nodeEnv === 'production';

    const rawApiUrl = config.apiBaseUrl !== undefined
      ? config.apiBaseUrl
      : (process.env.API_BASE_URL !== undefined ? process.env.API_BASE_URL : (this.isProduction ? '' : 'http://localhost:3000'));

    this.apiBaseUrl = String(rawApiUrl || '').trim().replace(/\/+$/, '');
    this.workerKey = String(config.workerKey !== undefined ? config.workerKey : (process.env.RENDER_WORKER_KEY || '')).trim();
    this.pollIntervalMs = Number(config.pollIntervalMs || process.env.POLL_INTERVAL_MS || 10000);
    this.maxLoadAvg = Number(config.maxLoadAvg || process.env.MAX_LOAD_AVG || 1.5); // Conservative for 1 vCPU VPS
    this.minFreeMemMb = Number(config.minFreeMemMb || process.env.MIN_FREE_MEM_MB || 350); // Protect publisher RAM
    this.tempDir = config.tempDir || os.tmpdir();
    this.isRunning = false;
    this.activeJobId = null;
    this.processedJobIds = new Set();

    // Simulation uploads are strictly forbidden in production
    this.allowSimulatedUploads = !this.isProduction && config.allowSimulatedUploads === true;

    this.client = config.client || new RenderWorkerClient({
      nodeEnv: this.nodeEnv,
      baseUrl: this.apiBaseUrl,
      workerKey: this.workerKey,
      workerId: config.workerId || `vps-worker-${os.hostname()}-${process.pid}`,
      supportedEngines: ['blender_headless'],
      enforceValidation: this.isProduction || config.enforceValidation === true,
      fetchImpl: config.fetchImpl
    });

    this.runner = config.runner || new BlenderRunner({
      nodeEnv: this.nodeEnv,
      blenderBin: config.blenderBin || process.env.BLENDER_BIN || 'blender',
      device: 'CPU',
      threads: 1,
      timeoutMs: config.timeoutMs || process.env.RENDER_TIMEOUT_MS || 300000,
      allowSimulation: !this.isProduction && config.allowSimulation === true,
      allowedTempDir: this.tempDir,
      requireBinaryInProduction: this.isProduction
    });

    if (this.isProduction || config.enforceValidation === true) {
      this.validateStartup();
    }
  }

  /**
   * Validates that all required configuration and runtime binaries exist before starting
   */
  validateStartup() {
    this.client.validateConfig();

    if (this.isProduction) {
      if (this.runner.allowSimulation || process.env.RENDER_SIMULATION_MODE === 'true') {
        // Ensure simulation flag is forcibly off in production
        this.runner.allowSimulation = false;
      }
      if (!this.runner.isBlenderAvailable) {
        throw new Error(
          'WORKER_STARTUP_BLOCKED: Blender binary is not available on this host. Production worker cannot start without Blender.'
        );
      }
    }

    return true;
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
      const probePath = path.join(this.tempDir, `probe_${process.pid}_${crypto.randomUUID().slice(0, 8)}.tmp`);
      fs.writeFileSync(probePath, 'probe');
      fs.unlinkSync(probePath);
    } catch (diskErr) {
      console.warn(`[WORKER GUARD] Disk /tmp probe failed (low disk space or read-only):`, diskErr.message);
      return false;
    }

    return true;
  }

  /**
   * Validates the job's scene & 3D asset input.
   * Benchmark cube scene is NEVER used as a fallback for real product jobs.
   */
  resolveAndValidateSceneInput(job) {
    if (!job || typeof job !== 'object') {
      throw new Error('UNSUPPORTED_SCENE_INPUT: Job payload is missing or invalid.');
    }

    const params = {
      ...(job.config_params || {}),
      ...(job.parameters || {}),
      ...(job.render_settings || {})
    };
    const rawInputPath =
      job.input_model_path ||
      params.input_model_path ||
      params.model_path ||
      params.scene_file ||
      job.source_asset?.local_path ||
      job.three_d_asset?.local_path ||
      '';

    const isExplicitBenchmark =
      job.production_type === 'benchmark_test' ||
      params.mode === 'benchmark' ||
      params.is_benchmark === true ||
      rawInputPath === 'benchmark://cube' ||
      rawInputPath === 'benchmark';

    if (isExplicitBenchmark) {
      if (job.product_slug || job.collection_id) {
        throw new Error(
          'UNSUPPORTED_SCENE_INPUT: Benchmark mode cannot be used to fabricate renders for real catalog products or collections.'
        );
      }
      return { mode: 'benchmark', modelPath: '' };
    }

    // Real production job: must have a validated 3D model input (.glb, .gltf, .obj, .fbx, .blend)
    const candidatePath = rawInputPath;
    const candidateType = job.source_asset?.asset_type || params.asset_type || '';
    if (candidateType && !['3d_model', 'blender_project', ''].includes(candidateType)) {
      throw new Error(
        `UNSUPPORTED_SCENE_INPUT: Source asset type '${candidateType}' is not a valid 3D model or scene.`
      );
    }

    if (!candidatePath || typeof candidatePath !== 'string') {
      throw new Error(
        'UNSUPPORTED_SCENE_INPUT: Real product render requires a verified 3D model file (.glb, .gltf, .obj, .fbx, .blend). No 3D asset is attached to this job.'
      );
    }

    const safeModelPath = validateSafeFilePath(candidatePath, params.allowed_model_dir || null);
    const ext = path.extname(safeModelPath).toLowerCase();
    if (!ALLOWED_MODEL_EXTENSIONS.has(ext)) {
      throw new Error(
        `UNSUPPORTED_SCENE_INPUT: File extension '${ext}' is not supported for 3D rendering.`
      );
    }

    if (!fs.existsSync(safeModelPath) || !fs.statSync(safeModelPath).isFile()) {
      throw new Error(
        `UNSUPPORTED_SCENE_INPUT: Referenced 3D model file does not exist or is not readable.`
      );
    }

    return { mode: 'product', modelPath: safeModelPath };
  }

  /**
   * Process a Single Job with Strict Validation
   */
  async processJob(job) {
    const jobId = job?.id || job?.job_id;
    if (!job || !jobId || typeof jobId !== 'string') {
      throw new Error('INVALID_JOB: Job object is missing a valid id.');
    }
    job.id = jobId;

    // Prevent duplicate or concurrent processing of the same job
    if (this.activeJobId) {
      throw new Error(`WORKER_BUSY: Already processing job ${this.activeJobId}.`);
    }

    // Explicitly refuse AI 3D reconstruction jobs (Tripo H3.1) so Blender Worker never interferes
    if (
      job.selected_engine === 'ai_3d_recon' ||
      ['3d_reconstruction', 'image_to_3d', 'photogrammetry'].includes(job.production_type)
    ) {
      console.warn(`[WORKER] Skipping AI 3D Reconstruction job (${job.id}) — handled by Tripo H3.1 Reconstruction Engine, not Blender Worker.`);
      return false;
    }

    const attemptKey = `${job.id}:attempt:${Number(job.retry_count || 0)}`;
    if (this.processedJobIds.has(job.id) || this.processedJobIds.has(attemptKey) || ['completed', 'cancelled', 'failed'].includes(job.status)) {
      console.warn(`[WORKER] Skipping already processed or terminal job: ${job.id} (status: ${job.status})`);
      return false;
    }

    this.activeJobId = job.id;
    const rawParams = {
      ...(job.config_params || {}),
      ...(job.parameters || {}),
      ...(job.render_settings || {})
    };
    const isVideoJob =
      job.production_type === 'multi_platform_video' ||
      job.jobType === 'multi_platform_video' ||
      rawParams.is_video_render === true ||
      rawParams.output_format === 'mp4';

    // Generate a clean cryptographic UUID for temp file — NEVER use raw job.id in file paths!
    const fileUuid = crypto.randomUUID();
    const safeFileName = isVideoJob
      ? `video_${rawParams.platform || 'website'}_${fileUuid}.mp4`
      : `render_${fileUuid}.jpg`;
    const outputPath = validateSafeFilePath(path.join(this.tempDir, safeFileName), this.tempDir);
    const previewFramePath = isVideoJob
      ? validateSafeFilePath(path.join(this.tempDir, `preview_${fileUuid}.jpg`), this.tempDir)
      : null;

    try {
      // 1. Validate scene input first (rejects missing/unsupported 3D inputs immediately)
      let sceneSpec;
      try {
        sceneSpec = this.resolveAndValidateSceneInput(job);
      } catch (sceneErr) {
        await this.client.failJob(job.id, 'unsupported_input', sceneErr.message, {
          reason: 'UNSUPPORTED_SCENE_INPUT',
          production_type: job.production_type
        }).catch(() => null);
        return false;
      }

      // 2. Validate render parameters (width, height, samples)
      const params = rawParams;
      let dimensions;
      let samples;
      try {
        dimensions = parseAndValidateResolution({
          width: params.width,
          height: params.height,
          resolution: params.resolution || '1080x1080'
        });
        samples = validateSamples(params.samples !== undefined ? params.samples : 32);
      } catch (paramErr) {
        await this.client.failJob(job.id, 'invalid_parameters', paramErr.message, {
          reason: 'INVALID_RENDER_PARAMETERS'
        }).catch(() => null);
        return false;
      }

      // 3. Initial heartbeat -> status 'processing'
      await this.client.updateProgress(job.id, 10, 'processing', 'Render Worker doğrulandı ve sahne işlenmeye başlandı.');

      // 4. Execute Blender render (Video MP4 or Still JPEG)
      const renderResult = isVideoJob
        ? await this.runner.renderPlatformVideo(
            {
              project_id: params.project_id || 'vproj_default',
              platform: params.platform || 'website',
              aspect_ratio: params.aspect_ratio || (dimensions.width > dimensions.height ? '16:9' : '9:16'),
              sensor_fit: params.sensor_fit || (dimensions.width > dimensions.height ? 'HORIZONTAL' : 'VERTICAL'),
              input_blend_path: sceneSpec.modelPath,
              output_mp4_path: outputPath,
              preview_frame_path: previewFramePath,
              width_px: dimensions.width,
              height_px: dimensions.height,
              fps: params.fps || 24,
              samples,
              frame_start: params.frame_start || 1,
              frame_end: params.frame_end || 24,
              total_frames: params.total_frames || 24,
              duration_sec: params.duration_sec || 4.0,
              shots: params.shots || [],
              master_keyframes: params.master_keyframes || [],
              editing_settings: params.editing_settings || {}
            },
            async (percent, message) => {
              await this.client.updateProgress(job.id, percent, 'processing', message).catch(() => null);
            }
          )
        : await this.runner.renderScene(
            {
              mode: sceneSpec.mode,
              modelPath: sceneSpec.modelPath,
              samples,
              width: dimensions.width,
              height: dimensions.height,
              outputPath
            },
            async (percent, message) => {
              await this.client.updateProgress(job.id, percent, 'processing', message).catch(() => null);
            }
          );

      // 5. Reject simulated outputs from being uploaded as real production assets
      if (renderResult.simulated && (this.isProduction || !this.allowSimulatedUploads)) {
        throw new Error(
          'SIMULATION_OUTPUT_REJECTED: Simulated render outputs cannot be uploaded to Storage or recorded as completed jobs.'
        );
      }

      // 6. Verify output file on disk before upload
      if (!fs.existsSync(outputPath)) {
        throw new Error('RENDER_OUTPUT_MISSING: Expected output file does not exist on disk.');
      }
      const stats = fs.statSync(outputPath);
      if (stats.size < 36 || stats.size > MAX_UPLOAD_BYTES) {
        throw new Error(`RENDER_OUTPUT_SIZE_INVALID: Output size (${stats.size} bytes) is outside safe upload bounds.`);
      }

      const fileBytes = fs.readFileSync(outputPath);
      if (isVideoJob) {
        const mp4Check = inspectMp4VideoBuffer(fileBytes);
        if (!mp4Check.valid) {
          throw new Error(`RENDER_OUTPUT_INVALID_MP4: ${mp4Check.reason}`);
        }
      } else {
        // Verify JPEG SOI magic bytes (0xFF 0xD8 0xFF)
        if (fileBytes.length < 3 || fileBytes[0] !== 0xFF || fileBytes[1] !== 0xD8 || fileBytes[2] !== 0xFF) {
          throw new Error('RENDER_OUTPUT_INVALID_JPEG: Output file failed JPEG header signature verification.');
        }
      }

      const fileBase64 = fileBytes.toString('base64');

      // 7. Transition job status to 'uploading' before Storage upload
      await this.client.updateProgress(job.id, 90, 'uploading', 'Render tamamlandı; çıktı Supabase Storage\'a yükleniyor...');

      // 8. Upload rendered asset via RenderWorkerClient with job_id correlation & duplicate protection
      const uploadData = await this.client.uploadAsset({
        job_id: job.id,
        file_base64: fileBase64,
        file_name: safeFileName,
        mime_type: isVideoJob ? 'video/mp4' : 'image/jpeg',
        expected_size_bytes: stats.size,
        asset_type: isVideoJob ? 'video_render' : 'render_frame',
        custom_storage_path: params.video_storage_path || null,
        product_slug: job.product_slug || null,
        collection_id: job.collection_id || null,
        source_asset_id: job.source_asset_id || null,
        metadata: {
          job_id: job.id,
          platform: params.platform || null,
          samples,
          width: dimensions.width,
          height: dimensions.height,
          resolution: dimensions.label,
          fps: isVideoJob ? (params.fps || 24) : null,
          duration_sec: isVideoJob ? (params.duration_sec || null) : null,
          encoding_format: isVideoJob ? 'mp4' : 'jpg',
          device: 'CPU',
          threads: renderResult.threads || 1,
          cpu_seconds: renderResult.durationSeconds,
          simulated: false,
          mode: sceneSpec.mode
        }
      });

      const verifiedAsset = uploadData.asset;

      // 9. Complete Job ONLY after upload has been 100% verified (records output_render_path & output_public_url)
      const compRes = await this.client.completeJob(
        job.id,
        [
          {
            asset_id: verifiedAsset.id,
            output_type: isVideoJob ? 'platform_video' : 'hero_still',
            platform: params.platform || null,
            storage_path: verifiedAsset.storage_path,
            public_url: verifiedAsset.public_url || '',
            file_name: verifiedAsset.file_name || safeFileName,
            file_format: isVideoJob ? 'mp4' : 'jpg',
            file_size_bytes: stats.size,
            width_px: dimensions.width,
            height_px: dimensions.height,
            resolution_label: dimensions.label,
            duration_seconds: isVideoJob ? (params.duration_sec || null) : null
          }
        ],
        {
          compute_device: 'CPU',
          cpu_seconds: renderResult.durationSeconds,
          gpu_seconds: 0,
          cost_amount: null,
          cost_measured: false
        },
        {
          output_render_path: verifiedAsset.storage_path,
          output_public_url: verifiedAsset.public_url || ''
        }
      );

      this.processedJobIds.add(job.id);
      this.processedJobIds.add(attemptKey);

      if (compRes?.error && compRes.error.includes('İptal')) {
        console.warn(`[WORKER] Job ${job.id} was cancelled by user during render.`);
      } else {
        console.log(`[WORKER] Successfully completed and verified job: ${job.id} (asset: ${verifiedAsset.id}, path: ${verifiedAsset.storage_path})`);
      }

      return true;
    } catch (err) {
      const safeErrMsg = sanitizeSecret(err.message, this.workerKey);
      console.error(`[WORKER ERROR] Job ${job.id} failed:`, safeErrMsg);
      await this.client.failJob(job.id, 'RENDER_EXECUTION_FAILED', safeErrMsg).catch(() => null);
      return false;
    } finally {
      this.activeJobId = null;
      if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch {}
      }
      if (previewFramePath && fs.existsSync(previewFramePath)) {
        try { fs.unlinkSync(previewFramePath); } catch {}
      }
    }
  }

  /**
   * Run Once (Single polling cycle)
   */
  async runCycle() {
    if (this.activeJobId || !this.isHostHealthy()) {
      return null;
    }

    try {
      const claimRes = await this.client.claimNextJob();
      if (claimRes?.ok && claimRes.job) {
        await this.processJob(claimRes.job);
        return claimRes.job;
      }
    } catch (err) {
      console.warn(`[WORKER] Poll error:`, sanitizeSecret(err.message, this.workerKey));
    }
    return null;
  }

  /**
   * Start Standalone Daemon Loop
   */
  async start() {
    this.validateStartup();
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
  try {
    const daemon = new RenderWorkerDaemon({ enforceValidation: true });
    daemon.start().catch(err => {
      console.error('[WORKER FATAL]', err.message);
      process.exit(1);
    });

    process.on('SIGINT', () => { daemon.stop(); process.exit(0); });
    process.on('SIGTERM', () => { daemon.stop(); process.exit(0); });
  } catch (startupErr) {
    console.error('[WORKER STARTUP FATAL]', startupErr.message);
    process.exit(1);
  }
}

module.exports = { RenderWorkerDaemon };

/**
 * GLOBAL MOBİLYA — MODULE 8 RENDER WORKER CLIENT LIBRARY
 * Standalone worker client implementing the production worker communication contract
 */
'use strict';

class RenderWorkerClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || 'http://localhost:3000').replace(/\/+$/, '');
    this.workerKey = options.workerKey || process.env.RENDER_WORKER_KEY || '';
    this.workerId = options.workerId || `worker-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
    this.supportedEngines = options.supportedEngines || ['blender_headless', 'ffmpeg_transcoder'];
  }

  async _request(action, body = null, method = 'POST') {
    const url = `${this.baseUrl}/api/module8?action=${encodeURIComponent(action)}`;
    const headers = {
      'Content-Type': 'application/json',
      'x-worker-key': this.workerKey
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    return await res.json();
  }

  // 1. Claim Job
  async claimNextJob() {
    return await this._request('worker-claim', {
      worker_id: this.workerId,
      supported_engines: this.supportedEngines
    });
  }

  // 2. Update Progress / Heartbeat
  async updateProgress(jobId, progressPercent, currentPhase, statusMessage = '') {
    return await this._request('worker-update', {
      job_id: jobId,
      progress_percent: progressPercent,
      current_phase: currentPhase,
      status_message: statusMessage
    });
  }

  // 3. Complete Job
  async completeJob(jobId, outputs = [], metrics = {}) {
    return await this._request('worker-complete', {
      job_id: jobId,
      outputs,
      metrics
    });
  }

  // 4. Fail Job
  async failJob(jobId, errorCode, errorMessage, errorDetails = null) {
    return await this._request('worker-fail', {
      job_id: jobId,
      error_code: errorCode,
      error_message: errorMessage,
      error_details: errorDetails
    });
  }
}

module.exports = { RenderWorkerClient };

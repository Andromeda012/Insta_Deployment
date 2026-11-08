/**
 * GLOBAL MOBİLYA — MODULE 8 RENDER WORKER CLIENT LIBRARY (PRODUCTION HARDENED)
 * ============================================================================
 * Enforces mandatory API_BASE_URL and RENDER_WORKER_KEY in production,
 * request timeouts, controlled retries, JSON schema validation, worker_id
 * ownership binding, and secret log sanitization.
 * ============================================================================
 */
'use strict';

function sanitizeSecret(msg, secret, extraSecrets = []) {
  if (!msg || typeof msg !== 'string') return '';
  let cleaned = msg
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/apikey[=:]\s*[A-Za-z0-9\-._~+/]+=*/gi, 'apikey=[REDACTED_KEY]');
  const secrets = [secret, process.env.RENDER_WORKER_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY, ...extraSecrets].filter(
    s => typeof s === 'string' && s.trim().length >= 4
  );
  for (const sec of secrets) {
    cleaned = cleaned.split(sec.trim()).join('[REDACTED_WORKER_KEY]');
  }
  return cleaned;
}

function isLocalhostUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
  } catch {
    return true;
  }
}

class RenderWorkerClient {
  constructor(options = {}) {
    this.nodeEnv = options.nodeEnv || process.env.NODE_ENV || 'development';
    this.isProduction = this.nodeEnv === 'production';

    const rawBaseUrl = options.baseUrl !== undefined
      ? options.baseUrl
      : (process.env.API_BASE_URL !== undefined ? process.env.API_BASE_URL : (this.isProduction ? '' : 'http://localhost:3000'));

    this.baseUrl = String(rawBaseUrl || '').trim().replace(/\/+$/, '');
    this.workerKey = String(options.workerKey !== undefined ? options.workerKey : (process.env.RENDER_WORKER_KEY || '')).trim();
    this.supabaseUrl = String(options.supabaseUrl !== undefined ? options.supabaseUrl : (process.env.SUPABASE_URL || '')).trim().replace(/\/+$/, '');
    this.supabaseServiceRoleKey = String(
      options.supabaseServiceRoleKey !== undefined
        ? options.supabaseServiceRoleKey
        : (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    ).trim();
    this.storageBucket = String(options.storageBucket || process.env.SUPABASE_STORAGE_BUCKET || 'media').trim();

    this.workerId = options.workerId || `worker-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
    this.supportedEngines = options.supportedEngines || ['blender_headless', 'ffmpeg_transcoder'];
    this.leaseSeconds = Number(options.leaseSeconds || process.env.WORKER_LEASE_SECONDS || 360);
    this.timeoutMs = Number(options.timeoutMs || process.env.WORKER_API_TIMEOUT_MS || 30000);
    this.maxRetries = options.maxRetries !== undefined ? Number(options.maxRetries) : 2;
    this.uploadMaxRetries = options.uploadMaxRetries !== undefined ? Number(options.uploadMaxRetries) : Math.max(3, this.maxRetries);
    this.retryDelayMs = Number(options.retryDelayMs || 300);
    this.fetchImpl = options.fetchImpl || globalThis.fetch;

    if (this.isProduction || options.enforceValidation === true) {
      this.validateConfig();
    }
  }

  validateConfig() {
    if (!this.baseUrl) {
      throw new Error('WORKER_CONFIG_ERROR: API_BASE_URL is required and cannot be empty.');
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(this.baseUrl);
    } catch {
      throw new Error(`WORKER_CONFIG_ERROR: API_BASE_URL '${this.baseUrl}' is not a valid URL.`);
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`WORKER_CONFIG_ERROR: Unsupported URL protocol '${parsedUrl.protocol}'.`);
    }

    if (this.isProduction) {
      if (isLocalhostUrl(this.baseUrl)) {
        throw new Error('WORKER_CONFIG_ERROR: Localhost API_BASE_URL is forbidden in production.');
      }
      if (!this.workerKey || this.workerKey.length < 16) {
        throw new Error('WORKER_CONFIG_ERROR: RENDER_WORKER_KEY is required and must be at least 16 characters in production.');
      }
    } else if (!this.workerKey || this.workerKey.length < 8) {
      throw new Error('WORKER_CONFIG_ERROR: RENDER_WORKER_KEY is missing or too short.');
    }

    return true;
  }

  async _request(action, body = null, method = 'POST', customMaxRetries = null) {
    if (!this.baseUrl) {
      throw new Error('WORKER_CONFIG_ERROR: API_BASE_URL is missing.');
    }
    if (!this.workerKey) {
      throw new Error('WORKER_CONFIG_ERROR: RENDER_WORKER_KEY is missing.');
    }

    const url = `${this.baseUrl}/api/module8?action=${encodeURIComponent(action)}`;
    const headers = {
      'Content-Type': 'application/json',
      'x-worker-key': this.workerKey
    };

    const effectiveMaxRetries = customMaxRetries !== null ? customMaxRetries : this.maxRetries;
    let lastError = null;
    for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await this.fetchImpl(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });
        clearTimeout(timer);

        const rawText = await res.text();
        let data;
        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch {
          throw new Error(`WORKER_API_INVALID_JSON: Non-JSON response from ${action} (HTTP ${res.status}).`);
        }

        if (!data || typeof data !== 'object') {
          throw new Error(`WORKER_API_EMPTY_RESPONSE: Empty or malformed payload from ${action} (HTTP ${res.status}).`);
        }

        if (res.status === 401 || res.status === 403) {
          const err = new Error(`WORKER_AUTH_ERROR: HTTP ${res.status} - ${data.error || 'Unauthorized worker request'}`);
          err.statusCode = res.status;
          err.nonRetryable = true;
          throw err;
        }

        if (res.status >= 500 || res.status === 429) {
          const err = new Error(`WORKER_SERVER_ERROR: HTTP ${res.status} - ${data.error || 'Internal server error'}`);
          err.statusCode = res.status;
          throw err;
        }

        if (!res.ok) {
          const err = new Error(`WORKER_HTTP_ERROR: HTTP ${res.status} - ${data.error || 'Request rejected'}`);
          err.statusCode = res.status;
          err.responseData = data;
          err.nonRetryable = true;
          throw err;
        }

        return data;
      } catch (err) {
        clearTimeout(timer);
        const cleanMessage = sanitizeSecret(
          err.name === 'AbortError'
            ? `WORKER_API_TIMEOUT: Request to ${action} timed out after ${this.timeoutMs}ms.`
            : err.message,
          this.workerKey,
          [this.supabaseServiceRoleKey]
        );
        lastError = new Error(cleanMessage);
        lastError.statusCode = err.statusCode;
        lastError.responseData = err.responseData;

        if (err.nonRetryable || attempt >= effectiveMaxRetries) {
          throw lastError;
        }

        const backoff = this.retryDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, backoff));
      }
    }

    throw lastError;
  }

  // 1. Atomic Claim Job (supports lease_seconds & claim_status)
  async claimNextJob(options = {}) {
    return await this._request('worker-claim', {
      worker_id: this.workerId,
      supported_engines: this.supportedEngines,
      lease_seconds: options.leaseSeconds || this.leaseSeconds,
      claim_status: options.claimStatus || null
    });
  }

  // 2. Update Progress / Heartbeat (with worker_id ownership & lease renewal)
  async updateProgress(jobId, progressPercent, currentPhase, statusMessage = '') {
    return await this._request('worker-update', {
      job_id: jobId,
      worker_id: this.workerId,
      progress_percent: progressPercent,
      current_phase: currentPhase,
      status_message: statusMessage,
      lease_seconds: this.leaseSeconds
    });
  }

  // 3. Complete Job (with worker_id ownership & output_render_path)
  async completeJob(jobId, outputs = [], metrics = {}, extra = {}) {
    const primaryOutput = Array.isArray(outputs) && outputs[0] ? outputs[0] : null;
    return await this._request('worker-complete', {
      job_id: jobId,
      worker_id: this.workerId,
      outputs,
      metrics,
      output_render_path: extra.output_render_path || primaryOutput?.storage_path || null,
      output_public_url: extra.output_public_url || primaryOutput?.public_url || null
    });
  }

  // 4. Fail Job (with worker_id ownership)
  async failJob(jobId, errorCode, errorMessage, errorDetails = null) {
    return await this._request('worker-fail', {
      job_id: jobId,
      worker_id: this.workerId,
      error_code: errorCode,
      error_message: sanitizeSecret(errorMessage, this.workerKey, [this.supabaseServiceRoleKey]),
      error_details: errorDetails
    });
  }

  // 5. Verified Asset Upload with Controlled Retries & Strict Response Schema Validation
  async uploadAsset(payload) {
    const data = await this._request('upload', payload, 'POST', this.uploadMaxRetries);

    if (!data || data.ok !== true || !data.asset || typeof data.asset !== 'object') {
      throw new Error(`UPLOAD_SCHEMA_INVALID: API did not return a valid asset object (${data?.error || 'missing asset'}).`);
    }

    const { asset } = data;
    if (!asset.id || typeof asset.id !== 'string' || asset.id.trim().length < 4) {
      throw new Error('UPLOAD_SCHEMA_INVALID: Returned asset is missing a valid asset.id.');
    }

    if (
      !asset.storage_path ||
      typeof asset.storage_path !== 'string' ||
      !asset.storage_path.startsWith('studio/') ||
      asset.storage_path.includes('..')
    ) {
      throw new Error(`UPLOAD_SCHEMA_INVALID: Returned asset has an invalid storage_path '${asset.storage_path}'.`);
    }

    if (payload.mime_type && asset.mime_type !== payload.mime_type) {
      throw new Error(`UPLOAD_SCHEMA_INVALID: Asset MIME mismatch (expected ${payload.mime_type}, got ${asset.mime_type}).`);
    }

    if (
      payload.expected_size_bytes !== undefined &&
      Number(asset.file_size_bytes) !== Number(payload.expected_size_bytes)
    ) {
      throw new Error(
        `UPLOAD_SCHEMA_INVALID: Asset size mismatch (expected ${payload.expected_size_bytes}, got ${asset.file_size_bytes}).`
      );
    }

    return data;
  }
}

module.exports = { RenderWorkerClient, sanitizeSecret, isLocalhostUrl };

/**
 * GLOBAL MOBİLYA — MODÜL 8 RENDER WORKER CONTAINER HEALTHCHECK
 * ============================================================================
 * Verifies:
 * 1. Required worker configuration (API_BASE_URL, RENDER_WORKER_KEY)
 * 2. Blender headless binary availability in production
 * 3. Host memory headroom & /tmp writable probe
 * ============================================================================
 */
'use strict';

const { RenderWorkerDaemon } = require('./worker-daemon.js');

try {
  const daemon = new RenderWorkerDaemon({
    nodeEnv: process.env.NODE_ENV || 'production',
    enforceValidation: true
  });

  if (!daemon.isHostHealthy()) {
    console.error('[HEALTHCHECK FAILED] Host memory/CPU/disk guard reported unhealthy state.');
    process.exit(1);
  }

  console.log(`[HEALTHCHECK OK] Blender: ${daemon.runner.blenderVersion || 'verified'} | Worker: ${daemon.client.workerId}`);
  process.exit(0);
} catch (err) {
  console.error('[HEALTHCHECK FAILED]', err.message);
  process.exit(1);
}

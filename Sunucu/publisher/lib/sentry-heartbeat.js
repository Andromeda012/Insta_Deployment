// ============================================================================
// NOVA FURNITURE — DIGITALOCEAN BACKGROUND WORKER SENTRY HEARTBEAT & HATA KÖPRÜSÜ
// Proje: nova-background-workers (de.sentry.io)
// ============================================================================

import crypto from 'node:crypto';
import os from 'node:os';

const DEFAULT_WORKER_SENTRY_DSN = 'https://84417b24b6b23a35a7d29233c0260df0@o4512471153246208.ingest.de.sentry.io/4512471159275600';

function parseDsn(dsnStr) {
  try {
    const u = new URL(dsnStr || process.env.SENTRY_DSN || DEFAULT_WORKER_SENTRY_DSN);
    const projectId = u.pathname.replace(/^\/+/, '');
    return {
      dsn: u.toString(),
      publicKey: u.username,
      envelopeUrl: `${u.protocol}//${u.host}/api/${projectId}/envelope/`
    };
  } catch (_) {
    return null;
  }
}

export async function captureWorkerException(error, { tags = {}, extra = {}, level = 'error' } = {}) {
  const parsed = parseDsn();
  if (!parsed) return false;
  try {
    const eventId = crypto.randomBytes(16).toString('hex');
    const errObj = error instanceof Error ? error : new Error(String(error || 'Worker Error'));
    const envHeader = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: parsed.dsn });
    const itemHeader = JSON.stringify({ type: 'event' });
    const payload = JSON.stringify({
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'node',
      level,
      environment: process.env.NODE_ENV || 'production',
      server_name: os.hostname(),
      tags: { service: 'nova-background-workers', host_provider: 'digitalocean', ...tags },
      extra,
      exception: {
        values: [{
          type: errObj.name || 'WorkerError',
          value: errObj.message || String(error),
          stacktrace: errObj.stack ? { frames: errObj.stack.split('\n').slice(1, 10).map(l => ({ filename: l.trim() })) } : undefined
        }]
      }
    });
    const res = await fetch(parsed.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=nova-do-worker/1.0`
      },
      body: `${envHeader}\n${itemHeader}\n${payload}`
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function sendWorkerCronCheckIn(monitorSlug, status = 'ok', { checkInId = null, durationSeconds = null } = {}) {
  const parsed = parseDsn();
  if (!parsed || !monitorSlug) return null;
  const id = checkInId || crypto.randomBytes(16).toString('hex');
  try {
    const envHeader = JSON.stringify({ sent_at: new Date().toISOString(), dsn: parsed.dsn });
    const itemHeader = JSON.stringify({ type: 'check_in' });
    const payload = JSON.stringify({
      check_in_id: id,
      monitor_slug: monitorSlug,
      status,
      environment: process.env.NODE_ENV || 'production',
      ...(typeof durationSeconds === 'number' ? { duration: Number(durationSeconds.toFixed(2)) } : {})
    });
    await fetch(parsed.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=nova-do-cron/1.0`
      },
      body: `${envHeader}\n${itemHeader}\n${payload}`
    });
  } catch (_) {}
  return id;
}

export async function recordDigitalOceanHeartbeat(supabase, { workerId = 'do-nova-publisher', status = 'online', activeBots = ['instagram', 'facebook', 'tiktok', 'youtube'], extra = {} } = {}) {
  const nowIso = new Date().toISOString();
  const payload = {
    worker_id: workerId,
    host: os.hostname(),
    provider: 'DigitalOcean Single-Server',
    status,
    active_bots: activeBots,
    uptime_seconds: Math.round(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    timestamp: nowIso,
    ...extra
  };

  if (supabase) {
    try {
      await supabase.from('site_settings').upsert({
        key: 'do_worker_heartbeat',
        data: payload,
        updated_at: nowIso
      });
    } catch (_) {}
  }

  await sendWorkerCronCheckIn('do-scheduler-cron', status === 'error' ? 'error' : 'ok');
  return payload;
}

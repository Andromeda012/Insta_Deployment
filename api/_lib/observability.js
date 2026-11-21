// ============================================================================
// GLOBAL KAPAK MOBİLYA & NOVA FURNITURE — MERKEZİ GÖZLEMLENEBİLİRLİK MOTORU
// Faz 4: Sentry EU (de.sentry.io) Hata & Cron Heartbeat + PostHog EU (HogQL)
// Ürün/3D Analitiği + Cloudflare R2 & Supabase Kuyruk Sağlık Telemetrisi
// ============================================================================

import crypto from 'node:crypto';
import { headR2Object } from './r2-storage.js';

export const SENTRY_ORG_SLUG = (process.env.SENTRY_ORG_SLUG || 'global-kapak-mobilya').trim();
export const SENTRY_API_BASE = (process.env.SENTRY_API_BASE || 'https://de.sentry.io/api/0').replace(/\/+$/, '');
export const SENTRY_DSN_ERP = (
  process.env.SENTRY_DSN_ERP ||
  process.env.SENTRY_DSN ||
  'https://c32c91beaf289736261b4955e833dff2@o4512471153246208.ingest.de.sentry.io/4512471181361232'
).trim();
export const SENTRY_DSN_WORKERS = (
  process.env.SENTRY_DSN_WORKERS ||
  'https://84417b24b6b23a35a7d29233c0260df0@o4512471153246208.ingest.de.sentry.io/4512471159275600'
).trim();
export const SENTRY_DSN_B2C = (
  process.env.SENTRY_DSN_B2C ||
  'https://bc4bf8cf80c00fed21b340cef7474be4@o4512471153246208.ingest.de.sentry.io/4512471175331920'
).trim();

export const POSTHOG_HOST = (process.env.POSTHOG_HOST || 'https://eu.posthog.com').replace(/\/+$/, '');
export const POSTHOG_PROJECT_ID = (process.env.POSTHOG_PROJECT_ID || '361931').trim();
export const POSTHOG_PROJECT_API_KEY = (
  process.env.POSTHOG_PROJECT_API_KEY ||
  'phc_Crdjof4YyydPjfsUo7gSV6FrQRnbVZcY5ov85rfBqQNG'
).trim();

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function parseSentryDsn(dsn) {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, '');
    const publicKey = u.username;
    return {
      envelopeUrl: `${u.protocol}//${u.host}/api/${projectId}/envelope/`,
      dsn,
      publicKey,
      projectId
    };
  } catch (_) {
    return null;
  }
}

/**
 * Sıfır bağımlılıkla Sentry Envelope protokolü üzerinden hata bildirir.
 */
export async function captureSentryException(error, {
  dsn = SENTRY_DSN_ERP,
  level = 'error',
  tags = {},
  extra = {},
  environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'production'
} = {}) {
  const parsed = parseSentryDsn(dsn);
  if (!parsed) return false;

  try {
    const eventId = crypto.randomBytes(16).toString('hex');
    const nowIso = new Date().toISOString();
    const errObj = error instanceof Error ? error : new Error(String(error || 'Unknown error'));

    const envelopeHeader = JSON.stringify({
      event_id: eventId,
      sent_at: nowIso,
      dsn: parsed.dsn
    });
    const itemHeader = JSON.stringify({ type: 'event' });
    const itemPayload = JSON.stringify({
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'node',
      level,
      environment,
      tags: { service: 'nova-erp-api', ...tags },
      extra,
      exception: {
        values: [
          {
            type: errObj.name || 'Error',
            value: errObj.message || String(error),
            stacktrace: errObj.stack
              ? { frames: errObj.stack.split('\n').slice(1, 10).map(line => ({ filename: line.trim() })) }
              : undefined
          }
        ]
      }
    });

    const body = `${envelopeHeader}\n${itemHeader}\n${itemPayload}`;
    const res = await fetch(parsed.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=nova-observability/1.0`
      },
      body
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Sentry Cron Monitor (Heartbeat) Check-In sinyali gönderir.
 */
export async function sendSentryCronCheckIn(monitorSlug, status = 'ok', {
  dsn = SENTRY_DSN_WORKERS,
  checkInId = null,
  durationSeconds = null,
  environment = 'production'
} = {}) {
  const parsed = parseSentryDsn(dsn);
  if (!parsed || !monitorSlug) return null;

  const id = checkInId || crypto.randomBytes(16).toString('hex');
  try {
    const nowIso = new Date().toISOString();
    const envelopeHeader = JSON.stringify({ sent_at: nowIso, dsn: parsed.dsn });
    const itemHeader = JSON.stringify({ type: 'check_in' });
    const payload = {
      check_in_id: id,
      monitor_slug: monitorSlug,
      status,
      environment,
      ...(typeof durationSeconds === 'number' ? { duration: Number(durationSeconds.toFixed(2)) } : {})
    };
    const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(payload)}`;
    await fetch(parsed.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=nova-cron/1.0`
      },
      body
    });
  } catch (_) {}
  return id;
}

/**
 * Sentry REST API üzerinden 3 projenin (nova-b2c-web, nova-erp-api, nova-background-workers)
 * son 24 saatlik hata özetini ve Cron Monitor canlılık durumlarını çeker.
 */
export async function fetchSentryTelemetrySummary() {
  const authToken = (process.env.SENTRY_AUTH_TOKEN || '').trim();
  const t0 = Date.now();

  if (!authToken) {
    return {
      configured: false,
      latencyMs: 0,
      orgSlug: SENTRY_ORG_SLUG,
      projects: [],
      unresolvedCount: 0,
      recentIssues: [],
      monitors: [],
      note: 'SENTRY_AUTH_TOKEN ortam değişkeni Vercel üzerinde tanımlı değil.'
    };
  }

  const headers = { Authorization: `Bearer ${authToken}` };
  try {
    const [projRes, issuesRes, monitorsRes] = await Promise.all([
      fetch(`${SENTRY_API_BASE}/organizations/${SENTRY_ORG_SLUG}/projects/`, { headers }).catch(() => null),
      fetch(`${SENTRY_API_BASE}/organizations/${SENTRY_ORG_SLUG}/issues/?query=is:unresolved&statsPeriod=24h&limit=12`, { headers }).catch(() => null),
      fetch(`${SENTRY_API_BASE}/organizations/${SENTRY_ORG_SLUG}/monitors/`, { headers }).catch(() => null)
    ]);

    const projectsRaw = projRes?.ok ? await projRes.json().catch(() => []) : [];
    const issuesRaw = issuesRes?.ok ? await issuesRes.json().catch(() => []) : [];
    const monitorsRaw = monitorsRes?.ok ? await monitorsRes.json().catch(() => []) : [];

    const projects = (Array.isArray(projectsRaw) ? projectsRaw : []).map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      platform: p.platform || 'javascript',
      status: p.status || 'active'
    }));

    const recentIssues = (Array.isArray(issuesRaw) ? issuesRaw : []).map(i => ({
      id: i.id,
      shortId: i.shortId,
      title: i.title,
      level: i.level || 'error',
      project: i.project?.slug || 'unknown',
      count: Number(i.count || 1),
      lastSeen: i.lastSeen,
      permalink: i.permalink
    }));

    const monitors = (Array.isArray(monitorsRaw) ? monitorsRaw : []).map(m => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      status: m.status || 'active',
      lastCheckIn: m.environments?.[0]?.lastCheckIn || null,
      lastStatus: m.environments?.[0]?.status || 'ok'
    }));

    return {
      configured: true,
      ok: Boolean(projRes?.ok),
      latencyMs: Date.now() - t0,
      orgSlug: SENTRY_ORG_SLUG,
      projects,
      unresolvedCount: recentIssues.length,
      recentIssues,
      monitors
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - t0,
      orgSlug: SENTRY_ORG_SLUG,
      error: err.message,
      projects: [],
      unresolvedCount: 0,
      recentIssues: [],
      monitors: []
    };
  }
}

/**
 * PostHog EU HogQL Query API üzerinden son 30 günün canlı B2C Vitrin,
 * 3D etkileşim ve Teklif dönüşüm metriklerini çeker.
 */
async function runPostHogHogQL(hogqlQuery) {
  const personalKey = (process.env.POSTHOG_PERSONAL_API_KEY || '').trim();
  if (!personalKey || !POSTHOG_PROJECT_ID) return null;

  const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${personalKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query: hogqlQuery
      }
    })
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

export async function fetchPostHogAnalyticsSummary() {
  const personalKey = (process.env.POSTHOG_PERSONAL_API_KEY || '').trim();
  const t0 = Date.now();

  if (!personalKey) {
    return {
      configured: false,
      ok: false,
      latencyMs: 0,
      projectId: POSTHOG_PROJECT_ID,
      summary: {
        pageviews30d: 0,
        uniqueVisitors30d: 0,
        collectionViews30d: 0,
        model3dInteractions30d: 0,
        quoteModalOpens30d: 0,
        quoteSubmissions30d: 0
      },
      topEvents: [],
      topModels: [],
      topSources: [],
      note: 'POSTHOG_PERSONAL_API_KEY ortam değişkeni Vercel üzerinde tanımlı değil.'
    };
  }

  try {
    const [eventsRes, visitorsRes, modelsRes, sourcesRes] = await Promise.all([
      runPostHogHogQL(`
        SELECT event, count() AS cnt
        FROM events
        WHERE timestamp > now() - INTERVAL 30 DAY
        GROUP BY event
        ORDER BY cnt DESC
        LIMIT 15
      `),
      runPostHogHogQL(`
        SELECT count(DISTINCT person_id) AS visitors, count() AS total_events
        FROM events
        WHERE timestamp > now() - INTERVAL 30 DAY
      `),
      runPostHogHogQL(`
        SELECT
          coalesce(properties.model_name, properties.collection_slug, properties.$pathname, 'Genel') AS target_name,
          count() AS interactions
        FROM events
        WHERE timestamp > now() - INTERVAL 30 DAY
          AND event IN ('collection_viewed', 'product_viewed', '3d_model_interacted', 'quote_modal_opened', 'quote_or_order_submitted')
        GROUP BY target_name
        ORDER BY interactions DESC
        LIMIT 10
      `),
      runPostHogHogQL(`
        SELECT
          coalesce(nullIf(properties.utm_source, ''), nullIf(properties.$referring_domain, ''), 'Doğrudan / Organik') AS source_name,
          count() AS visits
        FROM events
        WHERE timestamp > now() - INTERVAL 30 DAY
          AND event = '$pageview'
        GROUP BY source_name
        ORDER BY visits DESC
        LIMIT 8
      `)
    ]);

    const eventCounts = {};
    const topEvents = [];
    for (const row of (eventsRes?.results || [])) {
      const ev = String(row[0] || '');
      const cnt = Number(row[1] || 0);
      eventCounts[ev] = cnt;
      topEvents.push({ event: ev, count: cnt });
    }

    const uniqueVisitors30d = Number(visitorsRes?.results?.[0]?.[0] || 0);
    const totalEvents30d = Number(visitorsRes?.results?.[0]?.[1] || 0);

    const topModels = (modelsRes?.results || []).map(row => ({
      name: String(row[0] || 'Genel'),
      interactions: Number(row[1] || 0)
    }));

    const topSources = (sourcesRes?.results || []).map(row => ({
      source: String(row[0] || 'Doğrudan'),
      visits: Number(row[1] || 0)
    }));

    return {
      configured: true,
      ok: Boolean(eventsRes),
      latencyMs: Date.now() - t0,
      host: POSTHOG_HOST,
      projectId: POSTHOG_PROJECT_ID,
      summary: {
        totalEvents30d,
        pageviews30d: eventCounts['$pageview'] || 0,
        uniqueVisitors30d,
        collectionViews30d: (eventCounts['collection_viewed'] || 0) + (eventCounts['product_viewed'] || 0),
        model3dInteractions30d: eventCounts['3d_model_interacted'] || 0,
        quoteModalOpens30d: eventCounts['quote_modal_opened'] || 0,
        quoteSubmissions30d: eventCounts['quote_or_order_submitted'] || 0
      },
      topEvents,
      topModels,
      topSources
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - t0,
      projectId: POSTHOG_PROJECT_ID,
      error: err.message,
      summary: {
        pageviews30d: 0,
        uniqueVisitors30d: 0,
        collectionViews30d: 0,
        model3dInteractions30d: 0,
        quoteModalOpens30d: 0,
        quoteSubmissions30d: 0
      },
      topEvents: [],
      topModels: [],
      topSources: []
    };
  }
}

/**
 * ERP Modül 5 (Altyapı Sağlık Monitörü) için birleşik canlı telemetri fotoğrafı:
 * Sentry + Supabase PostgreSQL Kuyruk Derinliği + Cloudflare R2 + DigitalOcean Worker Heartbeat
 */
export async function fetchInfraHealthSnapshot() {
  const startedAt = Date.now();
  const sbHeaders = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
  };

  const [sentry, r2Probe, queueProbe, hbProbe] = await Promise.all([
    fetchSentryTelemetrySummary(),
    (async () => {
      const t = Date.now();
      try {
        const hd = await headR2Object('healthcheck/r2-adapter-verify.txt');
        return { ok: true, exists: hd.exists, latencyMs: Date.now() - t, bucket: 'globalkapak-medya' };
      } catch (e) {
        return { ok: false, latencyMs: Date.now() - t, error: e.message, bucket: 'globalkapak-medya' };
      }
    })(),
    (async () => {
      const t = Date.now();
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { ok: false, latencyMs: 0, counts: {} };
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/social_publish_queue?select=status,platform,updated_at&order=updated_at.desc&limit=100`, { headers: sbHeaders });
        const rows = res.ok ? await res.json().catch(() => []) : [];
        const counts = { pending: 0, processing: 0, published: 0, failed: 0 };
        for (const r of (Array.isArray(rows) ? rows : [])) {
          const st = String(r.status || '').toLowerCase();
          if (counts[st] !== undefined) counts[st]++;
        }
        return { ok: res.ok, latencyMs: Date.now() - t, counts, totalSampled: rows.length };
      } catch (e) {
        return { ok: false, latencyMs: Date.now() - t, error: e.message, counts: {} };
      }
    })(),
    (async () => {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.do_worker_heartbeat&select=data,updated_at&limit=1`, { headers: sbHeaders });
        const rows = res.ok ? await res.json().catch(() => []) : [];
        return rows?.[0]?.data ? { ...rows[0].data, updated_at: rows[0].updated_at } : null;
      } catch (_) {
        return null;
      }
    })()
  ]);

  const hbAgeSec = hbProbe?.timestamp
    ? Math.max(0, Math.round((Date.now() - new Date(hbProbe.timestamp).getTime()) / 1000))
    : null;

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    totalCheckMs: Date.now() - startedAt,
    architecture: 'DigitalOcean Single-Server Orchestrator & Worker + Vercel Edge + Cloudflare R2 + Supabase PostgreSQL + Clerk',
    services: {
      sentry,
      cloudflareR2: r2Probe,
      supabaseQueue: queueProbe,
      digitalOceanWorker: {
        host: '104.248.20.228',
        online: hbAgeSec !== null ? hbAgeSec < 300 : false,
        lastHeartbeatAt: hbProbe?.timestamp || null,
        ageSeconds: hbAgeSec,
        workerId: hbProbe?.worker_id || 'do-nova-publisher',
        lastCycleStatus: hbProbe?.status || 'idle',
        details: hbProbe || null
      }
    }
  };
}

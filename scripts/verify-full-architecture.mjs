// ============================================================================
// NOVA FURNITURE / GLOBAL KAPAK MOBİLYA — UÇTAN UCA MİMARİ DOĞRULAMA (FAZ 1-6)
// Kullanım:
//   node --env-file="Sunucu/publisher/.env" scripts/verify-full-architecture.mjs
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  listR2Objects,
  headR2Object,
  createR2PresignedUrl
} from '../api/_lib/r2-storage.js';
import {
  fetchInfraHealthSnapshot,
  fetchPostHogAnalyticsSummary
} from '../api/_lib/observability.js';
import {
  verifySvixWebhookSignature
} from '../api/_lib/auth.js';
import module7Handler from '../api/module7.js';

const CLERK_ORG_ID = (process.env.CLERK_ORG_ID || 'org_3MQEn3zykDenqO7WuKDpWfKDInY').trim();

const results = [];

function record(phase, name, ok, detail) {
  results.push({ phase, name, ok: Boolean(ok), detail });
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} [${phase}] ${name}: ${detail}`);
}

async function runFaz1Checks() {
  try {
    const products = await listR2Objects('products/', 200);
    const music = await listR2Objects('music-library/', 100);
    record('FAZ 1', 'Cloudflare R2 Bucket List', products.length > 0 && music.length > 0,
      `products=${products.length}, music-library=${music.length}`);

    const sampleKey = products[0]?.key || 'healthcheck/r2-adapter-verify.txt';
    const head = await headR2Object(sampleKey);
    record('FAZ 1', 'Cloudflare R2 HEAD Object', head.exists,
      `key=${sampleKey}, size=${head.sizeBytes || 0}B, type=${head.contentType || '-'}`);

    const signedUrl = createR2PresignedUrl(sampleKey, 'GET', 120);
    const signedRes = await fetch(signedUrl, { method: 'GET' });
    record('FAZ 1', 'Cloudflare R2 Presigned GET', signedRes.ok,
      `HTTP ${signedRes.status}`);

    const gatewayUrl = `https://insta-deployment-rho.vercel.app/r2/${sampleKey}`;
    const gwRes = await fetch(gatewayUrl, { method: 'HEAD' });
    record('FAZ 1', 'Vercel Edge /r2/* Gateway', gwRes.ok,
      `HTTP ${gwRes.status} (${gatewayUrl})`);
  } catch (err) {
    record('FAZ 1', 'Cloudflare R2 Genel', false, err.message);
  }
}

async function runFaz2Checks() {
  try {
    const clerkSecret = (process.env.CLERK_SECRET_KEY || '').trim();
    if (!clerkSecret) {
      record('FAZ 2', 'Clerk Secret Env', false, 'CLERK_SECRET_KEY env bulunamadı');
    } else {
      const orgRes = await fetch(`https://api.clerk.com/v1/organizations/${CLERK_ORG_ID}`, {
        headers: { Authorization: `Bearer ${clerkSecret}` }
      });
      const orgData = orgRes.ok ? await orgRes.json().catch(() => null) : null;
      record('FAZ 2', 'Clerk Production Organization', orgRes.ok && orgData?.id === CLERK_ORG_ID,
        orgRes.ok ? `${orgData.name} (${orgData.id})` : `HTTP ${orgRes.status}`);

      const memRes = await fetch(`https://api.clerk.com/v1/organizations/${CLERK_ORG_ID}/memberships?limit=20`, {
        headers: { Authorization: `Bearer ${clerkSecret}` }
      });
      const memData = memRes.ok ? await memRes.json().catch(() => null) : null;
      const count = Array.isArray(memData?.data) ? memData.data.length : 0;
      record('FAZ 2', 'Clerk Org Üyelik & Departmanlar', memRes.ok && count > 0,
        `${count} aktif üye`);
    }

    // Svix imza doğrulama birim testi (env üzerindeki gerçek CLERK_WEBHOOK_SECRET ile)
    const webhookSecret = (process.env.CLERK_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
      record('FAZ 2', 'Svix Webhook İmza Doğrulaması', false, 'CLERK_WEBHOOK_SECRET env bulunamadı');
    } else {
      const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ''), 'base64');
      const svixId = 'msg_test_faz6_verify';
      const svixTs = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({ type: 'user.updated', data: { id: 'user_test' } });
      const sig = crypto
        .createHmac('sha256', secretBytes)
        .update(`${svixId}.${svixTs}.${payload}`, 'utf8')
        .digest('base64');

      let validOk = false;
      try {
        validOk = verifySvixWebhookSignature(payload, {
          'svix-id': svixId,
          'svix-timestamp': svixTs,
          'svix-signature': `v1,${sig}`
        }) === true;
      } catch (_) { validOk = false; }

      let invalidBlocked = false;
      try {
        verifySvixWebhookSignature(payload, {
          'svix-id': svixId,
          'svix-timestamp': svixTs,
          'svix-signature': 'v1,invalid_signature_value'
        });
      } catch (_) { invalidBlocked = true; }

      record('FAZ 2', 'Svix Webhook İmza Doğrulaması',
        validOk && invalidBlocked,
        `valid=${validOk}, invalidBlocked=${invalidBlocked}`);
    }
  } catch (err) {
    record('FAZ 2', 'Clerk & Svix Genel', false, err.message);
  }
}

async function runFaz4Checks() {
  try {
    const health = await fetchInfraHealthSnapshot();
    const sentryOk = Boolean(health?.services?.sentry?.ok);
    const r2Ok = Boolean(health?.services?.cloudflareR2?.ok);
    const queueOk = Boolean(health?.services?.supabaseQueue?.ok);
    const projectCount = Array.isArray(health?.services?.sentry?.projects)
      ? health.services.sentry.projects.length
      : 0;

    record('FAZ 4', 'Sentry EU + R2 + Supabase Sağlık Monitörü',
      sentryOk && r2Ok && queueOk,
      `sentry=${sentryOk} (${projectCount} proje), r2=${r2Ok} (${health?.services?.cloudflareR2?.latencyMs}ms), queue=${queueOk} (${health?.services?.supabaseQueue?.totalSampled || 0} kayıt)`);

    const posthog = await fetchPostHogAnalyticsSummary();
    record('FAZ 4', 'PostHog EU HogQL Analitik',
      Boolean(posthog?.ok),
      `project=${posthog?.projectId}, events30d=${posthog?.summary?.totalEvents30d || 0}, latency=${posthog?.latencyMs}ms`);
  } catch (err) {
    record('FAZ 4', 'Observability Genel', false, err.message);
  }
}

async function runFaz6Checks() {
  try {
    let statusCode = 200;
    let body = null;
    const headers = {};
    const mockReq = {
      method: 'GET',
      url: '/api/module7?action=b2c-public',
      query: { action: 'b2c-public' },
      headers: { host: 'erp.globalkapakmobilya.com', origin: 'https://beta.globalkapakmobilya.com' }
    };
    const mockRes = {
      setHeader(k, v) { headers[k.toLowerCase()] = v; },
      status(code) { statusCode = code; return this; },
      json(data) { body = data; return this; },
      end() { return this; }
    };

    await module7Handler(mockReq, mockRes);

    const cols = Array.isArray(body?.collections) ? body.collections : [];
    const prods = Array.isArray(body?.products) ? body.products : [];
    const totalPieces = cols.reduce((sum, c) => sum + (Array.isArray(c.pieces) ? c.pieces.length : 0), 0);
    const hasBergamo = cols.some(c => String(c.name || '').toLowerCase().includes('bergamo'));
    const unnormalizedUrls = [];
    for (const c of cols) {
      if (c.hero_image_url && c.hero_image_url.includes('.supabase.co/storage/')) unnormalizedUrls.push(c.hero_image_url);
      for (const pc of (c.pieces || [])) {
        if (pc.image_url && pc.image_url.includes('.supabase.co/storage/')) unnormalizedUrls.push(pc.image_url);
      }
    }
    for (const p of prods) {
      if (p.ana_resim && p.ana_resim.includes('.supabase.co/storage/')) unnormalizedUrls.push(p.ana_resim);
    }

    record('FAZ 6', 'B2C Public API Bridge (/api/b2c-public)',
      statusCode === 200 && Boolean(body?.ok) && cols.length > 0 && (totalPieces + prods.length) > 0 && unnormalizedUrls.length === 0,
      `HTTP ${statusCode}, collections=${cols.length} (Bergamo=${hasBergamo}), collectionPieces=${totalPieces}, standaloneProducts=${prods.length}, storage=${body?.storage_provider}, legacySupabaseUrls=${unnormalizedUrls.length}`);

    // B2C Vitrin dosya doğrulaması
    const b2cRoot = path.resolve(process.cwd(), '..', 'Global-Mobilya-Web');
    if (fs.existsSync(b2cRoot)) {
      const cfg = fs.readFileSync(path.join(b2cRoot, 'js', 'supabase-config.js'), 'utf8');
      const urun = fs.readFileSync(path.join(b2cRoot, 'urun.html'), 'utf8');
      const kol = fs.readFileSync(path.join(b2cRoot, 'koleksiyon.html'), 'utf8');
      const hasBridge = cfg.includes('/api/b2c-public') && cfg.includes('/r2/');
      const has3D = urun.includes('model-viewer') && kol.includes('model-viewer');
      const hasTelemetry = cfg.includes('nova-telemetry.js') && urun.includes('3d_model_interacted');
      record('FAZ 6', 'B2C Vitrin 3D Showroom & R2 Entegrasyonu',
        hasBridge && has3D && hasTelemetry,
        `b2cBridge=${hasBridge}, modelViewer3D=${has3D}, telemetry=${hasTelemetry}`);
    } else {
      record('FAZ 6', 'B2C Vitrin Klasör Kontrolü', false, `Klasör bulunamadı: ${b2cRoot}`);
    }
  } catch (err) {
    record('FAZ 6', 'B2C Public Bridge Genel', false, err.message);
  }
}

async function main() {
  console.log('====================================================================');
  console.log('NOVA FURNITURE / GLOBAL KAPAK MOBİLYA — FULL ARCHITECTURE VERIFY');
  console.log('====================================================================');
  await runFaz1Checks();
  await runFaz2Checks();
  await runFaz4Checks();
  await runFaz6Checks();

  const failed = results.filter(r => !r.ok);
  console.log('====================================================================');
  console.log(`ÖZET: ${results.length - failed.length}/${results.length} test BAŞARILI.`);
  if (failed.length > 0) {
    console.error('BAŞARISIZ TESTLER:', failed.map(f => `[${f.phase}] ${f.name}: ${f.detail}`).join(' | '));
    process.exit(1);
  }
}

main();

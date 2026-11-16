/**
 * GLOBAL MOBİLYA — MODULE 8: PRODUCTION JOB MANAGEMENT API
 * ============================================================================
 * Production job lifecycle management backed directly by PostgreSQL tables
 * and atomic stored procedures. Zero monolitik JSON store egress.
 * ============================================================================
 */
import {
  supabaseRequest,
  authenticateRoles,
  normalizeJobRecord,
  REGISTERED_ENGINES
} from './db.js';

export async function handleJobs(req, res) {
  if (req.method === 'GET') {
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));
    const offset = Math.max(0, Number(req.query?.offset) || 0);
    let qs = `/rest/v1/production_jobs?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;

    const statusFilter = req.query?.status;
    const prodFilter = req.query?.product_slug;
    const colFilter = req.query?.collection_id;
    const engineFilter = req.query?.selected_engine || req.query?.engine;
    const typeFilter = req.query?.production_type;

    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'pending' || statusFilter === 'queued') {
        qs += `&status=in.(pending,queued)`;
      } else {
        qs += `&status=eq.${encodeURIComponent(statusFilter)}`;
      }
    }
    if (prodFilter) qs += `&product_slug=eq.${encodeURIComponent(prodFilter)}`;
    if (colFilter) qs += `&collection_id=eq.${encodeURIComponent(colFilter)}`;
    if (engineFilter) qs += `&selected_engine=eq.${encodeURIComponent(engineFilter)}`;
    if (typeFilter) qs += `&production_type=eq.${encodeURIComponent(typeFilter)}`;

    const rRes = await supabaseRequest(qs);
    const jobs = (rRes.ok && Array.isArray(rRes.data)) ? rRes.data.map(normalizeJobRecord) : [];
    return res.status(200).json({ ok: true, success: true, jobs, data: jobs, total: jobs.length });
  }

  if (req.method === 'POST') {
    await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
    const body = req.body || {};
    const prodType = body.production_type || body.jobType || body.job_type;
    const selectedEngine = body.selected_engine || body.engine || (
      ['3d_render', 'blender_render', 'cinematic_render', 'benchmark_test'].includes(prodType)
        ? 'blender_headless'
        : 'ai_enhancer'
    );

    if (!prodType || !selectedEngine) {
      return res.status(400).json({ ok: false, success: false, error: 'production_type ve selected_engine zorunludur.' });
    }

    const validEngine = REGISTERED_ENGINES.some(e => e.id === selectedEngine);
    if (!validEngine) {
      return res.status(400).json({ ok: false, success: false, error: `Bilinmeyen üretim motoru: ${selectedEngine}` });
    }

    const idempotencyKey = body.idempotency_key || body.idempotencyKey || `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const checkRes = await supabaseRequest(`/rest/v1/production_jobs?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`);
    if (checkRes.ok && Array.isArray(checkRes.data) && checkRes.data.length > 0) {
      const existing = normalizeJobRecord(checkRes.data[0]);
      return res.status(200).json({ ok: true, success: true, job: existing, data: existing, note: 'idempotent_duplicate' });
    }

    const rawSettings = {
      ...(body.config_params || {}),
      ...(body.parameters || {}),
      ...(body.render_settings || {})
    };
    const inputModelPath = body.input_model_path || rawSettings.input_model_path || rawSettings.model_path || null;
    if (inputModelPath && !rawSettings.model_path) {
      rawSettings.model_path = inputModelPath;
    }

    const requestedInitialStatus = body.status === 'pending' ? 'pending' : 'queued';
    const generatedId = body.job_id || body.id || ('job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));

    const newJob = normalizeJobRecord({
      id: generatedId,
      job_id: generatedId,
      product_slug: body.product_slug || body.productId || null,
      collection_id: body.collection_id || null,
      source_asset_id: body.source_asset_id || null,
      title: body.title || `${prodType} - ${selectedEngine}`,
      production_type: prodType,
      pipeline_type: body.pipeline_type || 'standard',
      selected_engine: selectedEngine,
      input_model_path: inputModelPath,
      output_render_path: null,
      output_public_url: null,
      render_settings: rawSettings,
      config_params: rawSettings,
      status: requestedInitialStatus,
      progress_percent: 0,
      idempotency_key: idempotencyKey,
      worker_id: null,
      lease_expires_at: null,
      retry_count: 0,
      max_retries: body.max_retries !== undefined ? Number(body.max_retries) : 3,
      error_code: null,
      error_message: null,
      error_details: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const createRes = await supabaseRequest('/rest/v1/production_jobs', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(newJob)
    });

    if (!createRes.ok) {
      return res.status(createRes.status || 500).json({ ok: false, error: 'Görev oluşturulamadı: ' + JSON.stringify(createRes.data) });
    }

    await supabaseRequest('/rest/v1/production_events', {
      method: 'POST',
      body: JSON.stringify({
        id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        job_id: newJob.id,
        event_type: 'job_created',
        event_details: {
          engine: selectedEngine,
          type: prodType,
          status: newJob.status,
          input_model_path: newJob.input_model_path,
          product: newJob.product_slug,
          collection: newJob.collection_id
        }
      })
    });

    return res.status(201).json({ ok: true, success: true, job: newJob, data: newJob });
  }

  if (req.method === 'DELETE' || req.method === 'PATCH') {
    const actionType = req.body?.action || req.query?.action;
    if (actionType === 'retry') {
      return await handleJobRetry(req, res);
    }
    return await handleJobCancel(req, res);
  }

  return res.status(405).json({ ok: false, success: false, error: 'Method not allowed' });
}

export async function handleJobDetail(req, res) {
  const jobId = req.query?.id || req.body?.id || req.query?.job_id || req.body?.job_id;
  if (!jobId) return res.status(400).json({ ok: false, success: false, error: 'id parametresi gereklidir.' });

  const [jobRes, eventsRes, outputsRes] = await Promise.all([
    supabaseRequest(`/rest/v1/production_jobs?id=eq.${encodeURIComponent(jobId)}&limit=1`),
    supabaseRequest(`/rest/v1/production_events?job_id=eq.${encodeURIComponent(jobId)}&order=created_at.asc`),
    supabaseRequest(`/rest/v1/production_outputs?job_id=eq.${encodeURIComponent(jobId)}&order=created_at.asc`)
  ]);

  const jobRaw = (jobRes.ok && Array.isArray(jobRes.data)) ? jobRes.data[0] : null;
  if (!jobRaw) return res.status(404).json({ ok: false, success: false, error: 'Görev bulunamadı.' });

  const job = normalizeJobRecord(jobRaw);
  const events = (eventsRes.ok && Array.isArray(eventsRes.data)) ? eventsRes.data : [];
  const outputs = (outputsRes.ok && Array.isArray(outputsRes.data)) ? outputsRes.data : [];

  return res.status(200).json({
    ok: true,
    success: true,
    job,
    events,
    outputs,
    timeline: events,
    data: { job, events, outputs, timeline: events }
  });
}

export async function handleJobRetry(req, res) {
  await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
  const jobId = req.query?.id || req.body?.id || req.query?.job_id || req.body?.job_id;
  if (!jobId) return res.status(400).json({ ok: false, success: false, error: 'Job ID gereklidir.' });

  const rpcRes = await supabaseRequest('/rest/v1/rpc/retry_production_job', {
    method: 'POST',
    body: JSON.stringify({ p_job_id: String(jobId), p_max_retries: 3 })
  });

  if (!rpcRes.ok || rpcRes.data !== true) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: 'Görev yeniden başlatılamadı. Görev bulunamamış veya izin verilen durumda olmayabilir.'
    });
  }

  await supabaseRequest('/rest/v1/production_events', {
    method: 'POST',
    body: JSON.stringify({
      id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      job_id: String(jobId),
      event_type: 'job_retried',
      event_details: { triggered_by: 'user' }
    })
  });

  const getRes = await supabaseRequest(`/rest/v1/production_jobs?id=eq.${encodeURIComponent(jobId)}&limit=1`);
  const job = (getRes.ok && Array.isArray(getRes.data)) ? normalizeJobRecord(getRes.data[0]) : { id: jobId, status: 'pending' };
  return res.status(200).json({ ok: true, success: true, job, data: job });
}

export async function handleJobCancel(req, res) {
  await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
  const jobId = req.query?.id || req.body?.id || req.query?.job_id || req.body?.job_id;
  if (!jobId) return res.status(400).json({ ok: false, success: false, error: 'Job ID gereklidir.' });

  const patchRes = await supabaseRequest(`/rest/v1/production_jobs?id=eq.${encodeURIComponent(jobId)}&status=in.(pending,queued,processing,rendering,uploading)`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'cancelled',
      lease_expires_at: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  });

  if (!patchRes.ok || !Array.isArray(patchRes.data) || patchRes.data.length === 0) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: 'Görev iptal edilemedi veya zaten sonlanmış.'
    });
  }

  await supabaseRequest('/rest/v1/production_events', {
    method: 'POST',
    body: JSON.stringify({
      id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      job_id: String(jobId),
      event_type: 'job_cancelled',
      event_details: { cancelled_by: 'user' }
    })
  });

  const job = normalizeJobRecord(patchRes.data[0]);
  return res.status(200).json({ ok: true, success: true, job, data: job });
}

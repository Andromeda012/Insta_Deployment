/**
 * GLOBAL MOBİLYA — MODULE 8: WORKER COMMUNICATION & ENGINE CONTRACT API
 * ============================================================================
 * Autonomous, headless render worker coordination using PostgreSQL RPCs.
 * Guaranteed zero-egress polling, atomic claim (FOR UPDATE SKIP LOCKED),
 * heartbeat lease extension, outputs ingestion, and failure recording.
 * ============================================================================
 */
import {
  supabaseRequest,
  verifyWorkerAuth,
  authenticateRoles,
  normalizeJobRecord,
  REGISTERED_ENGINES,
  SUPABASE_URL
} from './db.js';

export async function handleWorker(req, res) {
  const isWorker = verifyWorkerAuth(req);
  let isWorkerAdmin = false;

  if (!isWorker) {
    const user = await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
    if (!user) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Yetkisiz erişim: Geçerli bir RENDER_WORKER_KEY veya yönetici oturumu gereklidir.'
      });
    }
    isWorkerAdmin = true;
  }

  const workerAction = String(req.query?.worker_action || req.body?.worker_action || '').toLowerCase();
  const actionParam = String(req.query?.action || '').toLowerCase();

  // 1. Worker Atomic Claim + Stale Lease Recovery via PostgreSQL RPC
  if (workerAction === 'claim' || actionParam === 'worker-claim') {
    const {
      worker_id = 'worker-default',
      supported_engines = [],
      lease_seconds = 360,
      claim_status = null
    } = req.body || {};

    const engineFilter = Array.isArray(supported_engines) && supported_engines.length
      ? supported_engines
      : REGISTERED_ENGINES.map(e => e.id);

    const safeLeaseSeconds = Math.max(10, Math.min(3600, Number(lease_seconds) || 360));

    const rpcRes = await supabaseRequest('/rest/v1/rpc/claim_next_production_job', {
      method: 'POST',
      body: JSON.stringify({
        p_worker_id: worker_id,
        p_supported_engines: engineFilter,
        p_lease_seconds: safeLeaseSeconds
      })
    });

    if (!rpcRes.ok) {
      return res.status(rpcRes.status || 500).json({
        ok: false,
        error: `İş kuyruğu sorgulanamadı: ${JSON.stringify(rpcRes.data)}`
      });
    }

    const claimedJobs = Array.isArray(rpcRes.data) ? rpcRes.data : [];
    const job = claimedJobs[0] || null;

    if (!job) {
      return res.status(200).json({ ok: true, success: true, job: null, message: 'İş kuyruğu boş.' });
    }

    normalizeJobRecord(job);
    return res.status(200).json({ ok: true, success: true, job, data: job });
  }

  // 2. Worker Progress / Status Update via PostgreSQL RPC
  if (workerAction === 'update' || actionParam === 'worker-update') {
    const { job_id, worker_id, progress_percent, current_phase = 'processing', status_message, lease_seconds = 300 } = req.body || {};
    if (!job_id) return res.status(400).json({ ok: false, error: 'job_id zorunludur.' });

    const safeExtraSeconds = Math.max(10, Math.min(3600, Number(lease_seconds) || 300));
    const safePercent = progress_percent !== undefined ? Math.min(100, Math.max(0, Number(progress_percent) || 0)) : null;

    const rpcRes = await supabaseRequest('/rest/v1/rpc/extend_production_job_lease', {
      method: 'POST',
      body: JSON.stringify({
        p_job_id: String(job_id),
        p_worker_id: String(worker_id || ''),
        p_status: current_phase,
        p_progress_percent: safePercent,
        p_extra_seconds: safeExtraSeconds
      })
    });

    if (!rpcRes.ok) {
      return res.status(rpcRes.status || 500).json({ ok: false, error: 'Kira süresi yenilenemedi.' });
    }

    // Insert progress event into production_events
    await supabaseRequest('/rest/v1/production_events', {
      method: 'POST',
      body: JSON.stringify({
        job_id: String(job_id),
        event_type: 'worker_progress',
        event_details: { progress_percent: safePercent, phase: current_phase, message: status_message }
      })
    });

    return res.status(200).json({
      ok: true,
      success: true,
      job: { id: job_id, status: current_phase, progress_percent: safePercent }
    });
  }

  // 3. Worker Complete via PostgreSQL RPC & Output Ingestion
  if (workerAction === 'complete' || actionParam === 'worker-complete') {
    const { job_id, worker_id, outputs = [], metrics = {}, output_render_path, output_public_url } = req.body || {};
    if (!job_id) return res.status(400).json({ ok: false, error: 'job_id zorunludur.' });

    const firstOutput = Array.isArray(outputs) && outputs[0] ? outputs[0] : null;
    const resolvedPath = output_render_path || firstOutput?.storage_path || null;
    const resolvedUrl = output_public_url || firstOutput?.public_url || (resolvedPath ? `${SUPABASE_URL}/storage/v1/object/public/media/${resolvedPath}` : null);

    const rpcRes = await supabaseRequest('/rest/v1/rpc/complete_production_job', {
      method: 'POST',
      body: JSON.stringify({
        p_job_id: String(job_id),
        p_worker_id: String(worker_id || ''),
        p_output_render_path: resolvedPath,
        p_output_public_url: resolvedUrl
      })
    });

    if (!rpcRes.ok) {
      return res.status(rpcRes.status || 500).json({ ok: false, error: 'Görev tamamlama kaydedilemedi.' });
    }

    // Record production outputs and media assets
    const createdOutputs = [];
    for (let idx = 0; idx < outputs.length; idx++) {
      const out = outputs[idx];
      const outputAssetId = out.asset_id || ('ast-out-' + Date.now() + '-' + idx);
      const outUrl = out.public_url || (out.storage_path ? `${SUPABASE_URL}/storage/v1/object/public/media/${out.storage_path}` : resolvedUrl);

      const outputRecord = {
        id: 'out-' + Date.now() + '-' + idx,
        job_id: String(job_id),
        media_asset_id: outputAssetId,
        storage_path: out.storage_path || resolvedPath,
        public_url: outUrl,
        file_name: out.file_name || `render_${job_id}_${idx}.${out.file_format || 'jpg'}`,
        file_size_bytes: out.file_size_bytes || 0,
        output_type: out.output_type || 'hero_still',
        file_format: out.file_format || 'jpg',
        resolution_label: out.resolution_label || '1080x1080',
        width_px: out.width_px || null,
        height_px: out.height_px || null,
        duration_seconds: out.duration_seconds || null,
        quality_status: 'approved'
      };

      await supabaseRequest('/rest/v1/production_outputs', {
        method: 'POST',
        body: JSON.stringify(outputRecord)
      });
      createdOutputs.push(outputRecord);

      await supabaseRequest('/rest/v1/media_assets', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: outputAssetId,
          job_id: String(job_id),
          asset_type: out.output_type === 'platform_video' ? 'platform_video' : 'render_frame',
          storage_path: out.storage_path || resolvedPath || '',
          public_url: outUrl,
          file_name: out.file_name || `render_${job_id}_${idx}.${out.file_format || 'jpg'}`,
          mime_type: out.mime_type || (out.file_format === 'mp4' ? 'video/mp4' : 'image/jpeg'),
          file_size_bytes: out.file_size_bytes || 0,
          width_px: out.width_px || null,
          height_px: out.height_px || null,
          duration_seconds: out.duration_seconds || null,
          is_approved: false
        })
      });
    }

    if (metrics.cost_amount || metrics.gpu_seconds || metrics.cpu_seconds) {
      await supabaseRequest('/rest/v1/production_costs', {
        method: 'POST',
        body: JSON.stringify({
          job_id: String(job_id),
          provider_name: 'blender_headless',
          compute_device: metrics.compute_device || (metrics.gpu_seconds ? 'GPU' : 'CPU'),
          cpu_seconds_used: metrics.cpu_seconds || 0,
          gpu_seconds_used: metrics.gpu_seconds || 0,
          cost_amount: metrics.cost_amount || 0,
          cost_measured: Boolean(metrics.cost_measured),
          currency: 'USD'
        })
      });
    }

    return res.status(200).json({
      ok: true,
      success: true,
      job: { id: job_id, status: 'completed', output_render_path: resolvedPath, output_public_url: resolvedUrl },
      outputs: createdOutputs
    });
  }

  // 4. Worker Fail via PostgreSQL RPC
  if (workerAction === 'fail' || actionParam === 'worker-fail') {
    const { job_id, worker_id, error_code = 'RENDER_ERROR', error_message = 'Bilinmeyen render hatası.', error_details = null } = req.body || {};
    if (!job_id) return res.status(400).json({ ok: false, error: 'job_id zorunludur.' });

    const rpcRes = await supabaseRequest('/rest/v1/rpc/fail_production_job', {
      method: 'POST',
      body: JSON.stringify({
        p_job_id: String(job_id),
        p_worker_id: String(worker_id || ''),
        p_error_code: error_code,
        p_error_message: error_message,
        p_error_details: error_details
      })
    });

    if (!rpcRes.ok) {
      return res.status(rpcRes.status || 500).json({ ok: false, error: 'Görev başarısız olarak işaretlenemedi.' });
    }

    return res.status(200).json({
      ok: true,
      success: true,
      job: { id: job_id, status: 'failed', error_code, error_message }
    });
  }

  return res.status(400).json({ ok: false, error: `Bilinmeyen worker eylemi: ${workerAction || actionParam}` });
}

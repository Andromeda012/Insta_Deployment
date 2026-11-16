/**
 * GLOBAL MOBİLYA — MODULE 8: RENDER OUTPUT MANAGEMENT API
 * ============================================================================
 * Query, verify, quality-check, and approve generated 3D still frames
 * and cinematic videos stored in Supabase Storage.
 * ============================================================================
 */
import {
  supabaseRequest,
  authenticateRoles
} from './db.js';

export async function handleOutputs(req, res) {
  if (req.method === 'GET') {
    const jobId = req.query?.job_id;
    const outputId = req.query?.id;
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));
    const offset = Math.max(0, Number(req.query?.offset) || 0);

    let qs = `/rest/v1/production_outputs?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
    if (jobId) qs += `&job_id=eq.${encodeURIComponent(jobId)}`;
    if (outputId) qs += `&id=eq.${encodeURIComponent(outputId)}`;

    const rRes = await supabaseRequest(qs);
    const rawOutputs = (rRes.ok && Array.isArray(rRes.data)) ? rRes.data : [];
    const outputs = rawOutputs.map(o => ({ ...o, review_status: o.quality_status || o.review_status || 'pending' }));

    if (outputId && outputs.length > 0) {
      return res.status(200).json({ ok: true, success: true, output: outputs[0], data: outputs[0] });
    }

    return res.status(200).json({ ok: true, success: true, outputs, data: outputs, count: outputs.length });
  }

  // PATCH: Approve / Quality Review Output
  if (req.method === 'PATCH' || req.method === 'PUT') {
    await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
    const outputId = req.query?.id || req.body?.id;
    const body = req.body || {};
    const quality_status = body.quality_status || body.review_status || 'approved';
    const quality_notes = body.quality_notes || body.review_notes || '';

    if (!outputId) return res.status(400).json({ ok: false, error: 'id parametresi zorunludur.' });

    const patchRes = await supabaseRequest(`/rest/v1/production_outputs?id=eq.${encodeURIComponent(outputId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        quality_status,
        quality_notes
      })
    });

    if (!patchRes.ok || !Array.isArray(patchRes.data) || patchRes.data.length === 0) {
      return res.status(404).json({ ok: false, error: 'Render çıktısı bulunamadı.' });
    }

    const updatedOutput = {
      ...patchRes.data[0],
      review_status: patchRes.data[0].quality_status
    };

    // Also update associated media_asset approval status
    if (updatedOutput.media_asset_id) {
      await supabaseRequest(`/rest/v1/media_assets?id=eq.${encodeURIComponent(updatedOutput.media_asset_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_approved: quality_status === 'approved' })
      });
    }

    return res.status(200).json({ ok: true, success: true, output: updatedOutput, data: updatedOutput });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

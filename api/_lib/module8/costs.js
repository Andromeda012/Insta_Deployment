/**
 * GLOBAL MOBİLYA — MODULE 8: PRODUCTION COST & COMPUTE METRICS API
 * ============================================================================
 * Production compute cost accounting, CPU/GPU seconds, cloud API credits,
 * and currency breakdowns.
 * ============================================================================
 */
import {
  supabaseRequest
} from './db.js';

export async function handleCosts(req, res) {
  if (req.method === 'GET') {
    const jobId = req.query?.job_id;
    const provider = req.query?.provider;
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));

    let qs = `/rest/v1/production_costs?select=*&order=created_at.desc&limit=${limit}`;
    if (jobId) qs += `&job_id=eq.${encodeURIComponent(jobId)}`;
    if (provider) qs += `&provider_name=eq.${encodeURIComponent(provider)}`;

    const rRes = await supabaseRequest(qs);
    const costs = (rRes.ok && Array.isArray(rRes.data)) ? rRes.data : [];

    let totalUsd = 0;
    let totalCpuSec = 0;
    let totalGpuSec = 0;

    costs.forEach(c => {
      totalUsd += Number(c.cost_amount || 0);
      totalCpuSec += Number(c.cpu_seconds_used || 0);
      totalGpuSec += Number(c.gpu_seconds_used || 0);
    });

    return res.status(200).json({
      ok: true,
      success: true,
      summary: {
        total_cost_usd: totalUsd,
        total_cpu_seconds: totalCpuSec,
        total_gpu_seconds: totalGpuSec,
        records_count: costs.length
      },
      costs,
      data: costs
    });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

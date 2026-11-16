/**
 * GLOBAL MOBİLYA — MODULE 8: PRODUCTION EVENTS & AUDIT API
 * ============================================================================
 * Production job event logging, lifecycle audit trail, and worker activity history.
 * ============================================================================
 */
import {
  supabaseRequest
} from './db.js';

export async function handleEvents(req, res) {
  if (req.method === 'GET') {
    const jobId = req.query?.job_id;
    const eventType = req.query?.event_type;
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));
    const offset = Math.max(0, Number(req.query?.offset) || 0);

    let qs = `/rest/v1/production_events?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
    if (jobId) qs += `&job_id=eq.${encodeURIComponent(jobId)}`;
    if (eventType) qs += `&event_type=eq.${encodeURIComponent(eventType)}`;

    const rRes = await supabaseRequest(qs);
    const events = (rRes.ok && Array.isArray(rRes.data)) ? rRes.data : [];

    return res.status(200).json({ ok: true, success: true, events, data: events, count: events.length });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

/**
 * GLOBAL MOBİLYA — MODULE 8: STUDIO API CLIENT
 * Client-side integration for Overview, Media Library, Jobs & Module 7 Catalog Read Bridge
 */

export async function fetchStudioOverview() {
  const res = await fetch('/api/module8?action=overview', { cache: 'no-store' });
  return res.json();
}

export async function fetchStudioMedia(filters = {}) {
  const params = new URLSearchParams();
  if (filters.product_slug) params.set('product_slug', filters.product_slug);
  if (filters.asset_type) params.set('asset_type', filters.asset_type);
  const res = await fetch(`/api/module8?action=media&${params.toString()}`, { cache: 'no-store' });
  return res.json();
}

export async function fetchStudioJobs() {
  const res = await fetch('/api/module8?action=jobs', { cache: 'no-store' });
  return res.json();
}

export async function fetchStudio3DAssets() {
  const res = await fetch('/api/module8?action=3d-assets', { cache: 'no-store' });
  return res.json();
}

export async function fetchSceneTemplates() {
  const res = await fetch('/api/module8?action=scene-templates', { cache: 'no-store' });
  return res.json();
}

export async function fetchStudioEngines() {
  const res = await fetch('/api/module8?action=engines', { cache: 'no-store' });
  return res.json();
}

export async function submitStudioJob(jobPayload) {
  const res = await fetch('/api/module8?action=jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobPayload)
  });
  return res.json();
}

export async function cancelStudioJob(jobId) {
  const res = await fetch('/api/module8?action=jobs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: jobId })
  });
  return res.json();
}

// Aliases for unified SDK compatibility
export const fetchOverview = fetchStudioOverview;
export const fetchJobs = fetchStudioJobs;
export const submitJob = submitStudioJob;
export const cancelJob = cancelStudioJob;
export const fetchCatalogRef = fetchCatalogProducts;

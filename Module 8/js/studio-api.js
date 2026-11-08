/**
 * GLOBAL MOBİLYA — MODULE 8: STUDIO API CLIENT (PHASE 2)
 * Client SDK for Overview, Real Module 7 Catalog, Media Library, Safe Upload & Job Lifecycle
 */

export async function fetchStudioOverview() {
  const res = await fetch('/api/module8?action=overview', { cache: 'no-store' });
  return res.json();
}

export async function fetchCatalogProducts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'ALL') params.set('category', filters.category);
  if (filters.collection && filters.collection !== 'ALL') params.set('collection', filters.collection);
  if (filters.slug) params.set('slug', filters.slug);

  const qs = params.toString() ? `&${params.toString()}` : '';
  const res = await fetch(`/api/module8?action=catalog-ref${qs}`, { cache: 'no-store' });
  return res.json();
}

export async function fetchCatalogDetail(slug) {
  const res = await fetch(`/api/module8?action=catalog-ref&slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
  return res.json();
}

export async function fetchStudioMedia(filters = {}) {
  const params = new URLSearchParams();
  if (filters.product_slug) params.set('product_slug', filters.product_slug);
  if (filters.collection_id) params.set('collection_id', filters.collection_id);
  if (filters.asset_type && filters.asset_type !== 'ALL') params.set('asset_type', filters.asset_type);
  if (filters.search) params.set('search', filters.search);

  const qs = params.toString() ? `&${params.toString()}` : '';
  const res = await fetch(`/api/module8?action=media${qs}`, { cache: 'no-store' });
  return res.json();
}

export async function fetchMediaDetail(assetId) {
  const res = await fetch(`/api/module8?action=media&id=${encodeURIComponent(assetId)}`, { cache: 'no-store' });
  return res.json();
}

export async function uploadStudioMedia(payload) {
  const res = await fetch('/api/module8?action=upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function fetchStudioJobs(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.product_slug) params.set('product_slug', filters.product_slug);
  if (filters.collection_id) params.set('collection_id', filters.collection_id);
  if (filters.selected_engine) params.set('selected_engine', filters.selected_engine);

  const qs = params.toString() ? `&${params.toString()}` : '';
  const res = await fetch(`/api/module8?action=jobs${qs}`, { cache: 'no-store' });
  return res.json();
}

export async function fetchJobDetail(jobId) {
  const res = await fetch(`/api/module8?action=job-detail&id=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
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
  const res = await fetch('/api/module8?action=job-cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: jobId })
  });
  return res.json();
}

export async function retryStudioJob(jobId) {
  const res = await fetch('/api/module8?action=job-retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: jobId })
  });
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

// Aliases for unified SDK compatibility
export const fetchOverview = fetchStudioOverview;
export const fetchJobs = fetchStudioJobs;
export const submitJob = submitStudioJob;
export const cancelJob = cancelStudioJob;
export const retryJob = retryStudioJob;
export const fetchCatalogRef = fetchCatalogProducts;
export const uploadMedia = uploadStudioMedia;

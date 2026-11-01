// Module 1 CMS API client. No service-role credentials are used in the browser.
export class CmsApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'CmsApiError';
    this.status = status;
  }
}

async function request(path = '', options = {}) {
  const session = await window.novaSupabaseAuth?.getSession?.();
  const accessToken = session?.data?.session?.access_token;
  if (!accessToken) throw new CmsApiError('Önce yönetici hesabıyla oturum açın.', 401);

  const response = await fetch(`/api/module1-content${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    cache: 'no-store'
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new CmsApiError(result.error || 'CMS isteği başarısız.', response.status);
  }
  return result;
}

export const cmsApi = Object.freeze({
  listRevisions: () => request(),
  getRevision: (id) => request(`?id=${encodeURIComponent(id)}`),
  saveDraft: (entityType, entitySlug, payload) =>
    request('', { method: 'POST', body: JSON.stringify({ action: 'save-draft', entity_type: entityType, entity_slug: entitySlug, payload }) }),
  publish: (revisionId) =>
    request('', { method: 'POST', body: JSON.stringify({ action: 'publish', revision_id: revisionId }) })
});

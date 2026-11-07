(function () {
  class CmsApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'CmsApiError';
      this.status = status;
    }
  }

  async function request(path = '', options = {}) {
    const client = window.module1SupabaseClient;
    let accessToken = null;
    if (client?.auth) {
      try {
        const { data } = await client.auth.getSession();
        accessToken = data?.session?.access_token || null;
      } catch (_) {}
    }

    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`/api/module1-content${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new CmsApiError(result.error || 'CMS isteği başarısız.', response.status);
    }
    return result;
  }

  window.Module1CmsApi = Object.freeze({
    listRevisions: () => request(),
    getRevision: (id) => request(`?id=${encodeURIComponent(id)}`),
    saveDraft: (entityType, entitySlug, payload) => request('', {
      method: 'POST',
      body: { action: 'save-draft', entity_type: entityType, entity_slug: entitySlug, payload }
    }),
    saveDirect: (entityType, entitySlug, payload) => request('', {
      method: 'POST',
      body: { action: 'direct-save', entity_type: entityType, entity_slug: entitySlug, payload }
    }),
    publish: (revisionId) => request('', {
      method: 'POST',
      body: { action: 'publish', revision_id: revisionId }
    })
  });
})();

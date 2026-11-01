(function () {
  class CmsApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'CmsApiError';
      this.status = status;
    }
  }

  async function request(options = {}) {
    const client = window.module1SupabaseClient;
    if (!client?.auth) throw new CmsApiError('Supabase istemcisi hazır değil.', 503);
    const { data, error } = await client.auth.getSession();
    if (error) throw new CmsApiError(error.message, 401);
    const accessToken = data?.session?.access_token;
    if (!accessToken) throw new CmsApiError('Önce yetkili yönetici hesabıyla oturum açın.', 401);

    const response = await fetch('/api/module1-content', {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new CmsApiError(result.error || 'CMS isteği başarısız.', response.status);
    }
    return result;
  }

  window.Module1CmsApi = Object.freeze({
    listRevisions: () => request(),
    getRevision: (id) => request({ method: 'GET', url: `?id=${encodeURIComponent(id)}` }),
    saveDraft: (entityType, entitySlug, payload) => request({
      method: 'POST',
      body: { action: 'save-draft', entity_type: entityType, entity_slug: entitySlug, payload }
    }),
    publish: (revisionId) => request({
      method: 'POST',
      body: { action: 'publish', revision_id: revisionId }
    })
  });

  // Query-string support is intentionally kept same-origin and fixed to this endpoint.
  const originalRequest = window.Module1CmsApi;
  window.Module1CmsApi.getRevision = (id) => {
    const client = window.module1SupabaseClient;
    return (async () => {
      const { data, error } = await client.auth.getSession();
      if (error || !data?.session?.access_token) throw new CmsApiError('Oturum bulunamadı.', 401);
      const response = await fetch(`/api/module1-content?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: 'no-store'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new CmsApiError(result.error || 'Taslak alınamadı.', response.status);
      return result;
    })();
  };
})();

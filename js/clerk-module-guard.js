// ============================================================================
// GLOBAL KAPAK MOBİLYA — DOĞRUDAN MODÜL URL & IFRAME CLERK YETKİ KORUMASI
// Alt modüllere (/Module 1, /Module 2, /Module 7, /Module 8) doğrudan URL ile
// girildiğinde veya iframe içinde çalıştığında:
// 1. Clerk JWT'sini tüm /api/* isteklerine otomatik ekler.
// 2. Kurum üyeliği (orgId) olmayan bireysel müşterileri ve yetkisiz departmanları engeller.
// 3. 'viewer' departmanı için Salt Okunur (Read-Only) kilidini uygular.
// ============================================================================

(function () {
  const CLERK_PK = 'pk_live_Y2xlcmsuZ2xvYmFsa2FwYWttb2JpbHlhLmNvbSQ';
  const LEGACY_TOKEN_KEY = 'sb-vrfujrpsjzqjthaqdalx-auth-token';

  function detectCurrentModuleRoute() {
    const p = decodeURIComponent(window.location.pathname || '').toLowerCase();
    if (p.includes('module 1') || p.includes('module1')) return 'website';
    if (p.includes('module 2') || p.includes('module2')) return 'social';
    if (p.includes('module 3') || p.includes('module3')) return 'crm';
    if (p.includes('module 4') || p.includes('module4')) return 'production';
    if (p.includes('module 7') || p.includes('module7')) return 'products';
    if (p.includes('module 8') || p.includes('module8')) return 'studio';
    return 'products';
  }

  function getStoredToken() {
    try {
      const direct = sessionStorage.getItem('gm_clerk_jwt');
      if (direct) return direct;
      const raw = localStorage.getItem(LEGACY_TOKEN_KEY) || sessionStorage.getItem(LEGACY_TOKEN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) return parsed.access_token;
      }
    } catch (_) {}
    return '';
  }

  function getStoredProfile() {
    try {
      const raw = sessionStorage.getItem('gm_clerk_profile');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function applyViewerReadOnlyLock(profile) {
    if (!profile || (profile.department !== 'viewer' && profile.canWrite !== false)) return;
    document.body?.classList.add('erp-viewer-readonly');
    if (!document.getElementById('erp-viewer-readonly-style')) {
      const st = document.createElement('style');
      st.id = 'erp-viewer-readonly-style';
      st.textContent = `
        body.erp-viewer-readonly button[type="submit"],
        body.erp-viewer-readonly .btn-emerald,
        body.erp-viewer-readonly .btn-danger,
        body.erp-viewer-readonly [onclick*="save"],
        body.erp-viewer-readonly [onclick*="Save"],
        body.erp-viewer-readonly [onclick*="delete"],
        body.erp-viewer-readonly [onclick*="Delete"],
        body.erp-viewer-readonly [onclick*="create"],
        body.erp-viewer-readonly [onclick*="Create"],
        body.erp-viewer-readonly [onclick*="publish"],
        body.erp-viewer-readonly [onclick*="Publish"] {
          opacity: 0.45 !important;
          pointer-events: none !important;
          cursor: not-allowed !important;
        }
      `;
      document.head?.appendChild(st);
    }
  }

  // Tüm /api/* çağrılarına Clerk JWT başlığını ekle
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const urlStr = typeof input === 'string' ? input : (input?.url || '');
    const isApi = urlStr.startsWith('/api/') || urlStr.includes('/api/module');
    if (isApi) {
      const profile = getStoredProfile();
      const method = String(init.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
      const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);

      if (isMutation && profile && (profile.department === 'viewer' || profile.canWrite === false)) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'VIEWER_READ_ONLY',
            error: 'Salt Okunur Yetki (Viewer): Oluşturma, düzenleme veya silme işlemi yapılamaz.'
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const token = getStoredToken();
      if (token) {
        const headers = new Headers(init.headers || (typeof input === 'object' ? input.headers : undefined) || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init = { ...init, headers };
      }
    }
    return nativeFetch(input, init);
  };

  async function verifyDirectUrlAccess() {
    const moduleRoute = detectCurrentModuleRoute();
    const isInsideIframe = window.self !== window.top;

    let token = getStoredToken();
    if (!token && !isInsideIframe) {
      // Doğrudan URL ile girildiyse Clerk SDK yükleyip aktif oturumu kontrol et
      try {
        const clerkSources = [
          'https://clerk.globalkapakmobilya.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js',
          'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6/dist/clerk.browser.js'
        ];
        for (const src of clerkSources) {
          if (window.Clerk) break;
          try {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = src;
              s.async = true;
              s.crossOrigin = 'anonymous';
              s.setAttribute('data-clerk-publishable-key', CLERK_PK);
              s.onload = resolve;
              s.onerror = reject;
              document.head.appendChild(s);
            });
          } catch (_) {}
        }
        if (window.Clerk) {
          if (!window.Clerk.loaded) {
            await window.Clerk.load({ publishableKey: CLERK_PK });
          }
          if (window.Clerk.session) {
            token = await window.Clerk.session.getToken();
            if (token) sessionStorage.setItem('gm_clerk_jwt', token);
          }
        }
      } catch (_) {}
    }

    if (!token) {
      if (!isInsideIframe) {
        window.location.replace(`/#${moduleRoute}`);
      }
      return;
    }

    try {
      const res = await nativeFetch('/api/clerk-session', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.user) {
        if (!isInsideIframe) window.location.replace(`/#${moduleRoute}`);
        return;
      }

      const user = data.user;
      sessionStorage.setItem('gm_clerk_profile', JSON.stringify(user));

      if (!user.isOrganizationMember) {
        window.top.location.replace('/#');
        return;
      }

      const allowed = Array.isArray(user.allowedRoutes) ? user.allowedRoutes : [];
      if (user.department !== 'admin' && !allowed.includes(moduleRoute)) {
        if (!isInsideIframe) {
          window.location.replace(`/#${user.defaultRoute || 'products'}`);
        } else {
          document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#090d16;color:#f8fafc;font-family:sans-serif;padding:24px;text-align:center;">
              <div style="max-width:460px;padding:32px;border:1px solid rgba(239,68,68,0.4);border-radius:18px;background:#111827;">
                <div style="font-size:36px;margin-bottom:12px;">🔒</div>
                <h2 style="margin:0 0 10px;color:#f87171;">Departman Yetki Sınırı (403)</h2>
                <p style="color:#94a3b8;font-size:13.5px;line-height:1.6;">
                  <strong>${user.departmentLabel}</strong> departmanı bu modüle doğrudan erişim yetkisine sahip değildir.
                </p>
              </div>
            </div>
          `;
        }
        return;
      }

      applyViewerReadOnlyLock(user);
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verifyDirectUrlAccess);
  } else {
    verifyDirectUrlAccess();
  }
})();

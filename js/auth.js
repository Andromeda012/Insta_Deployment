// ============================================================================
// GLOBAL KAPAK MOBİLYA — ERP CLERK AUTHENTICATION & DEPARTMENT RBAC ENGINE
// Tek Clerk Production Uygulaması (pk_live_...) üzerinden:
// 1. Kurum Ayrımı: Global Kapak Mobilya Organization (orgId) üyesi olmayan
//    bireysel B2C müşterilerini ERP'ye kesinlikle almaz (Vitrine yönlendirir).
// 2. Departman Bazlı Yetkilendirme (publicMetadata.department):
//    admin | factory | sales | social_media | viewer
// 3. Tüm API çağrılarına ve alt modül iframe'lerine Clerk JWT'sini enjekte eder.
// ============================================================================

export const CLERK_PUBLISHABLE_KEY = 'pk_live_Y2xlcmsuZ2xvYmFsa2FwYWttb2JpbHlhLmNvbSQ';
export const GLOBAL_KAPAK_ORG_ID = 'org_3MQEn3zykDenqO7WuKDpWfKDInY';
export const VITRIN_URL = 'https://beta.globalkapakmobilya.com';
const LEGACY_TOKEN_STORAGE_KEY = 'sb-vrfujrpsjzqjthaqdalx-auth-token';

export const DEPARTMENT_MATRIX = {
  admin: {
    id: 'admin',
    label: 'Sistem & Kurum Yöneticisi (Admin)',
    badge: 'org:admin',
    canWrite: true,
    allowedRoutes: ['website', 'social', 'crm', 'production', 'operations', 'analytics', 'products', 'studio', 'permissions'],
    defaultRoute: 'products',
    legacyRoles: ['admin', 'product_manager', 'content_manager', 'production_manager', 'mrp_manager', 'crm_sales', 'social_operator']
  },
  factory: {
    id: 'factory',
    label: 'Fabrika & Üretim Planlama (MRP)',
    badge: 'mrp_manager',
    canWrite: true,
    allowedRoutes: ['production', 'products', 'studio'],
    defaultRoute: 'production',
    legacyRoles: ['factory', 'mrp_manager', 'production_manager', 'product_manager']
  },
  sales: {
    id: 'sales',
    label: 'CRM, Satış & Teklif Yönetimi',
    badge: 'crm_sales',
    canWrite: true,
    allowedRoutes: ['crm', 'products'],
    defaultRoute: 'crm',
    legacyRoles: ['sales', 'crm_sales', 'product_manager']
  },
  social_media: {
    id: 'social_media',
    label: 'Sosyal Medya Botları & İçerik Stüdyosu',
    badge: 'social_operator',
    canWrite: true,
    allowedRoutes: ['social', 'website', 'studio'],
    defaultRoute: 'social',
    legacyRoles: ['social_media', 'social_operator', 'content_manager']
  },
  viewer: {
    id: 'viewer',
    label: 'Salt Okunur Denetçi (Viewer)',
    badge: 'viewer',
    canWrite: false,
    allowedRoutes: ['website', 'social', 'crm', 'production', 'operations', 'analytics', 'products', 'studio'],
    defaultRoute: 'analytics',
    legacyRoles: ['viewer']
  }
};

let activeClerkProfile = null;
let fetchInterceptorInstalled = false;

export function normalizeDepartment(rawDept, orgRole = '') {
  const d = String(rawDept || '').toLowerCase().trim();
  const r = String(orgRole || '').toLowerCase().trim();
  if (r === 'org:admin' || r === 'admin' || d === 'admin') return 'admin';
  if (d === 'factory' || d === 'mrp_manager' || d === 'mrp' || d === 'production') return 'factory';
  if (d === 'sales' || d === 'crm_sales' || d === 'crm') return 'sales';
  if (d === 'social_media' || d === 'social_operator' || d === 'social') return 'social_media';
  if (d === 'viewer' || d === 'read_only' || d === 'readonly') return 'viewer';
  return '';
}

export function getDepartmentConfig(deptId) {
  return DEPARTMENT_MATRIX[deptId] || DEPARTMENT_MATRIX.viewer;
}

export function getUserRoles(user) {
  const dept = user?.department || user?.app_metadata?.department || normalizeDepartment(user?.publicMetadata?.department, user?.orgRole);
  const cfg = getDepartmentConfig(dept);
  const roles = [dept, ...(cfg?.legacyRoles || []), ...(user?.app_metadata?.roles || [])].filter(Boolean);
  return [...new Set(roles)];
}

export function canDepartmentAccessRoute(department, route) {
  const cfg = getDepartmentConfig(department);
  if (!cfg) return false;
  if (department === 'admin') return true;
  if (route === 'permissions') return department === 'admin';
  return cfg.allowedRoutes.includes(route);
}

export function isViewerReadOnly(user = activeClerkProfile) {
  const dept = user?.department || activeClerkProfile?.department;
  return dept === 'viewer' || user?.canWrite === false;
}

async function loadClerkUIScript() {
  if (window.__internal_ClerkUICtor) return window.__internal_ClerkUICtor;

  const uiSources = [
    'https://clerk.globalkapakmobilya.com/npm/@clerk/ui@1/dist/ui.browser.js',
    'https://cdn.jsdelivr.net/npm/@clerk/ui@1/dist/ui.browser.js'
  ];

  for (const src of uiSources) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      if (window.__internal_ClerkUICtor) return window.__internal_ClerkUICtor;
    } catch (_) {}
  }
  return null;
}

async function loadClerkBrowserScript() {
  await loadClerkUIScript();
  if (window.Clerk) return window.Clerk;

  const sources = [
    'https://clerk.globalkapakmobilya.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js',
    'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6/dist/clerk.browser.js'
  ];

  for (const src of sources) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-clerk-publishable-key', CLERK_PUBLISHABLE_KEY);
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      if (window.Clerk) return window.Clerk;
    } catch (_) {}
  }
  throw new Error('Clerk kimlik doğrulama servisi yüklenemedi.');
}

async function syncClerkTokenToStorage() {
  try {
    if (!window.Clerk?.session) return '';
    const token = await window.Clerk.session.getToken();
    if (token) {
      const legacyPayload = JSON.stringify({
        access_token: token,
        token_type: 'bearer',
        user: activeClerkProfile
      });
      localStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, legacyPayload);
      sessionStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, legacyPayload);
      sessionStorage.setItem('gm_clerk_jwt', token);
      if (activeClerkProfile) {
        sessionStorage.setItem('gm_clerk_profile', JSON.stringify(activeClerkProfile));
      }
    }
    return token || '';
  } catch (_) {
    return '';
  }
}

function installGlobalClerkFetchInterceptor() {
  if (fetchInterceptorInstalled || typeof window === 'undefined') return;
  fetchInterceptorInstalled = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function (input, init = {}) {
    const urlStr = typeof input === 'string' ? input : (input?.url || '');
    const isLocalApi = urlStr.startsWith('/api/') || urlStr.includes('/api/module');

    if (isLocalApi) {
      const method = String(init.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
      const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);

      // Viewer departmanı için istemci tarafında yazma engeli
      if (isMutation && isViewerReadOnly() && !urlStr.includes('action=clerk-session')) {
        if (typeof window.showToast === 'function') {
          window.showToast('🔒 Salt Okunur Yetki (Viewer): Oluşturma, düzenleme veya silme işlemi yapılamaz.');
        }
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'VIEWER_READ_ONLY',
            error: 'Salt Okunur Yetki (Viewer): Oluşturma, düzenleme veya silme işlemi yapılamaz.'
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const token = await syncClerkTokenToStorage();
      if (token) {
        const headers = new Headers(init.headers || (typeof input === 'object' ? input.headers : undefined) || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        if (activeClerkProfile?.orgId) {
          headers.set('X-Clerk-Org-Id', activeClerkProfile.orgId);
        }
        if (activeClerkProfile?.department) {
          headers.set('X-Clerk-Department', activeClerkProfile.department);
        }
        init = { ...init, headers };
      }
    }

    return nativeFetch(input, init);
  };
}

export function enforceReadOnlyDomLockIfNeeded(rootDoc = document) {
  if (!isViewerReadOnly()) {
    rootDoc.body?.classList.remove('erp-viewer-readonly');
    return;
  }
  rootDoc.body?.classList.add('erp-viewer-readonly');

  if (!rootDoc.getElementById('erp-viewer-readonly-style')) {
    const st = rootDoc.createElement('style');
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
    rootDoc.head?.appendChild(st);
  }
}

export async function signOutCentral() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem('gm_clerk_jwt');
    sessionStorage.removeItem('gm_clerk_profile');
    if (window.Clerk) {
      await window.Clerk.signOut();
    }
  } catch (_) {}
  window.location.reload();
}

function buildAuthOverlayContainer() {
  let overlay = document.getElementById('gm-central-auth');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'gm-central-auth';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(5,10,20,.97);backdrop-filter:blur(18px);font-family:"Plus Jakarta Sans",sans-serif;overflow-y:auto;';

  const style = document.createElement('style');
  style.textContent = `
    .gm-clerk-shell{width:min(480px,100%);padding:34px;border:1px solid rgba(212,175,55,.28);border-radius:24px;background:#0f172a;color:#f8fafc;box-shadow:0 30px 100px rgba(0,0,0,.78);text-align:center}
    .gm-clerk-mark{width:52px;height:52px;margin:0 auto 16px;display:grid;place-items:center;border-radius:15px;background:linear-gradient(135deg,#d4af37,#f59e0b);color:#111827;font-weight:900;font-size:18px}
    .gm-clerk-eyebrow{font-size:10.5px;letter-spacing:2px;font-weight:800;color:#d4af37;text-transform:uppercase}
    .gm-clerk-shell h1{font-size:24px;margin:8px 0 6px;color:#fff}
    .gm-clerk-copy{font-size:13px;line-height:1.6;color:#94a3b8;margin:0 0 20px}
    #gm-clerk-mount{display:flex;justify-content:center;min-height:320px}
    .gm-unauth-box{padding:22px;border-radius:16px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);color:#fecaca;text-align:left;margin-top:14px}
    .gm-unauth-box h3{color:#f87171;margin:0 0 8px;font-size:16px}
    .gm-unauth-box p{margin:0 0 16px;font-size:13px;line-height:1.55;color:#e2e8f0}
    .gm-btn-row{display:flex;flex-direction:column;gap:10px;margin-top:16px}
    .gm-btn-gold{padding:13px 18px;border:0;border-radius:10px;background:linear-gradient(135deg,#d4af37,#f59e0b);color:#111827;font-weight:800;font-size:13px;cursor:pointer;text-decoration:none;display:inline-block;text-align:center}
    .gm-btn-ghost{padding:12px 18px;border:1px solid rgba(148,163,184,.3);border-radius:10px;background:rgba(255,255,255,.04);color:#cbd5e1;font-weight:700;font-size:12.5px;cursor:pointer}
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  return overlay;
}

export async function initializeCentralAuth() {
  installGlobalClerkFetchInterceptor();
  const overlay = buildAuthOverlayContainer();

  overlay.innerHTML = `
    <div class="gm-clerk-shell">
      <div class="gm-clerk-mark">GM</div>
      <div class="gm-clerk-eyebrow">GLOBAL KAPAK MOBİLYA • KURUMSAL ERP &amp; MRP</div>
      <h1>Kurumsal Oturum Doğrulanıyor</h1>
      <p class="gm-clerk-copy">Clerk kimlik doğrulama ve organizasyon yetkileriniz kontrol ediliyor…</p>
      <div id="gm-clerk-mount"></div>
    </div>
  `;

  const clerk = await loadClerkBrowserScript();
  if (!clerk.loaded) {
    await clerk.load({
      publishableKey: CLERK_PUBLISHABLE_KEY,
      ...(window.__internal_ClerkUICtor ? { ui: { ClerkUI: window.__internal_ClerkUICtor } } : {})
    });
  }

  return new Promise(async (resolve) => {
    const evaluateCurrentUser = async () => {
      if (!clerk.user || !clerk.session) {
        overlay.innerHTML = `
          <div class="gm-clerk-shell">
            <div class="gm-clerk-mark">GM</div>
            <div class="gm-clerk-eyebrow">GLOBAL KAPAK MOBİLYA • KURUMSAL ERP &amp; MRP</div>
            <h1>Kurumsal Personel Girişi</h1>
            <p class="gm-clerk-copy">Yalnızca Global Kapak Mobilya organizasyonuna kayıtlı yetkili personel giriş yapabilir.</p>
            <div id="gm-clerk-mount"></div>
          </div>
        `;
        const mountNode = document.getElementById('gm-clerk-mount');
        if (mountNode) {
          clerk.mountSignIn(mountNode, {
            routing: 'virtual'
          });
        }
        return false;
      }

      // Kullanıcının organizasyon üyeliğini (Global Kapak Mobilya) kontrol et
      const memberships = Array.isArray(clerk.user.organizationMemberships)
        ? clerk.user.organizationMemberships
        : [];
      const orgMem = memberships.find(m => m.organization?.id === GLOBAL_KAPAK_ORG_ID) || memberships[0] || null;

      if (orgMem?.organization?.id && clerk.organization?.id !== orgMem.organization.id) {
        try {
          await clerk.setActive({ organization: orgMem.organization.id });
        } catch (_) {}
      }

      const token = await clerk.session.getToken();

      // Sunucu üzerinden de Clerk JWT + Organizasyon + publicMetadata.department doğrulaması yap
      let serverUser = null;
      try {
        const verifyRes = await fetch('/api/clerk-session', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });
        const verifyJson = await verifyRes.json().catch(() => null);
        if (verifyRes.ok && verifyJson?.user) {
          serverUser = verifyJson.user;
        }
      } catch (_) {}

      const resolvedOrgId = serverUser?.orgId || orgMem?.organization?.id || clerk.organization?.id || '';
      const resolvedOrgRole = serverUser?.orgRole || orgMem?.role || '';
      const isOrgMember = Boolean(
        serverUser
          ? serverUser.isOrganizationMember
          : (resolvedOrgId && resolvedOrgId === GLOBAL_KAPAK_ORG_ID)
      );

      // KURAL 1: Global Kapak Mobilya Clerk Organization (orgId) üyeliği olmayan bireysel müşterileri ERP'ye kesinlikle alma!
      if (!isOrgMember) {
        const userEmail = clerk.user.primaryEmailAddress?.emailAddress || clerk.user.username || 'Bireysel Hesap';
        overlay.innerHTML = `
          <div class="gm-clerk-shell">
            <div class="gm-clerk-mark">⛔</div>
            <div class="gm-clerk-eyebrow">YETKİSİZ KURUMSAL ERİŞİM</div>
            <h1>Kurumsal Organizasyon Üyeliği Bulunamadı</h1>
            <div class="gm-unauth-box">
              <h3>🔒 Bireysel Müşteri Hesabı İle ERP Paneline Girilemez</h3>
              <p>
                <strong>${userEmail}</strong> hesabı bireysel vitrin müşterisi olarak kayıtlıdır ve
                <strong>Global Kapak Mobilya</strong> kurumsal organizasyonuna (<code>orgId</code>) üye değildir.
              </p>
              <p style="margin-bottom:0;">
                Ürün kataloğunu incelemek ve teklif almak için Kurumsal Vitrin sitemize gidebilir veya yetkili personel hesabınızla giriş yapabilirsiniz.
              </p>
            </div>
            <div class="gm-btn-row">
              <a class="gm-btn-gold" href="${VITRIN_URL}">🌐 Kurumsal Vitrine Git (beta.globalkapakmobilya.com) →</a>
              <button type="button" class="gm-btn-ghost" id="gm-unauth-signout-btn">↪ Çıkış Yap ve Farklı Bir Personel Hesabıyla Giriş Yap</button>
            </div>
          </div>
        `;
        document.getElementById('gm-unauth-signout-btn')?.addEventListener('click', async () => {
          await signOutCentral();
        });
        return false;
      }

      // KURAL 2: publicMetadata.department bazlı departman ve yetki profili oluştur
      const rawDept = serverUser?.department
        || clerk.user.publicMetadata?.department
        || clerk.session?.publicUserData?.publicMetadata?.department
        || '';
      const department = normalizeDepartment(rawDept, resolvedOrgRole) || 'viewer';
      const deptCfg = getDepartmentConfig(department);

      const primaryEmail = serverUser?.email
        || clerk.user.primaryEmailAddress?.emailAddress
        || `${clerk.user.username || 'personel'}@globalkapakmobilya.com`;
      const displayName = serverUser?.fullName
        || [clerk.user.firstName, clerk.user.lastName].filter(Boolean).join(' ').trim()
        || clerk.user.username
        || primaryEmail;

      activeClerkProfile = {
        id: clerk.user.id,
        clerk_user_id: clerk.user.id,
        email: primaryEmail,
        username: clerk.user.username || displayName,
        fullName: displayName,
        orgId: resolvedOrgId,
        orgRole: resolvedOrgRole || 'org:member',
        isOrganizationMember: true,
        department,
        departmentLabel: deptCfg.label,
        departmentBadge: deptCfg.badge,
        canWrite: deptCfg.canWrite,
        allowedRoutes: deptCfg.allowedRoutes,
        defaultRoute: deptCfg.defaultRoute,
        app_metadata: {
          department,
          org_id: resolvedOrgId,
          org_role: resolvedOrgRole,
          roles: [department, ...deptCfg.legacyRoles]
        }
      };

      await syncClerkTokenToStorage();
      enforceReadOnlyDomLockIfNeeded(document);

      // Her 40 saniyede bir Clerk oturum jetonunu tazele
      setInterval(() => { syncClerkTokenToStorage(); }, 40000);

      overlay.remove();
      resolve(activeClerkProfile);
      return true;
    };

    const done = await evaluateCurrentUser();
    if (!done) {
      clerk.addListener(async () => {
        if (clerk.user && clerk.session && document.getElementById('gm-central-auth')) {
          await evaluateCurrentUser();
        }
      });
    }
  });
}

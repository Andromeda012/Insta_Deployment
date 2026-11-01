const SUPABASE_URL = 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';
const REMEMBER_KEY = 'gm_auth_remember_device';
const STORAGE_KEY = 'sb-vrfujrpsjzqjthaqdalx-auth-token';
let client = null;
let clientMode = null;

function rememberChoice() {
  try { return localStorage.getItem(REMEMBER_KEY) === '1'; } catch { return false; }
}

function createAuthClient(remember) {
  if (!window.supabase?.createClient) throw new Error('Kimlik doğrulama kütüphanesi yüklenemedi.');
  clientMode = remember ? 'local' : 'session';
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: remember ? window.localStorage : window.sessionStorage,
      storageKey: STORAGE_KEY
    }
  });
  return client;
}

export function getCentralAuthClient() {
  const mode = rememberChoice() ? 'local' : 'session';
  return client && clientMode === mode ? client : createAuthClient(mode === 'local');
}

export function getUserRoles(user) {
  const meta = user?.app_metadata || {};
  const roles = Array.isArray(meta.roles) ? meta.roles : (meta.role ? [meta.role] : []);
  return [...new Set(roles.filter(role => typeof role === 'string'))];
}

export async function signOutCentral() {
  const auth = getCentralAuthClient();
  await auth.auth.signOut();
  try {
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
  client = null;
  clientMode = null;
  window.location.reload();
}

function buildLoginOverlay() {
  let overlay = document.getElementById('gm-central-auth');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'gm-central-auth';
  overlay.innerHTML = `
    <div class="gm-auth-card">
      <div class="gm-auth-mark">GM</div>
      <div class="gm-auth-eyebrow">GLOBAL MOBİLYA • OPERASYON PLATFORMU</div>
      <h1>Hoş geldiniz</h1>
      <p class="gm-auth-copy">Platforma devam etmek için yetkili hesabınızla giriş yapın.</p>
      <form id="gm-auth-form">
        <label for="gm-auth-email">E-posta adresi</label>
        <input id="gm-auth-email" type="email" autocomplete="username" required placeholder="ornek@globalmobilya.com.tr">
        <label for="gm-auth-password">Şifre</label>
        <input id="gm-auth-password" type="password" autocomplete="current-password" required placeholder="Şifreniz">
        <label class="gm-remember-row"><input id="gm-auth-remember" type="checkbox" checked> <span><strong>Bu cihazda oturumu açık tut</strong><small>Yalnızca güvendiğiniz kişisel cihazlarda etkinleştirin.</small></span></label>
        <div id="gm-auth-error" role="alert" aria-live="polite"></div>
        <button id="gm-auth-submit" type="submit">Giriş Yap <span>→</span></button>
      </form>
      <div class="gm-auth-foot">Güvenli kimlik doğrulama • Supabase Auth</div>
    </div>`;
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(5,10,20,.97);backdrop-filter:blur(16px);font-family:inherit;';
  const style = document.createElement('style');
  style.textContent = `
    .gm-auth-card{width:min(440px,100%);padding:36px;border:1px solid rgba(148,163,184,.2);border-radius:22px;background:#111b2e;color:#f8fafc;box-shadow:0 30px 100px #0009}
    .gm-auth-mark{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(135deg,#d4af37,#f59e0b);color:#111827;font-weight:900;font-size:17px;margin-bottom:22px}
    .gm-auth-eyebrow{font-size:10px;letter-spacing:1.5px;font-weight:800;color:#d4af37}
    .gm-auth-card h1{font-size:28px;margin:9px 0}.gm-auth-copy{font-size:13px;line-height:1.6;color:#94a3b8;margin:0 0 25px}
    .gm-auth-card form>label:not(.gm-remember-row){display:block;font-size:12px;font-weight:700;color:#cbd5e1;margin:14px 0 7px}
    .gm-auth-card form>input{width:100%;padding:13px 14px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:#fff;font:inherit;outline:none}
    .gm-auth-card form>input:focus{border-color:#38bdf8}
    .gm-remember-row{display:flex;align-items:flex-start;gap:10px;margin:18px 0;color:#e2e8f0;font-size:12px;cursor:pointer}
    .gm-remember-row input{width:16px;height:16px;accent-color:#d4af37;margin-top:1px}
    .gm-remember-row span{display:grid;gap:4px}.gm-remember-row small{font-size:11px;color:#94a3b8}
    #gm-auth-error{min-height:18px;color:#fca5a5;font-size:12px;margin:8px 0}
    #gm-auth-submit{width:100%;padding:14px;border:0;border-radius:10px;background:linear-gradient(135deg,#d4af37,#f59e0b);color:#111827;font-weight:900;font-size:13px;cursor:pointer}
    #gm-auth-submit:disabled{opacity:.65;cursor:wait}#gm-auth-submit span{float:right;font-size:17px}
    .gm-auth-foot{text-align:center;font-size:10px;color:#64748b;margin-top:22px}
    @media(max-width:520px){.gm-auth-card{padding:26px 22px}}
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  return overlay;
}

export async function initializeCentralAuth() {
  const overlay = buildLoginOverlay();
  const form = document.getElementById('gm-auth-form');
  const rememberInput = document.getElementById('gm-auth-remember');
  rememberInput.checked = rememberChoice();
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  let completed = false;
  const finish = user => {
    if (completed) return;
    completed = true;
    overlay.remove();
    resolveReady(user);
  };

  const validateAndFinish = async session => {
    const user = session?.user;
    const roles = getUserRoles(user);
    if (!user || !roles.length) return false;
    finish(user);
    return true;
  };

  try {
    const auth = getCentralAuthClient();
    const { data, error } = await auth.auth.getSession();
    if (error) throw error;
    if (data.session && await validateAndFinish(data.session)) {
      auth.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) window.location.reload();
      });
      return ready;
    }
  } catch (error) {
    document.getElementById('gm-auth-error').textContent = error.message || 'Oturum kontrol edilemedi.';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('gm-auth-submit');
    const errorBox = document.getElementById('gm-auth-error');
    button.disabled = true;
    button.textContent = 'Giriş yapılıyor…';
    errorBox.textContent = '';
    const remember = rememberInput.checked;
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, '1');
      else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(STORAGE_KEY);
      }
      const auth = createAuthClient(remember);
      const { data, error } = await auth.auth.signInWithPassword({
        email: document.getElementById('gm-auth-email').value.trim(),
        password: document.getElementById('gm-auth-password').value
      });
      if (error) throw error;
      if (!getUserRoles(data.user).length) {
        await auth.auth.signOut();
        throw new Error('Bu hesaba henüz bir platform rolü atanmamış. Sistem yöneticisiyle iletişime geçin.');
      }
      auth.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) window.location.reload();
      });
      finish(data.user);
    } catch (error) {
      errorBox.textContent = error.message || 'Giriş yapılamadı.';
    } finally {
      button.disabled = false;
      button.innerHTML = 'Giriş Yap <span>→</span>';
    }
  });

  return ready;
}

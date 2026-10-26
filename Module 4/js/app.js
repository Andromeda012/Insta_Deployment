let orders = [];
let stages = [];
let settings = {};
let currentView = 'kanban';
let searchFilter = '';
let stageFilter = 'all';
let priorityFilter = 'all';

async function initApp() {
  updateUserUI();
  await loadSettings();
  await loadOrders();
  setupSSE();
  setupEventListeners();
  renderView();
}

function updateUserUI() {
  const roleEl = document.getElementById('userRoleBadge');
  const userBtn = document.getElementById('userSwitchBtn');
  const adminOnlyEls = document.querySelectorAll('.admin-only');

  if (currentUser.role === 'admin') {
    roleEl.className = 'role-badge role-admin';
    roleEl.innerHTML = '👑 Yönetici (Yetkili)';
    userBtn.innerText = 'İzleyici Moduna Geç';
    adminOnlyEls.forEach(el => el.style.display = '');
  } else {
    roleEl.className = 'role-badge role-viewer';
    roleEl.innerHTML = '👁️ İzleyici / Atölye';
    userBtn.innerText = 'Yönetici Girişi Yap';
    adminOnlyEls.forEach(el => el.style.display = 'none');
  }
}

function switchUserRole() {
  if (currentUser.role === 'admin') {
    currentUser = {
      role: 'viewer',
      displayName: 'Atölye / İzleyici',
      token: 'token_viewer'
    };
    localStorage.setItem('siparis_user', JSON.stringify(currentUser));
    updateUserUI();
    loadOrders();
    showToast('İzleyici moduna geçildi (Finansal bilgiler gizlendi)', 'info');
  } else {
    openModal('loginModal');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const pass = document.getElementById('loginPass').value;
  const username = document.getElementById('loginUser').value;

  try {
    const res = await apiCall('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: pass })
    });

    if (res.success) {
      currentUser = {
        role: res.user.role,
        displayName: res.user.displayName,
        token: res.token
      };
      localStorage.setItem('siparis_user', JSON.stringify(currentUser));
      closeModal('loginModal');
      updateUserUI();
      loadOrders();
      showToast(`Hoş geldiniz, ${res.user.displayName}!`, 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadSettings() {
  try {
    const res = await apiCall('/api/settings');
    settings = res.settings;
    stages = res.stages;
  } catch (err) {
    console.error('Ayarlar yüklenemedi:', err);
  }
}

async function loadOrders() {
  try {
    let url = `/api/orders?search=${encodeURIComponent(searchFilter)}&stage=${stageFilter}&priority=${priorityFilter}`;
    const res = await apiCall(url);
    orders = res.orders;
    stages = res.stages;
    renderStats();
    renderView();
  } catch (err) {
    console.error('Siparişler alınamadı:', err);
  }
}

function renderView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  if (currentView === 'kanban' || currentView === 'kiosk') {
    renderKanban(container);
  } else if (currentView === 'table') {
    renderTable(container);
  } else if (currentView === 'scanner') {
    renderScannerView(container);
  }
}

function renderScannerView(container) {
  container.className = 'main-content';
  container.innerHTML = `
    <div style="max-width:600px; margin:0 auto; background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:1.5rem; text-align:center; box-shadow:var(--shadow-md);">
      <h2 style="font-size:1.3rem; font-weight:800; margin-bottom:0.5rem;">📷 Sevkiyat & Parça QR Barkod Okuyucu</h2>
      <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1.25rem;">
        Atölyede parçaların üzerindeki veya sipariş fişindeki QR kodu kameraya tutun veya kodu girin.
      </p>

      <div style="margin-bottom:1.25rem; display:flex; gap:0.5rem;">
        <input type="text" id="scanCodeInput" placeholder="Sipariş Takip Kodu (Örn: SIP-2026-X8K9)" class="form-input" style="flex:1; font-size:1rem; text-transform:uppercase;" />
        <button class="btn btn-primary" onclick="processScanCode(document.getElementById('scanCodeInput').value)">
          Sorgula & Sevkiyata Al ➔
        </button>
      </div>

      <div style="background:#000; border-radius:10px; overflow:hidden; position:relative; aspect-ratio:4/3; display:flex; align-items:center; justify-content:center; margin-bottom:1rem;">
        <video id="cameraVideo" style="width:100%; height:100%; object-fit:cover;" autoplay playsinline></video>
        <div id="cameraPlaceholder" style="position:absolute; color:#94a3b8; font-size:0.9rem; text-align:center; padding:1rem;">
          <div>📷 Kamera Başlatılmadı</div>
          <button class="btn btn-secondary" style="margin-top:0.75rem;" onclick="startCamera()">Kamerayı Aç</button>
        </div>
      </div>
      <div style="font-size:0.75rem; color:var(--text-muted);">
        Barkod okutulduğunda yönetici ekranına anlık sesli bildirim ve bakiye kontrolü düşecektir.
      </div>
    </div>
  `;
}

function startCamera() {
  const video = document.getElementById('cameraVideo');
  const placeholder = document.getElementById('cameraPlaceholder');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Tarayıcınız kamera erişimini desteklemiyor.', 'error');
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      video.srcObject = stream;
      if (placeholder) placeholder.style.display = 'none';
      showToast('Kamera açıldı, QR kodu odaklayınız.', 'info');
    })
    .catch(err => {
      showToast('Kamera açılamadı: ' + err.message, 'error');
    });
}

async function processScanCode(code) {
  if (!code || !code.trim()) return;
  try {
    const res = await apiCall('/api/orders/scan-dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() })
    });

    if (res.success) {
      showToast(res.message, 'success');
      loadOrders();
      if (document.getElementById('scanCodeInput')) {
        document.getElementById('scanCodeInput').value = '';
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupEventListeners() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.getAttribute('data-view');
      renderView();
    });
  });

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchFilter = e.target.value;
      loadOrders();
    });
  }

  const stageSelect = document.getElementById('stageSelect');
  if (stageSelect) {
    stageSelect.addEventListener('change', (e) => {
      stageFilter = e.target.value;
      loadOrders();
    });
  }

  const prioritySelect = document.getElementById('prioritySelect');
  if (prioritySelect) {
    prioritySelect.addEventListener('change', (e) => {
      priorityFilter = e.target.value;
      loadOrders();
    });
  }

  const newOrderForm = document.getElementById('newOrderForm');
  if (newOrderForm) {
    newOrderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(newOrderForm);

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'x-user-role': currentUser.role,
            'x-user-name': currentUser.displayName,
            'Authorization': `Bearer ${currentUser.token}`
          },
          body: formData
        });
        const result = await res.json();
        if (result.success) {
          closeModal('newOrderModal');
          newOrderForm.reset();
          showToast('Yeni sipariş başarıyla oluşturuldu!', 'success');
          loadOrders();
        } else {
          showToast(result.message, 'error');
        }
      } catch (err) {
        showToast('Sipariş oluşturulamadı: ' + err.message, 'error');
      }
    });
  }

  const fireForm = document.getElementById('fireForm');
  if (fireForm) fireForm.addEventListener('submit', handleFireSubmit);

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
      themeToggleBtn.innerText = isDark ? '🌙' : '☀️';
    });
  }
}

document.addEventListener('DOMContentLoaded', initApp);

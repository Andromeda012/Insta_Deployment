let currentUser = JSON.parse(localStorage.getItem('siparis_user') || '{"role":"viewer","displayName":"Atölye / İzleyici","token":"token_viewer"}');

async function apiCall(url, options = {}) {
  options.headers = options.headers || {};
  options.headers['x-user-role'] = currentUser.role;
  options.headers['x-user-name'] = currentUser.displayName;
  if (currentUser.token) {
    options.headers['Authorization'] = `Bearer ${currentUser.token}`;
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'İstek başarısız oldu' }));
    throw new Error(err.message || 'Hata oluştu');
  }
  return res.json();
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; align-items:flex-end; gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#2563eb';
  toast.style.cssText = `padding:0.75rem 1.25rem; border-radius:8px; font-size:0.85rem; font-weight:600; box-shadow:0 4px 12px rgba(0,0,0,0.2); background:${bg}; color:white; transition:all 0.3s ease;`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function setupSSE() {
  const eventSource = new EventSource('/api/events');

  eventSource.addEventListener('order_created', (e) => {
    const data = JSON.parse(e.data);
    playChime();
    showToast(`Yeni Sipariş: ${data.customerName} (${data.trackingCode})`, 'success');
    if (typeof loadOrders === 'function') loadOrders();
  });

  eventSource.addEventListener('stage_changed', (e) => {
    const data = JSON.parse(e.data);
    playChime();
    showToast(`Aşama Güncellendi: ${data.customerName} ➔ ${data.newStage.toUpperCase()}`, 'info');
    if (typeof loadOrders === 'function') loadOrders();
  });

  eventSource.addEventListener('fire_reported', (e) => {
    const data = JSON.parse(e.data);
    playAlarm();
    showToast(`⚠️ FİRE / YENİDEN KESİM: ${data.customerName} (${data.fireReport.pieceCount} adet)`, 'error');
    if (typeof loadOrders === 'function') loadOrders();
  });

  eventSource.addEventListener('dispatch_scan', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleDispatchScanAlert === 'function') {
      handleDispatchScanAlert(data);
    }
  });

  eventSource.addEventListener('dispatch_alert', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleDispatchScanAlert === 'function') {
      handleDispatchScanAlert(data);
    }
  });

  eventSource.addEventListener('order_updated', () => { if (typeof loadOrders === 'function') loadOrders(); });
  eventSource.addEventListener('order_deleted', () => { if (typeof loadOrders === 'function') loadOrders(); });
  eventSource.addEventListener('file_added', () => { if (typeof loadOrders === 'function') loadOrders(); });
}

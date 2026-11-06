/**
 * Global Mobilya / Nova Furniture - In-App Feedback & Modal System (Module 1 Bundle)
 */
(function () {
  if (!document.getElementById('site-modal-feedback-styles')) {
    const style = document.createElement('style');
    style.id = 'site-modal-feedback-styles';
    style.textContent = `
      .gkm-confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(11, 31, 75, 0.65);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        padding: 20px;
        box-sizing: border-box;
      }
      .gkm-confirm-overlay.open {
        opacity: 1;
        pointer-events: auto;
      }
      .gkm-confirm-box {
        background: #FFFFFF;
        border-radius: 18px;
        padding: 28px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 25px 60px -15px rgba(11, 31, 75, 0.35), 0 0 0 1px rgba(212, 175, 55, 0.25);
        transform: scale(0.92) translateY(12px);
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #0F172A;
      }
      .gkm-confirm-overlay.open .gkm-confirm-box {
        transform: scale(1) translateY(0);
      }
      .gkm-confirm-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 14px;
      }
      .gkm-confirm-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        flex-shrink: 0;
      }
      .gkm-confirm-icon-wrap.publish {
        background: #ECFDF5;
        color: #059669;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .gkm-confirm-icon-wrap.delete {
        background: #FEF2F2;
        color: #DC2626;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }
      .gkm-confirm-icon-wrap.warning {
        background: #FFFBEB;
        color: #D97706;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }
      .gkm-confirm-icon-wrap.info {
        background: #EFF6FF;
        color: #2563EB;
        border: 1px solid rgba(59, 130, 246, 0.3);
      }
      .gkm-confirm-title {
        font-size: 18px;
        font-weight: 800;
        color: #0B1F4B;
        margin: 0;
        line-height: 1.3;
      }
      .gkm-confirm-body {
        font-size: 13.5px;
        line-height: 1.6;
        color: #475569;
        margin-bottom: 24px;
        word-break: break-word;
      }
      .gkm-confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .gkm-btn {
        padding: 10px 18px;
        font-size: 13px;
        font-weight: 700;
        border-radius: 9px;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .gkm-btn-cancel {
        background: #F1F5F9;
        color: #475569;
        border: 1px solid #E2E8F0;
      }
      .gkm-btn-cancel:hover {
        background: #E2E8F0;
        color: #0F172A;
      }
      .gkm-btn-primary {
        background: linear-gradient(135deg, #1E293B, #0F172A);
        color: #FDE68A;
        border: 1px solid rgba(212, 175, 55, 0.4);
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
      }
      .gkm-btn-primary:hover {
        background: #0F172A;
        color: #FFF;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.28);
      }
      .gkm-btn-danger {
        background: #DC2626;
        color: #FFFFFF;
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
      }
      .gkm-btn-danger:hover {
        background: #B91C1C;
        transform: translateY(-1px);
      }
      .gkm-btn-emerald {
        background: #059669;
        color: #FFFFFF;
        box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
      }
      .gkm-btn-emerald:hover {
        background: #047857;
        transform: translateY(-1px);
      }

      /* TOAST NOTIFICATIONS */
      .gkm-toast-container {
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
        max-width: 440px;
        width: 90%;
      }
      .gkm-toast {
        pointer-events: auto;
        background: rgba(15, 23, 42, 0.94);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: #FFFFFF;
        border-radius: 12px;
        padding: 13px 18px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.45;
        border-left: 4px solid #D4AF37;
        opacity: 0;
        transform: translateY(-12px);
        transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .gkm-toast.show {
        opacity: 1;
        transform: translateY(0);
      }
      .gkm-toast.success { border-left-color: #10B981; }
      .gkm-toast.error { border-left-color: #EF4444; }
      .gkm-toast.warning { border-left-color: #F59E0B; }
      .gkm-toast.info { border-left-color: #38BDF8; }
      .gkm-toast-icon { font-size: 18px; flex-shrink: 0; }
      .gkm-toast-text { flex: 1; word-break: break-word; }
      .gkm-toast-close {
        cursor: pointer;
        opacity: 0.6;
        font-size: 16px;
        padding: 2px 4px;
        transition: opacity 0.2s;
      }
      .gkm-toast-close:hover { opacity: 1; }
    `;
    document.head.appendChild(style);
  }

  function getOrCreateToastContainer() {
    let container = document.getElementById('gkmToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'gkmToastContainer';
      container.className = 'gkm-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  window.showCustomToast = function (message, type = 'success', duration = 3800) {
    if (!document.body) return;
    const container = getOrCreateToastContainer();
    const toast = document.createElement('div');
    toast.className = `gkm-toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span class="gkm-toast-icon">${icon}</span>
      <span class="gkm-toast-text">${String(message || '')}</span>
      <span class="gkm-toast-close">&times;</span>
    `;

    toast.querySelector('.gkm-toast-close').onclick = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    };

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  };

  window.showCustomModalConfirm = function (options = {}) {
    return new Promise((resolve) => {
      let title = 'İşlemi Onaylayın';
      let message = '';
      let confirmText = 'Evet, Devam Et';
      let cancelText = 'İptal';
      let type = 'warning';

      if (typeof options === 'string') {
        message = options;
        if (message.toLowerCase().includes('sil')) {
          type = 'delete';
          title = 'Silme Onayı';
          confirmText = 'Evet, Sil';
        } else if (message.toLowerCase().includes('yayınla')) {
          type = 'publish';
          title = 'Canlı Yayına Gönder';
          confirmText = 'Şimdi Yayınla';
        }
      } else if (options && typeof options === 'object') {
        if (options.title) title = options.title;
        if (options.message) message = options.message;
        if (options.confirmText) confirmText = options.confirmText;
        if (options.cancelText) cancelText = options.cancelText;
        if (options.type) type = options.type;
      }

      let icon = '⚠️';
      let btnClass = 'gkm-btn-primary';
      if (type === 'delete') {
        icon = '🗑️';
        btnClass = 'gkm-btn-danger';
      } else if (type === 'publish') {
        icon = '🚀';
        btnClass = 'gkm-btn-emerald';
      } else if (type === 'info') {
        icon = 'ℹ️';
      }

      const overlay = document.createElement('div');
      overlay.className = 'gkm-confirm-overlay';
      overlay.innerHTML = `
        <div class="gkm-confirm-box" role="dialog" aria-modal="true">
          <div class="gkm-confirm-header">
            <div class="gkm-confirm-icon-wrap ${type}">
              ${icon}
            </div>
            <h3 class="gkm-confirm-title">${title}</h3>
          </div>
          <div class="gkm-confirm-body">${message}</div>
          <div class="gkm-confirm-actions">
            <button type="button" class="gkm-btn gkm-btn-cancel" id="gkmModalCancelBtn">${cancelText}</button>
            <button type="button" class="gkm-btn ${btnClass}" id="gkmModalConfirmBtn">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      function cleanup(res) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 250);
        document.removeEventListener('keydown', handleKey);
        resolve(res);
      }

      function handleKey(e) {
        if (e.key === 'Escape') cleanup(false);
        else if (e.key === 'Enter') cleanup(true);
      }

      document.addEventListener('keydown', handleKey);
      overlay.querySelector('#gkmModalConfirmBtn').onclick = () => cleanup(true);
      overlay.querySelector('#gkmModalCancelBtn').onclick = () => cleanup(false);
      overlay.onclick = (e) => {
        if (e.target === overlay) cleanup(false);
      };

      requestAnimationFrame(() => overlay.classList.add('open'));
    });
  };

  const nativeAlert = window.alert;
  window.alert = function (msg) {
    if (typeof window.showCustomToast === 'function') {
      const isErr = String(msg || '').toLowerCase().includes('hata') || String(msg || '').startsWith('❌');
      const isSucc = String(msg || '').toLowerCase().includes('başarı') || String(msg || '').startsWith('✅');
      window.showCustomToast(msg, isErr ? 'error' : (isSucc ? 'success' : 'info'));
    } else if (typeof nativeAlert === 'function') {
      nativeAlert(msg);
    }
  };
})();

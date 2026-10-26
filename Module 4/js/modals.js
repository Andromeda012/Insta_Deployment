let currentActiveOrder = null;

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function previewImage(src) {
  const modal = document.getElementById('imageModal');
  const img = document.getElementById('previewImg');
  if (modal && img) {
    img.src = src;
    openModal('imageModal');
  }
}

function handleDispatchScanAlert(data) {
  playAlarm();
  if (typeof loadOrders === 'function') loadOrders();

  if (currentUser.role === 'admin') {
    const modal = document.getElementById('dispatchAlertModal');
    const content = document.getElementById('dispatchAlertContent');

    let warningHtml = '';
    if (data.hasUnpaidBalance) {
      warningHtml = `
        <div style="background:#fee2e2; border:2px solid #ef4444; border-radius:10px; padding:1rem; margin-top:1rem; text-align:center;">
          <div style="font-size:1.6rem; font-weight:800; color:#b91c1c;">⚠️ DİKKAT: TAHSİLAT YAPILMADI!</div>
          <div style="font-size:1.1rem; color:#7f1d1d; margin-top:0.3rem;">
            Kalan Bakiye: <strong style="font-size:1.4rem;">${Number(data.remainingBalance).toLocaleString('tr-TR')} TL</strong>
          </div>
          <p style="font-size:0.85rem; color:#991b1b; margin-top:0.4rem;">
            Ürün teslim edilmeden önce muhasebe ve tahsilat kontrolü yapınız!
          </p>
        </div>
      `;
    } else {
      warningHtml = `
        <div style="background:#d1fae5; border:2px solid #10b981; border-radius:10px; padding:0.75rem; margin-top:1rem; text-align:center;">
          <div style="font-size:1.1rem; font-weight:700; color:#065f46;">✅ ÖDEME TAMAMLANDI / BAKİYE YOK</div>
          <div style="font-size:0.85rem; color:#047857;">Siparişin bakiye borcu bulunmamaktadır. Sevkiyata uygundur.</div>
        </div>
      `;
    }

    content.innerHTML = `
      <div style="text-align:center; margin-bottom:1rem;">
        <span style="font-size:3rem;">🔔🚚</span>
        <h2 style="font-size:1.3rem; font-weight:800; color:#1e293b; margin-top:0.5rem;">Sevkiyat İstasyonunda QR Okutuldu!</h2>
        <p style="color:#64748b; font-size:0.85rem;">Atölye ekibi tarafından ürünün barkodu doğrulandı.</p>
      </div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem; display:flex; flex-direction:column; gap:0.4rem; font-size:0.9rem;">
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#64748b;">Müşteri:</span>
          <strong>${data.customerName}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#64748b;">Sipariş Kodu:</span>
          <span class="tracking-code">${data.trackingCode}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#64748b;">Tarayan / Saat:</span>
          <span>${data.scanner || 'Sevkiyat Usta'} (${new Date().toLocaleTimeString('tr-TR')})</span>
        </div>
      </div>
      ${warningHtml}
    `;

    openModal('dispatchAlertModal');
  } else {
    showToast(`🔔 Sevkiyat Barkodu Okutuldu: ${data.customerName} (${data.trackingCode})`, 'info');
  }
}

async function showOrderDetails(orderId) {
  try {
    const res = await apiCall(`/api/orders/${orderId}`);
    const o = res.order;
    currentActiveOrder = o;

    const modalBody = document.getElementById('orderDetailsBody');
    const stageObj = stages.find(s => s.id === o.currentStage) || { name: o.currentStage, icon: '' };

    let whatsappBtn = '';
    if (o.whatsappEnabled && o.customerPhone) {
      const cleanPhone = o.customerPhone.replace(/[^0-9]/g, '');
      const fullPhone = cleanPhone.startsWith('90') ? cleanPhone : '90' + cleanPhone.replace(/^0/, '');
      const trackingUrl = `${window.location.origin}/takip?kod=${o.trackingCode}`;
      const msg = `Sayın *${o.customerName}*, *${o.orderNumber}* nolu siparişiniz şu an *${stageObj.name}* aşamasındadır. Siparişinizi canlı takip etmek için: ${trackingUrl}`;
      const waLink = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
      whatsappBtn = `
        <a href="${waLink}" target="_blank" class="btn btn-success" style="padding:0.4rem 0.75rem;">
          📱 WhatsApp ile Bildir
        </a>
      `;
    }

    let filesHtml = '';
    if (o.files && o.files.length > 0) {
      filesHtml = o.files.map(f => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0.4rem 0.6rem; background:var(--bg-main); border:1px solid var(--border-color); border-radius:6px; font-size:0.8rem;">
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <span>📎</span>
            <strong>${f.name}</strong>
            <span style="color:var(--text-muted); font-size:0.7rem;">(${f.uploadedBy || ''})</span>
          </div>
          <div style="display:flex; gap:0.3rem;">
            <a href="${f.path}" target="_blank" class="btn btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem;">Aç / İndir</a>
          </div>
        </div>
      `).join('');
    } else {
      filesHtml = `<div style="color:var(--text-muted); font-size:0.8rem;">Ekli dosya veya çizim bulunmuyor.</div>`;
    }

    let timelineHtml = (o.stageHistory || []).map(h => `
      <div style="display:flex; gap:0.75rem; font-size:0.82rem; padding-bottom:0.75rem; border-left:2px solid var(--border-color); padding-left:1rem; position:relative;">
        <div style="position:absolute; left:-5px; top:0; width:8px; height:8px; border-radius:50%; background:var(--primary);"></div>
        <div>
          <div style="font-weight:700;">${h.stageName || h.stage}</div>
          <div style="color:var(--text-muted); font-size:0.75rem;">${new Date(h.timestamp).toLocaleString('tr-TR')} - ${h.user || 'Kullanıcı'}</div>
          ${h.note ? `<div style="margin-top:0.2rem; color:var(--text-main);">${h.note}</div>` : ''}
        </div>
      </div>
    `).join('');

    let financialBlock = '';
    if (currentUser.role === 'admin' && o.totalPrice !== undefined) {
      financialBlock = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem;">
          <h4 style="font-size:0.9rem; font-weight:700; margin-bottom:0.5rem; color:#1e293b;">💰 Finansal Bilgiler (Yöneticiye Özel)</h4>
          <div class="form-grid">
            <div>Toplam Tutar: <strong>${Number(o.totalPrice).toLocaleString('tr-TR')} ₺</strong></div>
            <div>Alınan Peşinat: <strong>${Number(o.deposit).toLocaleString('tr-TR')} ₺</strong></div>
            <div>Kalan Bakiye: <strong style="color:${(o.remainingBalance || 0) > 0 ? 'var(--danger)' : 'var(--success)'}; font-size:1.1rem;">${Number(o.remainingBalance || 0).toLocaleString('tr-TR')} ₺</strong></div>
            <div>Ödeme Durumu: <strong>${o.paymentStatus.toUpperCase()}</strong></div>
          </div>
          ${o.paymentNotes ? `<div style="margin-top:0.5rem; font-size:0.8rem; color:#64748b;">Not: ${o.paymentNotes}</div>` : ''}
        </div>
      `;
    }

    modalBody.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
        <div>
          <h3 style="font-size:1.25rem; font-weight:800;">${o.customerName}</h3>
          <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.2rem;">
            <span class="tracking-code">${o.trackingCode}</span>
            <span class="spec-badge" style="background:var(--primary-light); color:var(--primary); font-weight:700;">${stageObj.icon} ${stageObj.name}</span>
            <span class="priority-tag priority-${o.priority}">${o.priority}</span>
          </div>
        </div>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          ${whatsappBtn}
          <button class="btn btn-secondary" onclick="printJobOrder('${o.id}')">🏷️ İş Emri Fişi</button>
          <button class="btn btn-secondary" onclick="printDeliveryReceipt('${o.id}')">📄 Teslim Tutanağı</button>
          <button class="btn btn-danger" onclick="openFireModal('${o.id}')">⚠️ Fire Bildir</button>
        </div>
      </div>

      <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:8px; padding:0.85rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:0.75rem;">
        <div><span style="color:var(--text-muted); font-size:0.75rem;">Membran Rengi:</span><div style="font-weight:700; color:var(--purple);">${o.membraneColor || 'Belirtilmedi'}</div></div>
        <div><span style="color:var(--text-muted); font-size:0.75rem;">Model / Desen:</span><div style="font-weight:700;">${o.modelPattern || 'Düz'}</div></div>
        <div><span style="color:var(--text-muted); font-size:0.75rem;">MDF Kalınlığı:</span><div style="font-weight:700;">${o.mdfThickness || '18mm'}</div></div>
        <div><span style="color:var(--text-muted); font-size:0.75rem;">Kapak / Parça Adedi:</span><div style="font-weight:700;">${o.partCount || 0} Adet</div></div>
        <div><span style="color:var(--text-muted); font-size:0.75rem;">Toplam Metrekare:</span><div style="font-weight:700;">${o.totalAreaM2 || 0} m²</div></div>
        <div><span style="color:var(--text-muted); font-size:0.75rem;">Freze / Kulp:</span><div style="font-weight:700;">${o.millingProfile || 'Standart'}</div></div>
      </div>

      ${financialBlock}

      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; padding:0.85rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <h4 style="font-size:0.9rem; font-weight:700;">📎 Ekli Çizim, Fiş ve Dosyalar</h4>
          <label class="btn btn-secondary" style="cursor:pointer; padding:0.25rem 0.6rem; font-size:0.75rem;">
            + Dosya / DXF Yükle
            <input type="file" id="orderFileInput" style="display:none;" onchange="uploadOrderFile('${o.id}')">
          </label>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.4rem;">
          ${filesHtml}
        </div>
      </div>

      <div>
        <h4 style="font-size:0.9rem; font-weight:700; margin-bottom:0.75rem;">⏱️ Üretim Aşamaları Geçmişi</h4>
        <div style="padding-left:0.5rem;">
          ${timelineHtml}
        </div>
      </div>
    `;

    openModal('orderDetailsModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function uploadOrderFile(orderId) {
  const input = document.getElementById('orderFileInput');
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', 'cizim_dxf');

  try {
    showToast('Dosya yükleniyor...', 'info');
    await fetch(`/api/orders/${orderId}/files`, {
      method: 'POST',
      headers: {
        'x-user-role': currentUser.role,
        'x-user-name': currentUser.displayName
      },
      body: formData
    });
    showToast('Dosya başarıyla yüklendi!', 'success');
    showOrderDetails(orderId);
  } catch (err) {
    showToast('Yükleme hatası: ' + err.message, 'error');
  }
}

function openFireModal(orderId) {
  document.getElementById('fireOrderId').value = orderId;
  openModal('fireModal');
}

async function handleFireSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('fireOrderId').value;
  const pieceCount = document.getElementById('firePieceCount').value;
  const reason = document.getElementById('fireReason').value;

  try {
    await apiCall(`/api/orders/${id}/fire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pieceCount, reason })
    });
    closeModal('fireModal');
    closeModal('orderDetailsModal');
    showToast('Fire bildirildi ve atölyeye iletildi!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function printJobOrder(orderId) {
  const o = orders.find(x => x.id === orderId) || currentActiveOrder;
  if (!o) return;

  const printArea = document.getElementById('printArea');
  const trackingUrl = `${window.location.origin}/takip?kod=${o.trackingCode}`;

  printArea.innerHTML = `
    <div style="max-width:800px; margin:0 auto; padding:20px; font-family:Arial, sans-serif; border:2px solid #000;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:15px; margin-bottom:15px;">
        <div>
          <h1 style="font-size:22px; margin:0 0 5px 0;">ATÖLYE İŞ EMRİ & ÜRETİM FİŞİ</h1>
          <div style="font-size:14px; font-weight:bold;">${settings.companyName || 'Akdeniz Ahşap & Membran'}</div>
        </div>
        <div style="text-align:right;">
          <img src="/api/qrcode?text=${encodeURIComponent(trackingUrl)}&width=110" style="width:110px; height:110px; display:block;" />
          <div style="font-family:monospace; font-weight:bold; font-size:12px; margin-top:3px;">${o.trackingCode}</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:15px; font-size:14px;">
        <tr>
          <td style="padding:6px; border:1px solid #000; font-weight:bold; width:25%;">Müşteri:</td>
          <td style="padding:6px; border:1px solid #000; width:75%; font-size:16px; font-weight:bold;">${o.customerName}</td>
        </tr>
        <tr>
          <td style="padding:6px; border:1px solid #000; font-weight:bold;">Telefon:</td>
          <td style="padding:6px; border:1px solid #000;">${o.customerPhone || '-'}</td>
        </tr>
        <tr>
          <td style="padding:6px; border:1px solid #000; font-weight:bold;">Sipariş:</td>
          <td style="padding:6px; border:1px solid #000; font-weight:bold;">${o.productTitle}</td>
        </tr>
        <tr>
          <td style="padding:6px; border:1px solid #000; font-weight:bold;">Membran Rengi:</td>
          <td style="padding:6px; border:1px solid #000; font-size:16px; font-weight:bold;">${o.membraneColor || 'Belirtilmedi'}</td>
        </tr>
        <tr>
          <td style="padding:6px; border:1px solid #000; font-weight:bold;">Model / Desen:</td>
          <td style="padding:6px; border:1px solid #000;">${o.modelPattern || 'Düz'}</td>
        </tr>
        <tr>
          <td style="padding:6px; border:1px solid #000; font-weight:bold;">MDF Kalınlığı:</td>
          <td style="padding:6px; border:1px solid #000;">${o.mdfThickness || '18mm'}</td>
        </tr>
        <tr>
          <td style="padding:6px; border:1px solid #000; font-weight:bold;">Adet & Alan:</td>
          <td style="padding:6px; border:1px solid #000; font-weight:bold; font-size:16px;">${o.partCount} Adet / ${o.totalAreaM2} m²</td>
        </tr>
        <tr>
          <td style="padding:6px; border:1px solid #000; font-weight:bold;">Termin:</td>
          <td style="padding:6px; border:1px solid #000; font-weight:bold; color:#d00;">${o.estimatedDelivery || o.orderDate} (${o.priority.toUpperCase()})</td>
        </tr>
      </table>

      ${o.productDetails ? `
        <div style="border:1px solid #000; padding:10px; margin-bottom:15px;">
          <div style="font-weight:bold; margin-bottom:5px;">Sipariş Detayı / Ölçü Notları:</div>
          <div style="font-size:13px; white-space:pre-wrap;">${o.productDetails}</div>
        </div>
      ` : ''}

      ${o.receiptImage ? `
        <div style="margin-bottom:15px; text-align:center;">
          <div style="font-weight:bold; font-size:12px; margin-bottom:5px;">Yüklenen Sipariş Görseli:</div>
          <img src="${o.receiptImage}" style="max-width:100%; max-height:280px; border:1px solid #ccc;" />
        </div>
      ` : ''}

      <div style="margin-top:20px; border-top:2px solid #000; padding-top:10px; display:flex; justify-content:space-between; font-size:12px;">
        <div>Takip Kodu: <strong>${o.trackingCode}</strong></div>
        <div>QR Kodu telefon kamerasıyla okutarak sonraki aşamaya geçirebilirsiniz.</div>
      </div>
    </div>
  `;

  window.print();
}

function printDeliveryReceipt(orderId) {
  const o = orders.find(x => x.id === orderId) || currentActiveOrder;
  if (!o) return;

  const printArea = document.getElementById('printArea');
  const trackingUrl = `${window.location.origin}/takip?kod=${o.trackingCode}`;

  printArea.innerHTML = `
    <div style="max-width:800px; margin:0 auto; padding:25px; font-family:Arial, sans-serif; border:2px solid #000;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:15px; margin-bottom:20px;">
        <div>
          <h1 style="font-size:22px; margin:0 0 5px 0;">SEVKİYAT & TESLİM TUTANAĞI</h1>
          <div style="font-size:14px; font-weight:bold;">${settings.companyName || 'Akdeniz Ahşap & Membran'}</div>
          <div style="font-size:12px; color:#555;">Tel: ${settings.phone || '-'}</div>
        </div>
        <div style="text-align:right;">
          <img src="/api/qrcode?text=${encodeURIComponent(trackingUrl)}&width=90" style="width:90px; height:90px; display:block;" />
          <div style="font-family:monospace; font-weight:bold; font-size:12px;">${o.trackingCode}</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:13px;">
        <tr style="background:#f0f0f0;">
          <th style="border:1px solid #000; padding:8px; text-align:left;">Müşteri / Firma</th>
          <td style="border:1px solid #000; padding:8px; font-weight:bold;">${o.customerName}</td>
        </tr>
        <tr>
          <th style="border:1px solid #000; padding:8px; text-align:left;">Teslim Tarihi</th>
          <td style="border:1px solid #000; padding:8px;">${new Date().toLocaleDateString('tr-TR')}</td>
        </tr>
        <tr>
          <th style="border:1px solid #000; padding:8px; text-align:left;">Ürün / İş</th>
          <td style="border:1px solid #000; padding:8px;">${o.productTitle}</td>
        </tr>
        <tr>
          <th style="border:1px solid #000; padding:8px; text-align:left;">Renk & Model</th>
          <td style="border:1px solid #000; padding:8px; font-weight:bold;">${o.membraneColor} / ${o.modelPattern}</td>
        </tr>
        <tr>
          <th style="border:1px solid #000; padding:8px; text-align:left;">Parça Adedi</th>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; font-size:15px;">${o.partCount} Adet (${o.totalAreaM2} m²)</td>
        </tr>
      </table>

      <div style="border:1px dashed #000; padding:12px; margin-bottom:30px; font-size:12px; line-height:1.4;">
        <strong>TESLİMAT ŞARTI:</strong> Yukarıda dökümü yapılan mamulleri ambalajı sağlam, adedi eksiksiz, yüzeyinde çizik ve ezik olmaksızın tam ve kusursuz olarak teslim aldım.
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:40px; padding:0 30px;">
        <div style="text-align:center; width:200px;">
          <div style="font-weight:bold; margin-bottom:50px;">Teslim Eden (Firma Yetkilisi)</div>
          <div style="border-top:1px solid #000; padding-top:5px;">İmza / Kaşe</div>
        </div>
        <div style="text-align:center; width:200px;">
          <div style="font-weight:bold; margin-bottom:50px;">Teslim Alan (Müşteri)</div>
          <div style="border-top:1px solid #000; padding-top:5px;">İsim / Soyisim / İmza</div>
        </div>
      </div>
    </div>
  `;

  window.print();
}

// USER MANAGEMENT (ADMIN ONLY)
async function openUsersModal() {
  if (currentUser.role !== 'admin') {
    showToast('Sadece yönetici kullanıcıları yönetebilir.', 'error');
    return;
  }
  openModal('usersModal');
  loadUsersList();
}

async function loadUsersList() {
  const container = document.getElementById('usersListContainer');
  if (!container) return;
  try {
    const res = await apiCall('/api/users');
    if (res.users && res.users.length > 0) {
      container.innerHTML = res.users.map(u => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 0.85rem; background:var(--bg-card); border:1px solid var(--border-color); border-radius:6px;">
          <div>
            <strong>${u.displayName}</strong>
            <span style="color:var(--text-muted); font-size:0.75rem; margin-left:0.5rem;">(@${u.username})</span>
            <span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-viewer'}" style="margin-left:0.5rem; font-size:0.7rem;">
              ${u.role === 'admin' ? '👑 Yönetici' : '👁️ İzleyici'}
            </span>
          </div>
          <div>
            ${u.username !== 'yonetici' ? `
              <button class="btn btn-danger" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="deleteUserById('${u.id}')">Sil</button>
            ` : `<span style="font-size:0.75rem; color:var(--text-muted);">Ana Yönetici</span>`}
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem;">Kayıtlı kullanıcı bulunamadı.</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div style="color:var(--danger); font-size:0.8rem;">Kullanıcılar yüklenemedi: ${err.message}</div>`;
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  const username = document.getElementById('nu_username').value;
  const displayName = document.getElementById('nu_displayName').value;
  const role = document.getElementById('nu_role').value;
  const password = document.getElementById('nu_password').value;

  try {
    const res = await apiCall('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, role, password })
    });
    if (res.success) {
      showToast(`Kullanıcı kaydedildi: ${displayName}`, 'success');
      document.getElementById('newUserForm').reset();
      loadUsersList();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUserById(userId) {
  if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
  try {
    const res = await apiCall(`/api/users/${userId}`, { method: 'DELETE' });
    if (res.success) {
      showToast('Kullanıcı silindi.', 'info');
      loadUsersList();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

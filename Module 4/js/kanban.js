function renderStats() {
  apiCall('/api/stats').then(res => {
    const s = res.stats;
    const grid = document.getElementById('statsGrid');
    if (!grid) return;

    let html = `
      <div class="stat-item">
        <span class="stat-icon">📦</span>
        <div>
          <div class="stat-val">${s.activeOrders}</div>
          <div class="stat-lbl">Aktif Sipariş</div>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">📐</span>
        <div>
          <div class="stat-val">${s.totalM2.toFixed(1)} m²</div>
          <div class="stat-lbl">Toplam Alan</div>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">🪵</span>
        <div>
          <div class="stat-val">${s.totalParts}</div>
          <div class="stat-lbl">Kapak / Parça</div>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">⚡</span>
        <div>
          <div class="stat-val" style="color:var(--danger)">${s.urgentOrders}</div>
          <div class="stat-lbl">Acil Sipariş</div>
        </div>
      </div>
    `;

    if (s.fireReportsTotal > 0) {
      html += `
        <div class="stat-item" style="border-color:#fca5a5; background:#fee2e2;">
          <span class="stat-icon">⚠️</span>
          <div>
            <div class="stat-val" style="color:#b91c1c">${s.fireReportsTotal}</div>
            <div class="stat-lbl" style="color:#991b1b">Fire / Yeniden Kesim</div>
          </div>
        </div>
      `;
    }

    if (currentUser.role === 'admin' && s.financials) {
      html += `
        <div class="stat-item">
          <span class="stat-icon">💰</span>
          <div>
            <div class="stat-val" style="color:var(--primary)">${Number(s.financials.totalRevenue).toLocaleString('tr-TR')} ₺</div>
            <div class="stat-lbl">Toplam Ciro</div>
          </div>
        </div>
        <div class="stat-item">
          <span class="stat-icon">💳</span>
          <div>
            <div class="stat-val" style="color:var(--warning)">${Number(s.financials.totalRemaining).toLocaleString('tr-TR')} ₺</div>
            <div class="stat-lbl">Kalan Bakiye (${s.financials.pendingPaymentCount} Sipariş)</div>
          </div>
        </div>
      `;
    }

    grid.innerHTML = html;
  }).catch(err => console.error(err));
}

function renderKanban(container) {
  container.className = currentView === 'kiosk' ? 'main-content kiosk-mode' : 'main-content';
  let boardHtml = `<div class="kanban-board">`;

  stages.forEach(stage => {
    const stageOrders = orders.filter(o => o.currentStage === stage.id);
    boardHtml += `
      <div class="kanban-col" data-stage="${stage.id}">
        <div class="kanban-col-header">
          <div class="col-title">
            <span>${stage.icon}</span>
            <span>${stage.name}</span>
          </div>
          <span class="col-badge">${stageOrders.length}</span>
        </div>
        <div class="kanban-cards">
    `;

    if (stageOrders.length === 0) {
      boardHtml += `<div style="text-align:center; padding:2rem 0.5rem; color:var(--text-muted); font-size:0.75rem;">Sipariş yok</div>`;
    } else {
      stageOrders.forEach(order => {
        boardHtml += renderOrderCard(order);
      });
    }

    boardHtml += `</div></div>`;
  });

  boardHtml += `</div>`;
  container.innerHTML = boardHtml;
}

function renderOrderCard(order) {
  const isUrgent = order.priority === 'acil' || order.priority === 'kritik';
  const hasFire = order.fireReports && order.fireReports.some(f => !f.resolved);

  let financialPill = '';
  if (currentUser.role === 'admin' && order.totalPrice !== undefined) {
    const isPaid = order.paymentStatus === 'odendi' || (order.remainingBalance || 0) <= 0;
    financialPill = `
      <span class="spec-badge" style="${isPaid ? 'background:#d1fae5; color:#065f46;' : 'background:#fee2e2; color:#991b1b; font-weight:700;'}">
        ${isPaid ? '✅ Ödendi' : `Bakiye: ${Number(order.remainingBalance).toLocaleString('tr-TR')} ₺`}
      </span>
    `;
  }

  const curIdx = stages.findIndex(s => s.id === order.currentStage);
  const nextStage = curIdx < stages.length - 1 ? stages[curIdx + 1] : null;
  const prevStage = curIdx > 0 ? stages[curIdx - 1] : null;

  return `
    <div class="order-card ${order.priority === 'kritik' ? 'card-critical' : isUrgent ? 'card-urgent' : ''}">
      <div class="card-header">
        <span class="tracking-code" onclick="showOrderDetails('${order.id}')" style="cursor:pointer;">
          ${order.trackingCode}
        </span>
        <span class="priority-tag priority-${order.priority}">${order.priority}</span>
      </div>

      <div class="customer-title" onclick="showOrderDetails('${order.id}')" style="cursor:pointer;">
        ${order.customerName}
      </div>

      <div style="font-size:0.8rem; color:var(--text-muted); line-height:1.2;">
        ${order.productTitle}
      </div>

      <div class="membrane-specs">
        ${order.membraneColor ? `<span class="spec-badge spec-color">🎨 ${order.membraneColor}</span>` : ''}
        ${order.modelPattern ? `<span class="spec-badge">📐 ${order.modelPattern}</span>` : ''}
        ${order.partCount ? `<span class="spec-badge">🔢 ${order.partCount} Adet</span>` : ''}
        ${order.totalAreaM2 ? `<span class="spec-badge">📏 ${order.totalAreaM2} m²</span>` : ''}
        ${financialPill}
      </div>

      ${hasFire ? `
        <div class="fire-alert-box">
          <span>⚠️ FİRE BİLDİRİMİ VAR!</span>
          <button class="btn btn-danger" style="padding:0.15rem 0.4rem; font-size:0.7rem;" onclick="showOrderDetails('${order.id}')">İncele</button>
        </div>
      ` : ''}

      <div class="card-footer">
        <span>🕒 ${order.estimatedDelivery ? 'Termin: ' + order.estimatedDelivery : 'Tarih: ' + order.orderDate}</span>
        ${order.receiptImage ? `<span title="Fiş Önizle" style="cursor:pointer;" onclick="previewImage('${order.receiptImage}')">🧾 Fiş</span>` : ''}
      </div>

      <div class="card-actions">
        ${prevStage && currentUser.role === 'admin' ? `
          <button class="btn btn-secondary btn-step" title="Geri Al: ${prevStage.name}" onclick="advanceOrderStage('${order.id}', '${prevStage.id}')">
            ⬅️
          </button>
        ` : ''}

        ${nextStage ? `
          <button class="btn btn-primary btn-step" onclick="advanceOrderStage('${order.id}', '${nextStage.id}')">
            ${nextStage.name} ➔
          </button>
        ` : `
          <button class="btn btn-success btn-step" disabled style="opacity:0.8;">
            ✅ Tamamlandı
          </button>
        `}

        <button class="btn btn-secondary" style="padding:0.35rem 0.5rem; font-size:0.75rem;" title="Detay" onclick="showOrderDetails('${order.id}')">
          👁️
        </button>
      </div>
    </div>
  `;
}

function renderTable(container) {
  container.className = 'main-content';
  let tableHtml = `
    <div style="background:var(--bg-card); border-radius:10px; border:1px solid var(--border-color); overflow:hidden; box-shadow:var(--shadow-sm);">
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:left;">
          <thead>
            <tr style="background:var(--bg-main); border-bottom:1px solid var(--border-color); color:var(--text-muted);">
              <th style="padding:0.75rem 1rem;">Takip Kodu</th>
              <th style="padding:0.75rem 1rem;">Müşteri</th>
              <th style="padding:0.75rem 1rem;">Ürün / Renk</th>
              <th style="padding:0.75rem 1rem;">Ölçü / Adet</th>
              <th style="padding:0.75rem 1rem;">Aşama</th>
              <th style="padding:0.75rem 1rem;">Termin</th>
              ${currentUser.role === 'admin' ? `<th style="padding:0.75rem 1rem;">Ödeme</th>` : ''}
              <th style="padding:0.75rem 1rem; text-align:right;">İşlemler</th>
            </tr>
          </thead>
          <tbody>
  `;

  if (orders.length === 0) {
    tableHtml += `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Sipariş bulunamadı.</td></tr>`;
  } else {
    orders.forEach(o => {
      const stageObj = stages.find(s => s.id === o.currentStage) || { name: o.currentStage, icon: '' };
      tableHtml += `
        <tr style="border-bottom:1px solid var(--border-color);">
          <td style="padding:0.75rem 1rem;">
            <span class="tracking-code" onclick="showOrderDetails('${o.id}')" style="cursor:pointer;">${o.trackingCode}</span>
          </td>
          <td style="padding:0.75rem 1rem; font-weight:600;">${o.customerName}</td>
          <td style="padding:0.75rem 1rem;">
            <div>${o.productTitle}</div>
            ${o.membraneColor ? `<div style="font-size:0.75rem; color:var(--purple); font-weight:600;">${o.membraneColor}</div>` : ''}
          </td>
          <td style="padding:0.75rem 1rem;">
            <div>${o.partCount} Adet</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${o.totalAreaM2} m²</div>
          </td>
          <td style="padding:0.75rem 1rem;">
            <span class="spec-badge" style="background:var(--primary-light); color:var(--primary); font-weight:600;">
              ${stageObj.icon} ${stageObj.name}
            </span>
          </td>
          <td style="padding:0.75rem 1rem;">${o.estimatedDelivery || o.orderDate}</td>
          ${currentUser.role === 'admin' ? `
            <td style="padding:0.75rem 1rem;">
              <span class="spec-badge" style="${o.paymentStatus === 'odendi' ? 'background:#d1fae5; color:#065f46;' : 'background:#fee2e2; color:#991b1b;'}">
                ${o.paymentStatus === 'odendi' ? 'Ödendi' : `Bakiye: ${Number(o.remainingBalance || 0).toLocaleString('tr-TR')} ₺`}
              </span>
            </td>
          ` : ''}
          <td style="padding:0.75rem 1rem; text-align:right;">
            <button class="btn btn-secondary" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="showOrderDetails('${o.id}')">Detay</button>
            <button class="btn btn-primary" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="printJobOrder('${o.id}')">İş Emri</button>
          </td>
        </tr>
      `;
    });
  }

  tableHtml += `</tbody></table></div></div>`;
  container.innerHTML = tableHtml;
}

async function advanceOrderStage(id, targetStage) {
  try {
    const res = await apiCall(`/api/orders/${id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: targetStage })
    });
    if (res.success) {
      loadOrders();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

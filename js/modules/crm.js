// Module 3: CRM Control Panel (Integrated with Clerk B2C Lazy Registration & Supabase crm_customers)
export function renderCrmModule(data) {
    const crm = data.crm;

    setTimeout(async () => {
        try {
            const res = await fetch('/api/crm-customers');
            const json = await res.json().catch(() => null);
            const tbody = document.querySelector('#leads-table tbody');
            if (!tbody || !res.ok || !Array.isArray(json?.customers)) return;
            const liveRows = json.customers.map(c => `
                <tr style="background:rgba(16,185,129,0.06);">
                    <td><code>${c.latest_quote_ref || c.id || 'CRM-B2C'}</code></td>
                    <td>
                        <strong>${c.full_name || 'Müşteri'}</strong>
                        ${c.email ? `<div style="font-size:11px;color:var(--text-muted);">${c.email}</div>` : ''}
                        ${c.phone ? `<div style="font-size:11px;color:#34d399;">📞 ${c.phone}</div>` : ''}
                    </td>
                    <td><span class="badge badge-primary">🌐 Vitrin (Clerk B2C)</span></td>
                    <td><small>${c.interested_model || 'Özel Ölçü Mobilya'}${c.notes ? ` — ${c.notes}` : ''}</small></td>
                    <td><span class="badge badge-accent">${c.stage || 'Yeni Teklif Talebi'}</span></td>
                    <td><strong class="text-success">Teklif Bekliyor</strong></td>
                    <td>Satış Ekibi (CRM)</td>
                    <td>
                        ${c.phone
                            ? `<a class="btn-action" href="https://wa.me/90${String(c.phone).replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '')}" target="_blank" style="text-decoration:none;">💬 WhatsApp</a>`
                            : '<span class="badge badge-secondary">Kayıtlı</span>'}
                    </td>
                </tr>
            `).join('');
            if (liveRows) {
                tbody.insertAdjacentHTML('afterbegin', liveRows);
            }
        } catch (_) {}
    }, 60);

    return `
        <div class="page-header">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span>Modül 3: CRM & Satış Yönetimi</span>
                </div>
                <h1>Müşteri İlişkileri (CRM) & Satış Hunisi</h1>
                <p class="subtitle">Çok kanallı potansiyel talepler (Web, Instagram, Showroom, Mimari Projeler), teklifler ve sözleşme süreçleri.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-secondary" onclick="window.showToast('CRM Verileri Dışa Aktarıldı (Excel/CSV Simülasyonu)')">
                    📥 Rapor İndir
                </button>
                <button class="btn btn-primary" onclick="window.showModal('Yeni Fırsat Ekle', 'Yeni kurumsal ya da perakende müşteri fırsatı ekleme formu simüle edildi.')">
                    + Yeni Müşteri Fırsatı
                </button>
            </div>
        </div>

        <!-- CRM Financial Metrics -->
        <div class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Toplam Fırsat Hacmi</span>
                    <span class="metric-icon">💼</span>
                </div>
                <div class="metric-value">${crm.summary.totalPipelineValue}</div>
                <div class="metric-meta text-success">Aktif 28 teklif ve proje</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Kazanma Oranı</span>
                    <span class="metric-icon">🎯</span>
                </div>
                <div class="metric-value">${crm.summary.winRate}</div>
                <div class="metric-meta text-primary">Sektör ortalaması %28</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Ortalama Proje Büyüklüğü</span>
                    <span class="metric-icon">📐</span>
                </div>
                <div class="metric-value">${crm.summary.averageDealSize}</div>
                <div class="metric-meta text-primary">Mimari B2B ağırlıklı</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Aktif Takip Görevi</span>
                    <span class="metric-icon">⏰</span>
                </div>
                <div class="metric-value">14 <span class="sub-val">Görev</span></div>
                <div class="metric-meta text-warning">Bugün 4 arama planlandı</div>
            </div>
        </div>

        <!-- Pipeline Kanban Stages Overview -->
        <div class="section-title-row">
            <h3>Satış Aşamaları ve Huni Dağılımı</h3>
            <span class="tag">5 Aşama</span>
        </div>

        <div class="pipeline-stages-bar">
            ${crm.pipelineStages.map(st => `
                <div class="stage-bar-item" style="border-top: 4px solid ${st.color}">
                    <div class="stage-header">
                        <strong>${st.name}</strong>
                        <span class="stage-count">${st.count}</span>
                    </div>
                    <div class="stage-val">${st.value}</div>
                </div>
            `).join('')}
        </div>

        <!-- Leads Table & Filtering -->
        <div class="card panel" style="margin-top: 24px;">
            <div class="table-toolbar">
                <div class="search-input-wrap">
                    <span class="search-icon">🔍</span>
                    <input type="text" placeholder="Müşteri, şirket veya temsilci ara..." onkeyup="window.filterTable('leads-table', this.value)">
                </div>
                <div class="toolbar-actions">
                    <select class="form-select" onchange="window.filterTableByStage('leads-table', this.value)">
                        <option value="">Tüm Aşamalar</option>
                        ${crm.pipelineStages.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="table-responsive">
                <table class="data-table" id="leads-table">
                    <thead>
                        <tr>
                            <th>Fırsat No</th>
                            <th>Müşteri / Kurum</th>
                            <th>Kaynak Kanal</th>
                            <th>Proje Kapsamı</th>
                            <th>Aşama</th>
                            <th>Değer</th>
                            <th>Temsilci</th>
                            <th>İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${crm.leads.map(lead => `
                            <tr>
                                <td><code>${lead.id}</code></td>
                                <td><strong>${lead.customer}</strong></td>
                                <td><span class="badge badge-secondary">${lead.channel}</span></td>
                                <td><small>${lead.scope}</small></td>
                                <td>
                                    <span class="badge badge-accent">${lead.stage}</span>
                                </td>
                                <td><strong class="text-success">${lead.value}</strong></td>
                                <td>${lead.assignedTo}</td>
                                <td>
                                    <button class="btn-action" onclick="window.showLeadDetail('${lead.id}')">Detay</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

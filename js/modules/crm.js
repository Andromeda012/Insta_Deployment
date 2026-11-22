// Module 3: CRM Control Panel (%100 Canlı — Clerk B2C Lazy Registration & Supabase crm_customers)
export function renderCrmModule() {
    window.loadLiveCrmData = async function (showNotice = false) {
        const metricsBox = document.getElementById('live-crm-metrics-grid');
        const stagesBox = document.getElementById('live-crm-stages-bar');
        const tbody = document.getElementById('live-crm-leads-tbody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px;">📡 Supabase CRM kayıtları yükleniyor…</td></tr>';

        try {
            const res = await fetch('/api/crm-customers');
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#fca5a5;padding:20px;">⚠️ CRM verisi okunamadı: ${json?.error || res.status}</td></tr>`;
                return;
            }

            const customers = Array.isArray(json.customers) ? json.customers : [];
            const quotes = Array.isArray(json.quotes) ? json.quotes : [];

            const stageCounts = {
                'Yeni Teklif Talebi': 0,
                'İletişime Geçildi': 0,
                'Teklif Gönderildi': 0,
                'Onay / Sipariş': 0
            };
            for (const c of customers) {
                const st = c.stage || 'Yeni Teklif Talebi';
                if (stageCounts[st] !== undefined) stageCounts[st]++;
                else stageCounts['Yeni Teklif Talebi']++;
            }

            if (metricsBox) {
                metricsBox.innerHTML = `
                    <div class="card metric-card">
                        <div class="metric-header">
                            <span class="metric-title">Kayıtlı B2C Müşteri</span>
                            <span class="metric-icon">👥</span>
                        </div>
                        <div class="metric-value">${customers.length}</div>
                        <div class="metric-meta text-muted">Clerk Lazy Registration → Supabase</div>
                    </div>
                    <div class="card metric-card">
                        <div class="metric-header">
                            <span class="metric-title">Toplam Teklif Talebi</span>
                            <span class="metric-icon">🧾</span>
                        </div>
                        <div class="metric-value">${quotes.length}</div>
                        <div class="metric-meta text-muted">Vitrin üzerinden gelen gerçek talepler</div>
                    </div>
                    <div class="card metric-card">
                        <div class="metric-header">
                            <span class="metric-title">Yeni / Bekleyen Talep</span>
                            <span class="metric-icon">⏳</span>
                        </div>
                        <div class="metric-value">${stageCounts['Yeni Teklif Talebi']}</div>
                        <div class="metric-meta text-muted">Satış ekibi yanıtı bekleyenler</div>
                    </div>
                    <div class="card metric-card">
                        <div class="metric-header">
                            <span class="metric-title">Onaylanan / Sipariş</span>
                            <span class="metric-icon">✅</span>
                        </div>
                        <div class="metric-value">${stageCounts['Onay / Sipariş']}</div>
                        <div class="metric-meta text-muted">Canlı Supabase verisi</div>
                    </div>
                `;
            }

            if (stagesBox) {
                const colors = ['#38bdf8', '#fde68a', '#c084fc', '#34d399'];
                stagesBox.innerHTML = Object.entries(stageCounts).map(([name, count], idx) => `
                    <div class="stage-bar-item" style="border-top: 4px solid ${colors[idx]}">
                        <div class="stage-header">
                            <strong>${name}</strong>
                            <span class="stage-count">${count}</span>
                        </div>
                        <div class="stage-val" style="font-size:12px;color:#94a3b8;">Canlı kayıt</div>
                    </div>
                `).join('');
            }

            if (customers.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center;padding:34px;color:#94a3b8;">
                            <div style="font-size:26px;margin-bottom:8px;">📭</div>
                            <strong style="color:#e2e8f0;display:block;margin-bottom:4px;">Henüz kayıtlı CRM müşterisi veya teklif talebi bulunmuyor</strong>
                            <span style="font-size:12.5px;">Kurumsal vitrinde (<code>beta.globalkapakmobilya.com</code>) bir müşteri "Teklif Al" butonunu kullandığında kayıtlar buraya anında düşer.</span>
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = customers.map(c => `
                    <tr>
                        <td><code>${c.latest_quote_ref || c.id || 'CRM-B2C'}</code></td>
                        <td>
                            <strong>${c.full_name || 'Müşteri'}</strong>
                            ${c.email ? `<div style="font-size:11px;color:var(--text-muted);">${c.email}</div>` : ''}
                            ${c.phone ? `<div style="font-size:11px;color:#34d399;">📞 ${c.phone}</div>` : ''}
                        </td>
                        <td><span class="badge badge-primary">🌐 Vitrin (Clerk B2C)</span></td>
                        <td><small>${c.interested_model || 'Genel Teklif'}${c.notes ? ` — ${c.notes}` : ''}</small></td>
                        <td><span class="badge badge-accent">${c.stage || 'Yeni Teklif Talebi'}</span></td>
                        <td><small>${c.updated_at ? c.updated_at.slice(0, 16).replace('T', ' ') : '-'}</small></td>
                        <td>
                            ${c.phone
                                ? `<a class="btn-action" href="https://wa.me/90${String(c.phone).replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '')}" target="_blank" style="text-decoration:none;">💬 WhatsApp</a>`
                                : '<span class="badge badge-secondary">Kayıtlı</span>'}
                        </td>
                    </tr>
                `).join('');
            }

            if (showNotice && typeof window.showToast === 'function') {
                window.showToast(`CRM güncellendi (${customers.length} müşteri, ${quotes.length} teklif).`);
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#fca5a5;padding:20px;">⚠️ Bağlantı hatası: ${err.message}</td></tr>`;
        }
    };

    setTimeout(() => { window.loadLiveCrmData(false); }, 50);

    return `
        <div class="page-header">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span>Modül 3: CRM &amp; Satış Yönetimi</span>
                </div>
                <h1>Müşteri İlişkileri (CRM) &amp; Canlı Teklif Hunisi</h1>
                <p class="subtitle">Vitrin (Clerk B2C Lazy Registration) üzerinden gelen gerçek müşteri ve teklif kayıtları.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-primary" onclick="window.loadLiveCrmData(true)">
                    🔄 CRM Kayıtlarını Yenile
                </button>
            </div>
        </div>

        <div id="live-crm-metrics-grid" class="metrics-grid"></div>

        <div class="section-title-row">
            <h3>Satış Aşamaları ve Canlı Huni Dağılımı</h3>
            <span class="tag">Supabase Canlı Veri</span>
        </div>

        <div id="live-crm-stages-bar" class="pipeline-stages-bar"></div>

        <div class="card panel" style="margin-top: 24px;">
            <div class="table-toolbar">
                <div class="search-input-wrap">
                    <span class="search-icon">🔍</span>
                    <input type="text" placeholder="Müşteri, e-posta, telefon veya model ara..." onkeyup="window.filterTable('leads-table', this.value)">
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table" id="leads-table">
                    <thead>
                        <tr>
                            <th>Referans</th>
                            <th>Müşteri</th>
                            <th>Kaynak</th>
                            <th>İlgilenilen Model / Not</th>
                            <th>Aşama</th>
                            <th>Tarih</th>
                            <th>İşlem</th>
                        </tr>
                    </thead>
                    <tbody id="live-crm-leads-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
}

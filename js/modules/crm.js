// Module 3: Omnichannel CRM & Teklif Yönetimi
// Kaynaklar: Web Vitrin (Lazy Register) + WhatsApp + Instagram + Facebook + TikTok/YouTube

const SOURCE_META = {
    web: { label: 'Web Sitesi', icon: '🌐', badgeClass: 'crm-source-web' },
    whatsapp: { label: 'WhatsApp', icon: '💬', badgeClass: 'crm-source-whatsapp' },
    instagram: { label: 'Instagram', icon: '📸', badgeClass: 'crm-source-instagram' },
    facebook: { label: 'Facebook', icon: '📘', badgeClass: 'crm-source-facebook' },
    tiktok_youtube: { label: 'TikTok / YT', icon: '▶️', badgeClass: 'crm-source-tiktok_youtube' },
};

const STATUS_META = {
    yeni_talep: { label: 'Yeni Talep', badgeClass: 'crm-status-yeni_talep' },
    inceleniyor: { label: 'İnceleniyor', badgeClass: 'crm-status-inceleniyor' },
    fiyat_verildi: { label: 'Fiyat Verildi', badgeClass: 'crm-status-fiyat_verildi' },
    onaylandi: { label: 'Onaylandı', badgeClass: 'crm-status-onaylandi' },
    iptal: { label: 'İptal', badgeClass: 'crm-status-iptal' },
};

const crmState = {
    leads: [],
    customers: [],
    stats: null,
    storageMode: 'postgres',
    migrationRequired: false,
    sourceFilter: 'all',
    statusFilter: 'all',
    searchQuery: '',
    activeLeadId: null,
    isLoading: false,
};

function esc(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatPriceTRY(val) {
    if (val === null || val === undefined || val === '') return 'Teklif Bekliyor';
    const num = Number(val);
    if (!Number.isFinite(num)) return '—';
    return '₺' + num.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDateTimeTR(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('tr-TR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return String(iso).slice(0, 16);
    }
}

function summarizeDetails(lead) {
    const d = lead.product_details || {};
    const parts = [];
    if (Array.isArray(d.modules) && d.modules.length) {
        parts.push(d.modules.join(', '));
    } else if (d.module) {
        parts.push(String(d.module));
    }
    if (d.dimensions) parts.push(`Ölçü: ${d.dimensions}`);
    if (d.finish_color) parts.push(`Renk: ${d.finish_color}`);
    if (d.notes && !parts.length) parts.push(String(d.notes).slice(0, 68));
    return parts.join(' • ') || 'Detay notu yok';
}

function getSourceBadge(source) {
    const s = SOURCE_META[source] || { label: source || 'Web', icon: '🌐', badgeClass: 'crm-source-web' };
    return `<span class="crm-source-pill ${s.badgeClass}">${s.icon} ${esc(s.label)}</span>`;
}

function getStatusBadge(status) {
    const st = STATUS_META[status] || { label: status || 'Yeni Talep', badgeClass: 'crm-status-yeni_talep' };
    return `<span class="crm-status-pill ${st.badgeClass}">${esc(st.label)}</span>`;
}

async function fetchUnifiedCrmData() {
    crmState.isLoading = true;
    try {
        const res = await fetch('/api/crm-customers?limit=300', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.ok) {
            throw new Error(json.error || `HTTP ${res.status}`);
        }
        crmState.leads = Array.isArray(json.leads) ? json.leads : [];
        crmState.customers = Array.isArray(json.customers) ? json.customers : [];
        crmState.stats = json.stats || null;
        crmState.storageMode = json.storage_mode || 'postgres';
        crmState.migrationRequired = Boolean(json.migration_required);
    } catch (err) {
        console.error('CRM data fetch error:', err);
        if (typeof window.showToast === 'function') {
            window.showToast('CRM verileri alınamadı: ' + err.message, 'error');
        }
    } finally {
        crmState.isLoading = false;
        renderCrmInteractiveView();
    }
}

function getFilteredLeads() {
    const q = crmState.searchQuery.trim().toLowerCase();
    return crmState.leads.filter((lead) => {
        if (crmState.sourceFilter !== 'all' && lead.source !== crmState.sourceFilter) return false;
        if (crmState.statusFilter !== 'all' && lead.status !== crmState.statusFilter) return false;
        if (q) {
            const c = lead.customer || {};
            const hay = [
                lead.reference_code,
                lead.collection_name,
                lead.staff_note,
                lead.ai_summary,
                lead.erp_order_id,
                c.full_name,
                c.phone,
                c.email,
                c.city,
                c.instagram_handle,
                JSON.stringify(lead.product_details || {}),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

function renderCrmInteractiveView() {
    const root = document.getElementById('crmLiveRoot');
    if (!root) return;

    const allLeads = crmState.leads;
    const stats = crmState.stats || {
        totalLeads: allLeads.length,
        totalCustomers: crmState.customers.length,
        claimedCustomers: crmState.customers.filter((c) => c.clerk_user_id).length,
        bySource: {
            web: allLeads.filter((l) => l.source === 'web').length,
            whatsapp: allLeads.filter((l) => l.source === 'whatsapp').length,
            instagram: allLeads.filter((l) => l.source === 'instagram').length,
            facebook: allLeads.filter((l) => l.source === 'facebook').length,
            tiktok_youtube: allLeads.filter((l) => l.source === 'tiktok_youtube').length,
        },
        byStatus: {
            yeni_talep: allLeads.filter((l) => l.status === 'yeni_talep').length,
            inceleniyor: allLeads.filter((l) => l.status === 'inceleniyor').length,
            fiyat_verildi: allLeads.filter((l) => l.status === 'fiyat_verildi').length,
            onaylandi: allLeads.filter((l) => l.status === 'onaylandi').length,
            iptal: allLeads.filter((l) => l.status === 'iptal').length,
        },
    };

    const filtered = getFilteredLeads();
    const pendingCount = (stats.byStatus?.yeni_talep || 0) + (stats.byStatus?.inceleniyor || 0);

    const migrationBanner = crmState.migrationRequired
        ? `<div class="card" style="padding:12px 16px;margin-bottom:16px;border-color:rgba(245,158,11,0.45);background:rgba(245,158,11,0.08);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                <span style="font-size:12px;color:#fcd34d;">
                    ⚠️ <strong>Supabase SQL Migration Bekleniyor:</strong> <code>public.customers</code> & <code>public.leads_and_quotes</code> tabloları henüz veritabanında oluşturulmadığı için veriler geçici <code>site_settings</code> yedeğinde tutuluyor.
                </span>
                <span class="text-muted" style="font-size:11px;">Dosya: <code>supabase/migrations/20261124170000_unified_customers_leads_and_quotes.sql</code></span>
           </div>`
        : '';

    const kpiHtml = `
        <div class="kpi-grid mb-24">
            <div class="kpi-card">
                <div class="kpi-label">Toplam Talep Havuzu</div>
                <div class="kpi-val">${stats.totalLeads}</div>
                <div class="metric-meta text-success">Tüm kanallardan birleşik</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Fiyat Bekleyen Talepler</div>
                <div class="kpi-val" style="color:#fbbf24;">${pendingCount}</div>
                <div class="metric-meta text-muted">${stats.byStatus?.yeni_talep || 0} yeni • ${stats.byStatus?.inceleniyor || 0} inceleniyor</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Fiyat Verilen / Onaylı</div>
                <div class="kpi-val" style="color:#38bdf8;">${(stats.byStatus?.fiyat_verildi || 0) + (stats.byStatus?.onaylandi || 0)}</div>
                <div class="metric-meta text-muted">${stats.byStatus?.fiyat_verildi || 0} fiyat verildi • ${stats.byStatus?.onaylandi || 0} onaylı</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Kayıtlı Müşteri (Tekil Tel)</div>
                <div class="kpi-val">${stats.totalCustomers}</div>
                <div class="metric-meta text-success">${stats.claimedCustomers} hesap Clerk ile eşleşti</div>
            </div>
        </div>
    `;

    const sourceFilters = [
        { key: 'all', label: 'Tümü', icon: '✦', count: stats.totalLeads },
        { key: 'web', label: 'Web', icon: '🌐', count: stats.bySource?.web || 0 },
        { key: 'whatsapp', label: 'WhatsApp', icon: '💬', count: stats.bySource?.whatsapp || 0 },
        { key: 'instagram', label: 'Instagram', icon: '📸', count: stats.bySource?.instagram || 0 },
        { key: 'facebook', label: 'Facebook', icon: '📘', count: stats.bySource?.facebook || 0 },
        { key: 'tiktok_youtube', label: 'TikTok / YT', icon: '▶️', count: stats.bySource?.tiktok_youtube || 0 },
    ];

    const statusFilters = [
        { key: 'all', label: 'Tüm Durumlar' },
        { key: 'yeni_talep', label: 'Yeni Talep' },
        { key: 'inceleniyor', label: 'İnceleniyor' },
        { key: 'fiyat_verildi', label: 'Fiyat Verildi' },
        { key: 'onaylandi', label: 'Onaylandı' },
        { key: 'iptal', label: 'İptal' },
    ];

    const controlsHtml = `
        <div class="card" style="padding:16px 20px;margin-bottom:18px;">
            <div class="crm-filter-bar">
                <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-right:4px;">Kaynak:</span>
                ${sourceFilters
                    .map(
                        (f) => `
                        <button class="crm-chip-btn ${crmState.sourceFilter === f.key ? 'active' : ''}"
                            onclick="window.__crmSetSource('${f.key}')">
                            <span>${f.icon}</span>
                            <span>${esc(f.label)}</span>
                            <span class="crm-chip-count">${f.count}</span>
                        </button>`
                    )
                    .join('')}
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                <div class="crm-filter-bar" style="margin-bottom:0;">
                    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-right:4px;">Durum:</span>
                    ${statusFilters
                        .map(
                            (st) => `
                            <button class="crm-chip-btn ${crmState.statusFilter === st.key ? 'active' : ''}"
                                onclick="window.__crmSetStatus('${st.key}')">
                                ${esc(st.label)}
                            </button>`
                        )
                        .join('')}
                </div>
                <div style="display:flex;gap:10px;align-items:center;">
                    <input
                        id="crmSearchInput"
                        type="search"
                        class="crm-form-input"
                        style="width:260px;padding:8px 12px;"
                        placeholder="İsim, tel, ref kod, şehir ara..."
                        value="${esc(crmState.searchQuery)}"
                        oninput="window.__crmSetSearch(this.value)"
                    />
                    <button class="btn btn-primary" onclick="window.__crmOpenCreateModal()" style="white-space:nowrap;">+ Manuel Talep Ekle</button>
                </div>
            </div>
        </div>
    `;

    const rowsHtml = filtered.length
        ? filtered
              .map((lead) => {
                  const cust = lead.customer || {};
                  const isApproved = lead.status === 'onaylandi';
                  const hasOrder = Boolean(lead.erp_order_id);
                  const claimedBadge = cust.clerk_user_id
                      ? '<span title="Müşteri Clerk hesabı ile giriş yapıp bu talebi sahiplendi" style="font-size:10px;padding:2px 6px;border-radius:6px;background:rgba(16,185,129,0.16);color:#34d399;border:1px solid rgba(16,185,129,0.3);font-weight:700;">✓ Üye Hesaplı</span>'
                      : '<span title="Üyeliksiz Lazy Register (Clerk girişi yapınca otomatik bağlanır)" style="font-size:10px;padding:2px 6px;border-radius:6px;background:rgba(148,163,184,0.12);color:#94a3b8;border:1px solid rgba(148,163,184,0.22);">Misafir Kayıt</span>';

                  const orderActionBtn = hasOrder
                      ? `<span class="crm-status-pill crm-status-onaylandi" title="Modül 4 Atölye İş Emri">🏭 ${esc(lead.erp_order_id)}</span>`
                      : isApproved
                      ? `<button class="btn btn-primary" style="padding:5px 10px;font-size:11px;background:linear-gradient(135deg,#059669,#10b981);border:none;" onclick="event.stopPropagation();window.__crmConvertOrder('${esc(lead.id)}')">🏭 Siparişe Dönüştür</button>`
                      : '';

                  return `
                      <tr style="cursor:pointer;" onclick="window.__crmOpenDrawer('${esc(lead.id)}')">
                          <td>
                              <div style="font-family:monospace;font-weight:700;color:#facc15;">${esc(lead.reference_code)}</div>
                              <div class="text-muted" style="font-size:11px;">${formatDateTimeTR(lead.created_at)}</div>
                          </td>
                          <td>
                              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                                  <strong style="color:#f8fafc;">${esc(cust.full_name || 'İsimsiz Müşteri')}</strong>
                                  ${claimedBadge}
                              </div>
                              <div class="text-muted" style="font-size:12px;margin-top:2px;">
                                  ${esc(cust.phone || '—')}
                                  ${cust.city ? ` • ${esc(cust.city)}` : ''}
                                  ${cust.instagram_handle ? ` • <span style="color:#f472b6;">${esc(cust.instagram_handle)}</span>` : ''}
                              </div>
                          </td>
                          <td>${getSourceBadge(lead.source)}</td>
                          <td>
                              <div style="font-weight:600;color:#e2e8f0;">${esc(lead.collection_name || 'Genel Teklif Talebi')}</div>
                              <div class="text-muted" style="font-size:11px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                                  ${esc(summarizeDetails(lead))}
                              </div>
                          </td>
                          <td style="font-weight:700;color:${lead.quoted_price ? '#38bdf8' : 'var(--text-muted)'};">
                              ${esc(formatPriceTRY(lead.quoted_price))}
                          </td>
                          <td>${getStatusBadge(lead.status)}</td>
                          <td>
                              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                                  <button class="btn btn-outline" style="padding:5px 10px;font-size:11px;" onclick="event.stopPropagation();window.__crmOpenDrawer('${esc(lead.id)}')">Teklif / Düzenle</button>
                                  ${orderActionBtn}
                              </div>
                          </td>
                      </tr>
                  `;
              })
              .join('')
        : `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:34px;">Seçili filtrelere uyan teklif veya müşteri talebi bulunamadı.</td></tr>`;

    root.innerHTML = `
        ${migrationBanner}
        ${kpiHtml}
        ${controlsHtml}
        <div class="card">
            <div class="card-header">
                <h3>Omnichannel Talep ve Teklif Yönetimi (${filtered.length})</h3>
                <button class="btn btn-outline" onclick="window.__crmRefresh()" style="padding:6px 12px;font-size:12px;">↻ Yenile</button>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Referans / Tarih</th>
                            <th>Müşteri (Tekil Tel)</th>
                            <th>Kanal</th>
                            <th>Koleksiyon & Ölçü / Modüller</th>
                            <th>Verilen Fiyat</th>
                            <th>Durum</th>
                            <th>İşlem</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;

    renderDrawerIfOpen();
}

function ensureDrawerContainer() {
    let el = document.getElementById('crmDrawerBackdrop');
    if (!el) {
        el = document.createElement('div');
        el.id = 'crmDrawerBackdrop';
        el.className = 'crm-drawer-backdrop';
        el.addEventListener('click', (e) => {
            if (e.target === el) {
                crmState.activeLeadId = null;
                el.classList.remove('open');
            }
        });
        document.body.appendChild(el);
    }
    return el;
}

function renderDrawerIfOpen() {
    const backdrop = ensureDrawerContainer();
    if (!crmState.activeLeadId) {
        backdrop.classList.remove('open');
        backdrop.innerHTML = '';
        return;
    }

    const lead = crmState.leads.find((l) => l.id === crmState.activeLeadId);
    if (!lead) {
        crmState.activeLeadId = null;
        backdrop.classList.remove('open');
        backdrop.innerHTML = '';
        return;
    }

    const cust = lead.customer || {};
    const d = lead.product_details || {};
    const modulesText = Array.isArray(d.modules) ? d.modules.join(', ') : (d.module || '—');

    backdrop.classList.add('open');
    backdrop.innerHTML = `
        <div class="crm-drawer-panel" onclick="event.stopPropagation()">
            <div class="crm-drawer-header">
                <div>
                    <div style="font-size:11px;color:#facc15;font-family:monospace;font-weight:700;">${esc(lead.reference_code)} • ${getSourceBadge(lead.source)}</div>
                    <h3 style="margin-top:4px;font-size:17px;">${esc(cust.full_name || 'Müşteri')}</h3>
                </div>
                <button class="modal-close" onclick="window.__crmCloseDrawer()">&times;</button>
            </div>

            <div class="crm-drawer-body">
                <div class="crm-drawer-section">
                    <div class="crm-form-label">Birleşik Müşteri Kartı</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
                        <div><span class="text-muted">Telefon:</span><br><strong>${esc(cust.phone || '—')}</strong></div>
                        <div><span class="text-muted">Şehir:</span><br><strong>${esc(cust.city || 'Belirtilmedi')}</strong></div>
                        <div><span class="text-muted">E-posta:</span><br><strong>${esc(cust.email || '—')}</strong></div>
                        <div><span class="text-muted">Clerk Hesap:</span><br><strong>${cust.clerk_user_id ? '✓ Eşleşti (' + esc(cust.clerk_user_id.slice(0, 12)) + '…)' : 'Misafir (Henüz Üye Değil)'}</strong></div>
                    </div>
                </div>

                <div class="crm-drawer-section">
                    <div class="crm-form-label">Talep Edilen Tasarım & Teknik Detaylar</div>
                    <div style="font-size:13px;display:flex;flex-direction:column;gap:6px;">
                        <div><span class="text-muted">Koleksiyon / Ürün:</span> <strong>${esc(lead.collection_name || 'Belirtilmedi')}</strong></div>
                        <div><span class="text-muted">Seçilen Modüller:</span> <strong>${esc(modulesText)}</strong></div>
                        <div><span class="text-muted">Ölçü Bilgisi:</span> <strong>${esc(d.dimensions || '—')}</strong></div>
                        <div><span class="text-muted">Renk / Kaplama:</span> <strong>${esc(d.finish_color || '—')}</strong></div>
                        <div><span class="text-muted">Müşteri Notu:</span> <span style="color:#e2e8f0;">${esc(d.notes || '—')}</span></div>
                    </div>
                </div>

                <form id="crmQuoteUpdateForm" class="crm-drawer-section" style="display:flex;flex-direction:column;gap:12px;">
                    <div>
                        <label class="crm-form-label" for="crmEditStatus">Teklif Durumu</label>
                        <select id="crmEditStatus" class="crm-form-select">
                            ${Object.entries(STATUS_META)
                                .map(([k, v]) => `<option value="${k}" ${lead.status === k ? 'selected' : ''}>${esc(v.label)}</option>`)
                                .join('')}
                        </select>
                    </div>

                    <div>
                        <label class="crm-form-label" for="crmEditPrice">Verilen Teklif Fiyatı (₺ TRY)</label>
                        <input
                            id="crmEditPrice"
                            type="number"
                            step="0.01"
                            min="0"
                            class="crm-form-input"
                            placeholder="Örn: 48500 (Girildiğinde durum Fiyat Verildi olur)"
                            value="${lead.quoted_price !== null && lead.quoted_price !== undefined ? esc(lead.quoted_price) : ''}"
                        />
                    </div>

                    <div>
                        <label class="crm-form-label" for="crmEditStaffNote">Müşteriye Görünecek Temsilci Notu (/hesabim/tekliflerim)</label>
                        <textarea id="crmEditStaffNote" rows="3" class="crm-form-textarea" placeholder="Örn: İpek mat membran kapak + LED dahil teslim süresi 21 gündür.">${esc(lead.staff_note || '')}</textarea>
                    </div>

                    <div>
                        <label class="crm-form-label" for="crmEditAiSummary">Bot / Dahili Müşteri Özeti</label>
                        <textarea id="crmEditAiSummary" rows="2" class="crm-form-textarea" placeholder="İleride AI botlarından veya görüşmeden gelen özet...">${esc(lead.ai_summary || '')}</textarea>
                    </div>

                    <div style="display:flex;gap:10px;flex-wrap:wrap;padding-top:4px;">
                        <button type="submit" id="crmSaveLeadBtn" class="btn btn-primary" style="flex:1;">💾 Teklifi & Durumu Kaydet</button>
                    </div>
                </form>

                <div class="crm-drawer-section" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                    <div>
                        <div class="crm-form-label" style="margin-bottom:2px;">Fabrika Üretim Hattı (Modül 4)</div>
                        <div style="font-size:12px;color:#cbd5e1;">
                            ${lead.erp_order_id ? `Atölyeye aktarıldı: <strong>${esc(lead.erp_order_id)}</strong>` : 'Onaylanan teklifi tek tıkla Modül 4 atölye sırasına gönderin.'}
                        </div>
                    </div>
                    ${
                        lead.erp_order_id
                            ? `<button type="button" class="btn btn-outline" onclick="window.__crmCloseDrawer();if(typeof navigateTo==='function')navigateTo('module4');">Atölyede Gör →</button>`
                            : `<button type="button" id="crmConvertOrderBtn" class="btn btn-primary" style="background:linear-gradient(135deg,#059669,#10b981);border:none;" onclick="window.__crmConvertOrder('${esc(lead.id)}')">🏭 Siparişe Dönüştür</button>`
                    }
                </div>
            </div>
        </div>
    `;

    const form = document.getElementById('crmQuoteUpdateForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('crmSaveLeadBtn');
            const rawStatus = document.getElementById('crmEditStatus')?.value || lead.status;
            const rawPrice = document.getElementById('crmEditPrice')?.value;
            const staffNote = document.getElementById('crmEditStaffNote')?.value ?? '';
            const aiSummary = document.getElementById('crmEditAiSummary')?.value ?? '';

            // Fiyat ilk kez giriliyorsa ve kullanıcı durumu yeni_talep/inceleniyor bıraktıysa otomatik fiyat_verildi yap
            let nextStatus = rawStatus;
            if (rawPrice && Number(rawPrice) > 0 && ['yeni_talep', 'inceleniyor'].includes(rawStatus)) {
                nextStatus = 'fiyat_verildi';
            }

            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Kaydediliyor...';
            }

            try {
                const res = await fetch('/api/crm-customers', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lead_id: lead.id,
                        status: nextStatus,
                        quoted_price: rawPrice === '' ? null : Number(rawPrice),
                        staff_note: staffNote,
                        ai_summary: aiSummary,
                    }),
                });
                const json = await res.json();
                if (!res.ok || !json.ok) {
                    throw new Error(json.error || `HTTP ${res.status}`);
                }
                if (typeof window.showToast === 'function') {
                    window.showToast('Teklif bilgileri güncellendi (' + lead.reference_code + ')', 'success');
                }
                await fetchUnifiedCrmData();
            } catch (err) {
                if (typeof window.showToast === 'function') {
                    window.showToast('Kayıt hatası: ' + err.message, 'error');
                }
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '💾 Teklifi & Durumu Kaydet';
                }
            }
        });
    }
}

window.__crmSetSource = function (src) {
    crmState.sourceFilter = src;
    renderCrmInteractiveView();
};

window.__crmSetStatus = function (st) {
    crmState.statusFilter = st;
    renderCrmInteractiveView();
};

window.__crmSetSearch = function (val) {
    crmState.searchQuery = val || '';
    renderCrmInteractiveView();
};

window.__crmRefresh = function () {
    fetchUnifiedCrmData();
};

window.__crmOpenDrawer = function (leadId) {
    crmState.activeLeadId = leadId;
    renderDrawerIfOpen();
};

window.__crmCloseDrawer = function () {
    crmState.activeLeadId = null;
    renderDrawerIfOpen();
};

window.__crmConvertOrder = async function (leadId) {
    try {
        const res = await fetch('/api/crm-convert-to-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_id: leadId }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
            throw new Error(json.error || `HTTP ${res.status}`);
        }
        if (typeof window.showToast === 'function') {
            window.showToast(json.message || `İş emri oluşturuldu: ${json.erp_order_id}`, 'success');
        }
        await fetchUnifiedCrmData();
    } catch (err) {
        if (typeof window.showToast === 'function') {
            window.showToast('Siparişe dönüştürülemedi: ' + err.message, 'error');
        }
    }
};

window.__crmOpenCreateModal = function () {
    if (typeof window.showModal !== 'function') return;
    window.showModal(
        'Yeni Manuel Müşteri / Kanal Talebi Ekle',
        `
        <form id="crmManualLeadForm" style="display:flex;flex-direction:column;gap:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                    <label class="crm-form-label">Kanal Kaynağı</label>
                    <select id="manSource" class="crm-form-select">
                        <option value="whatsapp">WhatsApp</option>
                        <option value="instagram">Instagram</option>
                        <option value="facebook">Facebook</option>
                        <option value="tiktok_youtube">TikTok / YouTube</option>
                        <option value="web">Web / Telefon</option>
                    </select>
                </div>
                <div>
                    <label class="crm-form-label">Şehir</label>
                    <input id="manCity" class="crm-form-input" placeholder="İstanbul" />
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                    <label class="crm-form-label">Ad Soyad *</label>
                    <input id="manName" required class="crm-form-input" placeholder="Müşteri Adı" />
                </div>
                <div>
                    <label class="crm-form-label">Telefon *</label>
                    <input id="manPhone" required class="crm-form-input" placeholder="05XX XXX XX XX" />
                </div>
            </div>
            <div>
                <label class="crm-form-label">Koleksiyon / Talep Edilen Ürün</label>
                <input id="manCollection" class="crm-form-input" placeholder="Örn: Marsilya Kahve Köşesi" />
            </div>
            <div>
                <label class="crm-form-label">Ölçü & Notlar</label>
                <textarea id="manNotes" rows="3" class="crm-form-textarea" placeholder="220cm genişlik, kemerli üst kapak..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Talebi Kaydet</button>
        </form>
        `
    );

    const f = document.getElementById('crmManualLeadForm');
    if (f) {
        f.addEventListener('submit', async (e) => {
            e.preventDefault();
            const res = await fetch('/api/crm-customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: document.getElementById('manSource')?.value || 'whatsapp',
                    full_name: document.getElementById('manName')?.value || '',
                    phone: document.getElementById('manPhone')?.value || '',
                    city: document.getElementById('manCity')?.value || '',
                    collection_name: document.getElementById('manCollection')?.value || '',
                    product_details: {
                        notes: document.getElementById('manNotes')?.value || '',
                    },
                }),
            });
            const json = await res.json();
            if (json.ok) {
                if (typeof window.closeModal === 'function') window.closeModal();
                if (typeof window.showToast === 'function') window.showToast('Talep oluşturuldu: ' + json.reference_code, 'success');
                fetchUnifiedCrmData();
            } else if (typeof window.showToast === 'function') {
                window.showToast(json.error || 'Hata oluştu', 'error');
            }
        });
    }
};

export function renderCrmModule() {
    setTimeout(() => {
        fetchUnifiedCrmData();
    }, 0);

    return `
        <div class="module-header">
            <h2 class="title">Omnichannel Müşteri & Teklif Merkezi (CRM)</h2>
            <p class="subtitle">Web (Lazy Register), WhatsApp, Instagram, Facebook ve TikTok/YouTube üzerinden gelen tüm müşteri taleplerini tek havuzdan yönetin.</p>
        </div>

        <div id="crmLiveRoot">
            <div class="card" style="padding:36px;text-align:center;color:var(--text-muted);">
                Canlı Supabase CRM verileri yükleniyor...
            </div>
        </div>
    `;
}

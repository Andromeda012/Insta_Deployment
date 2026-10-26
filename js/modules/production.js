// Module 4: Production & Factory Control Panel
export function renderProductionModule(data) {
    const prod = data.production;

    return `
        <div class="page-header">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span onclick="window.navigateTo('dashboard')">Ana Sayfa</span> / 
                    <span>Modül 4: Üretim & Fabrika Kontrol</span>
                </div>
                <h1>İmalat & CNC Üretim Takip Paneli</h1>
                <p class="subtitle">Mobilya üretim iş emirleri, CNC kesim merkezleri kapasitesi, atölye aşamaları ve termin takibi.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-secondary" onclick="window.showToast('CNC Telemetri Verileri Yenilendi')">
                    🔄 Telemetri Yenile
                </button>
                <button class="btn btn-primary" onclick="window.showModal('Yeni Üretim Emri', 'Nebim ERP senkronizasyonu veya manuel iş emri açma arayüzü simülasyonu.')">
                    + Yeni İş Emri Aç
                </button>
            </div>
        </div>

        <!-- Warning Banner for Delayed Orders -->
        ${prod.summary.ordersDelayed > 0 ? `
            <div class="alert-banner warning">
                <div class="alert-icon">⚠️</div>
                <div class="alert-content">
                    <strong>Dikkat: ${prod.summary.ordersDelayed} Adet Siparişte Termin Riski Bulunuyor</strong>
                    <p>İthal kumaş tedarik gecikmesi ve CNC-03 bıçak bakımı nedeniyle teslimat takviminde 2 günlük esneme oluştu.</p>
                </div>
                <button class="btn btn-secondary" onclick="window.showToast('Geciken siparişler filtrelendi')">Kritik Siparişleri Gör</button>
            </div>
        ` : ''}

        <!-- Metrics -->
        <div class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Aktif İmalat Emri</span>
                    <span class="metric-icon">🔨</span>
                </div>
                <div class="metric-value">${prod.summary.activeOrders} <span class="sub-val">Sipariş</span></div>
                <div class="metric-meta text-success">${prod.summary.ordersOnSchedule} sipariş takvime uygun</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Haftalık Tamamlanan</span>
                    <span class="metric-icon">✅</span>
                </div>
                <div class="metric-value">${prod.summary.weeklyCompletedUnits} <span class="sub-val">Birim</span></div>
                <div class="metric-meta text-primary">+12 birim önceki haftaya göre</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">CNC Kapasite Kullanımı</span>
                    <span class="metric-icon">⚙️</span>
                </div>
                <div class="metric-value">${prod.summary.cncCapacityUtilization}</div>
                <div class="metric-meta text-success">Optimal çalışma bandında</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Fabrika Vardiyası</span>
                    <span class="metric-icon">👷</span>
                </div>
                <div class="metric-value">2. Vardiya</div>
                <div class="metric-meta">54 Usta & Teknisyen Aktif</div>
            </div>
        </div>

        <!-- CNC Workstations Overview Cards -->
        <div class="section-title-row">
            <h3>CNC İşleme Merkezleri & Otomasyon Tezgahları</h3>
            <span class="tag">Fabrika Katı Canlı Veri</span>
        </div>

        <div class="cnc-grid">
            ${prod.cncUnits.map(cnc => `
                <div class="card cnc-card">
                    <div class="cnc-header">
                        <div>
                            <h4>${cnc.name}</h4>
                            <span class="cnc-code">${cnc.id}</span>
                        </div>
                        <span class="badge ${cnc.status === 'Çalışıyor' ? 'badge-success' : 'badge-warning'}">
                            ${cnc.status}
                        </span>
                    </div>
                    <div class="cnc-body">
                        <div class="cnc-metric">
                            <span>Anlık Yük:</span>
                            <strong>${cnc.load}</strong>
                        </div>
                        <div class="progress-bar-wrap" style="margin: 8px 0 14px 0;">
                            <div class="progress-bar ${cnc.load === '%92' ? 'bg-primary' : ''}" style="width: ${cnc.load.replace('%','')}%"></div>
                        </div>
                        <div class="cnc-detail-row">
                            <span>Mevcut İş:</span>
                            <small><strong>${cnc.currentJob}</strong></small>
                        </div>
                        <div class="cnc-detail-row">
                            <span>Operatör:</span>
                            <small>${cnc.operator}</small>
                        </div>
                        <div class="cnc-detail-row">
                            <span>Sonraki Bakım:</span>
                            <small class="text-muted">${cnc.maintenanceDue}</small>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Manufacturing Orders Table -->
        <div class="card panel" style="margin-top: 24px;">
            <div class="panel-header">
                <div class="panel-title-wrap">
                    <h3>İmalat İş Emirleri & Aşamalar</h3>
                    <span class="tag">Üretim İlerlemesi</span>
                </div>
                <div class="toolbar-actions">
                    <input type="text" class="form-input-sm" placeholder="İş emri veya ürün ara..." onkeyup="window.filterTable('orders-table', this.value)">
                </div>
            </div>

            <div class="table-responsive">
                <table class="data-table" id="orders-table">
                    <thead>
                        <tr>
                            <th>Emir No</th>
                            <th>Müşteri</th>
                            <th>Ürün & Adet</th>
                            <th>Aşama</th>
                            <th>İlerleme</th>
                            <th>Sorumlu Ekip</th>
                            <th>Hedef Tarih</th>
                            <th>Durum</th>
                            <th>İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${prod.workOrders.map(ord => `
                            <tr>
                                <td><code>${ord.id}</code></td>
                                <td><strong>${ord.customer}</strong></td>
                                <td>
                                    <div>${ord.item}</div>
                                    <small class="text-muted">${ord.quantity}</small>
                                </td>
                                <td>
                                    <span class="badge badge-secondary">${ord.stage}</span>
                                </td>
                                <td>
                                    <div class="progress-bar-wrap">
                                        <div class="progress-bar" style="width: ${ord.progress}%;"></div>
                                        <span>%${ord.progress}</span>
                                    </div>
                                </td>
                                <td><small>${ord.team}</small></td>
                                <td>${ord.targetDate}</td>
                                <td>
                                    <span class="badge ${ord.status === 'İşlemde' ? 'badge-primary' : ord.status === 'Tamamlanmak Üzere' ? 'badge-success' : ord.status === 'Gecikme Riski' ? 'badge-warning' : 'badge-secondary'}">
                                        ${ord.status}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn-action" onclick="window.showWorkOrderDetail('${ord.id}')">Detay</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

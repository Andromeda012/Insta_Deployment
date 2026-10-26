// Module 6: Performance Analytics Control Panel
export function renderAnalyticsModule(data) {
    const an = data.analytics;

    return `
        <div class="page-header">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span onclick="window.navigateTo('dashboard')">Ana Sayfa</span> / 
                    <span>Modül 6: Performans Analitiği</span>
                </div>
                <h1>Konsolide İşletme Performans Analitiği</h1>
                <p class="subtitle">Satış trendleri, üretim verimliliği, web/sosyal medya dönüşümleri ve operasyonel KPI göstergeleri.</p>
            </div>
            <div class="page-actions">
                <!-- Date Range Selector -->
                <div class="date-range-group">
                    <span class="icon">📅</span>
                    <select class="form-select" onchange="window.showToast('Tarih aralığı uygulandı: ' + this.value)">
                        ${an.dateRanges.map((r, i) => `<option value="${r}" ${i === 1 ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-secondary" onclick="window.toggleAnalyticsEmptyState()">
                    🔄 Veri/Boş Durum Testi
                </button>
            </div>
        </div>

        <div id="analytics-content">
            <!-- Executive KPI Cards -->
            <div class="metrics-grid">
                ${an.kpis.map(kpi => `
                    <div class="card metric-card">
                        <div class="metric-header">
                            <span class="metric-title">${kpi.title}</span>
                            <span class="badge ${kpi.positive ? 'badge-success' : 'badge-warning'}">${kpi.change}</span>
                        </div>
                        <div class="metric-value">${kpi.value}</div>
                        <div class="metric-meta text-muted">${kpi.period}</div>
                    </div>
                `).join('')}
            </div>

            <!-- Charts Row 1: Monthly Sales Trend & Channel Breakdown -->
            <div class="content-split" style="margin-top: 24px;">
                <!-- Bar / Trend Visualizer -->
                <div class="card panel">
                    <div class="panel-header">
                        <div class="panel-title-wrap">
                            <h3>Aylık Ciro ve Satış Trendi (Milyon ₺)</h3>
                            <span class="tag">Mayıs - Ekim 2026</span>
                        </div>
                    </div>
                    <div class="chart-container">
                        <div class="bar-chart-visual">
                            ${an.monthlySalesChart.map(m => `
                                <div class="chart-col">
                                    <div class="bar-tooltip">${m.month}: ₺${m.sales}M (Hedef: ₺${m.target}M)</div>
                                    <div class="chart-bar-wrap">
                                        <div class="chart-bar-target" style="height: ${(m.target / 16) * 160}px;" title="Hedef: ₺${m.target}M"></div>
                                        <div class="chart-bar-actual" style="height: ${(m.sales / 16) * 160}px;" title="Gerçekleşen: ₺${m.sales}M"></div>
                                    </div>
                                    <span class="chart-label">${m.month}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="chart-legend">
                            <span class="legend-item"><span class="legend-box actual"></span> Gerçekleşen Ciro</span>
                            <span class="legend-item"><span class="legend-box target"></span> Bütçelenen Hedef</span>
                        </div>
                    </div>
                </div>

                <!-- Channel Revenue Breakdown -->
                <div class="card panel">
                    <div class="panel-header">
                        <div class="panel-title-wrap">
                            <h3>Gelir Kaynakları ve Kanal Payı</h3>
                            <span class="tag">Toplam: ₺14.8M</span>
                        </div>
                    </div>
                    <div class="channel-distribution-list">
                        ${an.channelBreakdown.map(ch => `
                            <div class="dist-item">
                                <div class="dist-header">
                                    <strong>${ch.channel}</strong>
                                    <span>${ch.revenue} (%${ch.percentage})</span>
                                </div>
                                <div class="progress-bar-wrap">
                                    <div class="progress-bar bg-primary" style="width: ${ch.percentage}%;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Cross-domain Performance Table -->
            <div class="card panel" style="margin-top: 24px;">
                <div class="panel-header">
                    <h3>Departman & Süreç Bazlı Verimlilik Karşılaştırması</h3>
                    <span class="badge badge-accent">Q4 Durumu</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Operasyon Alanı</th>
                                <th>Temel Metrik (KPI)</th>
                                <th>Hedef</th>
                                <th>Mevcut Değer</th>
                                <th>Başarı Oranı</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Üretim & Atölye</strong></td>
                                <td>Haftalık İmalat Çıktısı</td>
                                <td>140 Ürün</td>
                                <td>148 Ürün</td>
                                <td><strong class="text-success">%105.7</strong></td>
                                <td><span class="badge badge-success">Hedef Aşıldı</span></td>
                            </tr>
                            <tr>
                                <td><strong>CNC Kesim Hattı</strong></td>
                                <td>Kapasite Doluluk Oranı</td>
                                <td>%90.0</td>
                                <td>%94.2</td>
                                <td><strong class="text-success">%104.6</strong></td>
                                <td><span class="badge badge-success">Yüksek Verim</span></td>
                            </tr>
                            <tr>
                                <td><strong>Satış & CRM</strong></td>
                                <td>Teklif Kabul Oranı (Win Rate)</td>
                                <td>%30.0</td>
                                <td>%34.2</td>
                                <td><strong class="text-success">%114.0</strong></td>
                                <td><span class="badge badge-success">Yüksek Performans</span></td>
                            </tr>
                            <tr>
                                <td><strong>Sosyal Medya Botu</strong></td>
                                <td>İlk Yanıt Süresi (DM / Yorum)</td>
                                <td>&lt; 5 Dakika</td>
                                <td>1.4 Dakika</td>
                                <td><strong class="text-success">%100</strong></td>
                                <td><span class="badge badge-success">Tam Otomasyon</span></td>
                            </tr>
                            <tr>
                                <td><strong>Web Sitesi</strong></td>
                                <td>Online Katalogdan Gelen Formlar</td>
                                <td>40 Form / Ay</td>
                                <td>38 Form / Ay</td>
                                <td><strong class="text-warning">%95.0</strong></td>
                                <td><span class="badge badge-warning">Takip Edilmeli</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

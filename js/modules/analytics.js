// Module 6: Performance Analytics Control Panel (Integrated with Live PostHog EU HogQL API)
export function renderAnalyticsModule(data) {
    const an = data.analytics;

    window.loadLivePostHogAnalytics = async function () {
        const box = document.getElementById('live-posthog-analytics-box');
        if (!box) return;
        box.innerHTML = '<div style="padding:16px;color:#94a3b8;font-size:13px;">📊 PostHog EU (HogQL) canlı B2C vitrin, 3D etkileşim ve teklif hunisi verileri yükleniyor…</div>';
        try {
            const res = await fetch('/api/product-analytics');
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.posthog) {
                box.innerHTML = `<div style="padding:14px;color:#fca5a5;font-size:13px;">⚠️ PostHog verileri alınamadı: ${json?.error || res.status}</div>`;
                return;
            }
            const ph = json.posthog;
            const s = ph.summary || {};
            const crm = json.crmSummary || {};

            const modelsRows = (ph.topModels && ph.topModels.length > 0)
                ? ph.topModels.map(m => `<tr><td><strong>${m.name}</strong></td><td><span class="badge badge-primary">${m.interactions} etkileşim</span></td></tr>`).join('')
                : '<tr><td colspan="2" style="color:#94a3b8;font-size:12px;">Henüz 30 günlük model etkileşimi birikmedi — Vitrin trafiği geldikçe otomatik dolacaktır.</td></tr>';

            const sourcesRows = (ph.topSources && ph.topSources.length > 0)
                ? ph.topSources.map(src => `<tr><td><strong>${src.source}</strong></td><td><span class="badge badge-success">${src.visits} ziyaret</span></td></tr>`).join('')
                : '<tr><td colspan="2" style="color:#94a3b8;font-size:12px;">Henüz kaynak verisi birikmedi — Sosyal medya bot linkleri ve vitrin girişleriyle anlık güncellenir.</td></tr>';

            box.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:12px;margin-bottom:16px;">
                    <div style="background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;">
                        <div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;">30g Tekil Ziyaretçi</div>
                        <div style="font-size:24px;font-weight:900;color:#38bdf8;margin-top:4px;">${s.uniqueVisitors30d || 0}</div>
                        <div style="font-size:11px;color:#94a3b8;">Sayfa Görüntüleme: ${s.pageviews30d || 0}</div>
                    </div>
                    <div style="background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;">
                        <div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Koleksiyon &amp; Ürün İnceleme</div>
                        <div style="font-size:24px;font-weight:900;color:#fde68a;margin-top:4px;">${s.collectionViews30d || 0}</div>
                        <div style="font-size:11px;color:#94a3b8;">PostHog EU (${ph.latencyMs || 0} ms)</div>
                    </div>
                    <div style="background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;">
                        <div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;">3D Model Etkileşimi</div>
                        <div style="font-size:24px;font-weight:900;color:#c084fc;margin-top:4px;">${s.model3dInteractions30d || 0}</div>
                        <div style="font-size:11px;color:#94a3b8;">3d_model_interacted</div>
                    </div>
                    <div style="background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;">
                        <div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Teklif &amp; CRM Kayıtları</div>
                        <div style="font-size:24px;font-weight:900;color:#34d399;margin-top:4px;">${Math.max(s.quoteSubmissions30d || 0, crm.totalQuotes || 0)}</div>
                        <div style="font-size:11px;color:#94a3b8;">Kayıtlı B2C Müşteri: ${crm.totalB2CCustomers || 0}</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">
                    <div style="background:rgba(15,23,42,0.65);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;">
                        <div style="font-size:12px;font-weight:800;color:#fde68a;margin-bottom:8px;">🛋️ En Çok İncelenen Koleksiyon &amp; 3D Modeller</div>
                        <table class="data-table" style="font-size:12px;"><tbody>${modelsRows}</tbody></table>
                    </div>
                    <div style="background:rgba(15,23,42,0.65);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;">
                        <div style="font-size:12px;font-weight:800;color:#38bdf8;margin-bottom:8px;">🌐 Trafik Kaynakları &amp; Sosyal Medya UTM</div>
                        <table class="data-table" style="font-size:12px;"><tbody>${sourcesRows}</tbody></table>
                    </div>
                </div>
            `;
        } catch (err) {
            box.innerHTML = `<div style="padding:14px;color:#fca5a5;font-size:13px;">⚠️ Bağlantı hatası: ${err.message}</div>`;
        }
    };

    setTimeout(() => { window.loadLivePostHogAnalytics(); }, 60);

    return `
        <div class="page-header">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span>Modül 6: Performans Analitiği</span>
                </div>
                <h1>Konsolide İşletme &amp; PostHog Ürün Analitiği</h1>
                <p class="subtitle">PostHog EU canlı B2C etkileşimleri, 3D model ilgisi, teklif dönüşümleri ve operasyonel KPI göstergeleri.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-primary" onclick="window.loadLivePostHogAnalytics()">
                    📊 PostHog Verilerini Yenile
                </button>
                <button class="btn btn-secondary" onclick="window.toggleAnalyticsEmptyState()">
                    🔄 Veri/Boş Durum Testi
                </button>
            </div>
        </div>

        <div id="analytics-content">
            <!-- Canlı PostHog EU (HogQL) B2C Ürün & Dönüşüm Paneli -->
            <div class="card panel" style="margin-bottom:24px; border:1px solid rgba(168,85,247,0.35);">
                <div class="panel-header">
                    <div class="panel-title-wrap">
                        <h3>📊 Canlı PostHog EU — Vitrin, 3D Showroom &amp; Teklif Hunisi</h3>
                        <span class="tag">Project #361931 • HogQL API</span>
                    </div>
                </div>
                <div id="live-posthog-analytics-box"></div>
            </div>
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

// Module: Global Dashboard Overview
export function renderDashboard(data, navigateTo) {
    const todayStr = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'full' }).format(new Date());

    return `
        <div class="page-header">
            <div class="page-title-group">
                <span class="badge badge-accent">Merkezi Kontrol Paneli</span>
                <h1>Global Mobilya Operasyon Platformu</h1>
                <p class="subtitle">Bugün ${todayStr} • Sistem Durumu: <span class="status-dot online"></span> <strong>Tüm Modüller Operasyonel</strong></p>
            </div>
            <div class="page-actions">
                <button class="btn btn-secondary" onclick="window.triggerRefresh()">
                    <span class="icon">🔄</span> Metrikleri Güncelle
                </button>
                <button class="btn btn-primary" onclick="window.navigateTo('production')">
                    <span class="icon">🏭</span> Aktif Üretime Git
                </button>
            </div>
        </div>

        <!-- High-level KPI Banner -->
        <section class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Aylık Toplam Ciro</span>
                    <span class="metric-icon">₺</span>
                </div>
                <div class="metric-value">${data.globalMetrics.monthlyRevenue}</div>
                <div class="metric-meta text-success">↑ %18.4 büyüme (Q4 hedefi üstünde)</div>
            </div>

            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Aktif Üretim İş Emri</span>
                    <span class="metric-icon">📦</span>
                </div>
                <div class="metric-value">${data.globalMetrics.activeWorkOrders} <span class="sub-val">Sipariş</span></div>
                <div class="metric-meta text-warning">${data.globalMetrics.delayedOrders} siparişte gecikme riski</div>
            </div>

            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">CNC Kapasite Kullanımı</span>
                    <span class="metric-icon">⚙️</span>
                </div>
                <div class="metric-value">${data.globalMetrics.cncEfficiency}</div>
                <div class="metric-meta text-success">3 CNC ünitesi ortalaması</div>
            </div>

            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">CRM Aktif Fırsatlar</span>
                    <span class="metric-icon">🎯</span>
                </div>
                <div class="metric-value">${data.globalMetrics.activeLeads} <span class="sub-val">Talep</span></div>
                <div class="metric-meta text-primary">${data.crm.summary.totalPipelineValue} değerinde</div>
            </div>
        </section>

        <!-- The Six Primary Modules Grid -->
        <div class="section-title-row">
            <h2>Ana İşletme Modülleri (6 Modül)</h2>
            <span class="tag">Rol Bazlı Erişimli</span>
        </div>

        <section class="modules-grid">
            <!-- Module 1 -->
            <div class="card module-card" onclick="window.navigateTo('website')">
                <div class="module-card-header">
                    <div class="module-icon-wrap" style="background: rgba(59, 130, 246, 0.12); color: #3b82f6;">🌐</div>
                    <span class="badge badge-success">Canlı CMS Aktif</span>
                </div>
                <h3>1. Web Sitesi Yönetimi</h3>
                <p>GitHub & Vercel bulut bağlantılı ürün kataloğu, firma ayarları, ana sayfa vitrini, galeri, blog ve tedarikçi yönetim merkezi.</p>
                <div class="module-stats">
                    <div class="stat-item"><span>Bağlı Depo:</span> <strong>Global-Mobilya-Web</strong></div>
                    <div class="stat-item"><span>Modüller:</span> <strong>7 Yönetim Sekmesi</strong></div>
                </div>
                <div class="module-footer-link">
                    Web Sitesi Yönetim Merkezini Aç <span>→</span>
                </div>
            </div>

            <!-- Module 2 -->
            <div class="card module-card" onclick="window.navigateTo('social')">
                <div class="module-card-header">
                    <div class="module-icon-wrap" style="background: rgba(168, 85, 247, 0.12); color: #a855f7;">🤖</div>
                    <span class="badge badge-success">4 Kanal Bağlı</span>
                </div>
                <h3>2. Sosyal Medya Bot Paneli</h3>
                <p>Instagram, TikTok ve YouTube kanal otomasyonları, içerik planlama takvimi, otomatik DM ve yorum yanıtları.</p>
                <div class="module-stats">
                    <div class="stat-item"><span>Kuyrukta:</span> <strong>${data.social.scheduledQueue.length} Gönderi</strong></div>
                    <div class="stat-item"><span>Otomatik Yanıt:</span> <strong>%98.6</strong></div>
                </div>
                <div class="module-footer-link">
                    Modülü Yönet <span>→</span>
                </div>
            </div>

            <!-- Module 3 -->
            <div class="card module-card" onclick="window.navigateTo('crm')">
                <div class="module-card-header">
                    <div class="module-icon-wrap" style="background: rgba(16, 185, 129, 0.12); color: #10b981;">👥</div>
                    <span class="badge badge-info">B2B / B2C</span>
                </div>
                <h3>3. CRM & Satış Yönetimi</h3>
                <p>Merkezi müşteri portföyü, mimari proje teklifleri, çok kanallı talep hunisi ve sözleşme aşamaları.</p>
                <div class="module-stats">
                    <div class="stat-item"><span>Huni Hacmi:</span> <strong>${data.crm.summary.totalPipelineValue}</strong></div>
                    <div class="stat-item"><span>Kazanma Oranı:</span> <strong>${data.crm.summary.winRate}</strong></div>
                </div>
                <div class="module-footer-link">
                    Modülü Yönet <span>→</span>
                </div>
            </div>

            <!-- Module 4 -->
            <div class="card module-card" onclick="window.navigateTo('production')">
                <div class="module-card-header">
                    <div class="module-icon-wrap" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b;">🏭</div>
                    <span class="badge badge-success">Canlı Firebase</span>
                </div>
                <h3>4. Üretim & Fabrika Kontrol</h3>
                <p>7 istasyonlu canlı Kanban üretim panosu (Çizim, CNC, Zımpara, Tutkal, Membran, Sevkiyat), QR barkod, TV modu, bakiye ve müşteri takip merkezi.</p>
                <div class="module-stats">
                    <div class="stat-item"><span>Veritabanı:</span> <strong>7/24 Bulut Senkron</strong></div>
                    <div class="stat-item"><span>İstasyonlar:</span> <strong>6 + Arşiv & Kiosk</strong></div>
                </div>
                <div class="module-footer-link">
                    Üretim & Sipariş Takip Merkezini Aç <span>→</span>
                </div>
            </div>

            <!-- Module 5 -->
            <div class="card module-card" onclick="window.navigateTo('operations')">
                <div class="module-card-header">
                    <div class="module-icon-wrap" style="background: rgba(14, 165, 233, 0.12); color: #0ea5e9;">🛡️</div>
                    <span class="badge badge-success">Stabil</span>
                </div>
                <h3>5. Altyapı & Operasyon Paneli</h3>
                <p>Vercel Edge & Cloudflare altyapısı, AWS S3 yedekleri, ERP canlı soket bağlantısı ve aylık operasyon maliyetleri.</p>
                <div class="module-stats">
                    <div class="stat-item"><span>Uptime:</span> <strong>%99.98</strong></div>
                    <div class="stat-item"><span>Aylık Maliyet:</span> <strong>${data.operations.costs.monthlyEstimated}</strong></div>
                </div>
                <div class="module-footer-link">
                    Modülü Yönet <span>→</span>
                </div>
            </div>

            <!-- Module 6 -->
            <div class="card module-card" onclick="window.navigateTo('analytics')">
                <div class="module-card-header">
                    <div class="module-icon-wrap" style="background: rgba(236, 72, 153, 0.12); color: #ec4899;">📊</div>
                    <span class="badge badge-primary">Q4 Raporu</span>
                </div>
                <h3>6. Performans Analitiği</h3>
                <p>Yönetici KPI grafikleri, satış dönüşüm oranları, kanal bazlı gelir dağılımı ve fabrika termin uyumu analizleri.</p>
                <div class="module-stats">
                    <div class="stat-item"><span>Dönüşüm:</span> <strong>${data.analytics.kpis[1].value}</strong></div>
                    <div class="stat-item"><span>Trend:</span> <strong>+18.4% Gelir</strong></div>
                </div>
                <div class="module-footer-link">
                    Modülü Yönet <span>→</span>
                </div>
            </div>
        </section>

        <!-- Split View: Notifications & Recent Activities -->
        <div class="content-split">
            <!-- Notifications & Tasks -->
            <div class="card panel">
                <div class="panel-header">
                    <div class="panel-title-wrap">
                        <h3>Önemli Bildirimler & Görevler</h3>
                        <span class="badge badge-accent">${data.notifications.filter(n => !n.read).length} Yeni</span>
                    </div>
                    <button class="btn-text" onclick="window.showToast('Tüm bildirimler okundu olarak işaretlendi')">Tümünü Okundu Say</button>
                </div>
                <div class="notification-list">
                    ${data.notifications.map(n => `
                        <div class="notification-item ${n.type}">
                            <div class="notif-icon">
                                ${n.type === 'warning' ? '⚠️' : n.type === 'success' ? '✅' : 'ℹ️'}
                            </div>
                            <div class="notif-content">
                                <div class="notif-header">
                                    <strong>${n.title}</strong>
                                    <span class="notif-time">${n.time}</span>
                                </div>
                                <p>${n.message}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Recent System Activity Stream -->
            <div class="card panel">
                <div class="panel-header">
                    <div class="panel-title-wrap">
                        <h3>Son Sistem & Operasyon Hareketleri</h3>
                        <span class="tag">Canlı Akış</span>
                    </div>
                </div>
                <div class="activity-timeline">
                    <div class="activity-item">
                        <div class="activity-dot dot-success"></div>
                        <div class="activity-text">
                            <strong>Yeni İş Emri Başlatıldı (#ORD-1092)</strong>
                            <span>Serdar & Melis Çelik — Masif Meşe Yemek Masası CNC kesim kuyruğuna girdi.</span>
                            <small class="text-muted">15 dakika önce • Atölye Şefi</small>
                        </div>
                    </div>
                    <div class="activity-item">
                        <div class="activity-dot dot-primary"></div>
                        <div class="activity-text">
                            <strong>CRM Teklif Revizyonu Gönderildi</strong>
                            <span>Nova Holding Genel Merkez projesi için ₺880,000 değerinde teklif iletildi.</span>
                            <small class="text-muted">1 saat önce • Ahmet Yılmaz</small>
                        </div>
                    </div>
                    <div class="activity-item">
                        <div class="activity-dot dot-warning"></div>
                        <div class="activity-text">
                            <strong>CNC-03 Ünitesi Bakıma Alındı</strong>
                            <span>Kenar bantlama bıçak değişimi ve yağlama periyodu başlatıldı.</span>
                            <small class="text-muted">2 saat önce • Bakım Ekibi</small>
                        </div>
                    </div>
                    <div class="activity-item">
                        <div class="activity-dot dot-info"></div>
                        <div class="activity-text">
                            <strong>Instagram Gönderisi Yayınlandı</strong>
                            <span>"Valeria Masif Masa Detayları" hikaye ve reels yayını tamamlandı.</span>
                            <small class="text-muted">3 saat önce • Otomasyon Botu</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

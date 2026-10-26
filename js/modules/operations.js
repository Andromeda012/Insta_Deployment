// Module 5: Operations & Infrastructure Control Panel
export function renderOperationsModule(data) {
    const ops = data.operations;

    return `
        <div class="page-header">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span onclick="window.navigateTo('dashboard')">Ana Sayfa</span> / 
                    <span>Modül 5: Altyapı & Operasyon Paneli</span>
                </div>
                <h1>Teknik Altyapı & Bulut Servisleri Envanteri</h1>
                <p class="subtitle">Barındırma, alan adları, SSL, veritabanı kümeleri, API anahtarları (maskeli) ve aylık operasyon maliyetleri.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-secondary" onclick="window.showToast('Tüm altyapı servislerine PING gönderildi: Ortalama 22ms')">
                    ⚡ Sistem Sağlık Taraması
                </button>
                <button class="btn btn-primary" onclick="window.showModal('Yedekleme Tetikle', 'S3 Anlık Depolama Snapshot oluşturma komutu simüle edildi.')">
                    💾 Manuel Snapshot Al
                </button>
            </div>
        </div>

        <!-- Infrastructure Summary Cards -->
        <div class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Genel Uptime</span>
                    <span class="status-dot online"></span>
                </div>
                <div class="metric-value">99.98%</div>
                <div class="metric-meta text-success">Son 90 gün kesintisiz</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Aylık Tahmini Maliyet</span>
                    <span class="metric-icon">💳</span>
                </div>
                <div class="metric-value">${ops.costs.monthlyEstimated}</div>
                <div class="metric-meta text-primary">5 Bulut Servisi & Lisans</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Yedekleme Durumu</span>
                    <span class="metric-icon">🛡️</span>
                </div>
                <div class="metric-value">Güncel</div>
                <div class="metric-meta text-success">Bugün 03:00 S3 Snapshot Alındı</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Aktif API Entegrasyonu</span>
                    <span class="metric-icon">🔗</span>
                </div>
                <div class="metric-value">4 / 4</div>
                <div class="metric-meta text-success">Tüm anahtarlar geçerli</div>
            </div>
        </div>

        <!-- Cloud Services Table -->
        <div class="card panel">
            <div class="panel-header">
                <h3>Bulut Servisleri & Dağıtım Durumu</h3>
                <span class="tag">Vercel & AWS Frankfurt</span>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Servis Adı</th>
                            <th>Hizmet Türü</th>
                            <th>Bölge / DC</th>
                            <th>Uptime</th>
                            <th>Gecikme</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ops.services.map(srv => `
                            <tr>
                                <td><strong>${srv.name}</strong></td>
                                <td><small class="text-muted">${srv.type}</small></td>
                                <td><code>${srv.region}</code></td>
                                <td>${srv.uptime}</td>
                                <td>${srv.latency}</td>
                                <td>
                                    <span class="badge ${srv.status === 'Operational' ? 'badge-success' : 'badge-warning'}">
                                        ${srv.status === 'Operational' ? 'Operasyonel' : 'Yavaşlama'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Domains & Masked API Integrations Split -->
        <div class="content-split" style="margin-top: 24px;">
            <!-- Domain & SSL Management -->
            <div class="card panel">
                <div class="panel-header">
                    <h3>Alan Adları & SSL Sertifikaları</h3>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Domain</th>
                                <th>SSL</th>
                                <th>Kalan Süre</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ops.domains.map(d => `
                                <tr>
                                    <td><strong>${d.domain}</strong></td>
                                    <td><span class="badge badge-success">${d.sslStatus}</span></td>
                                    <td><small>${d.expires}</small></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Masked Credentials -->
            <div class="card panel">
                <div class="panel-header">
                    <h3>API Entegrasyonları & Maskelenmiş Anahtarlar</h3>
                    <span class="badge badge-secondary">Güvenlik: Maskeli</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Entegrasyon</th>
                                <th>Kategori</th>
                                <th>API Anahtarı</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ops.integrations.map(api => `
                                <tr>
                                    <td><strong>${api.name}</strong></td>
                                    <td><small>${api.category}</small></td>
                                    <td><code>${api.maskedKey}</code></td>
                                    <td><span class="badge badge-success">${api.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Monthly Costs Breakdown & Audit Log -->
        <div class="content-split" style="margin-top: 24px;">
            <!-- Monthly Expenses -->
            <div class="card panel">
                <div class="panel-header">
                    <h3>Aylık Tahmini Operasyon Maliyetleri</h3>
                    <strong class="text-primary">${ops.costs.monthlyEstimated} / ay</strong>
                </div>
                <div class="cost-list">
                    ${ops.costs.breakdown.map(c => `
                        <div class="cost-item">
                            <span>${c.service}</span>
                            <strong>${c.amount}</strong>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Audit Logs -->
            <div class="card panel">
                <div class="panel-header">
                    <h3>Sistem Güvenlik & Denetim Kayıtları (Audit Log)</h3>
                    <span class="tag">Son 24 Saat</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Zaman</th>
                                <th>Kullanıcı / Servis</th>
                                <th>İşlem Detayı</th>
                                <th>IP / Kaynak</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ops.auditLogs.map(l => `
                                <tr>
                                    <td><small>${l.time}</small></td>
                                    <td><code>${l.user}</code></td>
                                    <td>${l.action}</td>
                                    <td><small class="text-muted">${l.ip}</small></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Module 1: Website Control Panel
export function renderWebsiteModule(data) {
    const ws = data.website;

    return `
        <div class="page-header">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span onclick="window.navigateTo('dashboard')">Ana Sayfa</span> / 
                    <span>Modül 1: Web Sitesi Yönetimi</span>
                </div>
                <h1>Kurumsal Web Sitesi Kontrol Paneli</h1>
                <p class="subtitle">Global Mobilya genel web sitesi, ürün kataloğu, dijital portfolyo ve form yönetimi.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-secondary" onclick="window.showToast('SEO Analiz Raporu Güncellendi: Skor %94')">
                    🔍 SEO Taraması Yap
                </button>
                <button class="btn btn-primary" onclick="window.showModal('Yayınlama Onayı', 'Değişiklikler canlı web sitesine (globalmobilya.com.tr) aktarılmak üzere simüle edildi. Prototip modunda gerçek sunucu etkilenmez.')">
                    🚀 Değişiklikleri Yayınla
                </button>
            </div>
        </div>

        <!-- Status Overview Cards -->
        <div class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Yayın Durumu</span>
                    <span class="status-dot online"></span>
                </div>
                <div class="metric-value">Canlıda</div>
                <div class="metric-meta text-success">Son Yayın: ${ws.status.lastPublished}</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Katalogdaki Ürünler</span>
                    <span class="metric-icon">🛋️</span>
                </div>
                <div class="metric-value">${ws.status.activeCatalogItems} <span class="sub-val">Model</span></div>
                <div class="metric-meta text-primary">${ws.categories.length} Ana Kategori</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">Bekleyen Web Formu</span>
                    <span class="metric-icon">✉️</span>
                </div>
                <div class="metric-value">${ws.status.pendingForms} <span class="sub-val">İstek</span></div>
                <div class="metric-meta text-warning">Bugün 3 yeni teklif talebi</div>
            </div>
            <div class="card metric-card">
                <div class="metric-header">
                    <span class="metric-title">SEO Sağlık Puanı</span>
                    <span class="metric-icon">📈</span>
                </div>
                <div class="metric-value">${ws.status.seoHealthScore}</div>
                <div class="metric-meta text-success">Sitemap & SSL Senkronize</div>
            </div>
        </div>

        <!-- Tabbed Interface -->
        <div class="tab-container">
            <div class="tab-nav">
                <button class="tab-btn active" onclick="window.switchTab(this, 'tab-catalog')">📦 Ürün Kataloğu (${ws.products.length})</button>
                <button class="tab-btn" onclick="window.switchTab(this, 'tab-pages')">📄 Sayfa & Menü Yönetimi</button>
                <button class="tab-btn" onclick="window.switchTab(this, 'tab-inquiries')">📬 İletişim & Teklif Formları (${ws.inquiries.length})</button>
                <button class="tab-btn" onclick="window.switchTab(this, 'tab-seo')">⚙️ SEO & Genel Ayarlar</button>
            </div>

            <!-- Tab 1: Product Catalog -->
            <div id="tab-catalog" class="tab-content active">
                <div class="card panel">
                    <div class="table-toolbar">
                        <div class="search-input-wrap">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="catalog-search" placeholder="Ürün adı, SKU veya kategori ara..." onkeyup="window.filterTable('catalog-table', this.value)">
                        </div>
                        <div class="toolbar-actions">
                            <select class="form-select" onchange="window.filterTableByCategory('catalog-table', this.value)">
                                <option value="">Tüm Kategoriler</option>
                                ${ws.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                            </select>
                            <button class="btn btn-primary" onclick="window.showToast('Yeni Ürün Ekleme Formu Simüle Edildi.')">
                                + Yeni Ürün Ekle
                            </button>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="data-table" id="catalog-table">
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Ürün Adı</th>
                                    <th>Kategori</th>
                                    <th>Fiyat</th>
                                    <th>Malzeme / Özellik</th>
                                    <th>Stok</th>
                                    <th>Durum</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ws.products.map(p => `
                                    <tr>
                                        <td><code>${p.sku}</code></td>
                                        <td>
                                            <strong>${p.name}</strong>
                                            ${p.featured ? '<span class="badge badge-accent">Öne Çıkan</span>' : ''}
                                        </td>
                                        <td><span class="badge badge-secondary">${p.category}</span></td>
                                        <td><strong>${p.price}</strong></td>
                                        <td><small class="text-muted">${p.material}</small></td>
                                        <td>${p.stock} Adet</td>
                                        <td>
                                            <span class="badge ${p.status === 'Stokta' ? 'badge-success' : 'badge-warning'}">
                                                ${p.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn-action" onclick="window.showProductDetail('${p.id}')">İncele</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab 2: Pages & Navigation -->
            <div id="tab-pages" class="tab-content">
                <div class="card panel">
                    <div class="panel-header">
                        <h3>Site Sayfaları & Gezinme Ağacı</h3>
                        <button class="btn btn-secondary" onclick="window.showToast('Sayfa Sıralama Modu Aktif')">Sıralamayı Düzenle</button>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Sayfa Başlığı</th>
                                    <th>URL Yolu</th>
                                    <th>Yayın Durumu</th>
                                    <th>Son Güncelleme</th>
                                    <th>SEO Skoru</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ws.pages.map(pg => `
                                    <tr>
                                        <td><strong>${pg.title}</strong></td>
                                        <td><code>${pg.path}</code></td>
                                        <td><span class="badge badge-success">${pg.status}</span></td>
                                        <td>${pg.lastEdit}</td>
                                        <td>
                                            <div class="progress-bar-wrap">
                                                <div class="progress-bar" style="width: ${pg.seoScore}%;"></div>
                                                <span>%${pg.seoScore}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <button class="btn-action" onclick="window.showToast('${pg.title} düzenleme editörü simüle edildi.')">Düzenle</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab 3: Inquiries -->
            <div id="tab-inquiries" class="tab-content">
                <div class="card panel">
                    <div class="panel-header">
                        <h3>Gelen Web Sitesi Form Talepleri</h3>
                        <span class="tag">CRM'e Otomatik Bağlanabilir</span>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Talep No</th>
                                    <th>Müşteri / Kurum</th>
                                    <th>İletişim</th>
                                    <th>Talep Konusu</th>
                                    <th>Tarih</th>
                                    <th>Durum</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ws.inquiries.map(inq => `
                                    <tr>
                                        <td><code>${inq.id}</code></td>
                                        <td><strong>${inq.name}</strong></td>
                                        <td>
                                            <div>${inq.email}</div>
                                            <small class="text-muted">${inq.phone}</small>
                                        </td>
                                        <td>${inq.subject}</td>
                                        <td>${inq.date}</td>
                                        <td>
                                            <span class="badge ${inq.status === 'Yeni' ? 'badge-primary' : inq.status === 'İncelendi' ? 'badge-warning' : 'badge-success'}">
                                                ${inq.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn-action" onclick="window.showToast('${inq.name} için CRM Lead kaydı oluşturuldu!')">CRM'e Aktar</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab 4: SEO & Settings -->
            <div id="tab-seo" class="tab-content">
                <div class="content-split">
                    <div class="card panel">
                        <div class="panel-header">
                            <h3>SEO ve Meta Veri Yapılandırması</h3>
                        </div>
                        <div class="form-group-list">
                            <div class="form-group">
                                <label>Site Ana Başlığı (Title):</label>
                                <input type="text" class="form-input" value="Global Mobilya | Modern & Masif Ahşap Tasarımlar" readonly>
                            </div>
                            <div class="form-group">
                                <label>Meta Açıklaması (Description):</label>
                                <textarea class="form-input" rows="3" readonly>Global Mobilya; otel, ofis, lüks konut projeleri için özel masif ve modern mobilya üretiminde 30 yıllık tecrübe ile hizmet verir.</textarea>
                            </div>
                            <div class="form-group">
                                <label>XML Sitemap Durumu:</label>
                                <div class="status-row">
                                    <span class="status-dot online"></span>
                                    <span>https://globalmobilya.com.tr/sitemap.xml (Google ve Yandex dizinine açık)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card panel">
                        <div class="panel-header">
                            <h3>Yayın & Önbellek Durumu</h3>
                        </div>
                        <div class="info-metric-list">
                            <div class="info-metric-item">
                                <span>SSL Sertifikası:</span>
                                <strong>Let's Encrypt Wildcard TLS 1.3</strong>
                            </div>
                            <div class="info-metric-item">
                                <span>CDN Önbelleği:</span>
                                <strong>Cloudflare Edge (Aktif)</strong>
                            </div>
                            <div class="info-metric-item">
                                <span>Mobil Uyumluluk Puanı:</span>
                                <strong class="text-success">98 / 100</strong>
                            </div>
                            <div class="info-metric-item">
                                <span>Sayfa Açılış Hızı:</span>
                                <strong>0.84 saniye</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Module 1: Website Control Panel (Integrated Live GitHub & Vercel CMS)
export function renderWebsiteModule(data) {
    return `
        <div class="module-embed-shell">
            <!-- Compact Platform Integration Bar -->
            <div class="module-embed-bar">
                <div class="module-embed-bar-left">
                    <button class="embed-back-btn" onclick="window.navigateTo('dashboard')" title="Ana Panele Dön">
                        ← Genel Bakış
                    </button>
                    <span class="embed-divider">|</span>
                    <span class="embed-module-badge">🌐 MODÜL 1</span>
                    <strong class="embed-module-title">Web Sitesi Yönetim Merkezi (Canlı CMS)</strong>
                    <div class="embed-quick-tabs">
                        <button class="embed-tab-chip" onclick="window.controlModule1Tab(this, 'tab-analytics')">📊 İstatistikler & Durum</button>
                        <button class="embed-tab-chip active" onclick="window.controlModule1Tab(this, 'tab-products')">🛒 Ürünler</button>
                        <button class="embed-tab-chip" onclick="window.controlModule1Tab(this, 'tab-company')">🏢 Firma & İletişim</button>
                        <button class="embed-tab-chip" onclick="window.controlModule1Tab(this, 'tab-home')">🏠 Ana Sayfa & Video</button>
                        <button class="embed-tab-chip" onclick="window.controlModule1Tab(this, 'tab-gallery')">🖼️ Galeri</button>
                        <button class="embed-tab-chip" onclick="window.controlModule1Tab(this, 'tab-blog')">📝 Blog</button>
                        <button class="embed-tab-chip" onclick="window.controlModule1Tab(this, 'tab-suppliers')">🤝 Tedarikçiler</button>
                        <button class="embed-tab-chip" onclick="window.controlModule1Tab(this, 'tab-guide')">💡 Rehber</button>
                    </div>
                </div>
                <div class="module-embed-bar-right">
                    <button class="embed-action-btn" onclick="window.openModule1TokenModal()" title="GitHub API & Depo Ayarları">
                        ⚙️ GitHub API
                    </button>
                    <button class="embed-action-btn" onclick="window.reloadModuleFrame('module1-frame')" title="Modülü Yenile">
                        🔄 Yenile
                    </button>
                    <a href="Module%201/index.html" target="_blank" class="embed-action-btn primary" title="Tam Ekran Yeni Sekmede Aç">
                        ↗ Tam Ekran
                    </a>
                </div>
            </div>

            <!-- Full-Bleed Embedded Module 1 Application -->
            <iframe
                id="module1-frame"
                class="module-embed-frame"
                src="Module%201/index.html"
                title="Modül 1 — Global Kapak Mobilya Web Sitesi Yönetim Merkezi"
                allow="clipboard-read; clipboard-write"
            ></iframe>
        </div>
    `;
}

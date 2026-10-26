// Module 4: Production & Factory Control Panel (Integrated Live Firebase Order & Kanban System)
export function renderProductionModule(data) {
    return `
        <div class="module-embed-shell">
            <!-- Compact Platform Integration Bar -->
            <div class="module-embed-bar">
                <div class="module-embed-bar-left">
                    <button class="embed-back-btn" onclick="window.navigateTo('dashboard')" title="Ana Panele Dön">
                        ← Genel Bakış
                    </button>
                    <span class="embed-divider">|</span>
                    <span class="embed-module-badge warning">🏭 MODÜL 4</span>
                    <strong class="embed-module-title">Üretim & Sipariş Takip Merkezi</strong>
                    <div class="embed-quick-tabs">
                        <button class="embed-tab-chip active" onclick="window.controlModule4Tab(this, 'kanban')">📋 Canlı Pano</button>
                        <button class="embed-tab-chip" onclick="window.controlModule4Tab(this, 'table')">📑 Liste</button>
                        <button class="embed-tab-chip" onclick="window.controlModule4Tab(this, 'archive')">📁 Bitenler (Arşiv)</button>
                        <button class="embed-tab-chip" onclick="window.controlModule4Tab(this, 'kiosk')">📺 Büyük TV Modu</button>
                        <button class="embed-tab-chip" onclick="window.controlModule4Tab(this, 'scanner')">📷 QR Tara</button>
                        <button class="embed-tab-chip" onclick="window.controlModule4Tab(this, 'track')">🔍 Müşteri Takip</button>
                    </div>
                </div>
                <div class="module-embed-bar-right">
                    <button class="embed-action-btn accent" onclick="window.openModule4Modal('newOrderModal')" title="Yeni Sipariş & İmalat Girişi">
                        + Yeni Sipariş
                    </button>
                    <button class="embed-action-btn" onclick="window.syncModule4Cloud()" title="Firebase Bulut Veritabanı İle Eşitle">
                        ☁️ Bulut Eşitle
                    </button>
                    <a href="Module%204/takip.html" target="_blank" class="embed-action-btn" title="Müşteri Sipariş Sorgulama Ekranını Aç">
                        📦 Müşteri Ekranı ↗
                    </a>
                    <a href="Module%204/index.html" target="_blank" class="embed-action-btn primary" title="Tam Ekran Yeni Sekmede Aç">
                        ↗ Tam Ekran
                    </a>
                </div>
            </div>

            <!-- Full-Bleed Embedded Module 4 Application -->
            <iframe
                id="module4-frame"
                class="module-embed-frame"
                src="Module%204/index.html"
                title="Modül 4 — Global Kapak Mobilya Üretim & Sipariş Takip Merkezi"
                allow="camera; microphone; clipboard-read; clipboard-write"
            ></iframe>
        </div>
    `;
}

// Module 4: Production & Factory Control Panel (Clean Full-Screen In-App Integration)
export function renderProductionModule(data) {
    return `
        <div class="module-embed-shell">
            <iframe
                id="module4-frame"
                class="module-embed-frame"
                src="Module%204/index.html"
                title="Modül 4 — Global Kapak Mobilya Üretim & Sipariş Takip Merkezi"
                allow="camera; microphone; clipboard-read; clipboard-write; fullscreen"
            ></iframe>
        </div>
    `;
}

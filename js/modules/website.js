// Module 1: Website Control Panel (Clean Full-Screen In-App Integration)
export function renderWebsiteModule(data) {
    return `
        <div class="module-embed-shell">
            <iframe
                id="module1-frame"
                class="module-embed-frame"
                src="Module%201/index.html"
                title="Modül 1 — Global Kapak Mobilya Web Sitesi Yönetim Merkezi"
                allow="clipboard-read; clipboard-write; fullscreen"
            ></iframe>
        </div>
    `;
}

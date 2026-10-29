// Module 2: Social Media & Cloud Bot Control Panel (Multi-Platform Hub)
if (typeof window !== 'undefined') {
    window.switchSocialBotChannel = function(btnEl, channel) {
        const frame = document.getElementById('module2-frame');
        if (!frame) return;

        if (btnEl) {
            btnEl.parentElement?.querySelectorAll('.embed-tab-chip').forEach(b => b.classList.remove('active'));
            btnEl.classList.add('active');
        }

        const channelMap = {
            instagram: { path: 'Module%202/Instagram/index.html', label: '📸 Instagram Bulut Bot Kontrol Merkezi aktif.' },
            facebook: { path: 'Module%202/Facebook/index.html', label: '📘 Facebook Kurumsal Sayfa Botu Kontrol Merkezi aktif.' },
            youtube: { path: 'Module%202/Youtube%20Shorts/index.html', label: '▶️ YouTube Shorts Bulut Bot Kontrol Merkezi aktif.' },
            tiktok: { path: 'Module%202/Tiktok/index.html', label: '🎵 TikTok 7/24 Bulut Bot Kontrol Merkezi aktif.' }
        };

        const target = channelMap[channel];
        if (target) {
            frame.src = target.path;
            if (typeof window.showToast === 'function') {
                window.showToast(target.label);
            }
        }
    };
}

export function renderSocialModule(data) {
    return `
        <div class="module-embed-shell" style="display:flex; flex-direction:column; height:100%;">
            <!-- Compact Multi-Bot Selector Bar for Module 2 Subfolders -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 16px; background:#0f172a; border-bottom:1px solid rgba(148,163,184,0.18); flex-shrink:0; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;" id="socialBotChannelBar">
                    <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#94a3b8; margin-right:4px;">Modül 2 Bot Ağı:</span>
                    <button
                        class="embed-tab-chip active"
                        data-channel="instagram"
                        onclick="window.switchSocialBotChannel(this, 'instagram')"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:8px; border:1px solid rgba(225,48,108,0.55); background:linear-gradient(135deg, rgba(225,48,108,0.28), rgba(131,58,180,0.28)); color:#fff; font-size:12px; font-weight:700; cursor:pointer;"
                    >
                        📸 Instagram Bot <span style="background:#10b981; color:#052e16; font-size:10px; padding:1px 6px; border-radius:99px; font-weight:800;">AKTİF • 7/24 BULUT</span>
                    </button>
                    <button
                        class="embed-tab-chip"
                        data-channel="facebook"
                        onclick="window.switchSocialBotChannel(this, 'facebook')"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:8px; border:1px solid rgba(24,119,242,0.5); background:linear-gradient(135deg, rgba(24,119,242,0.24), rgba(10,25,47,0.45)); color:#fff; font-size:12px; font-weight:700; cursor:pointer;"
                    >
                        📘 Facebook Bot <span style="background:#10b981; color:#052e16; font-size:10px; padding:1px 6px; border-radius:99px; font-weight:800;">AKTİF • 7/24 BULUT</span>
                    </button>
                    <button
                        class="embed-tab-chip"
                        data-channel="youtube"
                        onclick="window.switchSocialBotChannel(this, 'youtube')"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:8px; border:1px solid rgba(255,0,51,0.55); background:linear-gradient(135deg, rgba(255,0,51,0.24), rgba(24,24,27,0.55)); color:#fff; font-size:12px; font-weight:700; cursor:pointer;"
                    >
                        ▶️ YouTube Shorts Bot <span style="background:#10b981; color:#052e16; font-size:10px; padding:1px 6px; border-radius:99px; font-weight:800;">AKTİF • 7/24 BULUT</span>
                    </button>
                    <button
                        class="embed-tab-chip"
                        data-channel="tiktok"
                        onclick="window.switchSocialBotChannel(this, 'tiktok')"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:8px; border:1px solid rgba(0,242,254,0.55); background:linear-gradient(135deg, rgba(0,242,254,0.2), rgba(255,0,80,0.24)); color:#fff; font-size:12px; font-weight:700; cursor:pointer;"
                    >
                        🎵 TikTok Bot <span style="background:#10b981; color:#052e16; font-size:10px; padding:1px 6px; border-radius:99px; font-weight:800;">AKTİF • 7/24 BULUT</span>
                    </button>
                    <a
                        href="#products"
                        onclick="if(window.navigateTo) { window.navigateTo('products'); return false; }"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:8px; border:1px solid rgba(212,175,55,0.45); background:linear-gradient(135deg, rgba(212,175,55,0.18), rgba(15,23,42,0.6)); color:#fde68a; font-size:12px; font-weight:700; text-decoration:none; cursor:pointer;"
                    >
                        🛋️ Ürün Yönetimi (Modül 7) ↗ <span style="background:#d4af37; color:#0b1120; font-size:10px; padding:1px 6px; border-radius:99px; font-weight:900;">ORTAK KAYNAK</span>
                    </a>
                </div>
                <div style="display:flex; align-items:center; gap:8px; font-size:11px; color:#94a3b8;">
                    <span style="display:inline-flex; align-items:center; gap:5px; color:#34d399; font-weight:600;">
                        <span style="width:7px; height:7px; border-radius:50%; background:#10b981; display:inline-block;"></span>
                        Otonom Tasarım (Sıfır Medya Girişi) & 3 Aşamalı Hibrit İletişim
                    </span>
                </div>
            </div>

            <!-- Active Bot Iframe Container -->
            <iframe
                id="module2-frame"
                class="module-embed-frame"
                style="flex:1; width:100%; border:none;"
                src="Module%202/Instagram/index.html"
                title="Modül 2 — Sosyal Medya Bulut Bot Kontrol Merkezi"
                allow="clipboard-read; clipboard-write; fullscreen"
            ></iframe>
        </div>
    `;
}

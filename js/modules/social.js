// Module 2: Social Media & Cloud Bot Control Panel (Multi-Platform Hub)
// Active Bots:
// 1. Module 2 / Instagram Cloud Bot (Otonom Reels/Story/Post Tasarımı + 3 Aşamalı DM/Yorum)
// 2. Module 2 / Facebook Cloud Bot (Otonom Katalog/B2B Kart/FB Reels/FB Story Tasarımı + 3 Aşamalı Messenger/Yorum)
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
                        data-channel="tiktok"
                        onclick="window.switchSocialBotChannel(this, 'tiktok')"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; border:1px solid rgba(148,163,184,0.2); background:rgba(30,41,59,0.7); color:#cbd5e1; font-size:12px; font-weight:600; cursor:pointer;"
                    >
                        🎵 TikTok Bot <span style="font-size:10px; color:#94a3b8;">(Hazırlanıyor)</span>
                    </button>
                    <button
                        class="embed-tab-chip"
                        data-channel="youtube"
                        onclick="window.switchSocialBotChannel(this, 'youtube')"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; border:1px solid rgba(148,163,184,0.2); background:rgba(30,41,59,0.7); color:#cbd5e1; font-size:12px; font-weight:600; cursor:pointer;"
                    >
                        ▶️ YouTube Shorts Bot <span style="font-size:10px; color:#94a3b8;">(Hazırlanıyor)</span>
                    </button>
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

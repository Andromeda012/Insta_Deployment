// Module 2: Social Media & Cloud Bot Control Panel (4 Autonomous Bots)
import { renderCampaignStudioModalHtml, openCampaignStudioModal } from './campaign-studio.js';

if (typeof window !== 'undefined') {
    window.switchSocialBotChannel = function(btnEl, channel) {
        const frame = document.getElementById('module2-frame');
        if (!frame) return;

        if (btnEl) {
            btnEl.parentElement?.querySelectorAll('.embed-tab-chip').forEach(b => b.classList.remove('active'));
            btnEl.classList.add('active');
        }

        const channelMap = {
            instagram: { path: 'Module%202/Instagram/index.html', label: '📸 Instagram Bot Kontrol Merkezi aktif.' },
            facebook: { path: 'Module%202/Facebook/index.html', label: '📘 Facebook Bot Kontrol Merkezi aktif.' },
            youtube: { path: 'Module%202/Youtube%20Shorts/index.html', label: '▶️ YouTube Shorts Bot Kontrol Merkezi aktif.' },
            tiktok: { path: 'Module%202/Tiktok/index.html', label: '🎵 TikTok Bot Kontrol Merkezi aktif.' }
        };

        const target = channelMap[channel];
        if (target) {
            frame.src = target.path;
            frame.title = `Modül 2 — ${channel} Bot Kontrol Merkezi`;
            if (typeof window.showToast === 'function') {
                window.showToast(target.label);
            }
        }
    };
    window.openCampaignStudioModal = openCampaignStudioModal;
}

export function renderSocialModule() {
    return `
        <div class="module-embed-shell" style="display:flex; flex-direction:column; height:100%;">
            <!-- 4 Bot Selector Bar -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 16px; background:#0f172a; border-bottom:1px solid rgba(148,163,184,0.18); flex-shrink:0; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;" id="socialBotChannelBar">
                    <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#94a3b8; margin-right:4px;">Modül 2 Botları:</span>
                    <button
                        class="embed-tab-chip active"
                        data-channel="instagram"
                        onclick="window.switchSocialBotChannel(this, 'instagram')"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:8px; border:1px solid rgba(225,48,108,0.55); background:linear-gradient(135deg, rgba(225,48,108,0.28), rgba(131,58,180,0.28)); color:#fff; font-size:12px; font-weight:700; cursor:pointer;"
                    >
                        📸 Instagram Bot <span style="background:#10b981; color:#052e16; font-size:10px; padding:1px 6px; border-radius:99px; font-weight:800;">AKTİF</span>
                    </button>
                    <button
                        class="embed-tab-chip"
                        data-channel="facebook"
                        onclick="window.switchSocialBotChannel(this, 'facebook')"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:8px; border:1px solid rgba(24,119,242,0.5); background:linear-gradient(135deg, rgba(24,119,242,0.24), rgba(10,25,47,0.45)); color:#fff; font-size:12px; font-weight:700; cursor:pointer;"
                    >
                        📘 Facebook Bot <span style="background:#10b981; color:#052e16; font-size:10px; padding:1px 6px; border-radius:99px; font-weight:800;">AKTİF</span>
                    </button>
                    <button
                        class="embed-tab-chip"
                        data-channel="youtube"
                        onclick="window.switchSocialBotChannel(this, 'youtube')"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:8px; border:1px solid rgba(255,0,51,0.55); background:linear-gradient(135deg, rgba(255,0,51,0.24), rgba(24,24,27,0.55)); color:#fff; font-size:12px; font-weight:700; cursor:pointer;"
                    >
                        ▶️ YouTube Shorts Bot <span style="background:#10b981; color:#052e16; font-size:10px; padding:1px 6px; border-radius:99px; font-weight:800;">AKTİF</span>
                    </button>
                    <button
                        class="embed-tab-chip"
                        data-channel="tiktok"
                        onclick="window.switchSocialBotChannel(this, 'tiktok')"
                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:8px; border:1px solid rgba(245,158,11,0.55); background:linear-gradient(135deg, rgba(245,158,11,0.18), rgba(255,0,80,0.18)); color:#fff; font-size:12px; font-weight:700; cursor:pointer;"
                    >
                        🎵 TikTok Bot <span style="background:#f59e0b; color:#451a03; font-size:10px; padding:1px 6px; border-radius:99px; font-weight:800;">BAĞLANTI BEKLENİYOR</span>
                    </button>
                </div>
                <!-- SAĞ TARAF: YENİ KAMPANYA ÜRET BUTONU -->
                <div style="display:flex; align-items:center; gap:10px;">
                    <button
                        id="btnOpenCampaignStudio"
                        type="button"
                        onclick="window.openCampaignStudioModal()"
                        style="display:inline-flex; align-items:center; gap:7px; padding:7px 16px; border-radius:9px; border:1px solid rgba(212,175,55,0.7); background:linear-gradient(135deg, #d4af37, #9b7220); color:#0b1120; font-size:12.5px; font-weight:800; cursor:pointer; box-shadow:0 4px 16px rgba(212,175,55,0.3); transition:all .2s ease;"
                        onmouseover="this.style.filter='brightness(1.15)'; this.style.transform='translateY(-1px)'"
                        onmouseout="this.style.filter='none'; this.style.transform='none'"
                    >
                        ✨ Yeni Kampanya Üret
                    </button>
                </div>
            </div>

            <!-- Active Bot Iframe Container -->
            <iframe
                id="module2-frame"
                class="module-embed-frame"
                style="flex:1; width:100%; border:none;"
                src="Module%202/Instagram/index.html"
                title="Modül 2 — Instagram Bot Kontrol Merkezi"
                allow="clipboard-read; clipboard-write; fullscreen"
            ></iframe>

            <!-- Kampanya Üretme Modal Bileşeni -->
            ${renderCampaignStudioModalHtml()}
        </div>
    `;
}

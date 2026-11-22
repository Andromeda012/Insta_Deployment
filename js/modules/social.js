// Module 2: Social Media & Cloud Bot Control Panel (4 Autonomous Bots)
import { renderCampaignStudioModalHtml, openCampaignStudioModal, renderCampaignReviewModalHtml, openCampaignReviewModal } from './campaign-studio.js';
import { renderPublishCalendarModalHtml, openPublishCalendarModal } from './publish-calendar.js';

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
    window.openPublishCalendarModal = openPublishCalendarModal;
    window.openCampaignReviewModal = openCampaignReviewModal;

    window.openPublishRegistryModal = async function (forceCheck = false) {
        let modal = document.getElementById('social-publish-registry-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'social-publish-registry-modal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,0.86);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        modal.innerHTML = '<div style="background:#0f172a;border:1px solid rgba(148,163,184,0.25);border-radius:16px;padding:24px;width:min(760px,100%);max-height:85vh;overflow:auto;color:#f8fafc;">⏳ Yayın etiketleri ve kuyruk durumu yükleniyor…</div>';

        try {
            const res = await fetch(`/api/module2?action=publish-registry${forceCheck ? '&force=1' : ''}`);
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

            const s = json.summary || {};
            const items = Array.isArray(json.items) ? json.items : [];
            const statusBanner = s.queue_paused
                ? `<div style="padding:12px 14px;border-radius:10px;background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.4);color:#fde68a;font-size:12.5px;margin-bottom:14px;">
                    ⏸️ <strong>Kuyruk Otomatik Durduruldu:</strong> Veritabanındaki tüm ürün/koleksiyonlar "Yayınlandı" etiketine sahip. Sistem yeni ürün eklenip eklenmediğini <strong>${s.auto_resume_interval_hours || 6} saatlik</strong> döngüde otomatik kontrol eder.
                    ${s.next_check_at ? `<div style="font-size:11px;margin-top:4px;color:#cbd5e1;">Sonraki otomatik kontrol: <code>${s.next_check_at.slice(0, 19).replace('T', ' ')} UTC</code></div>` : ''}
                   </div>`
                : `<div style="padding:12px 14px;border-radius:10px;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.4);color:#6ee7b7;font-size:12.5px;margin-bottom:14px;">
                    🟢 <strong>Kuyruk Aktif:</strong> <strong>${s.unpublished || 0}</strong> adet yayınlanmamış içerik sıraya alınmaya hazır (Toplam ${s.total || 0} öğe • ${s.published || 0} yayınlandı).
                   </div>`;

            const rowsHtml = items.length > 0
                ? items.map(it => {
                    const isPub = it.status === 'published';
                    const nextStatus = isPub ? 'unpublished' : 'published';
                    return `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                            <td style="padding:10px 8px;">
                                <strong style="color:#fff;font-size:13px;">${it.title || it.slug}</strong>
                                <div style="font-size:11px;color:#94a3b8;">${it.entity_type === 'collection' ? 'Koleksiyon' : 'Ürün'} • <code>${it.slug}</code></div>
                            </td>
                            <td style="padding:10px 8px;">
                                ${isPub
                                    ? '<span style="background:rgba(16,185,129,0.18);color:#34d399;border:1px solid rgba(16,185,129,0.4);padding:3px 9px;border-radius:99px;font-size:11px;font-weight:800;">✅ Yayınlandı</span>'
                                    : '<span style="background:rgba(56,189,248,0.18);color:#38bdf8;border:1px solid rgba(56,189,248,0.4);padding:3px 9px;border-radius:99px;font-size:11px;font-weight:800;">🆕 Yayınlanmadı</span>'}
                            </td>
                            <td style="padding:10px 8px;text-align:right;">
                                <button type="button" onclick="window.toggleSocialPublishTag('${it.slug}', '${nextStatus}')" style="padding:5px 10px;border-radius:7px;border:1px solid rgba(148,163,184,0.35);background:rgba(255,255,255,0.06);color:#e2e8f0;font-size:11.5px;font-weight:700;cursor:pointer;">
                                    ${isPub ? '↩ Yayınlanmadı Yap' : '✓ Yayınlandı İşaretle'}
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')
                : '<tr><td colspan="3" style="padding:16px;color:#94a3b8;text-align:center;">Katalogda ürün veya koleksiyon bulunamadı.</td></tr>';

            modal.innerHTML = `
                <div style="background:#0f172a;border:1px solid rgba(148,163,184,0.28);border-radius:16px;padding:22px;width:min(780px,100%);max-height:86vh;overflow:auto;color:#f8fafc;box-shadow:0 24px 80px rgba(0,0,0,0.65);">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;">
                        <div>
                            <h3 style="margin:0;font-size:17px;font-weight:800;">🏷️ Sosyal Medya Yayın Etiketleri &amp; Otomatik Durdurma</h3>
                            <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Kuyruk yalnızca "Yayınlanmadı" etiketli içerikleri seçer; tamamı yayınlandığında otomatik durur ve 6 saatte bir yeni ürün kontrolü yapar.</div>
                        </div>
                        <button type="button" onclick="document.getElementById('social-publish-registry-modal').style.display='none'" style="background:rgba(255,255,255,0.08);border:0;color:#fff;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>
                    </div>
                    ${statusBanner}
                    <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
                        <button type="button" onclick="window.openPublishRegistryModal(true)" style="padding:7px 13px;border-radius:8px;border:1px solid rgba(56,189,248,0.45);background:rgba(56,189,248,0.16);color:#7dd3fc;font-size:12px;font-weight:700;cursor:pointer;">🔄 Şimdi Yeni Ürün Kontrolü Yap</button>
                    </div>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid rgba(148,163,184,0.25);text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;">
                                <th style="padding:8px;">Koleksiyon / Ürün</th>
                                <th style="padding:8px;">Yayın Etiketi</th>
                                <th style="padding:8px;text-align:right;">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            `;
        } catch (err) {
            modal.innerHTML = `<div style="background:#0f172a;border:1px solid rgba(239,68,68,0.4);border-radius:16px;padding:22px;color:#fca5a5;">⚠️ Hata: ${err.message} <button onclick="document.getElementById('social-publish-registry-modal').style.display='none'" style="margin-left:12px;padding:4px 10px;">Kapat</button></div>`;
        }
    };

    window.toggleSocialPublishTag = async function (slug, status) {
        try {
            const res = await fetch('/api/module2?action=publish-registry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ op: 'set_tag', slug, status })
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
            if (typeof window.showToast === 'function') {
                window.showToast(`Etiket güncellendi: ${slug} → ${status === 'published' ? 'Yayınlandı' : 'Yayınlanmadı'}`);
            }
            window.openPublishRegistryModal(false);
        } catch (err) {
            if (typeof window.showToast === 'function') window.showToast(`❌ Etiket güncellenemedi: ${err.message}`);
        }
    };
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
                <!-- SAĞ TARAF: YAYIN ETİKETLERİ, YAYIN TAKVİMİ & YENİ KAMPANYA ÜRET BUTONLARI -->
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <button
                        id="btnOpenPublishRegistry"
                        type="button"
                        onclick="window.openPublishRegistryModal(false)"
                        style="display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border-radius:9px; border:1px solid rgba(56,189,248,0.45); background:rgba(56,189,248,0.14); color:#7dd3fc; font-size:12px; font-weight:700; cursor:pointer;"
                    >
                        🏷️ Yayın Etiketleri
                    </button>
                    <button
                        id="btnOpenPublishCalendar"
                        type="button"
                        onclick="window.openPublishCalendarModal()"
                        style="display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:9px; border:1px solid rgba(148,163,184,0.4); background:rgba(15,23,42,0.8); color:#cbd5e1; font-size:12.5px; font-weight:700; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,0.3); transition:all .2s ease;"
                        onmouseover="this.style.background='rgba(148,163,184,0.15)'"
                        onmouseout="this.style.background='rgba(15,23,42,0.8)'"
                    >
                        📅 Yayın Takvimi
                    </button>
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

            <!-- Büyük Yayın Takvimi Modalı -->
            ${renderPublishCalendarModalHtml()}
        </div>
    `;
}

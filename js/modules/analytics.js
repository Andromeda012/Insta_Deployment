// Module 6: Performance Analytics Control Panel
// %100 Canlı Entegrasyon: PostHog EU (HogQL) + Supabase CRM/Teklifler + Katalog/3D + Sosyal Medya Kuyruğu

export function renderAnalyticsModule() {
    window.loadLivePostHogAnalytics = async function (showNotice = false) {
        const kpiBox = document.getElementById('live-analytics-kpi-grid');
        const funnelBox = document.getElementById('live-analytics-funnel-box');
        const posthogBox = document.getElementById('live-posthog-tables-box');
        const opsBox = document.getElementById('live-social-crm-box');
        if (!kpiBox) return;

        kpiBox.innerHTML = '<div style="padding:18px;color:#94a3b8;font-size:13px;grid-column:1/-1;">📊 PostHog EU (HogQL), Supabase CRM, Katalog/3D ve Sosyal Medya verileri canlı çekiliyor…</div>';

        try {
            const res = await fetch('/api/product-analytics');
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.posthog) {
                kpiBox.innerHTML = `<div style="padding:16px;color:#fca5a5;font-size:13px;grid-column:1/-1;">⚠️ Analitik verileri alınamadı: ${json?.error || res.status}</div>`;
                return;
            }

            const ph = json.posthog;
            const s = ph.summary || {};
            const crm = json.crmSummary || {};
            const cat = json.catalogSummary || {};
            const soc = json.socialSummary || {};
            const st = soc.byStatus || {};
            const pl = soc.byPlatform || {};

            const totalQuotes = Math.max(s.quoteSubmissions30d || 0, crm.totalQuotes || 0);
            const totalSocial = soc.totalSampled || 0;
            const publishRate = totalSocial > 0 ? Math.round(((st.published || 0) / totalSocial) * 100) : 0;

            kpiBox.innerHTML = `
                <div class="card metric-card" style="background:#111B2E;border:1px solid rgba(56,189,248,0.28);border-radius:14px;padding:18px;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:800;text-transform:uppercase;">30g Tekil Ziyaretçi</div>
                    <div style="font-size:28px;font-weight:900;color:#38bdf8;margin:6px 0 4px;">${s.uniqueVisitors30d || 0}</div>
                    <div style="font-size:12px;color:#cbd5e1;">Sayfa Görüntüleme: <strong>${s.pageviews30d || 0}</strong></div>
                </div>
                <div class="card metric-card" style="background:#111B2E;border:1px solid rgba(250,204,21,0.28);border-radius:14px;padding:18px;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:800;text-transform:uppercase;">Koleksiyon &amp; Ürün İnceleme</div>
                    <div style="font-size:28px;font-weight:900;color:#fde68a;margin:6px 0 4px;">${s.collectionViews30d || 0}</div>
                    <div style="font-size:12px;color:#cbd5e1;">PostHog EU • ${ph.latencyMs || 0} ms</div>
                </div>
                <div class="card metric-card" style="background:#111B2E;border:1px solid rgba(168,85,247,0.28);border-radius:14px;padding:18px;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:800;text-transform:uppercase;">3D / AR Model Etkileşimi</div>
                    <div style="font-size:28px;font-weight:900;color:#c084fc;margin:6px 0 4px;">${s.model3dInteractions30d || 0}</div>
                    <div style="font-size:12px;color:#cbd5e1;">Aktif 3D Model: <strong>${cat.total3DModels || 0}</strong> • R2 CDN</div>
                </div>
                <div class="card metric-card" style="background:#111B2E;border:1px solid rgba(16,185,129,0.28);border-radius:14px;padding:18px;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:800;text-transform:uppercase;">Teklif &amp; B2C CRM Kayıtları</div>
                    <div style="font-size:28px;font-weight:900;color:#34d399;margin:6px 0 4px;">${totalQuotes}</div>
                    <div style="font-size:12px;color:#cbd5e1;">Kayıtlı B2C Müşteri: <strong>${crm.totalB2CCustomers || 0}</strong></div>
                </div>
                <div class="card metric-card" style="background:#111B2E;border:1px solid rgba(244,114,182,0.28);border-radius:14px;padding:18px;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:800;text-transform:uppercase;">Aktif Katalog Envanteri</div>
                    <div style="font-size:28px;font-weight:900;color:#f472b6;margin:6px 0 4px;">${cat.totalCollections || 0} <span style="font-size:13px;color:#fbcfe8;">Koleksiyon</span></div>
                    <div style="font-size:12px;color:#cbd5e1;">Toplam Ürün/Parça: <strong>${cat.totalProducts || 0}</strong></div>
                </div>
                <div class="card metric-card" style="background:#111B2E;border:1px solid rgba(52,211,153,0.28);border-radius:14px;padding:18px;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:800;text-transform:uppercase;">Sosyal Medya Yayın Oranı</div>
                    <div style="font-size:28px;font-weight:900;color:#6ee7b7;margin:6px 0 4px;">%${publishRate}</div>
                    <div style="font-size:12px;color:#cbd5e1;">Yayında: <strong>${st.published || 0}</strong> • Bekleyen: <strong>${st.pending || 0}</strong> • Hata: <strong>${st.failed || 0}</strong></div>
                </div>
            `;

            // Canlı B2C Dönüşüm Hunisi
            if (funnelBox) {
                const steps = [
                    { label: '1. Vitrin Sayfa Görüntüleme ($pageview)', count: s.pageviews30d || 0, color: '#38bdf8' },
                    { label: '2. Koleksiyon & Ürün İnceleme', count: s.collectionViews30d || 0, color: '#fde68a' },
                    { label: '3. 3D / AR Showroom Etkileşimi', count: s.model3dInteractions30d || 0, color: '#c084fc' },
                    { label: '4. Teklif Modalı Açılışı (Clerk Lazy Login)', count: s.quoteModalOpens30d || 0, color: '#f472b6' },
                    { label: '5. Teklif / CRM Müşteri Kaydı', count: totalQuotes, color: '#34d399' }
                ];
                const maxVal = Math.max(1, ...steps.map(x => x.count));
                funnelBox.innerHTML = steps.map(step => {
                    const pct = Math.max(step.count > 0 ? 6 : 0, Math.round((step.count / maxVal) * 100));
                    return `
                        <div style="margin-bottom:12px;">
                            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px;">
                                <span style="color:#e2e8f0;font-weight:600;">${step.label}</span>
                                <strong style="color:${step.color};">${step.count}</strong>
                            </div>
                            <div style="height:10px;background:rgba(255,255,255,0.06);border-radius:999px;overflow:hidden;">
                                <div style="height:100%;width:${pct}%;background:${step.color};border-radius:999px;transition:width .4s ease;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // PostHog Tabloları (En Çok İncelenen Modeller + Trafik Kaynakları + Olaylar)
            if (posthogBox) {
                const modelsRows = (ph.topModels && ph.topModels.length > 0)
                    ? ph.topModels.map(m => `<tr><td><strong>${m.name}</strong></td><td><span class="badge badge-primary">${m.interactions} etkileşim</span></td></tr>`).join('')
                    : '<tr><td colspan="2" style="color:#94a3b8;font-size:12px;">Henüz 30 günlük model etkileşimi birikmedi — Vitrin trafiği geldikçe otomatik dolacaktır.</td></tr>';

                const sourcesRows = (ph.topSources && ph.topSources.length > 0)
                    ? ph.topSources.map(src => `<tr><td><strong>${src.source}</strong></td><td><span class="badge badge-success">${src.visits} ziyaret</span></td></tr>`).join('')
                    : '<tr><td colspan="2" style="color:#94a3b8;font-size:12px;">Henüz trafik kaynağı verisi birikmedi — Vitrin ve sosyal medya UTM linkleriyle otomatik güncellenir.</td></tr>';

                const eventsRows = (ph.topEvents && ph.topEvents.length > 0)
                    ? ph.topEvents.slice(0, 8).map(ev => `<tr><td><code>${ev.event}</code></td><td><span class="badge badge-accent">${ev.count}</span></td></tr>`).join('')
                    : '<tr><td colspan="2" style="color:#94a3b8;font-size:12px;">PostHog EU bağlantısı aktif — ilk olaylar geldikçe burada listelenir.</td></tr>';

                posthogBox.innerHTML = `
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
                        <div class="card panel" style="background:#111B2E;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;">
                            <div style="font-size:13px;font-weight:800;color:#fde68a;margin-bottom:10px;">🛋️ En Çok İncelenen Koleksiyon &amp; 3D Modeller</div>
                            <table class="data-table" style="font-size:12px;"><tbody>${modelsRows}</tbody></table>
                        </div>
                        <div class="card panel" style="background:#111B2E;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;">
                            <div style="font-size:13px;font-weight:800;color:#38bdf8;margin-bottom:10px;">🌐 Trafik Kaynakları &amp; Sosyal Medya UTM</div>
                            <table class="data-table" style="font-size:12px;"><tbody>${sourcesRows}</tbody></table>
                        </div>
                        <div class="card panel" style="background:#111B2E;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;">
                            <div style="font-size:13px;font-weight:800;color:#c084fc;margin-bottom:10px;">⚡ Son 30 Gün PostHog Olay Dağılımı</div>
                            <table class="data-table" style="font-size:12px;"><tbody>${eventsRows}</tbody></table>
                        </div>
                    </div>
                `;
            }

            // Canlı Sosyal Medya Kanal Dağılımı + Son CRM Teklifleri
            if (opsBox) {
                const platList = [
                    { name: 'Instagram (Reels / Carousel / Story)', count: pl.instagram || 0, color: '#ec4899' },
                    { name: 'Facebook Sayfa', count: pl.facebook || 0, color: '#3b82f6' },
                    { name: 'TikTok', count: pl.tiktok || 0, color: '#14b8a6' },
                    { name: 'YouTube Shorts', count: pl.youtube || 0, color: '#ef4444' }
                ];
                const platMax = Math.max(1, ...platList.map(x => x.count));

                const latestQuotes = Array.isArray(crm.latestQuotes) ? crm.latestQuotes : [];
                const quotesHtml = latestQuotes.length > 0
                    ? latestQuotes.map(q => `
                        <tr>
                            <td><strong>${q.customer_name || 'B2C Müşteri'}</strong><div style="font-size:11px;color:#94a3b8;">${q.customer_email || q.customer_phone || '-'}</div></td>
                            <td>${q.collection_id || 'Genel Teklif'}</td>
                            <td><span class="badge badge-success">${q.status || 'new'}</span></td>
                        </tr>
                    `).join('')
                    : '<tr><td colspan="3" style="color:#94a3b8;font-size:12px;">Henüz vitrinden yeni teklif kaydı gelmedi. Müşteriler "Teklif Al" butonunu kullandıkça burada canlı listelenir.</td></tr>';

                opsBox.innerHTML = `
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;">
                        <div class="card panel" style="background:#111B2E;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                                <h3 style="font-size:14.5px;font-weight:800;color:#fff;margin:0;">📲 Sosyal Medya Kanal Dağılımı (Canlı Kuyruk)</h3>
                                <span style="font-size:11px;color:#94a3b8;">Son ${totalSocial} Görev</span>
                            </div>
                            ${platList.map(p => {
                                const w = Math.max(p.count > 0 ? 8 : 0, Math.round((p.count / platMax) * 100));
                                return `
                                    <div style="margin-bottom:12px;">
                                        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px;">
                                            <span style="color:#e2e8f0;">${p.name}</span>
                                            <strong style="color:${p.color};">${p.count} görev</strong>
                                        </div>
                                        <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:999px;overflow:hidden;">
                                            <div style="height:100%;width:${w}%;background:${p.color};border-radius:999px;"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>

                        <div class="card panel" style="background:#111B2E;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                                <h3 style="font-size:14.5px;font-weight:800;color:#fff;margin:0;">🧾 Son Vitrin Teklif &amp; CRM Kayıtları</h3>
                                <span style="font-size:11px;color:#34d399;">Clerk Lazy Login → Supabase</span>
                            </div>
                            <table class="data-table" style="font-size:12px;">
                                <thead>
                                    <tr><th>Müşteri</th><th>İlgilenilen Model</th><th>Durum</th></tr>
                                </thead>
                                <tbody>${quotesHtml}</tbody>
                            </table>
                        </div>
                    </div>
                `;
            }

            if (showNotice && typeof window.showToast === 'function') {
                window.showToast(`PostHog EU & Supabase canlı analitik verileri güncellendi (${ph.latencyMs || 0} ms).`);
            }
        } catch (err) {
            kpiBox.innerHTML = `<div style="padding:16px;color:#fca5a5;font-size:13px;grid-column:1/-1;">⚠️ Bağlantı hatası: ${err.message}</div>`;
        }
    };

    setTimeout(() => { window.loadLivePostHogAnalytics(false); }, 60);

    return `
        <div class="page-header" style="margin-bottom: 22px;">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span>Modül 6: Performans &amp; Ürün Analitiği</span>
                </div>
                <h1 style="font-size: 24px; font-weight: 800; color: #fff; margin-top: 4px;">Canlı PostHog EU, 3D Showroom &amp; Operasyon Analitiği</h1>
                <p class="subtitle" style="color: #94A3B8; font-size: 13.5px; margin-top: 4px;">
                    B2C vitrin trafiği, 3D/AR model etkileşimi, Clerk teklif dönüşüm hunisi, katalog ve sosyal medya yayın performansı.
                </p>
            </div>
            <div class="page-actions" style="display:flex; gap:10px; align-items:center;">
                <button class="btn btn-primary" onclick="window.loadLivePostHogAnalytics(true)" style="font-weight:700;">
                    📊 Canlı Verileri Yenile
                </button>
            </div>
        </div>

        <div id="analytics-content">
            <!-- 6 Canlı KPI Kartı -->
            <div id="live-analytics-kpi-grid" class="metrics-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:22px;"></div>

            <!-- Canlı Dönüşüm Hunisi -->
            <div class="card panel" style="background:#111B2E;border:1px solid rgba(168,85,247,0.32);border-radius:16px;padding:20px 22px;margin-bottom:22px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
                    <h3 style="font-size:15.5px;font-weight:800;color:#fff;margin:0;">🎯 Canlı B2C Vitrin → 3D Showroom → Teklif Dönüşüm Hunisi</h3>
                    <span class="tag">PostHog EU Project #361931 • HogQL API</span>
                </div>
                <div id="live-analytics-funnel-box"></div>
            </div>

            <!-- PostHog EU Detay Tabloları -->
            <div id="live-posthog-tables-box" style="margin-bottom:22px;"></div>

            <!-- Sosyal Medya Kanal Dağılımı & Son CRM Teklifleri -->
            <div id="live-social-crm-box"></div>
        </div>
    `;
}

// Module 5: Operations & Infrastructure Control Panel
// Global Kapak Mobilya — Canlı Altyapı Sağlık Monitörü & Detaylı Teknoloji Envanteri

export function renderOperationsModule() {
    window.loadLiveInfraHealth = async function (showNotice = false) {
        const box = document.getElementById('live-infra-telemetry-box');
        const sentryBox = document.getElementById('live-sentry-issues-box');
        const summaryBadges = document.getElementById('infra-live-summary-metrics');
        if (!box) return;

        box.innerHTML = '<div style="padding:18px;color:#94a3b8;font-size:13px;">📡 Clerk Production, Cloudflare R2 CDN, Supabase PostgreSQL, Sentry EU, PostHog EU ve Vercel servisleri canlı taranıyor…</div>';

        try {
            const res = await fetch('/api/telemetry-health');
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.services) {
                box.innerHTML = `<div style="padding:16px;color:#fca5a5;font-size:13px;">⚠️ Telemetri okunamadı: ${json?.error || res.status}</div>`;
                return;
            }

            const { clerk, cloudflareR2, supabaseDb, supabaseQueue, sentry, posthog, vercel, storefronts, workers } = json.services;

            const statusPill = (ok, okText, warnText = 'Beklemede') => ok
                ? `<span style="background:rgba(16,185,129,0.16);border:1px solid rgba(16,185,129,0.38);color:#34d399;font-size:11px;font-weight:800;padding:3px 9px;border-radius:12px;">🟢 ${okText}</span>`
                : `<span style="background:rgba(245,158,11,0.16);border:1px solid rgba(245,158,11,0.38);color:#fbbf24;font-size:11px;font-weight:800;padding:3px 9px;border-radius:12px;">🟡 ${warnText}</span>`;

            const activeHealthyCount = [clerk?.ok, cloudflareR2?.ok && cloudflareR2?.cdnOk, supabaseDb?.ok, sentry?.ok, posthog?.ok, vercel?.ok, storefronts?.beta?.ok, workers?.igWebhookOk].filter(Boolean).length;

            if (summaryBadges) {
                summaryBadges.innerHTML = `
                    <div class="card metric-card" style="background:#111B2E; border:1px solid rgba(16,185,129,0.28); border-radius:14px; padding:18px 20px;">
                        <div style="font-size:11px; font-weight:800; color:#94A3B8; text-transform:uppercase; margin-bottom:6px;">Çekirdek Altyapı Sağlığı</div>
                        <div style="font-size:26px; font-weight:900; color:#34D399;">${activeHealthyCount} <span style="font-size:13px; color:#94A3B8;">/ 8 Çevrimiçi</span></div>
                        <div style="font-size:12px; color:#CBD5E1; margin-top:4px;">Toplam Tarama: <strong>${json.totalCheckMs || 0} ms</strong></div>
                    </div>
                    <div class="card metric-card" style="background:#111B2E; border:1px solid rgba(56,189,248,0.28); border-radius:14px; padding:18px 20px;">
                        <div style="font-size:11px; font-weight:800; color:#94A3B8; text-transform:uppercase; margin-bottom:6px;">Cloudflare R2 Medya &amp; CDN</div>
                        <div style="font-size:26px; font-weight:900; color:#38BDF8;">${(cloudflareR2?.productObjectCount || 0) + (cloudflareR2?.musicObjectCount || 0)} <span style="font-size:13px; color:#7DD3FC;">Nesne</span></div>
                        <div style="font-size:12px; color:#CBD5E1; margin-top:4px;"><code>cdn.globalkapakmobilya.com</code> • HTTP ${cloudflareR2?.cdnStatus || 200}</div>
                    </div>
                    <div class="card metric-card" style="background:#111B2E; border:1px solid rgba(168,85,247,0.28); border-radius:14px; padding:18px 20px;">
                        <div style="font-size:11px; font-weight:800; color:#94A3B8; text-transform:uppercase; margin-bottom:6px;">Clerk Yetkili Personel</div>
                        <div style="font-size:26px; font-weight:900; color:#C084FC;">${clerk?.memberCount ?? 0} <span style="font-size:13px; color:#E9D5FF;">Üye</span></div>
                        <div style="font-size:12px; color:#CBD5E1; margin-top:4px;">5 Departman RBAC • Svix Webhook Aktif</div>
                    </div>
                    <div class="card metric-card" style="background:#111B2E; border:1px solid rgba(250,204,21,0.28); border-radius:14px; padding:18px 20px;">
                        <div style="font-size:11px; font-weight:800; color:#94A3B8; text-transform:uppercase; margin-bottom:6px;">Sentry 24s Açık Hata</div>
                        <div style="font-size:26px; font-weight:900; color:${(sentry?.unresolvedCount || 0) === 0 ? '#34D399' : '#F87171'};">${sentry?.unresolvedCount ?? 0} <span style="font-size:13px; color:#94A3B8;">Olay</span></div>
                        <div style="font-size:12px; color:#CBD5E1; margin-top:4px;">${sentry?.projects?.length || 0} EU Projesi • PostHog #${posthog?.projectId || '361931'}</div>
                    </div>
                `;
            }

            box.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;">
                    <div style="background:rgba(15,23,42,0.88);border:1px solid rgba(168,85,247,0.25);border-radius:12px;padding:15px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="font-size:13px;color:#fff;">🔐 Clerk Production Auth</strong>
                            ${statusPill(clerk?.ok, `${clerk?.latencyMs || 0} ms`, 'Bağlantı Bekliyor')}
                        </div>
                        <div style="font-size:12px;color:#cbd5e1;line-height:1.55;">
                            <div>Kurum: <strong>${clerk?.orgName || 'Global Kapak Mobilya'}</strong></div>
                            <div>Org Üyeleri: <strong>${clerk?.memberCount ?? 0}</strong> • Roller: admin, factory, sales, social_media, viewer</div>
                            <div>Senkron: <code>/api/webhooks/clerk</code> (Svix HMAC)</div>
                        </div>
                    </div>

                    <div style="background:rgba(15,23,42,0.88);border:1px solid rgba(56,189,248,0.25);border-radius:12px;padding:15px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="font-size:13px;color:#fff;">☁️ Cloudflare R2 &amp; CDN</strong>
                            ${statusPill(cloudflareR2?.ok && cloudflareR2?.cdnOk, `${cloudflareR2?.latencyMs || 0} ms`, 'CDN Kontrol')}
                        </div>
                        <div style="font-size:12px;color:#cbd5e1;line-height:1.55;">
                            <div>CDN: <code>${cloudflareR2?.cdnDomain || 'https://cdn.globalkapakmobilya.com'}</code> (HTTP ${cloudflareR2?.cdnStatus || '-'})</div>
                            <div>Bucket: <code>${cloudflareR2?.bucket || 'globalkapak-medya'}</code> • Sıfır Egress</div>
                            <div>Varlıklar: <strong>${cloudflareR2?.productObjectCount || 0}</strong> ürün medyası • <strong>${cloudflareR2?.musicObjectCount || 0}</strong> müzik</div>
                        </div>
                    </div>

                    <div style="background:rgba(15,23,42,0.88);border:1px solid rgba(16,185,129,0.25);border-radius:12px;padding:15px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="font-size:13px;color:#fff;">⚡ Supabase PostgreSQL</strong>
                            ${statusPill(supabaseDb?.ok, `${supabaseDb?.latencyMs || 0} ms`, 'Hata')}
                        </div>
                        <div style="font-size:12px;color:#cbd5e1;line-height:1.55;">
                            <div>Mod: <strong>Yalnızca İlişkisel DB</strong> (CRM &amp; ERP tabloları ${supabaseDb?.crmTableOk && supabaseDb?.erpUsersTableOk ? '✅ Hazır' : '⚠️ Kontrol'})</div>
                            <div>Katalog: <strong>${supabaseDb?.collections || 0}</strong> koleksiyon • <strong>${supabaseDb?.products || 0}</strong> ürün • CRM: <strong>${supabaseDb?.crmCustomers || 0}</strong></div>
                            <div>Kuyruk: <strong>${supabaseQueue?.counts?.published || 0}</strong> yayında • <strong>${supabaseQueue?.counts?.pending || 0}</strong> bekleyen • <strong>${supabaseQueue?.counts?.failed || 0}</strong> hata</div>
                        </div>
                    </div>

                    <div style="background:rgba(15,23,42,0.88);border:1px solid rgba(244,63,94,0.25);border-radius:12px;padding:15px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="font-size:13px;color:#fff;">🛡️ Sentry EU (de.sentry.io)</strong>
                            ${statusPill(sentry?.ok, `${sentry?.projects?.length || 0} Proje • ${sentry?.latencyMs || 0} ms`, 'Yapılandırma')}
                        </div>
                        <div style="font-size:12px;color:#cbd5e1;line-height:1.55;">
                            <div>Organizasyon: <code>${sentry?.orgSlug || 'global-kapak-mobilya'}</code></div>
                            <div>Son 24s Açık Hata: <strong>${sentry?.unresolvedCount ?? 0}</strong></div>
                            <div>Projeler: ${(sentry?.projects || []).map(p => `<code>${p.slug}</code>`).join(', ') || 'nova-erp-api, nova-b2c-web'}</div>
                        </div>
                    </div>

                    <div style="background:rgba(15,23,42,0.88);border:1px solid rgba(250,204,21,0.25);border-radius:12px;padding:15px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="font-size:13px;color:#fff;">📊 PostHog EU Cloud</strong>
                            ${statusPill(posthog?.ok, `${posthog?.latencyMs || 0} ms`, 'Bağlanıyor')}
                        </div>
                        <div style="font-size:12px;color:#cbd5e1;line-height:1.55;">
                            <div>Host: <code>${posthog?.host || 'https://eu.posthog.com'}</code> • Proje <strong>#${posthog?.projectId || '361931'}</strong></div>
                            <div>30g Olay: <strong>${posthog?.totalEvents30d || 0}</strong> • Tekil Ziyaretçi: <strong>${posthog?.uniqueVisitors30d || 0}</strong></div>
                            <div>İzleme: Vitrin, 3D Showroom &amp; Teklif Hunisi</div>
                        </div>
                    </div>

                    <div style="background:rgba(15,23,42,0.88);border:1px solid rgba(148,163,184,0.25);border-radius:12px;padding:15px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="font-size:13px;color:#fff;">▲ Vercel Edge &amp; Cron</strong>
                            ${statusPill(vercel?.ok, `${vercel?.region || 'fra1'} • Aktif`, 'Pasif')}
                        </div>
                        <div style="font-size:12px;color:#cbd5e1;line-height:1.55;">
                            <div>ERP: <code>erp.globalkapakmobilya.com</code></div>
                            <div>Vitrinler: <code>beta</code> • <code>kapak</code></div>
                            <div>Runtime: <strong>${vercel?.serverlessFunctions || 12}</strong>/12 Function + pg_cron</div>
                        </div>
                    </div>

                    <div style="background:rgba(15,23,42,0.88);border:1px solid rgba(56,189,248,0.25);border-radius:12px;padding:15px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="font-size:13px;color:#fff;">🌐 B2C &amp; Membran Vitrinleri</strong>
                            ${statusPill(storefronts?.beta?.ok, `${storefronts?.beta?.latencyMs || 0} ms`, 'Kontrol')}
                        </div>
                        <div style="font-size:12px;color:#cbd5e1;line-height:1.55;">
                            <div>B2C Mobilya: <code>beta</code> → <strong>HTTP ${storefronts?.beta?.status || '-'}</strong></div>
                            <div>Membran Kapak: <code>kapak</code> → <strong>${storefronts?.kapak?.ok ? `HTTP ${storefronts.kapak.status}` : 'DNS/Vercel Bekliyor'}</strong></div>
                            <div>Köprü: <code>/api/b2c-public</code> + <code>/api/b2c-lazy-quote</code></div>
                        </div>
                    </div>

                    <div style="background:rgba(15,23,42,0.88);border:1px solid rgba(16,185,129,0.25);border-radius:12px;padding:15px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="font-size:13px;color:#fff;">🤖 Bot &amp; DigitalOcean Render İşçisi</strong>
                            ${statusPill(workers?.vpsOnline, 'VPS Online', workers?.igWebhookOk ? 'VPS Konteyner Kapalı' : 'Beklemede')}
                        </div>
                        <div style="font-size:12px;color:#cbd5e1;line-height:1.55;">
                            <div>IG Webhook: <strong>${workers?.igWebhookOk ? `Çevrimiçi (HTTP ${workers.igWebhookStatus})` : 'Ulaşılamadı'}</strong></div>
                            <div>VPS Render (<code>nova_publisher</code>): <strong>${workers?.vpsOnline ? 'Çevrimiçi' : 'Kapalı / Heartbeat Yok'}</strong></div>
                            <div>Son Kalp Atışı: <code>${workers?.vpsLastSeen ? new Date(workers.vpsLastSeen).toLocaleString('tr-TR') : 'Henüz Sinyal Yok'}</code></div>
                        </div>
                    </div>
                </div>
            `;

            if (sentryBox) {
                const issuesHtml = (sentry?.recentIssues && sentry.recentIssues.length > 0)
                    ? sentry.recentIssues.slice(0, 6).map(i => `
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.22);border-radius:8px;margin-top:8px;">
                            <div style="min-width:0;">
                                <span style="font-size:10.5px;font-weight:800;color:#fca5a5;text-transform:uppercase;">${i.project} • ${i.shortId}</span>
                                <div style="font-size:12.5px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i.title}</div>
                            </div>
                            <span style="font-size:11px;font-weight:700;color:#fde68a;white-space:nowrap;">${i.count}x</span>
                        </div>
                    `).join('')
                    : '<div style="padding:12px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;color:#6ee7b7;font-size:12.5px;margin-top:10px;">✅ Son 24 saatte Sentry EU üzerinde çözülmemiş kritik hata bulunmuyor.</div>';
                sentryBox.innerHTML = issuesHtml;
            }

            if (showNotice && typeof window.showToast === 'function') {
                window.showToast(`Canlı altyapı taraması tamamlandı (${json.totalCheckMs} ms).`);
            }
        } catch (err) {
            box.innerHTML = `<div style="padding:16px;color:#fca5a5;font-size:13px;">⚠️ Bağlantı hatası: ${err.message}</div>`;
        }
    };

    setTimeout(() => { window.loadLiveInfraHealth(false); }, 60);

    const techStack = [
        {
            icon: '🔐',
            name: 'Clerk Production (Auth & RBAC)',
            category: 'KİMLİK DOĞRULAMA & YETKİLENDİRME',
            status: '🟢 Canlı & Aktif',
            statusColor: '#34D399',
            desc: 'Tek canlı Production uygulaması ile hem ERP (erp.globalkapakmobilya.com) hem Vitrin (beta.globalkapakmobilya.com) oturumlarını yönetir. ERP erişimi Global Kapak Mobilya organizasyon üyeliği (orgId) ve 5 departmanlı publicMetadata.department (admin, factory, sales, social_media, viewer) ile korunur.',
            endpoint: 'clerk.globalkapakmobilya.com • /api/webhooks/clerk (Svix)',
            protocol: '@clerk/clerk-js@6 + @clerk/ui@1 • JWT RS256 / JWKS',
            replaced: 'Eski Supabase Auth tamamen devre dışı bırakıldı'
        },
        {
            icon: '☁️',
            name: 'Cloudflare R2 & Custom CDN',
            category: 'MEDYA, VİDEO & 3D MODEL DEPOLAMA',
            status: '🟢 Canlı & Aktif',
            statusColor: '#34D399',
            desc: 'Tüm ürün/koleksiyon görselleri, .glb/.gltf 3D showroom modelleri, sosyal medya videoları ve müzik kütüphanesi sıfır egress (veri çıkış ücreti ₺0) ile Cloudflare R2 globalkapak-medya bucketında saklanır ve küresel Edge CDN üzerinden dağıtılır.',
            endpoint: 'https://cdn.globalkapakmobilya.com • Bucket: globalkapak-medya',
            protocol: 'S3 Compatible API (AWS SigV4) • HTTP/3 Edge Cache',
            replaced: 'Eski Supabase Storage tamamen devre dışı bırakıldı'
        },
        {
            icon: '⚡',
            name: 'Supabase PostgreSQL',
            category: 'MERKEZİ İLİŞKİSEL VERİTABANI',
            status: '🟢 Canlı & Aktif',
            statusColor: '#34D399',
            desc: 'Yalnızca ilişkisel PostgreSQL veritabanı olarak çalışır. 17 aktif tablo ile ürünler, koleksiyonlar, 3D varlık kayıtları, Clerk kullanıcı/CRM müşteri senkronizasyonu, sosyal medya kuyruğu ve Modül 1/7/8 verilerini barındırır.',
            endpoint: 'vrfujrpsjzqjthaqdalx.supabase.co (EU Central)',
            protocol: 'PostgREST API • PostgreSQL 15 • pg_cron / RLS',
            replaced: 'Auth & Storage yükü Clerk ve Cloudflare R2ye devredildi'
        },
        {
            icon: '🛡️',
            name: 'Sentry EU Cloud',
            category: 'HATA İZLEME & GÖZLEMLENEBİLİRLİK',
            status: '🟢 Canlı & Aktif',
            statusColor: '#34D399',
            desc: 'ERP API, ERP arayüzü ve B2C Vitrin tarafındaki JavaScript ve sunucu hatalarını anlık yakalar. Bu paneldeki canlı hata akışı Sentry EU REST API üzerinden gerçek zamanlı çekilir.',
            endpoint: 'https://de.sentry.io • Org: global-kapak-mobilya',
            protocol: 'Sentry Envelope SDK • EU Data Residency (Frankfurt)',
            replaced: 'Manuel sunucu log kontrolü yerine merkezi hata monitörü'
        },
        {
            icon: '📊',
            name: 'PostHog EU Cloud',
            category: 'ÜRÜN, 3D SHOWROOM & DÖNÜŞÜM ANALİTİĞİ',
            status: '🟢 Canlı & Aktif',
            statusColor: '#34D399',
            desc: 'B2C vitrindeki sayfa görüntülemelerini, koleksiyon/ürün incelemelerini, 3D model etkileşimlerini (3d_model_interacted) ve teklif formu dönüşümlerini GDPR uyumlu EU sunucularında toplar; Modül 6ya HogQL API ile besler.',
            endpoint: 'https://eu.posthog.com • Proje #361931',
            protocol: 'PostHog JS SDK (eu.i.posthog.com) • HogQL Query API',
            replaced: 'Statik/örnek analitik verileri yerine canlı kullanıcı hunisi'
        },
        {
            icon: '▲',
            name: 'Vercel Edge Hosting & Cron',
            category: 'SUNUCUSUZ BARINDIRMA & ZAMANLAMA',
            status: '🟢 Canlı & Aktif',
            statusColor: '#34D399',
            desc: 'Hem Kurumsal Vitrin (beta.globalkapakmobilya.com) hem ERP Paneli (erp.globalkapakmobilya.com) için sıfır kesintili global Edge dağıtımı, 12 optimize Serverless API fonksiyonu ve zamanlanmış Vercel Cron görevlerini yürütür.',
            endpoint: 'erp.globalkapakmobilya.com & beta.globalkapakmobilya.com',
            protocol: 'Node.js Serverless Functions • Edge Network • Vercel Cron',
            replaced: 'Geleneksel tekil web sunucusu yönetimi'
        },
        {
            icon: '🐙',
            name: 'GitHub CI/CD',
            category: 'KAYNAK KOD & OTOMATİK DAĞITIM',
            status: '🟢 Canlı & Aktif',
            statusColor: '#34D399',
            desc: 'İki ayrı ana depo (Insta_Deployment ERP ve Global-Mobilya-Web Vitrin) üzerinden sürüm kontrolü, GitHub Push Protection (gizli anahtar taraması) ve main dalına her push sonrası otomatik Vercel yayını sağlar.',
            endpoint: 'github.com/Andromeda012/Insta_Deployment & Global-Mobilya-Web',
            protocol: 'Git • Push Protection • Vercel Git Integration',
            replaced: 'Manuel FTP / sunucu dosya aktarımı'
        },
        {
            icon: '🧊',
            name: 'Google <model-viewer> 3D / AR',
            category: 'İNTERAKTİF 3D SHOWROOM MOTORU',
            status: '🟢 Canlı & Aktif',
            statusColor: '#34D399',
            desc: 'Modül 8den Cloudflare R2ye yüklenen .glb/.gltf mobilya modellerini B2C vitrin ürün ve koleksiyon sayfalarında 360° döndürülebilir ve mobil cihazlarda Artırılmış Gerçeklik (AR) ile odada görülebilir şekilde sunar.',
            endpoint: 'beta.globalkapakmobilya.com/urun.html & koleksiyon.html',
            protocol: 'WebGL / glTF 2.0 / WebXR / AR Quick Look',
            replaced: 'Yalnızca 2D statik fotoğraf galerisi'
        },
        {
            icon: '🧠',
            name: 'Google Gemini AI',
            category: 'YAPAY ZEKA METİN, GÖRSEL ANALİZ & DM',
            status: '🟢 Canlı & Aktif',
            statusColor: '#34D399',
            desc: 'Ürün fotoğrafından otomatik mobilya teknik özellikleri ve lüks tasarım hikayesi üretir; sosyal medya DM ve yorumlarında müşteri sorularına marka tonunda otonom yanıt hazırlar.',
            endpoint: 'generativelanguage.googleapis.com • /api/module7?action=generate-features',
            protocol: 'Gemini Vision & Text REST API',
            replaced: 'Manuel ürün açıklaması ve katalog metni yazımı'
        },
        {
            icon: '📲',
            name: 'Sosyal Medya API Ağı (Meta, TikTok, YouTube)',
            category: '4 KANALLI OTONOM İÇERİK DAĞITIMI',
            status: '🟢 Entegre',
            statusColor: '#38BDF8',
            desc: 'Instagram (Reels, Carousel, Story), Facebook, TikTok ve YouTube Shorts kanallarına Modül 2 ve Vercel Cron üzerinden Cloudflare R2 kaynaklı medya dağıtımı ve webhook mesaj takibi yapar.',
            endpoint: 'Meta Graph API • TikTok Content API • YouTube Data API',
            protocol: 'OAuth 2.0 • Graph Webhooks • Vercel Cron',
            replaced: 'Manuel çoklu platform paylaşım süreci'
        }
    ];

    return `
        <div class="page-header" style="margin-bottom: 22px;">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span>Modül 5: Altyapı, Entegrasyonlar &amp; Teknoloji Envanteri</span>
                </div>
                <h1 style="font-size: 24px; font-weight: 800; color: #fff; margin-top: 4px;">Canlı Sistem Mimarisi &amp; Altyapı Sağlık Monitörü</h1>
                <p class="subtitle" style="color: #94A3B8; font-size: 13.5px; margin-top: 4px;">
                    Clerk Production, Cloudflare R2 CDN, Supabase PostgreSQL, Sentry EU, PostHog EU ve Vercel Edge canlı durum ve teknoloji envanteri.
                </p>
            </div>
            <div class="page-actions" style="display:flex; gap:10px; align-items:center;">
                <button class="btn btn-primary" onclick="window.loadLiveInfraHealth(true)" style="font-weight:700;">
                    ⚡ Canlı Sağlık Taraması
                </button>
            </div>
        </div>

        <!-- Özet Canlı KPI Kartları -->
        <div id="infra-live-summary-metrics" class="metrics-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(215px, 1fr)); gap:16px; margin-bottom:24px;"></div>

        <!-- 6 Çekirdek Servis Canlı Telemetri Grid -->
        <div style="background:#111B2E; border:1px solid rgba(56,189,248,0.32); border-radius:16px; padding:20px 22px; margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
                <h3 style="font-size:15.5px; font-weight:800; color:#fff; margin:0;">📡 Canlı Servis Telemetrisi (Gerçek Zamanlı Ping)</h3>
                <span style="font-size:11px; font-weight:700; color:#38bdf8;">Clerk • Cloudflare R2 • Supabase DB • Sentry EU • PostHog EU • Vercel</span>
            </div>
            <div id="live-infra-telemetry-box"></div>
            <div style="margin-top:16px;">
                <div style="font-size:12px;font-weight:800;color:#cbd5e1;letter-spacing:0.4px;">🛡️ Sentry EU Son 24 Saatlik Hata Akışı</div>
                <div id="live-sentry-issues-box"></div>
            </div>
        </div>

        <!-- Uçtan Uca Canlı Mimari Veri Akış Zinciri -->
        <div style="background:#111B2E; border:1px solid rgba(212,175,55,0.28); border-radius:16px; padding:22px 24px; margin-bottom:24px;">
            <h3 style="font-size:16px; font-weight:800; color:#FDE68A; margin-bottom:4px;">🔄 Güncel Canlı Mimari Veri Akışı (5 Katman)</h3>
            <p style="font-size:13px; color:#94A3B8; margin-bottom:16px;">Tek merkezli, çakışmasız ve sıfır egress maliyetli canlı sistem omurgası:</p>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(185px, 1fr)); gap:12px;">
                <div style="background:rgba(15,23,42,0.85); border:1px solid rgba(168,85,247,0.28); border-radius:12px; padding:14px;">
                    <div style="font-size:10.5px; font-weight:800; color:#C084FC; margin-bottom:4px;">1. KİMLİK &amp; YETKİ</div>
                    <strong style="font-size:13px; color:#fff; display:block; margin-bottom:4px;">Clerk Production</strong>
                    <p style="font-size:11.5px; color:#94A3B8; line-height:1.45; margin:0;">Org doğrulaması, 5 departman RBAC, Vitrin Lazy Login ve Svix webhook.</p>
                </div>
                <div style="background:rgba(15,23,42,0.85); border:1px solid rgba(16,185,129,0.28); border-radius:12px; padding:14px;">
                    <div style="font-size:10.5px; font-weight:800; color:#34D399; margin-bottom:4px;">2. İLİŞKİSEL VERİ</div>
                    <strong style="font-size:13px; color:#fff; display:block; margin-bottom:4px;">Supabase PostgreSQL</strong>
                    <p style="font-size:11.5px; color:#94A3B8; line-height:1.45; margin:0;">17 aktif tablo: Katalog, 3D kayıtları, CRM müşterileri ve yayın kuyruğu.</p>
                </div>
                <div style="background:rgba(15,23,42,0.85); border:1px solid rgba(56,189,248,0.28); border-radius:12px; padding:14px;">
                    <div style="font-size:10.5px; font-weight:800; color:#38BDF8; margin-bottom:4px;">3. MEDYA &amp; 3D CDN</div>
                    <strong style="font-size:13px; color:#fff; display:block; margin-bottom:4px;">Cloudflare R2</strong>
                    <p style="font-size:11.5px; color:#94A3B8; line-height:1.45; margin:0;"><code>cdn.globalkapakmobilya.com</code> üzerinden sıfır egress fotoğraf, video ve .glb.</p>
                </div>
                <div style="background:rgba(15,23,42,0.85); border:1px solid rgba(148,163,184,0.28); border-radius:12px; padding:14px;">
                    <div style="font-size:10.5px; font-weight:800; color:#E2E8F0; margin-bottom:4px;">4. HOSTİNG &amp; CRON</div>
                    <strong style="font-size:13px; color:#fff; display:block; margin-bottom:4px;">Vercel Edge &amp; API</strong>
                    <p style="font-size:11.5px; color:#94A3B8; line-height:1.45; margin:0;">ERP + B2C Vitrin, /api/b2c-public köprüsü ve zamanlanmış Cron görevleri.</p>
                </div>
                <div style="background:rgba(15,23,42,0.85); border:1px solid rgba(250,204,21,0.28); border-radius:12px; padding:14px;">
                    <div style="font-size:10.5px; font-weight:800; color:#FDE68A; margin-bottom:4px;">5. GÖZLEM &amp; ANALİTİK</div>
                    <strong style="font-size:13px; color:#fff; display:block; margin-bottom:4px;">Sentry EU + PostHog EU</strong>
                    <p style="font-size:11.5px; color:#94A3B8; line-height:1.45; margin:0;">Hata izleme, 3D etkileşim ve teklif dönüşüm hunisi canlı raporlanır.</p>
                </div>
            </div>
        </div>

        <!-- Detaylı Teknoloji & Servis Envanteri -->
        <div style="background:#111B2E; border:1px solid rgba(148,163,184,0.16); border-radius:16px; padding:24px; margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
                <div>
                    <h3 style="font-size:17px; font-weight:800; color:#fff; margin-bottom:4px;">📦 Aktif Teknoloji &amp; Servis Envanteri (${techStack.length} Bileşen)</h3>
                    <p style="font-size:12.5px; color:#94A3B8; margin:0;">Canlı sistemde aktif çalışan tüm altyapı bileşenleri, uç noktaları, protokolleri ve yerini aldıkları eski yapılar.</p>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px;">
                ${techStack.map(t => `
                    <div style="background:rgba(15,23,42,0.75); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:10px;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span style="font-size:22px;">${t.icon}</span>
                                    <div>
                                        <strong style="font-size:14.5px; color:#fff; display:block;">${t.name}</strong>
                                        <div style="font-size:10.5px; color:#94A3B8; font-weight:700;">${t.category}</div>
                                    </div>
                                </div>
                                <span style="background:rgba(16,185,129,0.14); border:1px solid ${t.statusColor}55; color:${t.statusColor}; font-size:10.5px; font-weight:800; padding:3px 9px; border-radius:12px; white-space:nowrap;">${t.status}</span>
                            </div>
                            <p style="font-size:12.5px; color:#CBD5E1; line-height:1.55; margin-bottom:12px;">${t.desc}</p>
                        </div>
                        <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.28); padding:10px 12px; border-radius:9px; line-height:1.55;">
                            <div><strong style="color:#E2E8F0;">Uç Nokta:</strong> <code>${t.endpoint}</code></div>
                            <div><strong style="color:#E2E8F0;">Protokol:</strong> ${t.protocol}</div>
                            <div><strong style="color:#FDE68A;">Dönüşüm:</strong> ${t.replaced}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Kapsam Dışı / Ertelenen Fazlar Bilgilendirmesi -->
        <div style="background:rgba(15,23,42,0.65); border:1px dashed rgba(148,163,184,0.3); border-radius:14px; padding:16px 20px;">
            <div style="font-size:12.5px; font-weight:800; color:#CBD5E1; margin-bottom:6px;">⏸️ Şimdilik Kapsam Dışı Tutulan / Ertelenen Mimari Fazlar</div>
            <div style="font-size:12px; color:#94A3B8; line-height:1.6;">
                • <strong>Faz 3 (Oracle Cloud OCI Worker):</strong> Medya/bot yükü tek merkezli tutulduğu için iptal edildi.<br>
                • <strong>Faz 5 (DigitalOcean Arka Plan İşçileri &amp; Genişletilmiş MRP Şeması):</strong> Şimdilik ertelendi; aktif zamanlama Vercel Cron ve Supabase <code>pg_cron</code> üzerinden yürütülmektedir.
            </div>
        </div>
    `;
}

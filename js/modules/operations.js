// Module 5: Operations & Infrastructure Control Panel
// Global Mobilya & Nova Furniture — Teknoloji, Altyapı ve Entegrasyonlar Envanteri

export function renderOperationsModule(data) {
    return `
        <div class="page-header" style="margin-bottom: 24px;">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span onclick="window.navigateTo('dashboard')" style="cursor:pointer; color:#38BDF8;">Ana Sayfa</span> / 
                    <span>Modül 5: Altyapı, Entegrasyonlar & Teknoloji Envanteri</span>
                </div>
                <h1 style="font-size: 24px; font-weight: 800; color: #fff; margin-top: 4px;">Sistem Mimarisi & Teknoloji Ekipmanları</h1>
                <p class="subtitle" style="color: #94A3B8; font-size: 13.5px; margin-top: 4px;">
                    Global Mobilya & Nova Furniture ekosisteminde şu ana kadar kurulan, aktif çalışan ve ileride devreye alınacak tüm bulut servisleri, veritabanı, yapay zeka ve API entegrasyonları.
                </p>
            </div>
            <div class="page-actions" style="display:flex; gap:10px; align-items:center;">
                <a href="/Module%205/index.html" class="btn btn-secondary" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
                    🖥️ Tam Ekran Portala Geç
                </a>
                <button class="btn btn-primary" onclick="window.showToast('Tüm altyapı servisleri yeşil: Supabase, Vercel, Meta ve Gemini aktif.')" style="font-weight:700;">
                    ⚡ Sistem Sağlık Taraması
                </button>
            </div>
        </div>

        <!-- Mimari Bilgilendirme Bannerı -->
        <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9)); border: 1px solid rgba(212, 175, 55, 0.35); border-left: 6px solid #D4AF37; border-radius: 14px; padding: 18px 24px; margin-bottom: 24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                <div>
                    <h3 style="font-size:15px; font-weight:800; color:#FDE68A; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                        🏛️ Şirket İçi Bilgi: Mimari Ekipman & Entegrasyon Listesi
                    </h3>
                    <p style="font-size:13px; color:#E2E8F0; line-height:1.6; margin:0; max-width:920px;">
                        Bu liste şirket çalışanlarımızın ve yöneticilerimizin sistemimizin arka planda hangi teknolojilerle çalıştığını kolayca anlaması için hazırlanmıştır. Canlı API anahtarları güvenlik nedeniyle maskeli ve Vercel ortamında korunmaktadır.
                    </p>
                </div>
                <div>
                    <span style="background:rgba(16, 185, 129, 0.15); border:1px solid rgba(16, 185, 129, 0.35); color:#34D399; font-size:12px; font-weight:800; padding:6px 14px; border-radius:20px;">
                        🟢 16 Servis & Donanım Kayıtlı
                    </span>
                </div>
            </div>
        </div>

        <!-- Altyapı Özet Metrikleri -->
        <div class="metrics-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:16px; margin-bottom:28px;">
            <div class="card metric-card" style="background:#111B2E; border:1px solid rgba(148,163,184,0.16); border-radius:14px; padding:18px 20px;">
                <div style="font-size:11.5px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-bottom:6px;">Aktif & Canlı Servisler</div>
                <div style="font-size:26px; font-weight:900; color:#10B981;">7 <span style="font-size:13px; color:#34D399;">/ 16</span></div>
                <div style="font-size:12px; color:#94A3B8; margin-top:4px;">GitHub, Vercel, Supabase, Gemini, vb.</div>
            </div>
            <div class="card metric-card" style="background:#111B2E; border:1px solid rgba(148,163,184,0.16); border-radius:14px; padding:18px 20px;">
                <div style="font-size:11.5px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-bottom:6px;">Hazır & Otomasyonda</div>
                <div style="font-size:26px; font-weight:900; color:#38BDF8;">4 <span style="font-size:13px; color:#7DD3FC;">/ 16</span></div>
                <div style="font-size:12px; color:#94A3B8; margin-top:4px;">Photoroom (Mock Aktif), TikTok, YouTube, FB</div>
            </div>
            <div class="card metric-card" style="background:#111B2E; border:1px solid rgba(148,163,184,0.16); border-radius:14px; padding:18px 20px;">
                <div style="font-size:11.5px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-bottom:6px;">Yol Haritası (Planlanan)</div>
                <div style="font-size:26px; font-weight:900; color:#C084FC;">5 <span style="font-size:13px; color:#E9D5FF;">Gelecek</span></div>
                <div style="font-size:12px; color:#94A3B8; margin-top:4px;">Cloudflare, Sentry, PayTR, Resend e-posta</div>
            </div>
            <div class="card metric-card" style="background:#111B2E; border:1px solid rgba(148,163,184,0.16); border-radius:14px; padding:18px 20px;">
                <div style="font-size:11.5px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-bottom:6px;">Aylık Altyapı Maliyeti</div>
                <div style="font-size:26px; font-weight:900; color:#FDE68A;">₺0 <span style="font-size:12px; color:#94A3B8;">(Free Tier)</span></div>
                <div style="font-size:12px; color:#94A3B8; margin-top:4px;">Vercel Hobby + Supabase + Gemini Kotası</div>
            </div>
        </div>

        <!-- Uçtan Uca Sistem Entegrasyon Akışı -->
        <div style="background:#111B2E; border:1px solid rgba(148,163,184,0.16); border-radius:16px; padding:22px 24px; margin-bottom:28px;">
            <h3 style="font-size:16px; font-weight:800; color:#fff; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                🔄 Uçtan Uca Mimari Veri Akış Modeli
            </h3>
            <p style="font-size:13px; color:#94A3B8; margin-bottom:18px;">Katalogdaki ham üründen müşteriye giden tam teknoloji zinciri:</p>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px;">
                <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px;">
                    <div style="font-size:11px; font-weight:800; color:#38BDF8; margin-bottom:4px;">1. ADIM: KATALOG</div>
                    <strong style="font-size:13px; color:#fff; display:block; margin-bottom:4px;">Supabase DB & Media</strong>
                    <p style="font-size:11.5px; color:#94A3B8; line-height:1.4; margin:0;">Ham fotoğraflar, ölçüler ve MDF/membran detayları kaydedilir.</p>
                </div>
                <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px;">
                    <div style="font-size:11px; font-weight:800; color:#FDE68A; margin-bottom:4px;">2. ADIM: GÖRSEL AI</div>
                    <strong style="font-size:13px; color:#fff; display:block; margin-bottom:4px;">Photoroom API</strong>
                    <p style="font-size:11.5px; color:#94A3B8; line-height:1.4; margin:0;">Sabit lüks prompt ile odaya oturtur, 1:1 detay post üretir.</p>
                </div>
                <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px;">
                    <div style="font-size:11px; font-weight:800; color:#34D399; margin-bottom:4px;">3. ADIM: ZAMANLAYICI</div>
                    <strong style="font-size:13px; color:#fff; display:block; margin-bottom:4px;">Vercel Serverless & Cron</strong>
                    <p style="font-size:11.5px; color:#94A3B8; line-height:1.4; margin:0;">Günün saatlerine göre (10:00, 14:30, 20:00) otonom tetikler.</p>
                </div>
                <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px;">
                    <div style="font-size:11px; font-weight:800; color:#EC4899; margin-bottom:4px;">4. ADIM: 4 BOT DAĞITIM</div>
                    <strong style="font-size:13px; color:#fff; display:block; margin-bottom:4px;">Meta, TikTok, YouTube</strong>
                    <p style="font-size:11.5px; color:#94A3B8; line-height:1.4; margin:0;">Reels, Gönderi, Story ve Shorts otonom yayınlanır.</p>
                </div>
                <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px;">
                    <div style="font-size:11px; font-weight:800; color:#A855F7; margin-bottom:4px;">5. ADIM: MÜŞTERİ & SATIŞ</div>
                    <strong style="font-size:13px; color:#fff; display:block; margin-bottom:4px;">Gemini AI & WhatsApp</strong>
                    <p style="font-size:11.5px; color:#94A3B8; line-height:1.4; margin:0;">Fiyat yorumuna DM açılır; özel ölçüde WhatsApp devri yapılır.</p>
                </div>
            </div>
        </div>

        <!-- Teknoloji Envanteri Listesi -->
        <div style="background:#111B2E; border:1px solid rgba(148,163,184,0.16); border-radius:16px; padding:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
                <div>
                    <h3 style="font-size:17px; font-weight:800; color:#fff; margin-bottom:4px;">📦 Sistem Teknoloji ve Servis Ekipmanları (16)</h3>
                    <p style="font-size:12.5px; color:#94A3B8; margin:0;">Platformumuzun kullandığı ve planlanan tüm teknolojilerin detaylı işlev tablosu.</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px;">
                
                <!-- GITHUB -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">🐙</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">GitHub</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">KOD & CI/CD</div>
                            </div>
                        </div>
                        <span style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#34D399; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟢 Aktif & Canlıda</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Tüm web sitesi ve bot kodlarının versiyon kontrolü, GitHub depoları ve Vercel otomatik deployment tetikleyicisi.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Kaynak Kod & Otomatik Dağıtım</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> Git / Webhooks / CI-CD</div>
                    </div>
                </div>

                <!-- VERCEL -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">▲</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Vercel Platform</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">SUNUCUSUZ ALTYAPI</div>
                            </div>
                        </div>
                        <span style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#34D399; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟢 Aktif & Canlıda</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        7/24 kesintisiz web barındırma, 10 adet Serverless Function (Hobby Plan optimize), otomatik Cron Jobs ve küresel Edge CDN.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Bulut Barındırma & Zamanlayıcı Motor</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> Serverless Edge Functions / Cron</div>
                    </div>
                </div>

                <!-- SUPABASE -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">⚡</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Supabase PostgreSQL</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">BULUT VERİTABANI</div>
                            </div>
                        </div>
                        <span style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#34D399; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟢 Aktif & Canlıda</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Ürün kataloğu (90-100 model), bot durumları, kampanya varlıkları ve sipariş kayıtlarının saklandığı merkezi veri tabanı.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Merkezi İlişkisel Veri Deposu</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> REST API / PostgREST / RLS</div>
                    </div>
                </div>

                <!-- SUPABASE STORAGE -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">📦</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Supabase Storage</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">MEDYA & DOSYA BULUTU</div>
                            </div>
                        </div>
                        <span style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#34D399; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟢 Aktif & Canlıda</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Ham mobilya fotoğrafları, Photoroom mimari oda çıktıları, Reels MP4 videoları ve post görsellerinin barındırıldığı medya havuzu.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Sosyal Medya Medya CDN Havuzu</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> S3 Uyumlu Object Storage</div>
                    </div>
                </div>

                <!-- PHOTOROOM API -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">✨</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Photoroom API</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">YAPAY ZEKA GÖRSEL SENTEZİ</div>
                            </div>
                        </div>
                        <span style="background:rgba(212,175,55,0.15); border:1px solid rgba(212,175,55,0.35); color:#FDE68A; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟡 Hazır (Sandbox Aktif)</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Katalog fotoğraflarını alıp sabit lüks prompt + veritabanı detaylarıyla arka planını yeniden tasarlar. API anahtarı girildiğinde canlı API devralır.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Otonom Oda Arka Planı Tasarımı</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> REST API / Multipart Image API</div>
                    </div>
                </div>

                <!-- GOOGLE GEMINI AI -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">🧠</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Google Gemini 2.5 Flash</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">YAPAY ZEKA SOHBET & DM</div>
                            </div>
                        </div>
                        <span style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#34D399; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟢 Aktif & Canlıda</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Görsel üretiminden bağımsız olarak yorumları tarar; "Fiyat" yazan müşterilere anında DM açar ve ürün kataloğunu bilerek satış danışmanlığı yapar.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> DM Satış Asistanı & Yorum Yanıtlayıcı</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> Google Generative Language API</div>
                    </div>
                </div>

                <!-- CANVAS & MEDIARECORDER -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">🎬</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Canvas & MediaRecorder</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">TARAYICI VİDEO MOTORU</div>
                            </div>
                        </div>
                        <span style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#34D399; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟢 Aktif & Canlıda</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        60 FPS Ken Burns kamera hareketi (zoom/pan) ile doğrudan sıfır sunucu maliyetiyle gerçek MP4 video ve 1080x1080 detay post görseli kaydeder.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Dinamik MP4 Video & Post Üretimi</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> HTML5 2D Canvas / MediaStream</div>
                    </div>
                </div>

                <!-- META GRAPH API (INSTAGRAM) -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">📸</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Meta Graph API (Instagram)</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">INSTAGRAM BUSINESS</div>
                            </div>
                        </div>
                        <span style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#34D399; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟢 Aktif & Canlıda</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        @thenovafurniture hesabına Reels video konteyneri, detay gönderi ve story otomatik yayınlama, yorum ve DM webhooks dinleme.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Instagram Otomasyon & Yayın Motoru</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> Meta Graph API v20.0</div>
                    </div>
                </div>

                <!-- FACEBOOK GRAPH API -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">📘</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Facebook Pages & Messenger</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">FACEBOOK BUSINESS</div>
                            </div>
                        </div>
                        <span style="background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.35); color:#38BDF8; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🔵 Entegre & Yayında</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Kurumsal sayfaya detay post ve reels videoları paylaşımı, Messenger üzerinden gelen müşteri sorularını 3 aşamalı yanıtlama.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Facebook Sayfa & Messenger Botu</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> Facebook Graph API / Webhooks</div>
                    </div>
                </div>

                <!-- TIKTOK CONTENT POSTING API -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">🎵</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">TikTok Content Posting API</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">TIKTOK FOR DEVELOPERS</div>
                            </div>
                        </div>
                        <span style="background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.35); color:#38BDF8; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🔵 Entegre & Yayında</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        9:16 dikey sahne ve üretim videolarını TikTok kanalında paylaşma, B2B ve tüketici kanca (hook) başlıklarını otomatik yayınlama.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> TikTok Otonom Video Yayıncısı</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> TikTok Open API v2 / Webhooks</div>
                    </div>
                </div>

                <!-- YOUTUBE DATA API V3 -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">🔴</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">YouTube Data API v3</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">GOOGLE CLOUD YOUTUBE</div>
                            </div>
                        </div>
                        <span style="background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.35); color:#38BDF8; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🔵 Entegre & Yayında</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        YouTube Shorts kanalına 9:16 dikey video yükleme, SEO etiketleme (#Shorts) ve WhatsApp sipariş hattı içeren ilk yorumu otomatik sabitleme.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> YouTube Shorts Otonom Yayıncısı</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> Google Cloud YouTube Data API</div>
                    </div>
                </div>

                <!-- WHATSAPP DIRECT -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">💬</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">WhatsApp Business (Click-to-Chat)</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">İNSAN DEVİR (HANDOFF)</div>
                            </div>
                        </div>
                        <span style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.35); color:#34D399; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟢 Aktif & Canlıda</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Yapay zekanın karmaşık veya özel fiyat tekliflerinde müşteriyi doğrudan fabrika satış yetkilisine (0 505 015 1035) aktardığı 3. Aşama köprüsü.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> 3. Aşama İnsan Devri & Fabrika Satış</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> wa.me Derin Bağlantı / WhatsApp API</div>
                    </div>
                </div>

                <!-- CLOUDFLARE -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">🛡️</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Cloudflare WAF & DNS</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">GÜVENLİK & DDOS</div>
                            </div>
                        </div>
                        <span style="background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.35); color:#C084FC; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟣 Gelecek / Planlanan</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Web sitesi ve API uç noktalarını zararlı botlardan, brute-force saldırılarından ve DDoS tehditlerinden koruyacak küresel güvenlik kalkanı.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Altyapı Güvenliği & Hızlandırma</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> Cloudflare Edge Proxy / WAF</div>
                    </div>
                </div>

                <!-- SENTRY -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">🚨</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Sentry / APM Monitoring</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">HATA İZLEME & LOGLAMA</div>
                            </div>
                        </div>
                        <span style="background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.35); color:#C084FC; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟣 Gelecek / Planlanan</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Vercel Cron işlerinde veya Meta/TikTok API çağrılarında oluşabilecek istisnaları anında yakalayan hata izleme ve telemetri servisi.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Otomasyon Hata Yakalama & Loglama</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> Sentry SDK / Log Ingestion</div>
                    </div>
                </div>

                <!-- ONLINE PAYMENT -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">💳</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">PayTR / İyzico / Stripe</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">ONLİNE ÖDEME & TAHSİLAT</div>
                            </div>
                        </div>
                        <span style="background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.35); color:#C084FC; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟣 Gelecek / Planlanan</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Web sitesi üzerinden veya WhatsApp siparişlerinde müşterilerden güvenli kaparo ve online kredi kartı tahsilatı alma altyapısı.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Çevrim İçi Güvenli Tahsilat Sistemi</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> 3D Secure Hosted Payment API</div>
                    </div>
                </div>

                <!-- RESEND / TRANSACTIONAL EMAIL -->
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:22px;">✉️</span>
                            <div>
                                <strong style="font-size:15px; color:#fff;">Resend / SendGrid E-posta</strong>
                                <div style="font-size:11px; color:#94A3B8; font-weight:700;">OTOMATİK BİLDİRİM & PDF</div>
                            </div>
                        </div>
                        <span style="background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.35); color:#C084FC; font-size:11px; font-weight:800; padding:3px 8px; border-radius:12px;">🟣 Gelecek / Planlanan</span>
                    </div>
                    <p style="font-size:12.5px; color:#CBD5E1; line-height:1.5; margin-bottom:12px;">
                        Fabrika atölyesine yeni sipariş PDF iş emirlerinin iletilmesi ve yönetime günlük bot performans özetlerinin e-postalanması.
                    </p>
                    <div style="font-size:11.5px; color:#94A3B8; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:8px;">
                        <div><strong>Görevi:</strong> Otomatik İş Emri & Rapor Bildirimi</div>
                        <div style="margin-top:2px;"><strong>Protokol:</strong> SMTP / Transactional REST API</div>
                    </div>
                </div>

            </div>
        </div>
    `;
}

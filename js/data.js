// Global Mobilya — Mock Data Store
// Realistic corporate sample data for furniture manufacturing enterprise prototype

export const mockData = {
    company: {
        name: "Global Mobilya A.Ş.",
        platformVersion: "v0.1.0-alpha",
        environment: "Vercel Edge / Prototip",
        lastSync: "26 Ekim 2026, 16:30"
    },

    // Role-based access control matrix
    roles: [
        {
            id: "admin",
            name: "Sistem Yöneticisi",
            badge: "Admin",
            description: "Tam yetkili platform ve altyapı yöneticisi",
            modules: ["all"],
            canEdit: true
        },
        {
            id: "management",
            name: "Şirket Yönetimi",
            badge: "Yönetici",
            description: "Genel durum, finans, KPI ve performans analitiği görünümü",
            modules: ["dashboard", "analytics", "crm", "production", "website"],
            canEdit: false
        },
        {
            id: "sales",
            name: "Satış & Pazarlama",
            badge: "Satış",
            description: "Müşteri ilişkileri, potansiyel talepler ve sosyal medya bot takibi",
            modules: ["dashboard", "website", "social", "crm", "analytics"],
            canEdit: true
        },
        {
            id: "production",
            name: "Üretim & Fabrika Sorumlusu",
            badge: "Üretim",
            description: "İş emirleri, CNC kesim aşamaları ve atölye iş akışı",
            modules: ["dashboard", "production", "analytics"],
            canEdit: true
        },
        {
            id: "infrastructure",
            name: "Altyapı Operatörü",
            badge: "DevOps",
            description: "Bulut servisleri, sunucu sağlığı, alan adları ve API entegrasyonları",
            modules: ["dashboard", "operations", "analytics"],
            canEdit: true
        }
    ],

    // Global Metrics for Header & Dashboard
    globalMetrics: {
        activeWorkOrders: 42,
        delayedOrders: 3,
        cncEfficiency: "%94.2",
        monthlyRevenue: "₺4,850,000",
        activeLeads: 87,
        websiteVisitorsToday: "14,250",
        botAutoReplyRate: "%98.6",
        infrastructureHealth: "%99.98"
    },

    // Notifications
    notifications: [
        {
            id: 1,
            type: "warning",
            title: "CNC-03 Bakım Uyarısı",
            message: "Kenar bantlama ve delik delme ünitesi periyodik bakım saati doldu.",
            time: "15 dk önce",
            read: false
        },
        {
            id: 2,
            type: "success",
            title: "Yeni Kurumsal Teklif Onayı",
            message: "Artemis Mimarlık 120 adet toplantı masası için sözleşmeyi onayladı.",
            time: "1 saat önce",
            read: false
        },
        {
            id: 3,
            type: "info",
            title: "Instagram Bot Senkronizasyonu",
            message: "Yeni katalog gönderisi yayın kuyruğuna alındı ve onaylandı.",
            time: "3 saat önce",
            read: true
        },
        {
            id: 4,
            type: "warning",
            title: "Hammadde Tedarik Gecikmesi",
            message: "Meşe masif kereste tedarikçisi teslimat tarihini 2 gün erteledi.",
            time: "Dün",
            read: true
        }
    ],

    // Module 1: Website Management Data
    website: {
        status: {
            domain: "globalmobilya.com.tr",
            sslStatus: "Aktif (Let's Encrypt Wildcard)",
            lastPublished: "26.10.2026, 14:15",
            pageCount: 18,
            activeCatalogItems: 64,
            blogArticles: 12,
            pendingForms: 7,
            seoHealthScore: "94 / 100"
        },
        pages: [
            { id: "p1", title: "Ana Sayfa", path: "/", status: "Yayında", lastEdit: "24.10.2026", seoScore: 96 },
            { id: "p2", title: "Koleksiyonlar (Katalog)", path: "/katalog", status: "Yayında", lastEdit: "26.10.2026", seoScore: 92 },
            { id: "p3", title: "Kurumsal & Fabrikamız", path: "/hakkimizda", status: "Yayında", lastEdit: "18.10.2026", seoScore: 90 },
            { id: "p4", title: "Mimari Projeler & B2B", path: "/b2b-projeler", status: "Yayında", lastEdit: "22.10.2026", seoScore: 95 },
            { id: "p5", title: "Blog & Trendler", path: "/blog", status: "Yayında", lastEdit: "25.10.2026", seoScore: 89 },
            { id: "p6", title: "İletişim & Bayiler", path: "/iletisim", status: "Yayında", lastEdit: "12.10.2026", seoScore: 98 }
        ],
        products: [
            { id: "PRD-101", sku: "GM-TBL-04", name: "Valeria Masif Meşe Yemek Masası", category: "Yemek Odası", price: "₺34,500", material: "Masif Meşe & Metal Ayak", stock: 14, status: "Stokta", featured: true },
            { id: "PRD-102", sku: "GM-CHR-09", name: "Nuvola Bukle Koltuk Takımı", category: "Salon", price: "₺58,000", material: "Fırınlanmış Gürgen & İthal Bukle", stock: 6, status: "Stokta", featured: true },
            { id: "PRD-103", sku: "GM-DSK-02", name: "Executive Ceviz Yönetici Masası", category: "Ofis", price: "₺46,000", material: "Amerikan Ceviz Kaplama", stock: 8, status: "Stokta", featured: false },
            { id: "PRD-104", sku: "GM-BED-07", name: "Aura Kumaş Başlıklı Baza & Yatak Odası", category: "Yatak Odası", price: "₺52,000", material: "Doğal Meşe & Nubuk", stock: 4, status: "Kritik Stok", featured: true },
            { id: "PRD-105", sku: "GM-TV-01", name: "Sotto Akustik Çıtalı TV Konsolu", category: "Salon", price: "₺28,900", material: "Doğal Meşe Çıta & Lake Gövde", stock: 12, status: "Stokta", featured: false },
            { id: "PRD-106", sku: "GM-COF-11", name: "Traverten & Meşe Sehpa Seti", category: "Tamamlayıcı", price: "₺18,500", material: "Doğal Traverten Taş & Meşe", stock: 2, status: "Kritik Stok", featured: false }
        ],
        categories: [
            { id: "cat-1", name: "Salon Koleksiyonu", count: 24, slug: "salon" },
            { id: "cat-2", name: "Yemek Odası", count: 18, slug: "yemek-odasi" },
            { id: "cat-3", name: "Yatak Odası", count: 12, slug: "yatak-odasi" },
            { id: "cat-4", name: "Ofis & Çalışma", count: 15, slug: "ofis" },
            { id: "cat-5", name: "Özel Mimari Üretim", count: 8, slug: "b2b-mimari" }
        ],
        inquiries: [
            { id: "INQ-201", name: "Mimar Selin Aksoy", email: "selin@aksoymimarlik.com", phone: "+90 532 410 ****", subject: "Otel Projesi İçin Özel Ölçülü Konsollar", date: "Bugün 14:20", status: "Yeni" },
            { id: "INQ-202", name: "Burak Taşdelen", email: "b.tasdelen@gmail.com", phone: "+90 544 219 ****", subject: "Valeria Masa Ceviz Seçeneği Var Mı?", date: "Bugün 11:05", status: "İncelendi" },
            { id: "INQ-203", name: "Ece Danışman", email: "ece@danismangrup.com", phone: "+90 533 881 ****", subject: "Genel Müdürlük Yönetici Mobilyaları Fiyat Teklifi", date: "Dün 16:45", status: "Cevaplandı" }
        ]
    },

    // Module 2: Social Media Bot Data
    social: {
        accounts: [
            { id: "ig", platform: "Instagram", handle: "@globalmobilya_tr", followers: "148,500", status: "Online", botStatus: "Otomatik DM & Hikaye Aktif", postsScheduled: 4, ping: "24 ms" },
            { id: "fb", platform: "Facebook", handle: "Global Mobilya Kurumsal", followers: "42,300", status: "Online", botStatus: "Katalog Senkronize", postsScheduled: 2, ping: "38 ms" },
            { id: "tk", platform: "TikTok", handle: "@globalmobilya", followers: "89,200", status: "Online", botStatus: "Trend Video Kuyruğu", postsScheduled: 3, ping: "45 ms" },
            { id: "yt", platform: "YouTube", handle: "Global Mobilya Tasarım & Fabrika", followers: "26,100", status: "Online", botStatus: "Üretim Vlog Takvimi", postsScheduled: 1, ping: "31 ms" }
        ],
        scheduledQueue: [
            { id: "SCH-01", title: "Valeria Masif Masa Üretim Arkası (Reels/Shorts)", platform: "Instagram, TikTok", date: "27.10.2026 19:30", status: "Onaylandı" },
            { id: "SCH-02", title: "Minimalist İskandinav Salon Dekorasyon İpuçları", platform: "Instagram, Facebook", date: "28.10.2026 12:00", status: "Kuyrukta" },
            { id: "SCH-03", title: "Fabrikamızda 5 Eksen CNC Ahşap Oyma Süreci", platform: "YouTube, LinkedIn", date: "29.10.2026 18:00", status: "Taslak" },
            { id: "SCH-04", title: "Hafta Sonu Showroom Ziyaret Daveti", platform: "Instagram Stories", date: "31.10.2026 10:00", status: "Planlandı" }
        ],
        recentComments: [
            { id: "c1", user: "@ayse_dekor", platform: "Instagram", comment: "Nuvola koltuğun kumaş renk kartelasını görebilir miyiz?", time: "18 dk önce", botReply: "Gönderildi (DM Otomasyonu)" },
            { id: "c2", user: "@studio.mimarlik", platform: "Instagram", comment: "Toplu siparişlerde mimari indirim oranı nedir?", time: "42 dk önce", botReply: "CRM Lead Oluşturuldu (#LEAD-489)" },
            { id: "c3", user: "@kerem_y", platform: "TikTok", comment: "Masanın ölçüleri nedir?", time: "2 saat önce", botReply: "Yanıtlandı (220x100 cm)" }
        ],
        botLogs: [
            { time: "16:24:10", level: "info", service: "Instagram Graph Webhook", message: "Gelen direct message yanıtlandı: fiyat listesi iletildi." },
            { time: "15:45:00", level: "success", service: "Media Scheduler", message: "Katalog tanıtım hikayesi otomatik paylaşıldı (Erişim: 3,420)." },
            { time: "14:12:33", level: "warning", service: "Meta Ads Sync", message: "Instagram Lead Form API gecikme süresi 120ms üzerine çıktı." },
            { time: "12:00:00", level: "info", service: "Analytics Harvester", message: "Günlük sosyal etkileşim metrikleri toplandı." }
        ]
    },

    // Module 3: CRM Data
    crm: {
        summary: {
            totalPipelineValue: "₺18,450,000",
            activeOpportunities: 28,
            winRate: "%34.5",
            averageDealSize: "₺215,000"
        },
        pipelineStages: [
            { id: "lead", name: "Yeni Talep", count: 12, value: "₺2,400,000", color: "#3b82f6" },
            { id: "contacted", name: "İletişim Kuruldu", count: 8, value: "₺3,850,000", color: "#8b5cf6" },
            { id: "discovery", name: "Keşif & Projelendirme", count: 5, value: "₺4,600,000", color: "#f59e0b" },
            { id: "proposal", name: "Teklif Sunuldu", count: 4, value: "₺5,200,000", color: "#06b6d4" },
            { id: "won", name: "Sözleşme & Üretimde", count: 7, value: "₺2,400,000", color: "#10b981" }
        ],
        leads: [
            {
                id: "LEAD-489",
                customer: "Studio Modern Mimarlık (Emre Bey)",
                channel: "Instagram DM",
                scope: "Bodrum Butik Otel 24 Oda Başlık & Dolap Üretimi",
                stage: "Keşif & Projelendirme",
                assignedTo: "Ahmet Yılmaz (Kurumsal Satış)",
                value: "₺1,450,000",
                date: "24.10.2026",
                status: "Aktif Fırsat",
                notes: "28 Ekim'de atölye malzeme numuneleri teslim edilecek."
            },
            {
                id: "LEAD-488",
                customer: "Nova Holding A.Ş.",
                channel: "Web İletişim Formu",
                scope: "Merkez Ofis Yönetici Masaları & Toplantı Odası",
                stage: "Teklif Sunuldu",
                assignedTo: "Zeynep Kaya (Proje Satış)",
                value: "₺880,000",
                date: "22.10.2026",
                status: "Karar Bekleniyor",
                notes: "Teklif revizyonu iletildi, yönetim kurulu onayında."
            },
            {
                id: "LEAD-487",
                customer: "Serdar & Melis Çelik",
                channel: "Showroom / Mağaza",
                scope: "Villa Komple Salon & Yemek Odası Takımı",
                stage: "Sözleşme & Üretimde",
                assignedTo: "Mert Demir (Perakende)",
                value: "₺340,000",
                date: "19.10.2026",
                status: "Kazanıldı",
                notes: "Ön ödeme alındı, üretim iş emri (#ORD-1092) oluşturuldu."
            },
            {
                id: "LEAD-486",
                customer: "Kayaalp Restoran Zinciri",
                channel: "Telefon / Referans",
                scope: "60 Adet Masif Masa & 240 Adet Sandalye",
                stage: "İletişim Kuruldu",
                assignedTo: "Ahmet Yılmaz (Kurumsal Satış)",
                value: "₺2,100,000",
                date: "25.10.2026",
                status: "Görüşülüyor",
                notes: "Restoran mimarıyla numune masa için randevulaşıldı."
            },
            {
                id: "LEAD-485",
                customer: "Aras Mimarlık Tasarım",
                channel: "LinkedIn Kampanyası",
                scope: "Rezidans Lobi Özel Akustik Panel & Sedir",
                stage: "Yeni Talep",
                assignedTo: "Zeynep Kaya (Proje Satış)",
                value: "₺520,000",
                date: "Bugün 09:30",
                status: "Yeni Talep",
                notes: "Şartname PDF dosyası inceleniyor."
            }
        ]
    },

    // Module 4: Production Data
    production: {
        summary: {
            activeOrders: 42,
            ordersOnSchedule: 39,
            ordersDelayed: 3,
            cncCapacityUtilization: "%94.2",
            weeklyCompletedUnits: 148
        },
        cncUnits: [
            {
                id: "CNC-01",
                name: "Homag 5-Eksen Ahşap İşleme Merkezi",
                status: "Çalışıyor",
                load: "%92",
                currentJob: "ORD-1092 (Valeria Masa Ayak Frezeleme)",
                operator: "Kemal Usta (Kıdemli Operatör)",
                maintenanceDue: "180 saat sonra"
            },
            {
                id: "CNC-02",
                name: "Biesse Selco Otomatik Panel Ebatlama",
                status: "Çalışıyor",
                load: "%88",
                currentJob: "ORD-1089 (Gövde MDF Kesim)",
                operator: "Ali Can",
                maintenanceDue: "95 saat sonra"
            },
            {
                id: "CNC-03",
                name: "Brandt Kenar Bantlama & Delik Delme",
                status: "Bakımda / Hazırlık",
                load: "%40",
                currentJob: "Bıçak Değişimi & Kalibrasyon",
                operator: "Teknik Servis Ekibi",
                maintenanceDue: "Bakım Sürüyor (Tahmini 45 dk)"
            }
        ],
        workOrders: [
            {
                id: "ORD-1092",
                customer: "Serdar & Melis Çelik",
                item: "Valeria Masif Yemek Masası (240x100)",
                quantity: "1 Adet",
                stage: "CNC İşlemi",
                stageIndex: 2, // 1: Kesim, 2: CNC, 3: Zımpara/Cila, 4: Döşeme, 5: Montaj, 6: Kalite
                team: "Ahşap Masif Atölyesi (Takım A)",
                startDate: "24.10.2026",
                targetDate: "02.11.2026",
                progress: 45,
                status: "İşlemde",
                bottleneck: null
            },
            {
                id: "ORD-1089",
                customer: "Nova Holding A.Ş.",
                item: "Executive Ceviz Yönetici Masası",
                quantity: "4 Adet",
                stage: "Zımpara & Cila",
                stageIndex: 3,
                team: "Cila & Yüzey İşlem Atölyesi",
                startDate: "20.10.2026",
                targetDate: "29.10.2026",
                progress: 70,
                status: "İşlemde",
                bottleneck: null
            },
            {
                id: "ORD-1085",
                customer: "Artemis Mimarlık",
                item: "Nuvola Özel Kumaş Koltuk",
                quantity: "12 Adet",
                stage: "Döşeme & Kaplama",
                stageIndex: 4,
                team: "Döşemehane (Takım C)",
                startDate: "16.10.2026",
                targetDate: "27.10.2026",
                progress: 85,
                status: "Gecikme Riski",
                bottleneck: "İthal bukle kumaş gümrük gecikmesi (Çözüldü)"
            },
            {
                id: "ORD-1078",
                customer: "Boutique Hotel Alaçatı",
                item: "Akustik Başlıklı Baza & Komodin",
                quantity: "18 Takım",
                stage: "Kalite Kontrol & Paketleme",
                stageIndex: 6,
                team: "Sevkiyat & Kalite Ekibi",
                startDate: "10.10.2026",
                targetDate: "28.10.2026",
                progress: 95,
                status: "Tamamlanmak Üzere",
                bottleneck: null
            },
            {
                id: "ORD-1075",
                customer: "Kayaalp Restoran",
                item: "Doğal Meşe Restoran Masaları",
                quantity: "30 Adet",
                stage: "Kurutma & Fırınlama",
                stageIndex: 1,
                team: "Hammadde Hazırlık",
                startDate: "25.10.2026",
                targetDate: "10.11.2026",
                progress: 15,
                status: "Beklemede",
                bottleneck: null
            }
        ]
    },

    // Module 5: Operations & Infrastructure Data
    operations: {
        services: [
            { name: "Vercel Global Edge Network", type: "Web & Frontend Hosting", status: "Operational", region: "Frankfurt (fra1)", uptime: "99.99%", latency: "24 ms" },
            { name: "AWS S3 Asset Bucket", type: "Media & Product Photos", status: "Operational", region: "eu-central-1", uptime: "100%", latency: "35 ms" },
            { name: "Cloudflare DNS & WAF", type: "Security & DDoS Protection", status: "Operational", region: "Global Edge", uptime: "100%", latency: "12 ms" },
            { name: "PostgreSQL Production DB", type: "Database Cluster", status: "Operational", region: "Frankfurt Primary", uptime: "99.98%", latency: "18 ms" },
            { name: "Redis Cache Cluster", type: "Memory Cache & Session", status: "Operational", region: "Frankfurt Replica", uptime: "99.99%", latency: "4 ms" },
            { name: "Meta Graph API Connector", type: "Instagram / Social Sync", status: "Degraded Performance", region: "External API", uptime: "98.40%", latency: "180 ms" }
        ],
        domains: [
            { domain: "globalmobilya.com.tr", registrar: "METU Nic / Trabis", sslStatus: "Geçerli (SSL/TLS v1.3)", expires: "14 Mart 2028 (504 gün)", autoRenew: true },
            { domain: "b2b.globalmobilya.com.tr", registrar: "METU Nic / Trabis", sslStatus: "Geçerli", expires: "14 Mart 2028", autoRenew: true },
            { domain: "cdn.globalmobilya.com.tr", registrar: "Cloudflare DNS", sslStatus: "Geçerli", expires: "Otomatik Yenileme", autoRenew: true }
        ],
        integrations: [
            { name: "Instagram Graph API v19.0", category: "Sosyal Medya", maskedKey: "EAAB••••••••••••7x9K", status: "Bağlı", rateLimit: "1,420 / 4,800 saatlik" },
            { name: "Nebim V3 ERP Entegrasyonu", category: "Fabrika & Stok", maskedKey: "nebim_live_••••••••33b1", status: "Senkronize", rateLimit: "Canlı Veri Soketi" },
            { name: "IYS (İleti Yönetim Sistemi)", category: "Mevzuat & SMS/Mail", maskedKey: "iys_api_••••••••881f", status: "Bağlı", rateLimit: "Sınırsız" },
            { name: "S3 Storage Cloud Backup", category: "Yedekleme", maskedKey: "AKIA••••••••••••4N2A", status: "Aktif", rateLimit: "1.4 TB / 5 TB Kullanım" }
        ],
        costs: {
            monthlyEstimated: "₺42,850",
            breakdown: [
                { service: "AWS Cloud & Storage (S3 / DB)", amount: "₺18,500 / ay" },
                { service: "Nebim ERP Özel Entegrasyon Sunucusu", amount: "₺12,400 / ay" },
                { service: "Vercel Pro & Edge Deployment", amount: "₺3,200 / ay" },
                { service: "Cloudflare Enterprise WAF", amount: "₺4,800 / ay" },
                { service: "Meta API & İletişim SMS Servisleri", amount: "₺3,950 / ay" }
            ]
        },
        auditLogs: [
            { time: "26.10.2026 15:45", user: "devops@globalmobilya.com.tr", action: "SSL Sertifikası Otomatik Yenilendi", ip: "10.0.4.12", status: "Başarılı" },
            { time: "26.10.2026 14:10", user: "admin@globalmobilya.com.tr", action: "Üretim ERP Webhook Parametreleri Güncellendi", ip: "192.168.1.45", status: "Başarılı" },
            { time: "26.10.2026 09:00", user: "system_cron", action: "Günlük Otomatik Yedekleme (S3 Snapshot)", ip: "internal", status: "Başarılı" },
            { time: "25.10.2026 23:30", user: "security_monitor", action: "Cloudflare WAF 14 şüpheli bot isteğini engelledi", ip: "Edge WAF", status: "Bilgi" }
        ]
    },

    // Module 6: Performance Analytics Data
    analytics: {
        dateRanges: ["Son 7 Gün", "Son 30 Gün", "Bu Çeyrek (Q4)", "Bu Yıl (2026)"],
        kpis: [
            { title: "Toplam Satış Hacmi", value: "₺14,850,000", change: "+18.4%", positive: true, period: "Geçen aya göre" },
            { title: "Teklif Dönüşüm Oranı", value: "%34.2", change: "+4.1%", positive: true, period: "Hedef: %30" },
            { title: "Zamanında Teslimat", value: "%92.8", change: "-1.2%", positive: false, period: "CNC bakım etkisi" },
            { title: "Web & Sosyal Ziyaret", value: "482,000", change: "+26.5%", positive: true, period: "Katalog lansmanı" }
        ],
        monthlySalesChart: [
            { month: "Mayıs", sales: 8.4, target: 8.0 },
            { month: "Haziran", sales: 9.8, target: 9.0 },
            { month: "Temmuz", sales: 11.2, target: 10.0 },
            { month: "Ağustos", sales: 10.5, target: 10.0 },
            { month: "Eylül", sales: 13.6, target: 12.0 },
            { month: "Ekim", sales: 14.8, target: 13.0 }
        ],
        channelBreakdown: [
            { channel: "Mimari B2B & Projeler", percentage: 48, revenue: "₺7,128,000" },
            { channel: "Web Sitesi Online Katalog", percentage: 26, revenue: "₺3,861,000" },
            { channel: "Instagram & Sosyal Medya", percentage: 16, revenue: "₺2,376,000" },
            { channel: "Showroom & Doğrudan Satış", percentage: 10, revenue: "₺1,485,000" }
        ]
    }
};

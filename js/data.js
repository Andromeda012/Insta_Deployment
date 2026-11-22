// Global Kapak Mobilya — Temiz Uygulama Yapılandırma Deposu
// Not: Tüm operasyonel, CRM, analitik ve altyapı verileri canlı Supabase / PostHog / Sentry / Clerk API'lerinden okunur.
// Hiçbir modülde sahte/örnek istatistik barındırılmaz.

export const mockData = {
    company: {
        name: "Global Kapak Mobilya",
        platformVersion: "v2.0-production",
        environment: "Vercel Edge + Clerk + Supabase + Cloudflare R2",
        lastSync: new Date().toISOString()
    },

    roles: [
        { id: "admin", name: "Sistem & Kurum Yöneticisi", badge: "admin", description: "Tam yetkili platform yöneticisi", modules: ["all"], canEdit: true },
        { id: "factory", name: "Fabrika & Üretim Planlama", badge: "factory", description: "MRP, stok ve 3D teknik çizim", modules: ["production", "products", "studio"], canEdit: true },
        { id: "sales", name: "CRM, Satış & Teklif", badge: "sales", description: "CRM müşterileri, teklifler ve katalog", modules: ["crm", "products"], canEdit: true },
        { id: "social_media", name: "Sosyal Medya & İçerik", badge: "social_media", description: "Web içerik, 4 bot ve medya stüdyosu", modules: ["website", "social", "studio"], canEdit: true },
        { id: "viewer", name: "Salt Okunur Denetçi", badge: "viewer", description: "Tüm panellerde salt okunur erişim", modules: ["all"], canEdit: false }
    ],

    globalMetrics: {
        activeWorkOrders: 0,
        delayedOrders: 0,
        cncEfficiency: "0%",
        monthlyRevenue: "₺0",
        activeLeads: 0,
        websiteVisitorsToday: "0",
        botAutoReplyRate: "0%",
        infrastructureHealth: "Canlı Kontrol"
    },

    notifications: [],

    crm: {
        summary: {
            totalPipelineValue: "₺0",
            winRate: "%0",
            averageDealSize: "₺0"
        },
        pipelineStages: [],
        leads: []
    },

    analytics: {
        kpis: [],
        monthlySalesChart: [],
        channelBreakdown: []
    }
};

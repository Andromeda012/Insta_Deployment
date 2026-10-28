/**
 * VERCEL SERVERLESS ENDPOINT: /api/tiktok-render
 * ============================================================================
 * Sıfır fotoğraf/video girişiyle (Zero-Input Autonomous Design) bulutta
 * 1080x1920 (9:16 Dikey) TikTok sahnesi (SVG/Görsel Kart) üretir ve
 * Supabase Storage ('media/tiktok/') içerisine kaydedip herkese açık URL döndürür.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nyvctdskhAbImlvgbnhx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

function escapeXml(unsafe = '') {
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildAutonomousTikTokSvg({
    format = 'TIKTOK_ASMR_CNC',
    sku = 'GKM-104',
    title = 'Royal CNC Membran Kapak',
    category = 'CNC Membran Kapak',
    colors = 'Mat Antrasit • Kaşmir • İpek Beyaz • Doğal Meşe',
    hookText = 'POV: 5 İş Gününde Mutfak Kapaklarınız Fabrikamızda Nasıl Üretiliyor?'
}) {
    const themes = {
        TIKTOK_ASMR_CNC: {
            bgStart: '#09090b',
            bgMid: '#18181b',
            bgEnd: '#0f172a',
            accentCyan: '#00f2fe',
            accentPink: '#ff0050',
            badge: '🔊 FABRİKA ASMR • CNC & VAKUM PRES',
            subBadge: '0.35mm İthal PVC Membran • 18mm 1. Sınıf MDF'
        },
        TIKTOK_PHOTO_CAROUSEL: {
            bgStart: '#0f172a',
            bgMid: '#1e1b4b',
            bgEnd: '#09090b',
            accentCyan: '#38bdf8',
            accentPink: '#f43f5e',
            badge: '📸 TIKTOK PHOTO MODE • RENK KARTELASI',
            subBadge: '50+ Mat, Parlak & Doğal Ahşap Membran Renk Seçeneği'
        },
        TIKTOK_POV_RENOVATION: {
            bgStart: '#052e16',
            bgMid: '#0f172a',
            bgEnd: '#09090b',
            accentCyan: '#34d399',
            accentPink: '#ff0050',
            badge: '🔄 POV: KIRMADAN SADECE KAPAK DEĞİŞİMİ',
            subBadge: 'Eski Gövdeye Milimetrik Özel Ölçü CNC Kapak Uygulaması'
        },
        TIKTOK_B2B_DEALER: {
            bgStart: '#1e1b4b',
            bgMid: '#0f172a',
            bgEnd: '#09090b',
            accentCyan: '#f59e0b',
            accentPink: '#00f2fe',
            badge: '🏭 MİMAR & MARANGOZ TOPTAN FABRİKA HATTI',
            subBadge: 'Bağcılar Fabrikadan 81 İle 5 İş Gününde Seri Sevkiyat'
        }
    };

    const t = themes[format] || themes.TIKTOK_ASMR_CNC;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
    <defs>
        <linearGradient id="ttBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${t.bgStart}"/>
            <stop offset="50%" stop-color="${t.bgMid}"/>
            <stop offset="100%" stop-color="${t.bgEnd}"/>
        </linearGradient>
        <linearGradient id="ttNeon" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${t.accentCyan}"/>
            <stop offset="100%" stop-color="${t.accentPink}"/>
        </linearGradient>
        <linearGradient id="doorSurface" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#334155"/>
            <stop offset="50%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
    </defs>

    <!-- 9:16 Dikey Arka Plan -->
    <rect width="1080" height="1920" fill="url(#ttBg)"/>

    <!-- TikTok Neon Çift Renk Işık Efektleri -->
    <circle cx="180" cy="300" r="280" fill="${t.accentCyan}" opacity="0.12"/>
    <circle cx="900" cy="1450" r="340" fill="${t.accentPink}" opacity="0.14"/>

    <!-- Üst Marka & TikTok Doğrulanmış Hesap Başlığı -->
    <rect x="65" y="95" width="950" height="90" rx="45" fill="#000000" opacity="0.55" stroke="url(#ttNeon)" stroke-width="2"/>
    <text x="115" y="152" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800" fill="#ffffff">🎵 @globalkapak • GLOBAL KAPAK MOBİLYA</text>
    <rect x="815" y="115" width="175" height="50" rx="25" fill="${t.accentPink}"/>
    <text x="902" y="148" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="#ffffff">#KEŞFET</text>

    <!-- İlk 2 Saniye Viral Hook (Kanca Başlık) Kutusu -->
    <rect x="65" y="220" width="950" height="195" rx="28" fill="#ffffff"/>
    <rect x="65" y="220" width="950" height="18" rx="9" fill="url(#ttNeon)"/>
    <text x="540" y="295" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="900" fill="#09090b">${escapeXml(hookText.slice(0, 44))}</text>
    <text x="540" y="352" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="#e11d48">${escapeXml(hookText.slice(44, 92) || `${sku} • ${title}`)}</text>

    <!-- Format Rozeti -->
    <rect x="140" y="450" width="800" height="64" rx="32" fill="#18181b" stroke="${t.accentCyan}" stroke-width="2"/>
    <text x="540" y="492" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" fill="${t.accentCyan}">${escapeXml(t.badge)}</text>

    <!-- Merkez 3D CNC Membran Kapak Teknik Sahnesi -->
    <rect x="180" y="555" width="720" height="720" rx="34" fill="url(#doorSurface)" stroke="url(#ttNeon)" stroke-width="5"/>
    <!-- CNC Dış Bıçak Kanalı -->
    <rect x="245" y="620" width="590" height="590" rx="20" fill="none" stroke="${t.accentCyan}" stroke-width="4" opacity="0.85"/>
    <!-- CNC İç Çerçeve & Göbek -->
    <rect x="295" y="670" width="490" height="490" rx="14" fill="#0f172a" opacity="0.65" stroke="#94a3b8" stroke-width="2"/>
    <!-- Kapak Kulp Detayı -->
    <rect x="795" y="855" width="18" height="130" rx="9" fill="${t.accentCyan}"/>

    <!-- Merkez Ürün Model & SKU Bilgisi -->
    <text x="540" y="835" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="800" fill="${t.accentCyan}" letter-spacing="3">${escapeXml(category.toUpperCase())}</text>
    <text x="540" y="915" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="60" font-weight="900" fill="#ffffff">${escapeXml(sku)}</text>
    <text x="540" y="980" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="700" fill="#f8fafc">${escapeXml(title.slice(0, 28))}</text>
    <text x="540" y="1055" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600" fill="#cbd5e1">${escapeXml(t.subBadge)}</text>

    <!-- 4'lü Renk Kartelası Şeridi (Photo Mode & Kartela Vurgusu) -->
    <g transform="translate(180, 1110)">
        <rect x="30" y="0" width="145" height="65" rx="12" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
        <text x="102" y="40" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">Antrasit</text>

        <rect x="200" y="0" width="145" height="65" rx="12" fill="#d6d3d1" stroke="#ffffff" stroke-width="2"/>
        <text x="272" y="40" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#09090b">Kaşmir</text>

        <rect x="370" y="0" width="145" height="65" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
        <text x="442" y="40" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#09090b">İpek Beyaz</text>

        <rect x="540" y="0" width="145" height="65" rx="12" fill="#92400e" stroke="#fbbf24" stroke-width="2"/>
        <text x="612" y="40" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">Doğal Meşe</text>
    </g>

    <!-- Fabrika SLA Avantaj Rozetleri -->
    <rect x="65" y="1325" width="460" height="110" rx="22" fill="#18181b" stroke="${t.accentCyan}" stroke-width="2"/>
    <text x="295" y="1375" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800" fill="#ffffff">🚚 5 İŞ GÜNÜNDE</text>
    <text x="295" y="1413" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="${t.accentCyan}">FABRİKADAN SEVKİYAT</text>

    <rect x="555" y="1325" width="460" height="110" rx="22" fill="#18181b" stroke="${t.accentPink}" stroke-width="2"/>
    <text x="785" y="1375" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800" fill="#ffffff">🛡️ 5 YIL FABRİKA</text>
    <text x="785" y="1413" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="${t.accentPink}">GARANTİLİ ÜRETİM</text>

    <!-- Renk Seçenekleri Satırı -->
    <text x="540" y="1505" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#e2e8f0">🎨 Renkler: ${escapeXml(colors.slice(0, 56))}</text>

    <!-- Alt WhatsApp & Sabit Yorum CTA Kutusu -->
    <rect x="65" y="1560" width="950" height="230" rx="32" fill="url(#ttNeon)"/>
    <rect x="73" y="1568" width="934" height="214" rx="28" fill="#09090b"/>
    <text x="540" y="1635" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800" fill="${t.accentCyan}">📐 ÖZEL ÖLÇÜ &amp; TOPTAN FİYAT HATTI</text>
    <text x="540" y="1698" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="48" font-weight="900" fill="#ffffff">📲 WhatsApp: 0 (505) 015 1035</text>
    <text x="540" y="1752" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="#cbd5e1">📍 Bağcılar / İstanbul • Sabitlenen Yoruma Tıklayın 👇</text>
</svg>`;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});
        const format = params.format || 'TIKTOK_ASMR_CNC';
        const sku = params.sku || 'GKM-104';
        const title = params.title || 'Royal CNC Membran Kapak';
        const category = params.category || 'CNC Membran Kapak';
        const colors = params.colors || 'Mat Antrasit, Kaşmir, İpek Beyaz, Doğal Meşe';
        const hookText = params.hookText || 'POV: 5 İş Gününde Mutfak Kapaklarınız Fabrikamızda Nasıl Üretiliyor?';

        const svgContent = buildAutonomousTikTokSvg({
            format,
            sku,
            title,
            category,
            colors,
            hookText
        });

        // GET isteğinde doğrudan SVG görselini döndür
        if (req.method === 'GET' && params.raw === '1') {
            res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
            return res.status(200).send(svgContent);
        }

        const fileName = `tiktok_${format.toLowerCase()}_${sku.toLowerCase()}_${Date.now()}.svg`;
        const storagePath = `tiktok/${fileName}`;
        let publicMediaUrl = `https://insta-deployment-rho.vercel.app/api/tiktok-render?raw=1&format=${encodeURIComponent(format)}&sku=${encodeURIComponent(sku)}&title=${encodeURIComponent(title)}`;

        // Supabase Storage 'media' bucket içerisine yükle
        if (SUPABASE_KEY) {
            const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${storagePath}`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'image/svg+xml',
                    'x-upsert': 'true'
                },
                body: svgContent
            });

            if (uploadRes.ok) {
                publicMediaUrl = `${SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;
            }
        }

        return res.status(200).json({
            ok: true,
            autonomousZeroInput: true,
            format,
            dimensions: '1080x1920 (9:16 Dikey TikTok)',
            storagePath: `media/${storagePath}`,
            mediaUrl: publicMediaUrl
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
};

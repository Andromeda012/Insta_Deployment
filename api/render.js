// ============================================================================
// Nova Furniture (@thenovafurniture) — Unified Autonomous Multi-Platform Render API
// Endpoint: /api/render?platform=[instagram|facebook|tiktok|youtube]
// Vercel Hobby Planında 12 Serverless Function limitine takılmamak için
// tüm görsel render işlemleri bu tek modüler endpoint üzerinde birleştirilmiştir.
// ============================================================================

import {
  AUTONOMOUS_DESIGN_THEMES as IG_THEMES,
  renderAutonomousSvgCard as renderIgSvg
} from '../Module 2/Instagram/bot-engine.js';

import {
  FB_AUTONOMOUS_THEMES,
  renderAutonomousFacebookSvg
} from '../Module 2/Facebook/bot-engine.js';

import {
  YT_AUTONOMOUS_THEMES,
  renderAutonomousYouTubeShortsSvg
} from '../Module 2/Youtube Shorts/bot-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';

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
    <rect width="1080" height="1920" fill="url(#ttBg)"/>
    <circle cx="180" cy="300" r="280" fill="${t.accentCyan}" opacity="0.12"/>
    <circle cx="900" cy="1450" r="340" fill="${t.accentPink}" opacity="0.14"/>
    <rect x="65" y="95" width="950" height="90" rx="45" fill="#000000" opacity="0.55" stroke="url(#ttNeon)" stroke-width="2"/>
    <text x="115" y="152" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800" fill="#ffffff">🎵 @thenovafurniture • NOVA FURNITURE</text>
    <rect x="815" y="115" width="175" height="50" rx="25" fill="${t.accentPink}"/>
    <text x="902" y="148" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="#ffffff">#KEŞFET</text>
    <rect x="65" y="220" width="950" height="195" rx="28" fill="#ffffff"/>
    <rect x="65" y="220" width="950" height="18" rx="9" fill="url(#ttNeon)"/>
    <text x="540" y="295" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="900" fill="#09090b">${escapeXml(hookText.slice(0, 44))}</text>
    <text x="540" y="352" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="#e11d48">${escapeXml(hookText.slice(44, 92) || `${sku} • ${title}`)}</text>
    <rect x="140" y="450" width="800" height="64" rx="32" fill="#18181b" stroke="${t.accentCyan}" stroke-width="2"/>
    <text x="540" y="492" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" fill="${t.accentCyan}">${escapeXml(t.badge)}</text>
    <rect x="180" y="555" width="720" height="720" rx="34" fill="url(#doorSurface)" stroke="url(#ttNeon)" stroke-width="5"/>
    <rect x="245" y="620" width="590" height="590" rx="20" fill="none" stroke="${t.accentCyan}" stroke-width="4" opacity="0.85"/>
    <rect x="295" y="670" width="490" height="490" rx="14" fill="#0f172a" opacity="0.65" stroke="#94a3b8" stroke-width="2"/>
    <rect x="795" y="855" width="18" height="130" rx="9" fill="${t.accentCyan}"/>
    <text x="540" y="835" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="800" fill="${t.accentCyan}" letter-spacing="3">${escapeXml(category.toUpperCase())}</text>
    <text x="540" y="915" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="60" font-weight="900" fill="#ffffff">${escapeXml(sku)}</text>
    <text x="540" y="980" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="700" fill="#f8fafc">${escapeXml(title.slice(0, 28))}</text>
    <text x="540" y="1055" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600" fill="#cbd5e1">${escapeXml(t.subBadge)}</text>
    <rect x="65" y="1325" width="460" height="110" rx="22" fill="#18181b" stroke="${t.accentCyan}" stroke-width="2"/>
    <text x="295" y="1375" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800" fill="#ffffff">🚚 5 İŞ GÜNÜNDE</text>
    <text x="295" y="1413" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="${t.accentCyan}">FABRİKADAN SEVKİYAT</text>
    <rect x="555" y="1325" width="460" height="110" rx="22" fill="#18181b" stroke="${t.accentPink}" stroke-width="2"/>
    <text x="785" y="1375" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800" fill="#ffffff">🛡️ 5 YIL FABRİKA</text>
    <text x="785" y="1413" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="${t.accentPink}">GARANTİLİ ÜRETİM</text>
    <text x="540" y="1505" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#e2e8f0">🎨 Renkler: ${escapeXml(colors.slice(0, 56))}</text>
    <rect x="65" y="1560" width="950" height="230" rx="32" fill="url(#ttNeon)"/>
    <rect x="73" y="1568" width="934" height="214" rx="28" fill="#09090b"/>
    <text x="540" y="1635" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800" fill="${t.accentCyan}">📐 ÖZEL ÖLÇÜ &amp; TOPTAN FİYAT HATTI</text>
    <text x="540" y="1698" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="48" font-weight="900" fill="#ffffff">📲 WhatsApp: 0 (505) 015 1035</text>
    <text x="540" y="1752" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="#cbd5e1">📍 Fabrikadan 81 İle Hızlı Gönderim • DM veya WhatsApp 👇</text>
</svg>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const platform = (q.platform || req.headers['x-platform'] || '').toLowerCase();

  // 1. FACEBOOK RENDER
  if (platform === 'facebook') {
    const mediaType = (q.type || 'PHOTO_POST').toUpperCase();
    const badge = q.badge || 'NOVA FURNITURE • MİMARİ KOLEKSİYON';
    const headline = q.headline || 'ÖZEL ÖLÇÜ CNC MEMBRAN KAPAK KOLEKSİYONU';
    const subheadline = q.subheadline || '18mm E1 MDF • Suya & Buhara Dayanıklı • 5 İş Gününde Teslim';
    const doorStyle = q.door || 'shaker';
    const theme = FB_AUTONOMOUS_THEMES.find(t => t.id === q.theme) || FB_AUTONOMOUS_THEMES[0];

    const svg = renderAutonomousFacebookSvg({
      mediaType,
      badge,
      headline,
      subheadline,
      specs: ['5 İş Gününde Teslim', '5 Yıl Garanti', 'Toptan & Perakende'],
      doorStyle,
      theme
    });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(svg);
  }

  // 2. YOUTUBE SHORTS RENDER
  if (platform === 'youtube') {
    const format = (q.format || 'SHORTS_CNC').toUpperCase();
    const badge = q.badge || '▶️ YOUTUBE SHORTS • NOVA FURNITURE';
    const headline = q.headline || '0.01 MM HASSASİYETLE CNC KAPAK ÜRETİMİ';
    const subheadline = q.subheadline || '18mm E1 MDF • Suya & Buhara Dayanıklı • 5 İş Gününde Teslim';
    const doorStyle = q.door || 'diagonal';
    const theme = YT_AUTONOMOUS_THEMES.find(t => t.id === q.theme) || YT_AUTONOMOUS_THEMES[0];

    const svg = renderAutonomousYouTubeShortsSvg({
      format,
      badge,
      headline,
      subheadline,
      specs: ['5 İş Gününde Teslim', '5 Yıl Garanti', '0.01mm 5 Eksen CNC'],
      doorStyle,
      theme
    });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(svg);
  }

  // 3. TIKTOK RENDER
  if (platform === 'tiktok') {
    const format = q.format || 'TIKTOK_ASMR_CNC';
    const sku = q.sku || 'GKM-104';
    const title = q.title || 'Royal CNC Membran Kapak';
    const category = q.category || 'CNC Membran Kapak';
    const colors = q.colors || 'Mat Antrasit, Kaşmir, İpek Beyaz, Doğal Meşe';
    const hookText = q.hookText || 'POV: 5 İş Gününde Mutfak Kapaklarınız Fabrikamızda Nasıl Üretiliyor?';

    const svgContent = buildAutonomousTikTokSvg({
      format,
      sku,
      title,
      category,
      colors,
      hookText
    });

    if (req.method === 'GET' && q.raw === '1') {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      return res.status(200).send(svgContent);
    }

    const fileName = `tiktok_${format.toLowerCase()}_${sku.toLowerCase()}_${Date.now()}.svg`;
    const storagePath = `tiktok/${fileName}`;
    let publicMediaUrl = `https://insta-deployment-rho.vercel.app/api/render?platform=tiktok&raw=1&format=${encodeURIComponent(format)}&sku=${encodeURIComponent(sku)}&title=${encodeURIComponent(title)}`;

    if (SUPABASE_KEY) {
      try {
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
      } catch (_) {}
    }

    return res.status(200).json({
      ok: true,
      autonomousZeroInput: true,
      format,
      dimensions: '1080x1920 (9:16 Dikey TikTok)',
      storagePath: `media/${storagePath}`,
      mediaUrl: publicMediaUrl
    });
  }

  // 4. DEFAULT: INSTAGRAM RENDER
  const mediaType = (q.type || 'POST').toUpperCase();
  const badge = q.badge || 'NOVA FURNITURE • MİMARİ SERİ';
  const headline = q.headline || 'ÖZEL ÖLÇÜ CNC MEMBRAN KAPAK';
  const subheadline = q.subheadline || '18mm E1 MDF • Suya & Buhara Dayanıklı • 5 Yıl Garanti';
  const doorStyle = q.door || 'shaker';
  const theme = IG_THEMES.find(t => t.id === q.theme) || IG_THEMES[0];

  const svg = renderIgSvg({
    mediaType,
    badge,
    headline,
    subheadline,
    specs: ['5 İş Gününde Teslim', '5 Yıl Garanti', 'Özel Ölçü CNC'],
    doorStyle,
    theme
  });

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(svg);
}

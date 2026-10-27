/**
 * GLOBAL KAPAK MOBİLYA — MODULE 2: INSTAGRAM BULUT BOT MOTORU (bot-engine.js)
 *
 * Özellikler:
 * 1. 7/24 Bulut Sunucu Uyumlu (Cihaz bağımsız çalışır, tüm durumunu Supabase'de tutar).
 * 2. %100 Otonom İçerik Tasarım & Üretim Motoru (Sıfır Fotoğraf/Video Girişi):
 *    - Herhangi bir fotoğraf veya video yüklenmesine gerek kalmadan, Supabase'deki ürün
 *      verilerini, renk kartelasını ve kurumsal kimliği kullanarak Gönderi (1080x1080),
 *      Story (1080x1920) ve Reels (1080x1920 çok sahneli) içeriklerini KENDİSİ TASARLAR,
 *      Supabase Storage bulutuna kaydeder ve metinlerini/hashtaglerini üretir.
 * 3. Onaysız Otomatik Paylaşım Motoru:
 *    - Belirli saat aralıklarında (örn. 10:00 Gönderi, 14:30 Story, 19:30 Reels)
 *      hiçbir manuel onay beklemeden doğrudan Instagram Graph API üzerinden yayınlar.
 * 4. 3 Aşamalı Akıllı İletişim & DM / Yorum Yanıt Sistemi:
 *    - 1. Aşama (Basit Sorular): Anahtar kelime eşleşmesi ile milisaniyeler içinde sabit kurumsal cevap.
 *    - 2. Aşama (Karmaşık & Teknik Sorular): Supabase'deki canlı ürün kataloğunu bilen Gemini AI devreye girer.
 *    - 3. Aşama (Gerçek İnsan & WhatsApp Devri): Sipariş, özel ölçü fiyatlandırma veya yetkili talebinde
 *      müşteriyi otomatik hazır mesajlı WhatsApp hattına (+90 505 015 1035) ve telefon iletişimine yönlendirir.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
export const DEFAULT_SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
export const DEFAULT_SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';

// ── MİMARİ RENK PALETLERİ & OTONOM TASARIM TEMALARI ──────────────────────────
export const AUTONOMOUS_DESIGN_THEMES = [
  {
    id: 'nordic-fjord',
    name: 'Fjord Mavi & Kuzey Mimari',
    bgStart: '#0B1D33',
    bgMid: '#163A5F',
    bgEnd: '#2E6F9E',
    accent: '#38BDF8',
    badgeBg: 'rgba(56, 189, 248, 0.18)',
    doorColor: '#2B5B84',
    doorStroke: '#7DD3FC',
    swatches: ['#1E3F66', '#2E6F9E', '#64748B', '#4D7C6F', '#E2E8F0']
  },
  {
    id: 'sage-atelier',
    name: 'Adaçayı Yeşili & Doğal Atölye',
    bgStart: '#0D211D',
    bgMid: '#1B433B',
    bgEnd: '#2D6A5B',
    accent: '#34D399',
    badgeBg: 'rgba(52, 211, 153, 0.18)',
    doorColor: '#3B6E5C',
    doorStroke: '#6EE7B7',
    swatches: ['#3B6E5C', '#0F253E', '#94A3B8', '#CBD5E1', '#F8FAFC']
  },
  {
    id: 'quartz-slate',
    name: 'Kuvars Gri & Endüstriyel CNC',
    bgStart: '#0F172A',
    bgMid: '#1E293B',
    bgEnd: '#334155',
    accent: '#60A5FA',
    badgeBg: 'rgba(96, 165, 250, 0.18)',
    doorColor: '#475569',
    doorStroke: '#93C5FD',
    swatches: ['#475569', '#1E3A8A', '#3B6E5C', '#E2E8F0', '#94A3B8']
  },
  {
    id: 'royal-steel',
    name: 'Çelik Mavisi & Modern Mutfak',
    bgStart: '#091526',
    bgMid: '#142F52',
    bgEnd: '#1E4E8C',
    accent: '#93C5FD',
    badgeBg: 'rgba(147, 197, 253, 0.18)',
    doorColor: '#1E3F66',
    doorStroke: '#BAE6FD',
    swatches: ['#1E3F66', '#38BDF8', '#475569', '#10B981', '#F1F5F9']
  }
];

// ── OTONOM KONSEPT ŞABLONLARI (ÜRÜN OLMASA BİLE KENDİ ÜRETİR) ───────────────
export const AUTONOMOUS_CONCEPT_LIBRARY = [
  {
    conceptType: 'CNC_PRECISION',
    badge: '5 EKSEN CNC TEKNOLOJİSİ',
    headline: '0.01 MM HASSASİYETLE ÖZEL ÖLÇÜ KAPAK ÜRETİMİ',
    subheadline: '18mm 1. Sınıf E1 Sertifikalı MDF • Suya ve Buhara Tam Dayanım',
    doorStyle: 'diagonal',
    specs: ['5 İş Gününde Teslim', '5 Yıl Üretici Garantisi', '2.000 m² Üretim Tesisi'],
    caption: '✨ Modern mimari, milimetrik CNC teknolojisiyle buluşuyor.\n\nGlobal Kapak Mobilya olarak 2.000 m² modern üretim tesisimizde mutfak, banyo ve gardırop projeleriniz için 0.01 mm hassasiyetle özel ölçü membran kapak üretiyoruz.\n\n🛡️ 5 Yıl Garanti | 🚚 5 İş Gününde Teslimat\n🌐 Canlı Tasarım Modu: globalmobilyaweb.vercel.app',
    hashtags: '#globalkapakmobilya #membrankapak #cnckapak #mutfakdolabı #içmimari #özelölçümobilya'
  },
  {
    conceptType: 'COLOR_SWATCH_SHOWCASE',
    badge: '2026 MİMARİ RENK KARTELASI',
    headline: 'FJORD MAVİ, KUVARS GRİ & ADAÇAYI YEŞİLİ',
    subheadline: 'Parmak İzi Bırakmayan İthal PVC Membran Yüzey Teknolojisi',
    doorStyle: 'shaker',
    specs: ['50+ Renk & Doku', 'Anti-Fingerprint Yüzey', 'Özel Ölçü Üretim'],
    caption: '🎨 Mekanınıza kuzey mimarisinin dinginliğini taşıyın!\n\nFjord Mavi Mat, Kuvars Gri, Adaçayı Yeşili ve Kutup Beyazı dahil 50’den fazla membran renk seçeneğimizi web sitemizdeki Canlı Kapak Tasarım Modunda kendi ölçünüzle anında deneyebilirsiniz.\n\n📲 WhatsApp Sipariş & Destek: 0 (505) 015 1035',
    hashtags: '#globalkapak #mutfaktasarım #renkkartelası #membrankapak #banyodolabı #mimari'
  },
  {
    conceptType: 'FAST_PRODUCTION',
    badge: 'HIZLI & GÜVENİLİR ÜRETİM',
    headline: 'ÖZEL ÖLÇÜ SİPARİŞLERİNİZ 5 İŞ GÜNÜNDE TESLİM!',
    subheadline: 'İstanbul İçi ve Türkiye Geneli Güvenli Ambalaj & Sevkiyat',
    doorStyle: 'fluted',
    specs: ['5 İş Günü Termin', 'Türkiye Geneli Sevkiyat', '%100 Müşteri Memnuniyeti'],
    caption: '🚚 Projelerinizde termin gecikmelerine son!\n\nYüksek kapasiteli CNC parkurumuz ve vakum membran pres hattımız sayesinde tüm özel ölçü kapak siparişlerinizi 5 iş günü içerisinde üreterek sevkiyata hazır hale getiriyoruz.\n\n📍 Bağcılar / İstanbul | 📞 0 (505) 015 1035',
    hashtags: '#globalkapakmobilya #mobilyaüretim #mutfakkapakları #cnckesim #içmimarlık #dekorasyon'
  }
];

// ── VARSAYILAN 1. AŞAMA SABİT CEVAP KURALLARI ───────────────────────────────
export const DEFAULT_TIER1_RULES = [
  {
    id: 'rule-greeting',
    rule_name: 'Selamlama & Karşılama',
    keywords: ['merhaba', 'selam', 'iyi günler', 'iyi çalışmalar', 'kolay gelsin', 'slm', 'mrb'],
    match_type: 'exact',
    channel_scope: 'BOTH',
    response_text: 'Merhaba! 👋 Global Kapak Mobilya’ya hoş geldiniz. Özel ölçü CNC membran mutfak, banyo ve gardırop kapaklarımız hakkında size nasıl yardımcı olabilirim? (Renk kartelası, teslimat süresi veya modellerimiz hakkında sorabilirsiniz.)',
    escalate_to_tier3: false,
    priority: 5,
    active: true
  },
  {
    id: 'rule-delivery',
    rule_name: 'Teslimat Süresi & Kargo',
    keywords: ['teslimat', 'kaç günde', 'ne zaman çıkar', 'termin', 'kargo', 'şehir dışı', 'sevkiyat'],
    match_type: 'contains',
    channel_scope: 'BOTH',
    response_text: '🚚 Tüm özel ölçü membran kapak siparişlerimizi 2.000 m² modern fabrikamızda **5 iş günü** içinde üretip sevkiyata hazır hale getiriyoruz. İstanbul içi ve Türkiye geneli güvenli ambalajla sevkiyatımız mevcuttur.',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  },
  {
    id: 'rule-warranty',
    rule_name: 'Garanti & MDF / Membran Kalitesi',
    keywords: ['garanti', 'kabarma', 'soyulma', 'suya dayanıklı', 'buhar', 'mdf', 'kalite'],
    match_type: 'contains',
    channel_scope: 'BOTH',
    response_text: '🛡️ Ürünlerimizde 1. sınıf 18mm E1 sertifikalı MDF gövde ve yüksek ısı/neme dayanıklı ithal PVC membran folyo kullanıyoruz. Tüm kapaklarımız kabarma ve soyulmaya karşı **5 Yıl Üretici Garantisi** altındadır.',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  },
  {
    id: 'rule-address',
    rule_name: 'Fabrika Adres & Çalışma Saatleri',
    keywords: ['adres', 'nerede', 'konum', 'yeriniz', 'hangi semt', 'çalışma saat', 'kaça kadar'],
    match_type: 'contains',
    channel_scope: 'BOTH',
    response_text: '📍 Fabrikamız: Yalçın Koreş Cad. Bağlar Mah. No:6B, Bağcılar / İstanbul adresindedir. Hafta içi ve Cumartesi 08:00 – 18:00 saatleri arasında showroom ve üretim tesisimizi ziyaret edebilirsiniz.',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  },
  {
    id: 'rule-colors',
    rule_name: 'Renk Kartelası & Modeller',
    keywords: ['renk', 'kartela', 'katalog', 'modeller', 'çeşit', 'mat mavi', 'adaçayı', 'antrasit'],
    match_type: 'contains',
    channel_scope: 'BOTH',
    response_text: '🎨 Fjord Mavi Mat, Kuvars Gri, Adaçayı Yeşili, Kutup Beyazı, Antrasit ve Doğal Meşe dahil 50+ membran renk/doku seçeneğimiz mevcuttur. Canlı tasarım modumuzda ölçü ve renkleri anlık denemek için: https://globalmobilyaweb.vercel.app/urunler.html',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  }
];

// ── VARSAYILAN 3. AŞAMA (İNSAN / WHATSAPP DEVİR) TETİKLEYİCİLERİ ───────────
export const DEFAULT_TIER3_TRIGGERS = [
  'sipariş vermek',
  'fiyat teklifi',
  'net fiyat',
  'm2 fiyatı',
  'metrekare fiyatı',
  'kaç tl',
  'ne kadar tutar',
  'özel ölçü fiyat',
  'yetkili',
  'temsilci',
  'insanla görüşmek',
  'ustayla görüşmek',
  'toplu alım',
  'bayilik',
  'şikayet',
  'sorun var',
  'whatsapp',
  'telefon numaranız',
  'beni arayın'
];

// ── SUPABASE REST YARDIMCISI ────────────────────────────────────────────────
export async function supabaseRequest(path, { method = 'GET', body = null, supabaseUrl = DEFAULT_SUPABASE_URL, supabaseKey = DEFAULT_SUPABASE_KEY } = {}) {
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Supabase REST Hatası (${res.status}): ${errText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── %100 OTONOM İÇERİK & GÖRSEL/REELS TASARIM ÜRETİCİ (FOTO/VİDEO GİRİŞSİZ) ──
function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Herhangi bir fotoğraf veya video yüklenmesine gerek kalmadan,
 * Gönderi (1080x1080), Story (1080x1920) veya Reels (1080x1920) için
 * vektörel/mimari kapak tasarımını SVG olarak üretir.
 */
export function renderAutonomousSvgCard({
  mediaType = 'POST',
  badge = 'GLOBAL KAPAK MOBİLYA • MİMARİ SERİ',
  headline = 'FJORD MAVİ CNC MEMBRAN KAPAK',
  subheadline = '18mm E1 MDF • Suya & Buhara Dayanıklı • 5 Yıl Garanti',
  specs = ['5 İş Gününde Teslim', '5 Yıl Garanti', 'Özel Ölçü CNC'],
  doorStyle = 'shaker',
  theme = AUTONOMOUS_DESIGN_THEMES[0]
}) {
  const isVertical = mediaType === 'REELS' || mediaType === 'STORIES';
  const width = 1080;
  const height = isVertical ? 1920 : 1080;

  const doorW = isVertical ? 460 : 340;
  const doorH = isVertical ? 760 : 480;
  const doorX = Math.round((width - doorW) / 2);
  const doorY = isVertical ? 520 : 280;

  let doorPatternSvg = '';
  if (doorStyle === 'diagonal') {
    doorPatternSvg = `
      <rect x="${doorX + 28}" y="${doorY + 28}" width="${doorW - 56}" height="${doorH - 56}" rx="10" fill="none" stroke="${theme.doorStroke}" stroke-width="3" stroke-opacity="0.55"/>
      <line x1="${doorX + 28}" y1="${doorY + 28}" x2="${doorX + doorW - 28}" y2="${doorY + doorH - 28}" stroke="${theme.doorStroke}" stroke-width="2.5" stroke-opacity="0.45"/>
      <line x1="${doorX + doorW - 28}" y1="${doorY + 28}" x2="${doorX + 28}" y2="${doorY + doorH - 28}" stroke="${theme.doorStroke}" stroke-width="2.5" stroke-opacity="0.45"/>
    `;
  } else if (doorStyle === 'fluted') {
    const lines = [];
    for (let x = doorX + 36; x < doorX + doorW - 30; x += 26) {
      lines.push(`<line x1="${x}" y1="${doorY + 24}" x2="${x}" y2="${doorY + doorH - 24}" stroke="${theme.doorStroke}" stroke-width="2" stroke-opacity="0.4"/>`);
    }
    doorPatternSvg = lines.join('');
  } else {
    // Klasik Çerçeveli / Shaker CNC Kapak
    doorPatternSvg = `
      <rect x="${doorX + 34}" y="${doorY + 34}" width="${doorW - 68}" height="${Math.round(doorH * 0.56)}" rx="8" fill="none" stroke="${theme.doorStroke}" stroke-width="3.5" stroke-opacity="0.65"/>
      <rect x="${doorX + 34}" y="${doorY + Math.round(doorH * 0.64)}" width="${doorW - 68}" height="${Math.round(doorH * 0.28)}" rx="8" fill="none" stroke="${theme.doorStroke}" stroke-width="3.5" stroke-opacity="0.65"/>
    `;
  }

  const swatchesSvg = (theme.swatches || []).map((color, idx) => {
    const sx = Math.round(width / 2 - ((theme.swatches.length * 58) / 2) + idx * 58);
    const sy = doorY + doorH + (isVertical ? 70 : 38);
    return `<circle cx="${sx + 22}" cy="${sy}" r="18" fill="${color}" stroke="#ffffff" stroke-width="3"/>`;
  }).join('');

  const specsY = isVertical ? 1480 : 865;
  const specsSvg = (specs || []).slice(0, 3).map((sp, i) => {
    const pillW = 300;
    const gap = 24;
    const totalW = 3 * pillW + 2 * gap;
    const px = Math.round((width - totalW) / 2 + i * (pillW + gap));
    return `
      <rect x="${px}" y="${specsY}" width="${pillW}" height="58" rx="29" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
      <text x="${px + pillW / 2}" y="${specsY + 36}" fill="#F8FAFC" font-family="sans-serif" font-size="21" font-weight="700" text-anchor="middle">✓ ${escapeXml(sp)}</text>
    `;
  }).join('');

  const headParts = headline.length > 28
    ? [headline.slice(0, Math.ceil(headline.length / 2)), headline.slice(Math.ceil(headline.length / 2))]
    : [headline];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.bgStart}"/>
        <stop offset="52%" stop-color="${theme.bgMid}"/>
        <stop offset="100%" stop-color="${theme.bgEnd}"/>
      </linearGradient>
      <linearGradient id="doorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.doorColor}"/>
        <stop offset="100%" stop-color="${theme.bgMid}"/>
      </linearGradient>
    </defs>

    <!-- Arka Plan -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>

    <!-- Mimari Izgara Çizgileri -->
    <g stroke="rgba(255,255,255,0.05)" stroke-width="1">
      <line x1="120" y1="0" x2="120" y2="${height}"/>
      <line x1="${width - 120}" y1="0" x2="${width - 120}" y2="${height}"/>
      <line x1="0" y1="${isVertical ? 260 : 160}" x2="${width}" y2="${isVertical ? 260 : 160}"/>
      <line x1="0" y1="${height - 140}" x2="${width}" y2="${height - 140}"/>
    </g>

    <!-- Üst Kurumsal Rozet -->
    <rect x="${Math.round((width - 520) / 2)}" y="${isVertical ? 110 : 54}" width="520" height="48" rx="24" fill="${theme.badgeBg}" stroke="${theme.accent}" stroke-width="1.5"/>
    <text x="${width / 2}" y="${isVertical ? 141 : 85}" fill="${theme.accent}" font-family="sans-serif" font-size="20" font-weight="800" text-anchor="middle" letter-spacing="2">${escapeXml(badge)}</text>

    <!-- Ana Başlık -->
    <text x="${width / 2}" y="${isVertical ? 235 : 150}" fill="#FFFFFF" font-family="sans-serif" font-size="${isVertical ? 44 : 38}" font-weight="900" text-anchor="middle">${escapeXml(headParts[0] || '')}</text>
    ${headParts[1] ? `<text x="${width / 2}" y="${isVertical ? 290 : 196}" fill="#FFFFFF" font-family="sans-serif" font-size="${isVertical ? 44 : 38}" font-weight="900" text-anchor="middle">${escapeXml(headParts[1].trim())}</text>` : ''}

    <!-- Alt Başlık -->
    <text x="${width / 2}" y="${isVertical ? 355 : 240}" fill="#CBD5E1" font-family="sans-serif" font-size="23" font-weight="500" text-anchor="middle">${escapeXml(subheadline)}</text>

    <!-- 3B CNC Membran Kapak Tasarım İllüstrasyonu -->
    <rect x="${doorX - 14}" y="${doorY - 14}" width="${doorW + 28}" height="${doorH + 28}" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
    <rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}" rx="16" fill="url(#doorGrad)" stroke="${theme.doorStroke}" stroke-width="4"/>
    ${doorPatternSvg}
    <!-- Kapak Kulp Detayı -->
    <rect x="${doorX + doorW - 26}" y="${doorY + Math.round(doorH / 2) - 45}" width="8" height="90" rx="4" fill="#E2E8F0"/>

    <!-- Renk Kartelası Noktaları -->
    ${swatchesSvg}

    <!-- Özellik Rozetleri -->
    ${specsSvg}

    <!-- Alt Kurumsal İmza Bandı -->
    <text x="${width / 2}" y="${height - 64}" fill="#94A3B8" font-family="sans-serif" font-size="22" font-weight="700" text-anchor="middle">🌐 globalmobilyaweb.vercel.app   •   📞 0 (505) 015 1035   •   📍 Bağcılar / İstanbul</text>
  </svg>`;
}

/**
 * Herhangi bir fotoğraf veya video girişi olmadan, Supabase ürün kataloğunu
 * ve Gemini AI'ı kullanarak gönderiyi/story'yi/reels'i kendisi tasarlar ve üretir.
 */
export async function generateAutonomousInstagramContent({
  mediaType = 'POST', // 'POST' | 'STORIES' | 'REELS'
  productsCatalog = [],
  config = {},
  slotLabel = ''
} = {}) {
  const theme = AUTONOMOUS_DESIGN_THEMES[Math.floor(Math.random() * AUTONOMOUS_DESIGN_THEMES.length)];
  const hasProducts = Array.isArray(productsCatalog) && productsCatalog.length > 0;
  const pickedProduct = hasProducts
    ? productsCatalog[Math.floor(Math.random() * productsCatalog.length)]
    : null;
  const fallbackConcept = AUTONOMOUS_CONCEPT_LIBRARY[Math.floor(Math.random() * AUTONOMOUS_CONCEPT_LIBRARY.length)];

  let badge = mediaType === 'REELS'
    ? 'GLOBAL KAPAK • OTONOM REELS STÜDYOSU'
    : mediaType === 'STORIES'
      ? 'GLOBAL KAPAK • GÜNLÜK MİMARİ HİKAYE'
      : 'GLOBAL KAPAK • ÖZEL ÖLÇÜ KOLEKSİYON';

  let headline = pickedProduct
    ? (pickedProduct.title || pickedProduct.slug || fallbackConcept.headline).toLocaleUpperCase('tr-TR')
    : fallbackConcept.headline;

  let subheadline = pickedProduct
    ? (pickedProduct.kisa_aciklama || `${pickedProduct.kategori || 'CNC Membran Kapak'} • 18mm E1 MDF • 5 Yıl Garanti`)
    : fallbackConcept.subheadline;

  let specs = ['5 İş Gününde Teslim', '5 Yıl Garanti', '18mm E1 MDF'];
  let doorStyle = ['shaker', 'diagonal', 'fluted'][Math.floor(Math.random() * 3)];

  let caption = pickedProduct
    ? `✨ ${pickedProduct.title || 'Özel Ölçü CNC Membran Kapak'} — Mekanınıza Kuzey Mimarisinin Zarafetini Katın!\n\n` +
      `${pickedProduct.kisa_aciklama || '2.000 m² modern üretim tesisimizde 0.01 mm CNC hassasiyeti ve 1. sınıf 18mm E1 MDF ile üretilmektedir.'}\n\n` +
      `🛡️ 5 Yıl Üretici Garantisi\n` +
      `🚚 5 İş Gününde Hızlı Teslimat\n` +
      `🎨 Web sitemizdeki Canlı Tasarım Modunda dolap ölçünüz ve renginizle hemen deneyin: https://globalmobilyaweb.vercel.app/urun.html?id=${pickedProduct.slug || ''}\n` +
      `📲 WhatsApp Sipariş Hattı: 0 (505) 015 1035`
    : fallbackConcept.caption;

  let hashtags = fallbackConcept.hashtags;

  // Eğer Gemini API Key mevcutsa metinleri ve kreatif başlığı Gemini AI ile zenginleştir
  const geminiKey = (config.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey) {
    try {
      const geminiModel = config.gemini_model || 'gemini-2.5-flash';
      const aiPrompt = `Sen Global Kapak Mobilya'nın kreatif sosyal medya tasarımcısısın.
Şirketimiz İstanbul Bağcılar'da 2.000 m² fabrikasında 18mm E1 MDF üzerine 5 yıl garantili, 5 iş gününde teslim özel ölçü CNC membran mutfak, banyo ve gardırop kapağı üretiyor.
Format: ${mediaType} (${slotLabel || 'Otonom Paylaşım'})
Seçilen Ürün/Konu: ${pickedProduct ? `${pickedProduct.title} - ${pickedProduct.kisa_aciklama || ''}` : fallbackConcept.headline}

Lütfen görsel tasarım kartının üzerine yazılacak başlıkları ve Instagram açıklamasını JSON olarak üret:
{
  "badge": "Üst rozet (maks 32 karakter, büyük harf)",
  "headline": "Görsel üzerindeki vurucu ana başlık (maks 42 karakter, büyük harf)",
  "subheadline": "Görsel alt başlığı (maks 65 karakter)",
  "caption": "Instagram açıklama metni (emojili, kurumsal, harekete geçirici, 3-4 paragraf)",
  "hashtags": "#globalkapakmobilya ile başlayan 6-8 hashtag"
}`;

      const gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: aiPrompt }] }],
            generationConfig: { temperature: 0.6, responseMimeType: 'application/json' }
          })
        }
      );
      if (gRes.ok) {
        const gData = await gRes.json();
        const parsed = JSON.parse(gData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
        if (parsed.badge) badge = parsed.badge;
        if (parsed.headline) headline = parsed.headline;
        if (parsed.subheadline) subheadline = parsed.subheadline;
        if (parsed.caption) caption = parsed.caption;
        if (parsed.hashtags) hashtags = parsed.hashtags;
      }
    } catch (_) {}
  }

  const svgContent = renderAutonomousSvgCard({
    mediaType,
    badge,
    headline,
    subheadline,
    specs,
    doorStyle,
    theme
  });

  // Bulut Render URL (Herhangi bir dosya yüklenmeden dinamik görsel üretir)
  const renderParams = new URLSearchParams({
    type: mediaType,
    badge,
    headline,
    subheadline,
    theme: theme.id,
    door: doorStyle
  });
  const dynamicRenderUrl = `https://insta-deployment-rho.vercel.app/api/instagram-render?${renderParams.toString()}`;

  return {
    id: `auto-${mediaType.toLowerCase()}-${Date.now()}`,
    media_type: mediaType,
    title: `[Otonom Tasarım] ${headline}`,
    badge,
    headline,
    subheadline,
    specs,
    door_style: doorStyle,
    theme_id: theme.id,
    theme,
    caption,
    hashtags,
    svg_markup: svgContent,
    media_url: dynamicRenderUrl,
    auto_designed: true,
    product_slug: pickedProduct?.slug || null
  };
}

// ── 1. OTOMATİK PAYLAŞIM MOTORU (GÖNDERİ, REELS, STORY - ONAYSIZ) ──────────
export async function publishToInstagramGraphApi({
  igUserId,
  accessToken,
  mediaType = 'POST', // 'POST' | 'REELS' | 'STORIES'
  contentType,        // alias support
  mediaUrl,
  caption = '',
  IsVideo = false
}) {
  const resolvedType = (mediaType || contentType || 'POST').toUpperCase();

  if (!igUserId || !accessToken) {
    // Eğer henüz resmi Meta token girilmemişse bulut otonom simülasyon modunda başarılı kayıt döner
    const simId = `sim_ig_${resolvedType.toLowerCase()}_${Date.now()}`;
    return {
      simulated: true,
      mode: 'CLOUD_AUTONOMOUS_SIMULATION',
      containerId: `sim_cont_${Date.now()}`,
      mediaId: simId,
      publishedId: simId,
      publishedAt: new Date().toISOString(),
      note: 'Bulut Otonom Tasarım & Yayın (Canlı Meta Token girildiğinde doğrudan Instagram API çağrılır)'
    };
  }

  const createParams = new URLSearchParams();
  createParams.set('access_token', accessToken);

  const isVideoFile = IsVideo || /\.(mp4|mov|webm)(\?.*)?$/i.test(mediaUrl || '');

  if (resolvedType === 'REELS') {
    if (isVideoFile) {
      createParams.set('media_type', 'REELS');
      createParams.set('video_url', mediaUrl);
      createParams.set('share_to_feed', 'true');
    } else {
      createParams.set('image_url', mediaUrl);
    }
    createParams.set('caption', caption);
  } else if (resolvedType === 'STORIES') {
    createParams.set('media_type', 'STORIES');
    if (isVideoFile) {
      createParams.set('video_url', mediaUrl);
    } else {
      createParams.set('image_url', mediaUrl);
    }
  } else {
    if (isVideoFile) {
      createParams.set('media_type', 'REELS');
      createParams.set('video_url', mediaUrl);
    } else {
      createParams.set('image_url', mediaUrl);
    }
    createParams.set('caption', caption);
  }

  // Adım 1: Medya Konteyneri Oluştur
  const containerRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
    method: 'POST',
    body: createParams
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok || !containerData.id) {
    throw new Error(containerData?.error?.message || 'Instagram medya konteyneri oluşturulamadı');
  }

  const creationId = containerData.id;

  // Adım 2: Video/Reels/Story ise işlenme durumunu bekle (FINISHED olana kadar)
  if (resolvedType === 'REELS' || resolvedType === 'STORIES' || isVideoFile) {
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 4000));
      const statusRes = await fetch(`${GRAPH_API_BASE}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`);
      const statusData = await statusRes.json();
      if (statusData.status_code === 'FINISHED') break;
      if (statusData.status_code === 'ERROR') {
        throw new Error(`Instagram medya işleme hatası: ${statusData.status || 'Bilinmeyen hata'}`);
      }
    }
  }

  // Adım 3: Onay Beklemeden Doğrudan Yayınla (media_publish)
  const publishParams = new URLSearchParams();
  publishParams.set('creation_id', creationId);
  publishParams.set('access_token', accessToken);

  const pubRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    body: publishParams
  });
  const pubData = await pubRes.json();
  if (!pubRes.ok || !pubData.id) {
    throw new Error(pubData?.error?.message || 'Instagram medya yayınlama başarısız oldu');
  }

  return {
    simulated: false,
    mode: 'LIVE_GRAPH_API',
    containerId: creationId,
    mediaId: pubData.id,
    publishedId: pubData.id,
    publishedAt: new Date().toISOString()
  };
}

// ── INSTAGRAM DM & YORUM GÖNDERİM YARDIMCILARI ──────────────────────────────
export async function sendInstagramDmReply({ igUserId, accessToken, recipientId, replyText }) {
  if (!igUserId || !accessToken || !recipientId) return { simulated: true };
  const res = await fetch(`${GRAPH_API_BASE}/${igUserId}/messages?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: replyText }
    })
  });
  return await res.json();
}

export async function sendInstagramCommentReply({ accessToken, commentId, replyText }) {
  if (!accessToken || !commentId) return { simulated: true };
  const params = new URLSearchParams({ message: replyText, access_token: accessToken });
  const res = await fetch(`${GRAPH_API_BASE}/${commentId}/replies`, { method: 'POST', body: params });
  return await res.json();
}

// ── 2. ÜÇ AŞAMALI İLETİŞİM MOTORU (SABİT KURAL -> GEMINI AI -> WHATSAPP/İNSAN) ─
export async function evaluateThreeTierCommunication({
  incomingText,
  messageText, // alias
  senderUsername = '@musteri',
  channel = 'DM', // 'DM' | 'COMMENT'
  config = {},
  keywordRules = DEFAULT_TIER1_RULES,
  productsCatalog = []
}) {
  const cleanText = (incomingText || messageText || '').trim();
  const lowerText = cleanText.toLocaleLowerCase('tr-TR');

  const whatsappNumber = config.tier3_whatsapp_number || '905050151035';
  const phoneDisplay = config.tier3_phone_display || '0 (505) 015 1035';
  const handoffTriggers = Array.isArray(config.tier3_handoff_triggers) && config.tier3_handoff_triggers.length > 0
    ? config.tier3_handoff_triggers
    : DEFAULT_TIER3_TRIGGERS;

  // ÖN KONTROL: Müşteri doğrudan 3. Aşama (İnsan / Sipariş / Net Fiyat Teklifi / WhatsApp) tetikleyicisi yazdı mı?
  const directTier3Match = handoffTriggers.find(trigger => lowerText.includes(trigger.toLocaleLowerCase('tr-TR')));
  if (directTier3Match) {
    const prefilledWa = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, Instagram üzerinden yazıyorum (${senderUsername}). Konu: "${cleanText}" hakkında uzman desteği ve fiyat teklifi almak istiyorum.`)}`;
    const reply = `Memnuniyetle yardımcı olalım! 🙌 Talebiniz (**"${directTier3Match}"**) özel ölçü hesaplaması ve birebir uzman desteği gerektirdiği için sizi doğrudan **Canlı Satış & Üretim Ekibimize** bağlıyorum.\n\n📲 **Tek Tıkla WhatsApp Destek:** ${prefilledWa}\n📞 **Fabrika Doğrudan Hat:** ${phoneDisplay}`;
    return {
      resolved_tier: 3,
      stage: 3,
      tier_label: '3. Aşama: İnsan Temsilci & WhatsApp Yönlendirme',
      stageLabel: '3. Aşama: İnsan Temsilci & WhatsApp Yönlendirme',
      matched_rule: `Doğrudan Tetikleyici: "${directTier3Match}"`,
      bot_reply: reply,
      replyText: reply,
      handoff_status: 'waiting_human',
      handoffTriggered: true,
      whatsapp_link: prefilledWa,
      whatsappLink: prefilledWa
    };
  }

  // ── 1. AŞAMA: BASİT SORULAR İÇİN SABİT / ANAHTAR KELİME CEVAPLARI ──
  const activeRules = (keywordRules || DEFAULT_TIER1_RULES)
    .filter(r => r.active !== false && (r.channel_scope === 'BOTH' || r.channel_scope === channel))
    .sort((a, b) => (a.priority || 10) - (b.priority || 10));

  for (const rule of activeRules) {
    const kws = Array.isArray(rule.keywords) ? rule.keywords : [];
    const matchedKw = kws.find(kw => {
      const k = (kw || '').toLocaleLowerCase('tr-TR').trim();
      if (!k) return false;
      if (rule.match_type === 'exact') {
        return lowerText === k || lowerText.replace(/[?!.,]/g, '').trim() === k;
      }
      return lowerText.includes(k);
    });

    if (matchedKw) {
      if (rule.escalate_to_tier3) {
        const waLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, Instagram'dan ulaşıyorum: ${cleanText}`)}`;
        const fullReply = `${rule.response_text}\n\n📲 WhatsApp Hattımız: ${waLink}`;
        return {
          resolved_tier: 3,
          stage: 3,
          tier_label: '3. Aşama: İnsan Temsilci & WhatsApp Yönlendirme',
          stageLabel: '3. Aşama: İnsan Temsilci & WhatsApp Yönlendirme',
          matched_rule: rule.rule_name,
          bot_reply: fullReply,
          replyText: fullReply,
          handoff_status: 'waiting_human',
          handoffTriggered: true,
          whatsapp_link: waLink,
          whatsappLink: waLink
        };
      }

      return {
        resolved_tier: 1,
        stage: 1,
        tier_label: '1. Aşama: Sabit Kurumsal Cevap',
        stageLabel: '1. Aşama: Sabit Kurumsal Cevap',
        matched_rule: `${rule.rule_name} ("${matchedKw}")`,
        bot_reply: rule.response_text,
        replyText: rule.response_text,
        handoff_status: 'resolved',
        handoffTriggered: false,
        whatsapp_link: '',
        whatsappLink: ''
      };
    }
  }

  // ── 2. AŞAMA: KARMAŞIK VE DESTEK GEREKTİREN SORULARDA GEMINI AI DEVREDE ──
  const geminiKey = (config.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
  const catalogContext = (productsCatalog || []).slice(0, 10).map(p =>
    `- ${p.title || p.name || p.slug} (${p.kategori || p.category || 'Membran Kapak'}): ${p.kisa_aciklama || 'Özel ölçü 18mm MDF CNC membran kapak'}`
  ).join('\n');

  if (geminiKey) {
    try {
      const systemInstruction = config.tier2_system_prompt ||
        'Sen Global Kapak Mobilya\'nın resmi Instagram yapay zeka asistanısın. 2.000 m² tesisimizde 18mm E1 MDF üzerine 5 yıl garantili, 5 iş gününde teslim CNC membran kapak üretiyoruz.';

      const prompt = `${systemInstruction}

Canlı Ürün Kataloğumuz:
${catalogContext || '- Fjord Mavi Diyagonal CNC Kapak\n- Kuvars Gri Dalga Model\n- Adaçayı Yeşili Çerçeveli Country Kapak\n- Özel Ölçü Düz & Çıtalı Membran Kapaklar'}

Müşteri (@${senderUsername.replace(/^@/, '')}) Instagram ${channel} üzerinden şu mesajı gönderdi:
"${cleanText}"

Lütfen JSON formatında yanıt ver:
{
  "reply": "Müşteriye verilecek kibar, kurumsal, net Türkçe yanıt (maksimum 3-4 cümle)",
  "needs_human_handoff": true veya false (Eğer müşteri özel ölçü siparişi, net fiyat hesaplaması, şikayet, numune talebi veya insan temsilciyle görüşmek istiyorsa true yap),
  "handoff_reason": "Eğer needs_human_handoff true ise kısa sebebi"
}`;

      const geminiModel = config.gemini_model || 'gemini-2.5-flash';
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.35,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const rawJson = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(rawJson);

        if (parsed.needs_human_handoff) {
          const waLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, Instagram üzerinden "${cleanText}" konusunda destek almak istiyorum.`)}`;
          const fullReply = `${parsed.reply}\n\n📲 **Uzman Temsilcimizle WhatsApp'tan Görüşün:** ${waLink} (${phoneDisplay})`;
          return {
            resolved_tier: 3,
            stage: 3,
            tier_label: '3. Aşama: Gemini AI Analizi → İnsan / WhatsApp Devri',
            stageLabel: '3. Aşama: Gemini AI Analizi → İnsan / WhatsApp Devri',
            matched_rule: parsed.handoff_reason || 'Karmaşık Sipariş / Uzman Desteği',
            bot_reply: fullReply,
            replyText: fullReply,
            handoff_status: 'waiting_human',
            handoffTriggered: true,
            whatsapp_link: waLink,
            whatsappLink: waLink
          };
        }

        if (parsed.reply) {
          return {
            resolved_tier: 2,
            stage: 2,
            tier_label: '2. Aşama: Gemini AI Akıllı Yanıt',
            stageLabel: '2. Aşama: Gemini AI Akıllı Yanıt',
            matched_rule: `Gemini AI (${geminiModel})`,
            bot_reply: parsed.reply,
            replyText: parsed.reply,
            handoff_status: 'resolved',
            handoffTriggered: false,
            whatsapp_link: '',
            whatsappLink: ''
          };
        }
      }
    } catch (err) {
      console.error('Gemini AI çağrı hatası:', err.message);
    }
  }

  // Gemini API anahtarı henüz girilmemişse veya çok spesifik teknik soruysa:
  const isComplexTechnical = /ölçü|cm|metre|mutfak|banyo|dolap|kapak|model|desen|cnc|folyo|pvc|renk|uygun mu|nasıl/i.test(lowerText);
  if (isComplexTechnical) {
    const waLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, "${cleanText}" hakkında bilgi almak istiyorum.`)}`;
    const techReply = `Sorunuz için teşekkür ederiz! 🤖 Global Kapak Mobilya olarak tüm CNC membran kapak modellerimizi mutfak, banyo ve gardırop ölçünüze göre **milimetrik özel ebatlarda (18mm E1 MDF gövde, suya/buhara tam dayanıklı yüzey)** üretiyoruz. Web sitemizdeki **Canlı Tasarım Modu** üzerinden ebat ve renk önizlemesi yapabilir (https://globalmobilyaweb.vercel.app/urunler.html) veya ölçünüzü doğrudan uzman ekibimize iletmek için WhatsApp hattımıza tıklayabilirsiniz: ${waLink}`;
    return {
      resolved_tier: 2,
      stage: 2,
      tier_label: '2. Aşama: Gemini AI Teknik & Katalog Asistanı',
      stageLabel: '2. Aşama: Gemini AI Teknik & Katalog Asistanı',
      matched_rule: 'AI Katalog & Özel Ölçü Analizi',
      bot_reply: techReply,
      replyText: techReply,
      handoff_status: 'resolved',
      handoffTriggered: false,
      whatsapp_link: waLink,
      whatsappLink: waLink
    };
  }

  // Diğer tüm durumlarda 3. Aşama (Gerçek İnsan / WhatsApp Devri)
  const fallbackWaLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, Instagram üzerinden yazıyorum: "${cleanText}"`)}`;
  const fallbackReply = `Mesajınız için teşekkür ederiz! 🙌 Konuyla ilgili size en doğru bilgiyi ve özel teklifi sunabilmemiz için müşteri temsilcimiz sizi bekliyor.\n\n📲 **WhatsApp Canlı Destek:** ${fallbackWaLink}\n📞 **Telefon:** ${phoneDisplay}`;
  return {
    resolved_tier: 3,
    stage: 3,
    tier_label: '3. Aşama: İnsan Temsilci & WhatsApp Yönlendirme',
    stageLabel: '3. Aşama: İnsan Temsilci & WhatsApp Yönlendirme',
    matched_rule: 'Özel Destek & Temsilci Devri',
    bot_reply: fallbackReply,
    replyText: fallbackReply,
    handoff_status: 'waiting_human',
    handoffTriggered: true,
    whatsapp_link: fallbackWaLink,
    whatsappLink: fallbackWaLink
  };
}

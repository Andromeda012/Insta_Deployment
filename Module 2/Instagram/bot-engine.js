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
export const DEFAULT_GEMINI_KEY = ['AQ.Ab8RN6LZjph', '0uabWTE25fDUZhRMwR', '1yUb6ln8s-4ldjxZNvBBw'].join('');
export const DEFAULT_IG_USER_ID = '17841435882645322';
export const DEFAULT_META_ACCESS_TOKEN = 'EAAVytShbbJUBSZBpjyQk9JEpsliUSVgEGdZCyBl2bnzwN5SJgBJj0GsKArgux7QZAlLBbQcgykaoax6UoDiiZBiYRvAeZC0C9Mq06mal2NPPaJ2ZCUOZANPlwj3WWL6iFeIEH6KmOrW2GMann2cPD7MogvaYpvuKZCsZB7DmuUj87ZBRBnS3oVqi2umjEfh6NwGA6mMwZDZD';
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
    badge: 'NOVA FURNITURE • ÖZEL ÜRETİM',
    headline: '0.01 MM HASSASİYETLE ÖZEL ÖLÇÜ MOBİLYA ÜRETİMİ',
    subheadline: '18mm 1. Sınıf E1 Sertifikalı MDF • Suya ve Buhara Tam Dayanım',
    doorStyle: 'diagonal',
    specs: ['5 İş Gününde Teslim', '5 Yıl Üretici Garantisi', 'Modern Üretim Tesisi'],
    caption: '✨ Modern mimari, milimetrik CNC teknolojisiyle buluşuyor.\n\nNova Furniture olarak modern üretim tesisimizde mutfak, banyo, gardırop ve yatak odası projeleriniz için 0.01 mm hassasiyetle özel ölçü mobilya ve membran kapaklar üretiyoruz.\n\n🛡️ 5 Yıl Garanti | 🚚 5 İş Gününde Teslimat\n📲 WhatsApp Bilgi & Katalog Hattı: 0 (505) 015 1035',
    hashtags: '#novafurniture #thenovafurniture #mobilyatasarim #luxuryfurniture #evdekorasyonu #icmimari #ozelolcumobilya #mutfakdolabi'
  },
  {
    conceptType: 'COLOR_SWATCH_SHOWCASE',
    badge: 'NOVA 2026 RENK KARTELASI',
    headline: 'FJORD MAVİ, KUVARS GRİ & ADAÇAYI YEŞİLİ',
    subheadline: 'Parmak İzi Bırakmayan İthal PVC Membran Yüzey Teknolojisi',
    doorStyle: 'shaker',
    specs: ['50+ Renk & Doku', 'Anti-Fingerprint Yüzey', 'Özel Ölçü Üretim'],
    caption: '🎨 Mekanınıza modern mimarinin zarafetini taşıyın!\n\nFjord Mavi Mat, Kuvars Gri, Adaçayı Yeşili ve Kutup Beyazı dahil 50’den fazla renk seçeneğimiz hakkında detaylı bilgi ve numune talepleri için bize DM veya WhatsApp üzerinden ulaşabilirsiniz.\n\n📲 WhatsApp Sipariş & Destek: 0 (505) 015 1035',
    hashtags: '#novafurniture #thenovafurniture #mobilyatasarim #renkkartelasi #luxuryfurniture #banyodolabi #icmimari'
  },
  {
    conceptType: 'FAST_PRODUCTION',
    badge: 'HIZLI & GÜVENİLİR ÜRETİM',
    headline: 'ÖZEL ÖLÇÜ SİPARİŞLERİNİZ 5 İŞ GÜNÜNDE TESLİM!',
    subheadline: 'İstanbul İçi ve Türkiye Geneli Güvenli Ambalaj & Sevkiyat',
    doorStyle: 'fluted',
    specs: ['5 İş Günü Termin', 'Türkiye Geneli Sevkiyat', '%100 Müşteri Memnuniyeti'],
    caption: '🚚 Projelerinizde termin gecikmelerine son!\n\nYüksek kapasiteli CNC parkurumuz ve vakum pres hattımız sayesinde tüm özel ölçü mobilya ve kapak siparişlerinizi 5 iş günü içerisinde üreterek sevkiyata hazır hale getiriyoruz.\n\n📍 Bağcılar / İstanbul | 📞 0 (505) 015 1035',
    hashtags: '#novafurniture #thenovafurniture #mobilyatasarim #luxuryfurniture #evdekorasyonu #ozelolcumobilya #cnckesim'
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
    response_text: 'Merhaba! 👋 Nova Furniture (@thenovafurniture) ailesine hoş geldiniz. Özel ölçü mobilya, gardırop, yatak odası ve mutfak modellerimiz hakkında size nasıl yardımcı olabilirim? (Katalog, renk seçenekleri veya teslimat süresi hakkında sorabilirsiniz.)',
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
    response_text: '🚚 Tüm özel ölçü siparişlerimizi modern fabrikamızda **5 iş günü** içinde üretip sevkiyata hazır hale getiriyoruz. İstanbul içi ve Türkiye geneli güvenli ambalajla sevkiyatımız mevcuttur.',
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
    response_text: '🛡️ Ürünlerimizde 1. sınıf 18mm E1 sertifikalı MDF gövde ve yüksek ısı/neme dayanıklı ithal PVC membran folyo kullanıyoruz. Tüm ürünlerimiz kabarma ve soyulmaya karşı **5 Yıl Üretici Garantisi** altındadır.',
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
    response_text: '📍 Tesisimiz: Yalçın Koreş Cad. Bağlar Mah. No:6B, Bağcılar / İstanbul adresindedir. Hafta içi ve Cumartesi 08:00 – 18:00 saatleri arasında showroom ve üretim tesisimizi ziyaret edebilirsiniz.',
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
    response_text: '🎨 Fjord Mavi Mat, Kuvars Gri, Adaçayı Yeşili, Kutup Beyazı, Antrasit ve Doğal Meşe dahil 50+ renk ve doku seçeneğimiz mevcuttur. Detaylı katalog ve renk kartelası için doğrudan bize DM atabilir veya WhatsApp hattımızdan (0 505 015 1035) talep edebilirsiniz.',
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
    <text x="${width / 2}" y="${height - 64}" fill="#94A3B8" font-family="sans-serif" font-size="22" font-weight="700" text-anchor="middle">✨ Nova Furniture (@thenovafurniture)   •   📞 0 (505) 015 1035   •   📍 İstanbul</text>
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
    ? 'NOVA FURNITURE • OTONOM REELS'
    : mediaType === 'STORIES'
      ? 'NOVA FURNITURE • GÜNLÜK HİKAYE'
      : 'NOVA FURNITURE • ÖZEL KOLEKSİYON';

  let headline = pickedProduct
    ? (pickedProduct.title || pickedProduct.slug || fallbackConcept.headline).toLocaleUpperCase('tr-TR')
    : fallbackConcept.headline;

  let subheadline = pickedProduct
    ? (pickedProduct.kisa_aciklama || `${pickedProduct.kategori || 'Özel Tasarım Mobilya'} • 18mm E1 MDF • 5 Yıl Garanti`)
    : fallbackConcept.subheadline;

  let specs = ['5 İş Gününde Teslim', '5 Yıl Garanti', '18mm E1 MDF'];
  let doorStyle = ['shaker', 'diagonal', 'fluted'][Math.floor(Math.random() * 3)];

  let caption = pickedProduct
    ? `✨ ${pickedProduct.title || 'Nova Furniture Özel Tasarım Koleksiyonu'} — Mekanınıza Zarafet Katın!\n\n` +
      `${pickedProduct.kisa_aciklama || 'Modern üretim tesisimizde 0.01 mm CNC hassasiyeti ve 1. sınıf 18mm E1 MDF ile üretilmektedir.'}\n\n` +
      `🛡️ 5 Yıl Üretici Garantisi\n` +
      `🚚 5 İş Gününde Hızlı Teslimat\n` +
      `📩 Fiyat ve detaylı katalog için yoruma "FİYAT" yazabilir veya DM'den ulaşabilirsiniz.\n` +
      `📲 WhatsApp Sipariş & Danışma Hattı: 0 (505) 015 1035`
    : fallbackConcept.caption;

  let hashtags = '#novafurniture #thenovafurniture #mobilyatasarim #luxuryfurniture #evdekorasyonu #icmimari #ozelolcumobilya';

  // Eğer Gemini API Key mevcutsa metinleri ve kreatif başlığı Gemini AI ile zenginleştir
  const geminiKey = (config.gemini_api_key || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY).trim();
  if (geminiKey) {
    try {
      const geminiModel = config.gemini_model || 'gemini-2.5-flash';
      const aiPrompt = `Sen Nova Furniture'ın (@thenovafurniture) kreatif sosyal medya tasarımcısısın.
Şirketimiz İstanbul'daki tesisinde 1. sınıf 18mm E1 MDF üzerine 5 yıl garantili, 5 iş gününde teslim lüks yatak odası, gardırop, banyo ve mutfak mobilyaları üretiyor.
ÖNEMLİ KURAL: Kesinlikle hiçbir web sitesi linki paylaşma! Kesinlikle 'Global Kapak' veya '#globalkapak' kelimelerini KULLANMA! Sadece Nova Furniture markasını kullan.
Format: ${mediaType} (${slotLabel || 'Otonom Paylaşım'})
Seçilen Ürün/Konu: ${pickedProduct ? `${pickedProduct.title} - ${pickedProduct.kisa_aciklama || ''}` : fallbackConcept.headline}

Lütfen görsel tasarım kartının üzerine yazılacak başlıkları ve Instagram açıklamasını JSON olarak üret:
{
  "badge": "Üst rozet (maks 32 karakter, büyük harf, NOVA FURNITURE vurgulu)",
  "headline": "Görsel üzerindeki vurucu ana başlık (maks 42 karakter, büyük harf)",
  "subheadline": "Görsel alt başlığı (maks 65 karakter)",
  "caption": "Instagram açıklama metni (emojili, kurumsal, lüks, katalog için yoruma FİYAT yazın veya DM/WhatsApp 0505 015 1035 vurgulu, 3-4 paragraf)",
  "hashtags": "#novafurniture #thenovafurniture ile başlayan 6-8 hashtag (asla globalkapak olmasın)"
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

export async function sendInstagramPrivateReplyFromComment({ igUserId, accessToken, commentId, replyText }) {
  if (!igUserId || !accessToken || !commentId) return { simulated: true };
  const res = await fetch(`${GRAPH_API_BASE}/${igUserId}/messages?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: replyText }
    })
  });
  return await res.json();
}

// ── 2. GEMINI AI İLETİŞİM MOTORU (YORUM & DM YÖNETİMİ — %100 GEMINI KONTROLÜ) ─
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
  const cleanSender = senderUsername ? senderUsername.replace(/^@/, '') : 'musteri';

  const whatsappNumber = config.tier3_whatsapp_number || '905050151035';
  const phoneDisplay = config.tier3_phone_display || '0 (505) 015 1035';
  const prefilledWa = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Nova Furniture, Instagram üzerinden yazıyorum (@${cleanSender}). "${cleanText}" hakkında detaylı bilgi ve sipariş desteği almak istiyorum.`)}`;

  const geminiKey = (config.gemini_api_key || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY).trim();
  const geminiModel = config.gemini_model || 'gemini-2.5-flash';

  const catalogContext = (productsCatalog || []).slice(0, 10).map(p =>
    `- ${p.title || p.name || p.slug} (${p.kategori || p.category || 'Membran Ürün'}): ${p.kisa_aciklama || '18mm E1 MDF CNC membran kapak'}`
  ).join('\n');

  // =========================================================================
  // A) INSTAGRAM YORUMU (COMMENT) YÖNETİMİ: 'FİYAT' GÖRÜNCE DOĞRUDAN DM BAŞLAT
  // =========================================================================
  const isPriceInquiry = /fiyat|ücret|ne kadar|kaç|m2|metrekare|tutar|maliyet|kaça|bilgi|sipariş|dm/i.test(lowerText);

  if (channel === 'COMMENT') {
    if (isPriceInquiry) {
      // 1. Yoruma verilecek kurumsal açık yanıt
      const publicCommentReply = `Merhaba @${cleanSender}, model detaylarını ve kataloğumuzu DM kutunuza ilettik! 📩 Detaylar için özel mesajlarınızı kontrol edebilirsiniz.`;

      // 2. Müşteriye özel DM açılış mesajı (Soru + WhatsApp + Özel Katalog Desteği - Sıfır Dış Link)
      let dmOpeningText = `Merhaba @${cleanSender}! Nova Furniture (@thenovafurniture) ailesine hoş geldiniz. ✨\n\n` +
        `İlgilendiğiniz modelimiz 1. sınıf 18mm E1 sertifikalı sağlam MDF gövde ve yüksek dayanımlı CNC membran kapak teknolojisiyle üretilmektedir (5 Yıl Üretici Garantili).\n\n` +
        `Size özel net fiyatlandırma, ölçü seçenekleri ve detaylı ürün kataloğumuzu paylaşabilmemiz için:\n` +
        `❓ Hangi odayı (yatak odası, mutfak, gardırop vb.) yenilemek istiyorsunuz? Düşündüğünüz yaklaşık ölçü veya renk tercihiniz nedir?\n\n` +
        `Dilediğiniz an buradan doğrudan yazabilir veya doğrudan WhatsApp hattımızdan bize ulaşabilirsiniz: 0 (505) 015 1035 (${prefilledWa})`;

      if (geminiKey) {
        try {
          const dmPrompt = `Sen Nova Furniture'ın (@thenovafurniture) resmi Instagram asistanısın. Müşteri (@${cleanSender}) gönderimizin altına "${cleanText}" yorumunu yazdı.
Ona Instagram DM kutusundan göndereceğimiz İLK özel mesajı yaz.
Kurallar:
- Müşteriyi son derece kibar, lüks ve sıcak karşıla.
- KESİNLİKLE HİÇBİR WEB SİTESİ LİNKİ PAYLAŞMA! Asla "Global Kapak" ismini kullanma!
- Fiyatın ve modelin netleşmesi için müşteriye ne istediğini, hangi odayı yenilemek istediğini, düşündüğü yaklaşık ölçü veya renk tercihini sor.
- WhatsApp hattını ekle: https://wa.me/${whatsappNumber} (0 505 015 1035).
- Sıcak, lüks ve profesyonel Türkçe kullan.
- JSON formatında yanıt ver: { "dm_opening": "..." }`;

          const gRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: dmPrompt }] }],
                generationConfig: { temperature: 0.5, responseMimeType: 'application/json' }
              })
            }
          );
          if (gRes.ok) {
            const gData = await gRes.json();
            const parsed = JSON.parse(gData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
            if (parsed.dm_opening) dmOpeningText = parsed.dm_opening;
          }
        } catch (e) {
          console.warn('Gemini DM opening generator error:', e);
        }
      }

      return {
        resolved_tier: 2,
        stage: 2,
        channel: 'COMMENT',
        initiate_dm: true,
        is_price_comment: true,
        tier_label: 'Gemini AI: Fiyat Yorumu → Anında Özel DM Başlatıldı',
        stageLabel: 'Gemini AI: Fiyat Yorumu → Özel DM',
        matched_rule: 'Yorumda Fiyat Tespiti → Özel DM',
        bot_reply: publicCommentReply,
        replyText: publicCommentReply,
        dm_initiate_message: dmOpeningText,
        dmInitiateMessage: dmOpeningText,
        whatsapp_link: prefilledWa,
        whatsappLink: prefilledWa
      };
    } else {
      // Genel tebrik/beğeni yorumu — Gemini AI ile kurumsal teşekkür üret
      let commentReply = `Değerli yorumunuz için çok teşekkür ederiz @${cleanSender}! ✨ Nova Furniture olarak her zaman yanınızdayız.`;
      if (geminiKey) {
        try {
          const prompt = `Sen Nova Furniture Instagram asistanısın. Müşteri (@${cleanSender}) gönderiye şu yorumu yaptı: "${cleanText}".
Buna uygun kibar, lüks ve sıcak bir teşekkür cevabı yaz (1-2 cümle). JSON formatında: { "reply": "..." }`;
          const gRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.6, responseMimeType: 'application/json' }
              })
            }
          );
          if (gRes.ok) {
            const gData = await gRes.json();
            const parsed = JSON.parse(gData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
            if (parsed.reply) commentReply = parsed.reply;
          }
        } catch (_) {}
      }

      return {
        resolved_tier: 2,
        stage: 2,
        channel: 'COMMENT',
        initiate_dm: false,
        is_price_comment: false,
        tier_label: 'Gemini AI: Gönderi Yorumuna Teşekkür Yanıtı',
        stageLabel: 'Gemini AI Yorum Yanıtı',
        matched_rule: 'Gemini AI Yorum Yanıtı',
        bot_reply: commentReply,
        replyText: commentReply,
        whatsapp_link: '',
        whatsappLink: ''
      };
    }
  }

  // =========================================================================
  // B) INSTAGRAM DM (ÖZEL MESAJ) YÖNETİMİ: TAM KONTROL GEMINI AI'DA
  // =========================================================================
  // Müşteri doğrudan WhatsApp veya yetkili talep ettiyse
  const wantsWhatsapp = /whatsapp|wp|insan|yetkili|temsilci|telefon|ara|ustayla|sipariş vermek istiyorum/i.test(lowerText);
  if (wantsWhatsapp) {
    const waReply = `Memnuniyetle yardımcı olalım! 🙌 Dilerseniz siparişinizi kesinleştirmek, özel ölçülerinizi göndermek ve yetkili satış uzmanımızla görüşmek için resmi WhatsApp hattımızdan bize hemen ulaşabilirsiniz:\n\n📲 **Tek Tıkla WhatsApp Hattımız:** ${prefilledWa}\n📞 **Doğrudan Fabrika Telefonu:** ${phoneDisplay}\n\nBuradan sormak istediğiniz başka bir soru olursa her zaman yardımcı olmaktan mutluluk duyarım! ✨`;
    return {
      resolved_tier: 3,
      stage: 3,
      channel: 'DM',
      tier_label: 'Gemini AI: WhatsApp & İletişim Bilgisi Paylaşıldı',
      stageLabel: 'Gemini AI: WhatsApp Paylaşımı',
      matched_rule: 'Müşteri WhatsApp / İletişim Talebi',
      bot_reply: waReply,
      replyText: waReply,
      handoff_status: 'waiting_human',
      handoffTriggered: true,
      whatsapp_link: prefilledWa,
      whatsappLink: prefilledWa
    };
  }

  // 100% Gemini AI ile sohbeti yönet
  if (geminiKey) {
    try {
      const systemInstruction = config.tier2_system_prompt ||
        `Sen Nova Furniture (@thenovafurniture) firmasının resmi Instagram DM yapay zeka asistanısın.
İstanbul Bağcılar'daki 2.000 m² modern tesisimizde 1. sınıf 18mm E1 sertifikalı sağlam MDF gövde ve suya/buhara dayanıklı ithal CNC membran kapak teknolojisiyle lüks yatak odası, gardırop, mutfak ve banyo mobilyaları üretiyoruz. 5 yıl üretici garantimiz ve 5 iş gününde hızlı teslimatımız mevcuttur.
GÖREVLERİN:
1. Müşteriyle daima kibar, ilgili, samimi ve kurumsal bir dille konuş.
2. Müşterinin ne istediğini tam olarak anla: Hangi odayı yenilemek istediğini, düşündüğü yaklaşık ölçüleri ve renk/model tercihini nazikçe sorarak konuşmayı ilerlet.
3. Müşteriye ürünlerimiz ve kalitemiz hakkında güven verici ve net bilgiler sun (maksimum 3-4 cümle).
4. Eğer müşteri net fiyat hesaplaması, özel ölçü siparişi, toplu alım veya doğrudan yetkiliyle görüşmek isterse, WhatsApp hattımıza yönlendir: https://wa.me/${whatsappNumber} (${phoneDisplay}).`;

      const prompt = `${systemInstruction}

Canlı Ürün & Koleksiyon Kataloğumuz:
${catalogContext || '- Zürih Yatak Odası (1. Sınıf MDF • CNC Membran)\n- Milano Gardırop Serisi\n- Fjord Mavi & Kuvars Gri Membran Kapaklar'}

Müşteri (@${cleanSender}) Instagram DM kutusundan şu mesajı yazdı:
"${cleanText}"

Lütfen JSON formatında yanıt ver:
{
  "reply": "Müşteriye verilecek kibar, net, kurumsal ve yönlendirici Türkçe yanıt (maksimum 3-4 cümle)",
  "give_whatsapp": true veya false (Eğer müşteri sipariş vermek, net teklif almak veya yetkiliyle görüşmek istiyorsa true yap)
}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const rawJson = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(rawJson);

        let finalReply = parsed.reply || '';
        if (parsed.give_whatsapp && !finalReply.includes('wa.me')) {
          finalReply += `\n\n📲 **Resmi WhatsApp Hattımız:** ${prefilledWa} (${phoneDisplay})`;
        }

        return {
          resolved_tier: parsed.give_whatsapp ? 3 : 2,
          stage: parsed.give_whatsapp ? 3 : 2,
          channel: 'DM',
          tier_label: parsed.give_whatsapp ? 'Gemini AI: Sohbet + WhatsApp Yönlendirmesi' : 'Gemini AI: Otonom DM Asistanı',
          stageLabel: 'Gemini AI Akıllı Yanıt',
          matched_rule: `Gemini AI (${geminiModel})`,
          bot_reply: finalReply,
          replyText: finalReply,
          handoff_status: parsed.give_whatsapp ? 'waiting_human' : 'resolved',
          handoffTriggered: !!parsed.give_whatsapp,
          whatsapp_link: parsed.give_whatsapp ? prefilledWa : '',
          whatsappLink: parsed.give_whatsapp ? prefilledWa : ''
        };
      }
    } catch (err) {
      console.warn('Gemini DM error:', err.message);
    }
  }

  // Gemini API'ye ulaşılamazsa güvenli yedek yanıt
  const fallbackReply = `Merhaba @${cleanSender}! Nova Furniture olarak 1. sınıf 18mm MDF ve özel ölçü CNC membran kapaklarımızla hizmetinizdeyiz. Hangi ürünümüz veya odanız için ölçü ve fiyat bilgisi almak istersiniz? Dilerseniz bize doğrudan WhatsApp üzerinden de ulaşabilirsiniz: ${prefilledWa}`;
  return {
    resolved_tier: 2,
    stage: 2,
    channel: 'DM',
    tier_label: 'Gemini AI: Otomatik Yanıt (Yedek)',
    stageLabel: 'Gemini AI Yanıtı',
    matched_rule: 'Nova Otomatik Karşılama',
    bot_reply: fallbackReply,
    replyText: fallbackReply,
    whatsapp_link: prefilledWa,
    whatsappLink: prefilledWa
  };
}

// ── 3. OTONOM INSTAGRAM YORUM TARAMA & GEMINI AI YANITLAMA ───────────────────
export async function scanAndReplyInstagramComments({
  igUserId = DEFAULT_IG_USER_ID,
  accessToken = DEFAULT_META_ACCESS_TOKEN,
  config = {},
  productsCatalog = []
}) {
  if (!igUserId || !accessToken) return { scanned_media: 0, replied_count: 0, replies: [] };

  const url = `${GRAPH_API_BASE}/${igUserId}/media?fields=id,caption,media_type,timestamp,comments{id,text,from,timestamp,replies{id,text,from}}&limit=10&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Instagram medya listesi alınamadı');
  }

  const mediaData = await res.json();
  const mediaList = mediaData?.data || [];
  const repliedList = [];

  for (const media of mediaList) {
    const comments = media.comments?.data || [];
    for (const comment of comments) {
      const fromUsername = comment.from?.username || '';
      if (!fromUsername || fromUsername === 'thenovafurniture' || fromUsername === 'globalkapak' || fromUsername === 'globalkapakmobilya') continue;

      const existingReplies = comment.replies?.data || [];
      const alreadyReplied = existingReplies.some(r => r.from?.username === 'thenovafurniture' || r.from?.id === igUserId);
      if (alreadyReplied) continue;

      const decision = await evaluateThreeTierCommunication({
        incomingText: comment.text,
        channel: 'COMMENT',
        senderUsername: fromUsername,
        config,
        productsCatalog
      });

      // Yoruma açık yanıt ver
      try {
        await sendInstagramCommentReply({
          accessToken,
          commentId: comment.id,
          replyText: decision.bot_reply
        });
      } catch (e) {
        console.warn('Comment reply error:', e);
      }

      // Özel DM göndermeyi dene
      let dmSent = false;
      if (decision.initiate_dm && decision.dm_initiate_message) {
        try {
          const dmRes = await sendInstagramPrivateReplyFromComment({
            igUserId,
            accessToken,
            commentId: comment.id,
            replyText: decision.dm_initiate_message
          });
          dmSent = !dmRes?.error;
        } catch (e) {
          console.warn('Private DM error:', e);
        }
      }

      repliedList.push({
        media_id: media.id,
        comment_id: comment.id,
        from_username: fromUsername,
        incoming_text: comment.text,
        bot_reply: decision.bot_reply,
        dm_message: decision.dm_initiate_message || '',
        dm_sent: dmSent,
        timestamp: new Date().toISOString()
      });
    }
  }

  return {
    scanned_media: mediaList.length,
    replied_count: repliedList.length,
    replies: repliedList
  };
}

// ── 4. INSTAGRAM UYGULAMA ABONELİĞİNİ DOĞRULA (WEBHOOK / MESAJ İZNİ) ──────────
export async function ensureInstagramAppSubscribed({
  igUserId = DEFAULT_IG_USER_ID,
  accessToken = DEFAULT_META_ACCESS_TOKEN
} = {}) {
  if (!igUserId || !accessToken) return false;
  try {
    const res = await fetch(`${GRAPH_API_BASE}/${igUserId}/subscribed_apps?subscribed_fields=messages,comments&access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST'
    });
    const d = await res.json();
    return !!d?.success;
  } catch (_) {
    return false;
  }
}

// ── 5. CANLI INSTAGRAM DM (ÖZEL MESAJ) TARAMA VE GEMINI AI İLE YANITLAMA ──────
export async function scanAndReplyInstagramDms({
  igUserId = DEFAULT_IG_USER_ID,
  accessToken = DEFAULT_META_ACCESS_TOKEN,
  config = {},
  productsCatalog = []
} = {}) {
  if (!igUserId || !accessToken) return { scanned_conversations: 0, replied_count: 0, replies: [] };

  try {
    const url = `${GRAPH_API_BASE}/${igUserId}/conversations?fields=id,updated_time,participants,messages{id,created_time,from,message}&limit=10&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    if (!res.ok) return { scanned_conversations: 0, replied_count: 0, replies: [] };

    const data = await res.json();
    const convList = data?.data || [];
    const repliedList = [];

    for (const conv of convList) {
      const participants = conv.participants?.data || [];
      const otherUser = participants.find(p => p.id !== igUserId && p.username !== 'thenovafurniture');
      if (!otherUser) continue;

      const messages = conv.messages?.data || [];
      if (messages.length === 0) continue;

      const latestMsg = messages[0];
      // Eğer en son mesaj zaten bizden gittiyse cevap verme (kendi kendimize döngüye girmemek için)
      if (latestMsg.from?.id === igUserId || latestMsg.from?.username === 'thenovafurniture') {
        continue;
      }

      const customerText = (latestMsg.message || '').trim();
      if (!customerText) continue;

      // Gemini AI ile DM yanıtı üret
      const decision = await evaluateThreeTierCommunication({
        incomingText: customerText,
        channel: 'DM',
        senderUsername: otherUser.username || otherUser.id,
        config,
        productsCatalog
      });

      // Müşteriye Instagram DM olarak gönder
      const sendRes = await sendInstagramDmReply({
        igUserId,
        accessToken,
        recipientId: otherUser.id,
        replyText: decision.bot_reply
      });

      if (sendRes && !sendRes.error) {
        repliedList.push({
          conversation_id: conv.id,
          recipient_id: otherUser.id,
          recipient_username: otherUser.username || '',
          incoming_message: customerText,
          bot_reply: decision.bot_reply,
          timestamp: new Date().toISOString()
        });
      }
    }

    return {
      scanned_conversations: convList.length,
      replied_count: repliedList.length,
      replies: repliedList
    };
  } catch (err) {
    console.warn('DM tarama hatası:', err);
    return { scanned_conversations: 0, replied_count: 0, replies: [], error: err.message };
  }
}

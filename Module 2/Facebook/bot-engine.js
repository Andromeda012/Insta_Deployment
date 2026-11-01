/**
 * GLOBAL KAPAK MOBİLYA — MODULE 2: FACEBOOK BULUT BOT MOTORU (bot-engine.js)
 *
 * Özellikler:
 * 1. 7/24 Bulut Sunucu Uyumlu (Cihaz bağımsız çalışır, tüm durumunu Supabase `fb_bot_state` içinde tutar).
 * 2. %100 Otonom İçerik Tasarım & Üretim Motoru (Sıfır Fotoğraf/Video Girişi):
 *    - Facebook ekosistemine özel 4 gönderi formatını kendi kendine tasarlar ve üretir:
 *      a) 🖼️ Kurumsal Katalog & Fotoğraf Gönderisi (PHOTO_POST - 1200x630 Yatay / 1080x1080 Kare)
 *      b) 🎬 Facebook Reels & Üretim Videosu (FB_REELS - 1080x1920 Dikey 9:16)
 *      c) 📱 Facebook Sayfa Hikayesi (FB_STORIES - 1080x1920 Dikey 9:16)
 *      d) 🔗 Tıklanabilir B2B & Tasarım Modu Bağlantı Kartı (LINK_CARD - 1200x630 Geniş Ekran)
 * 3. Onaysız Otomatik Paylaşım Motoru:
 *    - Belirlenen saat aralıklarında (örn. 09:30 Katalog Kartı, 13:30 Facebook Story, 16:30 B2B Bağlantı Postu, 20:00 Facebook Reels)
 *      hiçbir manuel onay beklemeden doğrudan Meta Facebook Page Graph API üzerinden yayınlar.
 * 4. 3 Aşamalı Akıllı İletişim (Facebook Messenger DM & Gönderi Yorumları):
 *    - 1. Aşama (Basit Sorular): Anahtar kelime eşleşmesi ile milisaniyeler içinde sabit kurumsal cevap.
 *    - 2. Aşama (Karmaşık & Teknik Sorular): Supabase'deki canlı ürün kataloğunu bilen Gemini AI devreye girer.
 *    - 3. Aşama (Gerçek İnsan & WhatsApp Devri): Sipariş, özel ölçü fiyatlandırma, B2B bayilik veya yetkili talebinde
 *      müşteriyi otomatik hazır mesajlı WhatsApp hattına (+90 505 015 1035) ve telefon iletişimine yönlendirir.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
export const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || '';
export const DEFAULT_SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
export const DEFAULT_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ── FACEBOOK MİMARİ RENK PALETLERİ & OTONOM TASARIM TEMALARI ─────────────────
export const FB_AUTONOMOUS_THEMES = [
  {
    id: 'fb-corporate-blue',
    name: 'Kurumsal Facebook Mavisi & Çelik',
    bgStart: '#0A192F',
    bgMid: '#153462',
    bgEnd: '#1877F2',
    accent: '#60A5FA',
    badgeBg: 'rgba(24, 119, 242, 0.25)',
    doorColor: '#1E3F66',
    doorStroke: '#93C5FD',
    swatches: ['#1E3F66', '#1877F2', '#64748B', '#3B6E5C', '#F8FAFC']
  },
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
    name: 'Kuvars Gri & B2B Endüstriyel CNC',
    bgStart: '#0F172A',
    bgMid: '#1E293B',
    bgEnd: '#334155',
    accent: '#38BDF8',
    badgeBg: 'rgba(56, 189, 248, 0.18)',
    doorColor: '#475569',
    doorStroke: '#93C5FD',
    swatches: ['#475569', '#1E3A8A', '#3B6E5C', '#E2E8F0', '#94A3B8']
  }
];

// ── FACEBOOK ÖZEL OTONOM KONSEPT ŞABLONLARI (B2B, MİMARİ, KATALOG, REELS) ────
export const FB_CONCEPT_LIBRARY = [
  {
    conceptType: 'B2B_FACTORY_PARTNER',
    badge: 'NOVA FURNITURE • ÖZEL & LÜKS ÜRETİM',
    headline: 'PROJELERİNİZ İÇİN ÖZEL ÖLÇÜ CNC MOBİLYA VE KAPAK',
    subheadline: 'Modern Üretim Tesisi • 18mm 1. Sınıf E1 MDF • Türkiye Geneli Sevkiyat',
    doorStyle: 'shaker',
    specs: ['5 İş Gününde Teslim', '5 Yıl Garanti', 'Özel Ölçü Tasarım'],
    caption: '🏭 Mutfak, banyo, gardırop ve yatak odası projelerinizde termin gecikmelerine ve kalite sorunlarına son!\n\nNova Furniture olarak modern yüksek teknolojili tesisimizde, 0.01 mm 5 eksen CNC hassasiyetiyle özel ölçü mobilya ve membran kapaklar üretiyoruz.\n\n✅ 1. Sınıf 18mm E1 Sertifikalı MDF\n✅ Suya, Buhara ve Isıya Dayanıklı İthal Membran Yüzey\n✅ 5 Yıl Üretici Garantisi & Hızlı Teslimat\n\n📲 Özel Fiyat Teklifi ve Dijital Katalog İçin WhatsApp Hattımız: 0 (505) 015 1035\n📩 Veya detaylı bilgi için bize doğrudan mesaj (DM) gönderebilirsiniz.',
    hashtags: '#novafurniture #thenovafurniture #mobilyatasarim #luxuryfurniture #evdekorasyonu #icmimari #ozelolcumobilya #mutfakdolabi'
  },
  {
    conceptType: 'INTERACTIVE_DESIGN_LINK',
    badge: 'NOVA 2026 ÖZEL RENK & MODEL KOLEKSİYONU',
    headline: 'DOLAP ÖLÇÜNÜZÜ İLETİN, MODEL VE RENGİ ÖZEL PLANLAYALIM!',
    subheadline: 'Fjord Mavi • Kuvars Gri • Adaçayı Yeşili • Kutup Beyazı • 50+ Renk',
    doorStyle: 'diagonal',
    specs: ['Kişiye Özel Tasarım', '50+ Renk Kartelası', 'Milimetrik Özel Ölçü'],
    caption: '🎨 Yaşam alanınıza hangi dolap modelinin ve rengin yakışacağını keşfedin!\n\nFjord Mavi, Adaçayı Yeşili, Kuvars Gri ve Kutup Beyazı dahil 50’den fazla renk ve yüzey alternatifimiz hakkında bilgi almak, numune veya katalog talep etmek için bize dilediğiniz zaman ulaşabilirsiniz.\n\n📲 WhatsApp Sipariş & Destek: 0 (505) 015 1035\n📩 DM üzerinden de oda ölçülerinizi hemen iletebilirsiniz.',
    hashtags: '#novafurniture #thenovafurniture #mobilyatasarim #renkkartelasi #luxuryfurniture #evdekorasyonu #icmimari'
  },
  {
    conceptType: 'CNC_REELS_SHOWCASE',
    badge: '0.01 MM CNC İŞLEME & VAKUM MEMBRAN TEKNOLOJİSİ',
    headline: 'KUSURSUZ YÜZEY, 5 YIL KABARMA & SOYULMA GARANTİSİ',
    subheadline: 'Anti-Fingerprint (Parmak İzi Bırakmayan) Mat ve Doğal Ahşap Dokular',
    doorStyle: 'fluted',
    specs: ['0.01mm CNC Kesim', 'Anti-Fingerprint', '5 Yıl Tam Garanti'],
    caption: '✨ Kalite detaylarda gizlidir! Dikey fugalı (fluted), çerçeveli country ve modern kapak modellerimizle yaşam alanlarınıza değer katıyoruz.\n\n🛡️ 5 Yıl Üretici Garantisi\n🚚 Hızlı Üretim & Güvenli Ambalajlı Sevkiyat\n📲 WhatsApp Katalog & Fiyat Hattı: 0 (505) 015 1035\n📩 Özel proje teklifleri için doğrudan mesaj atabilirsiniz.',
    hashtags: '#novafurniture #thenovafurniture #mobilyatasarim #luxuryfurniture #evdekorasyonu #ozelolcumobilya #facebookreels'
  }
];

// ── VARSAYILAN 1. AŞAMA SABİT CEVAP KURALLARI (MESSENGER + FACEBOOK YORUM) ───
export const DEFAULT_FB_TIER1_RULES = [
  {
    id: 'fb-rule-greeting',
    rule_name: 'Facebook Messenger & Yorum Karşılama',
    keywords: ['merhaba', 'selam', 'iyi günler', 'iyi çalışmalar', 'kolay gelsin', 'slm', 'mrb'],
    match_type: 'exact',
    channel_scope: 'BOTH',
    response_text: 'Merhaba! 👋 Nova Furniture (@thenovafurniture) resmi sayfasına hoş geldiniz. Özel ölçü mobilya, gardırop, yatak odası, mutfak ve banyo modellerimiz veya renk kartelamız hakkında size nasıl yardımcı olabilirim?',
    escalate_to_tier3: false,
    priority: 5,
    active: true
  },
  {
    id: 'fb-rule-delivery',
    rule_name: 'Teslimat Süresi & Şehir Dışı Ambalajlı Kargo',
    keywords: ['teslimat', 'kaç günde', 'ne zaman çıkar', 'termin', 'kargo', 'şehir dışı', 'sevkiyat', 'nakliye'],
    match_type: 'contains',
    channel_scope: 'BOTH',
    response_text: '🚚 Tüm özel ölçü mobilya ve kapak siparişlerimizi modern fabrikamızda ortalama **5 iş günü** içinde üretip sevkiyata hazır hale getiriyoruz. İstanbul içi güvenli teslimat, Türkiye geneline ise darbe korumalı özel ambalajla sigortalı sevkiyatımız mevcuttur.',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  },
  {
    id: 'fb-rule-warranty',
    rule_name: 'Garanti, Buhar Dayanımı & MDF Kalitesi',
    keywords: ['garanti', 'kabarma', 'soyulma', 'suya dayanıklı', 'buhar', 'mdf', 'kalite', 'folyo'],
    match_type: 'contains',
    channel_scope: 'BOTH',
    response_text: '🛡️ Ürünlerimizde 1. sınıf 18mm E1 sertifikalı MDF gövde ve yüksek ısı/neme dayanıklı ithal membran yüzey teknolojisi kullanıyoruz. Tüm ürünlerimiz kabarma ve soyulmaya karşı **5 Yıl Üretici Garantisi** altındadır.',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  },
  {
    id: 'fb-rule-address',
    rule_name: 'Fabrika Adres, Konum & Çalışma Saatleri',
    keywords: ['adres', 'nerede', 'konum', 'yeriniz', 'hangi semt', 'çalışma saat', 'kaça kadar', 'showroom'],
    match_type: 'contains',
    channel_scope: 'BOTH',
    response_text: '📍 Showroom ve Üretim Tesisimiz İstanbul’dadır. Hafta içi ve Cumartesi 08:30 – 18:30 saatleri arasında randevuyla ziyaret edebilir veya WhatsApp üzerinden konum talep edebilirsiniz: 0 (505) 015 1035.',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  },
  {
    id: 'fb-rule-catalog',
    rule_name: 'Renk Kartelası & Katalog Talebi',
    keywords: ['renk', 'kartela', 'katalog', 'modeller', 'çeşit', 'mat mavi', 'adaçayı', 'antrasit', 'tasarım'],
    match_type: 'contains',
    channel_scope: 'BOTH',
    response_text: '🎨 Fjord Mavi Mat, Kuvars Gri, Adaçayı Yeşili, Kutup Beyazı ve Doğal Meşe dahil 50+ renk seçeneğimiz mevcuttur. Detaylı dijital kataloğumuz ve numune talepleri için bize DM atabilir veya doğrudan WhatsApp hattımızdan yazabilirsiniz: 0 (505) 015 1035',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  }
];

// ── VARSAYILAN 3. AŞAMA (İNSAN / WHATSAPP DEVİR) TETİKLEYİCİLERİ ───────────
export const DEFAULT_FB_TIER3_TRIGGERS = [
  'sipariş vermek',
  'fiyat teklifi',
  'net fiyat',
  'm2 fiyatı',
  'metrekare fiyatı',
  'kaç tl',
  'ne kadar tutar',
  'özel ölçü fiyat',
  'toptan fiyat',
  'bayilik',
  'müteahhit',
  'proje fiyatı',
  'yetkili',
  'temsilci',
  'insanla görüşmek',
  'ustayla görüşmek',
  'toplu alım',
  'şikayet',
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

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Facebook gönderi formatlarına özel (1200x630 Yatay Katalog/Bağlantı Kartı veya
 * 1080x1920 Dikey Facebook Reels / Story) otonom SVG/Görsel üretir.
 * Herhangi bir fotoğraf veya video yüklenmesine gerek yoktur!
 */
export function renderAutonomousFacebookSvg({
  mediaType = 'PHOTO_POST', // 'PHOTO_POST' | 'LINK_CARD' | 'FB_REELS' | 'FB_STORIES'
  badge = 'NOVA FURNITURE • KURUMSAL FACEBOOK YAYINI',
  headline = 'ÖZEL ÖLÇÜ CNC MEMBRAN KAPAK & MOBİLYA KOLEKSİYONU',
  subheadline = '18mm E1 MDF • Suya & Buhara Dayanıklı • 5 İş Gününde Teslim',
  specs = ['5 İş Gününde Teslim', '5 Yıl Garanti', 'Özel Ölçü Tasarım'],
  doorStyle = 'shaker',
  theme = FB_AUTONOMOUS_THEMES[0]
}) {
  const upper = (mediaType || 'PHOTO_POST').toUpperCase();
  const isVertical = upper === 'FB_REELS' || upper === 'FB_STORIES' || upper === 'REELS' || upper === 'STORIES';
  const isLandscape = upper === 'LINK_CARD' || upper === 'PHOTO_POST';

  const width = isLandscape && !isVertical ? 1200 : 1080;
  const height = isVertical ? 1920 : (isLandscape ? 630 : 1080);

  if (isLandscape && !isVertical) {
    // 1200x630 Facebook Geniş Ekran Kurumsal Sunum & Katalog Kartı (Sol: Metin & Rozetler, Sağ: 3B CNC Kapak & Kartela)
    const doorW = 250;
    const doorH = 430;
    const doorX = 830;
    const doorY = 85;

    let doorPattern = '';
    if (doorStyle === 'diagonal') {
      doorPattern = `
        <rect x="${doorX + 22}" y="${doorY + 22}" width="${doorW - 44}" height="${doorH - 44}" rx="8" fill="none" stroke="${theme.doorStroke}" stroke-width="2.5" stroke-opacity="0.6"/>
        <line x1="${doorX + 22}" y1="${doorY + 22}" x2="${doorX + doorW - 22}" y2="${doorY + doorH - 22}" stroke="${theme.doorStroke}" stroke-width="2" stroke-opacity="0.5"/>
        <line x1="${doorX + doorW - 22}" y1="${doorY + 22}" x2="${doorX + 22}" y2="${doorY + doorH - 22}" stroke="${theme.doorStroke}" stroke-width="2" stroke-opacity="0.5"/>
      `;
    } else if (doorStyle === 'fluted') {
      const fl = [];
      for (let x = doorX + 24; x < doorX + doorW - 20; x += 18) {
        fl.push(`<line x1="${x}" y1="${doorY + 18}" x2="${x}" y2="${doorY + doorH - 18}" stroke="${theme.doorStroke}" stroke-width="2" stroke-opacity="0.45"/>`);
      }
      doorPattern = fl.join('');
    } else {
      doorPattern = `
        <rect x="${doorX + 24}" y="${doorY + 24}" width="${doorW - 48}" height="${Math.round(doorH * 0.54)}" rx="6" fill="none" stroke="${theme.doorStroke}" stroke-width="3" stroke-opacity="0.7"/>
        <rect x="${doorX + 24}" y="${doorY + Math.round(doorH * 0.62)}" width="${doorW - 48}" height="${Math.round(doorH * 0.28)}" rx="6" fill="none" stroke="${theme.doorStroke}" stroke-width="3" stroke-opacity="0.7"/>
      `;
    }

    const headWords = headline.split(' ');
    const mid = Math.ceil(headWords.length / 2);
    const hLine1 = headWords.length > 4 ? headWords.slice(0, mid).join(' ') : headline;
    const hLine2 = headWords.length > 4 ? headWords.slice(mid).join(' ') : '';

    const swatchesSvg = (theme.swatches || []).map((c, idx) =>
      `<circle cx="${doorX + 35 + idx * 44}" cy="${doorY + doorH + 42}" r="14" fill="${c}" stroke="#fff" stroke-width="2.5"/>`
    ).join('');

    const specsSvg = (specs || []).slice(0, 3).map((s, idx) => `
      <rect x="${70 + idx * 225}" y="435" width="210" height="44" rx="22" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
      <text x="${175 + idx * 225}" y="463" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="700" text-anchor="middle">✓ ${escapeXml(s)}</text>
    `).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <linearGradient id="fbBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.bgStart}"/>
          <stop offset="55%" stop-color="${theme.bgMid}"/>
          <stop offset="100%" stop-color="${theme.bgEnd}"/>
        </linearGradient>
        <linearGradient id="fbDoor" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.doorColor}"/>
          <stop offset="100%" stop-color="${theme.bgMid}"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#fbBg)"/>
      <g stroke="rgba(255,255,255,0.05)" stroke-width="1">
        <line x1="740" y1="0" x2="740" y2="630"/>
        <line x1="0" y1="540" x2="1200" y2="540"/>
      </g>

      <!-- Sol Kısım: Kurumsal Başlık & CTA -->
      <rect x="70" y="68" width="520" height="40" rx="20" fill="${theme.badgeBg}" stroke="${theme.accent}" stroke-width="1.5"/>
      <text x="330" y="94" fill="${theme.accent}" font-family="sans-serif" font-size="16" font-weight="800" text-anchor="middle" letter-spacing="1.5">${escapeXml(badge)}</text>

      <text x="70" y="175" fill="#FFFFFF" font-family="sans-serif" font-size="36" font-weight="900">${escapeXml(hLine1)}</text>
      ${hLine2 ? `<text x="70" y="222" fill="#FFFFFF" font-family="sans-serif" font-size="36" font-weight="900">${escapeXml(hLine2)}</text>` : ''}

      <text x="70" y="${hLine2 ? 275 : 235}" fill="#CBD5E1" font-family="sans-serif" font-size="20" font-weight="500">${escapeXml(subheadline.slice(0, 68))}</text>

      <!-- Canlı WhatsApp İletişim Kutusu -->
      <rect x="70" y="320" width="610" height="82" rx="14" fill="rgba(15, 23, 42, 0.55)" stroke="rgba(147, 197, 253, 0.35)" stroke-width="1.5"/>
      <text x="95" y="355" fill="#93C5FD" font-family="sans-serif" font-size="16" font-weight="800">📲 NOVA FURNITURE • ÖZEL ÖLÇÜ &amp; DİJİTAL KATALOG HATTI</text>
      <text x="95" y="383" fill="#F8FAFC" font-family="sans-serif" font-size="18" font-weight="700">WhatsApp: 0 (505) 015 1035   •   DM: @thenovafurniture</text>

      ${specsSvg}

      <!-- Sağ Kısım: 3B CNC Membran Kapak Önizlemesi -->
      <rect x="${doorX - 14}" y="${doorY - 14}" width="${doorW + 28}" height="${doorH + 28}" rx="20" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
      <rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}" rx="14" fill="url(#fbDoor)" stroke="${theme.doorStroke}" stroke-width="3.5"/>
      ${doorPattern}
      <rect x="${doorX + doorW - 20}" y="${doorY + Math.round(doorH / 2) - 35}" width="7" height="70" rx="3.5" fill="#F8FAFC"/>
      ${swatchesSvg}

      <!-- Alt İmza -->
      <text x="70" y="592" fill="#94A3B8" font-family="sans-serif" font-size="17" font-weight="700">📘 Nova Furniture Resmi Facebook Sayfası   |   📞 0 (505) 015 1035   |   🛡️ 5 Yıl Üretici Garantisi</text>
    </svg>`;
  }

  // Dikey (1080x1920) Facebook Reels & Facebook Story Tasarımı
  const doorW = 460;
  const doorH = 760;
  const doorX = Math.round((width - doorW) / 2);
  const doorY = 520;

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
    doorPatternSvg = `
      <rect x="${doorX + 34}" y="${doorY + 34}" width="${doorW - 68}" height="${Math.round(doorH * 0.56)}" rx="8" fill="none" stroke="${theme.doorStroke}" stroke-width="3.5" stroke-opacity="0.65"/>
      <rect x="${doorX + 34}" y="${doorY + Math.round(doorH * 0.64)}" width="${doorW - 68}" height="${Math.round(doorH * 0.28)}" rx="8" fill="none" stroke="${theme.doorStroke}" stroke-width="3.5" stroke-opacity="0.65"/>
    `;
  }

  const swatchesSvg = (theme.swatches || []).map((color, idx) => {
    const sx = Math.round(width / 2 - ((theme.swatches.length * 58) / 2) + idx * 58);
    const sy = doorY + doorH + 70;
    return `<circle cx="${sx + 22}" cy="${sy}" r="18" fill="${color}" stroke="#ffffff" stroke-width="3"/>`;
  }).join('');

  const specsY = 1480;
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
    <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
    <rect x="${Math.round((width - 560) / 2)}" y="110" width="560" height="48" rx="24" fill="${theme.badgeBg}" stroke="${theme.accent}" stroke-width="1.5"/>
    <text x="${width / 2}" y="141" fill="${theme.accent}" font-family="sans-serif" font-size="20" font-weight="800" text-anchor="middle" letter-spacing="2">${escapeXml(badge)}</text>
    <text x="${width / 2}" y="235" fill="#FFFFFF" font-family="sans-serif" font-size="42" font-weight="900" text-anchor="middle">${escapeXml(headParts[0] || '')}</text>
    ${headParts[1] ? `<text x="${width / 2}" y="290" fill="#FFFFFF" font-family="sans-serif" font-size="42" font-weight="900" text-anchor="middle">${escapeXml(headParts[1].trim())}</text>` : ''}
    <text x="${width / 2}" y="355" fill="#CBD5E1" font-family="sans-serif" font-size="23" font-weight="500" text-anchor="middle">${escapeXml(subheadline)}</text>
    <rect x="${doorX - 14}" y="${doorY - 14}" width="${doorW + 28}" height="${doorH + 28}" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
    <rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}" rx="16" fill="url(#doorGrad)" stroke="${theme.doorStroke}" stroke-width="4"/>
    ${doorPatternSvg}
    <rect x="${doorX + doorW - 26}" y="${doorY + Math.round(doorH / 2) - 45}" width="8" height="90" rx="4" fill="#E2E8F0"/>
    ${swatchesSvg}
    ${specsSvg}
    <text x="${width / 2}" y="${height - 64}" fill="#94A3B8" font-family="sans-serif" font-size="22" font-weight="700" text-anchor="middle">📘 Nova Furniture   •   📲 WhatsApp: 0 (505) 015 1035   •   🛡️ 5 Yıl Garanti</text>
  </svg>`;
}

/**
 * Herhangi bir fotoğraf/video girişi olmadan Facebook gönderisini, hikayesini (Story),
 * B2B bağlantı kartını veya Facebook Reels videosunu kendi kendine tasarlar ve metnini yazar.
 */
export async function generateAutonomousFacebookContent({
  mediaType = 'PHOTO_POST', // 'PHOTO_POST' | 'FB_REELS' | 'FB_STORIES' | 'LINK_CARD'
  productsCatalog = [],
  config = {},
  slotLabel = ''
} = {}) {
  const theme = FB_AUTONOMOUS_THEMES[Math.floor(Math.random() * FB_AUTONOMOUS_THEMES.length)];
  const hasProducts = Array.isArray(productsCatalog) && productsCatalog.length > 0;
  const pickedProduct = hasProducts
    ? productsCatalog[Math.floor(Math.random() * productsCatalog.length)]
    : null;
  const fallbackConcept = FB_CONCEPT_LIBRARY[Math.floor(Math.random() * FB_CONCEPT_LIBRARY.length)];

  let badge = mediaType === 'FB_REELS'
    ? '📘 FACEBOOK REELS • NOVA ÖZEL ÜRETİM'
    : mediaType === 'FB_STORIES'
      ? '📘 FACEBOOK HİKAYE • GÜNLÜK ATÖLYE & RENK KARTELASI'
      : mediaType === 'LINK_CARD'
        ? '📘 ÖZEL TASARIM & MİMARİ PROJE • NOVA FURNITURE'
        : '📘 NOVA FURNITURE • KURUMSAL KATALOG';

  let headline = pickedProduct
    ? (pickedProduct.title || pickedProduct.slug || fallbackConcept.headline).toLocaleUpperCase('tr-TR')
    : fallbackConcept.headline;

  let subheadline = pickedProduct
    ? (pickedProduct.kisa_aciklama || `${pickedProduct.kategori || 'Özel Ölçü Mobilya & Kapak'} • 18mm E1 MDF • 5 Yıl Garanti`)
    : fallbackConcept.subheadline;

  let specs = ['5 İş Gününde Teslim', '5 Yıl Garanti', 'Özel Ölçü Tasarım'];
  let doorStyle = ['shaker', 'diagonal', 'fluted'][Math.floor(Math.random() * 3)];
  const targetUrl = 'https://wa.me/905050151035';

  let caption = pickedProduct
    ? `📘 ${pickedProduct.title || 'Özel Ölçü Mobilya & Membran Kapak'} — Nova Furniture Özel Tasarım Koleksiyonu!\n\n` +
      `${pickedProduct.kisa_aciklama || 'Modern üretim tesisimizde 0.01 mm CNC hassasiyeti ve 1. sınıf 18mm E1 MDF ile üretilmektedir.'}\n\n` +
      `✅ 5 Yıl Üretici Garantisi (Suya & Buhara Tam Dayanım)\n` +
      `✅ 5 İş Gününde Hızlı Üretim & Türkiye Geneli Güvenli Sevkiyat\n` +
      `✅ Mutfak, Banyo, Gardırop ve Yatak Odası İçin Milimetrik Özel Ölçü\n\n` +
      `📖 Dijital katalog, renk seçenekleri ve özel fiyat teklifi için bize ulaşın:\n` +
      `📲 WhatsApp Hattımız: 0 (505) 015 1035 (${targetUrl})\n` +
      `📩 Dilerseniz sayfamız üzerinden doğrudan mesaj (DM) iletebilirsiniz.`
    : fallbackConcept.caption;

  let hashtags = fallbackConcept.hashtags;

  const geminiKey = (config.gemini_api_key || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY).trim();
  if (geminiKey) {
    try {
      const geminiModel = config.gemini_model || 'gemini-2.5-flash';
      const aiPrompt = `Sen Nova Furniture'ın (@thenovafurniture) kurumsal Facebook sayfası içerik yöneticisisin.
Şirketimiz modern üretim tesisinde 1. sınıf 18mm E1 MDF üzerine 5 yıl garantili, 5 iş gününde teslim özel ölçü CNC mobilya, lüks gardırop, yatak odası, banyo ve mutfak kapakları üretiyor.
ÖNEMLİ KURAL: Kesinlikle hiçbir web sitesi linki paylaşma! Kesinlikle 'Global Kapak' veya '#globalkapak' kelimelerini KULLANMA! Sadece Nova Furniture markasını ve WhatsApp 0 (505) 015 1035 / DM yönlendirmesini kullan.
Format: ${mediaType} (${slotLabel || 'Otonom Facebook Yayını'})
Seçilen Ürün/Konu: ${pickedProduct ? `${pickedProduct.title} - ${pickedProduct.kisa_aciklama || ''}` : fallbackConcept.headline}

Lütfen Facebook tasarım kartının üzerine yazılacak başlıkları ve detaylı Facebook gönderi metnini JSON olarak üret:
{
  "badge": "Üst rozet (maks 36 karakter, büyük harf, NOVA FURNITURE vurgulu)",
  "headline": "Görsel üzerindeki ana başlık (maks 44 karakter, büyük harf)",
  "subheadline": "Görsel alt başlığı (maks 68 karakter)",
  "caption": "Facebook gönderi metni (kurumsal, bilgilendirici, lüks, katalog ve fiyat için WhatsApp 0505 015 1035 ve DM vurgulu, 3-4 paragraf)",
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
        const parsed = JSON.parse((((((gData || {}).candidates || [])[0] || {}).content || {}).parts || [{}])[0].text || '{}');
        if (parsed.badge) badge = parsed.badge;
        if (parsed.headline) headline = parsed.headline;
        if (parsed.subheadline) subheadline = parsed.subheadline;
        if (parsed.caption) caption = parsed.caption;
        if (parsed.hashtags) hashtags = parsed.hashtags;
      }
    } catch (_) {}
  }

  const svgContent = renderAutonomousFacebookSvg({
    mediaType,
    badge,
    headline,
    subheadline,
    specs,
    doorStyle,
    theme
  });

  const renderParams = new URLSearchParams({
    type: mediaType,
    badge,
    headline,
    subheadline,
    theme: theme.id,
    door: doorStyle
  });
  const dynamicRenderUrl = `https://insta-deployment-rho.vercel.app/api/facebook-render?${renderParams.toString()}`;

  return {
    id: `fb-auto-${mediaType.toLowerCase()}-${Date.now()}`,
    media_type: mediaType,
    title: `[Otonom Facebook] ${headline}`,
    badge,
    headline,
    subheadline,
    specs,
    door_style: doorStyle,
    theme_id: theme.id,
    theme,
    target_link: targetUrl,
    caption,
    hashtags,
    svg_markup: svgContent,
    media_url: dynamicRenderUrl,
    auto_designed: true,
    product_slug: (pickedProduct && pickedProduct.slug) || null
  };
}

// ── 1. FACEBOOK PAGE GRAPH API OTOMATİK PAYLAŞIM MOTORU (ONAYSIZ) ────────────
export async function publishToFacebookPageGraphApi({
  pageId,
  pageAccessToken,
  mediaType = 'PHOTO_POST', // 'PHOTO_POST' | 'FB_REELS' | 'FB_STORIES' | 'LINK_CARD'
  mediaUrl,
  caption = '',
  targetLink = 'https://wa.me/905050151035'
}) {
  const resolvedType = (mediaType || 'PHOTO_POST').toUpperCase();

  if (!pageId || !pageAccessToken) {
    const simId = `sim_fb_${resolvedType.toLowerCase()}_${Date.now()}`;
    return {
      simulated: true,
      mode: 'CLOUD_AUTONOMOUS_SIMULATION',
      postId: simId,
      publishedId: simId,
      publishedAt: new Date().toISOString(),
      note: 'Facebook Bulut Otonom Tasarım & Yayın (Canlı Page Access Token girildiğinde doğrudan Facebook Sayfasında yayınlanır)'
    };
  }

  // 1) LINK_CARD: Doğrudan tıklanabilir önizlemeli bağlantı paylaşımı (/{page-id}/feed)
  if (resolvedType === 'LINK_CARD') {
    const params = new URLSearchParams({
      message: caption,
      link: targetLink,
      access_token: pageAccessToken
    });
    const res = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: 'POST',
      body: params
    });
    const data = await res.json();
    if (!res.ok || !data.id) {
      throw new Error(data?.error?.message || 'Facebook Bağlantı Kartı paylaşımı başarısız oldu');
    }
    return {
      simulated: false,
      mode: 'LIVE_FB_FEED_LINK',
      postId: data.id,
      publishedId: data.id,
      publishedAt: new Date().toISOString()
    };
  }

  // 2) FB_STORIES: Facebook Sayfa Hikayesi (/{page-id}/photo_stories)
  if (resolvedType === 'FB_STORIES') {
    // Önce fotoğrafı unpublished olarak yükle, sonra photo_stories olarak yayınla
    const uploadParams = new URLSearchParams({
      url: mediaUrl,
      published: 'false',
      access_token: pageAccessToken
    });
    const upRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, { method: 'POST', body: uploadParams });
    const upData = await upRes.json();
    if (upRes.ok && upData.id) {
      const storyParams = new URLSearchParams({
        photo_id: upData.id,
        access_token: pageAccessToken
      });
      const stRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photo_stories`, { method: 'POST', body: storyParams });
      const stData = await stRes.json();
      if (stRes.ok && (stData.post_id || stData.success)) {
        return {
          simulated: false,
          mode: 'LIVE_FB_STORY',
          postId: stData.post_id || upData.id,
          publishedId: stData.post_id || upData.id,
          publishedAt: new Date().toISOString()
        };
      }
    }
  }

  // 3) PHOTO_POST veya Görsel Tabanlı FB_REELS: Doğrudan /{page-id}/photos üzerinden yüksek çözünürlüklü yayınla
  const photoParams = new URLSearchParams({
    url: mediaUrl,
    message: caption,
    access_token: pageAccessToken
  });
  const photoRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
    method: 'POST',
    body: photoParams
  });
  const photoData = await photoRes.json();
  if (!photoRes.ok || (!photoData.id && !photoData.post_id)) {
    throw new Error(photoData?.error?.message || 'Facebook Sayfa gönderisi yayınlanamadı');
  }

  return {
    simulated: false,
    mode: 'LIVE_FB_PAGE_PHOTO',
    postId: photoData.post_id || photoData.id,
    publishedId: photoData.post_id || photoData.id,
    publishedAt: new Date().toISOString()
  };
}

// ── FACEBOOK MESSENGER DM & SAYFA YORUM YANIT YARDIMCILARI ───────────────────
export async function sendFacebookMessengerReply({ pageId, pageAccessToken, recipientPsid, replyText }) {
  if (!pageId || !pageAccessToken || !recipientPsid) return { simulated: true };
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/messages?access_token=${encodeURIComponent(pageAccessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      messaging_type: 'RESPONSE',
      message: { text: replyText }
    })
  });
  return await res.json();
}

export async function sendFacebookCommentReply({ pageAccessToken, commentId, replyText }) {
  if (!pageAccessToken || !commentId) return { simulated: true };
  const params = new URLSearchParams({
    message: replyText,
    access_token: pageAccessToken
  });
  const res = await fetch(`${GRAPH_API_BASE}/${commentId}/comments`, {
    method: 'POST',
    body: params
  });
  return await res.json();
}

// ── 2. ÜÇ AŞAMALI FACEBOOK İLETİŞİM MOTORU (SABİT -> GEMINI AI -> WHATSAPP/İNSAN) ─
export async function evaluateFacebookThreeTierCommunication({
  incomingText,
  messageText,
  senderName = 'Facebook Kullanıcısı',
  channel = 'MESSENGER', // 'MESSENGER' | 'COMMENT'
  config = {},
  keywordRules = DEFAULT_FB_TIER1_RULES,
  productsCatalog = []
}) {
  const cleanText = (incomingText || messageText || '').trim();
  const lowerText = cleanText.toLocaleLowerCase('tr-TR');

  const whatsappNumber = config.tier3_whatsapp_number || '905050151035';
  const phoneDisplay = config.tier3_phone_display || '0 (505) 015 1035';
  const handoffTriggers = Array.isArray(config.tier3_handoff_triggers) && config.tier3_handoff_triggers.length > 0
    ? config.tier3_handoff_triggers
    : DEFAULT_FB_TIER3_TRIGGERS;

  // ÖN KONTROL: 3. Aşama (İnsan / Sipariş / Toptan B2B / Net Fiyat / WhatsApp)
  const directTier3Match = handoffTriggers.find(trigger => lowerText.includes(trigger.toLocaleLowerCase('tr-TR')));
  if (directTier3Match) {
    const prefilledWa = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Nova Furniture, Facebook sayfanızdan ulaşıyorum (${senderName}). Konu: "${cleanText}" hakkında detaylı bilgi ve fiyat teklifi almak istiyorum.`)}`;
    const reply = `Memnuniyetle yardımcı olalım! 🙌 Talebiniz (**"${directTier3Match}"**) özel ölçü hesaplaması ve birebir müşteri temsilcisi desteği gerektirdiği için sizi doğrudan **Satış & Üretim Ekibimize** bağlıyorum.\n\n📲 **Tek Tıkla WhatsApp Destek:** ${prefilledWa}\n📞 **Fabrika Doğrudan Hat:** ${phoneDisplay}`;
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

  // 1. AŞAMA: Basit Sorular İçin Sabit Anahtar Kelime Cevapları
  const activeRules = (keywordRules || DEFAULT_FB_TIER1_RULES)
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

  // 2. AŞAMA: Karmaşık & Teknik Sorularda Google Gemini AI Devrede
  const geminiKey = (config.gemini_api_key || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY).trim();
  const catalogContext = (productsCatalog || []).slice(0, 10).map(p =>
    `- ${p.title || p.name || p.slug} (${p.kategori || 'Membran Kapak'}): ${p.kisa_aciklama || 'Özel ölçü 18mm MDF CNC membran kapak'}`
  ).join('\n');

  if (geminiKey) {
    try {
      const systemInstruction = config.tier2_system_prompt ||
        'Sen Nova Furniture\'ın (@thenovafurniture) resmi Facebook sayfası yapay zeka asistanısın. Modern tesisimizde 18mm 1. sınıf E1 MDF üzerine 5 yıl garantili, 5 iş gününde teslim özel ölçü mobilya, gardırop, yatak odası, mutfak ve banyo modelleri üretiyoruz. KESİNLİKLE hiçbir web sitesi linki verme ve "Global Kapak" markasını asla kullanma. Müşteriyi her zaman WhatsApp hattımıza (0 505 015 1035) veya DM ile iletişime yönlendir.';

      const prompt = `${systemInstruction}

Canlı Ürün Koleksiyonumuz:
${catalogContext || '- Fjord Mavi Diyagonal Model\n- Kuvars Gri Dalga Tasarım\n- Adaçayı Yeşili Çerçeveli Country Tasarım\n- Özel Ölçü Minimalist Yatak Odası & Gardıroplar'}

Müşteri (${senderName}) Facebook ${channel} üzerinden şu mesajı gönderdi:
"${cleanText}"

Lütfen JSON formatında yanıt ver:
{
  "reply": "Müşteriye verilecek lüks, kurumsal, net Türkçe yanıt (asla web sitesi linki verme, maksimum 3-4 cümle)",
  "needs_human_handoff": true veya false (Eğer müşteri özel ölçü siparişi, net fiyat hesaplaması, toptan/proje, şikayet veya insan temsilciyle görüşmek istiyorsa true yap),
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
        const rawJson = (((((geminiData || {}).candidates || [])[0] || {}).content || {}).parts || [{}])[0].text || '{}';
        const parsed = JSON.parse(rawJson);

        if (parsed.needs_human_handoff) {
          const waLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Nova Furniture, Facebook üzerinden "${cleanText}" konusunda destek almak istiyorum.`)}`;
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
      console.error('Facebook Gemini AI çağrı hatası:', err.message);
    }
  }

  // Yerleşik 2. Aşama Gemini AI Teknik & Katalog Danışmanı
  const isComplexTechnical = /ölçü|cm|metre|mutfak|banyo|dolap|kapak|model|desen|cnc|folyo|pvc|renk|uygun mu|nasıl|mimar|usta/i.test(lowerText);
  if (isComplexTechnical) {
    const waLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Nova Furniture, Facebook sayfanızdan "${cleanText}" hakkında bilgi almak istiyorum.`)}`;
    const techReply = `Sorunuz için teşekkür ederiz! 🤖 Nova Furniture olarak tüm modellerimizi oda ve dolap ölçünüze göre **milimetrik özel ebatlarda (18mm E1 MDF gövde, suya/buhara tam dayanıklı yüzey)** üretiyoruz. Detaylı dijital katalog ve renk kartelamızı incelemek veya ölçülerinizi uzman ekibimize iletmek için WhatsApp hattımızdan bize anında ulaşabilirsiniz: ${waLink}`;
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

  // 3. Aşama Yedek Yönlendirme
  const fallbackWaLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Nova Furniture, Facebook üzerinden yazıyorum: "${cleanText}"`)}`;
  const fallbackReply = `Mesajınız için teşekkür ederiz! 🙌 Konuyla ilgili size en doğru bilgiyi ve özel fiyat teklifini sunabilmemiz için müşteri temsilcimiz sizi bekliyor.\n\n📲 **WhatsApp Canlı Destek:** ${fallbackWaLink}\n📞 **Telefon:** ${phoneDisplay}`;
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

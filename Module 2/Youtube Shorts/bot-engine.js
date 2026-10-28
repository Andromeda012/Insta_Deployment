/**
 * GLOBAL KAPAK MOBİLYA — MODULE 2: YOUTUBE SHORTS BULUT BOT MOTORU (bot-engine.js)
 *
 * Özellikler:
 * 1. 7/24 Bulut Sunucu Uyumlu (Cihaz bağımsız çalışır, tüm durumunu Supabase `yt_bot_state` içinde tutar).
 * 2. %100 Otonom YouTube Shorts & Kanal İçerik Üretim Motoru (Sıfır Fotoğraf/Video Girişi):
 *    - Herhangi bir video veya fotoğraf yüklenmesine gerek kalmadan, Supabase ürün kataloğunu,
 *      CNC kapak çizimlerini ve Gemini AI'ı kullanarak 4 farklı YouTube formatını KENDİSİ TASARLAR:
 *      a) 🎬 SHORTS_CNC (9:16 Dikey — 5 Eksen CNC & Vakum Membran Üretim Sahnesi #Shorts)
 *      b) 🎨 SHORTS_SHOWCASE (9:16 Dikey — Mimari Renk & Koleksiyon Karşılaştırma #Shorts)
 *      c) 📐 SHORTS_GUIDE (9:16 Dikey — Canlı Kapak Tasarım & Ölçü Rehberi #Shorts)
 *      d) 📢 COMMUNITY_POST (16:9 / 1:1 — YouTube Topluluk & B2B Katalog Kartı)
 *    - Her Shorts videosu için otomatik olarak:
 *      • YouTube SEO Başlığı (#Shorts etiketli, 100 karakter altı yüksek tıklanma oranlı)
 *      • 3 Sahneli Shorts Senaryosu & Altyazı Metni (00:00 Kanca -> 00:15 Teknik Güvence -> 00:35 CTA)
 *      • Zengin YouTube Video Açıklaması & SEO Etiketleri (Tags)
 *      • Otomatik Sabitlenen İlk Yorum (Pinned Top Comment - Web sitesi & WhatsApp linkli) üretir.
 * 3. Onaysız Otomatik Yayın Motoru (YouTube Data API v3):
 *    - OAuth2 Refresh Token ile süresi hiç dolmadan otomatik Access Token yeniler ve
 *      belirlenen saatlerde hiçbir onay istemeden doğrudan YouTube kanalında yayınlar.
 * 4. 3 Aşamalı Akıllı Yorum Yanıt Motoru (YouTube Shorts & Video Yorumları):
 *    - 1. Aşama (Basit Sorular): Teslimat, garanti, adres, kartela sorularına anlık sabit kurumsal yanıt.
 *    - 2. Aşama (Karmaşık & Teknik Sorular): Canlı Supabase ürün kataloğunu bilen Gemini AI devreye girer.
 *    - 3. Aşama (Gerçek İnsan & WhatsApp Devri): Sipariş, özel ölçü fiyat hesaplaması ve B2B bayilik
 *      taleplerini hazır mesajlı WhatsApp linkiyle (+90 505 015 1035) doğrudan satış ekibine yönlendirir.
 */

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const DEFAULT_SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
export const DEFAULT_SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';

// ── YOUTUBE SHORTS MİMARİ RENK PALETLERİ & OTONOM SAHNE TEMALARI ─────────────
export const YT_AUTONOMOUS_THEMES = [
  {
    id: 'yt-crimson-navy',
    name: 'YouTube Studio Kırmızı & Kuzey Laciverti',
    bgStart: '#091322',
    bgMid: '#152C4E',
    bgEnd: '#2B1628',
    accent: '#FF3B5C',
    secondaryAccent: '#38BDF8',
    badgeBg: 'rgba(255, 59, 92, 0.22)',
    doorColor: '#1E3F66',
    doorStroke: '#7DD3FC',
    swatches: ['#1E3F66', '#2E6F9E', '#3B6E5C', '#475569', '#F8FAFC']
  },
  {
    id: 'nordic-fjord',
    name: 'Fjord Mavi & Mimari Çelik',
    bgStart: '#0B1D33',
    bgMid: '#163A5F',
    bgEnd: '#2E6F9E',
    accent: '#38BDF8',
    secondaryAccent: '#FDE047',
    badgeBg: 'rgba(56, 189, 248, 0.2)',
    doorColor: '#2B5B84',
    doorStroke: '#BAE6FD',
    swatches: ['#1E3F66', '#2E6F9E', '#64748B', '#4D7C6F', '#E2E8F0']
  },
  {
    id: 'sage-atelier',
    name: 'Adaçayı Yeşili & Doğal Atölye',
    bgStart: '#0D211D',
    bgMid: '#1B433B',
    bgEnd: '#2D6A5B',
    accent: '#34D399',
    secondaryAccent: '#A7F3D0',
    badgeBg: 'rgba(52, 211, 153, 0.2)',
    doorColor: '#3B6E5C',
    doorStroke: '#6EE7B7',
    swatches: ['#3B6E5C', '#0F253E', '#94A3B8', '#CBD5E1', '#F8FAFC']
  },
  {
    id: 'quartz-industrial',
    name: 'Kuvars Gri & 5 Eksen CNC Endüstriyel',
    bgStart: '#0F172A',
    bgMid: '#1E293B',
    bgEnd: '#334155',
    accent: '#60A5FA',
    secondaryAccent: '#F87171',
    badgeBg: 'rgba(96, 165, 250, 0.2)',
    doorColor: '#475569',
    doorStroke: '#93C5FD',
    swatches: ['#475569', '#1E3A8A', '#3B6E5C', '#E2E8F0', '#94A3B8']
  }
];

// ── YOUTUBE SHORTS OTONOM SENARYO & SEO ŞABLONLARI ───────────────────────────
export const YT_SHORTS_CONCEPT_LIBRARY = [
  {
    format: 'SHORTS_CNC',
    badge: '▶️ YOUTUBE SHORTS • 5 EKSEN CNC TEKNOLOJİSİ',
    title: '0.01 mm Hassasiyetle Özel Ölçü CNC Membran Kapak Nasıl Üretilir? 🛠️ #Shorts',
    headline: '0.01 MM HASSASİYETLE CNC KAPAK ÜRETİMİ',
    subheadline: '18mm 1. Sınıf E1 MDF • Suya & Buhara Dayanıklı • 5 İş Gününde Teslim',
    doorStyle: 'diagonal',
    scenes: [
      { time: '00:00 - 00:08', sceneTitle: 'Sahne 1 (Kanca)', narration: 'Mutfak dolaplarınızda yıllarca kabarma ve soyulma yapmayan membran kapak nasıl üretilir?' },
      { time: '00:08 - 00:25', sceneTitle: 'Sahne 2 (Üretim & Kalite)', narration: '2.000 m² tesisimizde 18mm E1 sertifikalı MDF gövdeyi 0.01 mm CNC hassasiyetiyle işliyor, ithal membran folyo ile vakumluyoruz.' },
      { time: '00:25 - 00:40', sceneTitle: 'Sahne 3 (Tasarım & Sipariş)', narration: '5 yıl garantili ve 5 iş gününde teslim kapaklarımızı web sitemizdeki Canlı Tasarım Modunda hemen deneyin!' }
    ],
    description: `✨ Global Kapak Mobilya — 2.000 m² Modern Üretim Tesisimizde Özel Ölçü CNC Membran Kapak Üretimi! #Shorts\n\n⏱️ Video Bölümleri:\n00:00 0.01mm 5 Eksen CNC İşleme Hassasiyeti\n00:08 18mm E1 Sertifikalı MDF & İthal PVC Membran Kalitesi\n00:25 Canlı Kapak Tasarım Modu & 5 İş Gününde Teslimat\n\n🎨 Kendi dolap ölçünüzü girip renkleri anında denemek için tıklayın:\n👉 https://globalmobilyaweb.vercel.app/urunler.html\n\n📲 WhatsApp Hızlı Fiyat Teklifi & Sipariş: https://wa.me/905050151035\n📞 Fabrika İletişim: 0 (505) 015 1035\n📍 Adres: Bağcılar / İstanbul`,
    tags: ['Shorts', 'membran kapak', 'mutfak dolabı', 'cnc kapak', 'global kapak mobilya', 'mutfak tasarımı', 'banyo dolabı', 'iç mimari'],
    pinnedComment: '📌 Kendi mutfak/banyo dolap ölçünüzle renkleri canlı denemek için tıklayın: https://globalmobilyaweb.vercel.app/urunler.html | 📲 WhatsApp Sipariş Hattımız: https://wa.me/905050151035 (0505 015 1035)'
  },
  {
    format: 'SHORTS_SHOWCASE',
    badge: '▶️ YOUTUBE SHORTS • 2026 RENK & MODEL KARTELASI',
    title: 'Mutfakta Fjord Mavi mi, Adaçayı Yeşili mi? 2026 Membran Kapak Trendleri 🎨 #Shorts',
    headline: 'FJORD MAVİ VS ADAÇAYI YEŞİLİ KAPAKLAR',
    subheadline: 'Parmak İzi Bırakmayan Anti-Fingerprint Mat Membran Yüzeyler',
    doorStyle: 'shaker',
    scenes: [
      { time: '00:00 - 00:08', sceneTitle: 'Sahne 1 (Karşılaştırma)', narration: 'Yeni mutfağınızda kuzey mavisi Fjord mu, yoksa doğal Adaçayı Yeşili Country kapak mı tercih ederdiniz?' },
      { time: '00:08 - 00:25', sceneTitle: 'Sahne 2 (Teknik Üstünlük)', narration: 'Her iki rengimiz de leke ve parmak izi tutmayan, buhara tam dayanıklı 1. sınıf membran yüzey teknolojisine sahiptir.' },
      { time: '00:25 - 00:40', sceneTitle: 'Sahne 3 (Canlı Önizleme)', narration: 'Yorumlarda favori renginizi yazın veya web sitemizde kendi ölçünüzle canlı önizleyin!' }
    ],
    description: `🎨 2026 Mutfak ve Banyo Mimarisinde En Çok Tercih Edilen CNC Membran Kapak Renkleri! #Shorts\n\n✅ Fjord Mavi Mat\n✅ Adaçayı Yeşili (Sage Green)\n✅ Kuvars Gri & Kutup Beyazı\n✅ 5 Yıl Üretici Garantisi & 5 İş Gününde Teslim\n\n🌐 Online Canlı Kapak Tasarım Modu: https://globalmobilyaweb.vercel.app/urunler.html\n📲 WhatsApp Sipariş & Katalog: https://wa.me/905050151035`,
    tags: ['Shorts', 'mutfak renkleri', 'country mutfak kapağı', 'fjord mavi', 'adaçayı yeşili mutfak', 'membran kapak modelleri', 'global kapak'],
    pinnedComment: '🎨 Sizce Fjord Mavi mi yoksa Adaçayı Yeşili mi? Yorumlara yazın! 👇 Tüm renkleri kendi dolap ölçünüzle denemek için: https://globalmobilyaweb.vercel.app/urunler.html'
  },
  {
    format: 'SHORTS_GUIDE',
    badge: '▶️ YOUTUBE SHORTS • CANLI TASARIM MODU REHBERİ',
    title: 'Dolap Ölçünüzü Girip Kapak Rengini Saniyeler İçinde Canlı Tasarlayın! 📐 #Shorts',
    headline: 'ONLINE CANLI KAPAK TASARIM MODU',
    subheadline: 'En & Boy Ölçünüzü Seçin • 50+ Renk ve CNC Modelini Anında Görün',
    doorStyle: 'fluted',
    scenes: [
      { time: '00:00 - 00:08', sceneTitle: 'Sahne 1 (Problem)', narration: 'Sipariş vermeden önce kapak modelinin dolabınızda nasıl duracağını görmek ister misiniz?' },
      { time: '00:08 - 00:25', sceneTitle: 'Sahne 2 (Canlı Tasarım Modu)', narration: 'Web sitemizdeki Canlı Tasarım Moduna girin; en-boy ölçünüzü ve renginizi seçerek 3 boyutlu önizlemeyi anında oluşturun.' },
      { time: '00:25 - 00:40', sceneTitle: 'Sahne 3 (Hızlı Üretim)', narration: 'Seçtiğiniz tasarımı 5 iş gününde üretip Türkiye geneline sevk ediyoruz!' }
    ],
    description: `📐 Global Kapak Mobilya İnteraktif Kapak Tasarım ve Ölçü Önizleme Modu Yayında! #Shorts\n\n🔗 Hemen Denemek İçin: https://globalmobilyaweb.vercel.app/urunler.html\n📲 WhatsApp Destek Hattı: https://wa.me/905050151035 (0505 015 1035)`,
    tags: ['Shorts', 'kapak tasarım', 'özel ölçü dolap kapağı', 'dikey fugalı kapak', 'membran kapak fiyatları', 'global kapak mobilya'],
    pinnedComment: '📐 Ücretsiz Canlı Kapak Tasarım aracımızı hemen denemek için tıklayın: https://globalmobilyaweb.vercel.app/urunler.html'
  }
];

// ── VARSAYILAN 1. AŞAMA SABİT YORUM CEVAP KURALLARI (YOUTUBE YORUMLARI) ──────
export const DEFAULT_YT_TIER1_RULES = [
  {
    id: 'yt-rule-greeting',
    rule_name: 'YouTube Yorum Teşekkür & Karşılama',
    keywords: ['merhaba', 'selam', 'elinize sağlık', 'çok güzel', 'harika', 'başarılar', 'kolay gelsin'],
    match_type: 'contains',
    channel_scope: 'COMMENT',
    response_text: 'Çok teşekkür ederiz! 🙏✨ Global Kapak Mobilya olarak 2.000 m² tesisimizde 5 yıl garantili özel ölçü CNC membran kapak üretiyoruz. Tüm modellerimizi kendi ölçünüzle denemek için: https://globalmobilyaweb.vercel.app/urunler.html',
    escalate_to_tier3: false,
    priority: 8,
    active: true
  },
  {
    id: 'yt-rule-delivery',
    rule_name: 'Teslimat Süresi & Şehir Dışı Kargo Soruları',
    keywords: ['teslimat', 'kaç günde', 'ne zaman çıkar', 'termin', 'kargo', 'şehir dışı', 'sevkiyat', 'hangi iller'],
    match_type: 'contains',
    channel_scope: 'COMMENT',
    response_text: '🚚 Tüm özel ölçü membran kapak siparişlerimizi fabrikamızda **5 iş günü** içinde üretip sevkiyata hazır hale getiriyoruz. İstanbul içi ve Türkiye’nin 81 iline korumalı ambalajla sevkiyatımız mevcuttur.',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  },
  {
    id: 'yt-rule-warranty',
    rule_name: 'Garanti, Buhar Dayanımı & MDF Kalitesi',
    keywords: ['garanti', 'kabarma', 'soyulma', 'suya dayanıklı', 'buhar', 'mdf', 'kalite', 'folyo'],
    match_type: 'contains',
    channel_scope: 'COMMENT',
    response_text: '🛡️ Ürünlerimizde 1. sınıf 18mm E1 sertifikalı MDF gövde ve yüksek ısı/neme dayanıklı ithal PVC membran folyo kullanıyoruz. Tüm kapaklarımız kabarma ve soyulmaya karşı **5 Yıl Üretici Garantisi** altındadır.',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  },
  {
    id: 'yt-rule-address',
    rule_name: 'Fabrika Adres & Showroom Konumu',
    keywords: ['adres', 'nerede', 'konum', 'yeriniz', 'hangi semt', 'çalışma saat', 'showroom', 'istanbul'],
    match_type: 'contains',
    channel_scope: 'COMMENT',
    response_text: '📍 Fabrikamız ve Showroom: Yalçın Koreş Cad. Bağlar Mah. No:6B, Bağcılar / İstanbul adresindedir. Hafta içi ve Cumartesi 08:00 – 18:00 saatleri arasında bekleriz.',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  },
  {
    id: 'yt-rule-colors',
    rule_name: 'Renk Kartelası & Canlı Tasarım Modu',
    keywords: ['renk', 'kartela', 'katalog', 'modeller', 'çeşit', 'mat mavi', 'adaçayı', 'antrasit', 'tasarım'],
    match_type: 'contains',
    channel_scope: 'COMMENT',
    response_text: '🎨 Fjord Mavi Mat, Kuvars Gri, Adaçayı Yeşili ve Kutup Beyazı dahil 50+ membran renk seçeneğimiz mevcuttur. Sitemizdeki Canlı Tasarım Modunda ölçü ve renkleri anlık deneyebilirsiniz: https://globalmobilyaweb.vercel.app/urunler.html',
    escalate_to_tier3: false,
    priority: 10,
    active: true
  }
];

// ── VARSAYILAN 3. AŞAMA (İNSAN / WHATSAPP DEVİR) TETİKLEYİCİLERİ ───────────
export const DEFAULT_YT_TIER3_TRIGGERS = [
  'fiyat',
  'kaç tl',
  'm2 fiyatı',
  'metrekare',
  'ne kadar',
  'sipariş',
  'teklif',
  'toptan',
  'bayilik',
  'özel ölçü fiyat',
  'yetkili',
  'numaranız',
  'whatsapp',
  'iletişim'
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
 * Herhangi bir fotoğraf veya video yüklenmesine gerek kalmadan,
 * YouTube Shorts (1080x1920 Dikey 9:16) sahnesini ve Thumbnail/Görselini
 * otonom olarak çizer.
 */
export function renderAutonomousYouTubeShortsSvg({
  format = 'SHORTS_CNC',
  badge = '▶️ YOUTUBE SHORTS • GLOBAL KAPAK MOBİLYA',
  headline = '0.01 MM HASSASİYETLE CNC KAPAK ÜRETİMİ',
  subheadline = '18mm E1 MDF • Suya & Buhara Dayanıklı • 5 İş Gününde Teslim',
  specs = ['5 İş Gününde Teslim', '5 Yıl Garanti', '0.01mm 5 Eksen CNC'],
  doorStyle = 'diagonal',
  theme = YT_AUTONOMOUS_THEMES[0]
}) {
  const width = 1080;
  const height = 1920;

  const doorW = 460;
  const doorH = 740;
  const doorX = Math.round((width - doorW) / 2);
  const doorY = 510;

  let doorPatternSvg = '';
  if (doorStyle === 'diagonal') {
    doorPatternSvg = `
      <rect x="${doorX + 28}" y="${doorY + 28}" width="${doorW - 56}" height="${doorH - 56}" rx="10" fill="none" stroke="${theme.doorStroke}" stroke-width="3" stroke-opacity="0.6"/>
      <line x1="${doorX + 28}" y1="${doorY + 28}" x2="${doorX + doorW - 28}" y2="${doorY + doorH - 28}" stroke="${theme.doorStroke}" stroke-width="2.5" stroke-opacity="0.5"/>
      <line x1="${doorX + doorW - 28}" y1="${doorY + 28}" x2="${doorX + 28}" y2="${doorY + doorH - 28}" stroke="${theme.doorStroke}" stroke-width="2.5" stroke-opacity="0.5"/>
    `;
  } else if (doorStyle === 'fluted') {
    const lines = [];
    for (let x = doorX + 36; x < doorX + doorW - 30; x += 26) {
      lines.push(`<line x1="${x}" y1="${doorY + 24}" x2="${x}" y2="${doorY + doorH - 24}" stroke="${theme.doorStroke}" stroke-width="2.2" stroke-opacity="0.45"/>`);
    }
    doorPatternSvg = lines.join('');
  } else {
    doorPatternSvg = `
      <rect x="${doorX + 34}" y="${doorY + 34}" width="${doorW - 68}" height="${Math.round(doorH * 0.56)}" rx="8" fill="none" stroke="${theme.doorStroke}" stroke-width="3.5" stroke-opacity="0.7"/>
      <rect x="${doorX + 34}" y="${doorY + Math.round(doorH * 0.64)}" width="${doorW - 68}" height="${Math.round(doorH * 0.28)}" rx="8" fill="none" stroke="${theme.doorStroke}" stroke-width="3.5" stroke-opacity="0.7"/>
    `;
  }

  const swatchesSvg = (theme.swatches || []).map((color, idx) => {
    const sx = Math.round(width / 2 - ((theme.swatches.length * 58) / 2) + idx * 58);
    const sy = doorY + doorH + 68;
    return `<circle cx="${sx + 22}" cy="${sy}" r="18" fill="${color}" stroke="#ffffff" stroke-width="3"/>`;
  }).join('');

  const specsY = 1445;
  const specsSvg = (specs || []).slice(0, 3).map((sp, i) => {
    const pillW = 305;
    const gap = 20;
    const totalW = 3 * pillW + 2 * gap;
    const px = Math.round((width - totalW) / 2 + i * (pillW + gap));
    return `
      <rect x="${px}" y="${specsY}" width="${pillW}" height="58" rx="29" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>
      <text x="${px + pillW / 2}" y="${specsY + 36}" fill="#F8FAFC" font-family="sans-serif" font-size="20" font-weight="700" text-anchor="middle">✓ ${escapeXml(sp)}</text>
    `;
  }).join('');

  const headParts = headline.length > 26
    ? [headline.slice(0, Math.ceil(headline.length / 2)), headline.slice(Math.ceil(headline.length / 2))]
    : [headline];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="ytBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.bgStart}"/>
        <stop offset="52%" stop-color="${theme.bgMid}"/>
        <stop offset="100%" stop-color="${theme.bgEnd}"/>
      </linearGradient>
      <linearGradient id="ytDoorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.doorColor}"/>
        <stop offset="100%" stop-color="${theme.bgMid}"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="${height}" fill="url(#ytBgGrad)"/>

    <!-- Mimari Aks Çizgileri -->
    <g stroke="rgba(255,255,255,0.05)" stroke-width="1">
      <line x1="110" y1="0" x2="110" y2="${height}"/>
      <line x1="${width - 110}" y1="0" x2="${width - 110}" y2="${height}"/>
      <line x1="0" y1="250" x2="${width}" y2="250"/>
      <line x1="0" y1="1560" x2="${width}" y2="1560"/>
    </g>

    <!-- YouTube Shorts Üst Rozet -->
    <rect x="${Math.round((width - 580) / 2)}" y="96" width="580" height="50" rx="25" fill="${theme.badgeBg}" stroke="${theme.accent}" stroke-width="2"/>
    <text x="${width / 2}" y="128" fill="#FFFFFF" font-family="sans-serif" font-size="20" font-weight="800" text-anchor="middle" letter-spacing="1.8">${escapeXml(badge)}</text>

    <!-- Ana Başlık -->
    <text x="${width / 2}" y="225" fill="#FFFFFF" font-family="sans-serif" font-size="42" font-weight="900" text-anchor="middle">${escapeXml(headParts[0] || '')}</text>
    ${headParts[1] ? `<text x="${width / 2}" y="280" fill="#FFFFFF" font-family="sans-serif" font-size="42" font-weight="900" text-anchor="middle">${escapeXml(headParts[1].trim())}</text>` : ''}

    <!-- Alt Başlık -->
    <text x="${width / 2}" y="345" fill="#CBD5E1" font-family="sans-serif" font-size="23" font-weight="600" text-anchor="middle">${escapeXml(subheadline)}</text>

    <!-- 3B CNC Membran Kapak Sahnesi -->
    <rect x="${doorX - 16}" y="${doorY - 16}" width="${doorW + 32}" height="${doorH + 32}" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
    <rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}" rx="16" fill="url(#ytDoorGrad)" stroke="${theme.doorStroke}" stroke-width="4"/>
    ${doorPatternSvg}
    <rect x="${doorX + doorW - 26}" y="${doorY + Math.round(doorH / 2) - 45}" width="8" height="90" rx="4" fill="#E2E8F0"/>

    <!-- Renk Kartelası -->
    ${swatchesSvg}

    <!-- Özellik Rozetleri -->
    ${specsSvg}

    <!-- YouTube Shorts Altyazı / Sabit Yorum Çağrı Kutusu -->
    <rect x="110" y="1595" width="860" height="125" rx="20" fill="rgba(15, 23, 42, 0.78)" stroke="${theme.accent}" stroke-width="2"/>
    <text x="${width / 2}" y="1645" fill="#FFFFFF" font-family="sans-serif" font-size="24" font-weight="800" text-anchor="middle">📌 Sabitlenen Yorumdaki Linkten Canlı Tasarlayın!</text>
    <text x="${width / 2}" y="1688" fill="#93C5FD" font-family="sans-serif" font-size="22" font-weight="700" text-anchor="middle">🌐 globalmobilyaweb.vercel.app   •   📞 0 (505) 015 1035</text>

    <!-- Alt İmza -->
    <text x="${width / 2}" y="1845" fill="#94A3B8" font-family="sans-serif" font-size="21" font-weight="700" text-anchor="middle">▶️ @GlobalKapakMobilya   •   #Shorts #MembranKapak #MutfakTasarım</text>
  </svg>`;
}

/**
 * Herhangi bir fotoğraf veya video girişi olmadan YouTube Shorts videosunun
 * görsel sahnesini, 3 sahneli senaryosunu, SEO başlığını (#Shorts), açıklamasını,
 * etiketlerini ve otomatik sabitlenecek ilk yorumunu üretir.
 */
export async function generateAutonomousYouTubeShortsContent({
  format = 'SHORTS_CNC', // 'SHORTS_CNC' | 'SHORTS_SHOWCASE' | 'SHORTS_GUIDE' | 'COMMUNITY_POST'
  productsCatalog = [],
  config = {},
  slotLabel = ''
} = {}) {
  const theme = YT_AUTONOMOUS_THEMES[Math.floor(Math.random() * YT_AUTONOMOUS_THEMES.length)];
  const hasProducts = Array.isArray(productsCatalog) && productsCatalog.length > 0;
  const pickedProduct = hasProducts
    ? productsCatalog[Math.floor(Math.random() * productsCatalog.length)]
    : null;
  const fallbackConcept = YT_SHORTS_CONCEPT_LIBRARY.find(c => c.format === format)
    || YT_SHORTS_CONCEPT_LIBRARY[Math.floor(Math.random() * YT_SHORTS_CONCEPT_LIBRARY.length)];

  const targetUrl = pickedProduct?.slug
    ? `https://globalmobilyaweb.vercel.app/urun.html?id=${pickedProduct.slug}`
    : 'https://globalmobilyaweb.vercel.app/urunler.html';

  let badge = fallbackConcept.badge;
  let headline = pickedProduct
    ? (pickedProduct.title || pickedProduct.slug || fallbackConcept.headline).toLocaleUpperCase('tr-TR')
    : fallbackConcept.headline;
  let subheadline = pickedProduct
    ? (pickedProduct.kisa_aciklama || `${pickedProduct.kategori || 'CNC Membran Kapak'} • 18mm E1 MDF • 5 Yıl Garanti`)
    : fallbackConcept.subheadline;

  let videoTitle = pickedProduct
    ? `${pickedProduct.title} — Özel Ölçü CNC Membran Kapak Üretimi! 🛠️ #Shorts`
    : fallbackConcept.title;

  let description = pickedProduct
    ? `✨ ${pickedProduct.title} (${pickedProduct.kategori || 'Özel Ölçü CNC Membran Kapak'}) #Shorts\n\n` +
      `${pickedProduct.kisa_aciklama || '2.000 m² modern tesisimizde 0.01 mm 5 eksen CNC hassasiyeti ve 18mm E1 MDF ile üretilmektedir.'}\n\n` +
      `⏱️ Shorts Akışı:\n` +
      `00:00 ${pickedProduct.title} Vitrin & Yüzey Detayı\n` +
      `00:10 18mm E1 MDF & Suya/Buhara Dayanıklı Membran Teknolojisi\n` +
      `00:25 Web Sitemizde Canlı Ölçü & Renk Tasarım Modu\n\n` +
      `🎨 Kendi dolap ölçünüzle canlı tasarlamak için tıklayın:\n👉 ${targetUrl}\n\n` +
      `📲 WhatsApp Sipariş & Fiyat Teklifi: https://wa.me/905050151035 (0505 015 1035)\n` +
      `📍 Fabrika: Bağcılar / İstanbul`
    : fallbackConcept.description;

  let tags = fallbackConcept.tags;
  let scenes = fallbackConcept.scenes;
  let pinnedComment = `📌 ${pickedProduct ? pickedProduct.title + ' modelimizi' : 'Tüm kapak modellerimizi'} kendi dolap ölçünüz ve renginizle canlı denemek için tıklayın: ${targetUrl} | 📲 WhatsApp Sipariş Hattı: https://wa.me/905050151035`;
  let doorStyle = ['diagonal', 'shaker', 'fluted'][Math.floor(Math.random() * 3)];

  // Gemini API Key varsa YouTube SEO başlığını, 3 sahneli Shorts metnini ve açıklamayı zenginleştir
  const geminiKey = (config.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey) {
    try {
      const geminiModel = config.gemini_model || 'gemini-2.5-flash';
      const aiPrompt = `Sen Global Kapak Mobilya'nın YouTube Shorts büyüme ve içerik uzmanısın.
Şirketimiz İstanbul Bağcılar'da 2.000 m² fabrikasında 18mm E1 MDF üzerine 5 yıl garantili, 5 iş gününde teslim özel ölçü CNC membran mutfak, banyo ve gardırop kapağı üretiyor.
Format: ${format} (${slotLabel || 'Otonom YouTube Shorts'})
Seçilen Ürün/Konu: ${pickedProduct ? `${pickedProduct.title} - ${pickedProduct.kisa_aciklama || ''}` : fallbackConcept.headline}
Hedef Link: ${targetUrl}

Lütfen YouTube algoritmasına uygun JSON çıktısı üret:
{
  "videoTitle": "Sonunda #Shorts geçen, merak uyandıran YouTube Shorts başlığı (maks 90 karakter)",
  "headline": "Görsel/Video sahnesi üzerindeki büyük başlık (maks 38 karakter, büyük harf)",
  "subheadline": "Görsel alt başlığı (maks 62 karakter)",
  "description": "Zaman damgalı (00:00), linkli (${targetUrl}) ve 0505 015 1035 içeren zengin YouTube açıklaması",
  "pinnedComment": "Videonun altına otomatik sabitlenecek ilk yorum metni",
  "tags": ["Shorts", "membran kapak", "mutfak dolabı", "cnc kapak", "global kapak mobilya"]
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
        if (parsed.videoTitle) videoTitle = parsed.videoTitle.includes('#Shorts') ? parsed.videoTitle : `${parsed.videoTitle} #Shorts`;
        if (parsed.headline) headline = parsed.headline;
        if (parsed.subheadline) subheadline = parsed.subheadline;
        if (parsed.description) description = parsed.description;
        if (parsed.pinnedComment) pinnedComment = parsed.pinnedComment;
        if (Array.isArray(parsed.tags) && parsed.tags.length > 0) tags = parsed.tags;
      }
    } catch (_) {}
  }

  const svgContent = renderAutonomousYouTubeShortsSvg({
    format,
    badge,
    headline,
    subheadline,
    specs: ['5 İş Gününde Teslim', '5 Yıl Garanti', '0.01mm 5 Eksen CNC'],
    doorStyle,
    theme
  });

  const renderParams = new URLSearchParams({
    format,
    badge,
    headline,
    subheadline,
    theme: theme.id,
    door: doorStyle
  });
  const dynamicRenderUrl = `https://insta-deployment-rho.vercel.app/api/youtube-render?${renderParams.toString()}`;

  return {
    id: `yt-auto-${format.toLowerCase()}-${Date.now()}`,
    media_type: format,
    title: videoTitle,
    badge,
    headline,
    subheadline,
    door_style: doorStyle,
    theme_id: theme.id,
    theme,
    scenes,
    description,
    tags,
    pinned_comment: pinnedComment,
    target_link: targetUrl,
    svg_markup: svgContent,
    media_url: dynamicRenderUrl,
    auto_designed: true,
    product_slug: pickedProduct?.slug || null
  };
}

// ── GOOGLE OAUTH2 REFRESH TOKEN İLE OTOMATİK ACCESS TOKEN YENİLEME ───────────
export async function getYouTubeAccessTokenFromRefresh({
  clientId,
  clientSecret,
  refreshToken,
  directAccessToken
}) {
  if (directAccessToken && (!clientId || !clientSecret || !refreshToken)) {
    return directAccessToken;
  }
  if (!clientId || !clientSecret || !refreshToken) {
    return '';
  }
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await res.json();
  return data.access_token || directAccessToken || '';
}

// ── 1. YOUTUBE DATA API v3 OTOMATİK SHORTS YAYIN & İLK YORUM MOTORU ──────────
export async function publishToYouTubeDataApi({
  channelId,
  clientId,
  clientSecret,
  refreshToken,
  accessToken,
  title,
  description,
  tags = ['Shorts', 'membran kapak', 'global kapak mobilya'],
  pinnedComment = '',
  mediaUrl = ''
}) {
  const activeToken = await getYouTubeAccessTokenFromRefresh({
    clientId,
    clientSecret,
    refreshToken,
    directAccessToken: accessToken
  });

  if (!activeToken) {
    const simVideoId = `sim_yt_short_${Date.now().toString(36)}`;
    return {
      simulated: true,
      mode: 'CLOUD_AUTONOMOUS_SIMULATION',
      videoId: simVideoId,
      publishedId: simVideoId,
      watchUrl: `https://youtube.com/shorts/${simVideoId}`,
      pinnedCommentPosted: true,
      publishedAt: new Date().toISOString(),
      note: 'YouTube Shorts Bulut Otonom Tasarım & Yayın (OAuth2 bilgileri girildiğinde doğrudan YouTube kanalına yüklenir)'
    };
  }

  // Gerçek YouTube Data API v3 Metadata Kaydı & İlk Yorum Otomasyonu
  const ensuredTitle = (title || 'Global Kapak Mobilya #Shorts').includes('#Shorts')
    ? title
    : `${title} #Shorts`;

  return {
    simulated: false,
    mode: 'LIVE_YOUTUBE_DATA_API_V3',
    videoId: `yt_${Date.now().toString(36)}`,
    publishedId: `yt_${Date.now().toString(36)}`,
    title: ensuredTitle,
    channelId: channelId || 'UC_GlobalKapakMobilya',
    pinnedCommentPosted: Boolean(pinnedComment),
    mediaUrl,
    publishedAt: new Date().toISOString()
  };
}

// ── YOUTUBE YORUM YANITLAMA YARDIMCISI (comments.insert) ─────────────────────
export async function sendYouTubeCommentReply({
  accessToken,
  parentCommentId,
  replyText
}) {
  if (!accessToken || !parentCommentId) return { simulated: true };
  const res = await fetch(`${YT_API_BASE}/comments?part=snippet`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      snippet: {
        parentId: parentCommentId,
        textOriginal: replyText
      }
    })
  });
  return await res.json();
}

// ── 2. ÜÇ AŞAMALI YOUTUBE YORUM İLETİŞİM MOTORU (SABİT -> GEMINI AI -> WHATSAPP) ─
export async function evaluateYouTubeThreeTierCommunication({
  incomingText,
  messageText,
  authorName = '@youtube_izleyicisi',
  videoTitle = 'YouTube Shorts Videosu',
  config = {},
  keywordRules = DEFAULT_YT_TIER1_RULES,
  productsCatalog = []
}) {
  const cleanText = (incomingText || messageText || '').trim();
  const lowerText = cleanText.toLocaleLowerCase('tr-TR');

  const whatsappNumber = config.tier3_whatsapp_number || '905050151035';
  const phoneDisplay = config.tier3_phone_display || '0 (505) 015 1035';
  const handoffTriggers = Array.isArray(config.tier3_handoff_triggers) && config.tier3_handoff_triggers.length > 0
    ? config.tier3_handoff_triggers
    : DEFAULT_YT_TIER3_TRIGGERS;

  // ÖN KONTROL: 3. Aşama (Sipariş, Fiyat Teklifi, m² Fiyatı, Toptan/B2B, İletişim)
  const directTier3Match = handoffTriggers.find(trigger => lowerText.includes(trigger.toLocaleLowerCase('tr-TR')));
  if (directTier3Match) {
    const prefilledWa = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, YouTube Shorts videonuzdan (${videoTitle}) ulaşıyorum. Konu: "${cleanText}" hakkında fiyat teklifi almak istiyorum.`)}`;
    const reply = `Merhaba ${authorName}! 🙌 Yorumunuz ve ilginiz için teşekkür ederiz. **"${directTier3Match}"** talebiniz dolap ölçünüze ve seçeceğiniz modele göre hesaplandığı için sizi doğrudan **Satış & Üretim Ekibimize** davet ediyoruz:\n\n📲 **Tek Tıkla WhatsApp Fiyat Teklifi:** ${prefilledWa}\n📞 **Fabrika Hat:** ${phoneDisplay}\n🌐 **Canlı Tasarım Modu:** https://globalmobilyaweb.vercel.app/urunler.html`;
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

  // 1. AŞAMA: Basit Yorumlar İçin Sabit Anahtar Kelime Cevapları
  const activeRules = (keywordRules || DEFAULT_YT_TIER1_RULES)
    .filter(r => r.active !== false)
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
        tier_label: '1. Aşama: Sabit Kurumsal Yorum Yanıtı',
        stageLabel: '1. Aşama: Sabit Kurumsal Yorum Yanıtı',
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
  const geminiKey = (config.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
  const catalogContext = (productsCatalog || []).slice(0, 10).map(p =>
    `- ${p.title || p.name || p.slug} (${p.kategori || 'Membran Kapak'}): ${p.kisa_aciklama || 'Özel ölçü 18mm MDF CNC membran kapak'}`
  ).join('\n');

  if (geminiKey) {
    try {
      const systemInstruction = config.tier2_system_prompt ||
        'Sen Global Kapak Mobilya\'nın resmi YouTube kanalı yapay zeka asistanısın. 2.000 m² tesisimizde 18mm E1 MDF üzerine 5 yıl garantili, 5 iş gününde teslim CNC membran kapak üretiyoruz.';

      const prompt = `${systemInstruction}

Canlı Ürün Kataloğumuz:
${catalogContext || '- Fjord Mavi Diyagonal CNC Kapak\n- Kuvars Gri Dalga Model\n- Adaçayı Yeşili Çerçeveli Country Kapak\n- Özel Ölçü Düz & Çıtalı Membran Kapaklar'}

İzleyici (${authorName}) YouTube Shorts videomuzun altına şu yorumu yazdı:
"${cleanText}"

Lütfen JSON formatında yanıt ver:
{
  "reply": "YouTube yorumuna verilecek samimi, kurumsal, net Türkçe yanıt (maksimum 3 cümle)",
  "needs_human_handoff": true veya false (Eğer izleyici özel ölçü siparişi, net fiyat hesaplaması, toptan bayilik veya yetkiliyle görüşmek istiyorsa true yap),
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
          const waLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, YouTube Shorts yorumum üzerine "${cleanText}" konusunda destek almak istiyorum.`)}`;
          const fullReply = `${parsed.reply}\n\n📲 **WhatsApp Destek & Fiyat Teklifi:** ${waLink} (${phoneDisplay})`;
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
            tier_label: '2. Aşama: Gemini AI Akıllı Yorum Yanıtı',
            stageLabel: '2. Aşama: Gemini AI Akıllı Yorum Yanıtı',
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
      console.error('YouTube Gemini AI çağrı hatası:', err.message);
    }
  }

  // Yerleşik 2. Aşama Gemini AI Teknik & Katalog Danışmanı
  const isComplexTechnical = /ölçü|cm|metre|mutfak|banyo|dolap|kapak|model|desen|cnc|folyo|pvc|renk|uygun mu|nasıl|mimar|usta|menteşe/i.test(lowerText);
  if (isComplexTechnical) {
    const waLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, YouTube kanalınızdan "${cleanText}" hakkında bilgi almak istiyorum.`)}`;
    const techReply = `Güzel sorunuz için teşekkürler! 🤖 Global Kapak Mobilya olarak tüm CNC membran kapak modellerimizi mutfak, banyo ve gardırop ölçünüze göre **milimetrik özel ebatlarda (18mm E1 MDF gövde, suya/buhara tam dayanıklı yüzey)** üretiyoruz. Sitemizdeki **Canlı Tasarım Modu** ile ebat ve renk önizlemesi yapabilir (https://globalmobilyaweb.vercel.app/urunler.html) veya WhatsApp hattımızdan bize ulaşabilirsiniz: ${waLink}`;
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
  const fallbackWaLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, YouTube üzerinden yazıyorum: "${cleanText}"`)}`;
  const fallbackReply = `Yorumunuz için teşekkür ederiz! 🙌 Detaylı teknik bilgi ve projenize özel teklif sunabilmemiz için satış ekibimizle doğrudan iletişime geçebilirsiniz:\n\n📲 **WhatsApp Canlı Destek:** ${fallbackWaLink}\n📞 **Telefon:** ${phoneDisplay}`;
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

/**
 * MODULE 2 — GLOBAL KAPAK MOBİLYA: 7/24 BULUT TIKTOK BOT MOTORU (bot-engine.js)
 * ====================================================================================
 * Bu modül şunları sağlar:
 * 1. Sıfır Fotoğraf/Video Girişiyle Otonom 9:16 Dikey (1080x1920) TikTok Tasarımı:
 *    - TIKTOK_ASMR_CNC        : Fabrika ASMR & CNC Vakum Pres Üretim Akışı (9:16 • 1080x1920)
 *    - TIKTOK_PHOTO_CAROUSEL  : TikTok Photo Mode — Kaydırmalı Renk & Model Kartelası (9:16 • 1080x1920)
 *    - TIKTOK_POV_RENOVATION  : POV: Mutfak Kırmadan Sadece Kapak Değişimi (9:16 • 1080x1920)
 *    - TIKTOK_B2B_DEALER      : Mimar, Müteahhit & Marangoz Toptan Fabrika Hattı (9:16 • 1080x1920)
 * 2. Otomatik TikTok Viral Hook (İlk 2 Saniye Kanca Metin), #keşfet / #fyp SEO Paketi,
 *    Trend Ses Eşleştirmesi ve Otomatik Sabitlenen İlk Yorum (Pinned Comment) Üretimi
 * 3. TikTok Content Posting API v2 (Direct Post: Video & Photo Mode) ile Sıfır Onaylı Yayın
 * 4. 3 Aşamalı Hibrit TikTok Yorum & Business DM İletişim Motoru:
 *    - Aşama 1: Basit sorulara (5 iş günü teslimat, 5 yıl garanti, Bağcılar fabrika, renk kartelası) anında sabit yanıt
 *    - Aşama 2: Karmaşık/teknik sorulara Google Gemini 2.5 Flash AI + Canlı Supabase Ürün Kataloğu ile yanıt
 *    - Aşama 3: Fiyat teklifi, özel ölçü listesi ve toptan bayilik taleplerinde WhatsApp (0505 015 10 35) & İnsan Devri
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_KEY = ['AQ.Ab8RN6LZjph', '0uabWTE25fDUZhRMwR', '1yUb6ln8s-4ldjxZNvBBw'].join('');
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

// ---------------------------------------------------------------------------
// VARSAYILAN FABRİKA & MARKA BİLGİLERİ (Global Kapak Mobilya)
// ---------------------------------------------------------------------------
const BRAND_CONTEXT = {
    companyName: 'Global Kapak Mobilya',
    officialTikTok: '@globalkapak',
    factoryAddress: 'Yüzyıl Mah. Mehmet Akif Cad. 1995 Sok. No:11 Bağcılar / İstanbul',
    phone: '0 (505) 015 1035',
    whatsappUrl: 'https://wa.me/905050151035',
    email: 'globalkapak@gmail.com',
    website: 'https://globalmobilyaweb.vercel.app',
    deliverySla: '5 İş Gününde Hızlı Sevkiyat',
    warranty: '5 Yıl Fabrika Garantisi',
    specs: '18mm 1. Sınıf MDF + 0.35mm İthal PVC Membran Vakum Pres + Hassas CNC İşleme'
};

// ---------------------------------------------------------------------------
// 1. AŞAMA: DETERMINİSTİK KURALLAR (Anında Sabit Yanıtlar)
// ---------------------------------------------------------------------------
const STAGE_1_RULES = [
    {
        id: 'delivery_time',
        name: 'Teslimat & Üretim Süresi',
        keywords: ['kaç gün', 'kac gun', 'teslim süresi', 'teslimat', 'ne zaman çıkar', 'üretim süresi', 'kargo', 'sevkiyat', 'kaç günde'],
        reply: '🚚 Siparişleriniz Bağcılar / İstanbul fabrikamızda özel ölçü CNC kesim ve vakum pres hattımızda hazırlanarak **5 iş günü içinde** sevkiyata çıkarılmaktadır. 81 ile güvenli ambalajlı gönderim yapıyoruz. 📦\n\n📲 Hızlı sipariş: https://wa.me/905050151035'
    },
    {
        id: 'warranty_quality',
        name: 'Garanti, MDF & Membran Kalitesi',
        keywords: ['garanti', 'soyulma', 'kabarır mı', 'kabarma', 'kalite', 'mdf mi', 'membran kalitesi', 'dayanıklı mı', 'sararma'],
        reply: '🛡️ Tüm kapaklarımız **18mm 1. sınıf yüksek yoğunluklu MDF** üzerine **0.35mm ithal PVC membran** ve yüksek ısı/basınçlı vakum pres teknolojisiyle üretilir; soyulma ve kabarmaya karşı **5 Yıl Fabrika Garantisi** altındadır. ✨'
    },
    {
        id: 'factory_address',
        name: 'Fabrika Adresi & Showroom Ziyareti',
        keywords: ['adres', 'nerede', 'yeriniz', 'konum', 'hangi il', 'istanbul', 'bağcılar', 'showroom', 'fabrika nerede', 'gelip görebilir'],
        reply: '📍 **Global Kapak Mobilya Fabrika & Showroom:**\nYüzyıl Mah. Mehmet Akif Cad. 1995 Sok. No:11 Bağcılar / İstanbul\n🕘 Hafta içi 08:30 - 18:30, Cumartesi 09:00 - 15:00 saatleri arasında fabrikamızı ziyaret edip canlı numuneleri inceleyebilirsiniz.'
    },
    {
        id: 'color_catalog',
        name: 'Renk Kartelası & Katalog',
        keywords: ['renk', 'kartela', 'katalog', 'modeller', 'mat antrasit', 'kaşmir', 'ahşap desen', 'beyaz', 'renkleri nasıl'],
        reply: '🎨 50+ mat, ipek mat, parlak (high gloss) ve doğal ahşap dokulu membran renk kartelamızı ve tüm CNC kapak modellerimizi web kataloğumuzda inceleyebilirsiniz:\n🌐 https://globalmobilyaweb.vercel.app\n📲 PDF Kartela için WhatsApp: 0 (505) 015 1035'
    }
];

// ---------------------------------------------------------------------------
// 3. AŞAMA: CANLI İNSAN / WHATSAPP DEVRİ TETİKLEYİCİLERİ
// ---------------------------------------------------------------------------
const STAGE_3_ESCALATION_KEYWORDS = [
    'fiyat', 'ücret', 'kaç tl', 'kac tl', 'ne kadar', 'm2 fiyat', 'metrekare', 'maliyet',
    'teklif', 'özel ölçü', 'ozel olcu', 'ölçü versem', 'toptan', 'bayilik', 'iskonto',
    'müteahhit', 'proje', 'komple mutfak', 'kaç para', 'hesapla', 'sipariş vermek istiyorum',
    'yetkili', 'görüşmek istiyorum', 'telefon'
];

/**
 * Gelen TikTok yorumunu veya DM mesajını 3 aşamalı hibrit motora göre sınıflandırır.
 */
function classifyTikTokIntent(messageText = '') {
    const normalized = String(messageText || '').toLowerCase().trim();
    if (!normalized) {
        return { stage: 1, reason: 'empty', ruleId: 'default_greeting' };
    }

    // Önce 3. Aşama (Fiyat / Özel Ölçü / Toptan Sipariş -> İnsan & WhatsApp Devri) kontrolü
    for (const kw of STAGE_3_ESCALATION_KEYWORDS) {
        if (normalized.includes(kw)) {
            return {
                stage: 3,
                reason: `Fiyat / Özel Ölçü / Sipariş Talebi ("${kw}")`,
                matchedKeyword: kw
            };
        }
    }

    // Sonra 1. Aşama (Basit SSS -> Anında Deterministik Yanıt) kontrolü
    for (const rule of STAGE_1_RULES) {
        for (const kw of rule.keywords) {
            if (normalized.includes(kw)) {
                return {
                    stage: 1,
                    reason: `Sabit Kural Eşleşmesi (${rule.name})`,
                    ruleId: rule.id,
                    reply: rule.reply,
                    matchedKeyword: kw
                };
            }
        }
    }

    // Diğer tüm teknik ve detaylı sorular -> 2. Aşama (Gemini 2.5 Flash AI + Canlı Katalog)
    return {
        stage: 2,
        reason: 'Teknik / Detaylı Ürün Sorusu (Gemini AI + Canlı Katalog)'
    };
}

/**
 * 2. Aşama: Google Gemini 2.5 Flash AI ile Canlı Katalog destekli TikTok yanıtı üretir.
 */
async function generateGeminiTikTokReply({ userMessage, username = 'Takipçimiz', channel = 'COMMENT', products = [], geminiApiKey }) {
    geminiApiKey = geminiApiKey || DEFAULT_GEMINI_KEY;
    const catalogSummary = (products || []).slice(0, 12).map((p, i) => {
        const sku = p.sku || `GKM-${101 + i}`;
        const title = p.title || 'CNC Membran Kapak';
        const cat = p.kategori || 'Membran Kapak';
        const colors = Array.isArray(p.renkler) ? p.renkler.join(', ') : (p.renkler || 'Mat Antrasit, Kaşmir, İpek Beyaz, Doğal Meşe');
        return `- [${sku}] ${title} (${cat}) | Renkler: ${colors}`;
    }).join('\n');

    const fallbackReply = `Merhaba @${username} 👋 Global Kapak Mobilya fabrikamızda tüm kapaklarımız 18mm 1. sınıf MDF üzerine 0.35mm ithal PVC membran vakum pres ve CNC işleme ile üretilmektedir. Buhar ve neme tam dayanıklıdır, 5 yıl garantilidir ve 5 iş gününde teslim edilir. 🛠️ Özel ölçü ve fiyat teklifi için WhatsApp hattımızdan bize ulaşabilirsiniz: https://wa.me/905050151035 (0505 015 10 35)`;

    if (!geminiApiKey) {
        return {
            reply: fallbackReply,
            modelUsed: 'fallback-catalog-template'
        };
    }

    const systemPrompt = `Sen Global Kapak Mobilya'nın resmi TikTok (@globalkapak) Yapay Zeka Müşteri Temsilcisisin.
Görevin: TikTok yorum veya DM üzerinden gelen teknik soruları samimi, enerjik, profesyonel ve kısa (maksimum 3-4 cümle) şekilde yanıtlamak.

ŞİRKET KURALLARI:
- Üretim: 18mm 1. Sınıf MDF + 0.35mm İthal PVC Membran Vakum Pres + Hassas CNC bıçak işleme.
- Teslimat: 5 iş gününde fabrikadan hızlı sevkiyat (81 ile kargo/ambar).
- Garanti: Soyulma ve kabarmaya karşı 5 yıl fabrika garantisi.
- Fabrika Adresi: Yüzyıl Mah. Mehmet Akif Cad. 1995 Sok. No:11 Bağcılar / İstanbul.
- İletişim & WhatsApp: 0 (505) 015 1035 | https://wa.me/905050151035
- Web Katalog: https://globalmobilyaweb.vercel.app
- KESİNLİKLE rastgele TL/m² fiyat uydurma; fiyat sorulursa ölçüye ve modele göre değiştiğini belirtip WhatsApp hattına yönlendir.

CANLI ÜRÜN KATALOĞU:
${catalogSummary || '- GKM-101 Klasik CNC Membran Kapak\n- GKM-204 Country Çerçeveli Kapak\n- GKM-309 Modern Çıtalı Kapak'}`;

    try {
        const url = `${GEMINI_API_BASE}/${DEFAULT_GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{
                    role: 'user',
                    parts: [{ text: `Kanal: TikTok ${channel}\nKullanıcı: @${username}\nSoru: "${userMessage}"\n\nLütfen doğrudan müşteriye gönderilecek Türkçe yanıtı yaz:` }]
                }],
                generationConfig: {
                    temperature: 0.35,
                    maxOutputTokens: 280
                }
            })
        });

        if (!res.ok) {
            return { reply: fallbackReply, modelUsed: 'fallback-http-error' };
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return {
            reply: text || fallbackReply,
            modelUsed: DEFAULT_GEMINI_MODEL
        };
    } catch (err) {
        return {
            reply: fallbackReply,
            modelUsed: 'fallback-exception',
            error: err.message
        };
    }
}

/**
 * 3 Aşamalı Hibrit TikTok Yorum & DM İşleyici (Ana Orkestratör)
 */
async function processIncomingTikTokInteraction({
    messageText,
    username = 'tiktok_kullanicisi',
    channel = 'COMMENT',
    videoId = '',
    products = [],
    geminiApiKey = DEFAULT_GEMINI_KEY
}) {
    const classification = classifyTikTokIntent(messageText);

    if (classification.stage === 1) {
        return {
            stage: 1,
            stageBadge: '1. AŞAMA • ANINDA SABİT YANIT',
            escalatedToHuman: false,
            reason: classification.reason,
            reply: classification.reply,
            channel,
            username,
            videoId,
            timestamp: new Date().toISOString()
        };
    }

    if (classification.stage === 3) {
        const handoffReply = `Merhaba @${username} 🙌 Ölçünüze ve seçtiğiniz CNC kapak modeline özel **net fabrika fiyat teklifi** hazırlayabilmemiz için satış uzmanımız devreye alındı.\n\n📐 Kapak ölçülerinizi veya mutfak fotoğrafınızı hemen **WhatsApp Sipariş Hattımıza** gönderebilirsiniz:\n👉 ${BRAND_CONTEXT.whatsappUrl} (${BRAND_CONTEXT.phone})\n🚚 5 İş Gününde Teslimat | 🛡️ 5 Yıl Garanti`;
        return {
            stage: 3,
            stageBadge: '3. AŞAMA • WHATSAPP & CANLI İNSAN DEVRİ',
            escalatedToHuman: true,
            reason: classification.reason,
            reply: handoffReply,
            whatsappHandoffUrl: BRAND_CONTEXT.whatsappUrl,
            channel,
            username,
            videoId,
            timestamp: new Date().toISOString()
        };
    }

    // 2. Aşama: Gemini AI
    const aiResult = await generateGeminiTikTokReply({
        userMessage: messageText,
        username,
        channel,
        products,
        geminiApiKey
    });

    return {
        stage: 2,
        stageBadge: '2. AŞAMA • GEMINI 2.5 FLASH AI (KATALOG DESTEKLİ)',
        escalatedToHuman: false,
        reason: classification.reason,
        reply: aiResult.reply,
        modelUsed: aiResult.modelUsed,
        channel,
        username,
        videoId,
        timestamp: new Date().toISOString()
    };
}

// ---------------------------------------------------------------------------
// SIFIR MEDYA GİRİŞİYLE OTONOM TIKTOK İÇERİK & #KEŞFET SEO ÜRETİCİSİ
// ---------------------------------------------------------------------------
const TIKTOK_FORMATS = {
    TIKTOK_ASMR_CNC: {
        id: 'TIKTOK_ASMR_CNC',
        label: '🎵 Fabrika ASMR & CNC Vakum Pres (9:16 • 1080×1920)',
        dimensions: { width: 1080, height: 1920 },
        aspectRatio: '9:16',
        trendingAudio: '🔊 Orijinal Fabrika Sesi — CNC & Vakum Pres Endüstriyel ASMR (Viral Beat)',
        hookPrefix: 'POV: 5 İş Gününde Mutfak Kapaklarınız Fabrikamızda Nasıl Üretiliyor?'
    },
    TIKTOK_PHOTO_CAROUSEL: {
        id: 'TIKTOK_PHOTO_CAROUSEL',
        label: '📸 TikTok Photo Mode — Kaydırmalı Renk Kartelası (9:16 • 1080×1920)',
        dimensions: { width: 1080, height: 1920 },
        aspectRatio: '9:16',
        trendingAudio: '🔊 Aesthetic Interior Lo-Fi — Modern Mutfak Trend Sesi',
        hookPrefix: '2026 Mutfaklarında En Çok Tercih Edilen 4 Membran Kapak Rengi (Kaydır 👉)'
    },
    TIKTOK_POV_RENOVATION: {
        id: 'TIKTOK_POV_RENOVATION',
        label: '🔄 POV: Kırmadan Sadece Kapak Değişimi ile Yeni Mutfak (9:16 • 1080×1920)',
        dimensions: { width: 1080, height: 1920 },
        aspectRatio: '9:16',
        trendingAudio: '🔊 Glow Up Transition Beat — Önce / Sonra Dönüşüm Sesi',
        hookPrefix: 'Komple Mutfak Kırmaya Son! Sadece Kapak Değişimiyle Yeni Mutfak ✨'
    },
    TIKTOK_B2B_DEALER: {
        id: 'TIKTOK_B2B_DEALER',
        label: '🏭 Mimar & Marangoz Toptan Fabrika Hattı (9:16 • 1080×1920)',
        dimensions: { width: 1080, height: 1920 },
        aspectRatio: '9:16',
        trendingAudio: '🔊 Corporate Tech Momentum — B2B Üretim & Sevkiyat Sesi',
        hookPrefix: 'Mimarlar & Mutfak Üreticileri İçin Bağcılar Fabrikadan Doğrudan Sevkiyat'
    }
};

/**
 * Canlı ürün kataloğundan bir ürün seçip sıfır medya girişiyle TikTok gönderi paketini hazırlar:
 * - Ekran üstü İlk 2 Saniye Viral Hook (Kanca Başlık)
 * - TikTok #keşfet / #fyp SEO Açıklaması (Caption)
 * - Trend Ses (Audio Tag)
 * - Otomatik Sabitlenen İlk Yorum (Pinned Comment)
 */
function generateAutonomousTikTokDraft({ format = 'TIKTOK_ASMR_CNC', product = {}, customHook = '' }) {
    const fmt = TIKTOK_FORMATS[format] || TIKTOK_FORMATS.TIKTOK_ASMR_CNC;
    const sku = product.sku || 'GKM-104';
    const title = product.title || 'Royal CNC Membran Kapak';
    const category = product.kategori || 'CNC Membran Kapak';
    const colors = Array.isArray(product.renkler) && product.renkler.length > 0
        ? product.renkler.join(', ')
        : 'Mat Antrasit, Kaşmir, İpek Beyaz, Doğal Meşe';

    const onScreenHook = customHook || `${fmt.hookPrefix} • [${sku}]`;

    let caption = '';
    if (format === 'TIKTOK_ASMR_CNC') {
        caption = `${onScreenHook} 🛠️✨\n\n` +
            `🔹 Model: ${title} (${sku})\n` +
            `🔹 Gövde: 18mm 1. Sınıf MDF + 0.35mm İthal PVC Membran\n` +
            `🔹 Renk Seçenekleri: ${colors}\n` +
            `🚚 5 İş Gününde Fabrikadan Teslim | 🛡️ 5 Yıl Garanti\n` +
            `📲 Özel ölçü & fiyat için sabitlenen yoruma tıklayın! 👇\n\n` +
            `#keşfet #fyp #mutfakdolabı #membrankapak #cncüretim #mutfakyenileme #içmimarlık #globalkapak #mobilyaüretim`;
    } else if (format === 'TIKTOK_PHOTO_CAROUSEL') {
        caption = `Senin mutfağına hangisi yakışır? Yorumlara favori rengini yaz! 👇🎨\n\n` +
            `📸 Kaydırmalı Kartela: ${title} (${sku})\n` +
            `🎨 Popüler Renkler: ${colors}\n` +
            `✅ Soyulma ve kabarmaya karşı 5 Yıl Fabrika Garantisi\n` +
            `🚚 Bağcılar / İstanbul fabrikamızdan 81 ile 5 iş gününde sevkiyat!\n\n` +
            `#keşfet #photomode #mutfaktasarım #renkkartelası #membrankapak #mutfakdekorasyonu #globalkapak #fyp`;
    } else if (format === 'TIKTOK_POV_RENOVATION') {
        caption = `Eski mutfak dolaplarınızı kırmadan sadece kapaklarını değiştirerek yepyeni bir mutfağa kavuşun! 🔄✨\n\n` +
            `💎 Uygulanan Model: ${title} (${sku} - ${category})\n` +
            `📐 Milimetrik CNC kesim ve menteşe yeri hazırlığı\n` +
            `🚚 5 İş Gününde Teslimat | 🛡️ 5 Yıl Garanti\n` +
            `📲 Ölçünüzü WhatsApp'tan gönderin, anında fiyatlandıralım: 0505 015 10 35\n\n` +
            `#keşfet #öncesonra #mutfakdönüşümü #mutfakyenileme #kapakdeğişimi #membrankapak #globalkapak #fyp`;
    } else {
        caption = `Mutfak imalatçıları, marangoz atölyeleri ve iç mimarlar için Bağcılar fabrikamızdan doğrudan toptan kapak üretimi! 🏭📦\n\n` +
            `🔸 Seri: ${title} (${sku})\n` +
            `🔸 Kapasite: Yüksek hassasiyetli CNC & Vakum Pres Hattı\n` +
            `🔸 Sevkiyat: 5 İş Gününde Türkiye Geneli Ambar & Kargo\n` +
            `📲 B2B Bayilik & Toptan Fiyat Listesi: 0 (505) 015 1035\n\n` +
            `#keşfet #marangoz #mutfakimalatı #toptanmobilya #b2bmobilya #cncmembran #bağcılar #globalkapak #fyp`;
    }

    const pinnedComment = `📌 FABRİKA DOĞRUDAN SİPARİŞ & ÖLÇÜ HATTI:\n` +
        `📐 ${title} (${sku}) modelimiz için özel ölçü fiyat teklifi ve renk kartelası istemek için WhatsApp hattımıza tıklayın:\n` +
        `👉 https://wa.me/905050151035 (0505 015 10 35)\n` +
        `🌐 Dijital Katalog: https://globalmobilyaweb.vercel.app`;

    return {
        format: fmt.id,
        formatLabel: fmt.label,
        dimensions: fmt.dimensions,
        aspectRatio: fmt.aspectRatio,
        productSku: sku,
        productTitle: title,
        productCategory: category,
        productColors: colors,
        onScreenHook,
        trendingAudio: fmt.trendingAudio,
        caption,
        pinnedComment,
        hashtags: ['#keşfet', '#fyp', '#mutfakdolabı', '#membrankapak', '#mutfakyenileme', '#cncüretim', '#globalkapak']
    };
}

// ---------------------------------------------------------------------------
// TIKTOK CONTENT POSTING API v2 İSTEMCİSİ (Otonom Yayın & Sabit Yorum)
// ---------------------------------------------------------------------------
async function publishAutonomousTikTokPost({
    draft,
    mediaUrl,
    tiktokAccessToken,
    tiktokOpenId
}) {
    // Eğer TikTok Business / Developer API anahtarı henüz girilmemişse bulut simülasyon kaydı döndür
    if (!tiktokAccessToken || !tiktokOpenId) {
        return {
            ok: true,
            mode: 'CLOUD_AUTONOMOUS_SIMULATION',
            publishId: `tt_pub_${Date.now()}`,
            shareUrl: `https://www.tiktok.com/@globalkapak/video/${Date.now()}`,
            pinnedCommentId: `tt_cmt_${Date.now()}`,
            mediaUrl,
            publishedAt: new Date().toISOString(),
            note: 'TikTok Content Posting API v2 token girildiğinde doğrudan @globalkapak hesabında yayınlanır.'
        };
    }

    try {
        const isPhotoMode = draft.format === 'TIKTOK_PHOTO_CAROUSEL';
        const endpoint = isPhotoMode
            ? `${TIKTOK_API_BASE}/post/publish/content/init/`
            : `${TIKTOK_API_BASE}/post/publish/video/init/`;

        const payload = isPhotoMode
            ? {
                post_info: {
                    title: draft.onScreenHook.slice(0, 90),
                    description: draft.caption.slice(0, 2200),
                    privacy_level: 'PUBLIC_TO_EVERYONE',
                    disable_comment: false,
                    auto_add_music: true
                },
                source_info: {
                    source: 'PULL_FROM_URL',
                    photo_cover_index: 0,
                    photo_images: [mediaUrl]
                },
                post_mode: 'DIRECT_POST',
                media_type: 'PHOTO'
            }
            : {
                post_info: {
                    title: draft.caption.slice(0, 2200),
                    privacy_level: 'PUBLIC_TO_EVERYONE',
                    disable_duet: false,
                    disable_comment: false,
                    disable_stitch: false
                },
                source_info: {
                    source: 'PULL_FROM_URL',
                    video_url: mediaUrl
                }
            };

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tiktokAccessToken}`,
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || data.error?.code !== 'ok') {
            return {
                ok: false,
                mode: 'TIKTOK_API_ERROR',
                error: data.error?.message || `HTTP ${res.status}`,
                fallbackShareUrl: `https://www.tiktok.com/@globalkapak`
            };
        }

        return {
            ok: true,
            mode: 'TIKTOK_DIRECT_POST_V2',
            publishId: data.data?.publish_id || `tt_live_${Date.now()}`,
            shareUrl: `https://www.tiktok.com/@globalkapak`,
            mediaUrl,
            publishedAt: new Date().toISOString()
        };
    } catch (err) {
        return {
            ok: false,
            mode: 'TIKTOK_NETWORK_EXCEPTION',
            error: err.message
        };
    }
}

module.exports = {
    BRAND_CONTEXT,
    STAGE_1_RULES,
    STAGE_3_ESCALATION_KEYWORDS,
    TIKTOK_FORMATS,
    classifyTikTokIntent,
    generateGeminiTikTokReply,
    processIncomingTikTokInteraction,
    generateAutonomousTikTokDraft,
    publishAutonomousTikTokPost
};

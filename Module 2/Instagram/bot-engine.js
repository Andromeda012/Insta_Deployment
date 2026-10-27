/**
 * GLOBAL KAPAK MOBİLYA — MODULE 2: INSTAGRAM BULUT BOT MOTORU (bot-engine.js)
 *
 * Özellikler:
 * 1. 7/24 Bulut Sunucu Uyumlu (Cihaz bağımsız çalışır, tüm durumunu Supabase'de tutar).
 * 2. Onaysız Otomatik Paylaşım Motoru:
 *    - Belirli saat aralıklarında (örn. 10:00 Gönderi, 14:30 Story, 19:30 Reels)
 *      hiçbir manuel onay beklemeden doğrudan Instagram Graph API üzerinden yayınlar.
 * 3. 3 Aşamalı Akıllı İletişim & DM / Yorum Yanıt Sistemi:
 *    - 1. Aşama (Basit Sorular): Anahtar kelime eşleşmesi ile milisaniyeler içinde sabit kurumsal cevap.
 *    - 2. Aşama (Karmaşık & Teknik Sorular): Supabase'deki canlı ürün kataloğunu bilen Gemini AI devreye girer.
 *    - 3. Aşama (Gerçek İnsan & WhatsApp Devri): Sipariş, özel ölçü fiyatlandırma veya yetkili talebinde
 *      müşteriyi otomatik hazır mesajlı WhatsApp hattına (+90 505 015 1035) ve telefon iletişimine yönlendirir.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
const DEFAULT_SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const DEFAULT_SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';

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

// ── 1. OTOMATİK PAYLAŞIM MOTORU (GÖNDERİ, REELS, STORY - ONAYSIZ) ──────────
export async function publishToInstagramGraphApi({
  igUserId,
  accessToken,
  mediaType = 'POST', // 'POST' | 'REELS' | 'STORIES'
  mediaUrl,
  caption = '',
  IsVideo = false
}) {
  if (!igUserId || !accessToken) {
    // Eğer henüz resmi Meta token girilmemişse bulut simülasyon modunda başarılı kayıt döner
    return {
      simulated: true,
      containerId: `sim_cont_${Date.now()}`,
      mediaId: `sim_ig_${mediaType.toLowerCase()}_${Date.now()}`,
      publishedAt: new Date().toISOString(),
      note: 'Bulut Otonom Yayın Simülasyonu (Canlı Meta Token girildiğinde doğrudan Instagram API çağrılır)'
    };
  }

  const createParams = new URLSearchParams();
  createParams.set('access_token', accessToken);

  const upperType = (mediaType || 'POST').toUpperCase();
  const isVideoFile = IsVideo || /\.(mp4|mov|webm)(\?.*)?$/i.test(mediaUrl || '');

  if (upperType === 'REELS') {
    createParams.set('media_type', 'REELS');
    createParams.set('video_url', mediaUrl);
    createParams.set('caption', caption);
    createParams.set('share_to_feed', 'true');
  } else if (upperType === 'STORIES') {
    createParams.set('media_type', 'STORIES');
    if (isVideoFile) {
      createParams.set('video_url', mediaUrl);
    } else {
      createParams.set('image_url', mediaUrl);
    }
  } else {
    // Standart Akış Gönderisi (POST)
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
  if (upperType === 'REELS' || upperType === 'STORIES' || isVideoFile) {
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 4000));
      const statusRes = await fetch(`${GRAPH_API_BASE}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`);
      const statusData = await statusRes.json();
      if (statusData.status_code === 'FINISHED') break;
      if (statusData.status_code === 'ERROR') {
        throw new Error(`Instagram video işleme hatası: ${statusData.status || 'Bilinmeyen hata'}`);
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
    containerId: creationId,
    mediaId: pubData.id,
    publishedAt: new Date().toISOString()
  };
}

// ── 2. ÜÇ AŞAMALI İLETİŞİM MOTORU (SABİT KURAL -> GEMINI AI -> WHATSAPP/İNSAN) ─
export async function evaluateThreeTierCommunication({
  incomingText,
  senderUsername = '@musteri',
  channel = 'DM', // 'DM' | 'COMMENT'
  config = {},
  keywordRules = DEFAULT_TIER1_RULES,
  productsCatalog = []
}) {
  const cleanText = (incomingText || '').trim();
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
      tier_label: '3. Aşama: İnsan Temsilci & WhatsApp Yönlendirme',
      matched_rule: `Doğrudan Tetikleyici: "${directTier3Match}"`,
      bot_reply: reply,
      handoff_status: 'waiting_human',
      whatsapp_link: prefilledWa
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
        return {
          resolved_tier: 3,
          tier_label: '3. Aşama: İnsan Temsilci & WhatsApp Yönlendirme',
          matched_rule: rule.rule_name,
          bot_reply: `${rule.response_text}\n\n📲 WhatsApp Hattımız: ${waLink}`,
          handoff_status: 'waiting_human',
          whatsapp_link: waLink
        };
      }

      return {
        resolved_tier: 1,
        tier_label: '1. Aşama: Sabit Kurumsal Cevap',
        matched_rule: `${rule.rule_name} ("${matchedKw}")`,
        bot_reply: rule.response_text,
        handoff_status: 'resolved',
        whatsapp_link: ''
      };
    }
  }

  // ── 2. AŞAMA: KARMAŞIK VE DESTEK GEREKTİREN SORULARDA GEMINI AI DEVREDE ──
  const geminiKey = (config.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
  const catalogContext = (productsCatalog || []).slice(0, 10).map(p =>
    `- ${p.title || p.slug} (${p.kategori || 'Membran Kapak'}): ${p.kisa_aciklama || 'Özel ölçü 18mm MDF CNC membran kapak'}`
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
          return {
            resolved_tier: 3,
            tier_label: '3. Aşama: Gemini AI Analizi → İnsan / WhatsApp Devri',
            matched_rule: parsed.handoff_reason || 'Karmaşık Sipariş / Uzman Desteği',
            bot_reply: `${parsed.reply}\n\n📲 **Uzman Temsilcimizle WhatsApp'tan Görüşün:** ${waLink} (${phoneDisplay})`,
            handoff_status: 'waiting_human',
            whatsapp_link: waLink
          };
        }

        if (parsed.reply) {
          return {
            resolved_tier: 2,
            tier_label: '2. Aşama: Gemini AI Akıllı Yanıt',
            matched_rule: `Gemini AI (${geminiModel})`,
            bot_reply: parsed.reply,
            handoff_status: 'resolved',
            whatsapp_link: ''
          };
        }
      }
    } catch (err) {
      console.error('Gemini AI çağrı hatası:', err.message);
    }
  }

  // Gemini API anahtarı henüz girilmemişse veya çok spesifik teknik soruysa:
  // Akıllı Katalog Analizli 2. Aşama Yanıtı + 3. Aşama Bağlantı Seçeneği
  const isComplexTechnical = /ölçü|cm|metre|mutfak|banyo|dolap|kapak|model|desen|cnc|folyo|pvc|renk|uygun mu|nasıl/i.test(lowerText);
  if (isComplexTechnical) {
    const waLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, "${cleanText}" hakkında bilgi almak istiyorum.`)}`;
    return {
      resolved_tier: 2,
      tier_label: '2. Aşama: Gemini AI Teknik & Katalog Asistanı',
      matched_rule: 'AI Katalog & Özel Ölçü Analizi',
      bot_reply: `Sorunuz için teşekkür ederiz! 🤖 Global Kapak Mobilya olarak tüm CNC membran kapak modellerimizi mutfak, banyo ve gardırop ölçünüze göre **milimetrik özel ebatlarda (18mm E1 MDF gövde, suya/buhara tam dayanıklı yüzey)** üretiyoruz. Web sitemizdeki **Canlı Tasarım Modu** üzerinden ebat ve renk önizlemesi yapabilir (https://globalmobilyaweb.vercel.app/urunler.html) veya ölçünüzü doğrudan uzman ekibimize iletmek için WhatsApp hattımıza tıklayabilirsiniz: ${waLink}`,
      handoff_status: 'resolved',
      whatsapp_link: waLink
    };
  }

  // Diğer tüm durumlarda 3. Aşama (Gerçek İnsan / WhatsApp Devri)
  const fallbackWaLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Merhaba Global Kapak Mobilya, Instagram üzerinden yazıyorum: "${cleanText}"`)}`;
  return {
    resolved_tier: 3,
    tier_label: '3. Aşama: İnsan Temsilci & WhatsApp Yönlendirme',
    matched_rule: 'Özel Destek & Temsilci Devri',
    bot_reply: `Mesajınız için teşekkür ederiz! 🙌 Konuyla ilgili size en doğru bilgiyi ve özel teklifi sunabilmemiz için müşteri temsilcimiz sizi bekliyor.\n\n📲 **WhatsApp Canlı Destek:** ${fallbackWaLink}\n📞 **Telefon:** ${phoneDisplay}`,
    handoff_status: 'waiting_human',
    whatsapp_link: fallbackWaLink
  };
}

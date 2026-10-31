/**
 * NOVA FURNITURE — PHOTOROOM AI & 4-BOT OTONOM DAĞITIM MOTORU
 * ============================================================================
 * Bu motor:
 * 1. Supabase'deki ürün kataloğundan ham (işlenmemiş) ürün fotoğrafını alır.
 * 2. Sabit lüks İskandinav mimari oda prompt'u ile Supabase ürün detaylarını
 *    (başlık, kategori, teknik özellikler, ölçüler, renkler) birleştirerek
 *    Photoroom API'ye iletir.
 * 3. Photoroom API'den gelen arka planı işlenmiş kusursuz fotoğraftan 2 ana format üretir:
 *    - Format 1: İşlenmiş Temiz Fotoğraf & 9:16 Video (Instagram Reels, TikTok, YouTube Shorts, Story).
 *    - Format 2: Detay Maddeli Gönderi (Sol: İşlenmiş oda görseli, Sağ: Supabase detay maddeleri & WhatsApp CTA).
 * 4. Üretilen tüm varlıkları Supabase'e (social_campaign_assets) kaydeder.
 * 5. 4 Bot (Instagram, Facebook, TikTok, YouTube) bu varlıkları Supabase'den çekerek
 *    kendi zaman çizelgelerine göre otomatik dağıtır.
 * 6. Şimdilik API Key yoksa "Photoroom Sandbox / Mock Engine" devreye girer ve
 *    gerçekçi mimari simülasyonu eksiksiz çalıştırır. API Key eklendiği anda canlı Photoroom API devralır.
 * 7. Gemini bu motorun hiçbir üretim aşamasında yer almaz; Gemini sadece gelen
 *    yorum ve DM mesajlarını akıllıca yanıtlamak için kullanılır.
 * ============================================================================
 */

// NOT: Bu dosya Vercel sunucu tarafında (package.json "type": "module") ES Module olarak
// import edilir. Tarayıcı paneli ise "Module 2/photoroom-engine.js" kopyasını klasik
// <script> olarak yükler. Bu yüzden burada UMD yerine ESM export kullanılır.
const PhotoroomEngine = (function () {

  // Meta Graph API yalnızca JPG/PNG görsel ve MP4/MOV video kabul eder (SVG reddedilir).
  const DEFAULT_REELS_MP4 = 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/instagram/reels-1793379608273-qhjj.mp4';

  const BRAND = {
    name: 'NOVA FURNITURE',
    handle: '@thenovafurniture',
    phone: '0 (505) 015 1035',
    whatsapp: 'https://wa.me/905050151035',
    tagline: 'Minimalist Çizgiler • 1. Sınıf Mimari Tasarım'
  };

  const SUPABASE_CONFIG = {
    url: (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || 'https://vrfujrpsjzqjthaqdalx.supabase.co',
    key: (typeof process !== 'undefined' && process.env?.SUPABASE_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4',
    mediaFallback: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/bahar-portmanto-ymz9.png'
  };

  /**
   * Photoroom için her üründe kullanılan SABİT LÜKS İÇ MEKAN PROMPT'U
   */
  const PHOTOROOM_FIXED_PROMPT = 
    "Ultra-luxurious modern Scandinavian architectural living room, warm greige micro-cement and dark charcoal walls, natural oak acoustic wood slat panels, polished warm herringbone parquet flooring with soft natural floor reflections, cinematic golden hour window directional sunlight from the left, soft ambient ceiling spot cone, minimalist designer aesthetic, 8k resolution, architectural digest photography, perfectly positioned furniture with realistic contact and ambient drop shadow";

  /**
   * Supabase'deki ürün detaylarını sabit Photoroom prompt'una ekler.
   */
  function buildPhotoroomPrompt(product = {}) {
    const title = (product.title || product.baslik || 'Lüks Tasarım Mobilya').trim();
    const cleanName = title.replace(/^NOVA\s*[-–—:]*\s*/i, '');
    const category = product.kategori || product.category || '1. Sınıf MDF • CNC Membran Kapak';

    // Özellikler
    let specs = '18mm E1 Sertifikalı Dayanıklı MDF Gövde, Çizilmez İthal Membran Yüzey, Sessiz Frenli Menteşe & Ray Donanımı';
    if (Array.isArray(product.ozellikler) && product.ozellikler.length > 0) {
      specs = product.ozellikler.map(s => String(s).replace(/^[\u{1F300}-\u{1F9FF}🪵✨🪞🗄️🧹✓•-]\s*/u, '')).join(', ');
    } else if (typeof product.ozellikler === 'string' && product.ozellikler.trim()) {
      specs = product.ozellikler;
    }

    // Ölçüler
    let dims = 'Standart & Kişiye Özel Üretim';
    const rawDims = product.olculer || product.body;
    if (rawDims) {
      if (typeof rawDims === 'object') {
        dims = Object.entries(rawDims).map(([k, v]) => `${capitalizeWord(k.replace(/_/g, ' '))}: ${v}`).join(' | ');
      } else {
        dims = String(rawDims).trim().slice(0, 90);
      }
    }

    // Renkler
    let colors = 'Mat Antrasit / Doğal Ahşap / Kaşmir Gri';
    if (Array.isArray(product.renkler) && product.renkler.length > 0) {
      colors = product.renkler.map(c => (typeof c === 'object' ? (c.name || c.ad) : c)).join(', ');
    } else if (typeof product.renkler === 'string' && product.renkler.trim()) {
      colors = product.renkler;
    }

    return `${PHOTOROOM_FIXED_PROMPT}

[SUPABASE_DATABASE_FURNITURE_METADATA]:
- Product Name: ${cleanName}
- Category: ${category}
- Technical Specs: ${specs}
- Dimensions: ${dims}
- Color Palette: ${colors}
- Subject Placement: Center-foreground on herringbone parquet floor with realistic ground contact shadow and soft ambient occlusion.`;
  }

  /**
   * Photoroom API Çağrısı (API Key Varsa Canlı API, Yoksa Sandbox Mock Motoru)
   */
  async function generatePhotoroomHeroImage({ product = {}, rawImageUrl = '', aspectRatio = '1:1', apiKey = '' }) {
    const prompt = buildPhotoroomPrompt(product);
    const validRawUrl = (rawImageUrl && rawImageUrl.startsWith('http')) ? rawImageUrl : SUPABASE_CONFIG.mediaFallback;

    const key = (apiKey || (typeof process !== 'undefined' && process.env?.PHOTOROOM_API_KEY) || '').trim();

    // ── DURUM 1: CANLI PHOTOROOM API ANAHTARI MEVCUTSA ───────────────────────
    if (key) {
      try {
        console.log(`[Photoroom API] Canlı API çağrısı yapılıyor (${aspectRatio})...`);
        const formPayload = new URLSearchParams();
        formPayload.set('image_url', validRawUrl);
        formPayload.set('background.prompt', prompt);
        formPayload.set('background.scaling', 'fill');
        formPayload.set('padding', '0.08');
        formPayload.set('shadow.mode', 'ai.soft');
        formPayload.set('aspect_ratio', aspectRatio);
        formPayload.set('output_format', 'png');

        const apiRes = await fetch('https://image-api.photoroom.com/v2/edit', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formPayload.toString()
        });

        if (apiRes.ok) {
          const blobData = await apiRes.arrayBuffer();
          const buffer = Buffer.from(blobData);
          const fileName = `photoroom-${(product.slug || 'prod')}-${aspectRatio.replace(':', 'x')}-${Date.now()}.png`;

          const uploadedUrl = await uploadBufferToStorage(`photoroom/${fileName}`, buffer, 'image/png');
          if (uploadedUrl) {
            return {
              ok: true,
              mode: 'LIVE_PHOTOROOM_API',
              imageUrl: uploadedUrl,
              prompt,
              aspectRatio
            };
          }
        } else {
          const errText = await apiRes.text();
          console.warn('[Photoroom API] Yanıt hatası, sandbox fallback devreye giriyor:', errText);
        }
      } catch (err) {
        console.warn('[Photoroom API] İstek hatası, sandbox fallback devrede:', err.message);
      }
    }

    // ── DURUM 2: API KEY HENÜZ YOKSA (SANDBOX / MOCK ARCHITECTURAL SIMULATION) ──
    // Kullanıcının "Şimdilik elimizde API yok sadece bu mimari için yapıyı tekrar kurmanı istiyorum" talebi.
    console.log(`[Photoroom Sandbox] API Key bulunamadı veya henüz eklenmedi. Sabit lüks prompt + Supabase mimari simülatörü çalışıyor.`);
    
    const isVertical = aspectRatio === '9:16';
    const embeddedRaw = await fetchAsDataUri(validRawUrl);
    const simulatedSvg = renderSandboxHeroSvg({
      product,
      rawImageUrl: embeddedRaw,
      prompt,
      isVertical
    });

    const safeSlug = (product.slug || 'prod').replace(/[^a-zA-Z0-9_-]/g, '');
    const basePath = `photoroom/photoroom-sandbox-${safeSlug}-${aspectRatio.replace(':', 'x')}-${Date.now()}`;
    const uploadedUrl = await convertSvgToPngInStorage(simulatedSvg, basePath, 1080, isVertical ? 1920 : 1080, validRawUrl);

    return {
      ok: true,
      mode: 'PHOTOROOM_SANDBOX_MOCK',
      isSandbox: true,
      imageUrl: uploadedUrl || validRawUrl,
      prompt,
      aspectRatio,
      note: 'API anahtarı girildiğinde doğrudan canlı Photoroom API çıktıları kaydedilecektir.'
    };
  }

  /**
   * 2. FORMAT: DETAY MADDELİ GÖNDERİ (Sol: İşlenmiş Oda Görseli, Sağ: Supabase Detayları)
   * 1080x1080 Kare Gönderi Formatı
   */
  async function generateDetailedSpecPost({ product = {}, heroImageUrl = '' }) {
    const cleanHeroUrl = (heroImageUrl && heroImageUrl.startsWith('http')) ? heroImageUrl : SUPABASE_CONFIG.mediaFallback;
    const svg = renderDetailedSpecPostSvg({ product, heroImageUrl: await fetchAsDataUri(cleanHeroUrl) });

    const safeSlug = (product.slug || 'prod').replace(/[^a-zA-Z0-9_-]/g, '');
    const uploadedUrl = await convertSvgToPngInStorage(svg, `posts/post-detailed-${safeSlug}-${Date.now()}`, 1080, 1080, cleanHeroUrl);

    return {
      ok: true,
      format: 'DETAILED_POST',
      width: 1080,
      height: 1080,
      imageUrl: uploadedUrl || cleanHeroUrl,
      title: product.title || 'Detay Maddeli Gönderi'
    };
  }

  /**
   * STORY FORMATI: 9:16 Dikey Format (Üstte İşlenmiş Oda Görseli, Altta Supabase Detay Kartları)
   */
  async function generateStoryPost({ product = {}, heroImageUrl = '' }) {
    const cleanHeroUrl = (heroImageUrl && heroImageUrl.startsWith('http')) ? heroImageUrl : SUPABASE_CONFIG.mediaFallback;
    const svg = renderStorySvg({ product, heroImageUrl: await fetchAsDataUri(cleanHeroUrl) });

    const safeSlug = (product.slug || 'prod').replace(/[^a-zA-Z0-9_-]/g, '');
    const uploadedUrl = await convertSvgToPngInStorage(svg, `stories/story-${safeSlug}-${Date.now()}`, 1080, 1920, cleanHeroUrl);

    return {
      ok: true,
      format: 'STORY',
      width: 1080,
      height: 1920,
      imageUrl: uploadedUrl || cleanHeroUrl
    };
  }

  /**
   * NOVA FURNITURE — LÜKS METİN & AÇIKLAMA (CAPTION) ŞABLONU
   * Gemini'den tamamen bağımsız, KESİNLİKLE web linki ve #globalkapak içermez!
   */
  function generateNovaLuxuryCaption(product = {}, platform = 'instagram') {
    const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
    const title = rawTitle.toUpperCase();
    const cleanName = title.replace(/^NOVA\s*[-–—:]*\s*/i, '');
    
    // Öne Çıkan Özellikler (Supabase'den çekilir)
    const defaultFeatures = [
      '🪵 1. Sınıf Sağlam E1 MDF Gövde & CNC Membran Kapaklar',
      '🪞 Çizilmeye & neme dayanıklı ithal membran yüzey teknolojisi',
      '🗄️ Sessiz kapanan frenli teleskopik ray ve menteşe donanımı',
      '🧹 Robot süpürgeye uygun ergonomik yüksek ayak tasarımı'
    ];
    let features = defaultFeatures;
    if (Array.isArray(product.ozellikler) && product.ozellikler.length > 0) {
      features = product.ozellikler.map(f => {
        f = String(f).trim();
        if (/^[\u{1F300}-\u{1F9FF}🪵✨🪞🗄️🧹✓•-]/u.test(f)) return f;
        return `🪵 ${f}`;
      });
    }

    // Net Katalog Ölçüleri
    let dimText = '';
    const rawDims = product.olculer || product.body;
    if (rawDims) {
      if (typeof rawDims === 'object') {
        dimText = Object.entries(rawDims)
          .map(([k, v]) => `• ${capitalizeWord(k.replace(/_/g, ' '))}: ${v}`)
          .join('\n');
      } else {
        dimText = String(rawDims).trim();
      }
    }
    if (!dimText) {
      dimText = '• Gardırop: 240 cm x 210 cm x 55 cm\n• Şifonyer: 118 cm x 80 cm x 44 cm\n• Komodin: 55 cm x 56 cm x 44 cm';
    }

    const cleanTag = cleanName.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '');
    const hashtags = `#novafurniture #${cleanTag || 'koleksiyon'} #minimalistmobilya #yatakodasıtakımı #gardırop #şifonyer #komodin #membrankapak #mdfmobilya #cnckapak #içmimari #luxuryfurniture`;

    if (platform === 'youtube') {
      return `⛰️ NOVA | ${cleanName} Koleksiyonu — 1. Sınıf Mimari Tasarım #Shorts

Minimalist tasarım, maksimum düzen! Modern İskandinav çizgilerine sahip ${cleanName} Koleksiyonu, 1. sınıf MDF gövdesi ve CNC membran kapak kalitesiyle yaşam alanınıza değer katıyor.

✨ Öne Çıkan Özellikler:
${features.join('\n')}

📐 Net Katalog Ölçüleri:
${dimText}

🏷️ FİYAT & SİPARİŞ BİLGİSİ:
💬 Yoruma "FİYAT" yazın, detaylı kataloğu ve güncel liste fiyatını paylaşalım!
📲 WhatsApp Sipariş & Destek Hattı: ${BRAND.phone}

${hashtags}`;
    }

    return `thenovafurniture ⛰️ NOVA | ${cleanName.toUpperCase()} KOLEKSİYONU

Minimalist tasarım, maksimum düzen! Modern İskandinav çizgilerine sahip ${cleanName} Koleksiyonu, göz yormayan estetiği ve 1. sınıf malzeme kalitesiyle yaşam alanınızı yeniliyor.

✨ Öne Çıkan Özellikler:
${features.join('\n')}

📐 Net Katalog Ölçüleri:
${dimText}

🏷️ FİYAT & SİPARİŞ BİLGİSİ İÇİN:
💭 Yoruma "FİYAT" yazın, net fiyatımızı ve detaylı kataloğu anında DM kutunuza gönderelim! 👇
📲 Profilimizdeki WhatsApp hattından da bize ulaşabilirsiniz (${BRAND.phone}).

📌 Minimalist ev tasarımı için bu gönderiyi KAYDEDİN!

${hashtags}`;
  }

  /**
   * TÜM KAMPANYA PAKETİNİ OLUŞTURUR VE SUPABASE'E KAYDEDER
   * (4 Botun ortak beslendiği merkez)
   */
  async function buildAndSaveProductCampaign({ product = {}, apiKey = '' }) {
    console.log(`[Campaign Pipeline] ${product.title || product.slug} için üretim başlatıldı...`);
    const prompt = buildPhotoroomPrompt(product);

    // 1. Photoroom Hero Görselini Üret (1:1 ve 9:16)
    const hero1x1 = await generatePhotoroomHeroImage({
      product,
      rawImageUrl: product.ana_resim,
      aspectRatio: '1:1',
      apiKey
    });

    const hero9x16 = await generatePhotoroomHeroImage({
      product,
      rawImageUrl: product.ana_resim,
      aspectRatio: '9:16',
      apiKey
    });

    // 2. Detay Maddeli Gönderiyi Üret (Output 2)
    const detailedPost = await generateDetailedSpecPost({
      product,
      heroImageUrl: hero1x1.imageUrl
    });

    // 3. Story Formatını Üret
    const storyPost = await generateStoryPost({
      product,
      heroImageUrl: hero9x16.imageUrl
    });

    // 4. Reels Videosu: Meta yalnızca gerçek video (MP4) kabul eder.
    // Ürüne ait kayıtlı bir Reels videosu varsa kullanılır; yoksa bot ürün videosu kütüphanesine bakar.
    const productVideo = product.reels_video_url || product.video_url || '';
    const reelsMediaUrl = /\.(mp4|mov)(\?.*)?$/i.test(productVideo) ? productVideo : '';

    // 5. Lüks Açıklama (Gemini içermez)
    const caption = generateNovaLuxuryCaption(product, 'instagram');

    // 6. Supabase Kayıt Nesnesi
    const campaignAssetRecord = {
      id: generateUuid(),
      product_slug: product.slug || 'urun',
      product_title: product.title || 'Lüks Koleksiyon',
      raw_image_url: product.ana_resim || SUPABASE_CONFIG.mediaFallback,
      photoroom_prompt: prompt,
      photoroom_hero_url: hero1x1.imageUrl,
      photoroom_hero_vertical_url: hero9x16.imageUrl,
      reels_video_url: reelsMediaUrl,
      post_image_url: detailedPost.imageUrl,
      story_image_url: storyPost.imageUrl,
      caption,
      hashtags: '#novafurniture #minimalistmobilya #icmimari #mdfmobilya #cnckapak #luxuryfurniture',
      distribution_status: {
        instagram: { status: 'scheduled', reels_at: '10:00', post_at: '14:30', story_at: '20:00', published: false },
        facebook: { status: 'scheduled', post_at: '12:00', published: false },
        tiktok: { status: 'scheduled', video_at: '16:00', published: false },
        youtube: { status: 'scheduled', shorts_at: '18:00', published: false }
      },
      is_sandbox: !!hero1x1.isSandbox,
      created_at: new Date().toISOString()
    };

    // Supabase `social_campaign_assets` tablosuna ve `site_settings`e kaydet
    await saveAssetRecordToSupabase(campaignAssetRecord);

    console.log(`[Campaign Pipeline] Kampanya hazırlandı ve Supabase'e kaydedildi: ${campaignAssetRecord.id}`);
    return campaignAssetRecord;
  }

  /**
   * 4 Botun Supabase'den aktif veya sıradaki kampanyayı çekmesi
   */
  async function fetchActiveCampaignFromSupabase(platformName = 'instagram') {
    try {
      // 1. Önce doğrudan `social_campaign_assets` tablosuna bak
      const tableRes = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/social_campaign_assets?order=created_at.desc&limit=1`, {
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`
        }
      });
      if (tableRes.ok) {
        const rows = await tableRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return rows[0];
        }
      }

      // 2. Tablo yoksa `site_settings` içindeki `social_campaign_assets` kaydına bak
      const stateRes = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/site_settings?key=eq.social_campaign_assets&select=data`, {
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`
        }
      });
      if (stateRes.ok) {
        const rows = await stateRes.json();
        const list = rows?.[0]?.data;
        if (Array.isArray(list) && list.length > 0) {
          return list[0];
        }
      }
    } catch (e) {
      console.warn('[Campaign Fetch] Supabase varlık çekme hatası:', e);
    }
    return null;
  }

  /**
   * Bot yayını yaptıktan sonra dağıtım durumunu Supabase'de günceller
   */
  async function markPlatformPublished(campaignId, platformName = 'instagram', slotType = 'POST') {
    try {
      // site_settings güncelle
      const stateRes = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/site_settings?key=eq.social_campaign_assets&select=data`, {
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`
        }
      });
      if (stateRes.ok) {
        const rows = await stateRes.json();
        const list = Array.isArray(rows?.[0]?.data) ? rows[0].data : [];
        const item = list.find(c => c.id === campaignId) || list[0];
        if (item && item.distribution_status) {
          if (!item.distribution_status[platformName]) item.distribution_status[platformName] = {};
          item.distribution_status[platformName].published = true;
          item.distribution_status[platformName].published_at = new Date().toISOString();
          item.distribution_status[platformName].slot_type = slotType;

          await fetch(`${SUPABASE_CONFIG.url}/rest/v1/site_settings`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_CONFIG.key,
              'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              key: 'social_campaign_assets',
              data: list,
              updated_at: new Date().toISOString()
            })
          });
        }
      }
    } catch (_) {}
  }

  // ── YARDIMCI VE SVG RENDERER FONKSİYONLARI ─────────────────────────────────

  async function uploadBufferToStorage(storagePath, buffer, contentType = 'image/png') {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/storage/v1/object/media/${storagePath}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
          'Content-Type': contentType,
          'x-upsert': 'true'
        },
        body: buffer
      });
      if (res.ok) {
        return `${SUPABASE_CONFIG.url}/storage/v1/object/public/media/${storagePath}`;
      }
    } catch (_) {}
    return null;
  }

  async function uploadStringToStorage(storagePath, stringContent, contentType = 'image/svg+xml') {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/storage/v1/object/media/${storagePath}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
          'Content-Type': contentType,
          'x-upsert': 'true'
        },
        body: stringContent
      });
      if (res.ok) {
        return `${SUPABASE_CONFIG.url}/storage/v1/object/public/media/${storagePath}`;
      }
    } catch (_) {}
    return null;
  }

  async function saveAssetRecordToSupabase(record) {
    return saveAssetRecordToSupabaseInner(record);
  }

  /**
   * Uzak bir görseli base64 data URI'ye çevirir. SVG rasterleştirici (librsvg)
   * harici URL'leri yüklemediği için ürün fotoğrafı SVG içine gömülür.
   */
  async function fetchAsDataUri(url) {
    try {
      if (!url || !/^https?:\/\//.test(url)) return url;
      const r = await fetch(url);
      if (!r.ok) return url;
      const ct = (r.headers.get('content-type') || 'image/png').split(';')[0];
      if (!ct.startsWith('image/') || ct.includes('svg')) return url;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 4 * 1024 * 1024) return url; // çok büyükse gömme
      return `data:${ct};base64,${buf.toString('base64')}`;
    } catch (_) {
      return url;
    }
  }

  /** Emoji karakterleri rasterleştiricide kutucuk olarak görünmesin diye temizlenir. */
  function stripEmojiForRaster(svg) {
    try {
      return svg.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
    } catch (_) {
      return svg;
    }
  }

  /**
   * SVG içeriğini gerçek PNG'ye çevirip Supabase Storage'a yükler.
   * Meta Graph API SVG kabul etmediği için tüm otonom görseller PNG olarak kaydedilir.
   * Başarısız olursa fallbackPngUrl döner (asla .svg dönmez).
   */
  async function convertSvgToPngInStorage(svgString, basePath, width, height, fallbackPngUrl) {
    try {
      const cleanSvg = stripEmojiForRaster(svgString);
      const svgUrl = await uploadStringToStorage(`${basePath}.svg`, cleanSvg, 'image/svg+xml');
      if (!svgUrl) return fallbackPngUrl;
      return await convertSvgUrlToPngInStorage(svgUrl, `${basePath}.png`, width, height, fallbackPngUrl);
    } catch (_) {
      return fallbackPngUrl;
    }
  }

  async function convertSvgUrlToPngInStorage(svgUrl, targetStoragePath, width = 1080, height = 1080, fallbackPngUrl = SUPABASE_CONFIG.mediaFallback) {
    try {
      const rasterUrl = `https://wsrv.nl/?url=${encodeURIComponent(svgUrl)}&w=${width}&h=${height}&fit=cover&output=png`;
      const r = await fetch(rasterUrl);
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || !ct.includes('image/png')) return fallbackPngUrl;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 2000) return fallbackPngUrl;
      const pngUrl = await uploadBufferToStorage(targetStoragePath, buf, 'image/png');
      return pngUrl || fallbackPngUrl;
    } catch (_) {
      return fallbackPngUrl;
    }
  }

  async function saveAssetRecordToSupabaseInner(record) {
    try {
      // 1. site_settings içine ekle/güncelle
      const getRes = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/site_settings?key=eq.social_campaign_assets&select=data`, {
        headers: { 'apikey': SUPABASE_CONFIG.key, 'Authorization': `Bearer ${SUPABASE_CONFIG.key}` }
      });
      const rows = getRes.ok ? await getRes.json() : [];
      let list = Array.isArray(rows?.[0]?.data) ? rows[0].data : [];
      list.unshift(record);
      list = list.slice(0, 50);

      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/site_settings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          key: 'social_campaign_assets',
          data: list,
          updated_at: new Date().toISOString()
        })
      });

      // 2. social_campaign_assets tablosuna eklemeyi dene (tablo oluşturulmuşsa)
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/social_campaign_assets`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(record)
      }).catch(() => {});
    } catch (e) {
      console.warn('Supabase campaign save error:', e);
    }
  }

  /**
   * Photoroom Sandbox Hero SVG: Gerçekçi Mimari Oda ve Zemin Simülasyonu
   */
  function renderSandboxHeroSvg({ product, rawImageUrl, prompt, isVertical = false }) {
    const w = 1080;
    const h = isVertical ? 1920 : 1080;
    const floorY = Math.round(h * 0.68);
    const floorH = h - floorY;

    const title = (product.title || product.baslik || 'Lüks Mobilya').toUpperCase();

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#141822"/>
      <stop offset="60%" stop-color="#1A202C"/>
      <stop offset="100%" stop-color="#10141D"/>
    </linearGradient>
    <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1E1712"/>
      <stop offset="35%" stop-color="#2D2118"/>
      <stop offset="80%" stop-color="#1C140E"/>
      <stop offset="100%" stop-color="#0E0A07"/>
    </linearGradient>
    <linearGradient id="goldBeam" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255, 235, 200, 0.16)"/>
      <stop offset="40%" stop-color="rgba(255, 220, 170, 0.05)"/>
      <stop offset="100%" stop-color="rgba(0, 0, 0, 0)"/>
    </linearGradient>
    <radialGradient id="contactShadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(0, 0, 0, 0.92)"/>
      <stop offset="60%" stop-color="rgba(3, 5, 8, 0.45)"/>
      <stop offset="100%" stop-color="rgba(0, 0, 0, 0)"/>
    </radialGradient>
    <linearGradient id="slatGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#5A3F2A"/>
      <stop offset="50%" stop-color="#8B6544"/>
      <stop offset="100%" stop-color="#3B291A"/>
    </linearGradient>
  </defs>

  <!-- 1. DUVAR: Sıcak Mimari Grej / Koyu Antrasit -->
  <rect x="0" y="0" width="${w}" height="${floorY}" fill="url(#wallGrad)"/>

  <!-- 2. AKUSTİK AHŞAP ÇITALAR (Sol Taraf) -->
  <g opacity="0.92">
    <rect x="40" y="0" width="18" height="${floorY}" fill="url(#slatGrad)"/>
    <rect x="68" y="0" width="18" height="${floorY}" fill="url(#slatGrad)"/>
    <rect x="96" y="0" width="18" height="${floorY}" fill="url(#slatGrad)"/>
    <rect x="124" y="0" width="18" height="${floorY}" fill="url(#slatGrad)"/>
    <rect x="152" y="0" width="18" height="${floorY}" fill="url(#slatGrad)"/>
    <rect x="180" y="0" width="18" height="${floorY}" fill="url(#slatGrad)"/>
    <rect x="208" y="0" width="18" height="${floorY}" fill="url(#slatGrad)"/>
    <rect x="236" y="0" width="18" height="${floorY}" fill="url(#slatGrad)"/>
    <rect x="264" y="0" width="18" height="${floorY}" fill="url(#slatGrad)"/>
    <rect x="292" y="0" width="18" height="${floorY}" fill="url(#slatGrad)"/>
  </g>

  <!-- 3. PENCERE GÜN IŞIĞI HUZMESİ -->
  <polygon points="100,0 ${w * 0.65},0 ${w},${Math.round(h * 0.85)} ${Math.round(w * 0.35)},${h}" fill="url(#goldBeam)"/>

  <!-- 4. SÜPÜRGELİK VE GİZLİ LED AYDINLATMA -->
  <rect x="0" y="${floorY - 14}" width="${w}" height="14" fill="#080A0E"/>
  <rect x="0" y="${floorY - 2}" width="${w}" height="2.5" fill="rgba(212, 175, 55, 0.45)"/>

  <!-- 5. DOĞAL MEŞE PARKE ZEMİN -->
  <rect x="0" y="${floorY}" width="${w}" height="${floorH}" fill="url(#floorGrad)"/>

  <!-- Perspektif Zemin Çizgileri -->
  <g stroke="rgba(0, 0, 0, 0.32)" stroke-width="1.2">
    <line x1="${w * 0.5}" y1="${floorY}" x2="-100" y2="${h}"/>
    <line x1="${w * 0.5}" y1="${floorY}" x2="100" y2="${h}"/>
    <line x1="${w * 0.5}" y1="${floorY}" x2="300" y2="${h}"/>
    <line x1="${w * 0.5}" y1="${floorY}" x2="540" y2="${h}"/>
    <line x1="${w * 0.5}" y1="${floorY}" x2="780" y2="${h}"/>
    <line x1="${w * 0.5}" y1="${floorY}" x2="980" y2="${h}"/>
    <line x1="${w * 0.5}" y1="${floorY}" x2="${w + 100}" y2="${h}"/>
  </g>

  <!-- 6. ÇOK KATMANLI ZEMİN TEMAS GÖLGESİ -->
  <ellipse cx="${w * 0.5}" cy="${floorY + Math.round(floorH * 0.42)}" rx="${Math.round(w * 0.42)}" ry="26" fill="url(#contactShadow)"/>
  <ellipse cx="${w * 0.5}" cy="${floorY + Math.round(floorH * 0.38)}" rx="${Math.round(w * 0.32)}" ry="12" fill="rgba(0, 0, 0, 0.85)"/>

  <!-- 7. HAM MOBİLYA FOTOĞRAFI (Photoroom Tarafından Oturtulan Ürün) -->
  <image href="${rawImageUrl}" x="${Math.round(w * 0.12)}" y="${Math.round(floorY - h * 0.48)}" width="${Math.round(w * 0.76)}" height="${Math.round(h * 0.55)}" preserveAspectRatio="xMidYMid meet"/>

  <!-- Üst Marka Rozeti -->
  <rect x="${w * 0.5 - 180}" y="${isVertical ? 90 : 44}" width="360" height="38" rx="19" fill="rgba(10, 14, 22, 0.85)" stroke="#D4AF37" stroke-width="1.2"/>
  <text x="${w * 0.5}" y="${isVertical ? 115 : 69}" fill="#D4AF37" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="800" text-anchor="middle" letter-spacing="3">NOVA FURNITURE • ARCHITECTURAL</text>

  <!-- Sol Üst Mimari Rozet -->
  <g transform="translate(48, ${isVertical ? 150 : 96})">
    <rect width="210" height="42" rx="10" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1"/>
    <text x="18" y="26" fill="#F8FAFC" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="700">🪵 1. Sınıf E1 MDF Gövde</text>
  </g>
  <g transform="translate(48, ${isVertical ? 202 : 148})">
    <rect width="210" height="42" rx="10" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1"/>
    <text x="18" y="26" fill="#F8FAFC" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="700">🛡️ 5 Yıl İmalat Garantisi</text>
  </g>

  <!-- Alt Bilgi Şeridi -->
  <rect x="0" y="${h - (isVertical ? 140 : 80)}" width="${w}" height="${isVertical ? 140 : 80}" fill="rgba(9, 12, 18, 0.92)"/>
  <text x="${w * 0.5}" y="${h - (isVertical ? 90 : 46)}" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="${isVertical ? 24 : 20}" font-weight="800" text-anchor="middle" letter-spacing="1">${title}</text>
  <text x="${w * 0.5}" y="${h - (isVertical ? 58 : 22)}" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="600" text-anchor="middle">İskandinav &amp; Modern Mimari Seri • 5 İş Gününde Hızlı Sevkiyat</text>
</svg>`;
  }

  /**
   * 2. FORMAT: DETAY MADDELİ GÖNDERİ SVG (1080x1080)
   * Sol Yarı: Photoroom Oda Görseli, Sağ Yarı: Supabase Detay Maddeleri
   */
  function renderDetailedSpecPostSvg({ product = {}, heroImageUrl = '' }) {
    const w = 1080;
    const h = 1080;
    const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
    const title = rawTitle.toUpperCase();
    const cleanName = title.replace(/^NOVA\s*[-–—:]*\s*/i, '');
    const category = (product.kategori || '1. Sınıf MDF • CNC Membran Kapak').toUpperCase();

    // Ölçü
    let dimStr = 'Katalog Ölçüleri: Standart & Özel Ölçü İmalat';
    const rawDims = product.olculer || product.body;
    if (rawDims) {
      if (typeof rawDims === 'object') {
        const first = Object.entries(rawDims)[0];
        if (first) dimStr = `${first[0]}: ${first[1]}`;
      } else {
        dimStr = String(rawDims).trim().slice(0, 46);
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="specBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B0E14"/>
      <stop offset="100%" stop-color="#141822"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(255, 255, 255, 0.04)"/>
      <stop offset="100%" stop-color="rgba(255, 255, 255, 0.01)"/>
    </linearGradient>
    <linearGradient id="goldButton" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#F3E5AB"/>
    </linearGradient>
    <clipPath id="leftFrame">
      <rect x="36" y="36" width="480" height="1008" rx="20"/>
    </clipPath>
  </defs>

  <!-- Ana Arka Plan -->
  <rect width="${w}" height="${h}" fill="url(#specBg)"/>

  <!-- SOL PANEL: Photoroom Tarafından İşlenmiş Mimari Sahne -->
  <g clip-path="url(#leftFrame)">
    <rect x="36" y="36" width="480" height="1008" fill="#151922"/>
    <image href="${heroImageUrl}" x="36" y="36" width="480" height="1008" preserveAspectRatio="xMidYMid slice"/>
    <rect x="36" y="36" width="480" height="1008" fill="none" stroke="rgba(212, 175, 55, 0.45)" stroke-width="2"/>
    
    <!-- Sol Panel Üst Rozeti -->
    <rect x="56" y="56" width="220" height="34" rx="17" fill="rgba(10, 14, 22, 0.88)" stroke="#D4AF37" stroke-width="1"/>
    <text x="166" y="78" fill="#D4AF37" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="800" text-anchor="middle" letter-spacing="1">✨ PHOTOROOM AI ODA</text>
  </g>

  <!-- SAĞ PANEL: SUPABASE DETAYLARI VE LÜKS ÖZELLİK MADDELERİ -->
  <g transform="translate(548, 60)">
    
    <!-- Marka & Kategori Başlığı -->
    <rect x="0" y="0" width="180" height="28" rx="6" fill="rgba(212, 175, 55, 0.14)"/>
    <text x="12" y="19" fill="#D4AF37" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="800" letter-spacing="1.5">${category}</text>
    
    <text x="0" y="72" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="34" font-weight="900" letter-spacing="0.5">${cleanName}</text>
    <text x="0" y="100" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="500">Kusursuz İskandinav Hatları • 1. Sınıf Mimari İmalat</text>

    <!-- Ayırıcı İnce Altın Çizgi -->
    <line x1="0" y1="124" x2="480" y2="124" stroke="rgba(212, 175, 55, 0.28)" stroke-width="1"/>

    <!-- 1. Madde: MDF Gövde -->
    <g transform="translate(0, 146)">
      <rect width="480" height="84" rx="14" fill="url(#cardGrad)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
      <circle cx="44" cy="42" r="22" fill="rgba(212, 175, 55, 0.12)"/>
      <text x="44" y="48" font-size="20" text-anchor="middle">🪵</text>
      <text x="82" y="34" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700">1. Sınıf Sağlam Gövde</text>
      <text x="82" y="58" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="500">18mm E1 Sertifikalı Dayanıklı MDF</text>
    </g>

    <!-- 2. Madde: İthal Membran Kapak -->
    <g transform="translate(0, 244)">
      <rect width="480" height="84" rx="14" fill="url(#cardGrad)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
      <circle cx="44" cy="42" r="22" fill="rgba(212, 175, 55, 0.12)"/>
      <text x="44" y="48" font-size="20" text-anchor="middle">🪞</text>
      <text x="82" y="34" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700">İthal Membran Kapaklar</text>
      <text x="82" y="58" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="500">Çizilmeye &amp; neme dayanıklı CNC yüzey</text>
    </g>

    <!-- 3. Madde: Donanım ve Fren Sistemi -->
    <g transform="translate(0, 342)">
      <rect width="480" height="84" rx="14" fill="url(#cardGrad)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
      <circle cx="44" cy="42" r="22" fill="rgba(212, 175, 55, 0.12)"/>
      <text x="44" y="48" font-size="20" text-anchor="middle">🗄️</text>
      <text x="82" y="34" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700">Frenli Donanım Sistemi</text>
      <text x="82" y="58" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="500">Sessiz kapanan teleskopik ray &amp; menteşe</text>
    </g>

    <!-- 4. Madde: Ölçüler (Supabase'den) -->
    <g transform="translate(0, 440)">
      <rect width="480" height="84" rx="14" fill="url(#cardGrad)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
      <circle cx="44" cy="42" r="22" fill="rgba(212, 175, 55, 0.12)"/>
      <text x="44" y="48" font-size="20" text-anchor="middle">📐</text>
      <text x="82" y="34" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700">Net Katalog Ölçüleri</text>
      <text x="82" y="58" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="500">${dimStr}</text>
    </g>

    <!-- 5. Madde: Renk ve Garanti -->
    <g transform="translate(0, 538)">
      <rect width="480" height="84" rx="14" fill="url(#cardGrad)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
      <circle cx="44" cy="42" r="22" fill="rgba(212, 175, 55, 0.12)"/>
      <text x="44" y="48" font-size="20" text-anchor="middle">🎨</text>
      <text x="82" y="34" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700">50+ Renk &amp; Özel Ölçü</text>
      <text x="82" y="58" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="500">Mat, soft ve doğal ahşap alternatifleri</text>
    </g>

    <!-- 6. ALTIN WHATSAPP SİPARİŞ & FİYAT BUTONU -->
    <g transform="translate(0, 650)">
      <rect width="480" height="64" rx="32" fill="url(#goldButton)"/>
      <text x="240" y="39" fill="#0A0E14" font-family="'Plus Jakarta Sans', sans-serif" font-size="16" font-weight="900" text-anchor="middle" letter-spacing="0.5">📲 FİYAT İÇİN: 0 (505) 015 1035</text>
    </g>

    <!-- Alt Güvence Rozetleri -->
    <g transform="translate(0, 735)">
      <text x="240" y="20" fill="#E2E8F0" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="700" text-anchor="middle">🛡️ 5 Yıl Fabrika Garantisi   •   🚚 5 İş Gününde Teslim</text>
      <text x="240" y="46" fill="#D4AF37" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" text-anchor="middle">💬 Yoruma "FİYAT" yazın, anında DM gönderelim!</text>
    </g>

  </g>
</svg>`;
  }

  /**
   * STORY SVG RENDERER (1080x1920 Dikey Hikaye Formatı)
   */
  function renderStorySvg({ product = {}, heroImageUrl = '' }) {
    const w = 1080;
    const h = 1920;
    const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
    const title = rawTitle.toUpperCase();
    const cleanName = title.replace(/^NOVA\s*[-–—:]*\s*/i, '');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="storyBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0E121A"/>
      <stop offset="100%" stop-color="#07090D"/>
    </linearGradient>
    <clipPath id="storyTopFrame">
      <rect x="40" y="140" width="1000" height="980" rx="28"/>
    </clipPath>
    <linearGradient id="storyGoldBtn" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#FDE047"/>
    </linearGradient>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#storyBg)"/>

  <!-- Üst Logo / Başlık -->
  <text x="${w * 0.5}" y="95" fill="#D4AF37" font-family="'Plus Jakarta Sans', sans-serif" font-size="18" font-weight="800" text-anchor="middle" letter-spacing="4">NOVA FURNITURE</text>

  <!-- ÜST ALAN: Photoroom Mimari Görsel Çerçevesi -->
  <g clip-path="url(#storyTopFrame)">
    <rect x="40" y="140" width="1000" height="980" fill="#151922"/>
    <image href="${heroImageUrl}" x="40" y="140" width="1000" height="980" preserveAspectRatio="xMidYMid slice"/>
    <rect x="40" y="140" width="1000" height="980" fill="none" stroke="rgba(212, 175, 55, 0.45)" stroke-width="2.5" rx="28"/>
  </g>

  <!-- ALT ALAN: Ürün Bilgisi ve Maddeler -->
  <g transform="translate(60, 1160)">
    <text x="${w * 0.5 - 60}" y="40" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="44" font-weight="900" text-anchor="middle">${cleanName}</text>
    <text x="${w * 0.5 - 60}" y="80" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="20" font-weight="600" text-anchor="middle">18mm E1 MDF • Çizilmez Membran • Özel Ölçü İmalat</text>

    <!-- 3 Öne Çıkan Özellik Kutusu -->
    <g transform="translate(0, 130)">
      <rect width="960" height="90" rx="18" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(255, 255, 255, 0.1)"/>
      <text x="40" y="55" font-size="28">🪵</text>
      <text x="95" y="44" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="20" font-weight="700">1. Sınıf Sağlam MDF Gövde</text>
      <text x="95" y="70" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="16">Dayanıklı E1 sertifikalı malzeme ve sessiz frenli ray sistemi</text>
    </g>

    <g transform="translate(0, 240)">
      <rect width="960" height="90" rx="18" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(255, 255, 255, 0.1)"/>
      <text x="40" y="55" font-size="28">🛡️</text>
      <text x="95" y="44" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="20" font-weight="700">5 Yıl Doğrudan Üretici Garantisi</text>
      <text x="95" y="70" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="16">5 iş gününde adrese teslim ve profesyonel paketleme</text>
    </g>

    <!-- Story DM Çıkartması Şeklinde Altın Buton -->
    <g transform="translate(0, 360)">
      <rect width="960" height="96" rx="48" fill="url(#storyGoldBtn)"/>
      <text x="480" y="60" fill="#0A0E14" font-family="'Plus Jakarta Sans', sans-serif" font-size="24" font-weight="900" text-anchor="middle" letter-spacing="1">💬 FİYAT İÇİN DM GÖNDERİN</text>
    </g>
  </g>
</svg>`;
  }

  function capitalizeWord(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  return {
    BRAND,
    PHOTOROOM_FIXED_PROMPT,
    buildPhotoroomPrompt,
    generatePhotoroomHeroImage,
    generateDetailedSpecPost,
    generateStoryPost,
    generateNovaLuxuryCaption,
    buildAndSaveProductCampaign,
    fetchActiveCampaignFromSupabase,
    markPlatformPublished,
    renderDetailedSpecPostSvg,
    renderStorySvg,
    renderSandboxHeroSvg,
    convertSvgUrlToPngInStorage,
    DEFAULT_REELS_MP4
  };
})();

export default PhotoroomEngine;

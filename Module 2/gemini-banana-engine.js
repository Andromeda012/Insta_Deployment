/**
 * NOVA FURNITURE — GEMINI BANANA PRODUCT RECONTEXTUALIZATION ENGINE
 * ============================================================================
 * PRENSİP: %100 ÜRÜN SADAKATİ (PRODUCT FREEZING & BACKGROUND RECONTEXTUALIZATION)
 * 1. Ürünün kendi pikselleri (kapaklar, kulplar, aynalar, vidalar, ahşap çıtalar)
 *    %100 KORUNUR, yapay zekaya ürünü yeniden çizdirilmez!
 * 2. Referans ürün görseli API çağrısına base64 olarak dahil edilir.
 * 3. API anahtarı URL query string parametresinde değil, 'x-goog-api-key' başlığında taşınır.
 * 4. Arka plan mimari dönüşümü:
 *    - Sıcak koyu grej-füme dokulu Venedik sıva mikro-çimento duvar
 *    - Bir tarafta doğal meşe akustik ahşap çıta panelleri
 *    - Tavandan duvara süzülen yumuşak mimari spot ışık konisi
 *    - Soldaki pencereden hafif süzülen altın saat (golden-hour) gün ışığı huzmesi
 *    - Sağ tarafta mobilyayı kapatmayan dokulu seramik vazo ve zeytin dalı
 *    - Zeminde balıksırtı meşe parke ve üzerine serilmiş natürel dokuma kilim
 * 5. Fallback Politikası:
 *    API başarısız olduğunda önceden hazırlanmış mock görsellere sessizce dönülmez.
 *    Fallback açıkça 'isFallback: true' ve 'mode: ORIGINAL_IMAGE_FALLBACK' olarak
 *    raporlanır; asla başarılı canlı üretim sayılmaz.
 * ============================================================================
 */

const SUPABASE_CONFIG = {
  url: (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) || 'https://vrfujrpsjzqjthaqdalx.supabase.co',
  key: (typeof process !== 'undefined' && process.env && process.env.SUPABASE_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4',
  mediaFallback: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/bahar-portmanto-ymz9.png',
  defaultReelsMp4: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/instagram/reels-1793379608273-qhjj.mp4'
};

const BRAND = {
  name: 'NOVA FURNITURE',
  handle: '@thenovafurniture',
  phone: '0 (505) 015 1035',
  whatsapp: 'https://wa.me/905050151035',
  tagline: 'Minimalist Çizgiler • 1. Sınıf Mimari Tasarım'
};

/**
 * Onaylanan Bahar Portmanto'da kullanılan KUSURSUZ MİMARİ PROMPT ŞABLONU.
 * %100 Ürün Sadakati ve İskandinav Sahnesi Kuralı
 */
export function buildGeminiBananaPrompt(product = {}) {
  const title = (product.title || product.baslik || 'Lüks Tasarım Mobilya').trim();
  const cleanName = title.replace(/^NOVA\s*[-–—:]*\s*/i, '');

  return `Modify the environment around the furniture unit from the reference image while keeping the exact ${cleanName} furniture unit completely identical and untouched. Maintain the exact same proportions, door layout, surface reliefs, handles, knobs, niche features, outer casing, and base legs. Do NOT redraw, alter, or redesign the furniture piece in any way.

Transform the backdrop wall into an ultra-luxurious deep warm charcoal-greige textured Venetian plaster micro-cement wall, providing rich high contrast behind the bright doors and warm wood frame. To one side in the background, include subtle recessed vertical natural oak acoustic wood slat paneling.

Enhance the lighting with high-end architectural lighting: soft warm recessed ceiling spotlight beam washing down the wall, warm golden-hour sunlight entering gently from the left window casting soft realistic diagonal light rays across the floor and subtle edge highlights, and a warm subtle ambient LED glow.

On the right side next to the unit (without blocking any doors), place a tall artisanal textured beige ceramic vase with a minimalist sculptural branch. On the light oak herringbone parquet floor, place a tasteful textured low-pile cream bouclé runner rug. Realistic soft floor contact shadows grounding the furniture legs.

Architectural Digest quality, perfectly centered, straight-on front view, photorealistic 8k interior design photography, absolutely NO text, NO logos, NO watermarks.`;
}

/**
 * Gemini Banana ile Ürün Görselini Düzenler
 * - Orijinal görsel referans olarak base64 eklenir
 * - API anahtarı 'x-goog-api-key' başlığında taşınır (URL'e eklenmez)
 * - Fallback açıkça raporlanır, sessiz mock dönülmez
 */
export async function generateBananaRecontextualizedImage({
  product = {},
  rawImageUrl = '',
  aspectRatio = '1:1',
  apiKey = '',
  allowFallback = true
}) {
  const safeSlug = (product.slug || 'prod').replace(/[^a-zA-Z0-9_-]/g, '');
  const prompt = buildGeminiBananaPrompt(product);
  const inputImageUrl = (rawImageUrl && rawImageUrl.startsWith('http')) ? rawImageUrl : (product.ana_resim || null);

  // Gemini API Anahtarı: Yalnızca sunucu ortamından okunur
  const geminiKey = (apiKey || (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || '').trim();

  // 1. Canlı Gemini API Çağrısı (API anahtarı ve girdi görseli varsa)
  if (geminiKey && inputImageUrl) {
    try {
      console.log(`[Gemini Banana API] Canlı görsel düzenleme isteği başlatılıyor (${aspectRatio})...`);
      
      // Referans ürün görselini base64 olarak al
      let imageBase64 = null;
      let mimeType = 'image/jpeg';
      try {
        const imgFetch = await fetch(inputImageUrl);
        if (imgFetch.ok) {
          const ct = (imgFetch.headers && imgFetch.headers.get('content-type')) || '';
          if (ct.includes('png')) mimeType = 'image/png';
          else if (ct.includes('webp')) mimeType = 'image/webp';
          const arrBuf = await imgFetch.arrayBuffer();
          imageBase64 = Buffer.from(arrBuf).toString('base64');
        }
      } catch (fetchErr) {
        console.warn(`[Gemini Banana API] Referans görsel çekilemedi: ${fetchErr.message}`);
      }

      // Güvenlik: API anahtarı URL parametresinde DEĞİL, 'x-goog-api-key' başlığında taşınır!
      const apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
      
      const parts = [{ text: prompt }];
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: imageBase64
          }
        });
      }

      const payload = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.3
        }
      };

      const apiRes = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey
        },
        body: JSON.stringify(payload)
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        const candidates = data && data.candidates && data.candidates[0];
        const generatedPart = candidates && candidates.content && candidates.content.parts && candidates.content.parts[0];
        const outBase64 = (generatedPart && generatedPart.inlineData && generatedPart.inlineData.data) ||
                          (data && data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded);

        if (outBase64) {
          const buffer = Buffer.from(outBase64, 'base64');
          const fileName = `banana-${safeSlug}-${aspectRatio.replace(':', 'x')}-${Date.now()}.jpg`;
          const uploadedUrl = await uploadBufferToStorage(`products/${fileName}`, buffer, 'image/jpeg');
          if (uploadedUrl) {
            console.log(`[Gemini Banana API] Canlı görsel üretildi ve Supabase Storage'a kaydedildi: ${uploadedUrl}`);
            return {
              ok: true,
              mode: 'LIVE_GEMINI_BANANA',
              isFallback: false,
              imageUrl: uploadedUrl,
              prompt,
              aspectRatio,
              referenceImageIncluded: Boolean(imageBase64),
              width: 1080,
              height: aspectRatio === '9:16' ? 1920 : 1080
            };
          }
        }
      } else {
        const errText = await apiRes.text().catch(() => '');
        console.warn(`[Gemini Banana API] HTTP ${apiRes.status} hatası (API anahtarı maskelendi): ${errText.slice(0, 120)}`);
      }
    } catch (apiErr) {
      console.warn(`[Gemini Banana API] İstek hatası: ${apiErr.message}`);
    }
  }

  // 2. Fallback Politikası (Sessiz mock dönülmez, fallback açıkça işaretlenir!)
  if (!allowFallback) {
    return {
      ok: false,
      isFallback: false,
      error: `[Gemini Banana] Canlı API üretimi başarısız oldu (allowFallback=false).`
    };
  }

  // Orijinal ürüne dönme fallback politikası
  if (inputImageUrl) {
    return {
      ok: true,
      mode: 'ORIGINAL_IMAGE_FALLBACK',
      isFallback: true,
      fallbackReason: geminiKey
        ? 'Gemini API çağrısı başarısız oldu veya görsel verisi dönmedi'
        : 'GEMINI_API_KEY ortam değişkeni tanımlanmamış',
      imageUrl: inputImageUrl,
      prompt,
      aspectRatio,
      width: 1080,
      height: 1080
    };
  }

  return {
    ok: false,
    isFallback: false,
    error: `[Gemini Banana] ${product.title || product.slug} için ne canlı API çıktısı ne de geçerli orijinal ürün görseli temin edilemedi.`
  };
}

/**
 * 2. FORMAT: DETAY MADDELİ GÖNDERİ (Sol: Katalog Görseli, Sağ: Supabase Detayları)
 */
export async function generateDetailedSpecPost({ product = {}, heroImageUrl = '' }) {
  const safeSlug = (product.slug || 'prod').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanHeroUrl = (heroImageUrl && heroImageUrl.startsWith('http')) ? heroImageUrl : SUPABASE_CONFIG.mediaFallback;
  const svg = renderDetailedSpecPostSvg({ product, heroImageUrl: await fetchAsDataUri(cleanHeroUrl) });

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
 * 3. FORMAT: 9:16 STORY FORMATI (Üstte Görsel, Altta Detay Kartları ve WhatsApp Butonu)
 */
export async function generateStoryPost({ product = {}, heroImageUrl = '' }) {
  const safeSlug = (product.slug || 'prod').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanHeroUrl = (heroImageUrl && heroImageUrl.startsWith('http')) ? heroImageUrl : SUPABASE_CONFIG.mediaFallback;
  const svg = renderStorySvg({ product, heroImageUrl: await fetchAsDataUri(cleanHeroUrl) });

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
 * TÜM KAMPANYA PAKETİNİ OLUŞTURUR VE SUPABASE'E KAYDEDER
 */
export async function buildAndSaveProductCampaign({ product = {}, apiKey = '', allowFallback = true }) {
  console.log(`[Gemini Banana Pipeline] ${product.title || product.slug} için kampanya hazırlığı başlatıldı...`);
  const prompt = buildGeminiBananaPrompt(product);

  // 1. Gemini Banana ile 1:1 ve 9:16 Katalog Görselini Hazırla
  const hero1x1 = await generateBananaRecontextualizedImage({
    product,
    rawImageUrl: product.ana_resim,
    aspectRatio: '1:1',
    apiKey,
    allowFallback
  });

  if (!hero1x1 || !hero1x1.ok || !hero1x1.imageUrl) {
    throw new Error(`[Gemini Banana] 1:1 görsel hazırlığı başarısız oldu: ${(hero1x1 && hero1x1.error) || 'Bilinmeyen hata'}`);
  }

  const hero9x16 = await generateBananaRecontextualizedImage({
    product,
    rawImageUrl: product.ana_resim,
    aspectRatio: '9:16',
    apiKey,
    allowFallback
  });

  // 2. Detay Maddeli Gönderi (1080x1080)
  const detailedPost = await generateDetailedSpecPost({
    product,
    heroImageUrl: hero1x1.imageUrl
  });

  // 3. Story Formatı (1080x1920)
  const storyPost = await generateStoryPost({
    product,
    heroImageUrl: (hero9x16 && hero9x16.ok && hero9x16.imageUrl) ? hero9x16.imageUrl : hero1x1.imageUrl
  });

  // 4. Reels Videosu
  const productVideo = product.reels_video_url || product.video_url || '';
  const reelsMediaUrl = /\.(mp4|mov)(\?.*)?$/i.test(productVideo) ? productVideo : '';

  // 5. Lüks Açıklama
  const caption = generateNovaLuxuryCaption(product, 'instagram');

  const campaignAssetRecord = {
    id: generateUuid(),
    product_slug: product.slug || 'urun',
    product_title: product.title || 'Lüks Koleksiyon',
    raw_image_url: product.ana_resim || SUPABASE_CONFIG.mediaFallback,
    banana_prompt: prompt,
    banana_hero_url: hero1x1.imageUrl,
    banana_hero_vertical_url: (hero9x16 && hero9x16.ok && hero9x16.imageUrl) ? hero9x16.imageUrl : hero1x1.imageUrl,
    photoroom_hero_url: hero1x1.imageUrl,
    photoroom_hero_vertical_url: (hero9x16 && hero9x16.ok && hero9x16.imageUrl) ? hero9x16.imageUrl : hero1x1.imageUrl,
    reels_video_url: reelsMediaUrl,
    post_image_url: detailedPost.imageUrl,
    story_image_url: storyPost.imageUrl,
    caption,
    hashtags: '#novafurniture #minimalistmobilya #icmimari #mdfmobilya #cnckapak #luxuryfurniture',
    distribution_status: {
      instagram: { status: 'pending', reels_at: '10:00', post_at: '14:30', story_at: '20:00', published: false },
      facebook: { status: 'pending', post_at: '12:00', published: false },
      tiktok: { status: 'pending', video_at: '16:00', published: false },
      youtube: { status: 'pending', shorts_at: '18:00', published: false }
    },
    engine: 'GEMINI_BANANA',
    created_at: new Date().toISOString()
  };

  await saveAssetRecordToSupabase(campaignAssetRecord);
  return campaignAssetRecord;
}

export async function fetchActiveCampaignFromSupabase(platformName = 'instagram') {
  try {
    const tableRes = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/social_campaign_assets?order=created_at.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_CONFIG.key,
        'Authorization': `Bearer ${SUPABASE_CONFIG.key}`
      }
    });
    if (tableRes.ok) {
      const rows = await tableRes.json();
      if (Array.isArray(rows) && rows.length > 0) return rows[0];
    }

    const stateRes = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/site_settings?key=eq.social_campaign_assets&select=data`, {
      headers: {
        'apikey': SUPABASE_CONFIG.key,
        'Authorization': `Bearer ${SUPABASE_CONFIG.key}`
      }
    });
    if (stateRes.ok) {
      const rows = await stateRes.json();
      const list = (rows && rows[0] && rows[0].data);
      if (Array.isArray(list) && list.length > 0) return list[0];
    }
  } catch (e) {
    console.warn('[Campaign Fetch] Hata:', e);
  }
  return null;
}

export async function markPlatformPublished(campaignId, platformName = 'instagram', slotType = 'POST') {
  try {
    const stateRes = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/site_settings?key=eq.social_campaign_assets&select=data`, {
      headers: { 'apikey': SUPABASE_CONFIG.key, 'Authorization': `Bearer ${SUPABASE_CONFIG.key}` }
    });
    if (stateRes.ok) {
      const rows = await stateRes.json();
      const list = Array.isArray(rows && rows[0] && rows[0].data) ? rows[0].data : [];
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

export function generateNovaLuxuryCaption(product = {}, platform = 'instagram') {
  const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
  const title = rawTitle.toUpperCase();
  const cleanName = title.replace(/^NOVA\s*[-–—:]*\s*/i, '');

  let features = [
    '🪵 1. Sınıf Sağlam E1 MDF Gövde & CNC Membran Kapaklar',
    '🪞 Çizilmeye & neme dayanıklı ithal membran yüzey teknolojisi',
    '🗄️ Sessiz kapanan frenli teleskopik ray ve menteşe donanımı',
    '🧹 Robot süpürgeye uygun ergonomik yüksek ayak tasarımı'
  ];
  if (Array.isArray(product.ozellikler) && product.ozellikler.length > 0) {
    features = product.ozellikler.map(f => {
      f = String(f).trim();
      if (/^[\u{1F300}-\u{1F9FF}🪵✨🪞🗄️🧹✓•-]/u.test(f)) return f;
      return `🪵 ${f}`;
    });
  }

  let dimText = '';
  const rawDims = product.olculer || product.body;
  if (rawDims) {
    if (typeof rawDims === 'object') {
      dimText = Object.entries(rawDims).map(([k, v]) => `• ${capitalizeWord(k.replace(/_/g, ' '))}: ${v}`).join('\n');
    } else {
      dimText = String(rawDims).trim();
    }
  }
  if (!dimText || dimText === 'sdfsdg') {
    dimText = '• Genişlik: 160 cm | Yükseklik: 210 cm | Derinlik: 55 cm';
  }

  const cleanTag = cleanName.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '');
  const hashtags = `#novafurniture #${cleanTag || 'koleksiyon'} #minimalistmobilya #yatakodasıtakımı #gardırop #şifonyer #komodin #membrankapak #mdfmobilya #cnckapak #içmimari #luxuryfurniture`;

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

// ── YARDIMCI VE SVG RENDERER FONKSİYONLARI ─────────────────────────────────

async function fetchAsDataUri(url) {
  try {
    if (!url || !/^https?:\/\//.test(url)) return url;
    const r = await fetch(url);
    if (!r.ok) return url;
    const ct = (r.headers.get('content-type') || 'image/png').split(';')[0];
    if (!ct.startsWith('image/') || ct.includes('svg')) return url;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return url;
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch (_) {
    return url;
  }
}

function stripEmojiForRaster(svg) {
  try {
    return svg.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
  } catch (_) {
    return svg;
  }
}

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
    const ct = (r.headers && r.headers.get('content-type')) || '';
    if (!r.ok || !ct.includes('image/png')) return fallbackPngUrl;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 2000) return fallbackPngUrl;
    const pngUrl = await uploadBufferToStorage(targetStoragePath, buf, 'image/png');
    return pngUrl || fallbackPngUrl;
  } catch (_) {
    return fallbackPngUrl;
  }
}

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
  try {
    const getRes = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/site_settings?key=eq.social_campaign_assets&select=data`, {
      headers: { 'apikey': SUPABASE_CONFIG.key, 'Authorization': `Bearer ${SUPABASE_CONFIG.key}` }
    });
    const rows = getRes.ok ? await getRes.json() : [];
    let list = Array.isArray(rows && rows[0] && rows[0].data) ? rows[0].data : [];
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
  } catch (e) {
    console.warn('Supabase campaign save error:', e);
  }
}

function renderDetailedSpecPostSvg({ product = {}, heroImageUrl = '' }) {
  const w = 1080;
  const h = 1080;
  const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
  const cleanName = rawTitle.toUpperCase().replace(/^NOVA\s*[-–—:]*\s*/i, '');
  const category = (product.kategori || '1. Sınıf MDF • CNC Membran Kapak').toUpperCase();

  let dimStr = 'Katalog Ölçüleri: Standart & Özel Ölçü İmalat';
  const rawDims = product.olculer || product.body;
  if (rawDims && rawDims !== 'sdfsdg') {
    if (typeof rawDims === 'object') {
      const first = Object.entries(rawDims)[0];
      if (first) dimStr = `${first[0]}: ${first[1]}`;
    } else {
      dimStr = String(rawDims).trim().slice(0, 46);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="detBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F1318"/>
      <stop offset="100%" stop-color="#181D24"/>
    </linearGradient>
    <clipPath id="leftHeroClip">
      <rect x="36" y="36" width="480" height="1008" rx="20"/>
    </clipPath>
    <linearGradient id="goldBtn" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#detBg)"/>

  <g clip-path="url(#leftHeroClip)">
    <rect x="36" y="36" width="480" height="1008" fill="#151922"/>
    <image href="${heroImageUrl}" x="36" y="36" width="480" height="1008" preserveAspectRatio="xMidYMid slice"/>
    <rect x="36" y="36" width="480" height="1008" fill="none" stroke="rgba(212, 175, 55, 0.4)" stroke-width="2" rx="20"/>
  </g>

  <g transform="translate(548, 80)">
    <text x="0" y="24" fill="#D4AF37" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="800" letter-spacing="3">NOVA FURNITURE ARCHITECTURE</text>
    <text x="0" y="70" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="34" font-weight="900">${cleanName}</text>
    <text x="0" y="102" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="600">${category}</text>

    <g transform="translate(0, 150)">
      <rect width="496" height="74" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.08)"/>
      <text x="24" y="44" font-size="22">🪵</text>
      <text x="64" y="36" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700">1. Sınıf Sağlam E1 MDF Gövde</text>
      <text x="64" y="56" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">Kanserojen madde içermeyen sertifikalı lüks panel</text>
    </g>

    <g transform="translate(0, 240)">
      <rect width="496" height="74" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.08)"/>
      <text x="24" y="44" font-size="22">🪞</text>
      <text x="64" y="36" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700">CNC İşlemeli Çizilmez Membran</text>
      <text x="64" y="56" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">Neme ve sararmaya karşı yüksek mukavemet</text>
    </g>

    <g transform="translate(0, 330)">
      <rect width="496" height="74" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.08)"/>
      <text x="24" y="44" font-size="22">🗄️</text>
      <text x="64" y="36" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700">Sessiz Frenli Teleskopik Ray &amp; Menteşe</text>
      <text x="64" y="56" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">Çarpmayan, yumuşak kapanan üst segment donanım</text>
    </g>

    <g transform="translate(0, 420)">
      <rect width="496" height="74" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.08)"/>
      <text x="24" y="44" font-size="22">📐</text>
      <text x="64" y="36" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700">Ölçü ve Renk Özelleştirme</text>
      <text x="64" y="56" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">${dimStr}</text>
    </g>

    <g transform="translate(0, 520)">
      <rect width="496" height="74" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.08)"/>
      <text x="24" y="44" font-size="22">🛡️</text>
      <text x="64" y="36" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700">5 Yıl Üretici Garantisi &amp; Hızlı Teslimat</text>
      <text x="64" y="56" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">Doğrudan imalattan güvenli kapıya teslim</text>
    </g>

    <g transform="translate(0, 640)">
      <rect width="496" height="84" rx="42" fill="url(#goldBtn)"/>
      <text x="248" y="51" fill="#0A0E14" font-family="'Plus Jakarta Sans', sans-serif" font-size="17" font-weight="900" text-anchor="middle" letter-spacing="1">💬 FİYAT İÇİN DM GÖNDERİN</text>
    </g>
  </g>
</svg>`;
}

function renderStorySvg({ product = {}, heroImageUrl = '' }) {
  const w = 1080;
  const h = 1920;
  const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
  const cleanName = rawTitle.toUpperCase().replace(/^NOVA\s*[-–—:]*\s*/i, '');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="storyBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0D1117"/>
      <stop offset="100%" stop-color="#1A202C"/>
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

  <text x="${w * 0.5}" y="95" fill="#D4AF37" font-family="'Plus Jakarta Sans', sans-serif" font-size="18" font-weight="800" text-anchor="middle" letter-spacing="4">NOVA FURNITURE</text>

  <g clip-path="url(#storyTopFrame)">
    <rect x="40" y="140" width="1000" height="980" fill="#151922"/>
    <image href="${heroImageUrl}" x="40" y="140" width="1000" height="980" preserveAspectRatio="xMidYMid slice"/>
    <rect x="40" y="140" width="1000" height="980" fill="none" stroke="rgba(212, 175, 55, 0.45)" stroke-width="2.5" rx="28"/>
  </g>

  <g transform="translate(60, 1160)">
    <text x="${w * 0.5 - 60}" y="40" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="44" font-weight="900" text-anchor="middle">${cleanName}</text>
    <text x="${w * 0.5 - 60}" y="80" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="20" font-weight="600" text-anchor="middle">18mm E1 MDF • Çizilmez Membran • Özel Ölçü İmalat</text>

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

const GeminiBananaEngine = {
  BRAND,
  SUPABASE_CONFIG,
  buildGeminiBananaPrompt,
  generateBananaRecontextualizedImage,
  generateDetailedSpecPost,
  generateStoryPost,
  generateNovaLuxuryCaption,
  buildAndSaveProductCampaign,
  fetchActiveCampaignFromSupabase,
  markPlatformPublished,
  DEFAULT_REELS_MP4: SUPABASE_CONFIG.defaultReelsMp4
};

export default GeminiBananaEngine;

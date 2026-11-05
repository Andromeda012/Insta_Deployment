/**
 * GLOBAL MOBİLYA — KOLEKSİYON MERKEZLİ PAZARLAMA KAMPANYASI VE ÇOKLU PLATFORM ÜRETİM MOTORU
 * (Module 2/campaign-studio-engine.js)
 * ============================================================================
 * MİMARİ KURALLAR:
 * 1. Ana AI Promptu (`buildGeminiBananaPrompt`) KESİNLİKLE DEĞİŞTİRİLMEZ.
 *    Koleksiyon/ürün bağlamı, pazarlama profili, kampanya stratejisi ve
 *    platforma özel üretim talimatları ana promptun üzerine ayrı katmanlar
 *    (Layered Context Architecture) olarak eklenir.
 * 2. Ürün Sadakati (Physical Fidelity):
 *    Ürünün kapak sayısı, kapak yönü, çekmece sayısı, kulp yeri, ayak yapısı,
 *    yüzey dokusu, geometrisi ve gerçek rengi ASLA değiştirilmez.
 *    Kullanıcı tarafından girilmeyen fiyat, stok veya teslim süresi ASLA varsayılmaz.
 * 3. 12 Gerçek İçerik Durumu:
 *    not_created, pending_generation, generating, pending_review,
 *    revision_required, approved, queued, publishing, published,
 *    failed, manual_action_required, awaiting_platform_connection
 * 4. Sahne Bazlı Video ve Görsel Üretimi:
 *    Tek bir sahne revize edildiğinde tüm video baştan üretilmez; yalnızca
 *    ilgili sahne güncellenir.
 * ============================================================================
 */

import {
  buildGeminiBananaPrompt,
  formatProductDimensions,
  formatProductColors,
  buildProductHashtags,
  generateNovaLuxuryCaption
} from './gemini-banana-engine.js';

// ── 12 STANDART İÇERİK DURUMU TANIMLARI ──────────────────────────────────────
export const CONTENT_ITEM_STATUSES = Object.freeze({
  NOT_CREATED: 'not_created',
  PENDING_GENERATION: 'pending_generation',
  GENERATING: 'generating',
  PENDING_REVIEW: 'pending_review',
  REVISION_REQUIRED: 'revision_required',
  APPROVED: 'approved',
  QUEUED: 'queued',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  MANUAL_ACTION_REQUIRED: 'manual_action_required',
  AWAITING_PLATFORM_CONNECTION: 'awaiting_platform_connection'
});

export const CONTENT_STATUS_LABELS_TR = Object.freeze({
  not_created: 'Henüz oluşturulmadı',
  pending_generation: 'Üretim bekliyor',
  generating: 'Üretiliyor',
  pending_review: 'İnceleme bekliyor',
  revision_required: 'Revizyon gerekli',
  approved: 'Onaylandı',
  queued: 'Yayın kuyruğunda',
  publishing: 'Yayınlanıyor',
  published: 'Yayınlandı',
  failed: 'Hata oluştu',
  manual_action_required: 'Manuel işlem gerekli',
  awaiting_platform_connection: 'Platform bağlantısı bekleniyor'
});

// ── TIKTOK BAĞLANTI DURUMLARI (BÖLÜM 3.1) ───────────────────────────────────
export const TIKTOK_CONNECTION_STATES = Object.freeze({
  MISSING_CREDENTIALS: {
    code: 'missing_credentials',
    label: 'Hesap bilgileri eksik',
    canPublish: false,
    description: 'TikTok hesabının e-posta kurtarma işlemi ve geliştirici kimlik bilgileri henüz tamamlanmadı.'
  },
  AWAITING_OAUTH: {
    code: 'awaiting_oauth',
    label: 'API yetkilendirmesi bekleniyor',
    canPublish: false,
    description: 'TikTok Client Key/Secret tanımlandı ancak OAuth2 Access Token ve Open ID yetkilendirmesi bekleniyor.'
  },
  UNVERIFIED: {
    code: 'unverified',
    label: 'Bağlantı doğrulanmadı',
    canPublish: false,
    description: 'TikTok API bilgileri girildi ancak canlı bağlantı doğrulaması henüz tamamlanmadı.'
  },
  READY: {
    code: 'ready',
    label: 'Bağlantı hazır',
    canPublish: true,
    description: 'TikTok Content Posting API v2 bağlantısı doğrulandı ve yayınlamaya hazır.'
  }
});

// ── MODÜL 7: 9 MEDYA KATEGORİSİ ──────────────────────────────────────────────
export const MEDIA_CATEGORIES = Object.freeze([
  { id: 'hero', label: 'Hero', description: 'Ana koleksiyon veya ürün tanıtım görseli' },
  { id: 'lifestyle', label: 'Lifestyle', description: 'Oda içi yaşam alanı ve sahne görseli' },
  { id: 'detail', label: 'Detail', description: 'Kulp, kapak, CNC işleme ve birleşim detayı' },
  { id: 'isolated', label: 'Isolated', description: 'Arka plansız veya stüdyo dekupe ürün görseli' },
  { id: 'texture', label: 'Texture', description: 'Ahşap, membran, lake ve yüzey doku yakın planı' },
  { id: 'color', label: 'Color', description: 'Renk kartelası ve alternatif renk varyasyonu' },
  { id: 'carousel', label: 'Carousel', description: 'Çoklu kaydırmalı gönderi ve panoramik dilimler' },
  { id: 'video', label: 'Video', description: 'Reels, Shorts ve TikTok dikey/yatay video materyali' },
  { id: 'technical', label: 'Technical', description: 'Teknik çizim, iç yerleşim ve ölçü şeması' }
]);

// ── MODÜL 7: AI PAZARLAMA PROFİLİ SEÇENEKLERİ (BÖLÜM 5) ─────────────────────
export const MARKETING_PROFILE_OPTIONS = Object.freeze({
  atmospheres: ['Modern', 'Minimal', 'Lüks', 'Sıcak', 'Doğal', 'Klasik', 'Mimari', 'Editorial'],
  lightings: [
    'Soft daylight',
    'Golden hour',
    'Dramatic cinematic lighting',
    'Warm ambient lighting',
    'Studio lighting'
  ],
  cameraMovements: [
    { id: 'slow_push_in', label: 'Slow Push-In (Yavaş İleri Yaklaşma)' },
    { id: 'lateral_tracking', label: 'Lateral Tracking (Yatay Kaydırma)' },
    { id: 'macro_detail', label: 'Macro Detail Shot (Yüzey ve Kulp Yakın Plan)' },
    { id: 'subtle_orbit', label: 'Subtle Orbit (Hafif Yörünge Dönüşü)' },
    { id: 'rack_focus', label: 'Rack Focus (Odak Geçişi)' },
    { id: 'dolly_in', label: 'Wide Dolly-In (Geniş Oda İleri Hareket)' },
    { id: 'match_cut', label: 'Match Cut (Ritimli Parça Geçişi)' },
    { id: 'subtle_speed_ramp', label: 'Subtle Speed Ramp (Akıcı Hız Geçişi)' }
  ],
  musicStyles: [
    { id: 'Jazz', label: 'Jazz — Sofistike & Sıcak Showroom', bpm: 88, license: 'Royalty-Free Commercial Safe' },
    { id: 'Classical', label: 'Classical — Zamansız & Lüks Klasik', bpm: 76, license: 'Royalty-Free Commercial Safe' },
    { id: 'Ambient', label: 'Ambient — İskandinav Dinginliği', bpm: 72, license: 'Royalty-Free Commercial Safe' },
    { id: 'Cinematic', label: 'Cinematic — Dramatik Mimari Tanıtım', bpm: 92, license: 'Royalty-Free Commercial Safe' },
    { id: 'Electronic', label: 'Electronic — Modern & Dinamik Tasarım', bpm: 108, license: 'Royalty-Free Commercial Safe' },
    { id: 'Acoustic', label: 'Acoustic — Doğal Ahşap & Sıcak Ev', bpm: 84, license: 'Royalty-Free Commercial Safe' },
    { id: 'Minimal instrumental', label: 'Minimal Instrumental — Editorial Galeri', bpm: 80, license: 'Royalty-Free Commercial Safe' }
  ],
  marketingTones: [
    'Premium',
    'Sade',
    'Duygusal',
    'Teknik',
    'Modern',
    'Hikâye anlatımı odaklı'
  ]
});

// ── PLATFORMA ÖZEL PAKET ŞABLONLARI (BÖLÜM 7, 8, 9, 10) ──────────────────────
export const PLATFORM_PACKAGE_DEFINITIONS = Object.freeze({
  instagram: [
    {
      package_type: 'IG_COLLECTION_CAROUSEL',
      content_type: 'CAROUSEL',
      title: 'Koleksiyon Ana Tanıtım Carousel\'i (2 Tamamlayıcı Görsel)',
      aspect_ratio: '4:5',
      resolution: '1080x1350',
      description: 'Koleksiyonu bir bütün olarak gösteren birbirini tamamlayan iki yüksek çözünürlüklü showroom görseli.'
    },
    {
      package_type: 'IG_PIECES_CAROUSEL',
      content_type: 'CAROUSEL',
      title: 'Koleksiyon Parçaları Detay Carousel\'i',
      aspect_ratio: '1:1',
      resolution: '1080x1080',
      description: 'Karyola, komodin, şifonyer, gardırop, makyaj masası ve diğer parçaların her biri için ayrı kart.'
    },
    {
      package_type: 'IG_STORY_SERIES',
      content_type: 'STORIES',
      title: 'Instagram Story Serisi (6 Parçalı 9:16 Akış)',
      aspect_ratio: '9:16',
      resolution: '1080x1920',
      description: '1. Genel Tanıtım, 2. Oda Atmosferi, 3. Öne Çıkan Ürün, 4. Malzeme/Doku, 5. Renk Seçenekleri, 6. İletişim/Teklif.'
    },
    {
      package_type: 'IG_REELS',
      content_type: 'REELS',
      title: 'Instagram Reels Reklam Videosu (15-30 sn 5 Sahneli)',
      aspect_ratio: '9:16',
      resolution: '1080x1920',
      duration_seconds: 22,
      description: '5 sahneli profesyonel reklam akışı ve ürün karakterine uygun telifsiz müzik.'
    }
  ],
  facebook: [
    {
      package_type: 'FB_COLLECTION_POST',
      content_type: 'PHOTO_POST',
      title: 'Facebook Koleksiyon Tanıtım Gönderisi',
      aspect_ratio: '1.91:1',
      resolution: '1200x630',
      description: 'Geniş koleksiyon görseli, koleksiyon hikâyesi, öne çıkan özellikler, teklif çağrısı ve web bağlantısı.'
    },
    {
      package_type: 'FB_PHOTO_ALBUM',
      content_type: 'PHOTO_POST',
      title: 'Facebook Koleksiyon Parçaları Fotoğraf Albümü',
      aspect_ratio: '1:1',
      resolution: '1080x1080',
      description: 'Koleksiyon parçalarının ayrı fotoğraflarla incelenebildiği çoklu fotoğraf albümü.'
    },
    {
      package_type: 'FB_VIDEO_POST',
      content_type: 'FB_REELS',
      title: 'Facebook Video Gönderisi',
      aspect_ratio: '9:16',
      resolution: '1080x1920',
      duration_seconds: 22,
      description: 'Facebook\'a özel başlık, kapak görseli, detaylı açıklama ve çağrı metniyle paketlenmiş video.'
    },
    {
      package_type: 'FB_LINK_OFFER_POST',
      content_type: 'LINK_CARD',
      title: 'Facebook Bağlantı ve Teklif Gönderisi',
      aspect_ratio: '1.91:1',
      resolution: '1200x630',
      description: 'Web sitesindeki ürün/koleksiyon sayfasına ve teklif formuna doğrudan trafik yönlendiren gönderi.'
    },
    {
      package_type: 'FB_STORY',
      content_type: 'FB_STORIES',
      title: 'Facebook Story (9:16 Dikey)',
      aspect_ratio: '9:16',
      resolution: '1080x1920',
      description: 'Dikey formatta hızlı koleksiyon ve iletişim hikayesi.'
    }
  ],
  youtube: [
    {
      package_type: 'YT_SHORTS',
      content_type: 'SHORTS',
      title: 'YouTube Shorts Koleksiyon Tanıtımı (9:16 • 30 sn)',
      aspect_ratio: '9:16',
      resolution: '1080x1920',
      duration_seconds: 30,
      description: '0-30 sn 5 aşamalı ritmik kurgu, okunabilir altyazılar, SEO başlık/açıklama ve gerçek YouTube API yüklemesi.'
    }
  ],
  tiktok: [
    {
      package_type: 'TT_COLLECTION_VIDEO',
      content_type: 'TIKTOK_VIDEO',
      title: 'TikTok Koleksiyon Tanıtım Videosu (9:16 • 25 sn)',
      aspect_ratio: '9:16',
      resolution: '1080x1920',
      duration_seconds: 25,
      description: '0-25 sn yüksek tempolu profesyonel mobilya vitrin kurgusu (TikTok bağlantısı tamamlandığında yayına açılır).'
    }
  ]
});

// ── 1. ÜRÜN KARAKTERİNDEN VARSAYILAN KREATİF PROFİL ÇIKARIMI (BÖLÜM 11.4) ────
export function deriveCreativePresetFromCharacter(entity = {}, rawProfile = {}) {
  const text = [
    entity.title || entity.name || '',
    entity.category || entity.kategori || '',
    entity.design_story || '',
    rawProfile.atmosphere || ''
  ].join(' ').toLowerCase();

  let presetType = 'modern_minimal';
  if (text.includes('klasik') || text.includes('verona') || text.includes('venedik') || text.includes('lüks') || text.includes('luxury')) {
    presetType = 'luxury_classic';
  } else if (text.includes('genç') || text.includes('dinamik') || text.includes('renkli') || text.includes('modern')) {
    presetType = 'modern_minimal';
  }

  const defaultsByPreset = {
    luxury_classic: {
      atmosphere: 'Lüks',
      lighting: 'Dramatic cinematic lighting',
      camera_angle: 'Architectural eye-level hero framing',
      camera_movement: 'slow_push_in',
      lens_character: '50mm Prime Cinema Lens, shallow depth of field',
      music_preference: 'Cinematic',
      marketing_tone: 'Premium'
    },
    modern_minimal: {
      atmosphere: 'Minimal',
      lighting: 'Soft daylight',
      camera_angle: 'Wide architectural straight-on view',
      camera_movement: 'dolly_in',
      lens_character: '35mm Architectural rectilinear lens',
      music_preference: 'Ambient',
      marketing_tone: 'Modern'
    },
    young_dynamic: {
      atmosphere: 'Modern',
      lighting: 'Golden hour',
      camera_angle: 'Dynamic three-quarter perspective',
      camera_movement: 'match_cut',
      lens_character: '28mm crisp commercial lens',
      music_preference: 'Electronic',
      marketing_tone: 'Hikâye anlatımı odaklı'
    }
  };

  const base = defaultsByPreset[presetType];
  const colorPaletteConfig = rawProfile.color_palette_config && typeof rawProfile.color_palette_config === 'object'
    ? rawProfile.color_palette_config
    : {
        product_real_colors: Array.isArray(entity.color_palette)
          ? entity.color_palette
          : (Array.isArray(entity.renkler) ? entity.renkler : []),
        room_complementary_colors: ['Kaşmir Grej', 'Doğal Meşe', 'Keten Krem'],
        background_colors: ['Venedik Sıva Antrasit-Grej', 'Sıcak Taş Tonu'],
        contrast_preference: 'Yüksek mimari kontrast (ürün net biçimde ayrışır)'
      };

  const cameraConfig = rawProfile.camera_config && typeof rawProfile.camera_config === 'object'
    ? rawProfile.camera_config
    : {
        angle: rawProfile.camera_angle || base.camera_angle,
        lens_character: base.lens_character,
        movement: base.camera_movement,
        focal_length: '35mm-50mm',
        depth_of_field: 'Natural architectural f/4'
      };

  return {
    preset_type: presetType,
    atmosphere: rawProfile.atmosphere || base.atmosphere,
    lighting: rawProfile.lighting || base.lighting,
    color_palette: rawProfile.color_palette || (colorPaletteConfig.product_real_colors || []).join(', '),
    color_palette_config: colorPaletteConfig,
    camera_config: cameraConfig,
    music_preference: rawProfile.music_preference || base.music_preference,
    marketing_tone: rawProfile.marketing_tone || base.marketing_tone,
    notes: rawProfile.notes || ''
  };
}

// ── 2. KATMANLI AI PROMPT MİMARİSİ (ANA PROMPT %100 KORUNUR - BÖLÜM 2.1) ─────
export function buildLayeredCampaignPrompt({
  product = {},
  collection = null,
  pieces = [],
  marketingProfile = {},
  campaignContext = {},
  platform = 'instagram',
  packageType = 'IG_COLLECTION_CAROUSEL'
}) {
  // KATMAN 1: MEVCUT ANA PROMPT (KESİNLİKLE DOKUNULMAZ, OLDUĞU GİBİ ÇAĞRILIR)
  const corePrompt = buildGeminiBananaPrompt(product, marketingProfile);

  // KATMAN 2: ÜRÜN & KOLEKSİYON FİZİKSEL SADAKAT VE PROFİL KATMANI
  const resolvedProfile = deriveCreativePresetFromCharacter(collection || product, marketingProfile);
  const realColors = (resolvedProfile.color_palette_config?.product_real_colors || []).join(', ') || formatProductColors(product);
  const pieceNames = pieces.map(p => p.title || p.product_slug).filter(Boolean);

  const productProfileLayer = [
    `[PRODUCT & COLLECTION FIDELITY LAYER — MANDATORY]`,
    collection ? `Collection Name: ${collection.title} (Code: ${collection.code || collection.slug})` : `Product Name: ${product.title || product.slug}`,
    pieceNames.length > 0 ? `Collection Pieces Included: ${pieceNames.join(', ')}` : null,
    `Strict Physical Fidelity Rules: Keep 100% of the physical furniture geometry, exact door count, door opening direction, drawer count, handle positions, leg structure, surface reliefs, and authentic colors (${realColors}). Never invent or overlay prices, stock numbers, or delivery promises.`,
    `Atmosphere Profile: ${resolvedProfile.atmosphere}`,
    `Lighting Profile: ${resolvedProfile.lighting}`,
    `Camera Profile: ${resolvedProfile.camera_config?.angle || ''} | Lens: ${resolvedProfile.camera_config?.lens_character || ''} | Movement: ${resolvedProfile.camera_config?.movement || ''}`,
    `Room & Contrast Palette: Complementary: ${(resolvedProfile.color_palette_config?.room_complementary_colors || []).join(', ')} | Background: ${(resolvedProfile.color_palette_config?.background_colors || []).join(', ')}`,
    `Marketing Tone: ${resolvedProfile.marketing_tone} | Music Direction: ${resolvedProfile.music_preference}`
  ].filter(Boolean).join('\n');

  // KATMAN 3: KAMPANYA TALİMATLARI KATMANI
  const campaignInstructionsLayer = [
    `[CAMPAIGN STRATEGY LAYER]`,
    `Campaign Name: ${campaignContext.title || 'Koleksiyon Tanıtım Kampanyası'}`,
    collection?.design_story || product?.design_story ? `Design Story: ${collection?.design_story || product?.design_story}` : null,
    campaignContext.notes ? `Creative Direction Notes: ${campaignContext.notes}` : null
  ].filter(Boolean).join('\n');

  // KATMAN 4: PLATFORMA VE PAKETE ÖZEL ÜRETİM TALİMATLARI KATMANI
  const platformRulesMap = {
    instagram: 'Instagram Visual Aesthetics: High-resolution editorial showroom framing, clean negative space, zero watermarks, seamless carousel continuity.',
    facebook: 'Facebook Corporate Showroom Aesthetics: Wide architectural framing (1200x630 or 1080x1080 album), clear piece visibility, B2B & homeowner trust.',
    youtube: 'YouTube Shorts 9:16 Vertical Framing (1080x1920): Strong 0-3s visual hook, clear vertical subject centering, subtitle-safe lower third.',
    tiktok: 'TikTok 9:16 Vertical Commercial Framing (1080x1920): High-impact 0-2s opening hook, dynamic detail cut readiness, right-rail UI safe zone.'
  };

  const platformInstructionsLayer = [
    `[PLATFORM & DELIVERABLE LAYER — ${String(platform).toUpperCase()} / ${packageType}]`,
    platformRulesMap[String(platform).toLowerCase()] || platformRulesMap.instagram
  ].join('\n');

  const combinedPrompt = [
    corePrompt,
    productProfileLayer,
    campaignInstructionsLayer,
    platformInstructionsLayer
  ].join('\n\n');

  return {
    core_prompt: corePrompt, // Ana promptun değiştirilmemiş referansı
    product_profile_layer: productProfileLayer,
    campaign_instructions_layer: campaignInstructionsLayer,
    platform_instructions_layer: platformInstructionsLayer,
    combined_prompt: combinedPrompt
  };
}

// ── 3. AŞAMA 1: SÜRÜMLÜ ÜRÜN / KOLEKSİYON SNAPSHOT OLUŞTURUCU (BÖLÜM 6.2 & 14) ─
export function createProductVersionSnapshot({
  targetType = 'collection',
  collection = null,
  product = null,
  pieces = [],
  mediaList = [],
  marketingProfile = {}
}) {
  const primaryEntity = collection || product || {};
  const realMedia = mediaList.filter(m => ['real', 'original'].includes(String(m.source_type || 'real').toLowerCase()));
  const aiMedia = mediaList.filter(m => ['ai_generated', 'ai_banana', 'cad_render'].includes(String(m.source_type || '').toLowerCase()));

  // Gerçekte girilmemiş fiyat, stok veya teslim süresi ASLA uydurulmaz
  const explicitSpecs = primaryEntity.technical_specs && typeof primaryEntity.technical_specs === 'object'
    ? primaryEntity.technical_specs
    : {};

  return {
    snapshot_at: new Date().toISOString(),
    target_type: targetType,
    source_version: Number(primaryEntity.version || 1),
    collection: collection ? {
      id: collection.id,
      slug: collection.slug,
      code: collection.code || collection.slug,
      title: collection.title,
      category: collection.category || 'Yatak Odası',
      short_description: collection.short_description || '',
      description: collection.description || '',
      design_story: collection.design_story || '',
      hero_image: collection.hero_image || '',
      color_palette: Array.isArray(collection.color_palette) ? collection.color_palette : [],
      materials: Array.isArray(collection.materials) ? collection.materials : [],
      features: Array.isArray(collection.features) ? collection.features : [],
      dimensions: collection.dimensions || {},
      technical_specs: explicitSpecs
    } : null,
    product: product ? {
      slug: product.slug,
      sku: product.sku || null,
      title: product.title,
      product_type: product.product_type || targetType,
      piece_role: product.piece_role || 'part',
      kategori: product.kategori || '',
      kisa_aciklama: product.kisa_aciklama || '',
      design_story: product.design_story || '',
      ana_resim: product.ana_resim || '',
      renkler: Array.isArray(product.renkler) ? product.renkler : [],
      ozellikler: Array.isArray(product.ozellikler) ? product.ozellikler : [],
      materials: Array.isArray(product.materials) ? product.materials : [],
      olculer: product.olculer || product.body || null,
      technical_specs: product.technical_specs || {}
    } : null,
    pieces: pieces.map((p, idx) => ({
      index: idx + 1,
      product_slug: p.product_slug || p.slug,
      role_in_collection: p.role_in_collection || p.piece_role || 'part',
      title: p.title || p.products?.title || p.product_slug,
      sku: p.sku || p.products?.sku || null,
      ana_resim: p.ana_resim || p.products?.ana_resim || '',
      ozellikler: p.ozellikler || p.products?.ozellikler || [],
      renkler: p.renkler || p.products?.renkler || [],
      olculer: p.olculer || p.products?.body || null
    })),
    media_summary: {
      total_count: mediaList.length,
      real_count: realMedia.length,
      ai_generated_count: aiMedia.length,
      by_category: Object.fromEntries(
        MEDIA_CATEGORIES.map(cat => [
          cat.id,
          mediaList.filter(m =>
            String(m.media_type || '').toLowerCase() === cat.id ||
            (Array.isArray(m.tags) && m.tags.map(t => String(t).toLowerCase()).includes(cat.id))
          ).map(m => m.media_url)
        ])
      )
    },
    marketing_profile: deriveCreativePresetFromCharacter(primaryEntity, marketingProfile)
  };
}

// ── 4. AŞAMA 2 & 3: PAZARLAMA STRATEJİSİ, İÇERİK PLANI VE MALİYET TAHMİNİ ────
export function buildMarketingStrategyAndPlan({
  snapshot,
  selectedPlatforms = ['instagram', 'facebook', 'youtube', 'tiktok'],
  selectedPackages = [],
  creativeOverrides = {}
}) {
  const entity = snapshot.collection || snapshot.product || {};
  const profile = {
    ...snapshot.marketing_profile,
    ...creativeOverrides
  };
  const pieces = Array.isArray(snapshot.pieces) ? snapshot.pieces : [];
  const hasRealMedia = (snapshot.media_summary?.real_count || 0) > 0 || Boolean(entity.hero_image || entity.ana_resim);

  const strategy = {
    core_value_proposition: entity.design_story || entity.short_description || entity.kisa_aciklama || `${entity.title || 'Koleksiyon'} — 1. sınıf malzeme ve bütünsel mimari tasarım.`,
    atmosphere_direction: profile.atmosphere,
    lighting_direction: profile.lighting,
    camera_direction: profile.camera_config?.movement || 'slow_push_in',
    music_direction: profile.music_preference,
    tone_of_voice: profile.marketing_tone,
    fidelity_guardrail: 'Gerçek ürün geometrisi, kapak/çekmece sayısı, kulp ve ayak yapısı %100 korunur. Girilmemiş fiyat/stok/teslim süresi metinlere eklenmez.'
  };

  // Seçilen paketleri belirle (boşsa seçili platformların tüm standart paketleri)
  const resolvedPackages = [];
  for (const platform of selectedPlatforms) {
    const pKey = String(platform).toLowerCase();
    const defs = PLATFORM_PACKAGE_DEFINITIONS[pKey] || [];
    for (const def of defs) {
      if (selectedPackages.length === 0 || selectedPackages.includes(def.package_type)) {
        resolvedPackages.push({ platform: pKey, ...def });
      }
    }
  }

  // Tahmini üretim kapsamı ve maliyet hesaplaması (Bölüm 14: gereksiz tekrar üretim önlenir)
  const uniqueVisualsNeeded = 2 + Math.max(pieces.length, 1) + 6; // 2 ana + parça kartları + 6 story
  const reusedFromLibrary = Math.min(uniqueVisualsNeeded, (snapshot.media_summary?.total_count || 0) + (hasRealMedia ? 1 : 0));
  const netNewVisualRenders = Math.max(0, uniqueVisualsNeeded - reusedFromLibrary);
  const videoPackagesCount = resolvedPackages.filter(p => ['IG_REELS', 'FB_VIDEO_POST', 'YT_SHORTS', 'TT_COLLECTION_VIDEO'].includes(p.package_type)).length;
  const uniqueSceneCount = videoPackagesCount > 0 ? 5 : 0; // 5 ortak çekirdek sahne 4 platforma yeniden paketlenir

  const estimatedCost = {
    selected_platforms_count: selectedPlatforms.length,
    total_deliverables_count: resolvedPackages.length,
    unique_visual_assets_count: uniqueVisualsNeeded,
    reused_library_assets_count: reusedFromLibrary,
    net_new_visual_renders: netNewVisualRenders,
    video_deliverables_count: videoPackagesCount,
    unique_video_scenes_count: uniqueSceneCount,
    deduplication_savings_percent: uniqueVisualsNeeded > 0 ? Math.round((reusedFromLibrary / uniqueVisualsNeeded) * 100) : 50,
    estimated_api_mode: 'Gemini Free-Tier + Nova Studio Görsel/FFmpeg Motoru ($0.00 Ek API Maliyeti)',
    estimated_cost_usd: 0.0
  };

  return {
    strategy,
    resolved_packages: resolvedPackages,
    estimated_cost: estimatedCost
  };
}

// ── 5. SAHNE BAZLI VİDEO SENARYOSU ÜRETİCİSİ (REELS, SHORTS, TIKTOK, FB) ─────
export function buildScenesForVideoPackage({
  packageType,
  snapshot,
  creativeControls = {}
}) {
  const entity = snapshot.collection || snapshot.product || {};
  const title = entity.title || 'Koleksiyon';
  const heroUrl = entity.hero_image || entity.ana_resim || '';
  const pieces = Array.isArray(snapshot.pieces) && snapshot.pieces.length > 0
    ? snapshot.pieces
    : [{ title, ana_resim: heroUrl, role_in_collection: 'main' }];
  const profile = { ...snapshot.marketing_profile, ...creativeControls };
  const colorsText = (entity.color_palette || entity.renkler || []).join(' • ') || 'Doğal Tonlar';
  const materialsText = (entity.materials || []).join(' • ') || (entity.category || entity.kategori || '1. Sınıf MDF & Membran');

  if (packageType === 'YT_SHORTS') {
    // Bölüm 9.1: YouTube Shorts 0-30 sn 5 Aşamalı Akış
    return [
      {
        scene_index: 1,
        scene_code: 'yt_scene_1_hook',
        title: 'Güçlü Açılış & Koleksiyon Genel Görünümü',
        time_range: '0-3 sn',
        duration_seconds: 3,
        camera_angle: 'Eye-level wide architectural framing',
        camera_movement: creativeControls.scene_1_movement || 'slow_push_in',
        lighting: profile.lighting,
        music_cue: `${profile.music_preference} — Güçlü Giriş Vurgusu`,
        subtitle_text: `${title} — Zamansız Mimari Tasarım`,
        voiceover_or_caption: `0-3 sn: ${title} genel oda sahnesi ve güçlü ilk izlenim.`,
        source_media_url: heroUrl,
        generated_asset_url: heroUrl,
        status: heroUrl ? 'pending_review' : 'pending_generation'
      },
      {
        scene_index: 2,
        scene_code: 'yt_scene_2_atmosphere',
        title: 'Tasarım Karakteri ve Oda Atmosferi',
        time_range: '3-8 sn',
        duration_seconds: 5,
        camera_angle: 'Three-quarter architectural room perspective',
        camera_movement: creativeControls.scene_2_movement || 'dolly_in',
        lighting: profile.lighting,
        music_cue: `${profile.music_preference} — Atmosferik Akış`,
        subtitle_text: entity.short_description || entity.kisa_aciklama || `${profile.atmosphere} atmosfer ve bütünsel tasarım dili.`,
        voiceover_or_caption: `3-8 sn: Oda atmosferi ve koleksiyonun tasarım hikâyesi.`,
        source_media_url: heroUrl,
        generated_asset_url: heroUrl,
        status: heroUrl ? 'pending_review' : 'pending_generation'
      },
      {
        scene_index: 3,
        scene_code: 'yt_scene_3_pieces',
        title: 'Koleksiyon Parçalarının Detayları',
        time_range: '8-15 sn',
        duration_seconds: 7,
        camera_angle: 'Medium close-up piece sequence',
        camera_movement: creativeControls.scene_3_movement || 'lateral_tracking',
        lighting: profile.lighting,
        music_cue: `${profile.music_preference} — Ritmik Parça Geçişi`,
        subtitle_text: `Koleksiyon Parçaları: ${pieces.map(p => p.title).slice(0, 5).join(' • ')}`,
        voiceover_or_caption: `8-15 sn: ${pieces.map(p => p.title).join(', ')} parçalarının incelenmesi.`,
        source_media_url: pieces[0]?.ana_resim || heroUrl,
        generated_asset_url: pieces[0]?.ana_resim || heroUrl,
        status: (pieces[0]?.ana_resim || heroUrl) ? 'pending_review' : 'pending_generation'
      },
      {
        scene_index: 4,
        scene_code: 'yt_scene_4_material',
        title: 'Malzeme, Doku ve Renk Kalitesi',
        time_range: '15-22 sn',
        duration_seconds: 7,
        camera_angle: 'Macro surface & hardware detail view',
        camera_movement: creativeControls.scene_4_movement || 'macro_detail',
        lighting: profile.lighting,
        music_cue: `${profile.music_preference} — Detay Vurgusu`,
        subtitle_text: `${materialsText} | Renkler: ${colorsText}`,
        voiceover_or_caption: `15-22 sn: Yüzey, kulp, kapak ve malzeme kalitesi yakın planı.`,
        source_media_url: pieces[1]?.ana_resim || heroUrl,
        generated_asset_url: pieces[1]?.ana_resim || heroUrl,
        status: heroUrl ? 'pending_review' : 'pending_generation'
      },
      {
        scene_index: 5,
        scene_code: 'yt_scene_5_finale',
        title: 'Genel Final ve Marka Kapanışı',
        time_range: '22-30 sn',
        duration_seconds: 8,
        camera_angle: 'Centered showroom master shot',
        camera_movement: creativeControls.scene_5_movement || 'subtle_orbit',
        lighting: profile.lighting,
        music_cue: `${profile.music_preference} — Final Crescendo`,
        subtitle_text: `Dijital Showroom & Özel Teklif İçin İletişime Geçin`,
        voiceover_or_caption: `22-30 sn: Genel koleksiyon finali ve iletişim/teklif çağrısı.`,
        source_media_url: heroUrl,
        generated_asset_url: heroUrl,
        status: heroUrl ? 'pending_review' : 'pending_generation'
      }
    ];
  }

  if (packageType === 'TT_COLLECTION_VIDEO') {
    // Bölüm 10.1: TikTok 0-25 sn 5 Aşamalı Akış
    return [
      {
        scene_index: 1,
        scene_code: 'tt_scene_1_hook',
        title: 'Dikkat Çekici Açılış (Hook)',
        time_range: '0-2 sn',
        duration_seconds: 2,
        camera_angle: 'Dynamic eye-level hero angle',
        camera_movement: creativeControls.scene_1_movement || 'subtle_speed_ramp',
        lighting: profile.lighting,
        music_cue: `${profile.music_preference} — İlk 2 Sn Beat Drop`,
        subtitle_text: `${title} İle Tanışın`,
        voiceover_or_caption: `0-2 sn: Yüksek dikkat çeken koleksiyon açılış kancası.`,
        source_media_url: heroUrl,
        generated_asset_url: heroUrl,
        status: heroUrl ? 'pending_review' : 'pending_generation'
      },
      {
        scene_index: 2,
        scene_code: 'tt_scene_2_wide',
        title: 'Koleksiyonun Genel Görünümü',
        time_range: '2-6 sn',
        duration_seconds: 4,
        camera_angle: 'Wide room showroom perspective',
        camera_movement: creativeControls.scene_2_movement || 'slow_push_in',
        lighting: profile.lighting,
        music_cue: `${profile.music_preference} — Akıcı Ritim`,
        subtitle_text: entity.short_description || `${profile.atmosphere} Tasarım Dili`,
        voiceover_or_caption: `2-6 sn: Koleksiyonun bütünsel oda görünümü.`,
        source_media_url: heroUrl,
        generated_asset_url: heroUrl,
        status: heroUrl ? 'pending_review' : 'pending_generation'
      },
      {
        scene_index: 3,
        scene_code: 'tt_scene_3_details',
        title: 'Parça Detayları ve Yakın Planlar',
        time_range: '6-12 sn',
        duration_seconds: 6,
        camera_angle: 'Quick detail cuts across pieces',
        camera_movement: creativeControls.scene_3_movement || 'match_cut',
        lighting: profile.lighting,
        music_cue: `${profile.music_preference} — Hızlı Parça Geçişleri`,
        subtitle_text: pieces.map(p => p.title).slice(0, 4).join(' • '),
        voiceover_or_caption: `6-12 sn: Koleksiyon parçaları arasında ritmik yakın plan geçişleri.`,
        source_media_url: pieces[0]?.ana_resim || heroUrl,
        generated_asset_url: pieces[0]?.ana_resim || heroUrl,
        status: heroUrl ? 'pending_review' : 'pending_generation'
      },
      {
        scene_index: 4,
        scene_code: 'tt_scene_4_texture',
        title: 'Renk, Doku ve Tam Koleksiyon Açısı',
        time_range: '12-18 sn',
        duration_seconds: 6,
        camera_angle: 'Macro texture to full angle reveal',
        camera_movement: creativeControls.scene_4_movement || 'macro_detail',
        lighting: profile.lighting,
        music_cue: `${profile.music_preference} — Doku ve Renk Vurgusu`,
        subtitle_text: `Renk Paleti: ${colorsText}`,
        voiceover_or_caption: `12-18 sn: Malzeme dokusu, kapak işçiliği ve renk seçenekleri.`,
        source_media_url: pieces[1]?.ana_resim || heroUrl,
        generated_asset_url: pieces[1]?.ana_resim || heroUrl,
        status: heroUrl ? 'pending_review' : 'pending_generation'
      },
      {
        scene_index: 5,
        scene_code: 'tt_scene_5_close',
        title: 'Marka Kapanışı ve Çağrı',
        time_range: '18-25 sn',
        duration_seconds: 7,
        camera_angle: 'Master showroom closing shot',
        camera_movement: creativeControls.scene_5_movement || 'lateral_tracking',
        lighting: profile.lighting,
        music_cue: `${profile.music_preference} — Kapanış`,
        subtitle_text: `Global Mobilya • Detaylı Bilgi ve Teklif İçin Profildeki Bağlantıda`,
        voiceover_or_caption: `18-25 sn: Profesyonel marka kapanışı.`,
        source_media_url: heroUrl,
        generated_asset_url: heroUrl,
        status: heroUrl ? 'pending_review' : 'pending_generation'
      }
    ];
  }

  // Bölüm 7.4 & 8.3: Instagram Reels (ve Facebook Video) 15-30 sn 5 Sahneli Akış
  return [
    {
      scene_index: 1,
      scene_code: 'ig_scene_1_intro',
      title: 'Sahne 1 — Güçlü Açılış & Koleksiyon Adı',
      time_range: '0-3 sn',
      duration_seconds: 3,
      camera_angle: 'Centered architectural hero shot',
      camera_movement: creativeControls.scene_1_movement || 'slow_push_in',
      lighting: profile.lighting,
      music_cue: `${profile.music_preference} — Giriş`,
      subtitle_text: `${title}`,
      voiceover_or_caption: `0-3 sn: Koleksiyonun güçlü açılış görüntüsü ve koleksiyon adı.`,
      source_media_url: heroUrl,
      generated_asset_url: heroUrl,
      status: heroUrl ? 'pending_review' : 'pending_generation'
    },
    {
      scene_index: 2,
      scene_code: 'ig_scene_2_room',
      title: 'Sahne 2 — Genel Oda Görünümü & İleri Kamera Hareketi',
      time_range: '3-7 sn',
      duration_seconds: 4,
      camera_angle: 'Wide master showroom angle',
      camera_movement: creativeControls.scene_2_movement || 'dolly_in',
      lighting: profile.lighting,
      music_cue: `${profile.music_preference} — Oda Atmosferi`,
      subtitle_text: entity.short_description || `${profile.atmosphere} Yaşam Alanı`,
      voiceover_or_caption: `3-7 sn: Genel oda görünümü ve yavaş ileri kamera hareketi (dolly-in).`,
      source_media_url: heroUrl,
      generated_asset_url: heroUrl,
      status: heroUrl ? 'pending_review' : 'pending_generation'
    },
    {
      scene_index: 3,
      scene_code: 'ig_scene_3_pieces',
      title: 'Sahne 3 — Koleksiyon Parçalarına Yakın Geçişler',
      time_range: '7-12 sn',
      duration_seconds: 5,
      camera_angle: 'Piece-by-piece medium close-up',
      camera_movement: creativeControls.scene_3_movement || 'lateral_tracking',
      lighting: profile.lighting,
      music_cue: `${profile.music_preference} — Parça Geçişleri`,
      subtitle_text: pieces.map(p => p.title).slice(0, 4).join(' • '),
      voiceover_or_caption: `7-12 sn: Karyola, gardırop, şifonyer, komodin ve makyaj masası yakın geçişleri.`,
      source_media_url: pieces[0]?.ana_resim || heroUrl,
      generated_asset_url: pieces[0]?.ana_resim || heroUrl,
      status: heroUrl ? 'pending_review' : 'pending_generation'
    },
    {
      scene_index: 4,
      scene_code: 'ig_scene_4_macro',
      title: 'Sahne 4 — Malzeme, Yüzey, Kulp, Kapak ve Doku Detayları',
      time_range: '12-16 sn',
      duration_seconds: 4,
      camera_angle: 'Macro detail lens',
      camera_movement: creativeControls.scene_4_movement || 'macro_detail',
      lighting: profile.lighting,
      music_cue: `${profile.music_preference} — Makro İşçilik`,
      subtitle_text: `${materialsText} • Kusursuz Yüzey İşçiliği`,
      voiceover_or_caption: `12-16 sn: Malzeme, yüzey, kulp, kapak ve doku detayları.`,
      source_media_url: pieces[1]?.ana_resim || heroUrl,
      generated_asset_url: pieces[1]?.ana_resim || heroUrl,
      status: heroUrl ? 'pending_review' : 'pending_generation'
    },
    {
      scene_index: 5,
      scene_code: 'ig_scene_5_finale',
      title: 'Sahne 5 — Genel Final Sahnesi, Marka Kapanışı & Çağrı',
      time_range: '16-22 sn',
      duration_seconds: 6,
      camera_angle: 'Full collection balanced composition',
      camera_movement: creativeControls.scene_5_movement || 'subtle_orbit',
      lighting: profile.lighting,
      music_cue: `${profile.music_preference} — Final`,
      subtitle_text: `Detaylı Katalog & Özel Teklif İçin DM / WhatsApp`,
      voiceover_or_caption: `16-22 sn: Genel final sahnesi, marka kapanışı ve iletişim çağrısı.`,
      source_media_url: heroUrl,
      generated_asset_url: heroUrl,
      status: heroUrl ? 'pending_review' : 'pending_generation'
    }
  ];
}

// ── 6. AŞAMA 6: TÜM PLATFORM PAKETLERİNİ OLUŞTURMA MOTORU ─────────────────────
export function generateCampaignDeliverables({
  campaignId,
  campaignTitle,
  snapshot,
  resolvedPackages,
  creativeControls = {},
  tiktokConnectionState = TIKTOK_CONNECTION_STATES.MISSING_CREDENTIALS
}) {
  const col = snapshot.collection;
  const prod = snapshot.product;
  const primary = col || prod || {};
  const title = primary.title || 'Koleksiyon';
  const heroUrl = primary.hero_image || primary.ana_resim || '';
  const pieces = Array.isArray(snapshot.pieces) ? snapshot.pieces : [];
  const colors = Array.isArray(primary.color_palette) && primary.color_palette.length
    ? primary.color_palette
    : (Array.isArray(primary.renkler) ? primary.renkler : []);
  const features = Array.isArray(primary.features) && primary.features.length
    ? primary.features
    : (Array.isArray(primary.ozellikler) ? primary.ozellikler : []);
  const materials = Array.isArray(primary.materials) ? primary.materials : [];
  const profile = { ...snapshot.marketing_profile, ...creativeControls };
  const showroomLink = col?.slug
    ? `https://globalkapakmobilya.com/galeri.html?collection=${encodeURIComponent(col.slug)}`
    : `https://globalkapakmobilya.com/galeri.html`;

  const selectedMusic = MARKETING_PROFILE_OPTIONS.musicStyles.find(m => m.id === profile.music_preference)
    || MARKETING_PROFILE_OPTIONS.musicStyles[2];

  const items = [];
  const scenesByItemTempId = {};

  resolvedPackages.forEach((pkg, idx) => {
    const tempId = `item_${idx + 1}_${pkg.package_type.toLowerCase()}`;
    const layeredPrompt = buildLayeredCampaignPrompt({
      product: prod || {
        slug: col?.slug || 'koleksiyon',
        title,
        kategori: col?.category || 'Yatak Odası',
        renkler: colors,
        ozellikler: features,
        olculer: col?.dimensions || null
      },
      collection: col,
      pieces,
      marketingProfile: profile,
      campaignContext: { title: campaignTitle, notes: creativeControls.notes || '' },
      platform: pkg.platform,
      packageType: pkg.package_type
    });

    const isTikTok = pkg.platform === 'tiktok';
    const initialStatus = isTikTok && !tiktokConnectionState.canPublish
      ? CONTENT_ITEM_STATUSES.AWAITING_PLATFORM_CONNECTION
      : (heroUrl ? CONTENT_ITEM_STATUSES.PENDING_REVIEW : CONTENT_ITEM_STATUSES.PENDING_GENERATION);

    // 7.1 Instagram Koleksiyon Ana Tanıtım Carousel'i (2 Tamamlayıcı Görsel)
    if (pkg.package_type === 'IG_COLLECTION_CAROUSEL') {
      const lifestyleMedia = snapshot.media_summary?.by_category?.lifestyle || [];
      const secondSlideUrl = lifestyleMedia[0] || pieces[0]?.ana_resim || heroUrl;
      const slides = [
        {
          slide_Number: 1,
          role: 'Koleksiyon Ana Sahne (1/2)',
          title: `${title} — Bütünsel Tasarım`,
          subtitle: primary.short_description || primary.kisa_aciklama || 'Mimari Koleksiyon Görünümü',
          media_url: heroUrl,
          integrity_verified: true,
          split_warning: null
        },
        {
          slide_Number: 2,
          role: 'Tamamlayıcı Atmosfer & Parça Uyumu (2/2)',
          title: `${title} — Detay ve Yaşam Alanı`,
          subtitle: colors.length ? `Renk Paleti: ${colors.join(' • ')}` : 'Özel Tasarım Detayları',
          media_url: secondSlideUrl,
          integrity_verified: true,
          split_warning: null
        }
      ];

      items.push({
        temp_id: tempId,
        campaign_id: campaignId,
        platform: 'instagram',
        package_type: pkg.package_type,
        content_type: 'CAROUSEL',
        title: `${title} — Ana Tanıtım Carousel'i (2 Görsel)`,
        caption: buildCollectionCaption({ primary, pieces, colors, features, materials, platform: 'instagram', tone: profile.marketing_tone }),
        hashtags: buildProductHashtags({ title, kategori: primary.category || primary.kategori }, 'instagram'),
        cta_text: 'Koleksiyon kataloğu ve özel teklif için yoruma "KATALOG" yazın veya DM gönderin.',
        target_link: showroomLink,
        aspect_ratio: '4:5',
        resolution: '1080x1350',
        slides,
        media_urls: slides.map(s => s.media_url).filter(Boolean),
        cover_url: heroUrl,
        layered_prompt: layeredPrompt,
        status: initialStatus,
        sort_order: idx + 1
      });
      return;
    }

    // 7.2 Instagram Koleksiyon Parçaları Detay Carousel'i (10 sınırı aşılırsa çoklu gönderi)
    if (pkg.package_type === 'IG_PIECES_CAROUSEL') {
      const sourcePieces = pieces.length > 0
        ? pieces
        : [{
            product_slug: primary.slug,
            title: `${title} — Ana Modül`,
            role_in_collection: 'main',
            ana_resim: heroUrl,
            ozellikler: features,
            renkler: colors,
            olculer: primary.olculer || null
          }];

      const IG_MAX_CAROUSEL = 10;
      const chunks = [];
      for (let i = 0; i < sourcePieces.length; i += IG_MAX_CAROUSEL) {
        chunks.push(sourcePieces.slice(i, i + IG_MAX_CAROUSEL));
      }

      chunks.forEach((chunk, chunkIdx) => {
        const partSuffix = chunks.length > 1 ? ` (Bölüm ${chunkIdx + 1}/${chunks.length})` : '';
        const slides = chunk.map((piece, sIdx) => ({
          slide_number: sIdx + 1,
          piece_slug: piece.product_slug,
          role: piece.role_in_collection || 'part',
          title: piece.title || `Parça ${sIdx + 1}`,
          features: Array.isArray(piece.ozellikler) ? piece.ozellikler.slice(0, 3) : features.slice(0, 3),
          dimensions: piece.olculer || null,
          colors: Array.isArray(piece.renkler) && piece.renkler.length ? piece.renkler : colors,
          media_url: piece.ana_resim || heroUrl
        }));

        items.push({
          temp_id: `${tempId}_part_${chunkIdx + 1}`,
          campaign_id: campaignId,
          platform: 'instagram',
          package_type: pkg.package_type,
          content_type: 'CAROUSEL',
          title: `${title} — Koleksiyon Parçaları Detay Carousel'i${partSuffix}`,
          caption: buildPiecesCarouselCaption({ primary, slides, partIndex: chunkIdx + 1, totalParts: chunks.length }),
          hashtags: buildProductHashtags({ title, kategori: primary.category || primary.kategori }, 'instagram'),
          cta_text: 'İlgilendiğiniz koleksiyon parçasını yorumda belirtin, teknik ölçü ve teklif detaylarını iletelim.',
          target_link: showroomLink,
          aspect_ratio: '1:1',
          resolution: '1080x1080',
          slides,
          media_urls: slides.map(s => s.media_url).filter(Boolean),
          cover_url: slides[0]?.media_url || heroUrl,
          layered_prompt: layeredPrompt,
          status: initialStatus,
          sort_order: idx + 1 + chunkIdx * 0.1
        });
      });
      return;
    }

    // 7.3 Instagram 6 Parçalı Story Serisi
    if (pkg.package_type === 'IG_STORY_SERIES') {
      const storySlides = [
        {
          slide_number: 1,
          story_step: 'Story 1 — Koleksiyon Genel Tanıtımı',
          headline: title,
          subtext: primary.short_description || 'Yeni Nesil Mimari Koleksiyon',
          media_url: heroUrl
        },
        {
          slide_number: 2,
          story_step: 'Story 2 — Oda Atmosferi',
          headline: `${profile.atmosphere} Atmosfer & ${profile.lighting}`,
          subtext: primary.design_story || 'Yaşam alanınızda bütünsel dinginlik ve zarafet.',
          media_url: (snapshot.media_summary?.by_category?.lifestyle || [])[0] || heroUrl
        },
        {
          slide_number: 3,
          story_step: 'Story 3 — Öne Çıkan Ürün',
          headline: pieces[0]?.title || `${title} Ana Modül`,
          subtext: (pieces[0]?.ozellikler || features)[0] || 'Fonksiyonel iç hacim ve ergonomik tasarım',
          media_url: pieces[0]?.ana_resim || heroUrl
        },
        {
          slide_number: 4,
          story_step: 'Story 4 — Malzeme ve Doku Detayı',
          headline: 'Malzeme & İşçilik Kalitesi',
          subtext: materials.join(' • ') || features[0] || '1. Sınıf Gövde & Hassas Yüzey İşçiliği',
          media_url: (snapshot.media_summary?.by_category?.texture || snapshot.media_summary?.by_category?.detail || [])[0] || heroUrl
        },
        {
          slide_number: 5,
          story_step: 'Story 5 — Renk Seçenekleri',
          headline: 'Koleksiyon Renk Kartelası',
          subtext: colors.join(' • ') || 'Doğal ve zamansız renk alternatifleri',
          media_url: (snapshot.media_summary?.by_category?.color || [])[0] || heroUrl
        },
        {
          slide_number: 6,
          story_step: 'Story 6 — İletişim ve Teklif Çağrısı',
          headline: 'Özel Teklif & Katalog Talebi',
          subtext: 'Detaylı bilgi için DM gönderin veya WhatsApp hattımızdan ulaşın: 0 (505) 015 1035',
          media_url: heroUrl
        }
      ];

      items.push({
        temp_id: tempId,
        campaign_id: campaignId,
        platform: 'instagram',
        package_type: pkg.package_type,
        content_type: 'STORIES',
        title: `${title} — 6 Parçalı Instagram Story Serisi (9:16)`,
        caption: `${title} Story Serisi (1-6)`,
        hashtags: buildProductHashtags({ title }, 'instagram'),
        cta_text: 'DM ile Teklif Alın • 0 (505) 015 1035',
        target_link: showroomLink,
        aspect_ratio: '9:16',
        resolution: '1080x1920',
        slides: storySlides,
        media_urls: storySlides.map(s => s.media_url).filter(Boolean),
        cover_url: heroUrl,
        layered_prompt: layeredPrompt,
        status: initialStatus,
        sort_order: idx + 1
      });
      return;
    }

    // 7.4 Instagram Reels (5 Sahneli Reklam Videosu)
    if (pkg.package_type === 'IG_REELS') {
      const scenes = buildScenesForVideoPackage({ packageType: 'IG_REELS', snapshot, creativeControls });
      scenesByItemTempId[tempId] = scenes;
      items.push({
        temp_id: tempId,
        campaign_id: campaignId,
        platform: 'instagram',
        package_type: pkg.package_type,
        content_type: 'REELS',
        title: `${title} — Instagram Reels Tanıtım Filmi (5 Sahne • 22 sn)`,
        caption: buildCollectionCaption({ primary, pieces, colors, features, materials, platform: 'instagram', tone: profile.marketing_tone }),
        hashtags: buildProductHashtags({ title, kategori: primary.category || primary.kategori }, 'instagram'),
        cta_text: 'Detaylı katalog ve teklif için yoruma "FİYAT" yazın veya DM gönderin.',
        target_link: showroomLink,
        aspect_ratio: '9:16',
        resolution: '1080x1920',
        duration_seconds: Number(creativeControls.video_duration || 22),
        slides: [],
        media_urls: [heroUrl].filter(Boolean),
        cover_url: heroUrl,
        music_track: selectedMusic,
        layered_prompt: layeredPrompt,
        status: initialStatus,
        sort_order: idx + 1
      });
      return;
    }

    // 8.1 Facebook Koleksiyon Tanıtım Gönderisi
    if (pkg.package_type === 'FB_COLLECTION_POST') {
      items.push({
        temp_id: tempId,
        campaign_id: campaignId,
        platform: 'facebook',
        package_type: pkg.package_type,
        content_type: 'PHOTO_POST',
        title: `${title} — Facebook Koleksiyon Tanıtım Gönderisi`,
        caption: buildCollectionCaption({ primary, pieces, colors, features, materials, platform: 'facebook', tone: profile.marketing_tone, showroomLink }),
        hashtags: buildProductHashtags({ title, kategori: primary.category || primary.kategori }, 'facebook'),
        cta_text: `Dijital Showroom: ${showroomLink} | WhatsApp: 0 (505) 015 1035`,
        target_link: showroomLink,
        aspect_ratio: '1.91:1',
        resolution: '1200x630',
        slides: [{ slide_number: 1, title, media_url: heroUrl }],
        media_urls: [heroUrl].filter(Boolean),
        cover_url: heroUrl,
        layered_prompt: layeredPrompt,
        status: initialStatus,
        sort_order: idx + 1
      });
      return;
    }

    // 8.2 Facebook Fotoğraf Albümü
    if (pkg.package_type === 'FB_PHOTO_ALBUM') {
      const albumSlides = (pieces.length > 0 ? pieces : [{ title, ana_resim: heroUrl, ozellikler: features }]).map((p, sIdx) => ({
        slide_number: sIdx + 1,
        piece_slug: p.product_slug || p.slug,
        title: p.title || `${title} Parça ${sIdx + 1}`,
        description: Array.isArray(p.ozellikler) ? p.ozellikler.join(' • ') : '',
        media_url: p.ana_resim || heroUrl
      }));

      items.push({
        temp_id: tempId,
        campaign_id: campaignId,
        platform: 'facebook',
        package_type: pkg.package_type,
        content_type: 'PHOTO_POST',
        title: `${title} — Facebook Koleksiyon Parçaları Fotoğraf Albümü (${albumSlides.length} Fotoğraf)`,
        caption: buildCollectionCaption({ primary, pieces, colors, features, materials, platform: 'facebook', tone: profile.marketing_tone, showroomLink }),
        hashtags: buildProductHashtags({ title, kategori: primary.category || primary.kategori }, 'facebook'),
        cta_text: 'Her bir koleksiyon parçasının ölçü ve detayları için fotoğrafları inceleyebilir, teklif formumuzu doldurabilirsiniz.',
        target_link: showroomLink,
        aspect_ratio: '1:1',
        resolution: '1080x1080',
        slides: albumSlides,
        media_urls: albumSlides.map(s => s.media_url).filter(Boolean),
        cover_url: albumSlides[0]?.media_url || heroUrl,
        layered_prompt: layeredPrompt,
        status: initialStatus,
        sort_order: idx + 1
      });
      return;
    }

    // 8.3 Facebook Video Gönderisi
    if (pkg.package_type === 'FB_VIDEO_POST') {
      const scenes = buildScenesForVideoPackage({ packageType: 'IG_REELS', snapshot, creativeControls });
      scenesByItemTempId[tempId] = scenes;
      items.push({
        temp_id: tempId,
        campaign_id: campaignId,
        platform: 'facebook',
        package_type: pkg.package_type,
        content_type: 'FB_REELS',
        title: `${title} — Facebook Kurumsal Video Gönderisi`,
        caption: buildCollectionCaption({ primary, pieces, colors, features, materials, platform: 'facebook', tone: profile.marketing_tone, showroomLink }),
        hashtags: buildProductHashtags({ title, kategori: primary.category || primary.kategori }, 'facebook'),
        cta_text: `Online Katalog & Teklif Formu: ${showroomLink}`,
        target_link: showroomLink,
        aspect_ratio: '9:16',
        resolution: '1080x1920',
        duration_seconds: Number(creativeControls.video_duration || 22),
        slides: [],
        media_urls: [heroUrl].filter(Boolean),
        cover_url: heroUrl,
        music_track: selectedMusic,
        layered_prompt: layeredPrompt,
        status: initialStatus,
        sort_order: idx + 1
      });
      return;
    }

    // 8.4 Facebook Bağlantı ve Teklif Gönderisi (LINK_CARD)
    if (pkg.package_type === 'FB_LINK_OFFER_POST') {
      items.push({
        temp_id: tempId,
        campaign_id: campaignId,
        platform: 'facebook',
        package_type: pkg.package_type,
        content_type: 'LINK_CARD',
        title: `${title} — Dijital Showroom & Teklif Bağlantı Gönderisi`,
        caption: `🏛️ GLOBAL MOBİLYA | ${title.toLocaleUpperCase('tr-TR')}\n\n${primary.design_story || primary.short_description || 'Koleksiyonumuzun tüm parçalarını dijital showroom sayfasında inceleyin ve özel ölçü/fiyat teklifi alın.'}\n\n🌐 Dijital Showroom & Teklif Formu: ${showroomLink}\n📲 WhatsApp İletişim: 0 (505) 015 1035`,
        hashtags: buildProductHashtags({ title, kategori: primary.category || primary.kategori }, 'facebook'),
        cta_text: 'Dijital Showroom\'da İncele ve Teklif Al',
        target_link: showroomLink,
        aspect_ratio: '1.91:1',
        resolution: '1200x630',
        slides: [{ slide_number: 1, title: 'Dijital Showroom Bağlantı Kartı', media_url: heroUrl, target_link: showroomLink }],
        media_urls: [heroUrl].filter(Boolean),
        cover_url: heroUrl,
        layered_prompt: layeredPrompt,
        status: initialStatus,
        sort_order: idx + 1
      });
      return;
    }

    // 8.5 Facebook Story
    if (pkg.package_type === 'FB_STORY') {
      items.push({
        temp_id: tempId,
        campaign_id: campaignId,
        platform: 'facebook',
        package_type: pkg.package_type,
        content_type: 'FB_STORIES',
        title: `${title} — Facebook Sayfa Hikayesi (9:16)`,
        caption: `${title} — Dijital Showroom'da İnceleyin`,
        hashtags: buildProductHashtags({ title }, 'facebook'),
        cta_text: 'WhatsApp & Web Showroom Teklif Hattı',
        target_link: showroomLink,
        aspect_ratio: '9:16',
        resolution: '1080x1920',
        slides: [{ slide_number: 1, title, media_url: heroUrl }],
        media_urls: [heroUrl].filter(Boolean),
        cover_url: heroUrl,
        layered_prompt: layeredPrompt,
        status: initialStatus,
        sort_order: idx + 1
      });
      return;
    }

    // 9.1 YouTube Shorts Koleksiyon Tanıtımı (0-30 sn 5 Sahne)
    if (pkg.package_type === 'YT_SHORTS') {
      const scenes = buildScenesForVideoPackage({ packageType: 'YT_SHORTS', snapshot, creativeControls });
      scenesByItemTempId[tempId] = scenes;
      const ytTitle = `${title} — Mimari Koleksiyon & Tasarım Detayları #Shorts`.slice(0, 98);
      const ytDesc = buildYouTubeShortsDescription({ primary, pieces, colors, features, materials, scenes, showroomLink });
      const ytTags = [
        'Shorts',
        'Global Mobilya',
        'Nova Furniture',
        title,
        primary.category || primary.kategori || 'Mobilya Koleksiyonu',
        ...pieces.map(p => p.title).filter(Boolean).slice(0, 5)
      ];

      items.push({
        temp_id: tempId,
        campaign_id: campaignId,
        platform: 'youtube',
        package_type: pkg.package_type,
        content_type: 'SHORTS',
        title: ytTitle,
        caption: `${ytTitle}\n\n${ytDesc}`,
        hashtags: buildProductHashtags({ title, kategori: primary.category || primary.kategori }, 'youtube'),
        cta_text: `Dijital Showroom: ${showroomLink}`,
        target_link: showroomLink,
        aspect_ratio: '9:16',
        resolution: '1080x1920',
        duration_seconds: 30,
        slides: [],
        media_urls: [heroUrl].filter(Boolean),
        cover_url: heroUrl,
        music_track: selectedMusic,
        seo_metadata: {
          video_title: ytTitle,
          description: ytDesc,
          tags: ytTags,
          visibility: 'public',
          pinned_comment: `📌 ${title} koleksiyonumuzu incelemek ve teklif almak için: ${showroomLink} | 📲 WhatsApp: https://wa.me/905050151035`,
          subtitles: scenes.map(s => ({ time_range: s.time_range, text: s.subtitle_text }))
        },
        layered_prompt: layeredPrompt,
        status: initialStatus,
        sort_order: idx + 1
      });
      return;
    }

    // 10.1 TikTok Koleksiyon Tanıtım Videosu (0-25 sn 5 Sahne — Bağlantı Korumalı)
    if (pkg.package_type === 'TT_COLLECTION_VIDEO') {
      const scenes = buildScenesForVideoPackage({ packageType: 'TT_COLLECTION_VIDEO', snapshot, creativeControls });
      scenesByItemTempId[tempId] = scenes;
      const ttCaption = `${title} ✨ ${primary.short_description || 'Mimari tasarım ve kusursuz işçilik.'} ${pieces.length ? `Parçalar: ${pieces.map(p => p.title).join(', ')}.` : ''}`;

      items.push({
        temp_id: tempId,
        campaign_id: campaignId,
        platform: 'tiktok',
        package_type: pkg.package_type,
        content_type: 'TIKTOK_VIDEO',
        title: `${title} — TikTok Koleksiyon Tanıtım Videosu (25 sn)`,
        caption: ttCaption,
        hashtags: `#novafurniture #globalmobilya #mobilyatasarım #yatakodası #içmimari #keşfet`,
        cta_text: 'Koleksiyon detayları ve teklif formu profil bağlantısında.',
        target_link: showroomLink,
        aspect_ratio: '9:16',
        resolution: '1080x1920',
        duration_seconds: 25,
        slides: [],
        media_urls: [heroUrl].filter(Boolean),
        cover_url: heroUrl,
        music_track: selectedMusic,
        seo_metadata: {
          hook_text: scenes[0]?.subtitle_text || `${title} İle Tanışın`,
          connection_status: tiktokConnectionState.code,
          connection_label: tiktokConnectionState.label,
          subtitles: scenes.map(s => ({ time_range: s.time_range, text: s.subtitle_text }))
        },
        layered_prompt: layeredPrompt,
        status: CONTENT_ITEM_STATUSES.AWAITING_PLATFORM_CONNECTION,
        sort_order: idx + 1
      });
    }
  });

  return { items, scenesByItemTempId };
}

// ── YARDIMCI METİN ÜRETİCİLERİ (GERÇEK OLMAYAN FİYAT/STOK ASLA EKLENMEZ) ─────
function buildCollectionCaption({ primary, pieces = [], colors = [], features = [], materials = [], platform = 'instagram', tone = 'Premium', showroomLink = '' }) {
  const title = (primary.title || 'Koleksiyon').trim();
  const story = primary.design_story || primary.description || primary.short_description || primary.kisa_aciklama || '';
  const pieceLines = pieces.length > 0
    ? `\n🛋️ Koleksiyon Parçaları:\n${pieces.map(p => `• ${p.title}`).join('\n')}\n`
    : '';
  const featureLines = features.length > 0
    ? `\n✨ Öne Çıkan Özellikler:\n${features.map(f => (String(f).startsWith('•') ? f : `• ${f}`)).join('\n')}\n`
    : '';
  const materialLines = materials.length > 0
    ? `\n🪵 Malzeme Yapısı:\n• ${materials.join(' • ')}\n`
    : '';
  const colorLines = colors.length > 0
    ? `\n🎨 Renk Paleti:\n• ${colors.join(' • ')}\n`
    : '';

  // Yalnızca gerçekte girilmiş teknik bilgi varsa ekle
  const specs = primary.technical_specs && typeof primary.technical_specs === 'object' ? primary.technical_specs : {};
  const explicitPriceLine = specs.price ? `\n🏷️ Liste Fiyatı: ${specs.price}` : '';
  const explicitLeadTimeLine = specs.lead_time ? `\n⏱️ Üretim/Teslim Bilgisi: ${specs.lead_time}` : '';

  if (platform === 'facebook') {
    return [
      `🏛️ GLOBAL MOBİLYA | ${title.toLocaleUpperCase('tr-TR')}`,
      story ? `\n${story}` : '',
      pieceLines,
      featureLines,
      materialLines,
      colorLines,
      explicitPriceLine,
      explicitLeadTimeLine,
      `\n🌐 Dijital Showroom & Teklif Formu: ${showroomLink || 'https://globalkapakmobilya.com/galeri.html'}`,
      `📲 WhatsApp İletişim Hattı: 0 (505) 015 1035`
    ].filter(Boolean).join('\n');
  }

  return [
    `thenovafurniture ⛰️ ${title.toLocaleUpperCase('tr-TR')}`,
    story ? `\n${story}` : '',
    pieceLines,
    featureLines,
    materialLines,
    colorLines,
    explicitPriceLine,
    explicitLeadTimeLine,
    `\n📩 Detaylı katalog, ölçü bilgisi ve özel teklif için DM gönderebilir veya profilimizdeki WhatsApp hattımızdan (0505 015 1035) bize ulaşabilirsiniz.`
  ].filter(Boolean).join('\n');
}

function buildPiecesCarouselCaption({ primary, slides = [], partIndex = 1, totalParts = 1 }) {
  const title = (primary.title || 'Koleksiyon').trim();
  const partHeader = totalParts > 1 ? ` (Bölüm ${partIndex}/${totalParts})` : '';
  const slideSummary = slides.map((s, i) => `${i + 1}. Kare: ${s.title}${s.dimensions ? ` (${s.dimensions})` : ''}`).join('\n');
  return [
    `thenovafurniture ⛰️ ${title.toLocaleUpperCase('tr-TR')} — KOLEKSİYON PARÇALARI${partHeader}`,
    `\nKoleksiyonumuzun her bir parçasını yakından incelemek için görselleri sola kaydırın 👉`,
    `\n📐 Bu Gönderide Yer Alan Parçalar:\n${slideSummary}`,
    `\n💬 Tekil parça veya tam takım teklifi almak için ilgilendiğiniz parçayı yorumda paylaşabilir ya da DM gönderebilirsiniz.`
  ].join('\n');
}

function buildYouTubeShortsDescription({ primary, pieces = [], colors = [], features = [], materials = [], scenes = [], showroomLink = '' }) {
  const title = (primary.title || 'Koleksiyon').trim();
  const timestamps = scenes.map(s => `${s.time_range} — ${s.title}`).join('\n');
  return [
    `${primary.design_story || primary.short_description || `${title} mimari mobilya koleksiyonu tanıtımı.`} #Shorts`,
    `\n🎬 Video Akışı:\n${timestamps}`,
    pieces.length > 0 ? `\n🛋️ Koleksiyon Parçaları:\n${pieces.map(p => `• ${p.title}`).join('\n')}` : '',
    features.length > 0 ? `\n✨ Özellikler:\n${features.map(f => `• ${f}`).join('\n')}` : '',
    materials.length > 0 ? `\n🪵 Malzemeler: ${materials.join(' • ')}` : '',
    colors.length > 0 ? `\n🎨 Renk Seçenekleri: ${colors.join(' • ')}` : '',
    `\n🌐 Dijital Showroom: ${showroomLink || 'https://globalkapakmobilya.com/galeri.html'}`,
    `📲 WhatsApp İletişim: https://wa.me/905050151035 (0505 015 1035)`
  ].filter(Boolean).join('\n');
}

export default {
  CONTENT_ITEM_STATUSES,
  CONTENT_STATUS_LABELS_TR,
  TIKTOK_CONNECTION_STATES,
  MEDIA_CATEGORIES,
  MARKETING_PROFILE_OPTIONS,
  PLATFORM_PACKAGE_DEFINITIONS,
  deriveCreativePresetFromCharacter,
  buildLayeredCampaignPrompt,
  createProductVersionSnapshot,
  buildMarketingStrategyAndPlan,
  buildScenesForVideoPackage,
  generateCampaignDeliverables
};

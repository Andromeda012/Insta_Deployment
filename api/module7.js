import {
  authenticateRoles,
  apiError,
  CLERK_PUBLISHABLE_KEY,
  DEPARTMENT_DEFINITIONS,
  handleClerkWebhookRequest,
  resolveClerkAuthContext,
  syncErpUserToSupabase,
  upsertCrmCustomerToSupabase
} from './_lib/auth.js';
import { createR2PresignedUrl, getR2PublicUrl, uploadBufferToR2 } from './_lib/r2-storage.js';
import { fetchInfraHealthSnapshot, fetchPostHogAnalyticsSummary } from './_lib/observability.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Mevcut products tablosunun çekirdek sütunları (%100 geriye dönük uyumluluk)
const CORE_PRODUCT_FIELDS = new Set([
  'slug', 'title', 'sku', 'kategori', 'kisa_aciklama', 'body', 'ana_resim',
  'populer', 'yeni', 'renkler', 'ozellikler', 'created_at', 'updated_at'
]);

// Genişletilmiş Modül 7 alanları (koleksiyon parçası, tasarım hikayesi, malzeme, teknik bilgi vb.)
const EXTENDED_PRODUCT_FIELDS = new Set([
  ...CORE_PRODUCT_FIELDS,
  'product_type', 'piece_role', 'design_story', 'promo_quote', 'intro_story_text', 'materials',
  'dimensions_json', 'olculer', 'technical_specs', 'marketing_preferences',
  'collection_ids', 'collection_id', 'marketing_profile', 'version',
  'collection_pieces', 'photo_presentations'
]);

const VALID_MEDIA_TYPES = new Set([
  'hero', 'lifestyle', 'detail', 'isolated', 'texture',
  'color', 'carousel', 'video', 'technical'
]);

const VALID_SOURCE_TYPES = new Set([
  'real', 'original', 'ai_generated', 'ai_banana', 'cad_render'
]);

const MAX_BODY_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const SETTINGS_KEY = 'product_transform_settings';
const AI_STUDIO_KEY = 'ai_studio_profiles';
const EXTENDED_CATALOG_KEY = 'module7_extended_catalog';

function error(message, status) { const e = new Error(message); e.status = status; return e; }
function validSlug(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,179}$/i.test(value); }
function validProduct(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) return false;
  return Object.keys(body).every(key => EXTENDED_PRODUCT_FIELDS.has(key));
}
function actionOf(req) {
  return String(req.query?.action || new URL(req.url, 'https://local.invalid').searchParams.get('action') || 'products').toLowerCase();
}

async function supabase(path, key, options = {}) {
  if (!SUPABASE_URL || !key) throw error('Supabase configuration is incomplete.', 503);
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store'
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw error(data?.message || data?.hint || 'Supabase request failed.', response.status >= 500 ? 502 : 400);
  return data;
}

// Yardımcı: Genişletilmiş katalog üstverisini (site_settings) oku/yaz
async function readExtendedCatalogStore() {
  try {
    const rows = await supabase(`/rest/v1/site_settings?key=eq.${EXTENDED_CATALOG_KEY}&select=data&limit=1`, SERVICE_KEY || ANON_KEY);
    const d = rows?.[0]?.data;
    return {
      product_meta: (d && typeof d.product_meta === 'object' && !Array.isArray(d.product_meta)) ? d.product_meta : {},
      collections: Array.isArray(d?.collections) ? d.collections : [],
      collection_products: Array.isArray(d?.collection_products) ? d.collection_products : [],
      media: Array.isArray(d?.media) ? d.media : [],
      marketing_profiles: (d && typeof d.marketing_profiles === 'object' && !Array.isArray(d.marketing_profiles)) ? d.marketing_profiles : {}
    };
  } catch {
    return { product_meta: {}, collections: [], collection_products: [], media: [], marketing_profiles: {} };
  }
}

async function writeExtendedCatalogStore(store) {
  await supabase('/rest/v1/site_settings', SERVICE_KEY, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      key: EXTENDED_CATALOG_KEY,
      data: store,
      updated_at: new Date().toISOString()
    })
  });
}

// ── 1. ÜRÜN CRUD (MEVCUT SÖZLEŞME %100 KORUNDU + 3 ÜRÜN TÜRÜ DESTEĞİ) ─────────
const PIECE_SLUG_REGEX = /-(?:6-kapili-dolap|5-kapili-dolap|4-kapili-dolap|3-kapili-dolap|yatak-basligi|komodin|sifonyer|kucuk-kahve-kosesi|orta-kahve-kosesi|buyuk-kahve-kosesi|main-bed|wardrobe|nightstand|dresser|vanity|mirror|bed|dolap|parca|part)-\d+$/i;
const PIECE_SKU_REGEX = /-(?:P\d+|parca|piece)$/i;

async function products(req, res) {
  if (req.method === 'GET') {
    const [rows, extStore] = await Promise.all([
      supabase('/rest/v1/products?select=*&order=created_at.desc', ANON_KEY),
      readExtendedCatalogStore()
    ]);
    const rawRows = rows || [];
    const pieceSlugs = new Set();
    const parentSlugs = new Set();
    for (const p of rawRows) {
      if (!p || !p.slug) continue;
      if (PIECE_SLUG_REGEX.test(p.slug) || (p.sku && PIECE_SKU_REGEX.test(p.sku))) {
        pieceSlugs.add(p.slug);
        const parent = p.slug.replace(PIECE_SLUG_REGEX, '');
        parentSlugs.add(parent);
      }
    }

    const list = rawRows.map(p => {
      const meta = extStore.product_meta?.[p.slug] || {};
      const linkedCols = (extStore.collection_products || [])
        .filter(cp => cp.product_slug === p.slug)
        .map(cp => cp.collection_id);

      const isPiece = pieceSlugs.has(p.slug) || meta.product_type === 'collection_piece' || linkedCols.length > 0;
      const isCollection = !isPiece && (parentSlugs.has(p.slug) || meta.product_type === 'collection' || (extStore.collections || []).some(c => c.slug === p.slug));
      const resolvedType = isPiece ? 'collection_piece' : (isCollection ? 'collection' : (p.product_type || meta.product_type || 'independent'));

      return {
        ...p,
        product_type: resolvedType,
        is_piece: isPiece,
        piece_role: p.piece_role || meta.piece_role || 'part',
        design_story: p.design_story ?? meta.design_story ?? '',
        promo_quote: p.promo_quote ?? meta.promo_quote ?? meta.design_story ?? '',
        intro_story_text: p.intro_story_text ?? meta.intro_story_text ?? meta.promo_quote ?? meta.design_story ?? '',
        materials: Array.isArray(p.materials) ? p.materials : (Array.isArray(meta.materials) ? meta.materials : []),
        dimensions_json: p.dimensions_json || meta.dimensions_json || {},
        technical_specs: p.technical_specs || meta.technical_specs || {},
        marketing_preferences: p.marketing_preferences || meta.marketing_preferences || {},
        photo_presentations: Array.isArray(meta.photo_presentations) ? meta.photo_presentations : [],
        collection_pieces: Array.isArray(meta.collection_pieces) ? meta.collection_pieces : [],
        collection_ids: linkedCols,
        version: Number(p.version || meta.version || 1)
      };
    });
    return res.status(200).json({ ok: true, products: list });
  }

  if (!['POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  await authenticateRoles(req, ['admin', 'product_manager']);
  const body = req.body || {};

  if (req.method === 'DELETE') {
    const slug = String(body.slug || '').trim();
    if (!validSlug(slug)) return res.status(400).json({ ok: false, error: 'Geçersiz ürün kodu.' });
    await supabase(`/rest/v1/products?slug=eq.${encodeURIComponent(slug)}`, SERVICE_KEY, { method: 'DELETE' });
    try {
      await supabase(`/rest/v1/products?slug=like.${encodeURIComponent(slug)}-%`, SERVICE_KEY, { method: 'DELETE' });
    } catch (_) {}
    try {
      const extStore = await readExtendedCatalogStore();
      delete extStore.product_meta[slug];
      for (const k of Object.keys(extStore.product_meta || {})) {
        if (k.startsWith(slug + '-')) delete extStore.product_meta[k];
      }
      extStore.collections = (extStore.collections || []).filter(c => c.slug !== slug);
      extStore.collection_products = (extStore.collection_products || []).filter(cp => cp.product_slug !== slug && cp.collection_id !== slug && !cp.product_slug.startsWith(slug + '-'));
      await writeExtendedCatalogStore(extStore);
    } catch (_) {}
    return res.status(200).json({ ok: true, deleted: true, slug });
  }

  if (!validProduct(body) || !validSlug(body.slug) || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 240) {
    return res.status(400).json({ ok: false, error: 'Ürün verisi geçersiz veya desteklenmeyen alan içeriyor.' });
  }
  if (!body.sku || typeof body.sku !== 'string' || !body.sku.trim() || body.sku.length > 100) {
    return res.status(400).json({ ok: false, error: 'Katalog Kodu (SKU) alanı zorunludur.' });
  }
  if (!body.kategori || typeof body.kategori !== 'string' || !body.kategori.trim()) {
    return res.status(400).json({ ok: false, error: 'Ana Kategori seçimi zorunludur.' });
  }
  if (!body.ana_resim || typeof body.ana_resim !== 'string' || !body.ana_resim.trim()) {
    return res.status(400).json({ ok: false, error: 'Ana tanıtım fotoğrafı zorunludur.' });
  }
  for (const field of ['renkler', 'ozellikler']) {
    if (body[field] != null && !Array.isArray(body[field])) return res.status(400).json({ ok: false, error: `${field} bir dizi olmalıdır.` });
  }
  let cleanedFeatures = Array.isArray(body.ozellikler)
    ? body.ozellikler.map(x => String(x || '').trim()).filter(Boolean)
    : [];
  if (cleanedFeatures.length === 0) {
    cleanedFeatures = await analyzeMainImageAndGenerateFeatures({
      imageInput: body.ana_resim,
      title: body.title,
      kategori: body.kategori,
      promoQuote: body.promo_quote || body.design_story || body.kisa_aciklama || ''
    });
  }
  body.ozellikler = cleanedFeatures;

  // Koleksiyon ise alt ürünlerin (collection_pieces) adı, ölçüsü ve görseli zorunludur
  if (body.product_type === 'collection') {
    const pieces = Array.isArray(body.collection_pieces) ? body.collection_pieces : [];
    if (pieces.length === 0) {
      return res.status(400).json({ ok: false, error: 'Koleksiyon kaydı için en az 1 alt ürün eklenmesi zorunludur.' });
    }
    for (let idx = 0; idx < pieces.length; idx++) {
      const p = pieces[idx] || {};
      const rowNum = idx + 1;
      if (!p.title || !String(p.title).trim()) {
        return res.status(400).json({ ok: false, error: `Alt Ürün #${rowNum} için ürün adı zorunludur.` });
      }
      if (!p.dimensions || !String(p.dimensions).trim()) {
        return res.status(400).json({ ok: false, error: `Alt Ürün #${rowNum} ("${p.title}") için doğrulanmış ölçü bilgisi zorunludur.` });
      }
      if (!p.ana_resim || !String(p.ana_resim).trim()) {
        return res.status(400).json({ ok: false, error: `Alt Ürün #${rowNum} ("${p.title}") için alt ürün fotoğrafı yüklenmesi zorunludur.` });
      }
    }
  }

  const now = new Date().toISOString();
  const corePayload = {};
  for (const k of Object.keys(body)) {
    if (CORE_PRODUCT_FIELDS.has(k)) corePayload[k] = body[k];
  }
  corePayload.title = body.title.trim();
  corePayload.updated_at = now;
  if (!corePayload.created_at) corePayload.created_at = now;

  const saved = await supabase('/rest/v1/products?on_conflict=slug', SERVICE_KEY, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(corePayload)
  });

  // Genişletilmiş alanları ve varsa koleksiyon bağlantısını kaydet
  let mergedProduct = saved?.[0] || corePayload;
  try {
    const extStore = await readExtendedCatalogStore();
    const prevMeta = extStore.product_meta[body.slug] || {};
    const nextVersion = Number(prevMeta.version || 0) + 1;
    const extMeta = {
      product_type: ['collection', 'collection_piece', 'independent'].includes(body.product_type)
        ? body.product_type
        : (prevMeta.product_type || 'independent'),
      piece_role: body.piece_role ? String(body.piece_role).trim() : (prevMeta.piece_role || 'part'),
      design_story: body.design_story !== undefined ? String(body.design_story || '').trim() : (prevMeta.design_story || ''),
      promo_quote: body.promo_quote !== undefined ? String(body.promo_quote || '').trim() : (body.design_story || prevMeta.promo_quote || ''),
      intro_story_text: body.intro_story_text !== undefined ? String(body.intro_story_text || '').trim() : (body.promo_quote || body.design_story || prevMeta.intro_story_text || ''),
      materials: Array.isArray(body.materials) ? body.materials : (prevMeta.materials || []),
      dimensions_json: (body.dimensions_json && typeof body.dimensions_json === 'object') ? body.dimensions_json : (prevMeta.dimensions_json || {}),
      technical_specs: (body.technical_specs && typeof body.technical_specs === 'object') ? body.technical_specs : (prevMeta.technical_specs || {}),
      marketing_preferences: (body.marketing_preferences && typeof body.marketing_preferences === 'object') ? body.marketing_preferences : (prevMeta.marketing_preferences || {}),
      photo_presentations: Array.isArray(body.photo_presentations) ? body.photo_presentations : (prevMeta.photo_presentations || []),
      collection_pieces: Array.isArray(body.collection_pieces) ? body.collection_pieces : (prevMeta.collection_pieces || []),
      version: nextVersion,
      updated_at: now
    };
    extStore.product_meta[body.slug] = extMeta;

    // Eğer kaydedilen kayıt bir Koleksiyon ise ve beraberinde collection_pieces gönderildiyse:
    // Koleksiyon kaydını ve tüm parçalarını tek seferde atomik olarak senkronize et
    if (extMeta.product_type === 'collection') {
      const colRecord = {
        id: body.slug,
        slug: body.slug,
        title: corePayload.title,
        code: body.sku || body.slug.toUpperCase(),
        category: corePayload.kategori || 'Yatak Odası',
        short_description: corePayload.kisa_aciklama || '',
        description: corePayload.body || '',
        design_story: extMeta.design_story || '',
        promo_quote: extMeta.promo_quote || extMeta.design_story || '',
        intro_story_text: extMeta.intro_story_text || extMeta.promo_quote || extMeta.design_story || '',
        hero_image: corePayload.ana_resim || '',
        color_palette: Array.isArray(corePayload.renkler) ? corePayload.renkler : [],
        features: Array.isArray(corePayload.ozellikler) ? corePayload.ozellikler : [],
        materials: extMeta.materials || [],
        dimensions: extMeta.dimensions_json || {},
        technical_specs: extMeta.technical_specs || {},
        marketing_preferences: extMeta.marketing_preferences || {},
        photo_presentations: extMeta.photo_presentations || [],
        is_visible: true,
        version: nextVersion,
        updated_at: now
      };
      const existingColIdx = (extStore.collections || []).findIndex(c => c.slug === body.slug);
      if (existingColIdx >= 0) extStore.collections[existingColIdx] = colRecord;
      else extStore.collections.push(colRecord);

      try {
        await supabase('/rest/v1/collections?on_conflict=slug', SERVICE_KEY, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            slug: colRecord.slug,
            title: colRecord.title,
            category: colRecord.category,
            short_description: colRecord.short_description,
            design_story: colRecord.design_story,
            hero_image: colRecord.hero_image,
            color_palette: colRecord.color_palette,
            is_visible: true,
            updated_at: now
          })
        });
      } catch (_) {}

      if (Array.isArray(body.collection_pieces)) {
        extStore.collection_products = (extStore.collection_products || []).filter(cp => cp.collection_id !== body.slug);
        for (let idx = 0; idx < body.collection_pieces.length; idx++) {
          const piece = body.collection_pieces[idx];
          if (!piece || typeof piece !== 'object') continue;
          const pTitle = String(piece.title || '').trim();
          const pImage = String(piece.ana_resim || piece.image_url || corePayload.ana_resim || '').trim();
          if (!pTitle && !pImage) continue;
          const pRole = String(piece.piece_role || 'part').trim();
          const rawPieceSlug = piece.slug || `${body.slug}-${pRole}-${idx + 1}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
          const pSlug = validSlug(rawPieceSlug) ? rawPieceSlug : `${body.slug}-parca-${idx + 1}`;
          const pSku = String(piece.sku || `${body.sku || body.slug.toUpperCase()}-P${idx + 1}`).trim();
          const pieceCore = {
            slug: pSlug,
            title: pTitle || `${corePayload.title} - Parça ${idx + 1}`,
            sku: pSku,
            kategori: corePayload.kategori || 'Mobilya',
            kisa_aciklama: piece.dimensions ? `${pTitle} (${piece.dimensions})` : `${corePayload.title} koleksiyon parçası`,
            body: String(piece.dimensions || piece.notes || ''),
            ana_resim: pImage || corePayload.ana_resim,
            renkler: Array.isArray(corePayload.renkler) ? corePayload.renkler : [],
            ozellikler: Array.isArray(corePayload.ozellikler) ? corePayload.ozellikler : [],
            populer: false,
            yeni: true,
            updated_at: now,
            created_at: now
          };
          try {
            await supabase('/rest/v1/products?on_conflict=slug', SERVICE_KEY, {
              method: 'POST',
              headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify(pieceCore)
            });
          } catch (_) {}

          extStore.product_meta[pSlug] = {
            product_type: 'collection_piece',
            piece_role: pRole,
            design_story: extMeta.design_story,
            materials: extMeta.materials,
            dimensions_json: { raw: String(piece.dimensions || '') },
            technical_specs: extMeta.technical_specs,
            marketing_preferences: {
              ...extMeta.marketing_preferences,
              piece_presentation_mode: String(piece.presentation_mode || 'carousel_and_video')
            },
            photo_presentations: [{
              url: pImage || corePayload.ana_resim,
              role: pRole,
              presentation_mode: String(piece.presentation_mode || 'carousel_and_video'),
              caption: pTitle
            }],
            version: nextVersion,
            updated_at: now
          };

          extStore.collection_products.push({
            id: `cp_${body.slug}_${pSlug}`,
            collection_id: body.slug,
            product_slug: pSlug,
            role_in_collection: pRole,
            presentation_mode: String(piece.presentation_mode || 'carousel_and_video'),
            dimensions: String(piece.dimensions || ''),
            sort_order: idx + 1,
            created_at: now
          });
        }
      }
    }

    // Koleksiyon parçası ise koleksiyon bağlantılarını güncelle (ürünü kopyalamadan bağlar)
    const colIds = Array.isArray(body.collection_ids)
      ? body.collection_ids.map(String).filter(Boolean)
      : (body.collection_id ? [String(body.collection_id).trim()] : null);

    if (colIds) {
      extStore.collection_products = extStore.collection_products.filter(cp => cp.product_slug !== body.slug);
      for (const cid of colIds) {
        extStore.collection_products.push({
          id: `cp_${cid}_${body.slug}`,
          collection_id: cid,
          product_slug: body.slug,
          role_in_collection: extMeta.piece_role || 'part',
          sort_order: 0,
          created_at: now
        });
        try {
          await supabase('/rest/v1/collection_products?on_conflict=collection_id,product_slug', SERVICE_KEY, {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({
              collection_id: cid,
              product_slug: body.slug,
              role_in_collection: ['main_bed', 'wardrobe', 'nightstand', 'dresser', 'vanity', 'accent', 'part'].includes(extMeta.piece_role) ? extMeta.piece_role : 'part',
              sort_order: 0
            })
          });
        } catch (_) {}
      }
    }

    if (body.marketing_profile && typeof body.marketing_profile === 'object') {
      extStore.marketing_profiles[body.slug] = {
        ...body.marketing_profile,
        product_slug: body.slug,
        updated_at: now
      };
    }

    await writeExtendedCatalogStore(extStore);
    mergedProduct = { ...mergedProduct, ...extMeta, collection_ids: colIds || [] };
  } catch (_) {}

  return res.status(200).json({ ok: true, product: mergedProduct });
}

// ── 2. DÖNÜŞTÜRME AYARLARI ──────────────────────────────────────────────────
async function settings(req, res) {
  if (req.method === 'GET') {
    const rows = await supabase(`/rest/v1/site_settings?key=eq.${SETTINGS_KEY}&select=data&limit=1`, ANON_KEY);
    return res.status(200).json({ ok: true, settings: rows?.[0]?.data || {} });
  }
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateRoles(req, ['admin', 'product_manager']);
  const value = req.body?.settings;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 1000) {
    return res.status(400).json({ ok: false, error: 'Dönüştürme ayarları geçersiz.' });
  }
  for (const [slug, enabled] of Object.entries(value)) {
    if (!validSlug(slug) || typeof enabled !== 'boolean') return res.status(400).json({ ok: false, error: 'Ayar anahtarı veya değeri geçersiz.' });
  }
  await supabase('/rest/v1/site_settings', SERVICE_KEY, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: SETTINGS_KEY, data: value, updated_at: new Date().toISOString() })
  });
  return res.status(200).json({ ok: true, settings: value });
}

// ── 3. AI STUDIO VE PAZARLAMA PROFİLLERİ (BÖLÜM 5) ──────────────────────────
async function aiProfiles(req, res) {
  if (req.method === 'GET') {
    const [rows, extStore] = await Promise.all([
      supabase(`/rest/v1/site_settings?key=eq.${AI_STUDIO_KEY}&select=data&limit=1`, ANON_KEY),
      readExtendedCatalogStore()
    ]);
    const base = rows?.[0]?.data || { categories: {}, products: {}, collections: {} };
    const mergedProducts = { ...(base.products || {}), ...(extStore.marketing_profiles || {}) };
    return res.status(200).json({
      ok: true,
      profiles: {
        categories: base.categories || {},
        products: mergedProducts,
        collections: base.collections || {}
      }
    });
  }
  if (!['PUT', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateRoles(req, ['admin', 'product_manager']);

  // Tekil ürün veya koleksiyon pazarlama profili kaydetme desteği (POST)
  if (req.method === 'POST') {
    const body = req.body || {};
    const targetSlug = String(body.product_slug || body.collection_slug || body.slug || '').trim();
    const profileData = body.profile || body;
    if (!validSlug(targetSlug) || !profileData || typeof profileData !== 'object') {
      return res.status(400).json({ ok: false, error: 'Geçerli ürün/koleksiyon kodu ve profil verisi gerekli.' });
    }
    const rows = await supabase(`/rest/v1/site_settings?key=eq.${AI_STUDIO_KEY}&select=data&limit=1`, SERVICE_KEY);
    const current = rows?.[0]?.data || { categories: {}, products: {}, collections: {} };
    if (!current.products) current.products = {};
    if (!current.collections) current.collections = {};

    const cleanProfile = {
      atmosphere: String(profileData.atmosphere || 'Modern').slice(0, 120),
      lighting: String(profileData.lighting || 'Soft daylight').slice(0, 160),
      color_palette: String(profileData.color_palette || '').slice(0, 300),
      color_palette_config: (profileData.color_palette_config && typeof profileData.color_palette_config === 'object') ? profileData.color_palette_config : {},
      camera_config: (profileData.camera_config && typeof profileData.camera_config === 'object') ? profileData.camera_config : {},
      camera: String(profileData.camera || profileData.camera_config?.angle || '').slice(0, 200),
      music_preference: String(profileData.music_preference || profileData.music || 'Ambient').slice(0, 80),
      music: String(profileData.music || profileData.music_preference || 'Ambient').slice(0, 80),
      marketing_tone: String(profileData.marketing_tone || 'Premium').slice(0, 80),
      decor: String(profileData.decor || profileData.interior_style || '').slice(0, 200),
      notes: String(profileData.notes || '').slice(0, 1000),
      updated_at: new Date().toISOString()
    };

    if (body.collection_slug || body.target_type === 'collection') {
      current.collections[targetSlug] = cleanProfile;
    }
    current.products[targetSlug] = cleanProfile;

    await supabase('/rest/v1/site_settings', SERVICE_KEY, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: AI_STUDIO_KEY, data: current, updated_at: new Date().toISOString() })
    });

    return res.status(200).json({ ok: true, slug: targetSlug, profile: cleanProfile, saved: true });
  }

  const profiles = req.body?.profiles;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles) ||
      !profiles.categories || typeof profiles.categories !== 'object' ||
      !profiles.products || typeof profiles.products !== 'object' ||
      Object.keys(profiles.categories).length > 100 || Object.keys(profiles.products).length > 1000 ||
      Buffer.byteLength(JSON.stringify(profiles), 'utf8') > 200000) {
    return res.status(400).json({ ok: false, error: 'AI Studio profil verisi geçersiz.' });
  }
  const clean = { categories: {}, products: {}, collections: profiles.collections || {} };
  for (const [key, value] of Object.entries(profiles.categories)) {
    if (!key.trim() || !value || typeof value !== 'object' || Array.isArray(value)) return res.status(400).json({ ok: false, error: 'Kategori profili geçersiz.' });
    clean.categories[key.slice(0, 120)] = value;
  }
  for (const [slug, value] of Object.entries(profiles.products)) {
    if (!validSlug(slug) || !value || typeof value !== 'object' || Array.isArray(value)) return res.status(400).json({ ok: false, error: 'Ürün profili geçersiz.' });
    clean.products[slug] = value;
  }
  await supabase('/rest/v1/site_settings', SERVICE_KEY, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: AI_STUDIO_KEY, data: clean, updated_at: new Date().toISOString() })
  });
  return res.status(200).json({ ok: true, profiles: clean, saved: true });
}

// ── 4. RESİM YÜKLEME ────────────────────────────────────────────────────────
async function media(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  await authenticateRoles(req, ['admin', 'product_manager']);
  const { slug, data_url, mode, mime_type, file_size } = req.body || {};
  if (!validSlug(slug)) return res.status(400).json({ ok: false, error: 'Geçersiz ürün kodu.' });
  if (!SUPABASE_URL || !SERVICE_KEY) throw error('Storage server configuration is incomplete.', 503);

  // Yüksek boyutlu görseller (50 MB'a kadar) için doğrudan Cloudflare R2 imzalı yükleme URL'si üretimi (Vercel 4.5 MB limitini aşar)
  if (mode === 'sign') {
    const rawMime = String(mime_type || 'image/jpeg').toLowerCase().trim();
    const sizeNum = Number(file_size || 0);
    if (sizeNum > MAX_IMAGE_BYTES) {
      return res.status(413).json({ ok: false, error: 'Görsel en fazla 50 MB olabilir.' });
    }
    const ext = rawMime.includes('webp') ? 'webp' : rawMime.includes('png') ? 'png' : 'jpg';
    const path = `products/${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const signedUploadUrl = createR2PresignedUrl(path, 'PUT', 3600);
    const publicUrl = getR2PublicUrl(path);
    return res.status(200).json({
      ok: true,
      storage_provider: 'cloudflare_r2',
      path,
      signed_upload_url: signedUploadUrl,
      public_url: publicUrl
    });
  }

  if (typeof data_url !== 'string') return res.status(400).json({ ok: false, error: 'Görsel verisi eksik.' });
  const match = data_url.match(/^data:(image\/(?:png|jpeg|jpg|webp|avif));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return res.status(400).json({ ok: false, error: 'Yalnızca PNG, JPEG veya WebP görselleri kabul edilir.' });
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return res.status(413).json({ ok: false, error: 'Görsel en fazla 50 MB olabilir.' });
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
  const path = `products/${slug}-${Date.now()}.${ext}`;
  const up = await uploadBufferToR2(path, bytes, mime);
  return res.status(201).json({
    ok: true,
    storage_provider: 'cloudflare_r2',
    path: up.key,
    public_url: up.publicUrl
  });
}

// ── 5. KOLEKSİYONLAR CRUD (BÖLÜM 4.1 MERKEZİ KOLEKSİYON YÖNETİMİ) ───────────
async function collections(req, res) {
  if (req.method === 'GET') {
    const slug = req.query?.slug ? String(req.query.slug).trim() : '';
    const extStore = await readExtendedCatalogStore();
    let dbCols = [];
    let dbParts = [];
    let allProducts = [];

    try {
      dbCols = await supabase('/rest/v1/collections?select=*&order=sort_order.asc,created_at.asc', ANON_KEY);
    } catch (_) {
      dbCols = [];
    }
    try {
      allProducts = await supabase('/rest/v1/products?select=*', ANON_KEY);
    } catch (_) {
      allProducts = [];
    }
    try {
      dbParts = await supabase('/rest/v1/collection_products?select=*&order=sort_order.asc', ANON_KEY);
    } catch (_) {
      dbParts = [];
    }

    // DB ve site_settings koleksiyonlarını birleştir
    const colMap = new Map();
    for (const c of (Array.isArray(dbCols) ? dbCols : [])) {
      colMap.set(c.slug, c);
    }
    for (const c of (extStore.collections || [])) {
      const existing = colMap.get(c.slug) || {};
      colMap.set(c.slug, { ...existing, ...c, id: existing.id || c.id || c.slug });
    }

    // Parça ilişkilerini birleştir
    const combinedParts = [...(Array.isArray(dbParts) ? dbParts : [])];
    for (const cp of (extStore.collection_products || [])) {
      if (!combinedParts.some(x => x.collection_id === cp.collection_id && x.product_slug === cp.product_slug)) {
        combinedParts.push(cp);
      }
    }

    // Otomatik Koleksiyon ve Parça Keşfi (Koleksiyon parçalarının üst koleksiyonunu otomatik derle)
    for (const p of (allProducts || [])) {
      if (!p || !p.slug) continue;
      if (PIECE_SLUG_REGEX.test(p.slug)) {
        const parentSlug = p.slug.replace(PIECE_SLUG_REGEX, '');
        if (!colMap.has(parentSlug)) {
          const parentProd = (allProducts || []).find(x => x.slug === parentSlug);
          if (parentProd) {
            const rawTitle = parentProd.title || parentSlug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
            const colTitle = rawTitle.toLowerCase().includes('koleksiyon') ? rawTitle : `${rawTitle} Koleksiyonu`;
            colMap.set(parentSlug, {
              slug: parentSlug,
              id: parentSlug,
              title: colTitle,
              name: colTitle,
              kategori: parentProd?.kategori || 'Yatak Odası',
              hero_image: parentProd?.ana_resim || '',
              hero_image_url: parentProd?.ana_resim || '',
              promo_quote: parentProd?.kisa_aciklama || parentProd?.body || ''
            });
          } else {
            // Ana koleksiyonu silinmiş öksüz parça: Hayalet koleksiyon üretilmesini engelle.
            if (SERVICE_KEY) {
              supabase(`/rest/v1/products?slug=eq.${encodeURIComponent(p.slug)}`, SERVICE_KEY, { method: 'DELETE' }).catch(() => {});
            }
            continue;
          }
        }
        if (!combinedParts.some(x => x.collection_id === parentSlug && x.product_slug === p.slug)) {
          combinedParts.push({
            collection_id: parentSlug,
            product_slug: p.slug
          });
        }
      }
    }

    const enrichedList = Array.from(colMap.values()).map(col => {
      const colParts = combinedParts
        .filter(cp => cp.collection_id === col.id || cp.collection_id === col.slug)
        .map(cp => {
          const prod = allProducts.find(p => p.slug === cp.product_slug) || null;
          return {
            ...cp,
            title: prod?.title || cp.product_slug,
            sku: prod?.sku || null,
            ana_resim: prod?.ana_resim || '',
            ozellikler: prod?.ozellikler || [],
            renkler: prod?.renkler || [],
            olculer: prod?.body || null,
            products: prod
          };
        });

      return {
        ...col,
        name: col.title || col.name,
        code: col.code || col.slug,
        hero_image_url: col.hero_image || col.hero_image_url || '',
        status: col.is_visible === false ? 'draft' : 'active',
        parts: colParts
      };
    });

    if (slug) {
      if (!validSlug(slug)) return res.status(400).json({ ok: false, error: 'Geçersiz koleksiyon slug.' });
      const found = enrichedList.find(c => c.slug === slug || c.id === slug);
      if (!found) return res.status(404).json({ ok: false, error: 'Koleksiyon bulunamadı.' });
      return res.status(200).json({ ok: true, collection: found, parts: found.parts || [] });
    }

    return res.status(200).json({ ok: true, collections: enrichedList, data: enrichedList });
  }

  if (!['POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  await authenticateRoles(req, ['admin', 'product_manager']);
  const body = req.body || {};

  if (req.method === 'DELETE') {
    const slug = String(body.slug || '').trim();
    if (!validSlug(slug)) return res.status(400).json({ ok: false, error: 'Geçersiz koleksiyon kodu.' });
    try {
      await supabase(`/rest/v1/collections?slug=eq.${encodeURIComponent(slug)}`, SERVICE_KEY, { method: 'DELETE' });
    } catch (_) {}
    try {
      await supabase(`/rest/v1/products?slug=eq.${encodeURIComponent(slug)}`, SERVICE_KEY, { method: 'DELETE' });
      await supabase(`/rest/v1/products?slug=like.${encodeURIComponent(slug)}-%`, SERVICE_KEY, { method: 'DELETE' });
    } catch (_) {}
    const extStore = await readExtendedCatalogStore();
    extStore.collections = (extStore.collections || []).filter(c => c.slug !== slug);
    extStore.collection_products = (extStore.collection_products || []).filter(cp => cp.collection_id !== slug && !cp.product_slug.startsWith(slug + '-'));
    delete extStore.product_meta[slug];
    for (const k of Object.keys(extStore.product_meta || {})) {
      if (k.startsWith(slug + '-')) delete extStore.product_meta[k];
    }
    await writeExtendedCatalogStore(extStore);
    return res.status(200).json({ ok: true, deleted: true, slug });
  }

  const slug = String(body.slug || '').trim();
  const title = String(body.title || body.name || '').trim();
  const hero_image = String(body.hero_image || body.hero_image_url || '').trim();
  if (!validSlug(slug) || !title || !hero_image) {
    return res.status(400).json({ ok: false, error: 'Koleksiyon kodu (slug), adı ve ana tanıtım görseli zorunludur.' });
  }

  const now = new Date().toISOString();
  const dbPayload = {
    slug,
    title,
    category: String(body.category || 'Yatak Odası').trim(),
    short_description: body.short_description ? String(body.short_description).trim() : '',
    design_story: body.design_story ? String(body.design_story).trim() : '',
    hero_image,
    color_palette: Array.isArray(body.color_palette) ? body.color_palette : [],
    is_visible: body.is_visible !== false,
    sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
    updated_at: now
  };

  let savedCol = null;
  try {
    const saved = await supabase('/rest/v1/collections?on_conflict=slug', SERVICE_KEY, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(dbPayload)
    });
    savedCol = saved?.[0] || null;
  } catch (_) {}

  const extStore = await readExtendedCatalogStore();
  const existingIdx = (extStore.collections || []).findIndex(c => c.slug === slug);
  const prevVersion = existingIdx >= 0 ? Number(extStore.collections[existingIdx].version || 1) : 0;

  const fullColRecord = {
    id: savedCol?.id || (existingIdx >= 0 ? extStore.collections[existingIdx].id : slug),
    ...dbPayload,
    code: body.code ? String(body.code).trim() : slug.toUpperCase(),
    description: body.description ? String(body.description).trim() : (dbPayload.short_description || ''),
    features: Array.isArray(body.features) ? body.features : [],
    materials: Array.isArray(body.materials) ? body.materials : [],
    dimensions: (body.dimensions && typeof body.dimensions === 'object') ? body.dimensions : {},
    technical_specs: (body.technical_specs && typeof body.technical_specs === 'object') ? body.technical_specs : {},
    video_urls: Array.isArray(body.video_urls) ? body.video_urls : [],
    marketing_preferences: (body.marketing_preferences && typeof body.marketing_preferences === 'object') ? body.marketing_preferences : {},
    version: prevVersion + 1
  };

  if (existingIdx >= 0) extStore.collections[existingIdx] = fullColRecord;
  else extStore.collections.push(fullColRecord);

  // Eğer koleksiyon kaydedilirken bağlı ürün listesi (product_slugs) gönderildiyse eşleştir
  if (Array.isArray(body.product_slugs)) {
    const colId = fullColRecord.id;
    extStore.collection_products = (extStore.collection_products || []).filter(
      cp => cp.collection_id !== colId && cp.collection_id !== slug
    );
    body.product_slugs.forEach((pItem, idx) => {
      const pSlug = typeof pItem === 'string' ? pItem : pItem?.product_slug;
      const pRole = typeof pItem === 'object' && pItem?.role_in_collection ? pItem.role_in_collection : 'part';
      if (validSlug(pSlug)) {
        extStore.collection_products.push({
          id: `cp_${colId}_${pSlug}`,
          collection_id: colId,
          product_slug: pSlug,
          role_in_collection: pRole,
          sort_order: idx + 1,
          created_at: now
        });
      }
    });
  }

  await writeExtendedCatalogStore(extStore);
  return res.status(200).json({ ok: true, collection: fullColRecord });
}

// ── 6. KOLEKSİYON PARÇA İLİŞKİLERİ (ÜRÜN KOPYALAMADAN ÇOKLU BAĞLAMA) ────────
async function collectionProducts(req, res) {
  if (req.method === 'GET') {
    const colId = String(req.query?.collection_id || '').trim();
    const prodSlug = String(req.query?.product_slug || '').trim();
    const extStore = await readExtendedCatalogStore();
    let dbRows = [];
    try {
      let q = '/rest/v1/collection_products?select=*,products(*)&order=sort_order.asc';
      if (colId) q += `&collection_id=eq.${encodeURIComponent(colId)}`;
      if (prodSlug) q += `&product_slug=eq.${encodeURIComponent(prodSlug)}`;
      dbRows = await supabase(q, ANON_KEY);
    } catch (_) {
      dbRows = [];
    }

    const combined = [...(Array.isArray(dbRows) ? dbRows : [])];
    for (const cp of (extStore.collection_products || [])) {
      const matchesCol = !colId || cp.collection_id === colId;
      const matchesProd = !prodSlug || cp.product_slug === prodSlug;
      if (matchesCol && matchesProd && !combined.some(x => x.collection_id === cp.collection_id && x.product_slug === cp.product_slug)) {
        combined.push(cp);
      }
    }
    return res.status(200).json({ ok: true, items: combined });
  }

  await authenticateRoles(req, ['admin', 'product_manager']);
  const body = req.body || {};

  if (req.method === 'DELETE') {
    const colId = String(body.collection_id || '').trim();
    const prodSlug = String(body.product_slug || '').trim();
    if (!colId || !prodSlug) return res.status(400).json({ ok: false, error: 'collection_id ve product_slug zorunlu.' });
    try {
      await supabase(`/rest/v1/collection_products?collection_id=eq.${encodeURIComponent(colId)}&product_slug=eq.${encodeURIComponent(prodSlug)}`, SERVICE_KEY, { method: 'DELETE' });
    } catch (_) {}
    const extStore = await readExtendedCatalogStore();
    extStore.collection_products = (extStore.collection_products || []).filter(
      cp => !(cp.collection_id === colId && cp.product_slug === prodSlug)
    );
    await writeExtendedCatalogStore(extStore);
    return res.status(200).json({ ok: true, removed: true });
  }

  if (req.method === 'POST') {
    const colId = String(body.collection_id || '').trim();
    const prodSlug = String(body.product_slug || '').trim();
    if (!colId || !validSlug(prodSlug)) return res.status(400).json({ ok: false, error: 'collection_id ve geçerli product_slug zorunlu.' });

    const role = String(body.role_in_collection || 'part').toLowerCase();
    const dbSafeRole = ['main_bed', 'wardrobe', 'nightstand', 'dresser', 'vanity', 'accent', 'part'].includes(role) ? role : 'part';
    const payload = {
      collection_id: colId,
      product_slug: prodSlug,
      role_in_collection: dbSafeRole,
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0
    };

    let savedItem = null;
    try {
      const saved = await supabase('/rest/v1/collection_products?on_conflict=collection_id,product_slug', SERVICE_KEY, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(payload)
      });
      savedItem = saved?.[0] || null;
    } catch (_) {}

    const extStore = await readExtendedCatalogStore();
    extStore.collection_products = (extStore.collection_products || []).filter(
      cp => !(cp.collection_id === colId && cp.product_slug === prodSlug)
    );
    const record = {
      id: savedItem?.id || `cp_${colId}_${prodSlug}`,
      collection_id: colId,
      product_slug: prodSlug,
      role_in_collection: role,
      sort_order: payload.sort_order,
      created_at: new Date().toISOString()
    };
    extStore.collection_products.push(record);
    await writeExtendedCatalogStore(extStore);

    return res.status(200).json({ ok: true, item: record });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

// ── 7. 9 KATEGORİLİ MEDYA KÜTÜPHANESİ VE GERÇEK/AI AYRIMI (BÖLÜM 4.5 & 4.6) ─
async function productMedia(req, res) {
  if (req.method === 'GET') {
    const slug = req.query?.product_slug ? String(req.query.product_slug).trim() : '';
    const colId = req.query?.collection_id ? String(req.query.collection_id).trim() : '';
    const sourceFilter = req.query?.source_type ? String(req.query.source_type).trim().toLowerCase() : '';
    const categoryFilter = req.query?.media_type ? String(req.query.media_type).trim().toLowerCase() : '';

    const extStore = await readExtendedCatalogStore();
    let dbRows = [];
    try {
      let query = '/rest/v1/product_media?select=*&order=sort_order.asc,created_at.desc';
      if (slug) query += `&product_slug=eq.${encodeURIComponent(slug)}`;
      if (colId) query += `&collection_id=eq.${encodeURIComponent(colId)}`;
      dbRows = await supabase(query, ANON_KEY);
    } catch (_) {
      dbRows = [];
    }

    const mediaMap = new Map();
    for (const m of (Array.isArray(dbRows) ? dbRows : [])) {
      mediaMap.set(m.id || m.media_url, m);
    }
    for (const m of (extStore.media || [])) {
      const matchesSlug = !slug || m.product_slug === slug;
      const matchesCol = !colId || m.collection_id === colId;
      if (matchesSlug && matchesCol) {
        const existing = mediaMap.get(m.id || m.media_url) || {};
        mediaMap.set(m.id || m.media_url, { ...existing, ...m });
      }
    }

    let list = Array.from(mediaMap.values()).map(m => ({
      ...m,
      tags: Array.isArray(m.tags) && m.tags.length ? m.tags : [m.media_type || 'hero'],
      is_real_photo: ['real', 'original'].includes(String(m.source_type || 'real').toLowerCase()),
      is_ai_generated: ['ai_generated', 'ai_banana', 'cad_render'].includes(String(m.source_type || '').toLowerCase())
    }));

    if (sourceFilter) {
      if (sourceFilter === 'real') list = list.filter(m => m.is_real_photo);
      else if (sourceFilter === 'ai_generated') list = list.filter(m => m.is_ai_generated);
    }
    if (categoryFilter) {
      list = list.filter(m =>
        String(m.media_type || '').toLowerCase() === categoryFilter ||
        (Array.isArray(m.tags) && m.tags.map(t => String(t).toLowerCase()).includes(categoryFilter))
      );
    }

    return res.status(200).json({ ok: true, media: list });
  }

  await authenticateRoles(req, ['admin', 'product_manager']);
  const body = req.body || {};

  if (req.method === 'DELETE') {
    const id = String(body.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'Medya ID gerekli.' });
    try {
      await supabase(`/rest/v1/product_media?id=eq.${encodeURIComponent(id)}`, SERVICE_KEY, { method: 'DELETE' });
    } catch (_) {}
    const extStore = await readExtendedCatalogStore();
    extStore.media = (extStore.media || []).filter(m => m.id !== id);
    await writeExtendedCatalogStore(extStore);
    return res.status(200).json({ ok: true, deleted: true, id });
  }

  if (req.method === 'POST') {
    const media_url = String(body.media_url || '').trim();
    if (!media_url) return res.status(400).json({ ok: false, error: 'media_url zorunludur.' });

    const requestedType = String(body.media_type || 'hero').toLowerCase();
    const media_type = VALID_MEDIA_TYPES.has(requestedType) ? requestedType : 'hero';
    // Eski DB kısıtlamasıyla uyumlu tip
    const dbSafeType = ['hero', 'detail', 'isolated', 'texture', 'carousel', 'video', 'technical'].includes(media_type)
      ? media_type
      : 'hero';

    const requestedSource = String(body.source_type || 'real').toLowerCase();
    const source_type = VALID_SOURCE_TYPES.has(requestedSource) ? requestedSource : 'real';
    const dbSafeSource = source_type === 'real' ? 'original' : source_type;

    const tags = Array.isArray(body.tags) && body.tags.length
      ? body.tags.map(t => String(t).toLowerCase()).filter(t => VALID_MEDIA_TYPES.has(t))
      : [media_type];

    const dbPayload = {
      product_slug: body.product_slug ? String(body.product_slug).trim() : null,
      collection_id: (body.collection_id && /^[0-9a-f-]{36}$/i.test(String(body.collection_id))) ? String(body.collection_id).trim() : null,
      media_url,
      media_type: dbSafeType,
      source_type: dbSafeSource,
      approval_status: String(body.approval_status || 'approved').toLowerCase(),
      aspect_ratio: String(body.aspect_ratio || '1:1'),
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
      caption: body.caption ? String(body.caption).trim() : null
    };

    let savedRow = null;
    try {
      const saved = await supabase('/rest/v1/product_media', SERVICE_KEY, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(dbPayload)
      });
      savedRow = saved?.[0] || null;
    } catch (_) {}

    const extStore = await readExtendedCatalogStore();
    const fullMedia = {
      id: savedRow?.id || `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...dbPayload,
      collection_id: body.collection_id ? String(body.collection_id).trim() : null,
      media_type,
      source_type,
      tags,
      fidelity_verified: body.fidelity_verified !== false,
      created_at: savedRow?.created_at || new Date().toISOString()
    };
    extStore.media = [fullMedia, ...(extStore.media || []).filter(m => m.id !== fullMedia.id)];
    await writeExtendedCatalogStore(extStore);

    return res.status(201).json({ ok: true, media: fullMedia });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

// ── 8. TEKLİF TALEPLERİ & CRM BAĞLANTISI ────────────────────────────────────
async function quotes(req, res) {
  if (req.method === 'POST') {
    const body = req.body || {};
    const name = String(body.customer_name || '').trim();
    const phone = String(body.customer_phone || '').trim();
    if (!name || !phone || phone.length < 7) {
      return res.status(400).json({ ok: false, error: 'Ad soyad ve geçerli telefon numarası zorunludur.' });
    }

    const quoteNumber = `GM-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const payload = {
      quote_number: quoteNumber,
      product_slug: body.product_slug ? String(body.product_slug).trim() : null,
      collection_slug: body.collection_slug ? String(body.collection_slug).trim() : null,
      variant_id: body.variant_id ? String(body.variant_id).trim() : null,
      customer_name: name,
      customer_phone: phone,
      customer_email: body.customer_email ? String(body.customer_email).trim() : null,
      customer_city: body.customer_city ? String(body.customer_city).trim() : null,
      request_type: String(body.request_type || 'catalog_price'),
      custom_notes: body.custom_notes ? String(body.custom_notes).slice(0, 2000) : null,
      status: 'new',
      source_channel: String(body.source_channel || 'web_showroom'),
      created_at: new Date().toISOString()
    };

    const saved = await supabase('/rest/v1/quote_requests', SERVICE_KEY, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });

    return res.status(201).json({
      ok: true,
      quote_number: quoteNumber,
      message: 'Teklif talebiniz başarıyla alındı. Fabrika satış temsilcimiz en kısa sürede sizinle iletişime geçecektir.',
      quote: saved?.[0] || null
    });
  }

  await authenticateRoles(req, ['admin', 'product_manager']);

  if (req.method === 'GET') {
    const rows = await supabase('/rest/v1/quote_requests?select=*&order=created_at.desc&limit=100', SERVICE_KEY).catch(() => []);
    return res.status(200).json({ ok: true, quotes: rows || [], data: rows || [] });
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const id = String(req.body?.id || '').trim();
    const status = String(req.body?.status || '').trim();
    if (!id || !status) return res.status(400).json({ ok: false, error: 'Talep ID ve yeni durum zorunludur.' });

    const updated = await supabase(`/rest/v1/quote_requests?id=eq.${encodeURIComponent(id)}`, SERVICE_KEY, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() })
    });
    return res.status(200).json({ ok: true, quote: updated?.[0] || null });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

// ── 9. DİJİTAL SHOWROOM ENTEGRE ÇEKME ────────────────────────────────────────
async function showroom(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    const [colsRes, prodsRes, colProdsRes, mediaRes, extStore] = await Promise.all([
      supabase('/rest/v1/collections?is_visible=eq.true&order=sort_order.asc,created_at.asc', ANON_KEY).catch(() => []),
      supabase('/rest/v1/products?order=created_at.desc', ANON_KEY).catch(() => []),
      supabase('/rest/v1/collection_products?select=*&order=sort_order.asc', ANON_KEY).catch(() => []),
      supabase('/rest/v1/product_media?approval_status=eq.approved&order=sort_order.asc', ANON_KEY).catch(() => []),
      readExtendedCatalogStore()
    ]);

    const colMap = new Map();
    for (const c of (Array.isArray(colsRes) ? colsRes : [])) colMap.set(c.slug, c);
    for (const c of (extStore.collections || [])) {
      if (c.is_visible !== false) colMap.set(c.slug, { ...(colMap.get(c.slug) || {}), ...c });
    }

    return res.status(200).json({
      ok: true,
      showroom: {
        brand: {
          name: 'Global Mobilya',
          title: 'Premium Dijital Showroom & Mimari Koleksiyonlar',
          phone: '0 (505) 015 1035',
          whatsapp: 'https://wa.me/905050151035'
        },
        collections: Array.from(colMap.values()),
        products: Array.isArray(prodsRes) ? prodsRes : [],
        collection_products: [...(Array.isArray(colProdsRes) ? colProdsRes : []), ...(extStore.collection_products || [])],
        media: [...(Array.isArray(mediaRes) ? mediaRes : []), ...(extStore.media || [])]
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Showroom verileri yüklenemedi: ' + err.message });
  }
}

// ── GEMINI VISION AI İLE ANA TANITIM GÖRSELİNDEN GENEL ÖZELLİK ÜRETİMİ ───────
async function extractInlineImagePart(imageInput) {
  const raw = String(imageInput || '').trim();
  if (!raw) return null;
  try {
    const dataMatch = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (dataMatch) {
      return {
        inline_data: {
          mime_type: dataMatch[1],
          data: dataMatch[2]
        }
      };
    }
    const resolvedUrl = raw.startsWith('http://') || raw.startsWith('https://')
      ? raw
      : `https://globalmobilyaweb.vercel.app${raw.startsWith('/') ? '' : '/'}${raw}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const imgResp = await fetch(resolvedUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!imgResp.ok) return null;
    const contentType = (imgResp.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    const ab = await imgResp.arrayBuffer();
    const base64Data = Buffer.from(ab).toString('base64');
    if (!base64Data) return null;
    return {
      inline_data: {
        mime_type: contentType.startsWith('image/') ? contentType : 'image/jpeg',
        data: base64Data
      }
    };
  } catch (_) {
    return null;
  }
}

async function analyzeMainImageAndGenerateFeatures({ imageInput, title, kategori, promoQuote }) {
  const geminiKey = process.env.GEMINI_API_KEY || '';
  if (geminiKey) {
    try {
      const inlineImagePart = await extractInlineImagePart(imageInput);
      const prompt = `Sen Global Mobilya markasının baş mimar ve mobilya tasarımcısısın.
${inlineImagePart ? 'Ekteki ana tanıtım görselini (mobilya/koleksiyon fotoğrafını) dikkatlice incele ve görselde gördüğün tasarım dili, kapak/yüzey formu, renk ve doku uyumu, kulp/ayak/ayna detayları ve modül yapısına bakarak' : 'Aşağıdaki mobilya bilgilerine dayanarak'} 3 veya 4 adet genel ürün özelliği maddesi üret.

Kurallar:
- Doğrudan ana tanıtım görselinde görünen estetik, mimari ve fonksiyonel genel özelliklere odaklan.
- Her satırda tek bir genel özellik olsun (Örn: Zarif dikey derz işlemeli modern kapak tasarımı).
- Madde işareti (*, -, •), numara veya emoji KOYMA. Sadece satır satır metin yaz.
- Toplam tam 3 veya 4 satır olsun.
- Asla hayali ölçü (cm/mm) veya fiyat uydurma.

Ürün/Koleksiyon Adı: ${title || 'Global Mobilya Tasarımı'}
Kategori: ${kategori || 'Mobilya'}
${promoQuote ? `Tanıtım Cümlesi / Hikayesi: ${promoQuote}` : ''}`;

      const parts = [];
      if (inlineImagePart) parts.push(inlineImagePart);
      parts.push({ text: prompt });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 14000);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { maxOutputTokens: 250, temperature: 0.5 }
        }),
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (resp.ok) {
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const lines = text.split('\n').map(s => s.replace(/^[\s*\-•\d.]+/g, '').trim()).filter(Boolean).slice(0, 4);
        if (lines.length >= 2) {
          return lines;
        }
      }
    } catch (_) {}
  }

  // Akıllı kategori bazlı fallback özellikleri
  const fallbacks = {
    'Yatak Odası': [
      '1. Sınıf E1 Kalite Dayanıklı MDF Gövde Yapısı',
      'CNC Membran Kapak ve Frenli Menteşe Sistemi',
      'Geniş Hacimli Fonksiyonel Depolama Alanı',
      'Yüksek Ayaklı Kolay Temizlenebilir Modern Tasarım'
    ],
    'Genç Odası': [
      '1. Sınıf E1 Kalite Sağlığa Zararsız MDF Gövde',
      'Çizilmeye Dayanıklı CNC Membran Yüzey',
      'Ergonomik Çalışma ve Depolama Çözümleri',
      'Sessiz Frenli Ray ve Menteşe Donanımı'
    ],
    'Dolap Koleksiyonları': [
      '1. Sınıf 18mm MDF Gövde ve CNC Membran Kapaklar',
      'Geniş Askılık ve Fonksiyonel Raf Düzeni',
      'Sessiz Kapanan Frenli Menteşe ve Ray Sistemi',
      'Uzun Ömürlü Çizilmeye Dayanıklı Yüzey Teknolojisi'
    ],
    'Kahve Köşesi Koleksiyonları': [
      '1. Sınıf MDF Gövde ve Özel CNC Membran Kapaklar',
      'Kahve Makinesi ve Ekipmanlar İçin İdeal Tezgah Alanı',
      'Fonksiyonel Kupa Askılığı ve Depolama Bölmeleri',
      'Modern Mimari Çizgiler ve Dayanıklı Yüzey'
    ],
    'Şifonyer': [
      '1. Sınıf MDF Gövde ve CNC Membran Çekmece Kapakları',
      'Tam Açılır Frenli Teleskopik Ray Sistemi',
      'Geniş İç Hacimli Çoklu Çekmece Düzeni',
      'Robot Süpürgeye Uygun Yüksek Ayak Tasarımı'
    ],
    '3 Kapılı Dolap': [
      '1. Sınıf MDF Gövde ve 3 Kapılı CNC Membran Tasarım',
      'Fonksiyonel Askılık ve Raf Bölmeleri',
      'Sessiz Frenli Menteşe Donanımı',
      'Çizilmeye Dayanıklı İthal Membran Yüzey'
    ],
    '4 Kapılı Dolap': [
      '1. Sınıf MDF Gövde ve 4 Kapılı Geniş Tasarım',
      'Zengin İç Raf ve Askılık Organizasyonu',
      'Sessiz Frenli Menteşe ve Çekmece Rayları',
      'Çizilmeye Dayanıklı Premium Membran Yüzey'
    ],
    '5 Kapılı Dolap': [
      '1. Sınıf MDF Gövde ve 5 Kapılı Geniş Depolama Hacmi',
      'Çok Bölmeli Askılık, Yüklük ve Raf Sistemi',
      'Sessiz Frenli Menteşe ve Ray Donanımı',
      'Çizilmeye Dayanıklı CNC Membran Kapaklar'
    ],
    '6 Kapılı Dolap': [
      '1. Sınıf MDF Gövde ve 6 Kapılı Maksimum Depolama Alanı',
      'Özel Tasarım İç Organizasyon ve Geniş Askılık Bölmeleri',
      'Sessiz Frenli Menteşe ve Tam Açılır Ray Sistemi',
      'Çizilmeye Dayanıklı 1. Sınıf CNC Membran Yüzey'
    ],
    'Modüler Dolap': [
      'Mekana Göre Özelleştirilebilir Modüler MDF Gövde',
      'CNC Membran Kapak ve Zengin İç Donanım Seçenekleri',
      'Sessiz Frenli Menteşe ve Ray Mekanizması',
      'Her Ölçüye Uyumlu Fonksiyonel Mimari Tasarım'
    ],
    'Portmanto': [
      '1. Sınıf MDF Gövde ve CNC Membran Kapaklar',
      'Geniş ve Düzenleyici Ayakkabılık & Askılık Bölmeleri',
      'Sessiz Frenli Menteşe ve Ray Donanımı',
      'Robot Süpürgeye Uygun Ergonomik Yüksek Ayak Tasarımı'
    ],
    'Kahve Köşesi': [
      '1. Sınıf MDF Gövde ve CNC Membran Kapak İşçiliği',
      'Kahve Ekipmanları İçin Ergonomik Tezgah ve Raf Alanı',
      'Sessiz Frenli Kapak ve Çekmece Donanımı',
      'Çizilmeye ve Neme Dayanıklı Membran Yüzey'
    ]
  };
  return fallbacks[kategori] || fallbacks['Yatak Odası'];
}

async function generateFeatures(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const kategori = String(body.kategori || '').trim();
  const promoQuote = String(body.promo_quote || '').trim();
  const imageInput = String(body.image_data || body.image_url || body.ana_resim || '').trim();

  const features = await analyzeMainImageAndGenerateFeatures({
    imageInput,
    title,
    kategori,
    promoQuote
  });
  return res.status(200).json({ ok: true, features });
}

// ── 10. CLERK SESSION DOĞRULAMA, B2C LAZY REGISTRATION & CRM MÜŞTERİLER ──────
async function handleClerkSession(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Clerk-Org-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const ctx = await resolveClerkAuthContext(req);
    if (ctx.isOrganizationMember) {
      await syncErpUserToSupabase({
        clerk_user_id: ctx.clerk_user_id,
        email: ctx.email,
        username: ctx.username,
        full_name: ctx.fullName,
        avatar_url: ctx.avatarUrl,
        org_id: ctx.orgId,
        org_role: ctx.orgRole,
        department: ctx.department
      }).catch(() => {});
    }
    return res.status(200).json({
      ok: true,
      authenticated: true,
      publishableKey: CLERK_PUBLISHABLE_KEY,
      user: ctx,
      departments: DEPARTMENT_DEFINITIONS
    });
  } catch (err) {
    return res.status(err.status || 401).json({
      ok: false,
      authenticated: false,
      code: err.code || 'UNAUTHENTICATED',
      publishableKey: CLERK_PUBLISHABLE_KEY,
      error: err.message
    });
  }
}

async function handleB2CLazyQuote(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const b = req.body || {};
  let clerkCtx = null;
  try {
    if (req.headers?.authorization) {
      clerkCtx = await resolveClerkAuthContext(req);
    }
  } catch (_) {}

  const clerkUserId = clerkCtx?.clerk_user_id || String(b.clerk_user_id || '').trim() || null;
  const email = clerkCtx?.email || String(b.email || b.customer_email || '').trim() || null;
  const fullName = String(b.name || b.customer_name || clerkCtx?.fullName || 'Müşteri').trim();
  const phone = String(b.phone || b.customer_phone || clerkCtx?.phone || '').trim();
  const city = String(b.city || b.customer_city || '').trim();
  const model = String(b.collection_id || b.model || b.interested_model || '').trim();
  const notes = String(b.notes || b.custom_notes || '').trim();

  // Müşteriyi organizasyona eklemeden doğrudan Supabase crm_customers tablosuna kaydet
  const result = await upsertCrmCustomerToSupabase({
    clerk_user_id: clerkUserId,
    email,
    full_name: fullName,
    phone,
    city,
    interested_model: model,
    notes,
    source: 'b2c_lazy_quote'
  });

  return res.status(201).json({
    ok: true,
    reference_code: result.reference_code,
    customer: result.customer,
    message: 'Teklif talebiniz ve müşteri kaydınız başarıyla oluşturuldu.'
  });
}

async function handleCrmCustomers(req, res) {
  await authenticateRoles(req, ['admin', 'sales']);

  if (req.method === 'GET') {
    const [dbRows, storeRows] = await Promise.all([
      supabase('/rest/v1/crm_customers?select=*&order=created_at.desc&limit=200', SERVICE_KEY).catch(() => []),
      supabase('/rest/v1/site_settings?key=eq.crm_customers_store&select=data&limit=1', SERVICE_KEY).catch(() => [])
    ]);
    const storeData = Array.isArray(storeRows) && storeRows[0]?.data ? storeRows[0].data : { customers: [], quotes: [] };
    const customers = (Array.isArray(dbRows) && dbRows.length > 0) ? dbRows : (storeData.customers || []);
    const quotesList = storeData.quotes || [];

    return res.status(200).json({
      ok: true,
      customers,
      quotes: quotesList
    });
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const saved = await upsertCrmCustomerToSupabase(req.body || {});
    return res.status(200).json(saved);
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

async function handleTelemetryHealth(req, res) {
  await authenticateRoles(req, ['admin', 'viewer']);
  const snapshot = await fetchInfraHealthSnapshot();
  return res.status(200).json(snapshot);
}

async function handleProductAnalytics(req, res) {
  await authenticateRoles(req, ['admin', 'viewer', 'sales', 'social_media']);
  const [posthog, crmStoreRows] = await Promise.all([
    fetchPostHogAnalyticsSummary(),
    supabase('/rest/v1/site_settings?key=eq.crm_customers_store&select=data&limit=1', SERVICE_KEY).catch(() => [])
  ]);
  const crmStore = Array.isArray(crmStoreRows) && crmStoreRows[0]?.data ? crmStoreRows[0].data : { customers: [], quotes: [] };
  return res.status(200).json({
    ok: true,
    checkedAt: new Date().toISOString(),
    posthog,
    crmSummary: {
      totalB2CCustomers: Array.isArray(crmStore.customers) ? crmStore.customers.length : 0,
      totalQuotes: Array.isArray(crmStore.quotes) ? crmStore.quotes.length : 0,
      latestQuotes: (crmStore.quotes || []).slice(0, 8)
    }
  });
}

// ── ANA YÖNLENDİRİCİ ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const action = actionOf(req);
    if (action === 'clerk-webhook') return await handleClerkWebhookRequest(req, res);
    if (action === 'clerk-session') return await handleClerkSession(req, res);
    if (action === 'b2c-lazy-quote') return await handleB2CLazyQuote(req, res);
    if (action === 'crm-customers') return await handleCrmCustomers(req, res);
    if (action === 'telemetry-health') return await handleTelemetryHealth(req, res);
    if (action === 'product-analytics') return await handleProductAnalytics(req, res);
    if (action === 'products') return await products(req, res);
    if (action === 'settings') return await settings(req, res);
    if (action === 'ai-profiles' || action === 'marketing-profiles') return await aiProfiles(req, res);
    if (action === 'media') return await media(req, res);
    if (action === 'collections') return await collections(req, res);
    if (action === 'collection-products') return await collectionProducts(req, res);
    if (action === 'product-media') return await productMedia(req, res);
    if (action === 'quote' || action === 'quotes') return await quotes(req, res);
    if (action === 'showroom') return await showroom(req, res);
    if (action === 'generate-features') return await generateFeatures(req, res);
    return res.status(400).json({ ok: false, error: 'Bilinmeyen Modül 7 işlemi: ' + action });
  } catch (err) {
    return apiError(res, err, 'Module 7');
  }
}

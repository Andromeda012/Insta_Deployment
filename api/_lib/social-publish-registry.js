// ============================================================================
// GLOBAL KAPAK MOBİLYA — SOSYAL MEDYA YAYIN ETİKETİ (YAYINLANDI / YAYINLANMADI)
// VE OTOMATİK DURAKLATMA / 6 SAATLİK YENİ ÜRÜN KONTROL MOTORU
// ============================================================================

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/+$/, '');
const REGISTRY_KEY = 'social_publish_registry';
export const AUTO_RESUME_INTERVAL_HOURS = 6;
const AUTO_RESUME_INTERVAL_MS = AUTO_RESUME_INTERVAL_HOURS * 60 * 60 * 1000;

const PIECE_SLUG_RE = /-(?:6-kapili-dolap|5-kapili-dolap|4-kapili-dolap|3-kapili-dolap|komodin|sifonyer|kucuk-kahve-kosesi|orta-kahve-kosesi|buyuk-kahve-kosesi|main-bed|wardrobe|nightstand|dresser|vanity|mirror|bed|dolap|parca|part)-\d+$/i;
const PIECE_SKU_RE = /-(?:P\d+|parca|piece)$/i;

function getSupabaseKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
}

async function sbFetch(path, options = {}) {
  const key = getSupabaseKey();
  if (!SUPABASE_URL || !key) throw new Error('Supabase yapılandırması eksik.');
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

export async function readSocialPublishRegistry() {
  const res = await sbFetch(`/rest/v1/site_settings?key=eq.${REGISTRY_KEY}&select=data,updated_at&limit=1`);
  const d = (res.ok && Array.isArray(res.data) && res.data[0]?.data) ? res.data[0].data : null;
  return {
    items: (d && typeof d.items === 'object' && !Array.isArray(d.items)) ? d.items : {},
    queue_paused: Boolean(d?.queue_paused),
    pause_reason: d?.pause_reason || null,
    paused_at: d?.paused_at || null,
    last_new_product_check_at: d?.last_new_product_check_at || null,
    auto_resume_interval_hours: Number(d?.auto_resume_interval_hours) || AUTO_RESUME_INTERVAL_HOURS,
    next_check_at: d?.next_check_at || null,
    updated_at: d?.updated_at || null
  };
}

export async function writeSocialPublishRegistry(registry) {
  const now = new Date().toISOString();
  const payload = {
    ...registry,
    auto_resume_interval_hours: registry.auto_resume_interval_hours || AUTO_RESUME_INTERVAL_HOURS,
    updated_at: now
  };
  await sbFetch('/rest/v1/site_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: REGISTRY_KEY, data: payload, updated_at: now })
  });
  return payload;
}

/**
 * Veritabanındaki tüm koleksiyonları ve bağımsız ürünleri tarar,
 * her birine 'unpublished' veya 'published' etiketi atar.
 * - Tüm ürünler/koleksiyonlar 'published' ise kuyruk otomatik DURDURULUR.
 * - Yeni bir 'unpublished' ürün/koleksiyon algılanırsa kuyruk otomatik DEVAM EDER.
 */
export async function syncSocialPublishRegistry({ forceCheck = false } = {}) {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const registry = await readSocialPublishRegistry();

  // Durdurulmuşsa ve 6 saatlik kontrol döngüsü henüz dolmadıysa (ve zorunlu kontrol değilse) DB taramasını atla
  if (registry.queue_paused && !forceCheck && registry.next_check_at) {
    const nextMs = new Date(registry.next_check_at).getTime();
    if (!Number.isNaN(nextMs) && nowMs < nextMs) {
      return {
        registry,
        skippedCheck: true,
        summary: summarizeRegistry(registry)
      };
    }
  }

  const [prodsRes, extRes] = await Promise.all([
    sbFetch('/rest/v1/products?select=slug,title,sku,kategori,ana_resim,web_gorunur,created_at&order=created_at.desc'),
    sbFetch('/rest/v1/site_settings?key=eq.module7_extended_catalog&select=data&limit=1')
  ]);

  const rawProducts = Array.isArray(prodsRes.data) ? prodsRes.data : [];
  const extStore = (Array.isArray(extRes.data) && extRes.data[0]?.data) ? extRes.data[0].data : {};
  const collections = Array.isArray(extStore.collections) ? extStore.collections : [];

  const catalogEntries = new Map();

  for (const c of collections) {
    if (!c?.slug || c.is_visible === false) continue;
    catalogEntries.set(c.slug, {
      slug: c.slug,
      title: c.title || c.name || c.slug,
      entity_type: 'collection',
      category: c.category || 'Koleksiyon',
      image_url: c.hero_image || c.hero_image_url || ''
    });
  }

  for (const p of rawProducts) {
    if (!p?.slug || p.web_gorunur === false) continue;
    if (catalogEntries.has(p.slug)) continue;
    if (PIECE_SLUG_RE.test(p.slug) || (p.sku && PIECE_SKU_RE.test(p.sku))) continue;
    catalogEntries.set(p.slug, {
      slug: p.slug,
      title: p.title || p.slug,
      entity_type: 'product',
      category: p.kategori || 'Ürün',
      image_url: p.ana_resim || ''
    });
  }

  const nextItems = {};
  for (const [slug, meta] of catalogEntries.entries()) {
    const existing = registry.items[slug];
    nextItems[slug] = {
      slug,
      title: meta.title,
      entity_type: meta.entity_type,
      category: meta.category,
      image_url: meta.image_url,
      status: existing?.status === 'published' ? 'published' : 'unpublished',
      published_at: existing?.published_at || null,
      published_platforms: Array.isArray(existing?.published_platforms) ? existing.published_platforms : [],
      queue_task_id: existing?.queue_task_id || null
    };
  }

  const allValues = Object.values(nextItems);
  const unpublishedCount = allValues.filter(i => i.status === 'unpublished').length;
  const publishedCount = allValues.filter(i => i.status === 'published').length;

  let queue_paused = false;
  let pause_reason = null;
  let paused_at = null;
  let next_check_at = null;

  if (allValues.length === 0) {
    queue_paused = true;
    pause_reason = 'CATALOG_EMPTY';
    paused_at = registry.paused_at || nowIso;
    next_check_at = new Date(nowMs + AUTO_RESUME_INTERVAL_MS).toISOString();
  } else if (unpublishedCount === 0) {
    // TÜM ÜRÜNLER VE KOLEKSİYONLAR YAYINLANDI → KUYRUK OTOMATİK DURDURULUR
    queue_paused = true;
    pause_reason = 'ALL_PRODUCTS_PUBLISHED';
    paused_at = registry.paused_at || nowIso;
    next_check_at = new Date(nowMs + AUTO_RESUME_INTERVAL_MS).toISOString();
  } else {
    // YAYINLANMAMIŞ ÜRÜN/KOLEKSİYON VAR → KUYRUK AKTİF (OTOMATİK DEVAM)
    queue_paused = false;
    pause_reason = null;
    paused_at = null;
    next_check_at = null;
  }

  const updated = await writeSocialPublishRegistry({
    items: nextItems,
    queue_paused,
    pause_reason,
    paused_at,
    last_new_product_check_at: nowIso,
    auto_resume_interval_hours: AUTO_RESUME_INTERVAL_HOURS,
    next_check_at
  });

  return {
    registry: updated,
    skippedCheck: false,
    summary: {
      total: allValues.length,
      published: publishedCount,
      unpublished: unpublishedCount,
      queue_paused,
      pause_reason,
      next_check_at
    }
  };
}

export function summarizeRegistry(registry) {
  const vals = Object.values(registry?.items || {});
  const published = vals.filter(i => i.status === 'published').length;
  const unpublished = vals.filter(i => i.status !== 'published').length;
  return {
    total: vals.length,
    published,
    unpublished,
    queue_paused: Boolean(registry?.queue_paused),
    pause_reason: registry?.pause_reason || null,
    paused_at: registry?.paused_at || null,
    last_new_product_check_at: registry?.last_new_product_check_at || null,
    auto_resume_interval_hours: registry?.auto_resume_interval_hours || AUTO_RESUME_INTERVAL_HOURS,
    next_check_at: registry?.next_check_at || null
  };
}

/**
 * Yayınlanmamış ('unpublished') koleksiyon veya ürünlerden birini seçer.
 * Tüm katalog 'published' ise kuyruğu durdurur ve { paused: true } döner.
 */
export async function pickNextUnpublishedCatalogItem({ platform = 'instagram', forceCheck = false } = {}) {
  const { registry, summary } = await syncSocialPublishRegistry({ forceCheck });
  if (registry.queue_paused || summary.unpublished === 0) {
    return {
      paused: true,
      reason: registry.pause_reason || 'ALL_PRODUCTS_PUBLISHED',
      next_check_at: registry.next_check_at,
      auto_resume_interval_hours: registry.auto_resume_interval_hours || AUTO_RESUME_INTERVAL_HOURS,
      summary,
      item: null
    };
  }

  const candidates = Object.values(registry.items).filter(item => item.status !== 'published');
  // Öncelik: Koleksiyonlar, ardından bağımsız ürünler
  candidates.sort((a, b) => {
    if (a.entity_type === 'collection' && b.entity_type !== 'collection') return -1;
    if (a.entity_type !== 'collection' && b.entity_type === 'collection') return 1;
    return String(a.slug).localeCompare(String(b.slug));
  });

  const chosen = candidates[0] || null;
  if (!chosen) {
    return { paused: true, reason: 'ALL_PRODUCTS_PUBLISHED', summary, item: null };
  }

  return {
    paused: false,
    platform,
    item: chosen,
    summary,
    registry
  };
}

/**
 * Bir ürün/koleksiyon kuyruğa alınıp yayınlandığında 'published' etiketi basar.
 * Eğer kalan yayınlanmamış içerik 0'a düşerse kuyruğu otomatik duraklatır.
 */
export async function markCatalogItemPublished(slug, { platform = 'instagram', queueTaskId = null } = {}) {
  if (!slug) return null;
  const { registry } = await syncSocialPublishRegistry({ forceCheck: true });
  const nowIso = new Date().toISOString();
  const prev = registry.items[slug] || { slug, title: slug, entity_type: 'product', published_platforms: [] };
  const platforms = Array.isArray(prev.published_platforms) ? [...prev.published_platforms] : [];
  if (platform && !platforms.includes(platform)) platforms.push(platform);

  registry.items[slug] = {
    ...prev,
    status: 'published',
    published_at: nowIso,
    published_platforms: platforms,
    queue_task_id: queueTaskId || prev.queue_task_id || null
  };

  const vals = Object.values(registry.items);
  const remainingUnpublished = vals.filter(i => i.status !== 'published').length;
  if (remainingUnpublished === 0) {
    registry.queue_paused = true;
    registry.pause_reason = 'ALL_PRODUCTS_PUBLISHED';
    registry.paused_at = nowIso;
    registry.next_check_at = new Date(Date.now() + AUTO_RESUME_INTERVAL_MS).toISOString();
  }

  const saved = await writeSocialPublishRegistry(registry);
  return { registry: saved, summary: summarizeRegistry(saved) };
}

/**
 * Tek bir ürün/koleksiyonun yayın etiketini manuel olarak 'published' veya 'unpublished' yapar.
 */
export async function setCatalogItemPublishTag(slug, status) {
  const normalized = status === 'published' ? 'published' : 'unpublished';
  const { registry } = await syncSocialPublishRegistry({ forceCheck: true });
  if (!registry.items[slug]) {
    throw new Error(`Katalog öğesi bulunamadı: ${slug}`);
  }
  const nowIso = new Date().toISOString();
  registry.items[slug] = {
    ...registry.items[slug],
    status: normalized,
    published_at: normalized === 'published' ? (registry.items[slug].published_at || nowIso) : null
  };

  const vals = Object.values(registry.items);
  const remainingUnpublished = vals.filter(i => i.status !== 'published').length;
  if (remainingUnpublished === 0) {
    registry.queue_paused = true;
    registry.pause_reason = 'ALL_PRODUCTS_PUBLISHED';
    registry.paused_at = nowIso;
    registry.next_check_at = new Date(Date.now() + AUTO_RESUME_INTERVAL_MS).toISOString();
  } else {
    registry.queue_paused = false;
    registry.pause_reason = null;
    registry.paused_at = null;
    registry.next_check_at = null;
  }

  const saved = await writeSocialPublishRegistry(registry);
  return { registry: saved, summary: summarizeRegistry(saved) };
}

/**
 * Module 2 arayüzünden kaydedilen yayın saatlerini (posting_slots) okur ve normalize eder.
 * Hem `enabled` hem `active` bayraklarını destekler.
 */
export function getNormalizedPostingSlots(config = {}, defaultSlots = []) {
  const raw = Array.isArray(config?.posting_slots) && config.posting_slots.length > 0
    ? config.posting_slots
    : defaultSlots;

  return raw
    .map((s, idx) => {
      const isEnabled = s.enabled !== undefined ? Boolean(s.enabled) : (s.active !== undefined ? Boolean(s.active) : true);
      const time = /^\d{2}:\d{2}$/.test(String(s.time || '').trim()) ? String(s.time).trim() : (defaultSlots[idx]?.time || '12:00');
      return {
        ...s,
        name: s.name || s.slot_id || `slot_${idx + 1}`,
        type: String(s.type || defaultSlots[idx]?.type || 'POST').toUpperCase(),
        time,
        enabled: isEnabled,
        active: isEnabled
      };
    })
    .filter(s => s.enabled);
}

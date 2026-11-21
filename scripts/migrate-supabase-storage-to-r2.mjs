// ============================================================================
// NOVA FURNITURE — FAZ 1: SUPABASE STORAGE -> CLOUDFLARE R2 TAM GÖÇ BETİĞİ
// Mevcut tüm ürün fotoğraflarını, koleksiyon görsellerini, 3D modelleri,
// müzik kütüphanesini ve stüdyo varlıklarını sıfır veri kaybıyla Cloudflare R2
// ('globalkapak-medya') üzerine taşır ve veritabanı referanslarını günceller.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import {
  extractR2KeyFromUrl,
  getR2PublicUrl,
  headR2Object,
  listR2Objects,
  normalizeR2Key,
  uploadBufferToR2
} from '../api/_lib/r2-storage.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/+$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!SERVICE_KEY) {
  console.error('HATA: SUPABASE_SERVICE_ROLE_KEY ortam değişkeni gerekli.');
  process.exit(1);
}

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

function guessMimeType(key) {
  const ext = path.extname(String(key || '')).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.obj': 'model/obj',
    '.fbx': 'application/octet-stream',
    '.blend': 'application/x-blender',
    '.hdr': 'image/vnd.radiance',
    '.exr': 'image/x-exr',
    '.json': 'application/json'
  };
  return map[ext] || 'application/octet-stream';
}

async function listSupabaseBucketRecursive(prefix = '') {
  const discovered = [];
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/media`, {
    method: 'POST',
    headers: sbHeaders,
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    })
  });
  if (!res.ok) return discovered;
  const items = await res.json().catch(() => []);
  if (!Array.isArray(items)) return discovered;

  for (const item of items) {
    if (!item || !item.name || item.name === '.emptyFolderPlaceholder') continue;
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    // Eski geçici social-renders test klasörlerini tam taramada atla (aktif DB referansları aşağıda zaten eklenir)
    if (fullPath === 'social-renders') continue;
    // Supabase Storage list API: klasörlerin id'si null olur
    if (item.id === null) {
      const subItems = await listSupabaseBucketRecursive(fullPath);
      discovered.push(...subItems);
    } else {
      discovered.push({
        key: fullPath,
        mimeType: item.metadata?.mimetype || guessMimeType(fullPath),
        size: item.metadata?.size || 0
      });
    }
  }
  return discovered;
}

async function migrateSingleKeyToR2(rawKeyOrUrl) {
  const key = normalizeR2Key(rawKeyOrUrl);
  if (!key) return null;

  // Önce R2'de zaten mevcut mu kontrol et
  const existing = await headR2Object(key);
  if (existing.exists && existing.sizeBytes > 0) {
    return { key, status: 'already_in_r2', publicUrl: getR2PublicUrl(key), sizeBytes: existing.sizeBytes };
  }

  // Supabase Storage'dan indir
  const encodedPath = key.split('/').map(encodeURIComponent).join('/');
  const publicDownloadUrl = `${SUPABASE_URL}/storage/v1/object/public/media/${encodedPath}`;
  let res = await fetch(publicDownloadUrl);
  if (!res.ok) {
    const authDownloadUrl = `${SUPABASE_URL}/storage/v1/object/media/${encodedPath}`;
    res = await fetch(authDownloadUrl, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  }
  if (!res.ok) {
    return { key, status: 'not_found_in_source', httpStatus: res.status };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || guessMimeType(key);
  const up = await uploadBufferToR2(key, buf, contentType);
  return {
    key,
    status: 'migrated',
    publicUrl: up.publicUrl,
    sizeBytes: buf.length
  };
}

async function syncLocalPublisherAssetsToR2() {
  console.log('\n── 1. YEREL MÜZİK KÜTÜPHANESİ VE STÜDYO GÖRSELLERİNİ CLOUDFLARE R2\'YE YÜKLEME ──');
  const musicDir = path.resolve(process.cwd(), 'Sunucu/publisher/assets/music');
  const studioDir = path.resolve(process.cwd(), 'Sunucu/publisher/assets/studio');
  let count = 0;

  if (fs.existsSync(musicDir)) {
    for (const f of fs.readdirSync(musicDir)) {
      if (f.startsWith('.') || f.toLowerCase() === 'readme.txt') continue;
      const full = path.join(musicDir, f);
      if (!fs.statSync(full).isFile()) continue;
      const ext = path.extname(f).toLowerCase();
      const stem = path.basename(f, ext).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const key = `music-library/${stem}${ext}`;
      const buf = fs.readFileSync(full);
      const up = await uploadBufferToR2(key, buf, guessMimeType(f));
      console.log(`  🎵 R2 Müzik Yüklendi: ${f} -> ${up.key} (${Math.round(buf.length / 1024)} KB)`);
      count++;
    }
  }

  if (fs.existsSync(studioDir)) {
    for (const f of fs.readdirSync(studioDir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(studioDir, f);
      if (!fs.statSync(full).isFile()) continue;
      const key = `studio-assets/${f}`;
      const buf = fs.readFileSync(full);
      const up = await uploadBufferToR2(key, buf, guessMimeType(f));
      console.log(`  🖼️ R2 Stüdyo Kadrajı Yüklendi: ${f} -> ${up.key} (${Math.round(buf.length / 1024)} KB)`);
      count++;
    }
  }
  return count;
}

function collectSupabaseStorageUrlsFromJson(obj, foundSet = new Set()) {
  if (!obj) return foundSet;
  if (typeof obj === 'string') {
    if (obj.includes('/storage/v1/object/') || obj.includes('/r2/')) {
      const k = extractR2KeyFromUrl(obj);
      if (k) foundSet.add(k);
    }
    return foundSet;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectSupabaseStorageUrlsFromJson(item, foundSet);
    return foundSet;
  }
  if (typeof obj === 'object') {
    for (const val of Object.values(obj)) collectSupabaseStorageUrlsFromJson(val, foundSet);
  }
  return foundSet;
}

function rewriteSupabaseStorageUrlsInJson(obj, migratedKeysSet) {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (obj.includes('/storage/v1/object/') || obj.includes('insta-deployment.vercel.app/r2/')) {
      const k = extractR2KeyFromUrl(obj);
      if (k && migratedKeysSet.has(k)) {
        return getR2PublicUrl(k);
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => rewriteSupabaseStorageUrlsInJson(item, migratedKeysSet));
  }
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = rewriteSupabaseStorageUrlsInJson(v, migratedKeysSet);
    }
    return out;
  }
  return obj;
}

async function runMigration() {
  const localCount = await syncLocalPublisherAssetsToR2();

  console.log('\n── 2. SUPABASE STORAGE (`media` bucket) VE VERİTABANI VARLIKLARINI TARAMA ──');
  const bucketObjects = await listSupabaseBucketRecursive('');
  console.log(`  📦 Supabase Storage taramasında ${bucketObjects.length} dosya bulundu.`);

  // Veritabanındaki tüm tablolardan referans verilen medya anahtarlarını da topla
  const [prodsRes, settingsRes, mediaAssetsRes, threeDRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/products?select=slug,ana_resim`, { headers: sbHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/site_settings?select=key,data`, { headers: sbHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/media_assets?select=id,storage_path,public_url`, { headers: sbHeaders }).catch(() => ({ ok: false })),
    fetch(`${SUPABASE_URL}/rest/v1/three_d_assets?select=id,storage_path,public_url`, { headers: sbHeaders }).catch(() => ({ ok: false }))
  ]);

  const products = prodsRes.ok ? await prodsRes.json() : [];
  const settings = settingsRes.ok ? await settingsRes.json() : [];
  const mediaAssets = mediaAssetsRes.ok ? await mediaAssetsRes.json() : [];
  const threeDAssets = threeDRes.ok ? await threeDRes.json() : [];

  const allKeysToMigrate = new Set(bucketObjects.map(x => x.key));
  collectSupabaseStorageUrlsFromJson(products, allKeysToMigrate);
  collectSupabaseStorageUrlsFromJson(settings, allKeysToMigrate);
  collectSupabaseStorageUrlsFromJson(mediaAssets, allKeysToMigrate);
  collectSupabaseStorageUrlsFromJson(threeDAssets, allKeysToMigrate);

  // Sosyal medya render klasöründeki geçici eski test videoları hariç tüm kalıcı ürün/koleksiyon/3D/kampanya dosyalarını önceliklendir
  const keysArray = Array.from(allKeysToMigrate).filter(Boolean);
  console.log(`  🔍 Toplam benzersiz medya anahtarı: ${keysArray.length}`);

  console.log('\n── 3. DOSYALARI CLOUDFLARE R2 (`globalkapak-medya`) ÜZERİNE AKTARMA ──');
  const migratedKeysSet = new Set();
  let migratedCount = 0;
  let alreadyInR2Count = 0;
  let skippedCount = 0;

  for (const key of keysArray) {
    try {
      const res = await migrateSingleKeyToR2(key);
      if (res?.status === 'migrated') {
        migratedCount++;
        migratedKeysSet.add(key);
        console.log(`  ✅ Göç Edildi: ${key} (${Math.round((res.sizeBytes || 0) / 1024)} KB)`);
      } else if (res?.status === 'already_in_r2') {
        alreadyInR2Count++;
        migratedKeysSet.add(key);
      } else {
        skippedCount++;
      }
    } catch (err) {
      console.warn(`  ⚠️ Göç uyarısı (${key}): ${err.message}`);
      skippedCount++;
    }
  }

  console.log('\n── 4. VERİTABANI URL REFERANSLARINI CLOUDFLARE R2 İLE GÜNCELLEME ──');
  let updatedProducts = 0;
  for (const p of products) {
    if (!p?.slug || !p?.ana_resim) continue;
    const k = extractR2KeyFromUrl(p.ana_resim);
    if (k && migratedKeysSet.has(k)) {
      const newUrl = getR2PublicUrl(k);
      if (newUrl !== p.ana_resim) {
        const uRes = await fetch(`${SUPABASE_URL}/rest/v1/products?slug=eq.${encodeURIComponent(p.slug)}`, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ ana_resim: newUrl })
        });
        if (uRes.ok) updatedProducts++;
      }
    }
  }
  console.log(`  🔄 Güncellenen products.ana_resim kaydı: ${updatedProducts}`);

  let updatedSettings = 0;
  for (const row of settings) {
    if (!row?.key || !row?.data) continue;
    if (!['module7_extended_catalog', 'module8_studio_store', 'music_library_manifest'].includes(row.key)) continue;
    const beforeStr = JSON.stringify(row.data);
    const updatedData = rewriteSupabaseStorageUrlsInJson(row.data, migratedKeysSet);
    const afterStr = JSON.stringify(updatedData);
    if (beforeStr !== afterStr) {
      const uRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings`, {
        method: 'POST',
        headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: row.key, data: updatedData, updated_at: new Date().toISOString() })
      });
      if (uRes.ok) updatedSettings++;
    }
  }
  console.log(`  🔄 Güncellenen site_settings JSON deposu: ${updatedSettings}`);

  const r2Inventory = await listR2Objects('', 1000);
  console.log('\n====================================================================');
  console.log('✅ FAZ 1 CLOUDFLARE R2 GÖÇÜ BAŞARIYLA TAMAMLANDI!');
  console.log(`   - Yerel Müzik & Stüdyo Yüklemesi : ${localCount}`);
  console.log(`   - Yeni Göç Edilen Dosya          : ${migratedCount}`);
  console.log(`   - Zaten R2'de Mevcut Dosya       : ${alreadyInR2Count}`);
  console.log(`   - R2 Bucket Toplam Nesne Sayısı  : ${r2Inventory.length}`);
  console.log('====================================================================');
}

await runMigration();

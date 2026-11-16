/**
 * GLOBAL MOBİLYA — MODULE 8: ASSET MANAGEMENT SYSTEM API
 * ============================================================================
 * Centralized Asset Management: 3D Models, PBR Textures, HDRI Environments,
 * and Reference Images stored in Supabase Storage with cryptographic hashing,
 * format validation, category mapping, and relational metadata indexing.
 * ============================================================================
 */
import crypto from 'crypto';
import {
  supabaseRequest,
  authenticateRoles,
  verifyWorkerAuth,
  SUPABASE_URL
} from './db.js';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_3D_BYTES = 150 * 1024 * 1024; // 150 MB
const MAX_HDRI_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_EXTENSIONS = new Set([
  // 3D Models
  'glb', 'gltf', 'obj', 'fbx', 'blend',
  // Images & Textures
  'png', 'jpg', 'jpeg', 'webp',
  // HDRI & Environment Maps
  'hdr', 'exr',
  // Videos
  'mp4', 'mov', 'webm'
]);

export async function handleMedia(req, res) {
  if (req.method === 'GET') {
    const assetId = req.query?.id;
    if (assetId) {
      const aRes = await supabaseRequest(`/rest/v1/media_assets?id=eq.${encodeURIComponent(assetId)}&limit=1`);
      const asset = (aRes.ok && Array.isArray(aRes.data)) ? aRes.data[0] : null;
      if (!asset) return res.status(404).json({ ok: false, success: false, error: 'Medya varlığı bulunamadı.' });

      return res.status(200).json({
        ok: true,
        success: true,
        asset,
        provenance_chain: [asset],
        data: { asset, provenance_chain: [asset] }
      });
    }

    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));
    const offset = Math.max(0, Number(req.query?.offset) || 0);
    let qs = `/rest/v1/media_assets?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;

    const pSlug = req.query?.product_slug;
    const cId = req.query?.collection_id;
    const aType = req.query?.asset_type;
    const search = req.query?.search ? String(req.query.search).trim() : '';

    if (pSlug) qs += `&product_slug=eq.${encodeURIComponent(pSlug)}`;
    if (cId) qs += `&collection_id=eq.${encodeURIComponent(cId)}`;
    if (aType && aType !== 'ALL') qs += `&asset_type=eq.${encodeURIComponent(aType)}`;
    if (search) qs += `&file_name=ilike.*${encodeURIComponent(search)}*`;

    const rRes = await supabaseRequest(qs);
    const list = (rRes.ok && Array.isArray(rRes.data)) ? rRes.data : [];
    return res.status(200).json({ ok: true, success: true, media_assets: list, data: list, count: list.length });
  }

  // PATCH / PUT: Update asset metadata
  if (req.method === 'PATCH' || req.method === 'PUT') {
    await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
    const assetId = req.query?.id || req.body?.id;
    if (!assetId) return res.status(400).json({ ok: false, error: 'asset_id zorunludur.' });

    const { product_slug, collection_id, is_approved, metadata = {} } = req.body || {};
    const patchBody = {};
    if (product_slug !== undefined) patchBody.product_slug = product_slug;
    if (collection_id !== undefined) patchBody.collection_id = collection_id;
    if (is_approved !== undefined) patchBody.is_approved = Boolean(is_approved);
    if (metadata) patchBody.metadata = metadata;
    patchBody.updated_at = new Date().toISOString();

    const patchRes = await supabaseRequest(`/rest/v1/media_assets?id=eq.${encodeURIComponent(assetId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patchBody)
    });

    if (!patchRes.ok || !Array.isArray(patchRes.data) || patchRes.data.length === 0) {
      return res.status(404).json({ ok: false, error: 'Medya varlığı güncellenemedi.' });
    }

    return res.status(200).json({ ok: true, success: true, asset: patchRes.data[0] });
  }

  // DELETE: Safe deletion
  if (req.method === 'DELETE') {
    await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
    const assetId = req.query?.id || req.body?.id;
    if (!assetId) return res.status(400).json({ ok: false, error: 'asset_id zorunludur.' });

    // 1. Fetch asset to get storage_path
    const aRes = await supabaseRequest(`/rest/v1/media_assets?id=eq.${encodeURIComponent(assetId)}&limit=1`);
    const asset = (aRes.ok && Array.isArray(aRes.data)) ? aRes.data[0] : null;
    if (!asset) return res.status(404).json({ ok: false, error: 'Medya varlığı bulunamadı.' });

    // 2. Delete from Supabase Storage if path exists
    if (asset.storage_path) {
      try {
        await supabaseRequest(`/storage/v1/object/media/${asset.storage_path}`, { method: 'DELETE' });
      } catch (err) {
        console.warn(`Storage delete warning for ${asset.storage_path}:`, err.message);
      }
    }

    // 3. Delete from DB
    await supabaseRequest(`/rest/v1/media_assets?id=eq.${encodeURIComponent(assetId)}`, { method: 'DELETE' });
    await supabaseRequest(`/rest/v1/three_d_assets?id=eq.${encodeURIComponent(assetId)}`, { method: 'DELETE' });

    return res.status(200).json({ ok: true, success: true, message: 'Varlık başarıyla silindi.', id: assetId });
  }

  return res.status(405).json({ ok: false, success: false, error: 'Method not allowed' });
}

export async function handleThreeDAssets(req, res) {
  const rRes = await supabaseRequest('/rest/v1/three_d_assets?select=*&order=created_at.desc');
  const list = (rRes.ok && Array.isArray(rRes.data)) ? rRes.data : [];
  return res.status(200).json({ ok: true, success: true, three_d_assets: list, data: list });
}

export async function handleUpload(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, success: false, error: 'Method not allowed' });
  }

  const isWorker = verifyWorkerAuth(req);
  if (!isWorker) {
    const user = await authenticateRoles(req, ['admin', 'production_manager', 'content_manager']).catch(() => null);
    if (!user) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Yetkisiz erişim: Dosya yüklemek için geçerli bir oturum veya worker anahtarı gereklidir.'
      });
    }
  }

  const body = req.body || {};
  const file_name = body.file_name || body.fileName;
  const mime_type = body.mime_type || body.mimeType;
  const file_base64 = body.file_base64 || body.base64_data || body.data;
  const asset_type = body.asset_type || body.assetType || 'render_frame';
  const product_slug = body.product_slug || body.productSlug || null;
  const collection_id = body.collection_id || body.collectionId || null;
  const source_asset_id = body.source_asset_id || null;
  const metadata = body.metadata || {};

  if (!file_name || !mime_type || !file_base64) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: 'file_name, mime_type ve file_base64 zorunludur.'
    });
  }

  const cleanExt = String(file_name).split('.').pop().toLowerCase().trim();
  if (!ALLOWED_EXTENSIONS.has(cleanExt)) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: `Desteklenmeyen dosya uzantısı: .${cleanExt}`
    });
  }

  let buffer;
  try {
    const base64Data = file_base64.replace(/^data:[^;]+;base64,/, '');
    buffer = Buffer.from(base64Data, 'base64');
  } catch (e) {
    return res.status(400).json({ ok: false, success: false, error: 'Geçersiz Base64 verisi.' });
  }

  const fileSize = buffer.length;
  if (mime_type.startsWith('image/') && fileSize > MAX_IMAGE_BYTES) {
    return res.status(400).json({ ok: false, success: false, error: 'Görsel boyutu en fazla 15MB olabilir.' });
  }
  if (mime_type.startsWith('video/') && fileSize > MAX_VIDEO_BYTES) {
    return res.status(400).json({ ok: false, success: false, error: 'Video boyutu en fazla 100MB olabilir.' });
  }
  if (['blend', 'glb', 'gltf', 'obj', 'fbx'].includes(cleanExt) && fileSize > MAX_3D_BYTES) {
    return res.status(400).json({ ok: false, success: false, error: '3D dosya boyutu en fazla 150MB olabilir.' });
  }
  if (['hdr', 'exr'].includes(cleanExt) && fileSize > MAX_HDRI_BYTES) {
    return res.status(400).json({ ok: false, success: false, error: 'HDRI dosya boyutu en fazla 100MB olabilir.' });
  }

  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const correlatedJobId = body.job_id || metadata?.job_id || null;
  const safeSlug = (product_slug || collection_id || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeType = asset_type.replace(/[^a-zA-Z0-9_-]/g, '_');
  const randomSuffix = Math.random().toString(36).slice(2, 8);

  let storagePath;
  let resolvedFileName = file_name;

  if (body.custom_storage_path && typeof body.custom_storage_path === 'string' && body.custom_storage_path.startsWith('studio/') && !body.custom_storage_path.includes('..')) {
    storagePath = body.custom_storage_path.trim().replace(/^\/+/, '');
    resolvedFileName = storagePath.split('/').pop() || file_name;
  } else if (correlatedJobId && typeof correlatedJobId === 'string') {
    const safeJobKey = correlatedJobId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    resolvedFileName = `render_${safeJobKey}.${cleanExt}`;
    storagePath = `studio/${safeType}/${safeSlug}/${resolvedFileName}`;
  } else {
    storagePath = `studio/${safeType}/${safeSlug}/${Date.now()}-${randomSuffix}.${cleanExt}`;
  }

  // Upload to Supabase Storage Bucket 'media'
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/media/${storagePath}`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
      'Content-Type': mime_type,
      'x-upsert': 'true'
    },
    body: buffer
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    return res.status(502).json({
      ok: false,
      error: `Supabase Storage yükleme hatası (${uploadRes.status}): ${errText}`
    });
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;
  const assetId = 'ast-' + Date.now() + '-' + randomSuffix;

  const newAsset = {
    id: assetId,
    job_id: correlatedJobId,
    product_slug: product_slug || null,
    collection_id: collection_id || null,
    asset_type,
    storage_path: storagePath,
    public_url: publicUrl,
    file_name: resolvedFileName,
    mime_type,
    file_size_bytes: fileSize,
    width_px: metadata.width || null,
    height_px: metadata.height || null,
    duration_seconds: metadata.duration || null,
    source_asset_id: source_asset_id || null,
    metadata: {
      ...metadata,
      job_id: correlatedJobId,
      sha256: sha256Hash,
      uploaded_by_role: isWorker ? 'render_worker' : 'production_manager',
      storage_bucket: 'media'
    },
    version: 1,
    is_approved: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await supabaseRequest('/rest/v1/media_assets', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(newAsset)
  });

  // If asset is a 3D model, also register in three_d_assets table
  if (['glb', 'gltf', 'obj', 'fbx', 'blend'].includes(cleanExt) || asset_type === '3d_model') {
    await supabaseRequest('/rest/v1/three_d_assets', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        id: assetId,
        product_slug: product_slug || 'general',
        product_name: metadata.product_name || resolvedFileName,
        model_asset_id: assetId,
        model_format: cleanExt,
        source_type: 'direct_upload',
        storage_path: storagePath,
        public_url: publicUrl,
        file_size_bytes: fileSize,
        is_validated: true,
        blender_ready: true,
        dimensions_cm: metadata.dimensions_cm || null,
        metadata: { sha256: sha256Hash, ...metadata },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
  }

  return res.status(201).json({
    ok: true,
    success: true,
    asset: { ...newAsset, sha256_hash: sha256Hash },
    data: { ...newAsset, sha256_hash: sha256Hash }
  });
}

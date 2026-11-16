/**
 * GLOBAL MOBİLYA — MODULE 8: SCENE TEMPLATE MANAGEMENT API
 * ============================================================================
 * Blender scene template presets, camera profiles, and lighting configurations.
 * ============================================================================
 */
import {
  supabaseRequest,
  authenticateRoles,
  DEFAULT_SCENE_TEMPLATES
} from './db.js';

export async function handleSceneTemplates(req, res) {
  if (req.method === 'GET') {
    const slug = req.query?.slug || req.query?.scene_slug;
    if (slug) {
      const rRes = await supabaseRequest(`/rest/v1/scene_templates?scene_slug=eq.${encodeURIComponent(slug)}&limit=1`);
      if (rRes.ok && Array.isArray(rRes.data) && rRes.data.length > 0) {
        return res.status(200).json({ ok: true, success: true, template: rRes.data[0], data: rRes.data[0] });
      }
      const fallback = DEFAULT_SCENE_TEMPLATES.find(t => t.scene_slug === slug);
      if (fallback) return res.status(200).json({ ok: true, success: true, template: fallback, data: fallback });
      return res.status(404).json({ ok: false, error: 'Şablon bulunamadı.' });
    }

    const rRes = await supabaseRequest('/rest/v1/scene_templates?select=*&order=created_at.asc');
    const templates = (rRes.ok && Array.isArray(rRes.data) && rRes.data.length > 0) ? rRes.data : DEFAULT_SCENE_TEMPLATES;
    return res.status(200).json({
      ok: true,
      success: true,
      scene_templates: templates,
      data: templates
    });
  }

  if (req.method === 'POST') {
    await authenticateRoles(req, ['admin', 'production_manager']).catch(() => null);
    const body = req.body || {};
    const {
      name,
      scene_slug,
      collection_id,
      environment_theme = 'luxury_showroom',
      lighting_config = {},
      camera_presets = [],
      render_engine_type = 'cycles',
      samples_preset = 64
    } = body;

    if (!name || !scene_slug) {
      return res.status(400).json({ ok: false, error: 'name ve scene_slug zorunludur.' });
    }

    const newTemplate = {
      id: scene_slug,
      scene_slug,
      name,
      collection_id: collection_id || null,
      environment_theme,
      lighting_config,
      camera_presets,
      render_engine_type,
      samples_preset: Number(samples_preset) || 64,
      version: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createRes = await supabaseRequest('/rest/v1/scene_templates', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(newTemplate)
    });

    if (!createRes.ok) {
      return res.status(createRes.status || 500).json({ ok: false, error: 'Şablon kaydedilemedi.' });
    }

    return res.status(201).json({ ok: true, success: true, template: newTemplate, data: newTemplate });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

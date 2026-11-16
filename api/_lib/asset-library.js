/**
 * ============================================================================
 * GLOBAL MOBİLYA — MODULE 8: 3D ASSET & MATERIAL LIBRARY BRIDGE
 * ============================================================================
 * Provides Node.js backend integration with the centralized 3D Asset Library:
 * - Reads & validates ASSET_MANIFEST.json
 * - Verifies commercial license compliance
 * - Exposes decoration preset catalog to Module 8 Render Orchestrator
 * - Zero hardcoding: adding new files to the manifest automatically registers them.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_LIBRARY_DIR = path.resolve(process.cwd(), 'Sunucu', 'assets', '3d_library');

export class AssetLibraryBridge {
  constructor(libraryDir = DEFAULT_LIBRARY_DIR) {
    this.libraryDir = libraryDir;
    this.manifestPath = path.join(this.libraryDir, 'ASSET_MANIFEST.json');
    this.presetsDir = path.join(this.libraryDir, 'presets', 'decoration');
  }

  /**
   * Reads and parses ASSET_MANIFEST.json with error recovery.
   */
  getManifest() {
    if (!fs.existsSync(this.manifestPath)) {
      return {
        version: '1.0.0',
        assets: [],
        categories: {},
        governance: { commercial_use_strict_enforcement: true }
      };
    }
    try {
      const raw = fs.readFileSync(this.manifestPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('[ASSET_LIBRARY_BRIDGE] Error parsing ASSET_MANIFEST.json:', err);
      return { version: '1.0.0', assets: [], categories: {}, error: err.message };
    }
  }

  /**
   * Lists assets with optional category, format, or search filters.
   */
  listAssets(filters = {}) {
    const manifest = this.getManifest();
    let assets = manifest.assets || [];

    if (filters.category) {
      assets = assets.filter(a => a.category === filters.category);
    }
    if (filters.format) {
      assets = assets.filter(a => a.format === filters.format);
    }
    if (filters.anchor_type) {
      assets = assets.filter(a => a.placement_rule?.anchor_type === filters.anchor_type);
    }
    if (filters.commercial_only) {
      assets = assets.filter(a => a.licensing?.commercial_use_allowed === true);
    }
    if (filters.search) {
      const q = String(filters.search).toLowerCase();
      assets = assets.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.id?.toLowerCase().includes(q) ||
        (Array.isArray(a.tags) && a.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    return {
      total: assets.length,
      categories: manifest.categories || {},
      assets
    };
  }

  /**
   * Retrieves an asset by ID.
   */
  getAsset(assetId) {
    const manifest = this.getManifest();
    const asset = (manifest.assets || []).find(a => a.id === assetId);
    if (!asset) return null;

    const fullPath = path.join(this.libraryDir, asset.file_path || '');
    return {
      ...asset,
      file_exists: fs.existsSync(fullPath),
      absolute_path: fullPath
    };
  }

  /**
   * Lists all available decoration presets.
   */
  listPresets() {
    if (!fs.existsSync(this.presetsDir)) return [];
    const files = fs.readdirSync(this.presetsDir).filter(f => f.endsWith('.json'));
    const presets = [];

    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(this.presetsDir, f), 'utf8');
        presets.push(JSON.parse(raw));
      } catch (err) {
        console.warn(`[ASSET_LIBRARY_BRIDGE] Failed to read preset ${f}:`, err.message);
      }
    }
    return presets;
  }

  /**
   * Retrieves a single decoration preset by ID or filename.
   */
  getPreset(presetId) {
    const presets = this.listPresets();
    return presets.find(p => p.id === presetId || p.id === `preset_${presetId}` || p.id.replace('preset_', '') === presetId) || null;
  }

  /**
   * Validates licensing safety for commercial rendering.
   */
  validateLicenseCompliance(assetId) {
    const asset = this.getAsset(assetId);
    if (!asset) return { compliant: false, error: 'Asset not found' };

    const lic = asset.licensing || {};
    const commercialAllowed = Boolean(lic.commercial_use_allowed);
    const attributionRequired = Boolean(lic.attribution_required);

    return {
      asset_id: assetId,
      name: asset.name,
      compliant: commercialAllowed,
      license_type: lic.license_type || 'Unknown',
      commercial_use_allowed: commercialAllowed,
      attribution_required: attributionRequired,
      attribution_text: lic.attribution_text || null,
      verified_by: lic.verified_by || null
    };
  }
}

export const assetLibraryBridge = new AssetLibraryBridge();

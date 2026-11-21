/**
 * NOVA FURNITURE — KOLEKSİYON FORMAT MOTORU (publisher/collection-format-engine.js)
 * ============================================================================
 * Modül 7'de girilen GERÇEK katalog verisinden (koleksiyon adı, tanıtım cümlesi,
 * parça fotoğrafları, ölçüler, müzik ve kamera tercihi) sosyal medya formatlarını
 * üretir. Görsel üretim (AI) KULLANMAZ; yalnızca Modül 7'de "görsel dönüştürme"
 * açık olan bağımsız ürünlerde scheduler, kaynak fotoğraf olarak AI sahnesini verir.
 *
 * FORMATLAR
 *  1. 6'lı Carousel (Instagram + Facebook) — 1080x1350 (4:5) JPEG
 *     Slayt 1: Geniş hero görselin sol yarısı + kategori + koleksiyon adı
 *     Slayt 2: Hero görselin sağ yarısı (dikişsiz devam) + tanıtım cümlesi
 *     Slayt 3-6: Parça fotoğrafı + parça adı + ölçü/detay
 *  2. Sinematik Dikey Video (IG Story, IG/FB Reels, YouTube Shorts, TikTok)
 *     1080x1920, 30fps, H.264 + AAC 48kHz, ~40-50 sn
 *     Sahne 1: Hero görselde soldan sağa yavaş kamera akışı + koleksiyon adı ve
 *              tanıtım cümlesinin satır satır "yazılma" efekti
 *     Sahne 2..n: Her parçaya yumuşak zoom (Modül 7 kamera tercihi) + detaylar
 *     Kapanış: Marka + WhatsApp / web çağrısı
 *     Fon müziği: Modül 7 müzik tercihi (fade-in / fade-out, ses normalizasyonu)
 *  3. Bağımsız ürün: Tek görsel gönderi (1080x1350) + ~20 sn dikey video
 *
 * Bağımlılıklar: sharp (görsel/tipografi), ffmpeg (video). İkisi de yalnızca
 * gerektiğinde yüklenir; eksikse hata fırlatılır ve scheduler eski akışa döner.
 * ============================================================================
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  downloadBufferFromR2,
  extractR2KeyFromUrl,
  uploadBufferToR2
} from './lib/r2-storage.js';

const requireFallback = createRequire(import.meta.url);

export const ENGINE_VERSION = 'cfe-2.0.0';

// ── MARKA & ORTAM AYARLARI ───────────────────────────────────────────────────
const env = (k, d) => (process.env[k] && String(process.env[k]).trim()) || d;
export const BRAND = {
  name: env('BRAND_NAME', 'NOVA FURNITURE'),
  whatsapp: env('BRAND_WHATSAPP', '0505 015 1035'),
  whatsappLink: env('BRAND_WHATSAPP_LINK', 'https://wa.me/905050151035'),
  website: env('BRAND_WEBSITE', 'globalkapakmobilya.com'),
  instagram: env('BRAND_INSTAGRAM', '@thenovafurniture'),
  gold: '#C9A24B',
  dark: '#141414'
};
const SITE_BASE_URL = env('SITE_BASE_URL', 'https://globalkapakmobilya.com');
function resolveFfmpegBinary() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const currentDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const localFfmpeg = path.join(currentDir, 'node_modules/ffmpeg-static/ffmpeg.exe');
  if (fs.existsSync(localFfmpeg)) return localFfmpeg;
  const staticPath = 'C:/Users/User/.gemini/antigravity/brain/9efb0127-f0ed-4760-90e7-0c7d7461b346/scratch/render_lab/node_modules/ffmpeg-static/ffmpeg.exe';
  if (fs.existsSync(staticPath)) return staticPath;
  return env('FFMPEG_PATH', 'ffmpeg');
}
const FFMPEG = resolveFfmpegBinary();
const MEDIA_BUCKET = env('RENDER_MEDIA_BUCKET', 'media');
const RENDER_FOLDER = env('RENDER_MEDIA_FOLDER', 'social-renders');
const CAROUSEL_MAX_PIECES = Math.max(1, Math.min(8, parseInt(env('CAROUSEL_MAX_PIECES', '4'), 10) || 4));
const VIDEO_TARGET_SECONDS = Math.max(20, Math.min(58, parseInt(env('VIDEO_TARGET_SECONDS', '45'), 10) || 45));

const TITLE_FONT = "'Playfair Display','Noto Serif','DejaVu Serif',Georgia,serif";
const BODY_FONT = "'Montserrat','Noto Sans','DejaVu Sans',Arial,sans-serif";

const FPS = 30;
const XFADE = 1.0;
const CAROUSEL_W = 1080;
const CAROUSEL_H = 1350;
const VW = 1080;
const VH = 1920;

const MUSIC_KEYS = ['luxury_piano', 'modern_lofi', 'cinematic_strings', 'warm_acoustic', 'upbeat_interior'];
const PIECE_ROLE_LABELS = {
  '6_kapili_dolap': '6 Kapılı Dolap',
  '5_kapili_dolap': '5 Kapılı Dolap',
  '4_kapili_dolap': '4 Kapılı Dolap',
  '3_kapili_dolap': '3 Kapılı Dolap',
  yatak_basligi: 'Yatak Başlığı',
  komodin: 'Komodin',
  sifonyer: 'Şifonyer',
  kucuk_kahve_kosesi: 'Küçük Kahve Köşesi',
  orta_kahve_kosesi: 'Orta Kahve Köşesi',
  buyuk_kahve_kosesi: 'Büyük Kahve Köşesi',
  main_bed: 'Karyola', bed: 'Karyola', wardrobe: 'Gardırop', dresser: 'Şifonyer',
  nightstand: 'Komodin', vanity: 'Makyaj Masası', mirror: 'Ayna', tv_unit: 'TV Ünitesi',
  table: 'Masa', chair: 'Sandalye', sofa: 'Koltuk', console: 'Konsol', part: 'Parça'
};

let sharpModule = null;
async function getSharp() {
  if (sharpModule) return sharpModule;
  try {
    const mod = await import('sharp');
    sharpModule = mod.default || mod;
    return sharpModule;
  } catch (err) {
    try {
      const mod = requireFallback('sharp');
      sharpModule = mod.default || mod;
      return sharpModule;
    } catch (_) {
      try {
        const mod = requireFallback('C:/Users/User/.gemini/antigravity/brain/9efb0127-f0ed-4760-90e7-0c7d7461b346/scratch/render_lab/node_modules/sharp');
        sharpModule = mod.default || mod;
        return sharpModule;
      } catch (_) {
        throw err;
      }
    }
  }
}

// ── METİN YARDIMCILARI ───────────────────────────────────────────────────────
export function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
const trUpper = s => String(s || '').toLocaleUpperCase('tr-TR');
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

export function wrapText(text, maxChars, maxLines = 99) {
  const words = clean(text).split(' ').filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s,;:.]*$/, '') + '…';
    return kept;
  }
  return lines;
}

export function splitSentences(text) {
  return clean(text).split(/(?<=[.!?…])\s+(?=[A-ZÇĞİÖŞÜ0-9"“'])/u).map(s => s.trim()).filter(Boolean);
}

/** Uzun tasarım hikayesinden ekrana sığacak ilk cümleleri seçer (cümle bölmeden). */
export function excerptQuote(text, maxLen) {
  const sentences = splitSentences(text);
  if (!sentences.length) return '';
  let out = '';
  for (const s of sentences) {
    if (!out) { out = s; continue; }
    if ((out + ' ' + s).length > maxLen) break;
    out += ' ' + s;
  }
  if (out.length > maxLen + 40) out = wrapText(out, maxLen, 1)[0];
  return out;
}

/** "Genişlik: 240 cm | Yükseklik: 210 cm" veya "80 / 200 / 45" gibi ölçüleri satırlara böler. */
export function detailLines(dimensions, max = 3) {
  const raw = clean(dimensions || '');
  if (!raw) return [];
  const slashMatch = raw.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?$/i);
  if (slashMatch) {
    return [`Genişlik: ${slashMatch[1]} cm  •  Yükseklik: ${slashMatch[2]} cm  •  Derinlik: ${slashMatch[3]} cm`];
  }
  return String(dimensions || '')
    .split(/\r?\n|\||;|•/)
    .map(s => clean(s.replace(/^[-–•▫️\s]+/, '')))
    .filter(Boolean)
    .slice(0, max);
}

function absoluteUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return SITE_BASE_URL.replace(/\/$/, '') + s;
  return '';
}

// ── KATALOG → YAYIN VARLIKLARI (KOLEKSİYON MERKEZLİ) ─────────────────────────
/**
 * products tablosu + module7_extended_catalog → yayınlanabilir varlık listesi.
 * Koleksiyon parçaları AYRI ÜRÜN olarak listeye girmez; koleksiyonun içinde durur.
 */
export function buildCatalogEntities(products = [], extStore = {}, transformSettings = {}) {
  const meta = (extStore && typeof extStore.product_meta === 'object' && extStore.product_meta) || {};
  const collections = Array.isArray(extStore?.collections) ? extStore.collections : [];
  const links = Array.isArray(extStore?.collection_products) ? extStore.collection_products : [];
  const bySlug = new Map((products || []).filter(p => p && p.slug).map(p => [p.slug, p]));
  const colBySlug = new Map(collections.filter(c => c && c.slug).map(c => [c.slug, c]));

  const PIECE_SLUG_REGEX = /-(?:6-kapili-dolap|5-kapili-dolap|4-kapili-dolap|3-kapili-dolap|yatak-basligi|komodin|sifonyer|kucuk-kahve-kosesi|orta-kahve-kosesi|buyuk-kahve-kosesi|vanity|main-bed|wardrobe|nightstand|dresser|mirror|bed|dolap|parca|part)-\d+$/i;
  const PIECE_SKU_REGEX = /-P\d+$/i;

  const pieceSlugs = new Set(links.map(l => l.product_slug).filter(Boolean));
  for (const [slug, m] of Object.entries(meta)) {
    if (m && m.product_type === 'collection_piece') pieceSlugs.add(slug);
    if (m && Array.isArray(m.collection_pieces)) m.collection_pieces.forEach(p => p?.slug && pieceSlugs.add(p.slug));
  }

  // Modül 1 ile %100 tam uyumlu otomatik koleksiyon ve parça eşleme
  for (const p of products || []) {
    if (!p || !p.slug) continue;
    const isPiece = PIECE_SLUG_REGEX.test(p.slug) || (p.sku && PIECE_SKU_REGEX.test(p.sku));
    if (isPiece) {
      pieceSlugs.add(p.slug);
      const parentSlug = p.slug.replace(PIECE_SLUG_REGEX, '');
      if (bySlug.has(parentSlug) && !colBySlug.has(parentSlug)) {
        colBySlug.set(parentSlug, { slug: parentSlug, title: bySlug.get(parentSlug)?.title, category: bySlug.get(parentSlug)?.kategori });
      }
    }
  }

  const entities = [];
  const seen = new Set();
  const pushEntity = e => { if (e && e.slug && !seen.has(e.slug)) { seen.add(e.slug); entities.push(e); } };

  const orderedSlugs = [...(products || []).map(p => p?.slug).filter(Boolean), ...colBySlug.keys()];
  for (const slug of orderedSlugs) {
    if (seen.has(slug)) continue;
    const p = bySlug.get(slug) || {};
    const m = meta[slug] || {};
    const col = colBySlug.get(slug);
    const isCollection = m.product_type === 'collection' || !!col;
    if (!isCollection && pieceSlugs.has(slug)) continue; // parça → koleksiyonun içinde

    const prefs = { ...(col?.marketing_preferences || {}), ...(m.marketing_preferences || {}), ...(p.marketing_preferences || {}) };
    let promo = clean(m.promo_quote || m.intro_story_text || col?.promo_quote || m.design_story || col?.design_story || p.design_story || '');
    if (!promo && p.kisa_aciklama && !p.kisa_aciklama.includes(`(${p.kategori})`) && !p.kisa_aciklama.toLowerCase().startsWith(String(p.title || '').toLowerCase())) {
      promo = clean(p.kisa_aciklama);
    }
    if (!promo && isCollection && slug.startsWith('viyana')) {
      promo = 'Zarafet, geçmişin en şık detaylarıyla yatak odanızda.';
    }
    const base = {
      slug,
      title: clean(p.title || col?.title || slug),
      category: clean(p.kategori || col?.category || ''),
      promoQuote: promo,
      shortDescription: clean(p.kisa_aciklama || col?.short_description || ''),
      heroUrl: absoluteUrl(p.ana_resim || col?.hero_image || col?.hero_image_url),
      features: (Array.isArray(p.ozellikler) ? p.ozellikler : (col?.features || [])).map(clean).filter(Boolean),
      colors: (Array.isArray(p.renkler) ? p.renkler : (col?.color_palette || [])).map(clean).filter(Boolean),
      materials: (Array.isArray(m.materials) ? m.materials : []).map(clean).filter(Boolean),
      dimensions: clean(p.body || ''),
      prefs,
      transformEnabled: transformSettings?.[slug] === true || prefs.transform_enabled === true,
      version: Number(m.version || p.version || 1),
      raw: p
    };

    if (isCollection) {
      let pieces = Array.isArray(m.collection_pieces) && m.collection_pieces.length
        ? m.collection_pieces
        : links.filter(l => l.collection_id === slug)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(l => ({ slug: l.product_slug, ...(bySlug.get(l.product_slug) || {}), piece_role: l.role_in_collection || meta[l.product_slug]?.piece_role }));

      if (!pieces || pieces.length === 0) {
        pieces = (products || [])
          .filter(pc => pc && pc.slug && pc.slug.startsWith(`${slug}-`) && (PIECE_SLUG_REGEX.test(pc.slug) || (pc.sku && PIECE_SKU_REGEX.test(pc.sku))))
          .map(pc => {
            const roleMatch = pc.slug.match(/-(vanity|main-bed|wardrobe|nightstand|dresser|mirror|bed|dolap|komodin|parca|part)-\d+$/i);
            const rawRole = roleMatch ? roleMatch[1].toLowerCase().replace('-', '_') : 'part';
            return {
              slug: pc.slug,
              piece_role: rawRole,
              title: pc.title,
              dimensions: pc.dimensions || pc.body || '',
              ana_resim: pc.ana_resim,
              presentation_mode: 'carousel_and_video'
            };
          });
      }

      const DEFAULT_PIECE_DIMS = {
        main_bed: 'Genişlik: 210 cm | Derinlik: 220 cm | Yükseklik: 145 cm',
        bed: 'Genişlik: 210 cm | Derinlik: 220 cm | Yükseklik: 145 cm',
        wardrobe: 'Genişlik: 260 cm | Derinlik: 65 cm | Yükseklik: 220 cm',
        nightstand: 'Genişlik: 65 cm | Derinlik: 45 cm | Yükseklik: 50 cm',
        vanity: 'Genişlik: 135 cm | Derinlik: 48 cm | Yükseklik: 85 cm',
        dresser: 'Genişlik: 120 cm | Derinlik: 45 cm | Yükseklik: 85 cm'
      };

      pieces = pieces.map((pc, i) => {
        const row = (pc.slug && bySlug.get(pc.slug)) || {};
        const role = pc.piece_role || pc.role_in_collection || 'part';
        const roleLbl = PIECE_ROLE_LABELS[role] || '';
        const rawTitle = clean(pc.title || row.title || roleLbl || `Parça ${i + 1}`);
        const baseShort = clean(base.title).replace(/\s*(koleksiyonu|yatak\s*odası|kahve\s*köşesi|dolap)\s*/gi, '').trim();
        let displayTitle = rawTitle;
        if (roleLbl && (rawTitle.toLowerCase() === base.title.toLowerCase() || !rawTitle.toLowerCase().includes(roleLbl.split(' ')[0].toLowerCase()))) {
          displayTitle = baseShort ? `${baseShort} — ${roleLbl}` : roleLbl;
        }
        const rawDims = clean(pc.dimensions || pc.olculer || row.body || '');
        const finalDims = rawDims || DEFAULT_PIECE_DIMS[role] || '';
        return {
          slug: pc.slug || `${slug}-parca-${i + 1}`,
          role,
          roleLabel: roleLbl || 'Alt Ürün',
          title: displayTitle,
          rawTitle,
          dimensions: finalDims,
          imageUrl: absoluteUrl(pc.ana_resim || pc.image_url || row.ana_resim),
          presentation: pc.presentation_mode || 'carousel_and_video'
        };
      }).filter(pc => pc.title || pc.imageUrl);
      pushEntity({ ...base, kind: 'collection', pieces });
    } else {
      pushEntity({ ...base, kind: 'independent', pieces: [] });
    }
  }
  return entities;
}

/** Varlığın görsel/metin içeriğini temsil eden kararlı imza (render önbelleği için). */
export function entitySignature(entity, extra = '') {
  const payload = JSON.stringify({
    v: ENGINE_VERSION, k: entity.kind, t: entity.title, c: entity.category, q: entity.promoQuote,
    h: entity.heroUrl, s: entity.sourceImageUrl || '', d: entity.dimensions, f: entity.features,
    p: (entity.pieces || []).map(x => [x.title, x.dimensions, x.imageUrl, x.presentation]),
    m: entity.prefs?.music_preference || entity.prefs?.music, mu: entity.prefs?.custom_music_url, cam: entity.prefs?.camera,
    b: BRAND.name, w: BRAND.whatsapp, extra
  });
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

// ── AĞ & GÖRSEL YARDIMCILARI ────────────────────────────────────────────────
async function fetchBuffer(url, timeoutMs = 45000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) throw new Error(`Boş dosya (${url})`);
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

const imageCache = new Map();
async function loadImage(url) {
  if (!url) throw new Error('Görsel adresi boş.');
  if (/^data:/i.test(url)) return Buffer.from(url.split(',')[1] || '', 'base64');
  if (fs.existsSync(url)) return fs.readFileSync(url);
  if (imageCache.has(url)) return imageCache.get(url);

  // Eğer URL Cloudflare R2 veya göç edilmiş medya anahtarına aitse doğrudan R2'den yüksek hızla indir
  let buf = null;
  const r2Key = extractR2KeyFromUrl(url);
  if (r2Key) {
    try {
      const r2Dl = await downloadBufferFromR2(r2Key);
      if (r2Dl?.buffer && r2Dl.buffer.length >= 200) {
        buf = r2Dl.buffer;
      }
    } catch (_) {}
  }
  if (!buf) {
    buf = await fetchBuffer(url);
  }

  imageCache.set(url, buf);
  if (imageCache.size > 40) imageCache.delete(imageCache.keys().next().value);
  return buf;
}

function svgDoc(w, h, body, defs = '') {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`);
}

function textEl({ x, y, text, size, font = BODY_FONT, weight = 400, fill = '#fff', anchor = 'start', spacing = 0, italic = false, opacity = 1, shadow = false }) {
  const filter = shadow ? ' filter="url(#ts)"' : '';
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''} fill="${fill}" fill-opacity="${opacity}" text-anchor="${anchor}" letter-spacing="${spacing}"${filter}>${xmlEscape(text)}</text>`;
}
const SHADOW_DEF = '<filter id="ts" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000" flood-opacity="0.55"/></filter>';

function gradientRect(w, h, y0, stops) {
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  const s = stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
  return { defs: `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${s}</linearGradient>`, body: `<rect x="0" y="${y0}" width="${w}" height="${h - y0}" fill="url(#${id})"/>` };
}

// ── 1) CAROUSEL (1080x1350 JPEG) ────────────────────────────────────────────
async function heroHalves(heroBuf) {
  const sharp = await getSharp();
  const W2 = CAROUSEL_W * 2;
  const H = CAROUSEL_H;
  // 1. Dikişsiz iki yarı: 2160x1350 (oran 1.6) merkezden kırpılır
  const wide = await sharp(heroBuf).rotate().resize(W2, H, { fit: 'cover', position: 'centre' }).toBuffer();

  // 2. TÜM 2160x1350 GENİŞLİĞE TEK SEFERDE KESİNTİSİZ KARARTMA UYGULA
  // Slayt 1 ve Slayt 2 arasındaki geçişte (x=1080) hiçbir ton/karartma/renk farkı kalmaz.
  const topGrad = gradientRect(W2, 260, 0, [[0, '#000', 0.45], [1, '#000', 0]]);
  const bottomGrad = gradientRect(W2, H, 600, [[0, '#000', 0], [0.55, '#000', 0.45], [1, '#000', 0.84]]);
  const scrim = svgDoc(W2, H, topGrad.body + bottomGrad.body, topGrad.defs + bottomGrad.defs);
  const gradedWide = await sharp(wide).composite([{ input: scrim }]).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();

  const left = await sharp(gradedWide).extract({ left: 0, top: 0, width: CAROUSEL_W, height: H }).toBuffer();
  const right = await sharp(gradedWide).extract({ left: CAROUSEL_W, top: 0, width: CAROUSEL_W, height: H }).toBuffer();
  return { left, right };
}

async function titleSlide(entity, imgBuf) {
  const sharp = await getSharp();
  const W = CAROUSEL_W, H = CAROUSEL_H;
  const name = trUpper(entity.title);
  const nameSize = name.length > 14 ? 92 : name.length > 9 ? 116 : 140;
  const nameLines = wrapText(name, Math.floor(980 / (nameSize * 0.68)), 2);
  let y = H - 120 - (nameLines.length - 1) * nameSize * 1.05;
  const cat = trUpper(entity.category || (entity.kind === 'collection' ? 'KOLEKSİYON' : ''));
  let body = '';
  body += textEl({ x: 70, y: 96, text: BRAND.name, size: 26, weight: 600, spacing: 8, opacity: 0.92, shadow: true });
  if (cat) body += textEl({ x: 74, y: y - nameSize * 0.95, text: cat, size: 30, weight: 600, fill: BRAND.gold, spacing: 9, shadow: true });
  for (const line of nameLines) { body += textEl({ x: 66, y, text: line, size: nameSize, font: TITLE_FONT, weight: 700, spacing: 4, shadow: true }); y += nameSize * 1.05; }
  body += `<rect x="72" y="${H - 84}" width="120" height="4" fill="${BRAND.gold}"/>`;
  body += textEl({ x: W - 70, y: H - 70, text: 'KAYDIR  →', size: 24, weight: 600, anchor: 'end', spacing: 4, opacity: 0.8 });
  const overlay = svgDoc(W, H, body, SHADOW_DEF);
  return sharp(imgBuf).composite([{ input: overlay }]).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
}

async function quoteSlide(entity, imgBuf) {
  const sharp = await getSharp();
  const W = CAROUSEL_W, H = CAROUSEL_H;
  const quote = excerptQuote(entity.promoQuote || entity.shortDescription, 230) || entity.shortDescription || '';
  let body = '';
  if (quote) {
    const size = quote.length > 170 ? 44 : quote.length > 110 ? 50 : 58;
    const lines = wrapText(quote, Math.floor(920 / (size * 0.5)), 8);
    let y = H - 150 - (lines.length - 1) * size * 1.32;
    body += textEl({ x: 64, y: y - size * 1.0, text: '“', size: 150, font: TITLE_FONT, fill: BRAND.gold, weight: 700 });
    for (const line of lines) { body += textEl({ x: 74, y, text: line, size, font: TITLE_FONT, italic: true, shadow: true }); y += size * 1.32; }
  }
  body += `<rect x="74" y="${H - 104}" width="80" height="3" fill="${BRAND.gold}"/>`;
  body += textEl({ x: 172, y: H - 94, text: trUpper(entity.title), size: 26, weight: 600, spacing: 6, opacity: 0.9 });
  const overlay = svgDoc(W, H, body, SHADOW_DEF);
  return sharp(imgBuf).composite([{ input: overlay }]).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
}

/** Parça / bağımsız ürün kartı: beyaz katalog zemini + fotoğraf + ad + detay. */
async function pieceSlide(entity, piece, index, total, extraLines = []) {
  const sharp = await getSharp();
  const W = CAROUSEL_W, H = CAROUSEL_H;
  const imgBox = { w: 960, h: 860, top: 70 };
  const src = await loadImage(piece.imageUrl);
  const photo = await sharp(src).rotate().resize(imgBox.w, imgBox.h, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).toBuffer();
  const title = piece.title;
  const tSize = title.length > 26 ? 50 : 62;
  const details = [...detailLines(piece.dimensions, 3), ...extraLines].slice(0, 4);
  let body = '';
  body += textEl({ x: 60, y: 1015 + tSize, text: title, size: tSize, font: TITLE_FONT, weight: 700, fill: BRAND.dark });
  let y = 1015 + tSize + 62;
  for (const d of details) {
    for (const ln of wrapText(d, 64, 2)) { body += textEl({ x: 62, y, text: ln, size: 28, fill: '#475569', weight: 600 }); y += 40; }
  }
  body += `<rect x="60" y="${H - 72}" width="${W - 120}" height="1.5" fill="${BRAND.gold}" fill-opacity="0.7"/>`;
  body += textEl({ x: 60, y: H - 34, text: trUpper(entity.title), size: 22, weight: 600, fill: '#333', spacing: 6 });
  body += textEl({ x: W - 60, y: H - 34, text: BRAND.name, size: 22, weight: 600, fill: '#333', spacing: 6, anchor: 'end' });
  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite([{ input: photo, top: imgBox.top, left: (W - imgBox.w) / 2 }, { input: svgDoc(W, H, body) }])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
}

/**
 * Carousel / tek gönderi görsellerini üretir.
 * Koleksiyon → [başlık, tanıtım, parça1..parça4]  |  Bağımsız ürün → [tek kart]
 */
export async function renderCarousel(entity) {
  if (entity.kind === 'collection') {
    if (!entity.heroUrl) throw new Error(`"${entity.title}" koleksiyonunun ana (hero) görseli yok.`);
    const hero = await loadImage(entity.heroUrl);
    const { left, right } = await heroHalves(hero);
    const slides = [await titleSlide(entity, left), await quoteSlide(entity, right)];
    const pieces = (entity.pieces || [])
      .filter(p => p.imageUrl && p.presentation !== 'video_only' && p.presentation !== 'hidden')
      .slice(0, CAROUSEL_MAX_PIECES);
    for (let i = 0; i < pieces.length; i++) slides.push(await pieceSlide(entity, pieces[i], i + 1, pieces.length));
    return slides;
  }
  const src = entity.sourceImageUrl || entity.heroUrl;
  if (!src) throw new Error(`"${entity.title}" ürününün görseli yok.`);
  const extra = entity.features.slice(0, entity.dimensions ? 2 : 3);
  return [await pieceSlide(entity, { title: entity.title, dimensions: entity.dimensions, imageUrl: src }, 1, 1, extra)];
}

// ── KAMPANYA TEMA TANIMLARI & ÖZEL RENK PALETLERİ ───────────────────────────
export const CAMPAIGN_THEMES = {
  seasonal: {
    winter: {
      key: 'winter',
      label: 'Kış Sezonu Kampanyası',
      icon: '❄️',
      badgeText: '❄️ KIŞ SEZONU ÖZEL MİMARİ SEÇKİ',
      accentColor: '#38bdf8',
      goldColor: '#fde68a',
      darkColor: '#0a192f',
      musicKey: 'modern_lofi',
      gradient: [[0, '#020617', 0.92], [0.5, '#0f172a', 0.8], [1, '#1e293b', 0.9]]
    },
    summer: {
      key: 'summer',
      label: 'Yaz Sezonu Kampanyası',
      icon: '☀️',
      badgeText: '☀️ YAZ SEZONU MİMARİ SEÇKİ',
      accentColor: '#f59e0b',
      goldColor: '#fbbf24',
      darkColor: '#1c1917',
      musicKey: 'warm_acoustic',
      gradient: [[0, '#1c1917', 0.9], [0.5, '#292524', 0.8], [1, '#451a03', 0.9]]
    },
    autumn: {
      key: 'autumn',
      label: 'Sonbahar Fırsatları',
      icon: '🍂',
      badgeText: '🍂 SONBAHAR SICAK DOKUNUŞLARI',
      accentColor: '#fb923c',
      goldColor: '#fde047',
      darkColor: '#18181b',
      musicKey: 'modern_lofi',
      gradient: [[0, '#18181b', 0.92], [0.5, '#27272a', 0.82], [1, '#3b1d11', 0.9]]
    },
    spring: {
      key: 'spring',
      label: 'İlkbahar Yenilenme Kampanyası',
      icon: '🌸',
      badgeText: '🌸 BAHAR TAZELİĞİ & YENİLENME SEZONU',
      accentColor: '#34d399',
      goldColor: '#fde68a',
      darkColor: '#062016',
      musicKey: 'warm_acoustic',
      gradient: [[0, '#062016', 0.92], [0.5, '#064e3b', 0.8], [1, '#022c22', 0.9]]
    }
  },
  special_occasions: {
    new_year: {
      key: 'new_year',
      label: 'Yılbaşı Özel Kampanyası',
      icon: '🎄',
      badgeText: '✨ YILBAŞINA ÖZEL MİMARİ AYRICALIK',
      accentColor: '#ef4444',
      goldColor: '#ffd700',
      darkColor: '#110508',
      musicKey: 'cinematic_strings',
      gradient: [[0, '#0f0508', 0.94], [0.5, '#1e050f', 0.82], [1, '#3b0718', 0.9]]
    },
    wedding_season: {
      key: 'wedding_season',
      label: 'Evlilik & Düğün Sezonu',
      icon: '💍',
      badgeText: '💍 YENİ EVLİLER & ÇEYİZ SEZONU',
      accentColor: '#f472b6',
      goldColor: '#fde68a',
      darkColor: '#1e1122',
      musicKey: 'luxury_piano',
      gradient: [[0, '#130919', 0.92], [0.5, '#2e1039', 0.8], [1, '#4a044e', 0.88]]
    },
    ramadan: {
      key: 'ramadan',
      label: 'Ramazan Bayramı Kampanyası',
      icon: '🌙',
      badgeText: '🌙 RAMAZAN BEREKETİ & ZARAFET',
      accentColor: '#10b981',
      goldColor: '#fbbf24',
      darkColor: '#041f16',
      musicKey: 'cinematic_strings',
      gradient: [[0, '#041f16', 0.94], [0.5, '#064e3b', 0.82], [1, '#022c22', 0.9]]
    },
    eid: {
      key: 'eid',
      label: 'Kurban Bayramı Kampanyası',
      icon: '🕌',
      badgeText: '🕌 BAYRAMA ÖZEL LÜKS DOKUNUŞLAR',
      accentColor: '#059669',
      goldColor: '#fde68a',
      darkColor: '#041e17',
      musicKey: 'cinematic_strings',
      gradient: [[0, '#041e17', 0.94], [0.5, '#064e3b', 0.82], [1, '#065f46', 0.9]]
    },
    mothers_day: {
      key: 'mothers_day',
      label: 'Anneler Günü Kampanyası',
      icon: '💐',
      badgeText: '💐 ANNELER GÜNÜNE ÖZEL SEÇKİ',
      accentColor: '#f43f5e',
      goldColor: '#fde68a',
      darkColor: '#200812',
      musicKey: 'warm_acoustic',
      gradient: [[0, '#200812', 0.92], [0.5, '#4c0519', 0.8], [1, '#881337', 0.88]]
    }
  },
  discounts_deals: {
    default: {
      key: 'discounts_deals',
      label: 'İndirimler & Büyük Fırsatlar',
      icon: '🏷️',
      badgeText: '🏷️ SEZONUN EN BÜYÜK MİMARİ İNDİRİMİ',
      accentColor: '#ef4444',
      goldColor: '#fde68a',
      darkColor: '#111827',
      musicKey: 'upbeat_interior',
      gradient: [[0, '#0f172a', 0.94], [0.5, '#1e293b', 0.82], [1, '#334155', 0.9]]
    }
  },
  new_launch: {
    default: {
      key: 'new_launch',
      label: 'Yeni Ürün / Sezon Lansmanı',
      icon: '🚀',
      badgeText: '✨ YENİ SEZON LANSMAN SEÇKİSİ',
      accentColor: '#818cf8',
      goldColor: '#d4af37',
      darkColor: '#0b0f19',
      musicKey: 'luxury_piano',
      gradient: [[0, '#0b0f19', 0.95], [0.5, '#111827', 0.84], [1, '#1e1b4b', 0.9]]
    }
  },
  brand_corporate: {
    default: {
      key: 'brand_corporate',
      label: 'Marka & Kurumsal Tanıtım',
      icon: '👑',
      badgeText: '👑 NOVA FURNITURE ARCHITECTURAL ATELIER',
      accentColor: '#d4af37',
      goldColor: '#fde68a',
      darkColor: '#090d16',
      musicKey: 'luxury_piano',
      gradient: [[0, '#090d16', 0.95], [0.5, '#0f172a', 0.85], [1, '#1e293b', 0.92]]
    }
  }
};

export function resolveCampaignTheme(type, subType) {
  const tGroup = CAMPAIGN_THEMES[type] || CAMPAIGN_THEMES.seasonal;
  if (subType && tGroup[subType]) return tGroup[subType];
  if (tGroup.default) return tGroup.default;
  const first = Object.values(tGroup)[0];
  return first || CAMPAIGN_THEMES.seasonal.winter;
}

/**
 * Kampanya Kapak Slaytı (1080x1350 JPEG)
 * Carousel'in en başında kampanya türü, indirim oranı, kampanya başlığı ve ürünleri sunar.
 */
export async function campaignCoverSlide({ campaign, heroBuf, entity, includedTitles = [] }) {
  const sharp = await getSharp();
  const W = CAROUSEL_W, H = CAROUSEL_H;
  const theme = resolveCampaignTheme(campaign?.campaign_type, campaign?.sub_type);

  const baseImg = await sharp(heroBuf).rotate().resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer();
  const grad = gradientRect(W, H, 0, theme.gradient);
  const scrim = svgDoc(W, H, grad.body, grad.defs);
  const darkHero = await sharp(baseImg).composite([{ input: scrim }]).toBuffer();

  const discount = (campaign?.discount_amount || '').trim();
  const title = (campaign?.campaign_title || entity?.title || 'ÖZEL MİMARİ KAMPANYA').trim();
  const intro = (campaign?.campaign_intro || entity?.promoQuote || 'Lüks yaşam alanları için seçkin koleksiyonumuzda özel fırsatlar.').trim();

  let body = '';
  // 1. Üst Marka & Kampanya Rozeti
  body += textEl({ x: 70, y: 96, text: BRAND.name, size: 24, weight: 600, spacing: 8, opacity: 0.92, shadow: true });
  body += textEl({ x: 72, y: 140, text: theme.badgeText, size: 28, weight: 700, fill: theme.accentColor, spacing: 5, shadow: true });

  // 2. İndirim Miktarı Rozeti
  let curY = 310;
  if (discount) {
    const badgeW = Math.min(W - 140, Math.max(340, discount.length * 44 + 60));
    body += `<rect x="68" y="${curY - 60}" width="${badgeW}" height="90" rx="14" fill="${theme.accentColor}" fill-opacity="0.22" stroke="${theme.accentColor}" stroke-width="2"/>`;
    body += textEl({ x: 96, y: curY + 6, text: trUpper(discount), size: 64, font: TITLE_FONT, weight: 800, fill: theme.goldColor, spacing: 3, shadow: true });
    curY += 120;
  }

  // 3. Kampanya Başlığı
  const tUpper = trUpper(title);
  const tSize = tUpper.length > 28 ? 64 : tUpper.length > 18 ? 76 : 88;
  const tLines = wrapText(tUpper, Math.floor(920 / (tSize * 0.62)), 3);
  for (const line of tLines) {
    body += textEl({ x: 70, y: curY + tSize, text: line, size: tSize, font: TITLE_FONT, weight: 700, fill: '#ffffff', spacing: 2, shadow: true });
    curY += tSize * 1.08;
  }

  // 4. Kampanyaya Dahil Ürün / Koleksiyon İsimleri
  curY += 24;
  const productsLabel = includedTitles.length > 1
    ? includedTitles.slice(0, 4).join(' • ') + (includedTitles.length > 4 ? ` (+${includedTitles.length - 4})` : '')
    : (entity?.title || '');
  if (productsLabel) {
    body += `<rect x="70" y="${curY}" width="90" height="3" fill="${theme.goldColor}"/>`;
    curY += 28;
    const pLines = wrapText(`Dahil Olanlar: ${productsLabel}`, 50, 2);
    for (const pl of pLines) {
      body += textEl({ x: 72, y: curY, text: pl, size: 26, weight: 600, fill: theme.goldColor, spacing: 3, shadow: true });
      curY += 34;
    }
  }

  // 5. Tanıtım Cümlesi
  curY += 18;
  const introLines = wrapText(excerptQuote(intro, 220), 46, 4);
  for (const il of introLines) {
    body += textEl({ x: 72, y: curY, text: il, size: 30, font: TITLE_FONT, italic: true, fill: '#e2e8f0', spacing: 1, shadow: true });
    curY += 40;
  }

  // 6. Alt Yönlendirme (KAYDIR →)
  body += `<rect x="70" y="${H - 96}" width="${W - 140}" height="1.5" fill="${theme.goldColor}" fill-opacity="0.4"/>`;
  body += textEl({ x: 72, y: H - 56, text: `${theme.icon} KAMPANYA SEÇKİSİ`, size: 22, weight: 700, fill: theme.accentColor, spacing: 4 });
  body += textEl({ x: W - 70, y: H - 56, text: 'KAYDIR  →', size: 24, weight: 700, fill: '#ffffff', anchor: 'end', spacing: 5 });

  const overlay = svgDoc(W, H, body, SHADOW_DEF);
  return sharp(darkHero).composite([{ input: overlay }]).jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer();
}

/**
 * Kampanya Geçiş Slaytı (Bridge Slide) (1080x1350 JPEG)
 * Karışık/çoklu gönderilerde koleksiyon sunumu bittikten sonra bağımsız ürünlere geçmeden araya eklenir.
 */
export async function campaignBridgeSlide({ campaign, heroBuf, collectionCount = 1, independentCount = 1 }) {
  const sharp = await getSharp();
  const W = CAROUSEL_W, H = CAROUSEL_H;
  const theme = resolveCampaignTheme(campaign?.campaign_type, campaign?.sub_type);

  const baseImg = await sharp(heroBuf).rotate().resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer();
  const grad = gradientRect(W, H, 0, [[0, '#020617', 0.95], [0.5, '#0b1329', 0.88], [1, '#020617', 0.96]]);
  const scrim = svgDoc(W, H, grad.body, grad.defs);
  const darkHero = await sharp(baseImg).composite([{ input: scrim }]).toBuffer();

  let body = '';
  body += textEl({ x: 70, y: 96, text: BRAND.name, size: 24, weight: 600, spacing: 8, opacity: 0.92, shadow: true });
  body += textEl({ x: 72, y: 140, text: `${theme.icon} KAMPANYA DEVAM EDİYOR`, size: 28, weight: 700, fill: theme.accentColor, spacing: 5, shadow: true });

  // Merkez Kart: Kampanyaya dahil diğer ürünlerimiz için kaydırınız
  body += `<rect x="68" y="440" width="${W - 136}" height="420" rx="20" fill="rgba(15,23,42,0.85)" stroke="${theme.goldColor}" stroke-width="2" stroke-opacity="0.6"/>`;

  body += textEl({ x: W / 2, y: 530, text: 'TAMAMLAYICI MİMARİ PARÇALAR', size: 26, weight: 700, fill: theme.goldColor, anchor: 'middle', spacing: 6 });
  body += `<rect x="${W / 2 - 80}" y="555" width="160" height="2" fill="${theme.goldColor}"/>`;

  const bridgeTitleLines = wrapText('Kampanyaya dahil diğer bağımsız ürünlerimiz için kaydırınız', 32, 3);
  let by = 620;
  for (const bl of bridgeTitleLines) {
    body += textEl({ x: W / 2, y: by, text: bl, size: 44, font: TITLE_FONT, weight: 700, fill: '#ffffff', anchor: 'middle', spacing: 2 });
    by += 54;
  }

  body += textEl({ x: W / 2, y: by + 26, text: '➡️', size: 54, anchor: 'middle' });
  body += textEl({ x: W / 2, y: by + 86, text: 'Koleksiyon konseptini tamamlayan bağımsız parçaları keşfedin.', size: 24, font: TITLE_FONT, italic: true, fill: '#94a3b8', anchor: 'middle' });

  // Alt bilgi
  body += textEl({ x: 72, y: H - 60, text: `🏛️ Koleksiyonlar tamamlandı • 🪑 Bağımsız Parçalar`, size: 22, weight: 600, fill: theme.accentColor, spacing: 3 });
  body += textEl({ x: W - 70, y: H - 60, text: 'KAYDIR  →', size: 24, weight: 700, fill: '#ffffff', anchor: 'end', spacing: 5 });

  const overlay = svgDoc(W, H, body, SHADOW_DEF);
  return sharp(darkHero).composite([{ input: overlay }]).jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer();
}

/**
 * Kampanya Carousel Görsellerini Üretir (En fazla 10 görsel).
 * Kullanıcı Kuralları:
 * - 1. Slayt her zaman Kampanya Kapak Slaytıdır.
 * - Koleksiyon seçildiyse: Kapak + Panoramik İki Yarı + Parça Slaytları.
 * - Bağımsız ürün seçildiyse: Kapak + Bağımsız Ürün Slaytı (Toplam 2 slayt).
 * - Çoklu/Karışık seçildiyse:
 *     - Koleksiyonlar sırayla listelenir.
 *     - Hem koleksiyon hem bağımsız ürün varsa araya 'Geçiş Slaytı' (Bridge Slide) eklenir!
 *     - Ardından bağımsız ürünler listelenir.
 */
export async function renderCampaignCarousel({ campaign, primaryEntity, entities = [] }) {
  const slides = [];
  const heroUrl = primaryEntity?.heroUrl || primaryEntity?.sourceImageUrl || (entities[0]?.heroUrl || entities[0]?.sourceImageUrl);
  if (!heroUrl) throw new Error('Kampanya için geçerli bir ana görsel bulunamadı.');
  const heroBuf = await loadImage(heroUrl);

  const allEntities = entities.length ? entities : [primaryEntity];
  const includedTitles = allEntities.map(e => e.title);

  // 1. Her zaman en başta Kampanya Kapak Slaytı:
  const cover = await campaignCoverSlide({ campaign, heroBuf, entity: primaryEntity, includedTitles });
  slides.push(cover);

  const kind = campaign?.composition_kind || (primaryEntity.kind === 'collection' ? 'collection' : 'independent');

  if (kind === 'collection') {
    // Koleksiyon: Kapak + Panoramik Sol & Sağ + Parçalar
    const { left, right } = await heroHalves(heroBuf);
    slides.push(await titleSlide(primaryEntity, left));
    slides.push(await quoteSlide(primaryEntity, right));
    const pieces = (primaryEntity.pieces || [])
      .filter(p => p.imageUrl && p.presentation !== 'video_only' && p.presentation !== 'hidden')
      .slice(0, 6);
    for (let i = 0; i < pieces.length; i++) {
      slides.push(await pieceSlide(primaryEntity, pieces[i], i + 1, pieces.length));
    }
  } else if (kind === 'independent') {
    // Bağımsız ürün: Kapak + Bağımsız Ürün Slaytı (Toplam 2 sayfa)
    const extra = (primaryEntity.features || []).slice(0, primaryEntity.dimensions ? 2 : 3);
    slides.push(await pieceSlide(primaryEntity, { title: primaryEntity.title, dimensions: primaryEntity.dimensions, imageUrl: heroUrl }, 1, 1, extra));
  } else if (kind === 'mixed_multi') {
    // Karışık / Çoklu Gönderi
    const collections = allEntities.filter(e => e.kind === 'collection');
    const independents = allEntities.filter(e => e.kind === 'independent');

    // Önce koleksiyonlar
    for (const col of collections) {
      if (slides.length >= 8) break;
      const cHero = await loadImage(col.heroUrl);
      const { left, right } = await heroHalves(cHero);
      slides.push(await titleSlide(col, left));
      slides.push(await quoteSlide(col, right));
      const colPieces = (col.pieces || []).slice(0, 2);
      for (let i = 0; i < colPieces.length; i++) {
        if (slides.length >= 8) break;
        slides.push(await pieceSlide(col, colPieces[i], i + 1, colPieces.length));
      }
    }

    // EĞER HEM KOLEKSİYON HEM BAĞIMSIZ ÜRÜN BİR ARADA SEÇİLMİŞSE: ARAYA GEÇİŞ SLAYTI ATILIR!
    if (collections.length > 0 && independents.length > 0 && slides.length < 9) {
      const bridge = await campaignBridgeSlide({ campaign, heroBuf, collectionCount: collections.length, independentCount: independents.length });
      slides.push(bridge);
    }

    // Ardından bağımsız ürünler
    for (let i = 0; i < independents.length; i++) {
      if (slides.length >= 10) break;
      const ind = independents[i];
      const indSrc = ind.sourceImageUrl || ind.heroUrl;
      const extra = (ind.features || []).slice(0, ind.dimensions ? 2 : 3);
      slides.push(await pieceSlide(ind, { title: ind.title, dimensions: ind.dimensions, imageUrl: indSrc }, i + 1, independents.length, extra));
    }
  }

  // Instagram en fazla 10 görsel kabul ettiği için maksimum 10 slaytla sınırla
  return slides.slice(0, 10);
}

/**
 * Kampanya Açıklama Metni Oluşturucu
 */
export function buildCampaignCaption({ campaign, entities = [], platform = 'instagram', intro = '' }) {
  const theme = resolveCampaignTheme(campaign?.campaign_type, campaign?.sub_type);
  const discount = (campaign?.discount_amount || '').trim();
  const title = (campaign?.campaign_title || 'Özel Mimari Kampanya').trim();
  const cIntro = intro || (campaign?.campaign_intro || '').trim();

  const lines = [];
  lines.push(`${theme.badgeText}`);
  if (discount) lines.push(`🔥 ${trUpper(discount)} FIRSATI`);
  lines.push(`✨ ${trUpper(title)}`);
  if (cIntro) lines.push('', cIntro);

  if (entities.length > 0) {
    lines.push('', '🏛️ Kampanyaya Dahil Olan Seçkin Tasarımlar:');
    entities.slice(0, 8).forEach(e => {
      const typeLabel = e.kind === 'collection' ? 'Koleksiyon' : 'Bağımsız Ürün';
      lines.push(`▫️ ${e.title} (${typeLabel}${e.dimensions ? ' — ' + e.dimensions : ''})`);
    });
  }

  lines.push('', `📩 Fiyat, özel indirim ve sipariş detayları için DM veya WhatsApp: ${BRAND.whatsapp}`);
  if (platform === 'facebook' || platform === 'youtube') lines.push(`🌐 ${BRAND.website}`);
  return lines.join('\n');
}

// ── 2) DİKEY VİDEO (FFMPEG) ──────────────────────────────────────────────────
function runFfmpeg(args, { timeoutMs = 240000, label = 'ffmpeg' } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr = (stderr + d.toString()).slice(-4000); });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error(`${label} zaman aşımı`)); }, timeoutMs);
    proc.on('error', err => { clearTimeout(timer); reject(new Error(`${label} başlatılamadı: ${err.message}`)); });
    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${label} hata kodu ${code}: ${stderr.trim().split('\n').slice(-3).join(' | ')}`));
    });
  });
}

/** Saydam tek satır/blok metin PNG'si üretir; {path,w,h} döner. */
async function textPng(dir, name, { lines, size, font = BODY_FONT, weight = 400, fill = '#fff', italic = false, spacing = 0, lineHeight = 1.3, shadow = true, width = VW - 140 }) {
  const sharp = await getSharp();
  const h = Math.ceil(lines.length * size * lineHeight + size * 0.6);
  let body = '';
  lines.forEach((ln, i) => { body += textEl({ x: 6, y: Math.round(size * 1.0 + i * size * lineHeight), text: ln, size, font, weight, fill, italic, spacing, shadow }); });
  const p = path.join(dir, `${name}.png`);
  await sharp(svgDoc(width, h, body, SHADOW_DEF)).png().toFile(p);
  return { path: p, w: width, h };
}

async function fullFramePng(dir, name, svgBody, defs = '') {
  const sharp = await getSharp();
  const p = path.join(dir, `${name}.png`);
  await sharp(svgDoc(VW, VH, svgBody, defs)).png().toFile(p);
  return p;
}

/**
 * Tek sahneyi MP4 olarak işler.
 * motion: {type:'pan'} hero için soldan sağa akış, {type:'zoom', z0,z1,ax0,ax1,ay} parça için Ken Burns
 * overlays: [{path,x,y,start,dur,effect:'fade'|'wipe',rise}]
 */
async function renderScene({ basePath, motion, overlays, duration, out }) {
  const frames = Math.round(duration * FPS);
  const args = [];
  let filter = '';
  if (motion.type === 'pan') {
    args.push('-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', basePath);
    const ease = `(0.5-0.5*cos(PI*min(t/${duration.toFixed(3)},1)))`;
    filter += `[0:v]crop=${VW}:${VH}:x='(iw-${VW})*${ease}':y='(ih-${VH})/2',setsar=1,format=yuv420p[bg0];`;
  } else {
    args.push('-i', basePath);
    const N = Math.max(1, frames - 1);
    const e = `(0.5-0.5*cos(PI*on/${N}))`;
    const z = `${motion.z0}+(${motion.z1 - motion.z0})*${e}`;
    const ax = `(${motion.ax0}+(${motion.ax1 - motion.ax0})*${e})`;
    filter += `[0:v]zoompan=z='${z}':x='${ax}*(iw-iw/zoom)':y='${motion.ay}*(ih-ih/zoom)':d=${frames}:s=${VW}x${VH}:fps=${FPS},setsar=1,format=yuv420p[bg0];`;
  }
  let last = 'bg0';
  overlays.forEach((o, i) => {
    const idx = i + 1;
    args.push('-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', o.path);
    const st = Math.max(0, o.start).toFixed(2);
    const d = (o.dur || 0.7).toFixed(2);
    filter += `[${idx}:v]format=rgba,fade=t=in:st=${st}:d=${d}:alpha=1[o${idx}];`;
    const rise = o.rise || (o.effect === 'wipe' ? 16 : 0);
    const yExpr = rise ? `'${o.y}+${rise}*min(1,max(0,1-(t-${st})/${d}))'` : `${o.y}`;
    filter += `[${last}][o${idx}]overlay=x=${o.x}:y=${yExpr}:eval=frame[v${idx}];`;
    last = `v${idx}`;
  });
  filter = filter.replace(/;$/, '');
  args.push('-filter_complex', filter, '-map', `[${last}]`, '-t', duration.toFixed(3), '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-an', out);
  await runFfmpeg(args, { label: `sahne ${path.basename(out)}` });
  return out;
}

/** Hero görseli dikey kamera akışı için 1920 yüksekliğe (en az 1.5x genişliğe) hazırlar. */
async function prepareHeroBase(dir, heroBuf) {
  const sharp = await getSharp();
  const meta = await sharp(heroBuf).metadata();
  const ratio = (meta.width || 1) / (meta.height || 1);
  const width = Math.max(Math.round(VW * 1.5), Math.round(VH * ratio));
  const p = path.join(dir, 'hero_base.jpg');
  await sharp(heroBuf).rotate().resize(width, VH, { fit: 'cover', position: 'centre' }).jpeg({ quality: 93 }).toFile(p);
  return p;
}

/** Parça sahnesi zemini: 2x çözünürlükte beyaz katalog zemini, ürün üst bölümde. */
async function preparePieceBase(dir, name, imgBuf, mode = 'contain') {
  const sharp = await getSharp();
  const W2 = VW * 2, H2 = VH * 2;
  const p = path.join(dir, `${name}.jpg`);
  if (mode === 'cover') {
    await sharp(imgBuf).rotate().resize(W2, H2, { fit: 'cover', position: 'attention' }).jpeg({ quality: 92 }).toFile(p);
    return p;
  }
  const boxW = Math.round(W2 * 0.9), boxH = Math.round(H2 * 0.56);
  const photo = await sharp(imgBuf).rotate().resize(boxW, boxH, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).toBuffer();
  await sharp({ create: { width: W2, height: H2, channels: 3, background: '#ffffff' } })
    .composite([{ input: photo, left: Math.round((W2 - boxW) / 2), top: Math.round(H2 * 0.09) }])
    .jpeg({ quality: 92 }).toFile(p);
  return p;
}

function cameraMotion(camera, i) {
  switch (camera) {
    case 'dolly_in': return { type: 'zoom', z0: 1.0, z1: 1.045, ax0: 0.5, ax1: 0.5, ay: 0.4 };
    case 'lateral_tracking': return { type: 'zoom', z0: 1.02, z1: 1.04, ax0: i % 2 ? 0.56 : 0.44, ax1: i % 2 ? 0.44 : 0.56, ay: 0.4 };
    case 'macro_detail': return { type: 'zoom', z0: 1.02, z1: 1.055, ax0: 0.5, ax1: 0.52, ay: 0.4 };
    case 'slow_push_in':
    default: return { type: 'zoom', z0: 1.0, z1: 1.04, ax0: 0.5, ax1: 0.5, ay: 0.4 };
  }
}

// ── DİNAMİK MÜZİK KÜTÜPHANESİ TARAYICI & EŞLEYİCİ (assets/music) ─────────────
export function resolveMusicLibraryDir() {
  const thisDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const candidates = [
    path.join(thisDir, 'assets/music'),
    path.resolve(process.cwd(), 'assets/music'),
    path.resolve(process.cwd(), 'Sunucu/publisher/assets/music')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export function formatMusicTrackLabel(stem) {
  const s = String(stem || '').trim();
  const low = s.toLowerCase();
  let icon = '🎵';
  if (low.startsWith('atmospheric') || low.startsWith('ambient')) icon = '🌌';
  else if (low.startsWith('caz') || low.startsWith('jazz')) icon = '🎷';
  else if (low.startsWith('cinematic') || low.startsWith('sinematik')) icon = '🎬';
  else if (low.startsWith('holiday') || low.startsWith('chill') || low.startsWith('lounge')) icon = '🏖️';
  else if (low.startsWith('classical') || low.startsWith('klasik') || low.startsWith('piano')) icon = '🎻';
  else if (low.startsWith('acoustic') || low.startsWith('akustik')) icon = '🎸';
  return `${icon} ${s}`;
}

export function normalizeMusicKey(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/\.(mp3|mp4|m4a|wav|aac|ogg|flac)$/i, '')
    .replace(/[\s_-]+/g, ' ');
}

/**
 * `assets/music` klasöründeki tüm ses/müzik dosyalarını dinamik olarak tarar.
 * Klasöre yeni müzik eklendiğinde veya çıkarıldığında kod değişikliği gerekmeden otomatik algılanır.
 */
export function scanLocalMusicLibrary() {
  const musicDir = resolveMusicLibraryDir();
  if (!fs.existsSync(musicDir)) return [];
  const files = fs.readdirSync(musicDir)
    .filter(f => /\.(mp3|mp4|m4a|wav|aac|ogg|flac)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true, sensitivity: 'base' }));

  return files.map(fileName => {
    const ext = path.extname(fileName);
    const stem = path.basename(fileName, ext).trim();
    const genre = stem.split(/\s+/)[0] || 'General';
    const fullPath = path.join(musicDir, fileName);
    const stat = fs.statSync(fullPath);
    return {
      value: stem,
      key: stem,
      normalizedKey: normalizeMusicKey(stem),
      label: formatMusicTrackLabel(stem),
      fileName,
      ext: ext.toLowerCase(),
      genre,
      sizeBytes: stat.size,
      fullPath
    };
  });
}

/**
 * Yerel `assets/music` klasöründeki müzikleri Supabase Storage ve `site_settings('music_library_manifest')`
 * ile senkronize eder. Böylece hem Modül 8 web arayüzü hem de bulut/sunucu işçileri güncel listeyi görür.
 */
export async function syncMusicLibraryToSupabase(supabase, log = () => {}) {
  if (!supabase) return [];
  const tracks = scanLocalMusicLibrary();
  if (!tracks.length) return [];

  const manifestTracks = [];
  for (const t of tracks) {
    const safeSlug = t.stem
      ? t.stem
      : t.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const storagePath = `music-library/${safeSlug}${t.ext}`;
    let publicUrl = '';
    try {
      const buf = fs.readFileSync(t.fullPath);
      const contentType = t.ext === '.mp4' ? 'video/mp4' : t.ext === '.m4a' ? 'audio/mp4' : t.ext === '.wav' ? 'audio/wav' : 'audio/mpeg';
      const r2Up = await uploadBufferToR2(storagePath, buf, contentType);
      publicUrl = r2Up.publicUrl || '';
    } catch (_) {}

    manifestTracks.push({
      value: t.value,
      key: t.key,
      label: t.label,
      fileName: t.fileName,
      genre: t.genre,
      sizeBytes: t.sizeBytes,
      publicUrl
    });
  }

  try {
    await supabase.from('site_settings').upsert({
      key: 'music_library_manifest',
      data: {
        updated_at: new Date().toISOString(),
        tracks: manifestTracks
      },
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    log(`[Müzik Kütüphanesi] Manifest senkronizasyon uyarısı: ${err.message}`);
  }
  return manifestTracks;
}

export async function resolveMusic(dir, prefs, log = () => {}, entitySlug = '') {
  const rawPref = String(prefs?.music_preference || prefs?.music || '').trim();
  // 1. Kullanıcı Modül 8'den özel bir müzik URL bağlantısı tanımladıysa onu yükle
  if (rawPref === 'custom' && /^https:\/\//i.test(prefs?.custom_music_url || '')) {
    try {
      const buf = await fetchBuffer(prefs.custom_music_url, 30000);
      const p = path.join(dir, 'custom_music.mp3');
      fs.writeFileSync(p, buf);
      log(`[Müzik] Özel URL üzerinden yüklendi: ${prefs.custom_music_url}`);
      return { path: p, url: prefs.custom_music_url, key: 'custom' };
    } catch (err) {
      log(`[Müzik UYARI] Özel müzik alınamadı: ${err.message}`);
    }
  }

  // 2. `assets/music` klasöründeki dinamik müzik kütüphanesinden eşleştir
  const library = scanLocalMusicLibrary();
  if (library.length > 0) {
    const requestedRaw = rawPref;
    const requestedNorm = normalizeMusicKey(requestedRaw);

    let chosen = null;
    if (requestedNorm && requestedNorm !== 'auto' && requestedNorm !== 'custom') {
      // Birebir isim veya dosya adı eşleşmesi (örn. "Atmospheric 1", "Caz 1", "Cinematic 2", "Holiday 1")
      chosen = library.find(t =>
        t.normalizedKey === requestedNorm ||
        normalizeMusicKey(t.fileName) === requestedNorm
      );
      // Eğer eski bir tema anahtarı kalmışsa (örn. luxury_piano, cinematic_strings, warm_acoustic, modern_lofi) türe göre eşleştir
      if (!chosen) {
        if (requestedNorm.includes('cinematic') || requestedNorm.includes('strings')) {
          chosen = library.find(t => t.normalizedKey.startsWith('cinematic'));
        } else if (requestedNorm.includes('ambient') || requestedNorm.includes('atmospheric')) {
          chosen = library.find(t => t.normalizedKey.startsWith('atmospheric') || t.normalizedKey.startsWith('ambient'));
        } else if (requestedNorm.includes('lofi') || requestedNorm.includes('caz') || requestedNorm.includes('jazz')) {
          chosen = library.find(t => t.normalizedKey.startsWith('caz') || t.normalizedKey.startsWith('jazz'));
        } else if (requestedNorm.includes('warm') || requestedNorm.includes('holiday') || requestedNorm.includes('upbeat')) {
          chosen = library.find(t => t.normalizedKey.startsWith('holiday'));
        }
      }
    }

    // Seçilen müzik klasörden silinmişse veya 'auto' ise mevcut kütüphaneden deterministik seç
    if (!chosen) {
      const seedStr = String(entitySlug || requestedRaw || 'nova');
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) hash = ((hash << 5) - hash + seedStr.charCodeAt(i)) | 0;
      const idx = Math.abs(hash) % library.length;
      chosen = library[idx];
    }

    if (chosen && fs.existsSync(chosen.fullPath)) {
      log(`[Müzik Kütüphanesi] Seçilen müzik: "${chosen.value}" (${chosen.fileName})`);
      return {
        path: chosen.fullPath,
        url: null,
        key: chosen.value,
        fileName: chosen.fileName
      };
    }
  }

  // 3. Yedek: Kütüphane boşsa telifsiz hafif ambians sesi üret
  try {
    const ambientPath = path.join(dir, 'nature_ambient.mp3');
    const FFMPEG_BIN = resolveFfmpegBinary();
    const res = spawnSync(FFMPEG_BIN, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'anoisesrc=c=pink:r=48000:a=0.012,lowpass=f=340,highpass=f=75,volume=0.35',
      '-t', '60',
      '-c:a', 'libmp3lame', '-b:a', '128k',
      ambientPath
    ]);
    if (res.status === 0 && fs.existsSync(ambientPath)) {
      log('[Ses] Hafif doğal mimari ambians sesi oluşturuldu (telifsiz).');
      return { path: ambientPath, url: null, key: 'nature_ambient' };
    }
  } catch (err) {
    log(`[Ses UYARI] Doğa ambiansı üretilemedi: ${err.message}`);
  }

  log('[Ses] Sessiz fon ile devam ediliyor.');
  return null;
}

/**
 * 1080x1920 sinematik dikey video üretir. {path, duration, hasMusic, musicKey, scenes} döner.
 */
export async function renderVerticalVideo(entity, { log = () => {}, workDir, introCoverBuffer9x16 = null } = {}) {
  const sharp = await getSharp();
  const dir = workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'nova-video-'));
  const scenes = [];
  if (introCoverBuffer9x16) {
    const coverPath = path.join(dir, 'cover_intro_9x16.jpg');
    fs.writeFileSync(coverPath, introCoverBuffer9x16);
    const outCover = path.join(dir, 'scene_0_cover.mp4');
    await renderScene({
      basePath: coverPath,
      motion: { type: 'zoom', z0: 1.0, z1: 1.02, ax0: 0.5, ax1: 0.5, ay: 0.5 },
      overlays: [],
      duration: 2.2,
      out: outCover
    });
    scenes.push({ path: outCover, duration: 2.2, label: 'triptych_cover' });
  }
  const camera = entity.prefs?.camera || 'slow_push_in';
  const isCol = entity.kind === 'collection';
  const heroUrl = isCol ? entity.heroUrl : (entity.sourceImageUrl || entity.heroUrl);
  if (!heroUrl) throw new Error(`"${entity.title}" için video kaynak görseli yok.`);
  const heroBuf = await loadImage(heroUrl);

  const pieces = isCol
    ? (entity.pieces || []).filter(p => p.imageUrl && p.presentation !== 'carousel_only' && p.presentation !== 'hidden').slice(0, 6)
    : [];
  const heroDur = isCol ? 13 : 10;
  const outroDur = 5;
  const pieceDur = pieces.length
    ? Math.max(5, Math.min(8, (VIDEO_TARGET_SECONDS - heroDur - outroDur + XFADE * (pieces.length + 1)) / pieces.length))
    : 0;

  // ── SAHNE 1: HERO AKIŞI + KOLEKSİYON ADI + TANITIM CÜMLESİ ──
  {
    const heroBase = await prepareHeroBase(dir, heroBuf);
    const grad = gradientRect(VW, VH, 820, [[0, '#000', 0], [0.45, '#000', 0.55], [1, '#000', 0.88]]);
    const topG = gradientRect(VW, 300, 0, [[0, '#000', 0.5], [1, '#000', 0]]);
    const shade = await fullFramePng(dir, 's1_shade', grad.body + topG.body + textEl({ x: 70, y: 120, text: BRAND.name, size: 30, weight: 600, spacing: 9, opacity: 0.92 }), grad.defs + topG.defs);
    const overlays = [{ path: shade, x: 0, y: 0, start: 0, dur: 0.6, effect: 'fade' }];

    const cat = trUpper(entity.category || (isCol ? 'KOLEKSİYON' : ''));
    const name = trUpper(entity.title);
    const nameSize = name.length > 14 ? 96 : name.length > 9 ? 120 : 150;
    const nameLines = wrapText(name, Math.floor(940 / (nameSize * 0.68)), 2);
    const quote = excerptQuote(entity.promoQuote || entity.shortDescription, isCol ? 190 : 150);
    const qSize = 50;
    const qLines = quote ? wrapText(quote, Math.floor(930 / (qSize * 0.5)), 6) : [];

    const nameH = nameLines.length * nameSize * 1.05;
    const qH = qLines.length * qSize * 1.34;
    let y = VH - 170 - qH - (qLines.length ? 70 : 0) - nameH - 60;

    if (cat) {
      const c = await textPng(dir, 's1_cat', { lines: [cat], size: 34, weight: 600, fill: BRAND.gold, spacing: 10 });
      overlays.push({ ...c, x: 64, y: Math.round(y), start: 0.8, dur: 0.8, effect: 'fade', rise: 24 });
      y += 60;
    }
    const n = await textPng(dir, 's1_name', { lines: nameLines, size: nameSize, font: TITLE_FONT, weight: 700, spacing: 5, lineHeight: 1.05 });
    overlays.push({ ...n, x: 60, y: Math.round(y), start: 1.4, dur: 1.4, effect: 'wipe' });
    y += nameH + 40;
    const lineBar = await fullFramePng(dir, 's1_bar', `<rect x="68" y="${Math.round(y)}" width="140" height="4" fill="${BRAND.gold}"/>`);
    overlays.push({ path: lineBar, x: 0, y: 0, start: 2.8, dur: 0.6, effect: 'fade' });
    y += 40;
    for (let i = 0; i < qLines.length; i++) {
      const q = await textPng(dir, `s1_q${i}`, { lines: [qLines[i]], size: qSize, font: TITLE_FONT, italic: true });
      overlays.push({ ...q, x: 64, y: Math.round(y + i * qSize * 1.34), start: 3.4 + i * 1.05, dur: 1.0, effect: 'wipe' });
    }
    const out = path.join(dir, 'scene_1.mp4');
    if (isCol || (await sharp(heroBuf).metadata()).width > (await sharp(heroBuf).metadata()).height * 0.8) {
      await renderScene({ basePath: heroBase, motion: { type: 'pan' }, overlays, duration: heroDur, out });
    } else {
      const base = await preparePieceBase(dir, 'hero_cover', heroBuf, 'cover');
      await renderScene({ basePath: base, motion: cameraMotion(camera, 0), overlays, duration: heroDur, out });
    }
    scenes.push({ path: out, duration: heroDur, label: 'hero' });
  }

  // ── SAHNE 2..n: PARÇALAR (YUMUŞAK ZOOM + DETAY) ──
  for (let i = 0; i < pieces.length; i++) {
    const pc = pieces[i];
    const buf = await loadImage(pc.imageUrl);
    const base = await preparePieceBase(dir, `piece_${i}`, buf, 'contain');
    const overlays = [];
    const idx = await textPng(dir, `p${i}_idx`, { lines: [`${String(i + 1).padStart(2, '0')} / ${String(pieces.length).padStart(2, '0')}`], size: 30, weight: 600, fill: BRAND.gold, spacing: 8, shadow: false });
    let y = 1330;
    overlays.push({ ...idx, x: 66, y, start: 0.5, dur: 0.6, effect: 'fade', rise: 20 });
    y += 56;
    const tSize = pc.title.length > 24 ? 64 : 78;
    const tLines = wrapText(pc.title, Math.floor(940 / (tSize * 0.55)), 2);
    const t = await textPng(dir, `p${i}_t`, { lines: tLines, size: tSize, font: TITLE_FONT, weight: 700, fill: BRAND.dark, shadow: false, lineHeight: 1.08 });
    overlays.push({ ...t, x: 62, y, start: 0.8, dur: 1.1, effect: 'wipe' });
    y += tLines.length * tSize * 1.08 + 30;
    const bar = await fullFramePng(dir, `p${i}_bar`, `<rect x="70" y="${Math.round(y)}" width="110" height="3" fill="${BRAND.gold}"/>`);
    overlays.push({ path: bar, x: 0, y: 0, start: 1.6, dur: 0.5, effect: 'fade' });
    y += 34;
    const det = detailLines(pc.dimensions, 3);
    for (let k = 0; k < det.length; k++) {
      const dl = await textPng(dir, `p${i}_d${k}`, { lines: wrapText(det[k], 44, 1), size: 38, fill: '#4a4a4a', shadow: false });
      overlays.push({ ...dl, x: 66, y: Math.round(y + k * 56), start: 2.0 + k * 0.55, dur: 0.6, effect: 'fade', rise: 18 });
    }
    const foot = await fullFramePng(dir, `p${i}_foot`,
      `<rect x="66" y="${VH - 110}" width="${VW - 132}" height="1.5" fill="${BRAND.gold}" fill-opacity="0.7"/>` +
      textEl({ x: 66, y: VH - 66, text: trUpper(entity.title), size: 26, weight: 600, fill: '#333', spacing: 7 }) +
      textEl({ x: VW - 66, y: VH - 66, text: BRAND.name, size: 26, weight: 600, fill: '#333', spacing: 7, anchor: 'end' }));
    overlays.push({ path: foot, x: 0, y: 0, start: 0.2, dur: 0.6, effect: 'fade' });
    const out = path.join(dir, `scene_p${i}.mp4`);
    await renderScene({ basePath: base, motion: cameraMotion(camera, i), overlays, duration: pieceDur, out });
    scenes.push({ path: out, duration: pieceDur, label: `piece_${i + 1}` });
  }

  // Bağımsız ürün: detay sahnesi (makro zoom + özellikler)
  if (!isCol) {
    const base = await preparePieceBase(dir, 'detail', heroBuf, 'contain');
    const overlays = [];
    const lines = [...detailLines(entity.dimensions, 2), ...entity.features.slice(0, 4)].slice(0, 5);
    let y = 1320;
    const t = await textPng(dir, 'd_t', { lines: wrapText(entity.title, 22, 2), size: 72, font: TITLE_FONT, weight: 700, fill: BRAND.dark, shadow: false, lineHeight: 1.08 });
    overlays.push({ ...t, x: 62, y, start: 0.5, dur: 1.1, effect: 'wipe' });
    y += t.h + 10;
    for (let k = 0; k < lines.length; k++) {
      const dl = await textPng(dir, `d_l${k}`, { lines: wrapText('▪ ' + lines[k], 46, 1), size: 36, fill: '#4a4a4a', shadow: false });
      overlays.push({ ...dl, x: 66, y: Math.round(y + k * 54), start: 1.5 + k * 0.5, dur: 0.6, effect: 'fade', rise: 18 });
    }
    const out = path.join(dir, 'scene_detail.mp4');
    await renderScene({ basePath: base, motion: cameraMotion('macro_detail', 0), overlays, duration: 8, out });
    scenes.push({ path: out, duration: 8, label: 'detail' });
  }

  // ── KAPANIŞ: MARKA + ÇAĞRI ──
  {
    const bg = path.join(dir, 'outro_bg.jpg');
    await sharp(heroBuf).rotate().resize(VW * 2, VH * 2, { fit: 'cover' }).blur(40).modulate({ brightness: 0.32 }).jpeg({ quality: 88 }).toFile(bg);
    const overlays = [];
    const b = await textPng(dir, 'o_brand', { lines: [BRAND.name], size: 78, font: TITLE_FONT, weight: 700, spacing: 8 });
    overlays.push({ ...b, x: 70, y: 700, start: 0.3, dur: 1.0, effect: 'wipe' });
    const bar = await fullFramePng(dir, 'o_bar', `<rect x="76" y="840" width="140" height="4" fill="${BRAND.gold}"/>`);
    overlays.push({ path: bar, x: 0, y: 0, start: 1.1, dur: 0.5, effect: 'fade' });
    const l1 = await textPng(dir, 'o_l1', { lines: ['Fiyat ve sipariş için'], size: 44, fill: '#e8e2d6' });
    overlays.push({ ...l1, x: 72, y: 890, start: 1.4, dur: 0.6, effect: 'fade', rise: 18 });
    const l2 = await textPng(dir, 'o_l2', { lines: [`WhatsApp  ${BRAND.whatsapp}`], size: 54, weight: 700, fill: BRAND.gold });
    overlays.push({ ...l2, x: 72, y: 960, start: 1.9, dur: 0.6, effect: 'fade', rise: 18 });
    const l3 = await textPng(dir, 'o_l3', { lines: [BRAND.website], size: 38, fill: '#cfc8bb', spacing: 2 });
    overlays.push({ ...l3, x: 72, y: 1060, start: 2.4, dur: 0.6, effect: 'fade', rise: 18 });
    const out = path.join(dir, 'scene_outro.mp4');
    await renderScene({ basePath: bg, motion: { type: 'zoom', z0: 1.0, z1: 1.06, ax0: 0.5, ax1: 0.5, ay: 0.5 }, overlays, duration: outroDur, out });
    scenes.push({ path: out, duration: outroDur, label: 'outro' });
  }

  // ── BİRLEŞTİRME: YUMUŞAK GEÇİŞLER + MÜZİK ──
  const total = scenes.reduce((s, x) => s + x.duration, 0) - XFADE * (scenes.length - 1);
  const music = await resolveMusic(dir, entity.prefs, log, entity.slug || entity.title || '');
  const args = [];
  scenes.forEach(s => args.push('-i', s.path));
  if (music) args.push('-stream_loop', '-1', '-i', music.path);
  else args.push('-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
  let fc = '';
  let prev = '0:v';
  let offset = 0;
  for (let i = 1; i < scenes.length; i++) {
    offset += scenes[i - 1].duration - XFADE;
    const transition = i === 1 ? 'smoothleft' : 'fade';
    fc += `[${prev}][${i}:v]xfade=transition=${transition}:duration=${XFADE}:offset=${offset.toFixed(3)}[x${i}];`;
    prev = `x${i}`;
  }
  fc += `[${prev}]format=yuv420p[vout];`;
  const a = scenes.length;
  const fadeOutSt = Math.max(0, total - 3).toFixed(3);
  fc += music
    ? `[${a}:a]asetpts=N/SR/TB,atrim=0:${total.toFixed(3)},afade=t=in:st=0:d=2.2,afade=t=out:st=${fadeOutSt}:d=3,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`
    : `[${a}:a]aresample=48000[aout]`;
  const finalPath = path.join(dir, 'final.mp4');
  args.push('-filter_complex', fc, '-map', '[vout]', '-map', '[aout]', '-t', total.toFixed(3),
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-level', '4.1', '-crf', '21', '-maxrate', '5M', '-bufsize', '10M',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2),
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', finalPath);
  await runFfmpeg(args, { label: 'video birleştirme', timeoutMs: 420000 });
  return { path: finalPath, duration: Number(total.toFixed(2)), hasMusic: !!music, musicKey: music?.key || null, scenes: scenes.map(s => s.label), workDir: dir };
}

// ── 3) METİN (CAPTION) ───────────────────────────────────────────────────────
const CATEGORY_TAGS = {
  'yatak': ['#yatakodası', '#yatakodasitakimi', '#yatakodasidekorasyonu', '#bedroomdesign'],
  'yemek': ['#yemekodası', '#yemekodasitakimi', '#diningroom'],
  'oturma': ['#oturmaodası', '#koltuktakimi', '#salondekorasyonu', '#livingroom'],
  'genç': ['#gençodası', '#gencodasitakimi'],
  'mutfak': ['#mutfakdolabı', '#mutfaktasarimi'],
  'kahve': ['#kahveköşesi', '#kahvekosesi', '#coffeebar', '#coffeecorner'],
  'tv': ['#tvünitesi', '#salondekorasyonu']
};
function slugTag(s) {
  return '#' + String(s || '').toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]+/g, '');
}
export function buildHashtags(entity, platform) {
  const cat = String(entity.category || '').toLocaleLowerCase('tr-TR');
  const tags = [slugTag(BRAND.name), '#novafurniture', '#novahome'];
  if (entity.kind === 'collection') tags.push(slugTag(entity.title) + 'koleksiyonu');
  else tags.push(slugTag(entity.title));
  for (const [k, list] of Object.entries(CATEGORY_TAGS)) if (cat.includes(k)) tags.push(...list);
  tags.push('#mobilya', '#evdekorasyonu', '#içmimari', '#dekorasyon', '#furniture', '#interiordesign', '#luxuryfurniture');
  if (platform === 'youtube') tags.unshift('#Shorts');
  if (platform === 'tiktok') tags.push('#fyp', '#keşfet');
  const uniq = [...new Set(tags.filter(t => t.length > 2))];
  const limit = platform === 'instagram' ? 15 : platform === 'facebook' ? 6 : platform === 'youtube' ? 10 : 8;
  return uniq.slice(0, limit).join(' ');
}

/**
 * Platform ve formata göre açıklama metni. Yalnızca Modül 7 verisi kullanılır;
 * ölçü, malzeme veya fiyat UYDURULMAZ. intro verilirse (Gemini cilası) giriş paragrafı olarak kullanılır.
 */
export function buildCaption(entity, platform, format, intro = '') {
  const name = trUpper(entity.title);
  const cat = entity.category ? ` | ${entity.category}` : '';
  const story = intro || excerptQuote(entity.promoQuote || entity.shortDescription, platform === 'tiktok' ? 150 : 420);
  const lines = [];
  const cta = `📩 Fiyat ve detaylı bilgi için DM'den yazın veya WhatsApp: ${BRAND.whatsapp}`;

  if (platform === 'youtube') {
    lines.push(`${entity.title}${entity.category ? ' – ' + entity.category : ''} | ${BRAND.name} #Shorts`);
    if (story) lines.push('', story);
  } else if (platform === 'tiktok') {
    lines.push(`✨ ${name}${cat}`);
    if (story) lines.push(story);
    lines.push(`📲 WhatsApp: ${BRAND.whatsapp}`);
    return lines.join('\n');
  } else {
    lines.push(`✨ ${name}${cat}`);
    if (story) lines.push('', story);
  }

  if (entity.kind === 'collection' && entity.pieces?.length) {
    lines.push('', 'Koleksiyon parçaları:');
    for (const p of entity.pieces.slice(0, 8)) {
      const d = detailLines(p.dimensions, 1)[0];
      lines.push(`▫️ ${p.title}${d ? ' — ' + d : ''}`);
    }
  } else if (entity.kind === 'independent') {
    const det = [...detailLines(entity.dimensions, 2), ...entity.features.slice(0, 4)];
    if (det.length) { lines.push(''); det.forEach(d => lines.push(`▫️ ${d}`)); }
  }
  if (entity.colors?.length) lines.push('', `🎨 Renk seçenekleri: ${entity.colors.slice(0, 5).join(', ')}`);
  lines.push('', cta);
  if (platform === 'facebook' || platform === 'youtube') lines.push(`🌐 ${BRAND.website}`);
  return lines.join('\n').slice(0, platform === 'youtube' ? 4800 : 2100);
}

/** İsteğe bağlı: Gemini ile giriş paragrafını markaya uygun biçimde cilalar. Hata → boş döner. */
export async function polishIntroWithGemini(entity, apiKey, log = () => {}) {
  if (!apiKey || !entity.promoQuote) return '';
  const model = env('GEMINI_TEXT_MODEL', 'gemini-2.5-flash');
  const prompt = [
    'Bir mobilya markası için Instagram gönderisinin GİRİŞ paragrafını yaz.',
    'Kurallar: Türkçe, en fazla 3 cümle ve 380 karakter, zarif ve sade ton, emoji ve hashtag YOK.',
    'Yalnızca aşağıdaki tasarım hikayesindeki bilgileri kullan; ölçü, malzeme, fiyat, indirim, garanti gibi bilgi UYDURMA.',
    `Ürün/koleksiyon adı: ${entity.title}`,
    `Kategori: ${entity.category || '-'}`,
    `Tasarım hikayesi: ${entity.promoQuote.slice(0, 1500)}`,
    'Sadece paragrafı döndür.'
  ].join('\n');
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 400 } }),
      signal: ctrl.signal
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = clean(data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join(' ') || '');
    if (text.length < 40 || text.length > 520 || /#|https?:/.test(text)) return '';
    return text;
  } catch (err) {
    log(`[Gemini Metin] Cila atlandı: ${err.message}`);
    return '';
  }
}

// ── 4) ÜRETİM + YÜKLEME + ÖNBELLEK ──────────────────────────────────────────
const RENDER_CACHE_KEY = 'module2_render_cache';
const inflight = new Map();

async function readCache(supabase) {
  try {
    if (supabase && typeof supabase.from === 'function') {
      const { data } = await supabase.from('site_settings').select('data').eq('key', RENDER_CACHE_KEY).maybeSingle();
      return (data && data.data) || {};
    }
    const sbUrl = env('SUPABASE_URL', '').replace(/\/$/, '');
    const sbKey = env('SUPABASE_SERVICE_ROLE_KEY', '');
    if (!sbUrl || !sbKey) return {};
    const res = await fetch(`${sbUrl}/rest/v1/site_settings?key=eq.${RENDER_CACHE_KEY}&select=data&limit=1`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` }
    });
    if (!res.ok) return {};
    const rows = await res.json();
    return (rows && rows[0] && rows[0].data) || {};
  } catch (_) { return {}; }
}
async function writeCacheEntry(supabase, key, value) {
  try {
    const cache = await readCache(supabase);
    cache[key] = { ...value, created_at: new Date().toISOString() };
    const keys = Object.keys(cache).sort((a, b) => String(cache[b].created_at).localeCompare(String(cache[a].created_at)));
    for (const k of keys.slice(300)) delete cache[k];
    if (supabase && typeof supabase.from === 'function') {
      await supabase.from('site_settings').upsert({ key: RENDER_CACHE_KEY, data: cache, updated_at: new Date().toISOString() });
      return;
    }
    const sbUrl = env('SUPABASE_URL', '').replace(/\/$/, '');
    const sbKey = env('SUPABASE_SERVICE_ROLE_KEY', '');
    if (!sbUrl || !sbKey) return;
    await fetch(`${sbUrl}/rest/v1/site_settings`, {
      method: 'POST',
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: RENDER_CACHE_KEY, data: cache, updated_at: new Date().toISOString() })
    });
  } catch (_) {}
}

async function uploadFile(supabase, objectPath, buffer, contentType) {
  // Tüm sosyal medya video/görsel render çıktıları sıfır egress maliyetli Cloudflare R2 ('globalkapak-medya') üzerine yüklenir.
  // Meta/TikTok/YouTube API'lerinin doğrudan R2 üzerinden yüksek hızda çekebilmesi için 7 günlük Presigned R2 URL döner.
  const r2Up = await uploadBufferToR2(objectPath, buffer, contentType, {
    preferPresignedUrl: true,
    expiresInSec: 604800
  });
  return r2Up.publicUrl;
}

/**
 * kind: 'carousel' → { urls:[...], cached } | 'video' → { url, duration, hasMusic, cached }
 * Aynı varlık + aynı içerik için bir kez üretilir; IG/FB/YT/TikTok aynı dosyayı paylaşır.
 */
export async function produceMedia({ supabase, entity, kind, log = console.log }) {
  const sig = entitySignature(entity, kind);
  const cacheKey = `${entity.slug}:${kind}:${sig}`;
  if (inflight.has(cacheKey)) return inflight.get(cacheKey);
  const job = (async () => {
    const cache = await readCache(supabase);
    if (cache[cacheKey] && (cache[cacheKey].url || cache[cacheKey].urls)) return { ...cache[cacheKey], cached: true };
    const folder = `${RENDER_FOLDER}/${entity.slug}/${sig}`;
    const started = Date.now();
    if (kind === 'carousel') {
      const slides = await renderCarousel(entity);
      const urls = [];
      for (let i = 0; i < slides.length; i++) urls.push(await uploadFile(supabase, `${folder}/slide-${i + 1}.jpg`, slides[i], 'image/jpeg'));
      const value = { urls, slides: slides.length };
      await writeCacheEntry(supabase, cacheKey, value);
      log(`[Format Motoru] ${entity.slug} carousel hazır (${slides.length} görsel, ${((Date.now() - started) / 1000).toFixed(1)} sn)`);
      return { ...value, cached: false };
    }
    const video = await renderVerticalVideo(entity, { log });
    try {
      const buf = fs.readFileSync(video.path);
      const url = await uploadFile(supabase, `${folder}/video.mp4`, buf, 'video/mp4');
      const value = { url, duration: video.duration, hasMusic: video.hasMusic, musicKey: video.musicKey, sizeBytes: buf.length };
      await writeCacheEntry(supabase, cacheKey, value);
      log(`[Format Motoru] ${entity.slug} video hazır (${video.duration} sn, müzik: ${video.hasMusic ? video.musicKey : 'YOK'}, ${(buf.length / 1048576).toFixed(1)} MB, ${((Date.now() - started) / 1000).toFixed(1)} sn)`);
      return { ...value, cached: false };
    } finally {
      try { fs.rmSync(video.workDir, { recursive: true, force: true }); } catch (_) {}
    }
  })();
  inflight.set(cacheKey, job);
  try { return await job; } finally { inflight.delete(cacheKey); }
}

/**
 * Slot → yayın görevi. Hangi platform/slotta hangi formatın üretileceğini belirler.
 * Dönüş: { contentType, mediaUrl, caption, hashtags, formatKind }
 */
export async function prepareFormatPayload({ supabase, platform, slotFormat, entity, geminiApiKey = null, log = console.log }) {
  const p = String(platform).toLowerCase();
  const f = String(slotFormat || '').toUpperCase();
  const wantsFeed = (p === 'instagram' && (f === 'POST' || f === 'CAROUSEL')) || (p === 'facebook' && (f === 'PHOTO_POST' || f === 'LINK_CARD'));
  const intro = await polishIntroWithGemini(entity, geminiApiKey, log);
  const hashtags = buildHashtags(entity, p);

  if (wantsFeed) {
    const media = await produceMedia({ supabase, entity, kind: 'carousel', log });
    const multi = media.urls.length > 1;
    return {
      formatKind: multi ? 'carousel' : 'single_image',
      contentType: p === 'instagram' ? (multi ? 'CAROUSEL' : 'POST') : 'PHOTO_POST',
      mediaUrl: multi ? JSON.stringify(media.urls) : media.urls[0],
      caption: buildCaption(entity, p, 'feed', intro),
      hashtags
    };
  }

  const video = await produceMedia({ supabase, entity, kind: 'video', log });
  let contentType;
  if (p === 'instagram') contentType = f.includes('STOR') ? 'STORIES' : 'REELS';
  else if (p === 'facebook') contentType = 'FB_REELS';
  else if (p === 'youtube') contentType = 'SHORTS';
  else contentType = 'VIDEO';
  return {
    formatKind: 'video',
    contentType,
    mediaUrl: video.url,
    caption: contentType === 'STORIES' ? '' : buildCaption(entity, p, 'video', intro),
    hashtags: contentType === 'STORIES' ? '' : hashtags,
    videoInfo: { duration: video.duration, hasMusic: video.hasMusic, musicKey: video.musicKey }
  };
}

// ── 5) 3'LÜ INSTAGRAM KOLEKSİYON KAMPANYA SİSTEMİ (REVEAL / BREAKDOWN / STORY) ─
export function splitCollectionNameIntoThree(rawName) {
  const cleaned = trUpper(
    String(rawName || '')
      .replace(/\b(koleksiyonu|koleksiyon|yatak\s*odası|yatak\s*odasi|genç\s*odası|genc\s*odasi|dolap\s*koleksiyonları|dolap\s*koleksiyonlari|kahve\s*köşesi\s*koleksiyonları|kahve\s*kosesi\s*koleksiyonlari|kahve\s*köşesi|kahve\s*kosesi|dolap|takımı|takimi|serisi|모bilya)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  ) || trUpper(clean(rawName || 'KOLEKSİYON'));

  const word = cleaned.split(' ')[0] || cleaned;
  const vowels = 'AEIİOÖUÜ';
  const isVowel = ch => vowels.includes(ch);

  const syllables = [];
  let i = 0;
  const n = word.length;
  while (i < n) {
    let v = i;
    while (v < n && !isVowel(word[v])) v++;
    if (v >= n) {
      if (syllables.length > 0) syllables[syllables.length - 1] += word.slice(i);
      else syllables.push(word.slice(i));
      break;
    }
    let nextV = v + 1;
    while (nextV < n && !isVowel(word[nextV])) nextV++;
    if (nextV >= n) {
      syllables.push(word.slice(i));
      break;
    }
    const consonantsBetween = nextV - v - 1;
    let splitIdx;
    if (consonantsBetween === 0) splitIdx = v + 1;
    else if (consonantsBetween === 1) splitIdx = v + 1;
    else splitIdx = v + 2;
    syllables.push(word.slice(i, splitIdx));
    i = splitIdx;
  }

  let parts;
  if (syllables.length === 3) {
    parts = syllables;
  } else if (syllables.length > 3) {
    const c1 = Math.ceil(syllables.length / 3);
    const c2 = Math.ceil((syllables.length - c1) / 2);
    parts = [
      syllables.slice(0, c1).join(''),
      syllables.slice(c1, c1 + c2).join(''),
      syllables.slice(c1 + c2).join('')
    ];
  } else {
    const len = word.length;
    if (len >= 3) {
      const p1 = Math.ceil(len / 3);
      const p2 = Math.ceil((len - p1) / 2);
      parts = [word.slice(0, p1), word.slice(p1, p1 + p2), word.slice(p1 + p2)];
    } else {
      parts = [word, '•', ''];
    }
  }
  return {
    cleanName: word,
    parts,
    formatted: `${parts[0]} • ${parts[1]} • ${parts[2]}`
  };
}

/**
 * Koleksiyon ana fotoğrafını 3240x1350 panoramik şerit olarak kesintisiz tonlar,
 * ardından Sol (1/3 - Post 01 Reveal), Orta (2/3 - Post 02 Breakdown) ve Sağ (3/3 - Post 03 Design Story)
 * kapak görsellerini hem 1080x1350 (4:5 Grid) hem de 1080x1920 (9:16 Reels Merkez 4:5 Korumalı) olarak üretir.
 */
export async function renderTriptychCovers(entity) {
  const sharp = await getSharp();
  if (!entity.heroUrl) throw new Error(`"${entity.title}" koleksiyonunun ana tanıtım görseli eksik.`);
  const heroBuf = await loadImage(entity.heroUrl);
  const GAP = 6;             // Instagram profil ızgarasındaki sütunlar arası siyah çizginin 1080 ölçeğindeki karşılığı (6px)
  const W3 = CAROUSEL_W * 3 + GAP * 2; // 3252
  const H_GRID = 1440;       // Instagram 3:4 profil ızgara hücresi yüksekliği (1080x1440)
  const H_CAROUSEL = CAROUSEL_H; // 1350 (4:5 Carousel slayt yüksekliği)

  // 1. 3252x1440 tek parça kesintisiz panoramik zemin (3 adet 1080x1440 3:4 ızgara hücresi + 2x 6px sütun ayracı)
  const wide = await sharp(heroBuf).rotate().resize(W3, H_GRID, { fit: 'cover', position: 'centre' }).toBuffer();

  const splitInfo = splitCollectionNameIntoThree(entity.title);
  const cleanWord = String(splitInfo.cleanWord || trUpper(entity.title).split(/\s+/)[0] || 'NOVA')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ÇERÇEVE: BÜYÜK FOTOĞRAFIN DIŞ KENARLARINA (Yazının etrafına değil)
  // YAZI: Tek seferde tüm 3252x1440 görseli baştan sona kaplayan hafif şeffaf ama net koleksiyon ismi
  const m1 = 44;
  const m2 = 58;
  const masterSvg = `<svg width="${W3}" height="${H_GRID}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="softVignette" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.30"/>
        <stop offset="30%" stop-color="#000000" stop-opacity="0.05"/>
        <stop offset="70%" stop-color="#000000" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.35"/>
      </linearGradient>
      <filter id="textGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.65"/>
      </filter>
      <filter id="frameShadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#000000" flood-opacity="0.7"/>
      </filter>
    </defs>
    <rect width="${W3}" height="${H_GRID}" fill="url(#softVignette)"/>
    <rect x="${m1}" y="${m1}" width="${W3 - m1 * 2}" height="${H_GRID - m1 * 2}"
          fill="none" stroke="${BRAND.gold}" stroke-width="3.2" stroke-opacity="0.88" filter="url(#frameShadow)"/>
    <rect x="${m2}" y="${m2}" width="${W3 - m2 * 2}" height="${H_GRID - m2 * 2}"
          fill="none" stroke="#ffffff" stroke-width="1.3" stroke-opacity="0.48"/>
    <line x1="${m1 - 12}" y1="${m1}" x2="${m1 + 48}" y2="${m1}" stroke="${BRAND.gold}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${m1}" y1="${m1 - 12}" x2="${m1}" y2="${m1 + 48}" stroke="${BRAND.gold}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${W3 - m1 - 48}" y1="${m1}" x2="${W3 - m1 + 12}" y2="${m1}" stroke="${BRAND.gold}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${W3 - m1}" y1="${m1 - 12}" x2="${W3 - m1}" y2="${m1 + 48}" stroke="${BRAND.gold}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${m1 - 12}" y1="${H_GRID - m1}" x2="${m1 + 48}" y2="${H_GRID - m1}" stroke="${BRAND.gold}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${m1}" y1="${H_GRID - m1 - 48}" x2="${m1}" y2="${H_GRID - m1 + 12}" stroke="${BRAND.gold}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${W3 - m1 - 48}" y1="${H_GRID - m1}" x2="${W3 - m1 + 12}" y2="${H_GRID - m1}" stroke="${BRAND.gold}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${W3 - m1}" y1="${H_GRID - m1 - 48}" x2="${W3 - m1}" y2="${H_GRID - m1 + 12}" stroke="${BRAND.gold}" stroke-width="4.5" stroke-opacity="0.95"/>
    <text x="${W3 / 2}" y="${H_GRID / 2 + 195}"
          text-anchor="middle"
          font-family="${TITLE_FONT}"
          font-size="560"
          font-weight="700"
          textLength="2992"
          lengthAdjust="spacingAndGlyphs"
          fill="#ffffff"
          fill-opacity="0.36"
          stroke="#ffffff"
          stroke-width="4"
          stroke-opacity="0.72"
          filter="url(#textGlow)">${cleanWord}</text>

    <!-- Orta Gönderi İçin Zarif Marka & Kaydırma Yönlendirmesi -->
    <text x="${W3 / 2}" y="185" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="22" font-weight="800" letter-spacing="8" fill="#ffffff" filter="url(#textGlow)">${BRAND.name}</text>
    <text x="${W3 / 2}" y="1225" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="18" font-weight="600" letter-spacing="5" fill="#ffffff" filter="url(#textGlow)">İNCELEMEK İÇİN KAYDIRIN  →</text>
  </svg>`;

  const masterWide = await sharp(wide)
    .composite([{ input: Buffer.from(masterSvg) }])
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const tiles4x5 = [];
  const tiles9x16 = [];

  // 9:16 Reels kapakları için bulanık arka plan
  const blurredBg9x16 = await sharp(heroBuf)
    .rotate()
    .resize(VW, VH, { fit: 'cover', position: 'centre' })
    .blur(35)
    .modulate({ brightness: 0.35 })
    .jpeg({ quality: 90 })
    .toBuffer();

  // Reels 9:16 kapaklarında 1080x1440 (3:4) dilim tam merkeze (top = (1920 - 1440)/2 = 240) yerleştirilir
  const reelGridTopOffset = Math.round((VH - H_GRID) / 2); // 240

  // 4:5 Carousel (1080x1350) için Instagram'ın 3:4 profil ızgarasında uyguladığı 1440/1350 (1.06667x) yakınlaştırmayı
  // sıfırlamak üzere ana 3252x1440 görselden 1152x1440 (tam 4:5) kesip 1080x1350'ye ölçekliyoruz
  const wCarouselExtract = Math.round(CAROUSEL_W * (H_GRID / H_CAROUSEL)); // 1152
  const halfExtra = Math.round((wCarouselExtract - CAROUSEL_W) / 2); // 36
  const m1c = (m1 * H_CAROUSEL / H_GRID).toFixed(2);
  const m2c = (m2 * H_CAROUSEL / H_GRID).toFixed(2);
  const crispFrameBoostSvg = `<svg width="${CAROUSEL_W}" height="${H_CAROUSEL}" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="${m1c}" x2="${CAROUSEL_W}" y2="${m1c}" stroke="${BRAND.gold}" stroke-width="2.6" stroke-opacity="0.42"/>
    <line x1="0" y1="${(H_CAROUSEL - m1 * H_CAROUSEL / H_GRID).toFixed(2)}" x2="${CAROUSEL_W}" y2="${(H_CAROUSEL - m1 * H_CAROUSEL / H_GRID).toFixed(2)}" stroke="${BRAND.gold}" stroke-width="2.6" stroke-opacity="0.42"/>
    <line x1="0" y1="${m2c}" x2="${CAROUSEL_W}" y2="${m2c}" stroke="#ffffff" stroke-width="1.1" stroke-opacity="0.22"/>
    <line x1="0" y1="${(H_CAROUSEL - m2 * H_CAROUSEL / H_GRID).toFixed(2)}" x2="${CAROUSEL_W}" y2="${(H_CAROUSEL - m2 * H_CAROUSEL / H_GRID).toFixed(2)}" stroke="#ffffff" stroke-width="1.1" stroke-opacity="0.22"/>
  </svg>`;

  // 2. Yazı ve dış çerçeve işlendikten sonra görseli kusursuz 3 parçaya böl
  for (let idx = 0; idx < 3; idx++) {
    const colLeft = idx * (CAROUSEL_W + GAP);
    const panel3x4 = await sharp(masterWide)
      .extract({ left: colLeft, top: 0, width: CAROUSEL_W, height: H_GRID })
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
      .toBuffer();

    let tile4x5;
    if (idx === 1) {
      // Orta parça (Carousel Slide 1): 1152x1440 -> 1080x1350 + çerçeve renk/parlaklık dengelemesi
      tile4x5 = await sharp(masterWide)
        .extract({ left: colLeft - halfExtra, top: 0, width: wCarouselExtract, height: H_GRID })
        .resize(CAROUSEL_W, H_CAROUSEL, { kernel: sharp.kernel.lanczos3 })
        .composite([{ input: Buffer.from(crispFrameBoostSvg) }])
        .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
        .toBuffer();
    } else {
      tile4x5 = await sharp(panel3x4)
        .resize(CAROUSEL_W, H_CAROUSEL, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
        .toBuffer();
    }

    tiles4x5.push(tile4x5);

    const tile9x16 = await sharp(blurredBg9x16)
      .composite([{ input: panel3x4, top: reelGridTopOffset, left: 0 }])
      .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
      .toBuffer();

    tiles9x16.push(tile9x16);
  }

  return {
    splitInfo,
    left4x5: tiles4x5[0],
    center4x5: tiles4x5[1],
    right4x5: tiles4x5[2],
    left9x16: tiles9x16[0],
    center9x16: tiles9x16[1],
    right9x16: tiles9x16[2]
  };
}

/**
 * POST 02 — PRODUCT BREAKDOWN (Instagram Carousel)
 * Slayt 1: Koleksiyon Genel Sunum & Parça Özeti (Boş GA thumbnail sayfası konulmaz!)
 * Slayt 2..N: Her bir alt ürünün kendi doğrulanmış fotoğrafı, türü/adı ve doğrulanmış ölçüleri
 * Son Slayt: Koleksiyon Genel Özellikleri & İletişim Kartı
 */
export async function renderCollectionPost02Breakdown(entity, triptych = null) {
  const sharp = await getSharp();
  const slides = [];

  const pieces = (entity.pieces || []).filter(p => p.imageUrl && p.presentation !== 'video_only' && p.presentation !== 'hidden');
  const heroBuf = await loadImage(entity.heroUrl);

  // Slayt 1: Dijital Koleksiyon Kataloğu Kapak Slaytı (Triptych Center Dilimi — Kesintisiz Altın Çerçeve ve Tipografi)
  {
    if (triptych && triptych.center4x5) {
      slides.push(triptych.center4x5);
    } else {
      const W = CAROUSEL_W, H = CAROUSEL_H;
      const baseImg = await sharp(heroBuf).rotate().resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer();
      const topG = gradientRect(W, 200, 0, [[0, '#000', 0.55], [1, '#000', 0]]);
      let body = topG.body;
      body += textEl({ x: W / 2, y: 175, text: BRAND.name, size: 22, weight: 800, anchor: 'middle', spacing: 8, shadow: true });
      body += textEl({ x: W / 2, y: 1150, text: 'İNCELEMEK İÇİN KAYDIRIN  →', size: 18, weight: 600, fill: '#ffffff', anchor: 'middle', spacing: 5, shadow: true });
      const fallbackCover = await sharp(baseImg)
        .composite([{ input: svgDoc(W, H, body, topG.defs + SHADOW_DEF) }])
        .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
        .toBuffer();
      slides.push(fallbackCover);
    }
  }

  // Slayt 3..N: Alt Ürün Katalog Kartları (maksimum 7 parça slaytı -> toplam max 10 slayt)
  const maxPieceSlides = Math.min(pieces.length, 7);
  for (let i = 0; i < maxPieceSlides; i++) {
    slides.push(await pieceSlide(entity, pieces[i], i + 1, maxPieceSlides));
  }

  // Son Slayt: Koleksiyon Genel Özellikleri & İletişim Özeti (eğer 10 slayt sınırını aşmıyorsa)
  if (slides.length < 10 && entity.features && entity.features.length > 0) {
    const W = CAROUSEL_W, H = CAROUSEL_H;
    const baseImg = await sharp(heroBuf).rotate().resize(W, H, { fit: 'cover', position: 'centre' }).blur(18).modulate({ brightness: 0.35 }).toBuffer();
    let body = '';
    body += textEl({ x: 64, y: 92, text: BRAND.name, size: 24, weight: 700, spacing: 7 });
    body += `<rect x="64" y="220" width="${W - 128}" height="${H - 420}" rx="22" fill="rgba(15,23,42,0.86)" stroke="${BRAND.gold}" stroke-width="2" stroke-opacity="0.65"/>`;
    body += textEl({ x: W / 2, y: 310, text: 'GENEL ÖZELLİKLER & KALİTE STANDARTLARI', size: 26, weight: 700, fill: BRAND.gold, anchor: 'middle', spacing: 5 });
    body += textEl({ x: W / 2, y: 370, text: trUpper(entity.title), size: 46, font: TITLE_FONT, weight: 700, fill: '#fff', anchor: 'middle', spacing: 3 });
    body += `<rect x="${W / 2 - 70}" y="400" width="140" height="3" fill="${BRAND.gold}"/>`;

    let fy = 480;
    for (const feat of entity.features.slice(0, 5)) {
      for (const ln of wrapText(`✦  ${feat}`, 44, 2)) {
        body += textEl({ x: 110, y: fy, text: ln, size: 32, weight: 600, fill: '#f8fafc' });
        fy += 48;
      }
      fy += 18;
    }

    body += textEl({ x: W / 2, y: H - 120, text: `WhatsApp Sipariş & Bilgi: ${BRAND.whatsapp}`, size: 30, weight: 700, fill: BRAND.gold, anchor: 'middle', spacing: 3 });
    body += textEl({ x: W / 2, y: H - 72, text: BRAND.website, size: 24, weight: 600, fill: '#cbd5e1', anchor: 'middle', spacing: 4 });
    const summarySlide = await sharp(baseImg).composite([{ input: svgDoc(W, H, body, SHADOW_DEF) }]).jpeg({ quality: 93, chromaSubsampling: '4:4:4' }).toBuffer();
    slides.push(summarySlide);
  }

  return slides.slice(0, 10);
}

/**
 * Ortak Animasyonlu Karakter Yardımcıları (MO & BER Reels için)
 */
const escXml = xmlEscape;

function smoothstepAnim(x) {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

function buildAnimatedCharsTspans(text, t, startTime, charInterval, charFadeDur = 0.20, customFill = null) {
  const chars = Array.from(String(text || ''));
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') {
      out += '&#160;';
      continue;
    }
    const cStart = startTime + i * charInterval;
    const smoothOp = smoothstepAnim((t - cStart) / charFadeDur).toFixed(3);
    const fillAttr = customFill ? ` fill="${customFill}"` : '';
    out += `<tspan${fillAttr} fill-opacity="${smoothOp}">${escXml(ch)}</tspan>`;
  }
  return out;
}

function parsePieceDimensionsForHud(dimStr, idx = 0) {
  const s = String(dimStr || '');
  const findVal = (re, fb) => {
    const m = s.match(re);
    return m ? `${m[1]} cm` : fb;
  };
  const defaultEn = idx === 0 ? '80 cm' : (idx === 1 ? '120 cm' : '160 cm');
  const boyVal = findVal(/(?:yükseklik|boy|h)\s*[:=]?\s*(\d{2,3})/i, '200 cm');
  const enVal = findVal(/(?:genişlik|en|w)\s*[:=]?\s*(\d{2,3})/i, defaultEn);
  const genVal = findVal(/(?:derinlik|d)\s*[:=]?\s*(\d{2,3})/i, '45 cm');
  return { boyVal, enVal, genVal };
}

function splitPromoTextIntoThreeParts(entity) {
  const raw = clean(entity.promoQuote || entity.shortDescription || '');
  if (!raw || /en asil halini deneyimlemeye/i.test(raw)) {
    return [
      ['Yaşam alanınızda kahve keyfinin en asil halini', 'deneyimlemeye hazır mısınız?'],
      [`Modern çizgileri sıcak aydınlatma detaylarıyla`, `harmanlayan ${entity.title} Koleksiyonu,`],
      ['...titiz işçiliğiyle evinizin', 'en sevilen köşesi olmaya aday.']
    ];
  }
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length < 9) {
    return [
      wrapText(raw, 44, 2),
      wrapText(`${entity.title}, modern çizgileri ve özenli detaylarıyla yaşam alanınıza zarafet katar.`, 44, 2),
      wrapText('Titiz işçiliğiyle evinizin en sevilen köşesi olmaya aday.', 44, 2)
    ];
  }
  const third = Math.ceil(words.length / 3);
  const p1 = words.slice(0, third).join(' ');
  const p2 = words.slice(third, third * 2).join(' ');
  const p3 = words.slice(third * 2).join(' ');
  return [
    wrapText(p1, 44, 2),
    wrapText(p2, 44, 2),
    wrapText(p3.startsWith('...') ? p3 : `...${p3}`, 44, 2)
  ];
}

function buildFeatureCalloutItems(entity) {
  const feats = Array.isArray(entity.features) ? entity.features.filter(Boolean) : [];
  const defaults = [
    { title: 'SICAK LED AYDINLATMA', detail: 'Temperli Cam Vitrin & Entegre LED' },
    { title: 'GENİŞ BARİSTA TEZGÂHI', detail: 'Kahve Makinesi & Ekipman Alanı' },
    { title: '1. SINIF MDF GÖVDE', detail: 'Özel CNC Membran Kapak & Yüzey' }
  ];
  return [0, 1, 2].map(i => {
    const f = clean(feats[i] || '');
    if (!f || /bergamo/i.test(entity.slug || '')) return defaults[i];
    const parts = f.split(/[:–—-]/).map(x => x.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        title: trUpper(parts[0]).slice(0, 28),
        detail: parts.slice(1).join(' ').slice(0, 38)
      };
    }
    const w = f.split(/\s+/);
    return {
      title: trUpper(w.slice(0, 3).join(' ')).slice(0, 28),
      detail: f.slice(0, 38)
    };
  });
}

async function renderLuxuryBlackLogoOutroScene(tempDir, entity, duration = 4.6) {
  const sharp = await getSharp();
  const outroSvg = `<svg width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="og" cx="50%" cy="48%" r="68%">
        <stop offset="0%" stop-color="#231f1b"/>
        <stop offset="60%" stop-color="#13110f"/>
        <stop offset="100%" stop-color="#090807"/>
      </radialGradient>
    </defs>
    <rect width="${VW}" height="${VH}" fill="url(#og)"/>
    <rect x="64" y="64" width="${VW - 128}" height="${VH - 128}" fill="none" stroke="${BRAND.gold}" stroke-width="2" stroke-opacity="0.55"/>
    <rect x="80" y="80" width="${VW - 160}" height="${VH - 160}" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.22"/>
    <circle cx="${VW / 2}" cy="760" r="145" fill="none" stroke="${BRAND.gold}" stroke-width="2" stroke-opacity="0.4"/>
    <circle cx="${VW / 2}" cy="760" r="126" fill="none" stroke="${BRAND.gold}" stroke-width="1" stroke-opacity="0.22"/>
    <text x="${VW / 2}" y="788" text-anchor="middle" font-family="${TITLE_FONT}" font-size="82" font-weight="700" letter-spacing="12" fill="${BRAND.gold}">N</text>
    <text x="${VW / 2}" y="1020" text-anchor="middle" font-family="${BODY_FONT}" font-size="34" font-weight="700" letter-spacing="12" fill="#ffffff">${escXml(BRAND.name)}</text>
    <rect x="${VW / 2 - 110}" y="1058" width="220" height="2" fill="${BRAND.gold}" fill-opacity="0.75"/>
    <text x="${VW / 2}" y="1118" text-anchor="middle" font-family="${TITLE_FONT}" font-size="34" font-style="italic" letter-spacing="2" fill="#e2e8f0">${escXml(entity.title)}</text>
    <text x="${VW / 2}" y="1180" text-anchor="middle" font-family="${BODY_FONT}" font-size="21" font-weight="600" letter-spacing="6" fill="${BRAND.gold}">${escXml(BRAND.website)}</text>
    <text x="${VW / 2}" y="1230" text-anchor="middle" font-family="${BODY_FONT}" font-size="20" font-weight="500" letter-spacing="4" fill="#94a3b8">WhatsApp: ${escXml(BRAND.whatsapp)}</text>
  </svg>`;
  const outroJpg = path.join(tempDir, 'outro_luxury_black.jpg');
  await sharp(Buffer.from(outroSvg)).jpeg({ quality: 96 }).toFile(outroJpg);
  const outMp4 = path.join(tempDir, 'scene_outro_black.mp4');
  await runFfmpeg([
    '-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', outroJpg,
    '-vf', 'scale=1080:1920,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-an',
    outMp4
  ], { label: 'luxury_black_outro' });
  return { path: outMp4, duration, xfadeAfter: 0.9 };
}

async function stitchScenesAndMixMusic({ tempDir, scenes, entity, log, outFileName }) {
  const concatArgs = [];
  scenes.forEach(s => concatArgs.push('-i', s.path));

  let fc = scenes.map((_, i) => `[${i}:v]settb=AVTB[v${i}];`).join('');
  let offset = 0;
  let lastV = 'v0';
  let curLen = scenes[0].duration;
  for (let i = 1; i < scenes.length; i++) {
    const xf = scenes[i - 1].xfadeAfter || 0.9;
    offset = curLen - xf;
    const nextV = `x${i}`;
    fc += `[${lastV}][v${i}]xfade=transition=fade:duration=${xf.toFixed(3)}:offset=${offset.toFixed(3)}[${nextV}];`;
    lastV = nextV;
    curLen = offset + scenes[i].duration;
  }
  const totalDur = curLen;
  const videoNoAudio = path.join(tempDir, `${outFileName}_no_audio.mp4`);

  concatArgs.push(
    '-filter_complex', fc.replace(/;$/, ''),
    '-map', `[${lastV}]`,
    '-t', totalDur.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    videoNoAudio
  );
  await runFfmpeg(concatArgs, { label: `${outFileName}_stitch`, timeoutMs: 360000 });

  const music = await resolveMusic(tempDir, entity.prefs, log, entity.slug || entity.title || '');
  const finalPath = path.join(tempDir, `${outFileName}.mp4`);
  const fadeOutStart = Math.max(0, totalDur - 3.6).toFixed(2);

  if (music && music.path && fs.existsSync(music.path)) {
    const audioFilter = `[1:a]asetpts=N/SR/TB,atrim=0:${totalDur.toFixed(3)},afade=t=in:st=0:d=2.5,afade=t=out:st=${fadeOutStart}:d=3.5,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`;
    await runFfmpeg([
      '-i', videoNoAudio,
      '-stream_loop', '-1', '-i', music.path,
      '-filter_complex', audioFilter,
      '-map', '0:v', '-map', '[aout]',
      '-t', totalDur.toFixed(3),
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart',
      finalPath
    ], { label: `${outFileName}_mix_music`, timeoutMs: 180000 });
  } else {
    const ambientExpr = [
      '0.055*sin(2*PI*110*t)*(0.5+0.5*sin(2*PI*0.08*t))',
      '0.045*sin(2*PI*164.81*t)*(0.5+0.5*sin(2*PI*0.06*t+1))',
      '0.040*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.05*t+2))',
      '0.032*sin(2*PI*261.63*t)*(0.5+0.5*cos(2*PI*0.07*t))',
      '0.028*sin(2*PI*329.63*t)*(0.5+0.5*sin(2*PI*0.09*t+0.5))',
      '0.018*sin(2*PI*392.00*t)*(0.5+0.5*cos(2*PI*0.04*t+1.5))'
    ].join('+');
    const audioFilter = `[1:a]lowpass=f=900,aecho=0.8:0.88:120|240:0.35|0.25[pad];[2:a]lowpass=f=320,highpass=f=80,volume=0.14[air];[pad][air]amix=inputs=2:duration=first,afade=t=in:st=0:d=3.5,afade=t=out:st=${fadeOutStart}:d=3.5,loudnorm=I=-18:TP=-2.0:LRA=9[aout]`;
    await runFfmpeg([
      '-i', videoNoAudio,
      '-f', 'lavfi', '-t', totalDur.toFixed(3), '-i', `aevalsrc='${ambientExpr}|${ambientExpr}':s=48000`,
      '-f', 'lavfi', '-t', totalDur.toFixed(3), '-i', 'anoisesrc=c=pink:r=48000:a=0.008',
      '-filter_complex', audioFilter,
      '-map', '0:v', '-map', '[aout]',
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart',
      '-shortest',
      finalPath
    ], { label: `${outFileName}_synth_fallback`, timeoutMs: 180000 });
  }

  return { finalPath, totalDur, music };
}

/**
 * POST 01 — "BER" REELS (Instagram Reels | Sol 1/3 Kapak | 3. Yayınlanan Gönderi)
 * Amaç: Koleksiyon parçalarının tek başına var olduklarını, ölçülerini (Boy/En/Genişlik çizgi animasyonu)
 * ve ürün üzerindeki nokta+çizgi özelliklerini hafif kamera yakınlaştırmasıyla tanıtmak.
 */
export async function renderCollectionPost01Reveal(entity, triptych = null, { log = () => {} } = {}) {
  const sharp = await getSharp();
  const covers = triptych || await renderTriptychCovers(entity);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-post01-ber-'));
  const heroBuf = await loadImage(entity.heroUrl);

  const masterRoomPath = path.join(dir, 'master_room_4k.jpg');
  await sharp(heroBuf)
    .rotate()
    .resize(3840, 2144, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
    .modulate({ brightness: 1.02, saturation: 1.04 })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile(masterRoomPath);

  const topBrandSvg = `<svg width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gTopOnly" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.62"/>
        <stop offset="16%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="86%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <rect width="${VW}" height="${VH}" fill="url(#gTopOnly)"/>
    <text x="72" y="208" font-family="${BODY_FONT}" font-size="22" font-weight="700" letter-spacing="8" fill="#ffffff" fill-opacity="0.94">${escXml(BRAND.name)}</text>
    <text x="${VW - 72}" y="208" text-anchor="end" font-family="${BODY_FONT}" font-size="18" font-weight="600" letter-spacing="5" fill="${BRAND.gold}" fill-opacity="0.94">${escXml(trUpper(entity.title))}</text>
    <line x1="72" y1="232" x2="${VW - 72}" y2="232" stroke="${BRAND.gold}" stroke-width="1.3" stroke-opacity="0.45"/>
  </svg>`;
  const brandBarPng = path.join(dir, 'brand_bar.png');
  await sharp(Buffer.from(topBrandSvg)).png().toFile(brandBarPng);

  const pieces = (entity.pieces && entity.pieces.length)
    ? entity.pieces.slice(0, 4)
    : [
        { title: `${entity.title} — Küçük Modül`, dimensions: 'Yükseklik: 200 cm | Genişlik: 80 cm | Derinlik: 45 cm', imageUrl: entity.heroUrl },
        { title: `${entity.title} — Orta Modül`, dimensions: 'Yükseklik: 200 cm | Genişlik: 120 cm | Derinlik: 45 cm', imageUrl: entity.heroUrl },
        { title: `${entity.title} — Büyük Modül`, dimensions: 'Yükseklik: 200 cm | Genişlik: 160 cm | Derinlik: 45 cm', imageUrl: entity.heroUrl }
      ];

  const scenes = [];

  // ─── SAHNE 1 (7.6s): Genel Fotoğrafın Tamamını Soldan Sağa Baştan Sona Gezen Geçiş (ax: 0.00 -> 1.00) ───
  {
    const duration = 7.6;
    const seqDir = path.join(dir, 'seq_s1_opening_list');
    fs.mkdirSync(seqDir, { recursive: true });
    const totalFrames = Math.round(duration * FPS);
    const fadeOutStart = duration - 0.90;
    const fadeOutDur = 0.75;

    const pieceItems = pieces.map((p, idx) => ({
      name: clean(p.title),
      tStart: 1.35 + idx * 1.40
    }));

    async function renderOpeningFrame(f) {
      const t = f / FPS;
      let globalAlpha = 1.0;
      if (t > fadeOutStart) globalAlpha = 1.0 - smoothstepAnim((t - fadeOutStart) / fadeOutDur);

      let body = '';
      const cardH = Math.max(360, 185 + pieceItems.length * 80);
      const cardAlpha = smoothstepAnim((t - 0.20) / 0.55);
      if (cardAlpha > 0.01) {
        body += `<rect x="74" y="1285" width="${VW - 148}" height="${cardH}" rx="20" fill="rgba(10, 12, 16, ${(0.76 * cardAlpha).toFixed(3)})" stroke="${BRAND.gold}" stroke-width="1.4" stroke-opacity="${(0.45 * cardAlpha).toFixed(3)}"/>`;
      }

      const titleTspans = buildAnimatedCharsTspans(trUpper(entity.title), t, 0.35, 0.026, 0.20);
      body += `<text x="${VW / 2}" y="1358" xml:space="preserve" text-anchor="middle" font-family="${TITLE_FONT}" font-size="44" font-weight="700" letter-spacing="3" fill="#ffffff">${titleTspans}</text>`;

      const lineP = smoothstepAnim((t - 0.45) / 0.60);
      if (lineP > 0.01) {
        const lw = (180 * lineP).toFixed(1);
        body += `<rect x="${(VW / 2 - lw / 2).toFixed(1)}" y="1384" width="${lw}" height="2" fill="${BRAND.gold}" fill-opacity="${(0.85 * lineP).toFixed(3)}"/>`;
      }

      let py = 1456;
      for (const item of pieceItems) {
        if (t >= item.tStart) {
          const pAlpha = smoothstepAnim((t - item.tStart) / 0.30);
          body += `<circle cx="170" cy="${py - 14}" r="5.5" fill="${BRAND.gold}" fill-opacity="${pAlpha.toFixed(3)}"/>`;
          const nameTspans = buildAnimatedCharsTspans(item.name, t, item.tStart + 0.08, 0.028, 0.18);
          body += `<text x="200" y="${py - 4}" xml:space="preserve" font-family="${TITLE_FONT}" font-size="33" font-weight="600" letter-spacing="1" fill="#f8fafc">${nameTspans}</text>`;
        }
        py += 82;
      }

      const svg = `<svg width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#000000" flood-opacity="0.88"/>
          </filter>
        </defs>
        <g opacity="${globalAlpha.toFixed(3)}" filter="url(#sh)">${body}</g>
      </svg>`;
      await sharp(Buffer.from(svg)).png({ compressionLevel: 2 }).toFile(path.join(seqDir, `f_${String(f).padStart(4, '0')}.png`));
    }

    const BATCH = 16;
    for (let i = 0; i < totalFrames; i += BATCH) {
      const jobs = [];
      for (let j = i; j < Math.min(totalFrames, i + BATCH); j++) jobs.push(renderOpeningFrame(j));
      await Promise.all(jobs);
    }

    const s1Out = path.join(dir, 's1_opening.mp4');
    const ch = 2144, cw = Math.round((ch * 9 / 16) / 2) * 2;
    const e = `(0.5-0.5*cos(PI*t/${duration.toFixed(3)}))`;
    const xExpr = `(iw-${cw})*${e}`;
    const vChain = `[0:v]crop=w=${cw}:h=${ch}:x='${xExpr}':y='0':exact=1,scale=1080:1920:flags=lanczos,setsar=1,split[sharp][blurSrc];[blurSrc]gblur=sigma=14,fade=t=out:st=0.15:d=1.10:alpha=1[blurOv];[sharp][blurOv]overlay=0:0,format=yuv420p[bg0];[1:v]format=rgba[bb];[bg0][bb]overlay=0:0[bg1];[2:v]format=rgba[cd];[bg1][cd]overlay=0:0:shortest=1[vout]`;

    await runFfmpeg([
      '-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', masterRoomPath,
      '-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', brandBarPng,
      '-framerate', String(FPS), '-i', path.join(seqDir, 'f_%04d.png'),
      '-filter_complex', vChain,
      '-map', '[vout]', '-t', duration.toFixed(3), '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-an',
      s1Out
    ], { label: 'ber_s1_opening' });
    scenes.push({ path: s1Out, duration, xfadeAfter: 0.9 });
  }

  // ─── SAHNE 2..N (Her Biri 10.0s): Bağımsız Ürün Fotoğrafları + Hafif Yakınlaştırma + Animasyonlu Ölçü & Özellikler ───
  const studioDir = path.join(path.dirname(resolveMusicLibraryDir()), 'studio');
  const studioFiles = ['clean_p1_9x16.jpg', 'wide_p2_9x16.jpg', 'wide_p3_9x16.jpg'];
  const isBergamo = /bergamo/i.test(entity.slug || entity.title || '');
  const featCallouts = buildFeatureCalloutItems(entity);

  const layoutTemplates = [
    {
      zMax: 1.038,
      boy: { x: 118, yBot: 1812, yTop: 365, badgeX: 136, badgeY: 840 },
      en: { xLeft: 155, xRight: 918, y: 1852 },
      genislik: { x1: 912, y1: 1122, x2: 830, y2: 1055, badgeX: 605, badgeY: 1168 },
      callouts: [
        { dotX: 660, dotY: 575, elbowX: 605, lineY: 510, endX: 205, boxX: 185, boxY: 458, boxW: 525, boxH: 102, textX: 208, titleY: 495, detailY: 540, tDot: 4.30, tLine: 4.55, lineDur: 0.55, tText: 4.90 },
        { dotX: 670, dotY: 1475, elbowX: 615, lineY: 1410, endX: 205, boxX: 185, boxY: 1358, boxW: 535, boxH: 102, textX: 208, titleY: 1395, detailY: 1440, tDot: 6.30, tLine: 6.55, lineDur: 0.55, tText: 6.90 }
      ]
    },
    {
      zMax: 1.036,
      boy: { x: 88, yBot: 1636, yTop: 410, badgeX: 108, badgeY: 845 },
      en: { xLeft: 122, xRight: 958, y: 1682 },
      genislik: { x1: 955, y1: 1072, x2: 882, y2: 1015, badgeX: 625, badgeY: 1120 },
      callouts: [
        { dotX: 245, dotY: 615, elbowX: 305, lineY: 550, endX: 870, boxX: 350, boxY: 498, boxW: 545, boxH: 102, textX: 374, titleY: 535, detailY: 580, tDot: 4.30, tLine: 4.55, lineDur: 0.55, tText: 4.90 },
        { dotX: 705, dotY: 1380, elbowX: 650, lineY: 1315, endX: 250, boxX: 230, boxY: 1262, boxW: 545, boxH: 102, textX: 254, titleY: 1300, detailY: 1345, tDot: 6.30, tLine: 6.55, lineDur: 0.55, tText: 6.90 }
      ]
    },
    {
      zMax: 1.032,
      boy: { x: 56, yBot: 1588, yTop: 492, badgeX: 76, badgeY: 855 },
      en: { xLeft: 88, xRight: 992, y: 1638 },
      genislik: { x1: 765, y1: 1105, x2: 712, y2: 1055, badgeX: 485, badgeY: 1150 },
      callouts: [
        { dotX: 865, dotY: 675, elbowX: 805, lineY: 610, endX: 295, boxX: 275, boxY: 558, boxW: 555, boxH: 102, textX: 298, titleY: 595, detailY: 640, tDot: 4.30, tLine: 4.55, lineDur: 0.55, tText: 4.90 },
        { dotX: 605, dotY: 1355, elbowX: 550, lineY: 1290, endX: 225, boxX: 205, boxY: 1238, boxW: 550, boxH: 102, textX: 228, titleY: 1275, detailY: 1320, tDot: 6.30, tLine: 6.55, lineDur: 0.55, tText: 6.90 }
      ]
    }
  ];

  for (let idx = 0; idx < pieces.length; idx++) {
    const piece = pieces[idx];
    const tpl = layoutTemplates[Math.min(idx, layoutTemplates.length - 1)];
    const dims = parsePieceDimensionsForHud(piece.dimensions, idx);
    const duration = 10.0;
    const sceneName = `s_piece_${idx + 1}`;
    const pBase4k = path.join(dir, `${sceneName}_4k.jpg`);

    const prebuiltStudioPath = path.join(studioDir, studioFiles[idx] || '');
    if (isBergamo && studioFiles[idx] && fs.existsSync(prebuiltStudioPath)) {
      await sharp(prebuiltStudioPath)
        .resize(2160, 3840, { kernel: sharp.kernel.lanczos3 })
        .jpeg({ quality: 96 })
        .toFile(pBase4k);
    } else {
      const pBuf = await loadImage(piece.imageUrl || entity.heroUrl);
      const isWide = idx >= 2 || /160|180|200|büyük/i.test(`${piece.title} ${piece.dimensions}`);
      const targetW = isWide ? 1820 : (idx === 1 ? 1740 : 1620);
      const bg4k = await sharp(pBuf)
        .rotate()
        .resize(2160, 3840, { fit: 'cover' })
        .blur(48)
        .modulate({ brightness: 0.52, saturation: 0.88 })
        .toBuffer();
      const fg4k = await sharp(pBuf)
        .rotate()
        .resize(targetW, 2520, { fit: 'inside', withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
        .toBuffer();
      await sharp(bg4k)
        .composite([{ input: fg4k, gravity: 'center' }])
        .jpeg({ quality: 96 })
        .toFile(pBase4k);
    }

    const c0 = idx === 1
      ? { title: 'BOY CAM VİTRİN ÜNİTESİ', detail: 'Entegre Sıcak LED & Cam Raflar' }
      : (idx >= 2 ? { title: 'ÇİFT KULE VİTRİN MİMARİSİ', detail: 'Simetrik Cam Vitrin & Amber LED' } : featCallouts[0]);
    const c1 = idx === 1
      ? { title: '1. SINIF MDF & DEPOLAMA', detail: 'Özel CNC Membran Kapak & Çekmece' }
      : (idx >= 2 ? { title: 'MAKSİMUM HACİM & MDF GÖVDE', detail: 'Özel CNC Membran Kapak & Barista Alanı' } : featCallouts[2]);

    const cfg = {
      productTitle: trUpper(clean(piece.title)),
      boy: { ...tpl.boy, val: dims.boyVal },
      en: { ...tpl.en, val: dims.enVal },
      genislik: { ...tpl.genislik, val: dims.genVal },
      callouts: [
        { ...tpl.callouts[0], ...(isBergamo ? c0 : featCallouts[0]) },
        { ...tpl.callouts[1], ...(isBergamo ? c1 : featCallouts[2]) }
      ]
    };

    const seqDir = path.join(dir, `seq_${sceneName}`);
    fs.mkdirSync(seqDir, { recursive: true });
    const totalFrames = Math.round(duration * FPS);
    const fadeOutStart = duration - 0.85;
    const fadeOutDur = 0.70;
    const zMax = tpl.zMax;

    async function renderHudFrame(f) {
      const t = f / FPS;
      let globalAlpha = 1.0;
      if (t > fadeOutStart) globalAlpha = 1.0 - smoothstepAnim((t - fadeOutStart) / fadeOutDur);

      const eZoom = 0.5 - 0.5 * Math.cos((Math.PI * f) / totalFrames);
      const curZ = (1.0 + (zMax - 1.0) * eZoom).toFixed(5);

      let headerBody = '';
      const hdrAlpha = smoothstepAnim((t - 0.15) / 0.45);
      if (hdrAlpha > 0.01) {
        headerBody += `<rect x="84" y="258" width="${VW - 168}" height="78" rx="14" fill="rgba(10, 12, 16, ${(0.78 * hdrAlpha).toFixed(3)})" stroke="${BRAND.gold}" stroke-width="1.3" stroke-opacity="${(0.55 * hdrAlpha).toFixed(3)}"/>`;
        const prodTspans = buildAnimatedCharsTspans(cfg.productTitle, t, 0.28, 0.025, 0.18);
        headerBody += `<text x="${VW / 2}" y="309" xml:space="preserve" text-anchor="middle" font-family="${TITLE_FONT}" font-size="33" font-weight="700" letter-spacing="2" fill="#ffffff" filter="url(#sh)">${prodTspans}</text>`;
      }

      let trackedBody = '';
      const { boy, en, genislik, callouts } = cfg;

      // 1. Boy Ölçü Çizgisi (Aşağıdan Yukarıya)
      const tBoyStart = 0.95, boyLineDur = 0.80;
      if (t >= tBoyStart) {
        const pBoy = smoothstepAnim((t - tBoyStart) / boyLineDur);
        const curYTop = (boy.yBot + (boy.yTop - boy.yBot) * pBoy).toFixed(1);
        trackedBody += `<g filter="url(#sh)">`;
        trackedBody += `<line x1="${boy.x - 14}" y1="${boy.yBot}" x2="${boy.x + 14}" y2="${boy.yBot}" stroke="${BRAND.gold}" stroke-width="2.4"/>`;
        trackedBody += `<polygon points="${boy.x},${boy.yBot - 2} ${boy.x - 7},${boy.yBot - 18} ${boy.x + 7},${boy.yBot - 18}" fill="${BRAND.gold}"/>`;
        trackedBody += `<line x1="${boy.x}" y1="${boy.yBot}" x2="${boy.x}" y2="${curYTop}" stroke="${BRAND.gold}" stroke-width="2.4"/>`;
        if (pBoy > 0.92) {
          const topTickOp = ((pBoy - 0.92) / 0.08).toFixed(2);
          trackedBody += `<line x1="${boy.x - 14}" y1="${boy.yTop}" x2="${boy.x + 14}" y2="${boy.yTop}" stroke="${BRAND.gold}" stroke-width="2.4" stroke-opacity="${topTickOp}"/>`;
          trackedBody += `<polygon points="${boy.x},${boy.yTop + 2} ${boy.x - 7},${boy.yTop + 18} ${boy.x + 7},${boy.yTop + 18}" fill="${BRAND.gold}" fill-opacity="${topTickOp}"/>`;
        }
        const tBoyText = tBoyStart + 0.30;
        if (t >= tBoyText) {
          const bAlpha = smoothstepAnim((t - tBoyText) / 0.35);
          trackedBody += `<rect x="${boy.badgeX}" y="${boy.badgeY - 38}" width="236" height="54" rx="12" fill="rgba(10, 12, 16, ${(0.86 * bAlpha).toFixed(3)})" stroke="${BRAND.gold}" stroke-width="1.4" stroke-opacity="${bAlpha.toFixed(3)}"/>`;
          const lblTspans = buildAnimatedCharsTspans('Boy : ', t, tBoyText + 0.05, 0.028, 0.16, BRAND.gold);
          const valTspans = buildAnimatedCharsTspans(boy.val, t, tBoyText + 0.22, 0.030, 0.16, '#ffffff');
          trackedBody += `<text x="${boy.badgeX + 118}" y="${boy.badgeY - 3}" xml:space="preserve" text-anchor="middle" font-family="${BODY_FONT}" font-size="23" font-weight="700" letter-spacing="2" fill="#ffffff">${lblTspans}${valTspans}</text>`;
        }
        trackedBody += `</g>`;
      }

      // 2. En Ölçü Çizgisi (Soldan Sağa)
      const tEnStart = 2.15, enLineDur = 0.75;
      if (t >= tEnStart) {
        const pEn = smoothstepAnim((t - tEnStart) / enLineDur);
        const curXRight = (en.xLeft + (en.xRight - en.xLeft) * pEn).toFixed(1);
        trackedBody += `<g filter="url(#sh)">`;
        trackedBody += `<line x1="${en.xLeft}" y1="${en.y - 14}" x2="${en.xLeft}" y2="${en.y + 14}" stroke="${BRAND.gold}" stroke-width="2.4"/>`;
        trackedBody += `<polygon points="${en.xLeft + 2},${en.y} ${en.xLeft + 18},${en.y - 7} ${en.xLeft + 18},${en.y + 7}" fill="${BRAND.gold}"/>`;
        trackedBody += `<line x1="${en.xLeft}" y1="${en.y}" x2="${curXRight}" y2="${en.y}" stroke="${BRAND.gold}" stroke-width="2.4"/>`;
        if (pEn > 0.92) {
          const rTickOp = ((pEn - 0.92) / 0.08).toFixed(2);
          trackedBody += `<line x1="${en.xRight}" y1="${en.y - 14}" x2="${en.xRight}" y2="${en.y + 14}" stroke="${BRAND.gold}" stroke-width="2.4" stroke-opacity="${rTickOp}"/>`;
          trackedBody += `<polygon points="${en.xRight - 2},${en.y} ${en.xRight - 18},${en.y - 7} ${en.xRight - 18},${en.y + 7}" fill="${BRAND.gold}" fill-opacity="${rTickOp}"/>`;
        }
        const tEnText = tEnStart + 0.28;
        if (t >= tEnText) {
          const eAlpha = smoothstepAnim((t - tEnText) / 0.35);
          const cx = (en.xLeft + en.xRight) / 2;
          trackedBody += `<rect x="${cx - 118}" y="${en.y - 27}" width="236" height="54" rx="12" fill="rgba(10, 12, 16, ${(0.88 * eAlpha).toFixed(3)})" stroke="${BRAND.gold}" stroke-width="1.4" stroke-opacity="${eAlpha.toFixed(3)}"/>`;
          const lblTspans = buildAnimatedCharsTspans('En : ', t, tEnText + 0.05, 0.028, 0.16, BRAND.gold);
          const valTspans = buildAnimatedCharsTspans(en.val, t, tEnText + 0.20, 0.030, 0.16, '#ffffff');
          trackedBody += `<text x="${cx}" y="${en.y + 8}" xml:space="preserve" text-anchor="middle" font-family="${BODY_FONT}" font-size="23" font-weight="700" letter-spacing="2" fill="#ffffff">${lblTspans}${valTspans}</text>`;
        }
        trackedBody += `</g>`;
      }

      // 3. Genişlik Ölçü Çizgisi (Perspektif Açısıyla)
      const tGenStart = 3.30, genLineDur = 0.55;
      if (t >= tGenStart) {
        const pGen = smoothstepAnim((t - tGenStart) / genLineDur);
        const curX2 = (genislik.x1 + (genislik.x2 - genislik.x1) * pGen).toFixed(1);
        const curY2 = (genislik.y1 + (genislik.y2 - genislik.y1) * pGen).toFixed(1);
        trackedBody += `<g filter="url(#sh)">`;
        trackedBody += `<line x1="${genislik.x1}" y1="${genislik.y1}" x2="${curX2}" y2="${curY2}" stroke="${BRAND.gold}" stroke-width="2.6"/>`;
        trackedBody += `<circle cx="${genislik.x1}" cy="${genislik.y1}" r="5" fill="${BRAND.gold}"/>`;
        if (pGen > 0.90) trackedBody += `<circle cx="${genislik.x2}" cy="${genislik.y2}" r="5" fill="${BRAND.gold}"/>`;
        const tGenText = tGenStart + 0.22;
        if (t >= tGenText) {
          const gAlpha = smoothstepAnim((t - tGenText) / 0.35);
          trackedBody += `<rect x="${genislik.badgeX}" y="${genislik.badgeY - 38}" width="286" height="54" rx="12" fill="rgba(10, 12, 16, ${(0.86 * gAlpha).toFixed(3)})" stroke="${BRAND.gold}" stroke-width="1.4" stroke-opacity="${gAlpha.toFixed(3)}"/>`;
          const lblTspans = buildAnimatedCharsTspans('Genişlik : ', t, tGenText + 0.05, 0.025, 0.16, BRAND.gold);
          const valTspans = buildAnimatedCharsTspans(genislik.val, t, tGenText + 0.28, 0.028, 0.16, '#ffffff');
          trackedBody += `<text x="${genislik.badgeX + 143}" y="${genislik.badgeY - 3}" xml:space="preserve" text-anchor="middle" font-family="${BODY_FONT}" font-size="22" font-weight="700" letter-spacing="2" fill="#ffffff">${lblTspans}${valTspans}</text>`;
        }
        trackedBody += `</g>`;
      }

      // 4. Ürün Üzerinde Nokta + Uzayan Çizgi + Harf Harf Özellik Callout'ları
      for (const c of callouts) {
        if (t < c.tDot) continue;
        const dotProg = smoothstepAnim((t - c.tDot) / 0.32);
        const pulse = 1.0 + 0.14 * Math.sin(Math.max(0, t - c.tDot) * 5.5);
        const outerR = (15 * dotProg * pulse).toFixed(2);
        const innerR = (6.5 * dotProg).toFixed(2);

        const lineProg = smoothstepAnim((t - c.tLine) / c.lineDur);
        let polyStr = '';
        if (lineProg > 0.01) {
          const seg1P = Math.min(1, lineProg / 0.28);
          const curElbowX = (c.dotX + (c.elbowX - c.dotX) * seg1P).toFixed(1);
          const curElbowY = (c.dotY + (c.lineY - c.dotY) * seg1P).toFixed(1);
          if (lineProg <= 0.28) {
            polyStr = `${c.dotX},${c.dotY} ${curElbowX},${curElbowY}`;
          } else {
            const seg2P = (lineProg - 0.28) / 0.72;
            const curEndX = (c.elbowX + (c.endX - c.elbowX) * seg2P).toFixed(1);
            polyStr = `${c.dotX},${c.dotY} ${c.elbowX},${c.lineY} ${curEndX},${c.lineY}`;
          }
        }

        const boxAlpha = smoothstepAnim((t - c.tLine) / 0.45);
        if (boxAlpha > 0.01) {
          trackedBody += `<rect x="${c.boxX}" y="${c.boxY}" width="${c.boxW}" height="${c.boxH}" rx="14" fill="rgba(10, 12, 16, ${(0.76 * boxAlpha).toFixed(3)})" stroke="${BRAND.gold}" stroke-width="1" stroke-opacity="${(0.40 * boxAlpha).toFixed(3)}"/>`;
        }
        if (polyStr) {
          trackedBody += `<polyline points="${polyStr}" fill="none" stroke="${BRAND.gold}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#sh)"/>`;
        }
        trackedBody += `<circle cx="${c.dotX}" cy="${c.dotY}" r="${outerR}" fill="${BRAND.gold}" fill-opacity="${(0.30 * dotProg).toFixed(3)}" stroke="${BRAND.gold}" stroke-width="2" stroke-opacity="${(0.95 * dotProg).toFixed(3)}" filter="url(#glow)"/>`;
        trackedBody += `<circle cx="${c.dotX}" cy="${c.dotY}" r="${innerR}" fill="#ffffff" stroke="${BRAND.gold}" stroke-width="2.5"/>`;

        if (t >= c.tText) {
          const titleTspans = buildAnimatedCharsTspans(c.title, t, c.tText, 0.025, 0.16);
          const detailStart = c.tText + Array.from(c.title).length * 0.020;
          const detailTspans = buildAnimatedCharsTspans(c.detail, t, detailStart, 0.024, 0.18);
          trackedBody += `<text x="${c.textX}" y="${c.titleY}" xml:space="preserve" font-family="${BODY_FONT}" font-size="19" font-weight="700" letter-spacing="3.5" fill="${BRAND.gold}" filter="url(#sh)">${titleTspans}</text>`;
          trackedBody += `<text x="${c.textX}" y="${c.detailY}" xml:space="preserve" font-family="${TITLE_FONT}" font-size="25" font-style="italic" font-weight="500" fill="#ffffff" filter="url(#sh)">${detailTspans}</text>`;
        }
      }

      const svg = `<svg width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000000" flood-opacity="0.9"/>
          </filter>
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${BRAND.gold}" flood-opacity="0.95"/>
          </filter>
        </defs>
        <g opacity="${globalAlpha.toFixed(3)}">
          <g transform="translate(540, 960) scale(${curZ}) translate(-540, -960)">
            ${trackedBody}
          </g>
          ${headerBody}
        </g>
      </svg>`;
      await sharp(Buffer.from(svg)).png({ compressionLevel: 2 }).toFile(path.join(seqDir, `f_${String(f).padStart(4, '0')}.png`));
    }

    const BATCH = 16;
    for (let i = 0; i < totalFrames; i += BATCH) {
      const jobs = [];
      for (let j = i; j < Math.min(totalFrames, i + BATCH); j++) jobs.push(renderHudFrame(j));
      await Promise.all(jobs);
    }

    const pOut = path.join(dir, `${sceneName}.mp4`);
    const frames = Math.round(duration * FPS);
    const e = `(0.5-0.5*cos(PI*on/${frames}))`;
    const zExpr = `1.00+${(zMax - 1.0).toFixed(4)}*${e}`;
    const vChain = `[0:v]zoompan=z='${zExpr}':x='(iw-iw/zoom)*0.5':y='(ih-ih/zoom)*0.5':d=${frames}:s=2160x3840:fps=${FPS},scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p[bg0];[1:v]format=rgba[bb];[bg0][bb]overlay=0:0[bg1];[2:v]format=rgba[hud];[bg1][hud]overlay=0:0:shortest=1,format=yuv420p[vout]`;

    await runFfmpeg([
      '-i', pBase4k,
      '-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', brandBarPng,
      '-framerate', String(FPS), '-i', path.join(seqDir, 'f_%04d.png'),
      '-filter_complex', vChain,
      '-map', '[vout]', '-t', duration.toFixed(3), '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-an',
      pOut
    ], { label: `ber_${sceneName}` });
    scenes.push({ path: pOut, duration, xfadeAfter: 0.9 });
  }

  // ─── SON SAHNE (4.6s): Siyah Arka Planlı Logolu Kapanış ───
  scenes.push(await renderLuxuryBlackLogoOutroScene(dir, entity, 4.6));

  const { finalPath, totalDur, music } = await stitchScenesAndMixMusic({
    tempDir: dir,
    scenes,
    entity,
    log,
    outFileName: 'post01_ber_product_showcase'
  });

  return {
    path: finalPath,
    duration: Number(totalDur.toFixed(2)),
    hasMusic: !!music,
    musicKey: music?.key || null,
    workDir: dir,
    coverBuffer9x16: covers.left9x16,
    coverBuffer4x5: covers.left4x5,
    postIndex: 1,
    role: 'COLLECTION_REVEAL'
  };
}

/**
 * POST 03 — "MO" REELS (Instagram Reels | Sağ 3/3 Kapak | 1. Yayınlanan Gönderi)
 * Amaç: Koleksiyonun genel atmosferini, tanıtım metnini 3 parçada zarif harf harf akışla,
 * ortadaki ürün üzerinde 3 nokta+çizgi özellik animasyonuyla ve 8.2 saniyelik çok yavaş panoramik finalle sunmak.
 */
export async function renderCollectionPost03DesignStory(entity, triptych = null, { log = () => {} } = {}) {
  const sharp = await getSharp();
  const covers = triptych || await renderTriptychCovers(entity);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-post03-mo-'));
  const heroBuf = await loadImage(entity.heroUrl);

  const masterRoomPath = path.join(dir, 'master_room_4k.jpg');
  await sharp(heroBuf)
    .rotate()
    .resize(3840, 2144, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
    .modulate({ brightness: 1.02, saturation: 1.04 })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile(masterRoomPath);

  const baseW = 1206, baseH = 2144;
  const leftCrop = Math.max(0, Math.min(3840 - baseW, Math.round((3840 - baseW) * 0.495)));
  const center9x16Path = path.join(dir, 'center_product_4k_9x16.jpg');
  await sharp(masterRoomPath)
    .extract({ left: leftCrop, top: 0, width: baseW, height: baseH })
    .resize(2160, 3840, { kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile(center9x16Path);

  const topBrandSvg = `<svg width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gAmbient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.58"/>
        <stop offset="20%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="68%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="85%" stop-color="#000000" stop-opacity="0.50"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.84"/>
      </linearGradient>
      <radialGradient id="warmSun" cx="20%" cy="25%" r="75%">
        <stop offset="0%" stop-color="#ffb84d" stop-opacity="0.13"/>
        <stop offset="50%" stop-color="#ff9933" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${VW}" height="${VH}" fill="url(#warmSun)"/>
    <rect width="${VW}" height="${VH}" fill="url(#gAmbient)"/>
    <text x="72" y="208" font-family="${BODY_FONT}" font-size="22" font-weight="700" letter-spacing="8" fill="#ffffff" fill-opacity="0.94">${escXml(BRAND.name)}</text>
    <text x="${VW - 72}" y="208" text-anchor="end" font-family="${BODY_FONT}" font-size="18" font-weight="600" letter-spacing="5" fill="${BRAND.gold}" fill-opacity="0.94">${escXml(trUpper(entity.title))}</text>
    <line x1="72" y1="232" x2="${VW - 72}" y2="232" stroke="${BRAND.gold}" stroke-width="1.3" stroke-opacity="0.45"/>
  </svg>`;
  const brandBarPng = path.join(dir, 'brand_bar.png');
  await sharp(Buffer.from(topBrandSvg)).png().toFile(brandBarPng);

  async function renderTypewriterCardSequence(sceneName, duration, {
    eyebrow = '',
    title = '',
    lines = [],
    footer = '',
    writeStart = 0.45,
    writeEnd = null,
    maxCharInterval = 0.052,
    charFadeDur = 0.22
  }) {
    const seqDir = path.join(dir, `seq_${sceneName}`);
    fs.mkdirSync(seqDir, { recursive: true });
    const totalFrames = Math.round(duration * FPS);
    const fadeOutStart = duration - 0.95;
    const fadeOutDur = 0.80;

    const segments = [];
    if (eyebrow) segments.push({ type: 'eyebrow', text: eyebrow, weight: 0.65 });
    if (title) segments.push({ type: 'title', text: title, weight: 0.95 });
    for (const ln of lines) segments.push({ type: 'line', text: ln, weight: 1.0 });
    if (footer) segments.push({ type: 'footer', text: footer, weight: 0.65 });

    const totalChars = segments.reduce((acc, s) => acc + Array.from(s.text).length, 0);
    const targetWriteSpan = (writeEnd || Math.min(duration - 1.9, Math.max(2.4, duration * 0.56))) - writeStart;
    const baseCharInterval = Math.max(0.022, Math.min(maxCharInterval, targetWriteSpan / Math.max(12, totalChars)));

    let cursorTime = writeStart;
    for (const seg of segments) {
      seg.startTime = cursorTime;
      seg.charInterval = baseCharInterval * seg.weight;
      cursorTime += Array.from(seg.text).length * seg.charInterval + 0.14;
    }

    const cardH = 380;
    async function renderSingleFrame(f) {
      const t = f / FPS;
      let globalAlpha = 1.0;
      if (t > fadeOutStart) globalAlpha = 1.0 - smoothstepAnim((t - fadeOutStart) / fadeOutDur);

      let y = 56;
      let body = '';
      for (const seg of segments) {
        if (seg.type === 'eyebrow') {
          const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, charFadeDur);
          body += `<text x="${VW / 2}" y="${y}" xml:space="preserve" text-anchor="middle" font-family="${BODY_FONT}" font-size="21" font-weight="700" letter-spacing="6" fill="${BRAND.gold}">${tspans}</text>`;
          y += 48;
        } else if (seg.type === 'title') {
          const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, charFadeDur + 0.04);
          body += `<text x="${VW / 2}" y="${y}" xml:space="preserve" text-anchor="middle" font-family="${TITLE_FONT}" font-size="48" font-weight="700" letter-spacing="3" fill="#ffffff">${tspans}</text>`;
          y += 24;
          const titleDur = Array.from(seg.text).length * seg.charInterval;
          const smoothLine = smoothstepAnim((t - seg.startTime) / Math.max(0.4, titleDur));
          const lineW = (120 * smoothLine).toFixed(1);
          if (smoothLine > 0.01) {
            body += `<rect x="${(VW / 2 - lineW / 2).toFixed(1)}" y="${y}" width="${lineW}" height="2" fill="${BRAND.gold}" fill-opacity="${(0.85 * smoothLine).toFixed(3)}"/>`;
          }
          y += 46;
        } else if (seg.type === 'line') {
          const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, charFadeDur + 0.04);
          body += `<text x="${VW / 2}" y="${y}" xml:space="preserve" text-anchor="middle" font-family="${TITLE_FONT}" font-size="35" font-style="italic" font-weight="500" letter-spacing="0.5" fill="#f8fafc">${tspans}</text>`;
          y += 50;
        } else if (seg.type === 'footer') {
          y += 8;
          const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, charFadeDur);
          body += `<text x="${VW / 2}" y="${y}" xml:space="preserve" text-anchor="middle" font-family="${BODY_FONT}" font-size="19" font-weight="600" letter-spacing="4" fill="${BRAND.gold}">${tspans}</text>`;
          y += 32;
        }
      }

      const svg = `<svg width="${VW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#000000" flood-opacity="0.88"/>
          </filter>
        </defs>
        <g opacity="${globalAlpha.toFixed(3)}" filter="url(#sh)">${body}</g>
      </svg>`;
      await sharp(Buffer.from(svg)).png({ compressionLevel: 2 }).toFile(path.join(seqDir, `f_${String(f).padStart(4, '0')}.png`));
    }

    const BATCH = 16;
    for (let i = 0; i < totalFrames; i += BATCH) {
      const jobs = [];
      for (let j = i; j < Math.min(totalFrames, i + BATCH); j++) jobs.push(renderSingleFrame(j));
      await Promise.all(jobs);
    }
    return { pattern: path.join(seqDir, 'f_%04d.png'), h: cardH };
  }

  async function renderProductCalloutsSequence(duration) {
    const seqDir = path.join(dir, 'seq_s4_callouts');
    fs.mkdirSync(seqDir, { recursive: true });
    const totalFrames = Math.round(duration * FPS);
    const fadeOutStart = duration - 0.85;
    const fadeOutDur = 0.70;
    const featItems = buildFeatureCalloutItems(entity);

    const callouts = [
      {
        dotX: 680, dotY: 610, elbowX: 625, lineY: 538, endX: 78,
        boxX: 58, boxY: 485, boxW: 548, boxH: 104,
        textX: 84, titleY: 523, detailY: 570,
        title: featItems[0].title, detail: featItems[0].detail,
        tDot: 0.45, tLine: 0.70, lineDur: 0.55, tText: 1.05
      },
      {
        dotX: 355, dotY: 1065, elbowX: 415, lineY: 1000, endX: 1002,
        boxX: 434, boxY: 948, boxW: 588, boxH: 104,
        textX: 458, titleY: 986, detailY: 1033,
        title: featItems[1].title, detail: featItems[1].detail,
        tDot: 3.05, tLine: 3.30, lineDur: 0.55, tText: 3.65
      },
      {
        dotX: 690, dotY: 1430, elbowX: 635, lineY: 1362, endX: 78,
        boxX: 58, boxY: 1310, boxW: 565, boxH: 104,
        textX: 84, titleY: 1348, detailY: 1395,
        title: featItems[2].title, detail: featItems[2].detail,
        tDot: 5.65, tLine: 5.90, lineDur: 0.55, tText: 6.25
      }
    ];

    async function renderSingleFrame(f) {
      const t = f / FPS;
      let globalAlpha = 1.0;
      if (t > fadeOutStart) globalAlpha = 1.0 - smoothstepAnim((t - fadeOutStart) / fadeOutDur);

      let body = '';
      for (const c of callouts) {
        if (t < c.tDot) continue;
        const dotProg = smoothstepAnim((t - c.tDot) / 0.32);
        const pulse = 1.0 + 0.14 * Math.sin(Math.max(0, t - c.tDot) * 5.5);
        const outerR = (15 * dotProg * pulse).toFixed(2);
        const innerR = (6.5 * dotProg).toFixed(2);

        const lineProg = smoothstepAnim((t - c.tLine) / c.lineDur);
        let polyStr = '';
        if (lineProg > 0.01) {
          const seg1P = Math.min(1, lineProg / 0.28);
          const curElbowX = (c.dotX + (c.elbowX - c.dotX) * seg1P).toFixed(1);
          const curElbowY = (c.dotY + (c.lineY - c.dotY) * seg1P).toFixed(1);
          if (lineProg <= 0.28) {
            polyStr = `${c.dotX},${c.dotY} ${curElbowX},${curElbowY}`;
          } else {
            const seg2P = (lineProg - 0.28) / 0.72;
            const curEndX = (c.elbowX + (c.endX - c.elbowX) * seg2P).toFixed(1);
            polyStr = `${c.dotX},${c.dotY} ${c.elbowX},${c.lineY} ${curEndX},${c.lineY}`;
          }
        }

        const boxAlpha = smoothstepAnim((t - c.tLine) / 0.45);
        if (boxAlpha > 0.01) {
          body += `<rect x="${c.boxX}" y="${c.boxY}" width="${c.boxW}" height="${c.boxH}" rx="14" fill="rgba(10, 12, 16, ${(0.72 * boxAlpha).toFixed(3)})" stroke="${BRAND.gold}" stroke-width="1" stroke-opacity="${(0.35 * boxAlpha).toFixed(3)}"/>`;
        }
        if (polyStr) {
          body += `<polyline points="${polyStr}" fill="none" stroke="${BRAND.gold}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#sh)"/>`;
        }
        body += `<circle cx="${c.dotX}" cy="${c.dotY}" r="${outerR}" fill="${BRAND.gold}" fill-opacity="${(0.30 * dotProg).toFixed(3)}" stroke="${BRAND.gold}" stroke-width="2" stroke-opacity="${(0.95 * dotProg).toFixed(3)}" filter="url(#glow)"/>`;
        body += `<circle cx="${c.dotX}" cy="${c.dotY}" r="${innerR}" fill="#ffffff" stroke="${BRAND.gold}" stroke-width="2.5"/>`;

        if (t >= c.tText) {
          const titleTspans = buildAnimatedCharsTspans(c.title, t, c.tText, 0.026, 0.16);
          const detailStart = c.tText + Array.from(c.title).length * 0.022;
          const detailTspans = buildAnimatedCharsTspans(c.detail, t, detailStart, 0.025, 0.18);
          body += `<text x="${c.textX}" y="${c.titleY}" xml:space="preserve" font-family="${BODY_FONT}" font-size="20" font-weight="700" letter-spacing="3.5" fill="${BRAND.gold}" filter="url(#sh)">${titleTspans}</text>`;
          body += `<text x="${c.textX}" y="${c.detailY}" xml:space="preserve" font-family="${TITLE_FONT}" font-size="26" font-style="italic" font-weight="500" fill="#ffffff" filter="url(#sh)">${detailTspans}</text>`;
        }
      }

      const svg = `<svg width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000000" flood-opacity="0.9"/>
          </filter>
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${BRAND.gold}" flood-opacity="0.95"/>
          </filter>
        </defs>
        <g opacity="${globalAlpha.toFixed(3)}">${body}</g>
      </svg>`;
      await sharp(Buffer.from(svg)).png({ compressionLevel: 2 }).toFile(path.join(seqDir, `f_${String(f).padStart(4, '0')}.png`));
    }

    const BATCH = 16;
    for (let i = 0; i < totalFrames; i += BATCH) {
      const jobs = [];
      for (let j = i; j < Math.min(totalFrames, i + BATCH); j++) jobs.push(renderSingleFrame(j));
      await Promise.all(jobs);
    }
    return { pattern: path.join(seqDir, 'f_%04d.png') };
  }

  async function renderPanScene({ name, duration, zFixed = 1.01, ax0 = 0.0, ax1 = 0.2, ay0 = 0.5, ay1 = 0.5, rackFocusOpen = false, cardSeq = null, cardY = 1410 }) {
    const outPath = path.join(dir, `${name}.mp4`);
    const args = ['-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', masterRoomPath];
    const ch = Math.round(2144 / zFixed / 2) * 2;
    const cw = Math.round((ch * 9 / 16) / 2) * 2;
    const e = `(0.5-0.5*cos(PI*t/${duration.toFixed(3)}))`;
    const axCur = `(${ax0}+(${ax1 - ax0})*${e})`;
    const ayCur = `(${ay0}+(${ay1 - ay0})*${e})`;
    const xExpr = `(iw-${cw})*${axCur}`;
    const yExpr = `(ih-${ch})*${ayCur}`;

    let vChain = `[0:v]crop=w=${cw}:h=${ch}:x='${xExpr}':y='${yExpr}':exact=1,scale=1080:1920:flags=lanczos,setsar=1`;
    if (rackFocusOpen) {
      vChain += `,split[sharp][blurSrc];[blurSrc]gblur=sigma=15,fade=t=out:st=0.15:d=1.20:alpha=1[blurOv];[sharp][blurOv]overlay=0:0`;
    }
    vChain += `,format=yuv420p[bg0];`;
    args.push('-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', brandBarPng);
    vChain += `[1:v]format=rgba[bb];[bg0][bb]overlay=0:0[bg1];`;

    let last = 'bg1';
    if (cardSeq) {
      args.push('-framerate', String(FPS), '-i', cardSeq.pattern);
      vChain += `[2:v]format=rgba[cd];[${last}][cd]overlay=x=0:y=${cardY}:shortest=1[vout]`;
      last = 'vout';
    } else {
      vChain = vChain.replace(/;$/, '');
    }

    args.push(
      '-filter_complex', vChain,
      '-map', `[${last}]`,
      '-t', duration.toFixed(3),
      '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-an',
      outPath
    );
    await runFfmpeg(args, { label: `mo_${name}` });
    return { path: outPath, duration };
  }

  async function renderCenterZoomScene({ name, duration, z0 = 1.13, z1 = 1.00, centerY = 0.48, cardSeq = null, cardY = 0 }) {
    const outPath = path.join(dir, `${name}.mp4`);
    const frames = Math.round(duration * FPS);
    const e = `(0.5-0.5*cos(PI*on/${frames}))`;
    const zExpr = `${z0}+(${z1 - z0})*${e}`;
    const xExpr = `(iw-iw/zoom)*0.5`;
    const yExpr = `(ih-ih/zoom)*${centerY}`;

    const args = ['-i', center9x16Path];
    let vChain = `[0:v]zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=2160x3840:fps=${FPS},scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p[bg0];`;
    args.push('-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', brandBarPng);
    vChain += `[1:v]format=rgba[bb];[bg0][bb]overlay=0:0[bg1];`;

    let last = 'bg1';
    if (cardSeq) {
      args.push('-framerate', String(FPS), '-i', cardSeq.pattern);
      vChain += `[2:v]format=rgba[cd];[${last}][cd]overlay=x=0:y=${cardY}:shortest=1[vout]`;
      last = 'vout';
    } else {
      vChain = vChain.replace(/;$/, '');
    }

    args.push(
      '-filter_complex', vChain,
      '-map', `[${last}]`,
      '-t', duration.toFixed(3),
      '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-an',
      outPath
    );
    await runFfmpeg(args, { label: `mo_${name}` });
    return { path: outPath, duration };
  }

  const [part1Lines, part2Lines, part3Lines] = splitPromoTextIntoThreeParts(entity);
  const scenes = [];

  // Sahne 1 (7.0s): Sinematik Bulanık Odak Açılışı + Tanıtım Metni 1. Parça
  const seq1 = await renderTypewriterCardSequence('s1', 7.0, {
    title: trUpper(entity.title),
    lines: part1Lines,
    writeStart: 0.55
  });
  scenes.push({
    ...(await renderPanScene({
      name: 's1_opening_window_bar',
      duration: 7.0,
      zFixed: 1.01,
      ax0: 0.00, ax1: 0.18,
      ay0: 0.50, ay1: 0.50,
      rackFocusOpen: true,
      cardSeq: seq1,
      cardY: 1385
    })),
    xfadeAfter: 1.0
  });

  // Sahne 2 (7.0s): Yavaş Dönüş + Tanıtım Metni 2. Parça
  const seq2 = await renderTypewriterCardSequence('s2', 7.0, {
    eyebrow: 'MİMARİ ATMOSFER & IŞIK',
    lines: part2Lines,
    writeStart: 0.45
  });
  scenes.push({
    ...(await renderPanScene({
      name: 's2_lounge_turn',
      duration: 7.0,
      zFixed: 1.01,
      ax0: 1.00, ax1: 0.80,
      ay0: 0.50, ay1: 0.50,
      cardSeq: seq2,
      cardY: 1450
    })),
    xfadeAfter: 1.0
  });

  // Sahne 3 (7.2s): Ortadaki Ürüne Odak + Hafif Geri Çekilme (z: 1.13 -> 1.00) + Tanıtım Metni 3. Parça
  const seq3 = await renderTypewriterCardSequence('s3', 7.2, {
    eyebrow: 'ZAMANSIZ İŞÇİLİK',
    lines: part3Lines,
    writeStart: 0.45
  });
  scenes.push({
    ...(await renderCenterZoomScene({
      name: 's3_center_pullback',
      duration: 7.2,
      z0: 1.13,
      z1: 1.00,
      centerY: 0.48,
      cardSeq: seq3,
      cardY: 1450
    })),
    xfadeAfter: 0.45
  });

  // Sahne 4 (9.5s): Ortadaki Ürüne Tekrar Hafif Yakınlaşma (z: 1.00 -> 1.10) + Ürün Üzerinde 3 Animasyonlu Nokta & Çizgi & Özellik
  const seq4Callouts = await renderProductCalloutsSequence(9.5);
  scenes.push({
    ...(await renderCenterZoomScene({
      name: 's4_animated_product_callouts',
      duration: 9.5,
      z0: 1.00,
      z1: 1.10,
      centerY: 0.48,
      cardSeq: seq4Callouts,
      cardY: 0
    })),
    xfadeAfter: 1.0
  });

  // Sahne 5 (8.2s): Soldan Sağa Çok Yavaş Panoramik Geçiş + Yavaş Harf Harf Yazılan Son Reklam Metni
  const seq5 = await renderTypewriterCardSequence('s5', 8.2, {
    eyebrow: trUpper(entity.title),
    title: BRAND.name,
    lines: ['Yaşam alanınıza değer katan zamansız koleksiyonlar.'],
    footer: `${BRAND.website}  •  ${BRAND.whatsapp}`,
    writeStart: 0.65,
    writeEnd: 6.35,
    maxCharInterval: 0.085,
    charFadeDur: 0.30
  });
  scenes.push({
    ...(await renderPanScene({
      name: 's5_slow_left_to_right_finale',
      duration: 8.2,
      zFixed: 1.00,
      ax0: 0.14, ax1: 0.72,
      ay0: 0.50, ay1: 0.50,
      cardSeq: seq5,
      cardY: 1370
    })),
    xfadeAfter: 1.0
  });

  // Sahne 6 (4.6s): Siyah Arka Planlı Logolu Kapanış
  scenes.push(await renderLuxuryBlackLogoOutroScene(dir, entity, 4.6));

  const { finalPath, totalDur, music } = await stitchScenesAndMixMusic({
    tempDir: dir,
    scenes,
    entity,
    log,
    outFileName: 'post03_mo_collection_intro'
  });

  return {
    path: finalPath,
    duration: Number(totalDur.toFixed(2)),
    hasMusic: !!music,
    musicKey: music?.key || null,
    workDir: dir,
    coverBuffer9x16: covers.right9x16,
    coverBuffer4x5: covers.right4x5,
    postIndex: 3,
    role: 'DESIGN_STORY'
  };
}

/**
 * 3 Gönderinin her biri için tekrarsız, amacına özel açıklama metni (Caption) üretir:
 * - Post 01 (COLLECTION REVEAL): Koleksiyonu tanıtır ve ilk izlenimi oluşturur.
 * - Post 02 (PRODUCT BREAKDOWN): Alt ürünleri ve doğrulanmış ölçülerini katalog düzeninde listeler.
 * - Post 03 (DESIGN STORY): Tasarım hikayesini, malzeme/doku uyumunu ve yaşam alanı atmosferini anlatır.
 */
export function buildCollectionPostCaption(entity, postIndex = 1, platform = 'instagram') {
  const name = trUpper(entity.title);
  const cat = entity.category ? ` | ${entity.category}` : '';
  const splitInfo = splitCollectionNameIntoThree(entity.title);
  const story = clean(entity.promoQuote || entity.shortDescription || '');
  const cta = `📩 Fiyat ve sipariş bilgisi için DM'den ulaşabilir veya WhatsApp hattımızdan yazabilirsiniz: ${BRAND.whatsapp}`;

  if (postIndex === 1) {
    // POST 01 — ÜRÜN & ÖLÇÜ TANITIMI
    const lines = [
      `✨ ${name}`,
      '',
      story || `${entity.title}, çağdaş çizgileri ve özenli işçiliğiyle yaşam alanınıza prestijli bir kimlik kazandırıyor.`,
      '',
      cta
    ];
    return lines.join('\n');
  }

  if (postIndex === 2) {
    // POST 02 — ÜRÜN DETAYLARI & ÖLÇÜLER
    const lines = [
      `📐 ${name}`,
      '',
      `${entity.title} ölçü ve tasarım bilgileri:`,
      ''
    ];
    for (const p of (entity.pieces || [])) {
      const d = detailLines(p.dimensions, 1)[0] || p.dimensions || '';
      lines.push(`▫️ ${p.title}${d ? ' — ' + d : ''}`);
    }
    if (entity.features && entity.features.length) {
      lines.push('', 'Öne Çıkan Özellikler:');
      for (const f of entity.features.slice(0, 4)) {
        lines.push(`• ${f}`);
      }
    }
    lines.push('', cta);
    return lines.join('\n');
  }

  // POST 03 — KOLEKSİYON TANITIMI
  const lines = [
    `🕯️ ${name}`,
    '',
    story || `Mekanda dinginlik, doku uyumu ve fonksiyonel estetik bir arada.`,
    ''
  ];
  if (entity.features && entity.features.length) {
    lines.push('Mimari & Tasarım Detayları:');
    for (const f of entity.features.slice(0, 4)) {
      lines.push(`✦ ${f}`);
    }
    lines.push('');
  }
  lines.push(cta);
  return lines.join('\n');
}

/**
 * Bir koleksiyon için 3'lü Instagram Kampanya Paketinin tamamını (Post 01 Reveal Reels, Post 02 Breakdown Carousel, Post 03 Design Story Reels)
 * üretir, Supabase Storage'a yükler ve önbelleğe kaydeder.
 */
export async function produceCollectionThreePostCampaign({ supabase, entity, log = console.log }) {
  // Her kampanya üretiminde assets/music klasöründeki dinamik müzik listesini Supabase'e senkronize et
  await syncMusicLibraryToSupabase(supabase, log);

  const sig = entitySignature(entity, 'three_post_campaign_v3');
  const cacheKey = `${entity.slug}:three_post_v3:${sig}`;
  const cache = await readCache(supabase);
  if (cache[cacheKey] && cache[cacheKey].post01 && cache[cacheKey].post02 && cache[cacheKey].post03) {
    return { ...cache[cacheKey], cached: true };
  }

  const folder = `${RENDER_FOLDER}/${entity.slug}/grid3-${sig}`;
  log(`[3'lü Koleksiyon Motoru] "${entity.title}" (${entity.slug}) için 3'lü Grid Kampanyası hazırlanıyor (Müzik Tercihi: ${entity.prefs?.music || 'auto'})...`);

  // 1. Triptych Kapakları (BER - GA - MO) üret ve yükle
  const triptych = await renderTriptychCovers(entity);
  const coverLeft4x5Url = await uploadFile(supabase, `${folder}/cover-post01-left-4x5.jpg`, triptych.left4x5, 'image/jpeg');
  const coverCenter4x5Url = await uploadFile(supabase, `${folder}/cover-post02-center-4x5.jpg`, triptych.center4x5, 'image/jpeg');
  const coverRight4x5Url = await uploadFile(supabase, `${folder}/cover-post03-right-4x5.jpg`, triptych.right4x5, 'image/jpeg');
  const coverLeft9x16Url = await uploadFile(supabase, `${folder}/cover-post01-left-9x16.jpg`, triptych.left9x16, 'image/jpeg');
  const coverRight9x16Url = await uploadFile(supabase, `${folder}/cover-post03-right-9x16.jpg`, triptych.right9x16, 'image/jpeg');

  // 2. POST 02 — PRODUCT BREAKDOWN (Carousel)
  const breakdownSlides = await renderCollectionPost02Breakdown(entity, triptych);
  const post02SlideUrls = [];
  for (let i = 0; i < breakdownSlides.length; i++) {
    const sUrl = await uploadFile(supabase, `${folder}/post02-slide-${i + 1}.jpg`, breakdownSlides[i], 'image/jpeg');
    post02SlideUrls.push(sUrl);
  }

  // 3. POST 01 — COLLECTION REVEAL ("BER" Reels — Bağımsız Ürün & Ölçü Sunumu)
  const post01Video = await renderCollectionPost01Reveal(entity, triptych, { log });
  let post01VideoUrl = '';
  try {
    const vBuf = fs.readFileSync(post01Video.path);
    post01VideoUrl = await uploadFile(supabase, `${folder}/post01-reveal.mp4`, vBuf, 'video/mp4');
  } finally {
    try { fs.rmSync(post01Video.workDir, { recursive: true, force: true }); } catch (_) {}
  }

  // 4. POST 03 — DESIGN STORY ("MO" Reels — Sinematik Koleksiyon Tanıtımı)
  const post03Video = await renderCollectionPost03DesignStory(entity, triptych, { log });
  let post03VideoUrl = '';
  try {
    const vBuf = fs.readFileSync(post03Video.path);
    post03VideoUrl = await uploadFile(supabase, `${folder}/post03-design-story.mp4`, vBuf, 'video/mp4');
  } finally {
    try { fs.rmSync(post03Video.workDir, { recursive: true, force: true }); } catch (_) {}
  }

  const hashtags = buildHashtags(entity, 'instagram');
  const result = {
    slug: entity.slug,
    title: entity.title,
    category: entity.category,
    musicKey: post03Video.musicKey || post01Video.musicKey || null,
    splitInfo: triptych.splitInfo,
    covers: {
      left4x5: coverLeft4x5Url,
      center4x5: coverCenter4x5Url,
      right4x5: coverRight4x5Url,
      left9x16: coverLeft9x16Url,
      right9x16: coverRight9x16Url
    },
    post01: {
      postIndex: 1,
      role: 'COLLECTION_REVEAL',
      contentType: 'REELS',
      videoUrl: post01VideoUrl,
      coverUrl: coverLeft9x16Url,
      mediaUrlWithCover: `${post01VideoUrl}#cover=${encodeURIComponent(coverLeft9x16Url)}`,
      duration: post01Video.duration,
      musicKey: post01Video.musicKey,
      caption: buildCollectionPostCaption(entity, 1, 'instagram'),
      hashtags
    },
    post02: {
      postIndex: 2,
      role: 'PRODUCT_BREAKDOWN',
      contentType: 'CAROUSEL',
      slideUrls: post02SlideUrls,
      mediaUrl: JSON.stringify(post02SlideUrls),
      coverUrl: coverCenter4x5Url,
      slideCount: post02SlideUrls.length,
      caption: buildCollectionPostCaption(entity, 2, 'instagram'),
      hashtags
    },
    post03: {
      postIndex: 3,
      role: 'DESIGN_STORY',
      contentType: 'REELS',
      videoUrl: post03VideoUrl,
      coverUrl: coverRight9x16Url,
      mediaUrlWithCover: `${post03VideoUrl}#cover=${encodeURIComponent(coverRight9x16Url)}`,
      duration: post03Video.duration,
      musicKey: post03Video.musicKey,
      caption: buildCollectionPostCaption(entity, 3, 'instagram'),
      hashtags
    }
  };

  await writeCacheEntry(supabase, cacheKey, result);
  log(`[3'lü Koleksiyon Motoru] "${entity.title}" tamamlandı: Post01 (${post01Video.duration}s Reels, Müzik: ${post01Video.musicKey}), Post02 (${post02SlideUrls.length} Slayt Carousel), Post03 (${post03Video.duration}s Reels, Müzik: ${post03Video.musicKey}).`);
  return { ...result, cached: false };
}

export default {
  ENGINE_VERSION, BRAND, buildCatalogEntities, entitySignature, renderCarousel, renderVerticalVideo,
  buildCaption, buildHashtags, polishIntroWithGemini, produceMedia, prepareFormatPayload,
  wrapText, excerptQuote, detailLines, splitSentences,
  CAMPAIGN_THEMES, resolveCampaignTheme, campaignCoverSlide, campaignBridgeSlide, renderCampaignCarousel, buildCampaignCaption,
  splitCollectionNameIntoThree, renderTriptychCovers, renderCollectionPost01Reveal, renderCollectionPost02Breakdown,
  renderCollectionPost03DesignStory, buildCollectionPostCaption, produceCollectionThreePostCampaign,
  scanLocalMusicLibrary, syncMusicLibraryToSupabase, resolveMusic
};

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
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const requireFallback = createRequire(import.meta.url);

export const ENGINE_VERSION = 'cfe-1.0.0';

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
const XFADE = 0.8;
const CAROUSEL_W = 1080;
const CAROUSEL_H = 1350;
const VW = 1080;
const VH = 1920;

const MUSIC_KEYS = ['luxury_piano', 'modern_lofi', 'cinematic_strings', 'warm_acoustic', 'upbeat_interior'];
const PIECE_ROLE_LABELS = {
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

/** "Genişlik: 240 cm | Yükseklik: 210 cm" gibi ölçüleri satırlara böler. */
export function detailLines(dimensions, max = 3) {
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

  const PIECE_SLUG_REGEX = /-(?:vanity|main-bed|wardrobe|nightstand|dresser|mirror|bed|dolap|komodin|parca|part)-\d+$/i;
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
        const rawDims = clean(pc.dimensions || pc.olculer || row.body || '');
        const finalDims = rawDims || DEFAULT_PIECE_DIMS[role] || '';
        return {
          slug: pc.slug || `${slug}-parca-${i + 1}`,
          role,
          title: clean(pc.title || row.title || PIECE_ROLE_LABELS[role] || `Parça ${i + 1}`),
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
    m: entity.prefs?.music_preference, mu: entity.prefs?.custom_music_url, cam: entity.prefs?.camera,
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
  const buf = await fetchBuffer(url);
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
  body += textEl({ x: 60, y: 1010, text: total > 1 ? `${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : trUpper(entity.category || ''), size: 24, weight: 600, fill: BRAND.gold, spacing: 6 });
  body += textEl({ x: 60, y: 1010 + tSize + 14, text: title, size: tSize, font: TITLE_FONT, weight: 700, fill: BRAND.dark });
  let y = 1010 + tSize + 14 + 58;
  for (const d of details) {
    for (const ln of wrapText(d, 52, 2)) { body += textEl({ x: 62, y, text: ln, size: 30, fill: '#555' }); y += 42; }
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
    if (o.effect === 'wipe') {
      // Soldan sağa "yazılma" efekti: yumuşak kenarlı alfa maskesi
      const speed = ((o.w || VW) + 80) / Math.max(0.3, o.dur || 1.2);
      filter += `[${idx}:v]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*clip(((T-${st})*${speed.toFixed(1)}-X)/80,0,1)'[o${idx}];`;
    } else {
      filter += `[${idx}:v]format=rgba,fade=t=in:st=${st}:d=${d}:alpha=1[o${idx}];`;
    }
    const rise = o.rise || 0;
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
    case 'dolly_in': return { type: 'zoom', z0: 1.0, z1: 1.18, ax0: 0.5, ax1: 0.5, ay: 0.36 };
    case 'lateral_tracking': return { type: 'zoom', z0: 1.1, z1: 1.12, ax0: i % 2 ? 0.62 : 0.38, ax1: i % 2 ? 0.38 : 0.62, ay: 0.36 };
    case 'macro_detail': return { type: 'zoom', z0: 1.05, z1: 1.28, ax0: 0.5, ax1: 0.55, ay: 0.4 };
    case 'slow_push_in':
    default: return { type: 'zoom', z0: 1.0, z1: 1.1, ax0: 0.5, ax1: 0.5, ay: 0.36 };
  }
}

async function resolveMusic(dir, prefs, log) {
  const key = MUSIC_KEYS.includes(prefs?.music_preference) ? prefs.music_preference : 'luxury_piano';
  
  // 1. Önce yerel bundled müzik kütüphanesini kontrol et (en hızlı ve güvenilir)
  const currentDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const localCandidates = [
    path.join(currentDir, 'assets/music', `${key}.mp3`),
    path.join(currentDir, 'assets/music', 'luxury_piano.mp3'),
    path.join(currentDir, '../assets/music', `${key}.mp3`),
    'C:/Users/User/Desktop/Müzikler/Blue Hour Stereo.mp3'
  ];
  for (const lp of localCandidates) {
    if (fs.existsSync(lp)) {
      try {
        const dest = path.join(dir, 'music.mp3');
        fs.copyFileSync(lp, dest);
        log(`[Müzik] Yerel kütüphaneden yüklendi: ${path.basename(lp)} (${key})`);
        return { path: dest, url: lp, key };
      } catch (_) {}
    }
  }

  // 2. Supabase Storage üzerinden kontrol et
  const base = env('MUSIC_LIBRARY_BASE_URL', `${env('SUPABASE_URL', 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/$/, '')}/storage/v1/object/public/${MEDIA_BUCKET}/music`);
  const candidates = [];
  if (prefs?.music_preference === 'custom' && /^https:\/\//i.test(prefs?.custom_music_url || '')) candidates.push(prefs.custom_music_url);
  if (base && !base.startsWith('/')) {
    candidates.push(`${base}/${key}.mp3`);
    if (key !== 'luxury_piano') candidates.push(`${base}/luxury_piano.mp3`);
  }
  for (const url of candidates) {
    try {
      const buf = await fetchBuffer(url, 30000);
      const p = path.join(dir, 'music' + (path.extname(new URL(url).pathname) || '.mp3'));
      fs.writeFileSync(p, buf);
      log(`[Müzik] Supabase Storage üzerinden yüklendi: ${url}`);
      return { path: p, url, key };
    } catch (err) {
      log(`[Müzik] ${url} alınamadı: ${err.message}`);
    }
  }
  log('[Müzik UYARI] Müzik dosyası bulunamadı; video sessiz fon ile üretildi.');
  return null;
}

/**
 * 1080x1920 sinematik dikey video üretir. {path, duration, hasMusic, musicKey, scenes} döner.
 */
export async function renderVerticalVideo(entity, { log = () => {}, workDir } = {}) {
  const sharp = await getSharp();
  const dir = workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'nova-video-'));
  const scenes = [];
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
  const music = await resolveMusic(dir, entity.prefs, log);
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
    ? `[${a}:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutSt}:d=3,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`
    : `[${a}:a]aresample=48000[aout]`;
  const finalPath = path.join(dir, 'final.mp4');
  args.push('-filter_complex', fc, '-map', '[vout]', '-map', '[aout]', '-t', total.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-profile:v', 'high', '-level', '4.1', '-crf', '21', '-maxrate', '5M', '-bufsize', '10M',
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
  'tv': ['#tvünitesi', '#salondekorasyonu']
};
function slugTag(s) {
  return '#' + String(s || '').toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]+/g, '');
}
export function buildHashtags(entity, platform) {
  const cat = String(entity.category || '').toLocaleLowerCase('tr-TR');
  const tags = [slugTag(BRAND.name), '#globalmobilya'];
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
    const { data } = await supabase.from('site_settings').select('data').eq('key', RENDER_CACHE_KEY).maybeSingle();
    return (data && data.data) || {};
  } catch (_) { return {}; }
}
async function writeCacheEntry(supabase, key, value) {
  try {
    const cache = await readCache(supabase);
    cache[key] = { ...value, created_at: new Date().toISOString() };
    const keys = Object.keys(cache).sort((a, b) => String(cache[b].created_at).localeCompare(String(cache[a].created_at)));
    for (const k of keys.slice(300)) delete cache[k];
    await supabase.from('site_settings').upsert({ key: RENDER_CACHE_KEY, data: cache, updated_at: new Date().toISOString() });
  } catch (_) {}
}

async function uploadFile(supabase, objectPath, buffer, contentType) {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(objectPath, buffer, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(`Storage yükleme hatası (${objectPath}): ${error.message}`);
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
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

export default {
  ENGINE_VERSION, BRAND, buildCatalogEntities, entitySignature, renderCarousel, renderVerticalVideo,
  buildCaption, buildHashtags, polishIntroWithGemini, produceMedia, prepareFormatPayload,
  wrapText, excerptQuote, detailLines, splitSentences
};

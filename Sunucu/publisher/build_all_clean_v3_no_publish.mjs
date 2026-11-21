import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { fetchProductsCatalog, fetchSiteSetting } from './scheduler.js';
import { buildCatalogEntities, renderCollectionPost02Breakdown, renderTriptychCovers } from './collection-format-engine.js';

const outDir = 'C:/Users/User/.gemini/antigravity/brain/9efb0127-f0ed-4760-90e7-0c7d7461b346';
const scratchDir = path.join(outDir, 'scratch');
const heroPath = path.join(scratchDir, 'bergamo_original_hero.jpg');
const currentDir = path.resolve('C:/Users/User/Desktop/Insta_Deployment/Sunucu/publisher');
const ffmpegBin = path.join(currentDir, 'node_modules/ffmpeg-static/ffmpeg.exe');

const VW = 1080, VH = 1920, FPS = 30;
const TITLE_FONT = 'Playfair Display, Georgia, serif';
const BODY_FONT = 'Montserrat, Arial, sans-serif';
const BRAND_GOLD = '#C9A24B';

function runFfmpeg(args, label = 'ffmpeg') {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr = (stderr + d.toString()).slice(-4000); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${label} hata (${code}): ${stderr}`));
    });
  });
}

function escXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function smoothstep(x) {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

function buildAnimatedCharsTspans(text, t, startTime, charInterval, charFadeDur = 0.18, customFill = null) {
  const chars = Array.from(String(text || ''));
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') {
      out += '&#160;';
      continue;
    }
    const cStart = startTime + i * charInterval;
    const smoothOp = smoothstep((t - cStart) / charFadeDur).toFixed(3);
    const fillAttr = customFill ? ` fill="${customFill}"` : '';
    out += `<tspan${fillAttr} fill-opacity="${smoothOp}">${escXml(ch)}</tspan>`;
  }
  return out;
}

// ============================================================================
// 1. TRİPTİK KAPAKLAR & POST 02 CAROUSEL SLAYTLARI (İç Terimler Temizlenmiş)
// ============================================================================
async function rebuildCleanTriptychAndCarousel() {
  console.log('--- 1. REBUILDING CLEAN TRIPTYCH COVERS & POST 02 CAROUSEL SLIDES (NO INTERNAL LABELS) ---');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const [prods, extStore] = await Promise.all([
    fetchProductsCatalog(supabase),
    fetchSiteSetting(supabase, 'module7_extended_catalog')
  ]);
  const entities = buildCatalogEntities(prods || [], extStore || {}, {});
  const entity = entities.find(e => e.slug === 'bergamo-kahve-kosesi-61kf');
  if (!entity) throw new Error('Bergamo entity not found');

  const triptych = await renderTriptychCovers(entity);
  fs.writeFileSync(path.join(scratchDir, 'v8_reel_cover_1_post01_left.jpg'), triptych.left9x16);
  fs.writeFileSync(path.join(scratchDir, 'v8_reel_cover_3_post03_right.jpg'), triptych.right9x16);

  const slides = await renderCollectionPost02Breakdown(entity, triptych);
  slides.forEach((buf, idx) => {
    fs.writeFileSync(path.join(scratchDir, `v8_post02_slide_${idx + 1}.jpg`), buf);
  });
  console.log(`✅ Saved clean Triptych covers and ${slides.length} Carousel slides (v8_post02_slide_1..${slides.length}.jpg).`);
}

// ============================================================================
// 2. "BER" REELS V3:
// - Sahne 1: Soldan sağa TAM GÖRSEL geçişi (ax: 0.00 -> 1.00) + İç terimsiz koleksiyon ve parça isimleri
// - Sahne 2, 3, 4: İç terimsiz ("MODÜL 01/03 • BAĞIMSIZ ÜRÜN SUNUMU" kaldırıldı) + Hafif kamera yakınlaştırması (1.00 -> 1.036)
//   + Son ürün (Büyük Kahve Köşesi) daha geniş kadrajdan alınmış
// ============================================================================
async function renderOpeningPiecesListSequenceV3(tempDir, duration) {
  const seqDir = path.join(tempDir, 'seq_s1_opening_list');
  fs.mkdirSync(seqDir, { recursive: true });

  const totalFrames = Math.round(duration * FPS);
  const fadeOutStart = duration - 0.90;
  const fadeOutDur = 0.75;

  const pieceItems = [
    { name: 'Bergamo — Küçük Kahve Köşesi', tStart: 1.35 },
    { name: 'Bergamo — Orta Kahve Köşesi', tStart: 2.75 },
    { name: 'Bergamo — Büyük Kahve Köşesi', tStart: 4.15 }
  ];

  async function renderSingleFrame(f) {
    const t = f / FPS;
    let globalAlpha = 1.0;
    if (t > fadeOutStart) {
      globalAlpha = 1.0 - smoothstep((t - fadeOutStart) / fadeOutDur);
    }

    let body = '';

    const cardAlpha = smoothstep((t - 0.20) / 0.55);
    if (cardAlpha > 0.01) {
      body += `<rect x="74" y="1285" width="${VW - 148}" height="425" rx="20" fill="rgba(10, 12, 16, ${(0.76 * cardAlpha).toFixed(3)})" stroke="${BRAND_GOLD}" stroke-width="1.4" stroke-opacity="${(0.45 * cardAlpha).toFixed(3)}"/>`;
    }

    // Sadece Koleksiyon İsmi ("KOLEKSİYON MODÜLLERİ & ÜRÜN TANITIMI" kaldırıldı)
    const titleTspans = buildAnimatedCharsTspans('BERGAMO KAHVE KÖŞESİ', t, 0.35, 0.026, 0.20);
    body += `<text x="${VW / 2}" y="1358" xml:space="preserve" text-anchor="middle" font-family="${TITLE_FONT}" font-size="44" font-weight="700" letter-spacing="3" fill="#ffffff">${titleTspans}</text>`;

    const lineP = smoothstep((t - 0.45) / 0.60);
    if (lineP > 0.01) {
      const lw = (180 * lineP).toFixed(1);
      body += `<rect x="${(VW / 2 - lw / 2).toFixed(1)}" y="1384" width="${lw}" height="2" fill="${BRAND_GOLD}" fill-opacity="${(0.85 * lineP).toFixed(3)}"/>`;
    }

    // Sırayla 3 Koleksiyon Parçasının İsmi
    let py = 1456;
    for (const item of pieceItems) {
      if (t >= item.tStart) {
        const pAlpha = smoothstep((t - item.tStart) / 0.30);
        body += `<circle cx="170" cy="${py - 14}" r="5.5" fill="${BRAND_GOLD}" fill-opacity="${pAlpha.toFixed(3)}"/>`;
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

    const framePath = path.join(seqDir, `f_${String(f).padStart(4, '0')}.png`);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 2 }).toFile(framePath);
  }

  const BATCH = 16;
  for (let i = 0; i < totalFrames; i += BATCH) {
    const jobs = [];
    for (let j = i; j < Math.min(totalFrames, i + BATCH); j++) {
      jobs.push(renderSingleFrame(j));
    }
    await Promise.all(jobs);
  }

  return { pattern: path.join(seqDir, 'f_%04d.png') };
}

async function renderStandaloneProductHudSequenceV3(tempDir, sceneName, duration, cfg, zMax = 1.036) {
  const seqDir = path.join(tempDir, `seq_${sceneName}`);
  fs.mkdirSync(seqDir, { recursive: true });

  const totalFrames = Math.round(duration * FPS);
  const fadeOutStart = duration - 0.85;
  const fadeOutDur = 0.70;

  const { productTitle, boy, en, genislik, callouts } = cfg;

  async function renderSingleFrame(f) {
    const t = f / FPS;
    let globalAlpha = 1.0;
    if (t > fadeOutStart) {
      globalAlpha = 1.0 - smoothstep((t - fadeOutStart) / fadeOutDur);
    }

    // Kamera z=1.00 -> zMax hafif yakınlaşırken, ölçü çizgileri ve hedef noktaları da aynı merkezden (540,960)
    // aynı z(f) ölçeğiyle büyüyerek ürünün kenarlarına milimetrik kilitli kalır!
    const eZoom = 0.5 - 0.5 * Math.cos((Math.PI * f) / totalFrames);
    const curZ = (1.0 + (zMax - 1.0) * eZoom).toFixed(5);

    let headerBody = '';
    // ÜST ÜRÜN İSMİ KARTI ("MODÜL 01/03 • BAĞIMSIZ ÜRÜN SUNUMU" kaldırıldı; sadece ürün ismi yer alır!)
    const hdrAlpha = smoothstep((t - 0.15) / 0.45);
    if (hdrAlpha > 0.01) {
      headerBody += `<rect x="84" y="258" width="${VW - 168}" height="78" rx="14" fill="rgba(10, 12, 16, ${(0.78 * hdrAlpha).toFixed(3)})" stroke="${BRAND_GOLD}" stroke-width="1.3" stroke-opacity="${(0.55 * hdrAlpha).toFixed(3)}"/>`;
      const prodTspans = buildAnimatedCharsTspans(productTitle, t, 0.28, 0.025, 0.18);
      headerBody += `<text x="${VW / 2}" y="309" xml:space="preserve" text-anchor="middle" font-family="${TITLE_FONT}" font-size="33" font-weight="700" letter-spacing="2" fill="#ffffff" filter="url(#sh)">${prodTspans}</text>`;
    }

    let trackedBody = '';

    // 1. BOY ÖLÇÜ ÇİZGİSİ — AŞAĞIDAN YUKARIYA ANİMASYONLA ÇİZİLİR (t = 0.95s .. 1.80s)
    const tBoyStart = 0.95, boyLineDur = 0.80;
    if (t >= tBoyStart) {
      const pBoy = smoothstep((t - tBoyStart) / boyLineDur);
      const curYTop = (boy.yBot + (boy.yTop - boy.yBot) * pBoy).toFixed(1);

      trackedBody += `<g filter="url(#sh)">`;
      trackedBody += `<line x1="${boy.x - 14}" y1="${boy.yBot}" x2="${boy.x + 14}" y2="${boy.yBot}" stroke="${BRAND_GOLD}" stroke-width="2.4"/>`;
      trackedBody += `<polygon points="${boy.x},${boy.yBot - 2} ${boy.x - 7},${boy.yBot - 18} ${boy.x + 7},${boy.yBot - 18}" fill="${BRAND_GOLD}"/>`;
      trackedBody += `<line x1="${boy.x}" y1="${boy.yBot}" x2="${boy.x}" y2="${curYTop}" stroke="${BRAND_GOLD}" stroke-width="2.4"/>`;
      if (pBoy > 0.92) {
        const topTickOp = ((pBoy - 0.92) / 0.08).toFixed(2);
        trackedBody += `<line x1="${boy.x - 14}" y1="${boy.yTop}" x2="${boy.x + 14}" y2="${boy.yTop}" stroke="${BRAND_GOLD}" stroke-width="2.4" stroke-opacity="${topTickOp}"/>`;
        trackedBody += `<polygon points="${boy.x},${boy.yTop + 2} ${boy.x - 7},${boy.yTop + 18} ${boy.x + 7},${boy.yTop + 18}" fill="${BRAND_GOLD}" fill-opacity="${topTickOp}"/>`;
      }
      const tBoyText = tBoyStart + 0.30;
      if (t >= tBoyText) {
        const bAlpha = smoothstep((t - tBoyText) / 0.35);
        trackedBody += `<rect x="${boy.badgeX}" y="${boy.badgeY - 38}" width="236" height="54" rx="12" fill="rgba(10, 12, 16, ${(0.86 * bAlpha).toFixed(3)})" stroke="${BRAND_GOLD}" stroke-width="1.4" stroke-opacity="${bAlpha.toFixed(3)}"/>`;
        const lblTspans = buildAnimatedCharsTspans('Boy : ', t, tBoyText + 0.05, 0.028, 0.16, BRAND_GOLD);
        const valTspans = buildAnimatedCharsTspans(boy.val, t, tBoyText + 0.22, 0.030, 0.16, '#ffffff');
        trackedBody += `<text x="${boy.badgeX + 118}" y="${boy.badgeY - 3}" xml:space="preserve" text-anchor="middle" font-family="${BODY_FONT}" font-size="23" font-weight="700" letter-spacing="2" fill="#ffffff">${lblTspans}${valTspans}</text>`;
      }
      trackedBody += `</g>`;
    }

    // 2. EN ÖLÇÜ ÇİZGİSİ — SOLDAN SAĞA ANİMASYONLA ÇİZİLİR (t = 2.15s .. 2.95s)
    const tEnStart = 2.15, enLineDur = 0.75;
    if (t >= tEnStart) {
      const pEn = smoothstep((t - tEnStart) / enLineDur);
      const curXRight = (en.xLeft + (en.xRight - en.xLeft) * pEn).toFixed(1);

      trackedBody += `<g filter="url(#sh)">`;
      trackedBody += `<line x1="${en.xLeft}" y1="${en.y - 14}" x2="${en.xLeft}" y2="${en.y + 14}" stroke="${BRAND_GOLD}" stroke-width="2.4"/>`;
      trackedBody += `<polygon points="${en.xLeft + 2},${en.y} ${en.xLeft + 18},${en.y - 7} ${en.xLeft + 18},${en.y + 7}" fill="${BRAND_GOLD}"/>`;
      trackedBody += `<line x1="${en.xLeft}" y1="${en.y}" x2="${curXRight}" y2="${en.y}" stroke="${BRAND_GOLD}" stroke-width="2.4"/>`;
      if (pEn > 0.92) {
        const rTickOp = ((pEn - 0.92) / 0.08).toFixed(2);
        trackedBody += `<line x1="${en.xRight}" y1="${en.y - 14}" x2="${en.xRight}" y2="${en.y + 14}" stroke="${BRAND_GOLD}" stroke-width="2.4" stroke-opacity="${rTickOp}"/>`;
        trackedBody += `<polygon points="${en.xRight - 2},${en.y} ${en.xRight - 18},${en.y - 7} ${en.xRight - 18},${en.y + 7}" fill="${BRAND_GOLD}" fill-opacity="${rTickOp}"/>`;
      }
      const tEnText = tEnStart + 0.28;
      if (t >= tEnText) {
        const eAlpha = smoothstep((t - tEnText) / 0.35);
        const cx = (en.xLeft + en.xRight) / 2;
        trackedBody += `<rect x="${cx - 118}" y="${en.y - 27}" width="236" height="54" rx="12" fill="rgba(10, 12, 16, ${(0.88 * eAlpha).toFixed(3)})" stroke="${BRAND_GOLD}" stroke-width="1.4" stroke-opacity="${eAlpha.toFixed(3)}"/>`;
        const lblTspans = buildAnimatedCharsTspans('En : ', t, tEnText + 0.05, 0.028, 0.16, BRAND_GOLD);
        const valTspans = buildAnimatedCharsTspans(en.val, t, tEnText + 0.20, 0.030, 0.16, '#ffffff');
        trackedBody += `<text x="${cx}" y="${en.y + 8}" xml:space="preserve" text-anchor="middle" font-family="${BODY_FONT}" font-size="23" font-weight="700" letter-spacing="2" fill="#ffffff">${lblTspans}${valTspans}</text>`;
      }
      trackedBody += `</g>`;
    }

    // 3. GENİŞLİK ÖLÇÜ ÇİZGİSİ — PERSPEKTİF AÇISIYLA ANİMASYONLA ÇİZİLİR (t = 3.30s .. 3.95s)
    const tGenStart = 3.30, genLineDur = 0.55;
    if (t >= tGenStart) {
      const pGen = smoothstep((t - tGenStart) / genLineDur);
      const curX2 = (genislik.x1 + (genislik.x2 - genislik.x1) * pGen).toFixed(1);
      const curY2 = (genislik.y1 + (genislik.y2 - genislik.y1) * pGen).toFixed(1);

      trackedBody += `<g filter="url(#sh)">`;
      trackedBody += `<line x1="${genislik.x1}" y1="${genislik.y1}" x2="${curX2}" y2="${curY2}" stroke="${BRAND_GOLD}" stroke-width="2.6"/>`;
      trackedBody += `<circle cx="${genislik.x1}" cy="${genislik.y1}" r="5" fill="${BRAND_GOLD}"/>`;
      if (pGen > 0.90) {
        trackedBody += `<circle cx="${genislik.x2}" cy="${genislik.y2}" r="5" fill="${BRAND_GOLD}"/>`;
      }
      const tGenText = tGenStart + 0.22;
      if (t >= tGenText) {
        const gAlpha = smoothstep((t - tGenText) / 0.35);
        trackedBody += `<rect x="${genislik.badgeX}" y="${genislik.badgeY - 38}" width="286" height="54" rx="12" fill="rgba(10, 12, 16, ${(0.86 * gAlpha).toFixed(3)})" stroke="${BRAND_GOLD}" stroke-width="1.4" stroke-opacity="${gAlpha.toFixed(3)}"/>`;
        const lblTspans = buildAnimatedCharsTspans('Genişlik : ', t, tGenText + 0.05, 0.025, 0.16, BRAND_GOLD);
        const valTspans = buildAnimatedCharsTspans(genislik.val, t, tGenText + 0.28, 0.028, 0.16, '#ffffff');
        trackedBody += `<text x="${genislik.badgeX + 143}" y="${genislik.badgeY - 3}" xml:space="preserve" text-anchor="middle" font-family="${BODY_FONT}" font-size="22" font-weight="700" letter-spacing="2" fill="#ffffff">${lblTspans}${valTspans}</text>`;
      }
      trackedBody += `</g>`;
    }

    // 4. ÜRÜN ÜZERİNDE ANİMASYONLU NOKTA + UZAYAN ÇİZGİ + HARF HARF ÖZELLİK CALLOUT'LARI
    for (const c of callouts) {
      if (t < c.tDot) continue;

      const dotProg = smoothstep((t - c.tDot) / 0.32);
      const pulse = 1.0 + 0.14 * Math.sin(Math.max(0, t - c.tDot) * 5.5);
      const outerR = (15 * dotProg * pulse).toFixed(2);
      const innerR = (6.5 * dotProg).toFixed(2);

      const lineProg = smoothstep((t - c.tLine) / c.lineDur);
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

      const boxAlpha = smoothstep((t - c.tLine) / 0.45);
      if (boxAlpha > 0.01) {
        trackedBody += `<rect x="${c.boxX}" y="${c.boxY}" width="${c.boxW}" height="${c.boxH}" rx="14" fill="rgba(10, 12, 16, ${(0.76 * boxAlpha).toFixed(3)})" stroke="${BRAND_GOLD}" stroke-width="1" stroke-opacity="${(0.40 * boxAlpha).toFixed(3)}"/>`;
      }

      if (polyStr) {
        trackedBody += `<polyline points="${polyStr}" fill="none" stroke="${BRAND_GOLD}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#sh)"/>`;
      }

      trackedBody += `<circle cx="${c.dotX}" cy="${c.dotY}" r="${outerR}" fill="${BRAND_GOLD}" fill-opacity="${(0.30 * dotProg).toFixed(3)}" stroke="${BRAND_GOLD}" stroke-width="2" stroke-opacity="${(0.95 * dotProg).toFixed(3)}" filter="url(#glow)"/>`;
      trackedBody += `<circle cx="${c.dotX}" cy="${c.dotY}" r="${innerR}" fill="#ffffff" stroke="${BRAND_GOLD}" stroke-width="2.5"/>`;

      if (t >= c.tText) {
        const titleTspans = buildAnimatedCharsTspans(c.title, t, c.tText, 0.025, 0.16);
        const detailStart = c.tText + Array.from(c.title).length * 0.020;
        const detailTspans = buildAnimatedCharsTspans(c.detail, t, detailStart, 0.024, 0.18);

        trackedBody += `<text x="${c.textX}" y="${c.titleY}" xml:space="preserve" font-family="${BODY_FONT}" font-size="19" font-weight="700" letter-spacing="3.5" fill="${BRAND_GOLD}" filter="url(#sh)">${titleTspans}</text>`;
        trackedBody += `<text x="${c.textX}" y="${c.detailY}" xml:space="preserve" font-family="${TITLE_FONT}" font-size="25" font-style="italic" font-weight="500" fill="#ffffff" filter="url(#sh)">${detailTspans}</text>`;
      }
    }

    const svg = `<svg width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${BRAND_GOLD}" flood-opacity="0.95"/>
        </filter>
      </defs>
      <g opacity="${globalAlpha.toFixed(3)}">
        <g transform="translate(540, 960) scale(${curZ}) translate(-540, -960)">
          ${trackedBody}
        </g>
        ${headerBody}
      </g>
    </svg>`;

    const framePath = path.join(seqDir, `f_${String(f).padStart(4, '0')}.png`);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 2 }).toFile(framePath);
  }

  const BATCH = 16;
  for (let i = 0; i < totalFrames; i += BATCH) {
    const jobs = [];
    for (let j = i; j < Math.min(totalFrames, i + BATCH); j++) {
      jobs.push(renderSingleFrame(j));
    }
    await Promise.all(jobs);
  }

  return { pattern: path.join(seqDir, 'f_%04d.png') };
}

async function renderBerProductShowcaseV3() {
  console.log('--- 2. RENDERING V3 "BER" REELS (FULL L-TO-R OPENING + GENTLE PRODUCT ZOOM + WIDER P3 + NO INTERNAL LABELS) ---');
  const tempDir = fs.mkdtempSync(path.join(scratchDir, 'ber_showcase_v3_'));

  const masterRoomPath = path.join(tempDir, 'master_room_4k.jpg');
  await sharp(heroPath)
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
    <text x="72" y="208" font-family="${BODY_FONT}" font-size="22" font-weight="700" letter-spacing="8" fill="#ffffff" fill-opacity="0.94">NOVA FURNITURE</text>
    <text x="${VW - 72}" y="208" text-anchor="end" font-family="${BODY_FONT}" font-size="18" font-weight="600" letter-spacing="5" fill="${BRAND_GOLD}" fill-opacity="0.94">BERGAMO KAHVE KÖŞESİ</text>
    <line x1="72" y1="232" x2="${VW - 72}" y2="232" stroke="${BRAND_GOLD}" stroke-width="1.3" stroke-opacity="0.45"/>
  </svg>`;
  const brandBarPng = path.join(tempDir, 'brand_bar.png');
  await sharp(Buffer.from(topBrandSvg)).png().toFile(brandBarPng);

  const scenes = [];

  // ─── SAHNE 1 (7.6s): Genel Fotoğrafın TAMAMINI Soldan Sağa Baştan Sona Gezen Geçiş (ax: 0.00 -> 1.00) ───
  console.log('Rendering BER Scene 1 (Full End-to-End Left-to-Right Pan ax:0.00->1.00)...');
  const seq1 = await renderOpeningPiecesListSequenceV3(tempDir, 7.6);
  const s1Out = path.join(tempDir, 's1_opening.mp4');
  {
    const ch = 2144, cw = Math.round((ch * 9 / 16) / 2) * 2; // 1206x2144 (%100 tam dikey boy)
    const e = `(0.5-0.5*cos(PI*t/7.600))`;
    const xExpr = `(iw-${cw})*${e}`; // ax0=0.00'dan ax1=1.00'a görselin tamamını soldan sağa tarar!
    const yExpr = `0`;
    const vChain = `[0:v]crop=w=${cw}:h=${ch}:x='${xExpr}':y='${yExpr}':exact=1,scale=1080:1920:flags=lanczos,setsar=1,split[sharp][blurSrc];[blurSrc]gblur=sigma=14,fade=t=out:st=0.15:d=1.10:alpha=1[blurOv];[sharp][blurOv]overlay=0:0,format=yuv420p[bg0];[1:v]format=rgba[bb];[bg0][bb]overlay=0:0[bg1];[2:v]format=rgba[cd];[bg1][cd]overlay=0:0:shortest=1[vout]`;

    await runFfmpeg([
      '-loop', '1', '-framerate', String(FPS), '-t', '7.600', '-i', masterRoomPath,
      '-loop', '1', '-framerate', String(FPS), '-t', '7.600', '-i', brandBarPng,
      '-framerate', String(FPS), '-i', seq1.pattern,
      '-filter_complex', vChain,
      '-map', '[vout]', '-t', '7.600', '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-an',
      s1Out
    ], 's1_opening');
  }
  scenes.push({ path: s1Out, duration: 7.6, xfadeAfter: 0.9 });

  // ─── SAHNE 2, 3, 4 (Her Biri 10.0 Saniye): Hafif Kamera Yakınlaştırması (z: 1.00 -> 1.036) + Geniş Kadrajlı Büyük Modül ───
  const productScenesConfig = [
    {
      name: 's2_piece1_kucuk',
      inFile: 'clean_p1_9x16.jpg',
      duration: 10.0,
      zMax: 1.038,
      productTitle: 'BERGAMO — KÜÇÜK KAHVE KÖŞESİ',
      boy: { x: 118, yBot: 1812, yTop: 365, badgeX: 136, badgeY: 840, val: '200 cm' },
      en: { xLeft: 155, xRight: 918, y: 1852, val: '80 cm' },
      genislik: { x1: 912, y1: 1122, x2: 830, y2: 1055, badgeX: 605, badgeY: 1168, val: '45 cm' },
      callouts: [
        {
          dotX: 660, dotY: 575, elbowX: 605, lineY: 510, endX: 205,
          boxX: 185, boxY: 458, boxW: 525, boxH: 102,
          textX: 208, titleY: 495, detailY: 540,
          title: 'SICAK LED AYDINLATMA',
          detail: 'Temperli Cam Vitrin & Entegre LED',
          tDot: 4.30, tLine: 4.55, lineDur: 0.55, tText: 4.90
        },
        {
          dotX: 670, dotY: 1475, elbowX: 615, lineY: 1410, endX: 205,
          boxX: 185, boxY: 1358, boxW: 535, boxH: 102,
          textX: 208, titleY: 1395, detailY: 1440,
          title: '1. SINIF MDF GÖVDE',
          detail: 'Özel CNC Membran Kapak & Yüzey',
          tDot: 6.30, tLine: 6.55, lineDur: 0.55, tText: 6.90
        }
      ]
    },
    {
      name: 's3_piece2_orta',
      inFile: 'wide_p2_9x16.jpg',
      duration: 10.0,
      zMax: 1.036,
      productTitle: 'BERGAMO — ORTA KAHVE KÖŞESİ',
      boy: { x: 88, yBot: 1636, yTop: 410, badgeX: 108, badgeY: 845, val: '200 cm' },
      en: { xLeft: 122, xRight: 958, y: 1682, val: '120 cm' },
      genislik: { x1: 955, y1: 1072, x2: 882, y2: 1015, badgeX: 625, badgeY: 1120, val: '45 cm' },
      callouts: [
        {
          dotX: 245, dotY: 615, elbowX: 305, lineY: 550, endX: 870,
          boxX: 350, boxY: 498, boxW: 545, boxH: 102,
          textX: 374, titleY: 535, detailY: 580,
          title: 'BOY CAM VİTRİN ÜNİTESİ',
          detail: 'Entegre Sıcak LED & Cam Raflar',
          tDot: 4.30, tLine: 4.55, lineDur: 0.55, tText: 4.90
        },
        {
          dotX: 705, dotY: 1380, elbowX: 650, lineY: 1315, endX: 250,
          boxX: 230, boxY: 1262, boxW: 545, boxH: 102,
          textX: 254, titleY: 1300, detailY: 1345,
          title: '1. SINIF MDF & DEPOLAMA',
          detail: 'Özel CNC Membran Kapak & Çekmece',
          tDot: 6.30, tLine: 6.55, lineDur: 0.55, tText: 6.90
        }
      ]
    },
    {
      name: 's4_piece3_buyuk',
      inFile: 'wide_p3_9x16.jpg',
      duration: 10.0,
      zMax: 1.032, // Geniş modül ferah kadrajda çok hafif yakınlaşır
      productTitle: 'BERGAMO — BÜYÜK KAHVE KÖŞESİ',
      boy: { x: 56, yBot: 1588, yTop: 492, badgeX: 76, badgeY: 855, val: '200 cm' },
      en: { xLeft: 88, xRight: 992, y: 1638, val: '160 cm' },
      genislik: { x1: 765, y1: 1105, x2: 712, y2: 1055, badgeX: 485, badgeY: 1150, val: '45 cm' },
      callouts: [
        {
          dotX: 865, dotY: 675, elbowX: 805, lineY: 610, endX: 295,
          boxX: 275, boxY: 558, boxW: 555, boxH: 102,
          textX: 298, titleY: 595, detailY: 640,
          title: 'ÇİFT KULE VİTRİN MİMARİSİ',
          detail: 'Simetrik Cam Vitrin & Amber LED',
          tDot: 4.30, tLine: 4.55, lineDur: 0.55, tText: 4.90
        },
        {
          dotX: 605, dotY: 1355, elbowX: 550, lineY: 1290, endX: 225,
          boxX: 205, boxY: 1238, boxW: 550, boxH: 102,
          textX: 228, titleY: 1275, detailY: 1320,
          title: 'MAKSİMUM HACİM & MDF GÖVDE',
          detail: 'Özel CNC Membran Kapak & Barista Alanı',
          tDot: 6.30, tLine: 6.55, lineDur: 0.55, tText: 6.90
        }
      ]
    }
  ];

  for (const pCfg of productScenesConfig) {
    console.log(`Rendering BER Standalone Product Scene (${pCfg.productTitle} with gentle zoom 1.00->${pCfg.zMax})...`);
    const hudSeq = await renderStandaloneProductHudSequenceV3(tempDir, pCfg.name, pCfg.duration, pCfg, pCfg.zMax);

    // 4K (2160x3840) ürün zemini hazırla ki zoompan sarsıntısız yakınlaşsın
    const pBase4k = path.join(tempDir, `${pCfg.name}_4k.jpg`);
    await sharp(path.join(scratchDir, pCfg.inFile))
      .resize(2160, 3840, { kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: 96 })
      .toFile(pBase4k);

    const pOut = path.join(tempDir, `${pCfg.name}.mp4`);
    const frames = Math.round(pCfg.duration * FPS);
    const e = `(0.5-0.5*cos(PI*on/${frames}))`;
    const zExpr = `1.00+${(pCfg.zMax - 1.0).toFixed(4)}*${e}`;

    // [0:v] (tekil 4K ürün görseli) zoompan ile 300 kare boyunca hafifçe yakınlaşır,
    // ardından [2:v] (300 karelik animasyonlu HUD dizisi) kare kare üzerine bindirilir!
    const vChain = `[0:v]zoompan=z='${zExpr}':x='(iw-iw/zoom)*0.5':y='(ih-ih/zoom)*0.5':d=${frames}:s=2160x3840:fps=${FPS},scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p[bg0];[1:v]format=rgba[bb];[bg0][bb]overlay=0:0[bg1];[2:v]format=rgba[hud];[bg1][hud]overlay=0:0:shortest=1,format=yuv420p[vout]`;

    await runFfmpeg([
      '-i', pBase4k,
      '-loop', '1', '-framerate', String(FPS), '-t', pCfg.duration.toFixed(3), '-i', brandBarPng,
      '-framerate', String(FPS), '-i', hudSeq.pattern,
      '-filter_complex', vChain,
      '-map', '[vout]', '-t', pCfg.duration.toFixed(3), '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-an',
      pOut
    ], pCfg.name);

    scenes.push({ path: pOut, duration: pCfg.duration, xfadeAfter: 0.9 });
  }

  // ─── SAHNE 5 (4.6s): Siyah Arka Planlı Logolu Kapanış ───
  const outroSvg = `<svg width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="og" cx="50%" cy="48%" r="68%">
        <stop offset="0%" stop-color="#231f1b"/>
        <stop offset="60%" stop-color="#13110f"/>
        <stop offset="100%" stop-color="#090807"/>
      </radialGradient>
    </defs>
    <rect width="${VW}" height="${VH}" fill="url(#og)"/>
    <rect x="64" y="64" width="${VW - 128}" height="${VH - 128}" fill="none" stroke="${BRAND_GOLD}" stroke-width="2" stroke-opacity="0.55"/>
    <rect x="80" y="80" width="${VW - 160}" height="${VH - 160}" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.22"/>
    <circle cx="${VW / 2}" cy="760" r="145" fill="none" stroke="${BRAND_GOLD}" stroke-width="2" stroke-opacity="0.4"/>
    <circle cx="${VW / 2}" cy="760" r="126" fill="none" stroke="${BRAND_GOLD}" stroke-width="1" stroke-opacity="0.22"/>
    <text x="${VW / 2}" y="788" text-anchor="middle" font-family="${TITLE_FONT}" font-size="82" font-weight="700" letter-spacing="12" fill="${BRAND_GOLD}">N</text>
    <text x="${VW / 2}" y="1020" text-anchor="middle" font-family="${BODY_FONT}" font-size="34" font-weight="700" letter-spacing="12" fill="#ffffff">NOVA FURNITURE</text>
    <rect x="${VW / 2 - 110}" y="1058" width="220" height="2" fill="${BRAND_GOLD}" fill-opacity="0.75"/>
    <text x="${VW / 2}" y="1118" text-anchor="middle" font-family="${TITLE_FONT}" font-size="34" font-style="italic" letter-spacing="2" fill="#e2e8f0">Bergamo Kahve Köşesi</text>
    <text x="${VW / 2}" y="1180" text-anchor="middle" font-family="${BODY_FONT}" font-size="21" font-weight="600" letter-spacing="6" fill="${BRAND_GOLD}">thenovafurniture.com</text>
    <text x="${VW / 2}" y="1230" text-anchor="middle" font-family="${BODY_FONT}" font-size="20" font-weight="500" letter-spacing="4" fill="#94a3b8">WhatsApp: 0505 015 1035</text>
  </svg>`;
  const outroJpg = path.join(tempDir, 'outro.jpg');
  await sharp(Buffer.from(outroSvg)).jpeg({ quality: 96 }).toFile(outroJpg);
  const out5 = path.join(tempDir, 's5_outro.mp4');
  await runFfmpeg([
    '-loop', '1', '-framerate', String(FPS), '-t', '4.600', '-i', outroJpg,
    '-vf', 'scale=1080:1920,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-an',
    out5
  ], 's5_outro');
  scenes.push({ path: out5, duration: 4.6, xfadeAfter: 0.9 });

  // Sahneleri birleştir
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
  const totalDur = curLen; // ~38.6s
  const videoNoAudio = path.join(tempDir, 'ber_v3_no_audio.mp4');

  concatArgs.push(
    '-filter_complex', fc.replace(/;$/, ''),
    '-map', `[${lastV}]`,
    '-t', totalDur.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    videoNoAudio
  );
  await runFfmpeg(concatArgs, 'stitch_ber_v3');

  const finalBerVideoPath = path.join(outDir, 'post01_ber_product_showcase_v3.mp4');
  const fadeOutStart = (totalDur - 3.8).toFixed(2);
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
    finalBerVideoPath
  ], 'master_ber_v3_audio');

  // Doğrulama kareleri çıkar
  spawnSync(ffmpegBin, ['-y', '-ss', '14.5', '-i', finalBerVideoPath, '-frames:v', '1', path.join(scratchDir, 'verify_ber_v3_scene2.jpg')]);
  spawnSync(ffmpegBin, ['-y', '-ss', '23.5', '-i', finalBerVideoPath, '-frames:v', '1', path.join(scratchDir, 'verify_ber_v3_scene3.jpg')]);
  spawnSync(ffmpegBin, ['-y', '-ss', '32.5', '-i', finalBerVideoPath, '-frames:v', '1', path.join(scratchDir, 'verify_ber_v3_scene4.jpg')]);

  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}

  console.log(`✅ Rendered V3 "BER" Standalone Product Showcase Reels (${totalDur.toFixed(1)}s) [LOCAL ONLY - NOT PUBLISHED]:`, finalBerVideoPath);
}

await rebuildCleanTriptychAndCarousel();
await renderBerProductShowcaseV3();

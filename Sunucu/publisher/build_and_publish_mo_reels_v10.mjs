import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

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

function buildAnimatedCharsTspans(text, t, startTime, charInterval, charFadeDur = 0.22) {
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
    out += `<tspan fill-opacity="${smoothOp}">${escXml(ch)}</tspan>`;
  }
  return out;
}

async function renderTypewriterCardSequence(tempDir, sceneName, duration, {
  eyebrow = '',
  title = '',
  lines = [],
  footer = '',
  writeStart = 0.45,
  writeEnd = null,
  maxCharInterval = 0.052,
  charFadeDur = 0.22
}) {
  const seqDir = path.join(tempDir, `seq_${sceneName}`);
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
    const len = Array.from(seg.text).length;
    cursorTime += len * seg.charInterval + 0.14;
  }

  const cardH = 380;

  async function renderSingleFrame(f) {
    const t = f / FPS;
    let globalAlpha = 1.0;
    if (t > fadeOutStart) {
      globalAlpha = 1.0 - smoothstep((t - fadeOutStart) / fadeOutDur);
    }

    let y = 56;
    let body = '';

    for (const seg of segments) {
      if (seg.type === 'eyebrow') {
        const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, charFadeDur);
        body += `<text x="${VW / 2}" y="${y}" xml:space="preserve" text-anchor="middle" font-family="${BODY_FONT}" font-size="21" font-weight="700" letter-spacing="6" fill="${BRAND_GOLD}">${tspans}</text>`;
        y += 48;
      } else if (seg.type === 'title') {
        const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, charFadeDur + 0.04);
        body += `<text x="${VW / 2}" y="${y}" xml:space="preserve" text-anchor="middle" font-family="${TITLE_FONT}" font-size="48" font-weight="700" letter-spacing="3" fill="#ffffff">${tspans}</text>`;
        y += 24;
        const titleDur = Array.from(seg.text).length * seg.charInterval;
        const smoothLine = smoothstep((t - seg.startTime) / Math.max(0.4, titleDur));
        const lineW = (120 * smoothLine).toFixed(1);
        if (smoothLine > 0.01) {
          body += `<rect x="${(VW / 2 - lineW / 2).toFixed(1)}" y="${y}" width="${lineW}" height="2" fill="${BRAND_GOLD}" fill-opacity="${(0.85 * smoothLine).toFixed(3)}"/>`;
        }
        y += 46;
      } else if (seg.type === 'line') {
        const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, charFadeDur + 0.04);
        body += `<text x="${VW / 2}" y="${y}" xml:space="preserve" text-anchor="middle" font-family="${TITLE_FONT}" font-size="35" font-style="italic" font-weight="500" letter-spacing="0.5" fill="#f8fafc">${tspans}</text>`;
        y += 50;
      } else if (seg.type === 'footer') {
        y += 8;
        const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, charFadeDur);
        body += `<text x="${VW / 2}" y="${y}" xml:space="preserve" text-anchor="middle" font-family="${BODY_FONT}" font-size="19" font-weight="600" letter-spacing="4" fill="${BRAND_GOLD}">${tspans}</text>`;
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

  return { pattern: path.join(seqDir, 'f_%04d.png'), h: cardH };
}

async function renderProductCalloutsSequence(tempDir, duration) {
  const seqDir = path.join(tempDir, 'seq_s4_callouts');
  fs.mkdirSync(seqDir, { recursive: true });

  const totalFrames = Math.round(duration * FPS);
  const fadeOutStart = duration - 0.85;
  const fadeOutDur = 0.70;

  const callouts = [
    {
      dotX: 680, dotY: 610,
      elbowX: 625, lineY: 538, endX: 78,
      boxX: 58, boxY: 485, boxW: 548, boxH: 104,
      textX: 84, titleY: 523, detailY: 570,
      title: 'SICAK LED AYDINLATMA',
      detail: 'Temperli Cam Vitrin & Entegre LED',
      tDot: 0.45,
      tLine: 0.70,
      lineDur: 0.55,
      tText: 1.05
    },
    {
      dotX: 355, dotY: 1065,
      elbowX: 415, lineY: 1000, endX: 1002,
      boxX: 434, boxY: 948, boxW: 588, boxH: 104,
      textX: 458, titleY: 986, detailY: 1033,
      title: 'GENİŞ BARİSTA TEZGÂHI',
      detail: 'Kahve Makinesi & Ekipman Alanı',
      tDot: 3.05,
      tLine: 3.30,
      lineDur: 0.55,
      tText: 3.65
    },
    {
      dotX: 690, dotY: 1430,
      elbowX: 635, lineY: 1362, endX: 78,
      boxX: 58, boxY: 1310, boxW: 565, boxH: 104,
      textX: 84, titleY: 1348, detailY: 1395,
      title: '1. SINIF MDF GÖVDE',
      detail: 'Özel CNC Membran Kapak & Yüzey',
      tDot: 5.65,
      tLine: 5.90,
      lineDur: 0.55,
      tText: 6.25
    }
  ];

  async function renderSingleFrame(f) {
    const t = f / FPS;
    let globalAlpha = 1.0;
    if (t > fadeOutStart) {
      globalAlpha = 1.0 - smoothstep((t - fadeOutStart) / fadeOutDur);
    }

    let body = '';

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
        body += `<rect x="${c.boxX}" y="${c.boxY}" width="${c.boxW}" height="${c.boxH}" rx="14" fill="rgba(10, 12, 16, ${(0.72 * boxAlpha).toFixed(3)})" stroke="${BRAND_GOLD}" stroke-width="1" stroke-opacity="${(0.35 * boxAlpha).toFixed(3)}"/>`;
      }

      if (polyStr) {
        body += `<polyline points="${polyStr}" fill="none" stroke="${BRAND_GOLD}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#sh)"/>`;
      }

      body += `<circle cx="${c.dotX}" cy="${c.dotY}" r="${outerR}" fill="${BRAND_GOLD}" fill-opacity="${(0.30 * dotProg).toFixed(3)}" stroke="${BRAND_GOLD}" stroke-width="2" stroke-opacity="${(0.95 * dotProg).toFixed(3)}" filter="url(#glow)"/>`;
      body += `<circle cx="${c.dotX}" cy="${c.dotY}" r="${innerR}" fill="#ffffff" stroke="${BRAND_GOLD}" stroke-width="2.5"/>`;

      if (t >= c.tText) {
        const titleTspans = buildAnimatedCharsTspans(c.title, t, c.tText, 0.026, 0.16);
        const detailStart = c.tText + Array.from(c.title).length * 0.022;
        const detailTspans = buildAnimatedCharsTspans(c.detail, t, detailStart, 0.025, 0.18);

        body += `<text x="${c.textX}" y="${c.titleY}" xml:space="preserve" font-family="${BODY_FONT}" font-size="20" font-weight="700" letter-spacing="3.5" fill="${BRAND_GOLD}" filter="url(#sh)">${titleTspans}</text>`;
        body += `<text x="${c.textX}" y="${c.detailY}" xml:space="preserve" font-family="${TITLE_FONT}" font-size="26" font-style="italic" font-weight="500" fill="#ffffff" filter="url(#sh)">${detailTspans}</text>`;
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
      <g opacity="${globalAlpha.toFixed(3)}">${body}</g>
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

async function renderMoCollectionIntroV10() {
  console.log('--- RENDERING V10 "MO" REELS: SLOW 8.2s LEFT-TO-RIGHT FINALE & SLOWER FINALE TEXT ---');
  const tempDir = fs.mkdtempSync(path.join(scratchDir, 'mo_intro_v10_'));

  // 1. 3840x2144 (16:9) 4K Master Room Canvas
  const masterRoomPath = path.join(tempDir, 'master_room_4k.jpg');
  await sharp(heroPath)
    .resize(3840, 2144, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
    .modulate({ brightness: 1.02, saturation: 1.04 })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile(masterRoomPath);

  // Ortadaki ürün için 2160x3840 (4K 9:16) referans zemin (Sahne 3 ve 4 için)
  const baseW = 1206, baseH = 2144;
  const leftCrop = Math.max(0, Math.min(3840 - baseW, Math.round((3840 - baseW) * 0.495)));
  const center9x16Path = path.join(tempDir, 'center_product_4k_9x16.jpg');
  await sharp(masterRoomPath)
    .extract({ left: leftCrop, top: 0, width: baseW, height: baseH })
    .resize(2160, 3840, { kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile(center9x16Path);

  // 2. Üst Brand Bar (y=208, Instagram arayüz güvenli alanında)
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
    <text x="72" y="208" font-family="${BODY_FONT}" font-size="22" font-weight="700" letter-spacing="8" fill="#ffffff" fill-opacity="0.94">NOVA FURNITURE</text>
    <text x="${VW - 72}" y="208" text-anchor="end" font-family="${BODY_FONT}" font-size="18" font-weight="600" letter-spacing="5" fill="${BRAND_GOLD}" fill-opacity="0.94">BERGAMO COLLECTION</text>
    <line x1="72" y1="232" x2="${VW - 72}" y2="232" stroke="${BRAND_GOLD}" stroke-width="1.3" stroke-opacity="0.45"/>
  </svg>`;
  const brandBarPng = path.join(tempDir, 'brand_bar.png');
  await sharp(Buffer.from(topBrandSvg)).png().toFile(brandBarPng);

  async function renderPanScene({
    name,
    duration,
    zFixed = 1.01,
    ax0 = 0.0,
    ax1 = 0.2,
    ay0 = 0.5,
    ay1 = 0.5,
    rackFocusOpen = false,
    cardSeq = null,
    cardY = 1410
  }) {
    const outPath = path.join(tempDir, `${name}.mp4`);
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

    await runFfmpeg(args, name);
    return { path: outPath, duration };
  }

  async function renderCenterZoomScene({
    name,
    duration,
    zExprCustom = null,
    z0 = 1.13,
    z1 = 1.00,
    centerY = 0.48,
    cardSeq = null,
    cardY = 0
  }) {
    const outPath = path.join(tempDir, `${name}.mp4`);
    const frames = Math.round(duration * FPS);
    const e = `(0.5-0.5*cos(PI*on/${frames}))`;
    const zExpr = zExprCustom || `${z0}+(${z1 - z0})*${e}`;
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

    await runFfmpeg(args, name);
    return { path: outPath, duration };
  }

  const scenes = [];

  // ─── SAHNE 1 (7.0s): Başlangıç + Sinematik Bulanık Odak Açılışı + Tanıtım Metni 1. Parça (Aynen Korundu) ───
  console.log('Rendering Scene 1 (Rack Focus + Intro Part 1)...');
  const seq1 = await renderTypewriterCardSequence(tempDir, 's1', 7.0, {
    eyebrow: 'KAHVE KÖŞESİ KOLEKSİYONLARI',
    title: 'BERGAMO KAHVE KÖŞESİ',
    lines: [
      'Yaşam alanınızda kahve keyfinin en asil halini',
      'deneyimlemeye hazır mısınız?'
    ],
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

  // ─── SAHNE 2 (7.0s): Yavaş Dönüş + Tanıtım Metni 2. Parça (Aynen Korundu) ───
  console.log('Rendering Scene 2 (Slow Turn + Intro Part 2)...');
  const seq2 = await renderTypewriterCardSequence(tempDir, 's2', 7.0, {
    eyebrow: 'MİMARİ ATMOSFER & IŞIK',
    lines: [
      'Modern çizgileri sıcak aydınlatma detaylarıyla',
      'harmanlayan Bergamo Kahve Köşesi Koleksiyonu,'
    ],
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

  // ─── SAHNE 3 (7.2s): Ortadaki Ürüne Odak + Hafif Geri Çekilme (z: 1.13 -> 1.00) + Tanıtım Metni 3. Parça (Aynen Korundu) ───
  console.log('Rendering Scene 3 (Center Product Focus & Gentle Pull-Back + Intro Part 3)...');
  const seq3 = await renderTypewriterCardSequence(tempDir, 's3', 7.2, {
    eyebrow: 'ZAMANSIZ İŞÇİLİK',
    lines: [
      '...titiz işçiliğiyle evinizin',
      'en sevilen köşesi olmaya aday.'
    ],
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

  // ─── SAHNE 4 (9.5s): Ortadaki Ürüne Tekrar Hafif Yakınlaşma (z: 1.00 -> 1.10) + Ürün Üzerinde 3 Animasyonlu Nokta & Çizgi & Özellik (Aynen Korundu) ───
  console.log('Rendering Scene 4 (Gentle Push-In on Middle Product + 3 Animated Point-and-Line Callouts)...');
  const seq4Callouts = await renderProductCalloutsSequence(tempDir, 9.5);
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
    xfadeAfter: 1.0 // Sahne 5'teki yavaş soldan sağa geçişe yumuşakça bağlanır
  });

  // ─── SAHNE 5 (8.2s): Soldan Sağa Çok Yavaş, Sakin Panoramik Geçiş (7-8 sn) + Daha Yavaş Harf Harf Yazılan Son Reklam Metni ───
  console.log('Rendering Scene 5 (Very Slow 8.2s Left-to-Right Glide + Slower Final Brand Ad Text)...');
  const seq5 = await renderTypewriterCardSequence(tempDir, 's5', 8.2, {
    eyebrow: 'BERGAMO KAHVE KÖŞESİ',
    title: 'NOVA FURNITURE',
    lines: [
      'Yaşam alanınıza değer katan zamansız koleksiyonlar.'
    ],
    footer: 'thenovafurniture.com  •  0505 015 1035',
    writeStart: 0.65,
    writeEnd: 6.35,        // Yazım ~5.7 saniyeye yayılarak kameranın yavaş temposuyla birebir uyumlu, ağırbaşlı yazılır
    maxCharInterval: 0.085,
    charFadeDur: 0.30
  });
  scenes.push({
    ...(await renderPanScene({
      name: 's5_slow_left_to_right_finale',
      duration: 8.2,
      zFixed: 1.00,
      ax0: 0.14, ax1: 0.72, // Soldan sağa 8.2 saniye boyunca çok yavaş, sakin ve asil süzülüş
      ay0: 0.50, ay1: 0.50,
      cardSeq: seq5,
      cardY: 1370
    })),
    xfadeAfter: 1.0
  });

  // ─── SAHNE 6 (4.6s): Siyah Arka Planlı Logolu Kapanış (Aynen Korundu) ───
  console.log('Rendering Scene 6 (Luxury Black Logo Outro)...');
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
    <text x="${VW / 2}" y="1118" text-anchor="middle" font-family="${TITLE_FONT}" font-size="34" font-style="italic" letter-spacing="2" fill="#e2e8f0">Bergamo Kahve Köşesi Koleksiyonu</text>
    <text x="${VW / 2}" y="1180" text-anchor="middle" font-family="${BODY_FONT}" font-size="21" font-weight="600" letter-spacing="6" fill="${BRAND_GOLD}">thenovafurniture.com</text>
    <text x="${VW / 2}" y="1230" text-anchor="middle" font-family="${BODY_FONT}" font-size="20" font-weight="500" letter-spacing="4" fill="#94a3b8">WhatsApp: 0505 015 1035</text>
  </svg>`;
  const outroJpg = path.join(tempDir, 'outro.jpg');
  await sharp(Buffer.from(outroSvg)).jpeg({ quality: 96 }).toFile(outroJpg);
  const out6 = path.join(tempDir, 's6_outro.mp4');
  await runFfmpeg([
    '-loop', '1', '-framerate', String(FPS), '-t', '4.6', '-i', outroJpg,
    '-vf', 'scale=1080:1920,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-an',
    out6
  ], 's6_outro');
  scenes.push({ path: out6, duration: 4.6, xfadeAfter: 1.0 });

  // Sahneleri kendi xfade süreleriyle birleştir
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
  const totalDur = curLen; // ~39.0s
  const videoNoAudio = path.join(tempDir, 'mo_v10_no_audio.mp4');

  concatArgs.push(
    '-filter_complex', fc.replace(/;$/, ''),
    '-map', `[${lastV}]`,
    '-t', totalDur.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    videoNoAudio
  );
  await runFfmpeg(concatArgs, 'stitch_mo_v10');

  // Sakin, huzurlu, %100 telifsiz ambians müziği
  const finalMoVideoPath = path.join(outDir, 'post03_mo_collection_intro_v10.mp4');
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
    finalMoVideoPath
  ], 'master_mo_v10_audio');

  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}

  console.log(`✅ Rendered V10 "MO" Collection Intro Reels (${totalDur.toFixed(1)}s):`, finalMoVideoPath);
  return finalMoVideoPath;
}

async function publishOnlyMoReels(videoPath) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const IG_USER_ID = process.env.META_IG_USER_ID;
  const IG_TOKEN = process.env.META_IG_ACCESS_TOKEN;

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const storagePrefix = `social-renders/bergamo-mo-v10-${Date.now()}`;

  async function uploadToStorage(fileName, buffer, contentType) {
    const filePath = `${storagePrefix}/${fileName}`;
    const { error } = await supabase.storage.from('media').upload(filePath, buffer, { contentType, upsert: true });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return supabase.storage.from('media').getPublicUrl(filePath).data.publicUrl;
  }

  console.log('\nUploading V10 "MO" Reels video & cover to Supabase Storage...');
  const coverRightMoBuf = fs.readFileSync(path.join(scratchDir, 'v7_reel_cover_3_post03_right.jpg'));
  const coverRightMoUrl = await uploadToStorage('cover-right-mo-v10.jpg', coverRightMoBuf, 'image/jpeg');
  const videoRightMoUrl = await uploadToStorage('post-mo-collection-intro-v10.mp4', fs.readFileSync(videoPath), 'video/mp4');

  console.log('- Cover URL:', coverRightMoUrl);
  console.log('- Video URL:', videoRightMoUrl);

  const captionMo = `✨ BERGAMO KAHVE KÖŞESİ — KOLEKSİYON TANITIMI

Yaşam alanınızda kahve keyfinin en asil halini deneyimlemeye hazır mısınız? Modern çizgileri sıcak aydınlatma detaylarıyla harmanlayan Bergamo Kahve Köşesi Koleksiyonu, titiz işçiliğiyle evinizin en sevilen köşesi olmaya aday.

🏛️ Koleksiyonda yer alan tüm modül seçeneklerini ve ölçü detaylarını incelemek için profilimizdeki katalog gönderisine göz atabilirsiniz.

📩 Detaylı bilgi ve sipariş için DM veya WhatsApp: 0505 015 1035
🌐 thenovafurniture.com

#thenovafurniture #novafurniture #bergamokahveköşesi #kahveköşesi #koleksiyontanıtımı #içmimari #mobilyatasarım #evdekorasyonu #luxuryhome #interiordesign`;

  const pMoParams = new URLSearchParams({
    access_token: IG_TOKEN,
    media_type: 'REELS',
    video_url: videoRightMoUrl,
    cover_url: coverRightMoUrl,
    share_to_feed: 'true',
    caption: captionMo
  });

  const initRes = await fetch(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, { method: 'POST', body: pMoParams });
  const initData = await initRes.json();
  if (!initRes.ok || !initData?.id) throw new Error(`MO Reels init error: ${JSON.stringify(initData)}`);
  const creationId = initData.id;
  console.log(`Container created: ${creationId}. Waiting for Instagram processing...`);

  const start = Date.now();
  while ((Date.now() - start) < 180000) {
    await new Promise(r => setTimeout(r, 5000));
    const stRes = await fetch(`https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status`, {
      headers: { Authorization: `Bearer ${IG_TOKEN}` }
    });
    const stData = await stRes.json();
    console.log(`- Status: ${stData.status_code}`);
    if (stData.status_code === 'FINISHED') break;
    if (stData.status_code === 'ERROR') throw new Error(`Processing error: ${JSON.stringify(stData)}`);
  }

  const pubParams = new URLSearchParams({ creation_id: creationId, access_token: IG_TOKEN });
  const pubRes = await fetch(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media_publish`, { method: 'POST', body: pubParams });
  const pubData = await pubRes.json();
  if (!pubRes.ok || !pubData?.id) throw new Error(`Publish error: ${JSON.stringify(pubData)}`);

  const permRes = await fetch(`https://graph.facebook.com/v21.0/${pubData.id}?fields=id,permalink`, {
    headers: { Authorization: `Bearer ${IG_TOKEN}` }
  });
  const permData = await permRes.json();
  console.log(`\n✅ V10 "MO" REELS PUBLISHED SUCCESSFULLY!`);
  console.log(`Media ID: ${pubData.id} | Link: ${permData.permalink}`);
}

const videoPath = await renderMoCollectionIntroV10();
await publishOnlyMoReels(videoPath);

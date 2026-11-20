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

/**
 * Bir metin satırındaki her harfi <tspan fill-opacity="..."> içine alarak
 * verilen global zamanda (t) harf harf yumuşak belirmesini (After Effects Range Selector tarzı) sağlar.
 * Tam satır her karede mevcut olduğu için text-anchor="middle" hizası ve harf aralıkları ASLA kaymaz!
 */
function buildAnimatedCharsTspans(text, t, startTime, charInterval, charFadeDur = 0.22) {
  const chars = Array.from(String(text || ''));
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const cStart = startTime + i * charInterval;
    const rawOp = (t - cStart) / charFadeDur;
    const op = Math.max(0, Math.min(1, rawOp));
    // Smoothstep easing for each letter's opacity
    const smoothOp = (op * op * (3 - 2 * op)).toFixed(3);
    out += `<tspan fill-opacity="${smoothOp}">${escXml(chars[i])}</tspan>`;
  }
  return out;
}

/**
 * Bir sahnenin tüm kareleri için (30 FPS) harf harf zarifçe yazılan (ve sahne sonunda yumuşakça sönen)
 * şeffaf PNG kare dizisini paralel olarak üretir.
 */
async function renderTypewriterCardSequence(tempDir, sceneName, duration, {
  eyebrow = '',
  title = '',
  lines = [],
  footer = '',
  writeStart = 0.45,
  writeEnd = null
}) {
  const seqDir = path.join(tempDir, `seq_${sceneName}`);
  fs.mkdirSync(seqDir, { recursive: true });

  const totalFrames = Math.round(duration * FPS);
  const fadeOutStart = duration - 1.05;
  const fadeOutDur = 0.85;

  // Toplam harf sayısını hesapla ve kamera temposuna uyumlu harf hızı belirle
  const segments = [];
  if (eyebrow) segments.push({ type: 'eyebrow', text: eyebrow, weight: 0.7 });
  if (title) segments.push({ type: 'title', text: title, weight: 1.0 });
  for (const ln of lines) segments.push({ type: 'line', text: ln, weight: 1.0 });
  if (footer) segments.push({ type: 'footer', text: footer, weight: 0.65 });

  const totalChars = segments.reduce((acc, s) => acc + Array.from(s.text).length, 0);
  // Yazım süresi sahnenin ~%58'ini kapsasın (kameranın temposuyla uyumlu, ne çok hızlı ne çok yavaş)
  const targetWriteSpan = (writeEnd || Math.min(duration - 2.1, Math.max(2.6, duration * 0.56))) - writeStart;
  const baseCharInterval = Math.max(0.024, Math.min(0.055, targetWriteSpan / Math.max(12, totalChars)));

  // Her satırın başlangıç zamanını sırayla hesapla
  let cursorTime = writeStart;
  for (const seg of segments) {
    seg.startTime = cursorTime;
    seg.charInterval = baseCharInterval * seg.weight;
    const len = Array.from(seg.text).length;
    cursorTime += len * seg.charInterval + 0.14; // Satırlar arası zarif mikro es
  }

  const cardH = 380;

  async function renderSingleFrame(f) {
    const t = f / FPS;
    // Sahne sonu genel yumuşak kapanış (fade-out)
    let globalAlpha = 1.0;
    if (t > fadeOutStart) {
      const p = Math.max(0, Math.min(1, (t - fadeOutStart) / fadeOutDur));
      globalAlpha = 1.0 - (p * p * (3 - 2 * p));
    }

    let y = 56;
    let body = '';

    for (const seg of segments) {
      if (seg.type === 'eyebrow') {
        const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, 0.20);
        body += `<text x="${VW / 2}" y="${y}" text-anchor="middle" font-family="${BODY_FONT}" font-size="21" font-weight="700" letter-spacing="7" fill="${BRAND_GOLD}">${tspans}</text>`;
        y += 48;
      } else if (seg.type === 'title') {
        const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, 0.24);
        body += `<text x="${VW / 2}" y="${y}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="48" font-weight="700" letter-spacing="3" fill="#ffffff">${tspans}</text>`;
        y += 24;
        // Başlığın altındaki altın çizgi de başlıkla birlikte merkezden iki yana doğru zarifçe uzasın
        const titleDur = Array.from(seg.text).length * seg.charInterval;
        const lineProg = Math.max(0, Math.min(1, (t - seg.startTime) / Math.max(0.4, titleDur)));
        const smoothLine = lineProg * lineProg * (3 - 2 * lineProg);
        const lineW = (120 * smoothLine).toFixed(1);
        if (lineProg > 0.01) {
          body += `<rect x="${(VW / 2 - lineW / 2).toFixed(1)}" y="${y}" width="${lineW}" height="2" fill="${BRAND_GOLD}" fill-opacity="${(0.85 * smoothLine).toFixed(3)}"/>`;
        }
        y += 46;
      } else if (seg.type === 'line') {
        const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, 0.24);
        body += `<text x="${VW / 2}" y="${y}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="35" font-style="italic" font-weight="500" letter-spacing="1" fill="#f8fafc">${tspans}</text>`;
        y += 50;
      } else if (seg.type === 'footer') {
        y += 8;
        const tspans = buildAnimatedCharsTspans(seg.text, t, seg.startTime, seg.charInterval, 0.20);
        body += `<text x="${VW / 2}" y="${y}" text-anchor="middle" font-family="${BODY_FONT}" font-size="19" font-weight="600" letter-spacing="5" fill="${BRAND_GOLD}">${tspans}</text>`;
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

  // 16'lı paralel gruplar halinde tüm kareleri hızlıca üret
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

async function renderMoCollectionIntroV8() {
  console.log('--- RENDERING V8 "MO" REELS: LETTER-BY-LETTER & CUSTOM CAMERA CHOREOGRAPHY ---');
  const tempDir = fs.mkdtempSync(path.join(scratchDir, 'mo_intro_v8_'));

  // 1. 3840x2144 (16:9) 4K Master Room Canvas
  const masterRoomPath = path.join(tempDir, 'master_room_4k.jpg');
  await sharp(heroPath)
    .resize(3840, 2144, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
    .modulate({ brightness: 1.02, saturation: 1.04 })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile(masterRoomPath);

  // 2. Üst Brand Bar: Instagram Reels arayüzünün kapatmaması için y=118'den y=208'e indirildi!
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

  // Pan / Diagonal Crane Kamera Sahnesi Üretici
  async function renderPanOrCraneScene({
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

  // Ortadaki Ürüne Odaklanıp Hafif Geri Çekilme (Pull-Back) Kamera Sahnesi Üretici (Sahne 3 için)
  async function renderCenterPullBackScene({
    name,
    duration,
    z0 = 1.13,
    z1 = 1.00,
    centerX = 0.495,
    centerY = 0.50,
    cardSeq = null,
    cardY = 1440
  }) {
    const outPath = path.join(tempDir, `${name}.mp4`);
    // 3840x2144 ana görselin tam ortasındaki ürünü (centerX) merkez alan 1206x2144 (9:16) alanı
    // 2160x3840 (4K 9:16) olarak hazırlıyoruz ki zoompan %100 doğru en-boy oranında sarsıntısız geri çekilme yapsın!
    const baseW = 1206, baseH = 2144;
    const leftCrop = Math.max(0, Math.min(3840 - baseW, Math.round((3840 - baseW) * centerX)));
    const center9x16Path = path.join(tempDir, `${name}_base_9x16.jpg`);
    await sharp(masterRoomPath)
      .extract({ left: leftCrop, top: 0, width: baseW, height: baseH })
      .resize(2160, 3840, { kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
      .toFile(center9x16Path);

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

    await runFfmpeg(args, name);
    return { path: outPath, duration };
  }

  const scenes = [];

  // ─── SAHNE 1 (7.0s): Başlangıç + Sinematik Bulanık Odak Açılışı + Tanıtım Metni 1. Cümle (Aynen Korundu + Harf Harf Yazım) ───
  console.log('Rendering Scene 1 (Rack Focus + Intro Sentence 1 Letter-by-Letter)...');
  const seq1 = await renderTypewriterCardSequence(tempDir, 's1', 7.0, {
    eyebrow: 'KAHVE KÖŞESİ KOLEKSİYONLARI',
    title: 'BERGAMO KAHVE KÖŞESİ',
    lines: [
      'Yaşam alanınızda kahve keyfinin en asil halini',
      'deneyimlemeye hazır mısınız?'
    ],
    writeStart: 0.55
  });
  scenes.push(await renderPanOrCraneScene({
    name: 's1_opening_window_bar',
    duration: 7.0,
    zFixed: 1.01,
    ax0: 0.00, ax1: 0.18,
    ay0: 0.50, ay1: 0.50,
    rackFocusOpen: true,
    cardSeq: seq1,
    cardY: 1385
  }));

  // ─── SAHNE 2 (7.0s): Sağdan Sola / Yavaş Dönüş + Tanıtım Metni 2. Cümle (Aynen Korundu + Harf Harf Yazım) ───
  console.log('Rendering Scene 2 (Slow Turn + Intro Sentence 2 Letter-by-Letter)...');
  const seq2 = await renderTypewriterCardSequence(tempDir, 's2', 7.0, {
    eyebrow: 'MİMARİ ATMOSFER & IŞIK',
    lines: [
      'Modern çizgileri sıcak aydınlatma detaylarıyla',
      'harmanlayan Bergamo Kahve Köşesi Koleksiyonu,'
    ],
    writeStart: 0.45
  });
  scenes.push(await renderPanOrCraneScene({
    name: 's2_lounge_turn',
    duration: 7.0,
    zFixed: 1.01,
    ax0: 1.00, ax1: 0.80,
    ay0: 0.50, ay1: 0.50,
    cardSeq: seq2,
    cardY: 1450
  }));

  // ─── SAHNE 3 (7.2s): Ortadaki Ürüne Odaklanıp Hafif Geri Çekilme (Pull-Back: z=1.13 -> 1.00) + Tanıtım Metni Son Cümlesi ───
  console.log('Rendering Scene 3 (Center Product Focus & Gentle Pull-Back + Intro Sentence 3)...');
  const seq3 = await renderTypewriterCardSequence(tempDir, 's3', 7.2, {
    eyebrow: 'ZAMANSIZ İŞÇİLİK',
    lines: [
      '...titiz işçiliğiyle evinizin',
      'en sevilen köşesi olmaya aday.'
    ],
    writeStart: 0.45
  });
  scenes.push(await renderCenterPullBackScene({
    name: 's3_center_pullback',
    duration: 7.2,
    z0: 1.13,
    z1: 1.00,
    centerX: 0.495,
    centerY: 0.48,
    cardSeq: seq3,
    cardY: 1450
  }));

  // ─── SAHNE 4 (7.2s): Yukarıdan Aşağıya Çapraz Kamera Dönüşü (Diagonal Crane Tilt-Down) + Teknik Detay Metni ───
  console.log('Rendering Scene 4 (Diagonal Upper-Left to Lower-Right Crane Glide + Technical Details)...');
  const seq4 = await renderTypewriterCardSequence(tempDir, 's4', 7.2, {
    eyebrow: 'BÜTÜNCÜL YAŞAM ALANI',
    lines: [
      '1. Sınıf MDF Gövde • Özel CNC Membran Kapaklar',
      'Sıcak Amber Aydınlatma & Fonksiyonel Tasarım'
    ],
    footer: 'NOVA FURNITURE',
    writeStart: 0.45
  });
  scenes.push(await renderPanOrCraneScene({
    name: 's4_diagonal_crane_technical',
    duration: 7.2,
    zFixed: 1.12, // Dikey (yukarıdan aşağıya ~230px) ve yatay çapraz hareket payı sağlar
    ax0: 0.30, ax1: 0.68,
    ay0: 0.00, ay1: 1.00,
    cardSeq: seq4,
    cardY: 1420
  }));

  // ─── SAHNE 5 (8.2s): Sağdan Başlayıp Görselin Soluna Sonuna Kadar Tam Panoramik Geçiş (ax: 1.00 -> 0.00) + Koleksiyon İsmi & Nova Furniture Reklam Metni ───
  console.log('Rendering Scene 5 (Full Right-to-Left End-to-End Panorama ax:1.00->0.00 + Brand Ad Text)...');
  const seq5 = await renderTypewriterCardSequence(tempDir, 's5', 8.2, {
    eyebrow: 'BERGAMO KAHVE KÖŞESİ',
    title: 'NOVA FURNITURE',
    lines: [
      'Yaşam alanınıza değer katan zamansız koleksiyonlar.'
    ],
    footer: 'thenovafurniture.com  •  0505 015 1035',
    writeStart: 0.45
  });
  scenes.push(await renderPanOrCraneScene({
    name: 's5_full_right_to_left_panorama',
    duration: 8.2,
    zFixed: 1.00, // Tam boy, en geniş açı
    ax0: 1.00, ax1: 0.00, // Görselin en sağından başlayıp en soluna sonuna kadar kesintisiz gider!
    ay0: 0.50, ay1: 0.50,
    cardSeq: seq5,
    cardY: 1370
  }));

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
  scenes.push({ path: out6, duration: 4.6 });

  // Sahneleri 1.1 saniyelik yumuşak sinematik cross-dissolve (fade) ile birleştir
  const XFADE = 1.1;
  const concatArgs = [];
  scenes.forEach(s => concatArgs.push('-i', s.path));

  let fc = scenes.map((_, i) => `[${i}:v]settb=AVTB[v${i}];`).join('');
  let offset = scenes[0].duration - XFADE;
  let lastV = 'v0';
  for (let i = 1; i < scenes.length; i++) {
    const nextV = `x${i}`;
    fc += `[${lastV}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[${nextV}];`;
    lastV = nextV;
    offset += scenes[i].duration - XFADE;
  }
  const totalDur = offset + XFADE; // ~35.7s
  const videoNoAudio = path.join(tempDir, 'mo_v8_no_audio.mp4');

  concatArgs.push(
    '-filter_complex', fc.replace(/;$/, ''),
    '-map', `[${lastV}]`,
    '-t', totalDur.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    videoNoAudio
  );
  await runFfmpeg(concatArgs, 'stitch_mo_v8');

  // Sakin, huzurlu, %100 telifsiz ambians müziği
  const finalMoVideoPath = path.join(outDir, 'post03_mo_collection_intro_v8.mp4');
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
  ], 'master_mo_v8_audio');

  // Geçici kare dizilerini temizle
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}

  console.log(`✅ Rendered V8 "MO" Collection Intro Reels (${totalDur.toFixed(1)}s):`, finalMoVideoPath);
  return finalMoVideoPath;
}

// SADECE "MO" REELS GÖNDERİSİNİ YAYINLA
async function publishOnlyMoReels(videoPath) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const IG_USER_ID = process.env.META_IG_USER_ID;
  const IG_TOKEN = process.env.META_IG_ACCESS_TOKEN;

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const storagePrefix = `social-renders/bergamo-mo-v8-${Date.now()}`;

  async function uploadToStorage(fileName, buffer, contentType) {
    const filePath = `${storagePrefix}/${fileName}`;
    const { error } = await supabase.storage.from('media').upload(filePath, buffer, { contentType, upsert: true });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return supabase.storage.from('media').getPublicUrl(filePath).data.publicUrl;
  }

  console.log('\nUploading V8 "MO" Reels video & cover to Supabase Storage...');
  const coverRightMoBuf = fs.readFileSync(path.join(scratchDir, 'v7_reel_cover_3_post03_right.jpg'));
  const coverRightMoUrl = await uploadToStorage('cover-right-mo-v8.jpg', coverRightMoBuf, 'image/jpeg');
  const videoRightMoUrl = await uploadToStorage('post-mo-collection-intro-v8.mp4', fs.readFileSync(videoPath), 'video/mp4');

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
  console.log(`\n✅ V8 "MO" REELS PUBLISHED SUCCESSFULLY!`);
  console.log(`Media ID: ${pubData.id} | Link: ${permData.permalink}`);
}

const videoPath = await renderMoCollectionIntroV8();
await publishOnlyMoReels(videoPath);

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const outDir = 'C:/Users/User/.gemini/antigravity/brain/9efb0127-f0ed-4760-90e7-0c7d7461b346';
const scratchDir = path.join(outDir, 'scratch');
const heroPath = path.join(scratchDir, 'bergamo_original_hero.jpg');
const currentDir = path.resolve('C:/Users/User/Desktop/Insta_Deployment/Sunucu/publisher');
const ffmpegBin = path.join(currentDir, 'node_modules/ffmpeg-static/ffmpeg.exe');

const TITLE_FONT = 'Playfair Display, Georgia, serif';
const BODY_FONT = 'Montserrat, Arial, sans-serif';
const BRAND_GOLD = '#C9A24B';

// Resmî Koleksiyon Tanıtım Metni (Veritabanındaki kisa_aciklama / promoQuote ile birebir aynı!)
const OFFICIAL_INTRO_SENTENCES = [
  'Yaşam alanınızda kahve keyfinin en asil halini deneyimlemeye hazır mısınız?',
  'Modern çizgileri sıcak aydınlatma detaylarıyla harmanlayan Bergamo Kahve Köşesi Koleksiyonu,',
  'titiz işçiliğiyle evinizin en sevilen köşesi olmaya aday.'
];

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

// ============================================================================
// BÖLÜM 1: V7 KUSURSUZ TRİPTİK KAPAKLARI (Sütun Arası 6px Izgara Boşluğu + Birebir Çerçeve Rengi)
// ============================================================================
async function generateV7TriptychCovers() {
  console.log('--- 1. GENERATING V7 PIXEL-PERFECT TRIPTYCH COVERS ---');
  const heroBuf = fs.readFileSync(heroPath);

  const W = 1080;
  const H_GRID = 1440;     // Instagram 3:4 ızgara hücresi
  const GAP = 6;           // Instagram'ın sütunlar arasına koyduğu 2px siyah çizginin 1080 ölçeğindeki karşılığı (6px)
  const W_MASTER = W * 3 + GAP * 2; // 3252
  const H_CAROUSEL = 1350; // 4:5 Carousel slayt yüksekliği

  const baseWide = await sharp(heroBuf)
    .resize(W_MASTER, H_GRID, { fit: 'cover', position: 'centre' })
    .toBuffer();

  const m1 = 44;
  const m2 = 58;

  // Ana görsele çerçeve ve BERGAMO yazısını tek parça olarak işliyoruz
  const masterSvg = `<svg width="${W_MASTER}" height="${H_GRID}" xmlns="http://www.w3.org/2000/svg">
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
      <filter id="drop" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.85"/>
      </filter>
    </defs>

    <rect width="${W_MASTER}" height="${H_GRID}" fill="url(#softVignette)"/>

    <!-- Dış altın çerçeve ve iç beyaz çerçeve -->
    <rect x="${m1}" y="${m1}" width="${W_MASTER - m1 * 2}" height="${H_GRID - m1 * 2}"
          fill="none" stroke="${BRAND_GOLD}" stroke-width="3.2" stroke-opacity="0.88" filter="url(#frameShadow)"/>
    <rect x="${m2}" y="${m2}" width="${W_MASTER - m2 * 2}" height="${H_GRID - m2 * 2}"
          fill="none" stroke="#ffffff" stroke-width="1.3" stroke-opacity="0.48"/>

    <!-- 4 Köşe Aksanı -->
    <line x1="${m1 - 12}" y1="${m1}" x2="${m1 + 48}" y2="${m1}" stroke="${BRAND_GOLD}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${m1}" y1="${m1 - 12}" x2="${m1}" y2="${m1 + 48}" stroke="${BRAND_GOLD}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${W_MASTER - m1 - 48}" y1="${m1}" x2="${W_MASTER - m1 + 12}" y2="${m1}" stroke="${BRAND_GOLD}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${W_MASTER - m1}" y1="${m1 - 12}" x2="${W_MASTER - m1}" y2="${m1 + 48}" stroke="${BRAND_GOLD}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${m1 - 12}" y1="${H_GRID - m1}" x2="${m1 + 48}" y2="${H_GRID - m1}" stroke="${BRAND_GOLD}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${m1}" y1="${H_GRID - m1 - 48}" x2="${m1}" y2="${H_GRID - m1 + 12}" stroke="${BRAND_GOLD}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${W_MASTER - m1 - 48}" y1="${H_GRID - m1}" x2="${W_MASTER - m1 + 12}" y2="${H_GRID - m1}" stroke="${BRAND_GOLD}" stroke-width="4.5" stroke-opacity="0.95"/>
    <line x1="${W_MASTER - m1}" y1="${H_GRID - m1 - 48}" x2="${W_MASTER - m1}" y2="${H_GRID - m1 + 12}" stroke="${BRAND_GOLD}" stroke-width="4.5" stroke-opacity="0.95"/>

    <!-- Baştan Sona Tek Parça BERGAMO Yazısı -->
    <text x="${W_MASTER / 2}" y="${H_GRID / 2 + 195}"
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
          filter="url(#textGlow)">BERGAMO</text>

    <!-- Orta Katalog Rehber Yazısı -->
    <text x="${W_MASTER / 2}" y="185" text-anchor="middle" font-family="${BODY_FONT}" font-size="22" font-weight="800" letter-spacing="8" fill="#ffffff" filter="url(#drop)">NOVA FURNITURE</text>
    <text x="${W_MASTER / 2}" y="1195" text-anchor="middle" font-family="${BODY_FONT}" font-size="20" font-weight="700" letter-spacing="6" fill="${BRAND_GOLD}" filter="url(#drop)">DİJİTAL KOLEKSİYON KATALOĞU</text>
    <text x="${W_MASTER / 2}" y="1240" text-anchor="middle" font-family="${BODY_FONT}" font-size="18" font-weight="600" letter-spacing="4" fill="#ffffff" filter="url(#drop)">ÖLÇÜLER &amp; MODÜLLER İÇİN KAYDIRIN  →</text>
  </svg>`;

  const masterBuf = await sharp(baseWide)
    .composite([{ input: Buffer.from(masterSvg) }])
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const bg9x16 = await sharp(heroBuf)
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .blur(40)
    .modulate({ brightness: 0.35 })
    .toBuffer();

  const reelTop = Math.round((1920 - H_GRID) / 2); // 240

  // Sol Parça (x: 0..1080) ve Sağ Parça (x: 2172..3252)
  const leftPanel = await sharp(masterBuf).extract({ left: 0, top: 0, width: W, height: H_GRID }).jpeg({ quality: 96, chromaSubsampling: '4:4:4' }).toBuffer();
  const rightPanel = await sharp(masterBuf).extract({ left: (W + GAP) * 2, top: 0, width: W, height: H_GRID }).jpeg({ quality: 96, chromaSubsampling: '4:4:4' }).toBuffer();

  const reelCoverLeft = await sharp(bg9x16).composite([{ input: leftPanel, top: reelTop, left: 0 }]).jpeg({ quality: 96, chromaSubsampling: '4:4:4' }).toBuffer();
  const reelCoverRight = await sharp(bg9x16).composite([{ input: rightPanel, top: reelTop, left: 0 }]).jpeg({ quality: 96, chromaSubsampling: '4:4:4' }).toBuffer();

  fs.writeFileSync(path.join(scratchDir, 'v7_reel_cover_1_post01_left.jpg'), reelCoverLeft);
  fs.writeFileSync(path.join(scratchDir, 'v7_reel_cover_3_post03_right.jpg'), reelCoverRight);

  // Orta Parça (Görünür 3:4 alan: x = 1086..2166, genişlik = 1080)
  // 4:5 (1080x1350) için 1152x1440 kesip (left = 1086 - 36 = 1050) 1080x1350'ye indiriyoruz.
  // VE yeniden örnekleme (resampling) sırasında çerçeve çizgisinin renginin/parlaklığının %10 solmasını önlemek için
  // 1080x1350 üzerinde tam karşılık gelen y koordinatlarına (m1_4x5 = 44 * 1350 / 1440 = 41.25, m2_4x5 = 58 * 1350 / 1440 = 54.375)
  // hafif güçlendirilmiş çerçeve katmanı uyguluyoruz!
  const wExtract = 1152;
  const xExtract = (W + GAP) - 36; // 1086 - 36 = 1050
  const m1c = (m1 * H_CAROUSEL / H_GRID).toFixed(2); // 41.25
  const m2c = (m2 * H_CAROUSEL / H_GRID).toFixed(2); // 54.38
  const crispFrameBoostSvg = `<svg width="${W}" height="${H_CAROUSEL}" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="${m1c}" x2="${W}" y2="${m1c}" stroke="${BRAND_GOLD}" stroke-width="2.6" stroke-opacity="0.42"/>
    <line x1="0" y1="${(H_CAROUSEL - m1 * H_CAROUSEL / H_GRID).toFixed(2)}" x2="${W}" y2="${(H_CAROUSEL - m1 * H_CAROUSEL / H_GRID).toFixed(2)}" stroke="${BRAND_GOLD}" stroke-width="2.6" stroke-opacity="0.42"/>
    <line x1="0" y1="${m2c}" x2="${W}" y2="${m2c}" stroke="#ffffff" stroke-width="1.1" stroke-opacity="0.22"/>
    <line x1="0" y1="${(H_CAROUSEL - m2 * H_CAROUSEL / H_GRID).toFixed(2)}" x2="${W}" y2="${(H_CAROUSEL - m2 * H_CAROUSEL / H_GRID).toFixed(2)}" stroke="#ffffff" stroke-width="1.1" stroke-opacity="0.22"/>
  </svg>`;

  const centerSlide4x5 = await sharp(masterBuf)
    .extract({ left: xExtract, top: 0, width: wExtract, height: H_GRID })
    .resize(W, H_CAROUSEL, { kernel: sharp.kernel.lanczos3 })
    .composite([{ input: Buffer.from(crispFrameBoostSvg) }])
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();

  fs.writeFileSync(path.join(scratchDir, 'v7_post02_slide_1_center.jpg'), centerSlide4x5);
  console.log('Saved V7 covers successfully.');
}

// ============================================================================
// BÖLÜM 2: "MO" REELS VİDEOSU (SAĞ PARÇA / İLK YAYINLANAN — GENEL KOLEKSİYON & ATMOSFER TANITIMI)
// - Ürünlerin üzerine zoom yapılmaz; fotoğraf tam boy (tavan kirişlerinden zemine) geniş atmosferiyle sunulur.
// - Resmî tanıtım metni (kisa_aciklama) birebir kullanılır.
// - Sinematik odak açılışı (rack focus), sıcak güneş hüzmesi nefes efekti, yumuşak geçişler ve sakin ambians müziği.
// ============================================================================
async function renderMoCollectionIntroReels() {
  console.log('--- 2. RENDERING "MO" REELS: ATMOSPHERIC COLLECTION INTRO (NO MACRO ZOOM) ---');
  const VW = 1080, VH = 1920, FPS = 30;
  const tempDir = fs.mkdtempSync(path.join(scratchDir, 'mo_intro_v7_'));

  // Ana fotoğrafı (2752x1536) yüksek çözünürlüklü 3840x2143 (16:9) sinematik master tuvale hazırlıyoruz.
  // Böylece tam boy dikey (height = 2143) pencerede z=1.00..1.03 ile odanın tavanından tabanına tüm atmosferi
  // hiçbir ürüne aşırı zoom yapmadan, tam ekran (küçültme/kenar çubuğu olmadan) geziyoruz!
  const masterRoomPath = path.join(tempDir, 'master_room_4k.jpg');
  await sharp(heroPath)
    .resize(3840, 2144, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
    .modulate({ brightness: 1.02, saturation: 1.04 })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile(masterRoomPath);

  // Zarif Üst Marka & Alt Sinematik Okunurluk Gradyanı (Çok yumuşak, görseli boğmayan)
  const topBrandSvg = `<svg width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gAmbient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.52"/>
        <stop offset="16%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="70%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="86%" stop-color="#000000" stop-opacity="0.48"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.82"/>
      </linearGradient>
      <radialGradient id="warmSun" cx="20%" cy="25%" r="75%">
        <stop offset="0%" stop-color="#ffb84d" stop-opacity="0.14"/>
        <stop offset="50%" stop-color="#ff9933" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${VW}" height="${VH}" fill="url(#warmSun)"/>
    <rect width="${VW}" height="${VH}" fill="url(#gAmbient)"/>
    <text x="72" y="118" font-family="${BODY_FONT}" font-size="22" font-weight="700" letter-spacing="8" fill="#ffffff" fill-opacity="0.92">NOVA FURNITURE</text>
    <text x="${VW - 72}" y="118" text-anchor="end" font-family="${BODY_FONT}" font-size="18" font-weight="600" letter-spacing="5" fill="${BRAND_GOLD}" fill-opacity="0.92">BERGAMO COLLECTION</text>
    <line x1="72" y1="142" x2="${VW - 72}" y2="142" stroke="${BRAND_GOLD}" stroke-width="1.2" stroke-opacity="0.4"/>
  </svg>`;
  const brandBarPng = path.join(tempDir, 'brand_bar.png');
  await sharp(Buffer.from(topBrandSvg)).png().toFile(brandBarPng);

  // Zarif Editoryal Altyazı Kartı Üretici (Orta-alt hizada, şiirsel serif + altın aksanlı)
  async function makeEditorialCard(name, { eyebrow = '', title = '', lines = [], footer = '' }) {
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let svgBody = '';
    let y = 50;

    if (eyebrow) {
      svgBody += `<text x="${VW / 2}" y="${y}" text-anchor="middle" font-family="${BODY_FONT}" font-size="21" font-weight="700" letter-spacing="7" fill="${BRAND_GOLD}">${esc(eyebrow)}</text>`;
      y += 46;
    }
    if (title) {
      svgBody += `<text x="${VW / 2}" y="${y}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="48" font-weight="700" letter-spacing="3" fill="#ffffff">${esc(title)}</text>`;
      y += 26;
      svgBody += `<rect x="${VW / 2 - 55}" y="${y}" width="110" height="2" fill="${BRAND_GOLD}" fill-opacity="0.85"/>`;
      y += 48;
    }
    for (const ln of lines) {
      svgBody += `<text x="${VW / 2}" y="${y}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="35" font-style="italic" font-weight="500" letter-spacing="1" fill="#f8fafc">${esc(ln)}</text>`;
      y += 50;
    }
    if (footer) {
      y += 8;
      svgBody += `<text x="${VW / 2}" y="${y}" text-anchor="middle" font-family="${BODY_FONT}" font-size="19" font-weight="600" letter-spacing="5" fill="${BRAND_GOLD}">${esc(footer)}</text>`;
      y += 30;
    }

    const totalH = y + 30;
    const svg = `<svg width="${VW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <g filter="url(#sh)">${svgBody}</g>
    </svg>`;
    const p = path.join(tempDir, `${name}.png`);
    await sharp(Buffer.from(svg)).png().toFile(p);
    return { path: p, h: totalH };
  }

  // Geniş Atmosfer Kamera Sahnesi Üretici:
  // 3840x2144 (16:9) ana fotoğraftan 9:16 (1206x2144 * 1/z) tam boy dikey pencereyi kaydırır.
  // Böylece z=1.00 iken odanın tavanından tabanına %100 tam dikey boyutu görünür, hiçbir ürüne zoom yapılmaz!
  async function renderWideAtmosphereScene({
    name,
    duration,
    z0 = 1.00,
    z1 = 1.02,
    ax0 = 0.0,
    ax1 = 0.2,
    ay0 = 0.5,
    ay1 = 0.5,
    rackFocusOpen = false,
    card = null,
    cardY = 1440
  }) {
    const outPath = path.join(tempDir, `${name}.mp4`);
    const args = ['-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', masterRoomPath];

    // Tam boy (tavan kirişlerinden zemine %97-%100 dikey kapsama) 9:16 pencere:
    // zAvg ile pencere boyutu sabitlenir (ürünlere asla zoom yapmaz, tüm oda yüksekliğini korur),
    // x ve y ise her karede (t) cosine easing ile ipek gibi kayar!
    const zAvg = Math.max(1.0, Math.min(1.04, (z0 + z1) / 2));
    const ch = Math.round(2144 / zAvg / 2) * 2; // ~2100px (tam tavan-zemin yüksekliği)
    const cw = Math.round((ch * 9 / 16) / 2) * 2; // ~1182px (tam 9:16 dikey pencere)

    const e = `(0.5-0.5*cos(PI*t/${duration.toFixed(3)}))`;
    const axCur = `(${ax0}+(${ax1 - ax0})*${e})`;
    const ayCur = `(${ay0}+(${ay1 - ay0})*${e})`;
    const xExpr = `(iw-${cw})*${axCur}`;
    const yExpr = `(ih-${ch})*${ayCur}`;

    let vChain = `[0:v]crop=w=${cw}:h=${ch}:x='${xExpr}':y='${yExpr}':exact=1,scale=1080:1920:flags=lanczos,setsar=1`;
    if (rackFocusOpen) {
      // İlk 1.15 saniyede yumuşak sinematik bokeh'ten net odaklamaya geçiş
      vChain += `,split[sharp][blurSrc];[blurSrc]gblur=sigma=14,fade=t=out:st=0.15:d=1.15:alpha=1[blurOv];[sharp][blurOv]overlay=0:0`;
    }
    vChain += `,format=yuv420p[bg0];`;

    // Brand bar overlay
    args.push('-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', brandBarPng);
    vChain += `[1:v]format=rgba[bb];[bg0][bb]overlay=0:0[bg1];`;

    let last = 'bg1';
    if (card) {
      args.push('-loop', '1', '-framerate', String(FPS), '-t', duration.toFixed(3), '-i', card.path);
      const stOut = Math.max(1.5, duration - 1.1).toFixed(2);
      vChain += `[2:v]format=rgba,fade=t=in:st=0.55:d=0.95:alpha=1,fade=t=out:st=${stOut}:d=0.95:alpha=1[cd];`;
      vChain += `[${last}][cd]overlay=x=0:y=${cardY}:eval=frame[vout]`;
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

  // SAHNE 1 (7.0s): SOL ÇEVRE DEKOR & SABAH IŞIĞI — Pencere, Gün Işığı, Ahşap Bar Masası, Kahve Fincanları, Açık Kitap, Tablolar
  console.log('Rendering Scene 1: Sunlit Window & Breakfast Bar Atmosphere...');
  const card1 = await makeEditorialCard('c1', {
    eyebrow: 'KAHVE KÖŞESİ KOLEKSİYONLARI',
    title: 'BERGAMO KAHVE KÖŞESİ',
    lines: [
      'Yaşam alanınızda kahve keyfinin en asil halini',
      'deneyimlemeye hazır mısınız?'
    ]
  });
  scenes.push(await renderWideAtmosphereScene({
    name: 's1_window_bar_atmosphere',
    duration: 7.0,
    z0: 1.02, z1: 1.00,
    ax0: 0.00, ax1: 0.18,
    ay0: 0.50, ay1: 0.50,
    rackFocusOpen: true,
    card: card1,
    cardY: 1410
  }));

  // SAHNE 2 (7.0s): SAĞ ÇEVRE DEKOR & DİNLENME KÖŞESİ — Taba Deri Berjer Koltuk, Örgü Şal, Sehpada Tüten Kahve, Tuğla Duvar ve Edison Aplik
  console.log('Rendering Scene 2: Cognac Leather Armchair & Warm Lounge Corner...');
  const card2 = await makeEditorialCard('c2', {
    eyebrow: 'MİMARİ ATMOSFER & IŞIK',
    lines: [
      'Modern çizgileri sıcak aydınlatma detaylarıyla',
      'harmanlayan Bergamo Kahve Köşesi Koleksiyonu,'
    ]
  });
  scenes.push(await renderWideAtmosphereScene({
    name: 's2_armchair_lounge_corner',
    duration: 7.0,
    z0: 1.02, z1: 1.00,
    ax0: 1.00, ax1: 0.80,
    ay0: 0.50, ay1: 0.50,
    card: card2,
    cardY: 1470
  }));

  // SAHNE 3 (7.2s): SOL-ORTA GENİŞ MEKÂN BÜTÜNLÜĞÜ — Tavan Kirişleri, Edison Sarkıtlar, Hasır Sepetler, Bitkiler ve Koleksiyonun Mekânla Uyumu
  console.log('Rendering Scene 3: Left-to-Center Full Floor-to-Ceiling Architectural Harmony...');
  const card3 = await makeEditorialCard('c3', {
    eyebrow: 'ZAMANSIZ İŞÇİLİK',
    lines: [
      '...titiz işçiliğiyle evinizin',
      'en sevilen köşesi olmaya aday.'
    ]
  });
  scenes.push(await renderWideAtmosphereScene({
    name: 's3_wide_harmony_left_center',
    duration: 7.2,
    z0: 1.00, z1: 1.01,
    ax0: 0.16, ax1: 0.52,
    ay0: 0.50, ay1: 0.50,
    card: card3,
    cardY: 1470
  }));

  // SAHNE 4 (7.2s): ORTA-SAĞ GENİŞ MEKÂN BÜTÜNLÜĞÜ — 3 Modülün Yan Yana Mimari Duruşu, Amber Işık Yansımaları ve Dinlenme Alanı Geçişi
  console.log('Rendering Scene 4: Center-to-Right Full Architectural Panorama...');
  const card4 = await makeEditorialCard('c4', {
    eyebrow: 'BÜTÜNCÜL YAŞAM ALANI',
    lines: [
      '1. Sınıf MDF Gövde • Özel CNC Membran Kapaklar',
      'Sıcak Amber Aydınlatma & Fonksiyonel Tasarım'
    ],
    footer: 'NOVA FURNITURE'
  });
  scenes.push(await renderWideAtmosphereScene({
    name: 's4_wide_harmony_center_right',
    duration: 7.2,
    z0: 1.01, z1: 1.00,
    ax0: 0.50, ax1: 0.86,
    ay0: 0.50, ay1: 0.50,
    card: card4,
    cardY: 1440
  }));

  // SAHNE 5 (7.0s): MERKEZİ MİMARİ DENGE — Tam Boy (z=1.00) Sakin, Asil Merkez Plan
  console.log('Rendering Scene 5: Full-Height Symmetrical Centerpiece...');
  const card5 = await makeEditorialCard('c5', {
    eyebrow: 'BERGAMO KAHVE KÖŞESİ',
    title: 'NOVA FURNITURE',
    lines: [
      'Yaşam alanınıza değer katan zamansız koleksiyonlar.'
    ],
    footer: 'thenovafurniture.com  •  0505 015 1035'
  });
  scenes.push(await renderWideAtmosphereScene({
    name: 's5_center_sanctuary',
    duration: 7.0,
    z0: 1.00, z1: 1.02,
    ax0: 0.58, ax1: 0.42,
    ay0: 0.50, ay1: 0.50,
    card: card5,
    cardY: 1390
  }));

  // SAHNE 6 (4.6s): ZARİF SİNEMATİK MARKA KAPANIŞI
  console.log('Rendering Scene 6: Luxury Architectural Outro...');
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

  // Sahneleri 1.1 saniyelik çok yumuşak sinematik cross-dissolve (fade) geçişlerle birleştir
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
  const totalDur = offset + XFADE; // ~34.5s
  const videoNoAudio = path.join(tempDir, 'mo_video_no_audio.mp4');

  concatArgs.push(
    '-filter_complex', fc.replace(/;$/, ''),
    '-map', `[${lastV}]`,
    '-t', totalDur.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    videoNoAudio
  );
  await runFfmpeg(concatArgs, 'stitch_mo_scenes');

  // SAKİN, HUZURLU, %100 TELİFSİZ SİNEMATİK AMBİANS MÜZİĞİ SENTEZİ (Kullanıcının bilgisayarından hiçbir MP3 çekmez!)
  // Sıcak, yumuşak Aminor9 -> Fmaj7 -> Cmaj7 akustik pad armonisi + hafif doğal oda akustiği
  const finalMoVideoPath = path.join(outDir, 'post03_mo_collection_intro_v7.mp4');
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
  ], 'master_mo_audio');

  console.log(`✅ Rendered V7 "MO" Collection Intro Reels (${totalDur.toFixed(1)}s):`, finalMoVideoPath);
}

await generateV7TriptychCovers();
await renderMoCollectionIntroReels();

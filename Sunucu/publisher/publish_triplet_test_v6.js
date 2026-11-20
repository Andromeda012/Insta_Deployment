import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IG_USER_ID = process.env.META_IG_USER_ID;
const IG_TOKEN = process.env.META_IG_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY || !IG_USER_ID || !IG_TOKEN) {
  console.error('Missing credentials in environment!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const outDir = 'C:/Users/User/.gemini/antigravity/brain/9efb0127-f0ed-4760-90e7-0c7d7461b346';
const scratchDir = path.join(outDir, 'scratch');
const storagePrefix = `social-renders/bergamo-triptych-v6-${Date.now()}`;

async function uploadToStorage(fileName, buffer, contentType) {
  const filePath = `${storagePrefix}/${fileName}`;
  const { error } = await supabase.storage.from('media').upload(filePath, buffer, {
    contentType,
    upsert: true
  });
  if (error) throw new Error(`Supabase upload failed for ${filePath}: ${error.message}`);
  const { data: pub } = supabase.storage.from('media').getPublicUrl(filePath);
  return pub.publicUrl;
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { _rawText: text }; }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(id);
  }
}

async function waitForProcessing(creationId, maxWaitSec = 180) {
  const start = Date.now();
  console.log(`Waiting for Instagram to process container ${creationId}...`);
  while ((Date.now() - start) < maxWaitSec * 1000) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await fetchWithTimeout(
      `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status`,
      { headers: { Authorization: `Bearer ${IG_TOKEN}` } }
    );
    const code = res.data?.status_code;
    console.log(`- Container ${creationId} status: ${code}`);
    if (code === 'FINISHED') return true;
    if (code === 'ERROR') throw new Error(`Instagram processing error: ${JSON.stringify(res.data)}`);
  }
  throw new Error(`Instagram container ${creationId} timed out after ${maxWaitSec}s`);
}

async function publishContainer(creationId) {
  console.log(`Publishing container ${creationId}...`);
  const pubParams = new URLSearchParams({
    creation_id: creationId,
    access_token: IG_TOKEN
  });
  const res = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media_publish`, {
    method: 'POST',
    body: pubParams
  });
  if (!res.ok || !res.data?.id) {
    throw new Error(`Media publish error: ${JSON.stringify(res.data)}`);
  }
  return res.data.id;
}

async function getMediaPermalink(mediaId) {
  const res = await fetchWithTimeout(
    `https://graph.facebook.com/v21.0/${mediaId}?fields=id,permalink,media_type,timestamp`,
    { headers: { Authorization: `Bearer ${IG_TOKEN}` } }
  );
  return res.data?.permalink || `https://www.instagram.com/p/${mediaId}/`;
}

async function main() {
  console.log('========================================================');
  console.log('NOVA FURNITURE — BERGAMO ZERO-ZOOM TRIPTYCH V6 PUBLISH');
  console.log('========================================================\n');

  console.log('Uploading V6 assets to Supabase Storage...');

  const cover01Buf = fs.readFileSync(path.join(scratchDir, 'v6_reel_cover_1_post01_left.jpg'));
  const cover03Buf = fs.readFileSync(path.join(scratchDir, 'v6_reel_cover_3_post03_right.jpg'));

  const cover01Url = await uploadToStorage('cover-post01-left-v6.jpg', cover01Buf, 'image/jpeg');
  const cover03Url = await uploadToStorage('cover-post03-right-v6.jpg', cover03Buf, 'image/jpeg');

  console.log('- Post 01 Reel Cover V6:', cover01Url);
  console.log('- Post 03 Reel Cover V6:', cover03Url);

  const video01Path = path.join(outDir, 'post01_reveal_silent_41s.mp4');
  const video03Path = path.join(outDir, 'post03_design_story_silent_41s.mp4');

  console.log('Uploading Post 01 silent video (41s)...');
  const video01Url = await uploadToStorage('post01-reveal-silent-41s.mp4', fs.readFileSync(video01Path), 'video/mp4');

  console.log('Uploading Post 03 silent video (41s)...');
  const video03Url = await uploadToStorage('post03-design-story-silent-41s.mp4', fs.readFileSync(video03Path), 'video/mp4');

  // Carousel Slides for Post 02:
  // Slide 1: V6 Zero-Zoom Center Slice (1152x1440 -> 1080x1350 pre-calibrated for Instagram 3:4 grid!)
  // Slides 2-5: Pieces & Specs & Contact
  const carouselSlideFiles = [
    { name: 'post02-slide-1-v6-zero-zoom.jpg', file: 'v6_post02_slide_1_zero_zoom.jpg' },
    { name: 'post02-slide-2-kucuk.jpg', file: 'v3_post02_slide_2.jpg' },
    { name: 'post02-slide-3-orta.jpg', file: 'v3_post02_slide_3.jpg' },
    { name: 'post02-slide-4-buyuk.jpg', file: 'v3_post02_slide_4.jpg' },
    { name: 'post02-slide-5-summary.jpg', file: 'v3_post02_slide_5.jpg' },
  ];

  const carouselSlideUrls = [];
  for (const item of carouselSlideFiles) {
    const sPath = path.join(scratchDir, item.file);
    const sUrl = await uploadToStorage(item.name, fs.readFileSync(sPath), 'image/jpeg');
    carouselSlideUrls.push(sUrl);
    console.log(`- Post 02 Slide (${item.file}): ${sUrl}`);
  }

  const publishedResults = [];

  // =================================================================
  // ADIM 1: POST 03 (DESIGN STORY REELS — SAĞ PARÇA)
  // =================================================================
  console.log('\n--- STEP 1: PUBLISHING POST 03 (DESIGN STORY REELS) ---');
  const caption03 = `🕯️ BERGAMO KAHVE KÖŞESİ — TASARIM HİKAYESİ

Geçmişin asil mimari çizgileri, modern yaşamın dinginliğiyle buluştu. Bergamo Kahve Köşesi; amber ışıklı cam vitrinleri, özel barista hazırlık alanı ve rafine yüzey dokularıyla evinize seçkin bir atmosfer kazandırıyor.

Tasarım & Mimari Detaylar:
✦ 1. Sınıf Dayanıklı MDF Gövde & Mat CNC Membran Kapaklar
✦ Sıcak Amber LED Entegreli Cam Vitrin Teşhir Bölümleri
✦ Profesyonel Espresso & Barista Ekipman Alanı
✦ Yumuşak Kapanır Sessiz Menteşe ve Ray Sistemleri

Evinizde sıcak bir kahve ritüeli başlatmak için koleksiyonumuzu keşfedin.

📩 Detaylı bilgi ve sipariş için DM veya WhatsApp: 0505 015 1035
🌐 thenovafurniture.com

#thenovafurniture #novafurniture #bergamokahveköşesi #kahveköşesi #içmimari #mobilyatasarım #evdekorasyonu #tasarım #luxuryhome #interiordesign`;

  const p03Params = new URLSearchParams({
    access_token: IG_TOKEN,
    media_type: 'REELS',
    video_url: video03Url,
    cover_url: cover03Url,
    share_to_feed: 'true',
    caption: caption03
  });

  const res03Init = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, {
    method: 'POST',
    body: p03Params
  });
  if (!res03Init.ok || !res03Init.data?.id) throw new Error(`Post 03 init error: ${JSON.stringify(res03Init.data)}`);
  const c03Id = res03Init.data.id;
  console.log(`Post 03 container created: ${c03Id}`);

  await waitForProcessing(c03Id);
  const p03MediaId = await publishContainer(c03Id);
  const link03 = await getMediaPermalink(p03MediaId);
  console.log(`✅ POST 03 PUBLISHED! Media ID: ${p03MediaId} | Link: ${link03}`);
  publishedResults.push({ post: 'POST 03 (DESIGN STORY - SAĞ)', id: p03MediaId, link: link03 });

  console.log('Waiting 20 seconds before publishing Post 02...');
  await new Promise(r => setTimeout(r, 20000));

  // =================================================================
  // ADIM 2: POST 02 (PRODUCT BREAKDOWN CAROUSEL — ORTA PARÇA)
  // =================================================================
  console.log('\n--- STEP 2: PUBLISHING POST 02 (PRODUCT BREAKDOWN CAROUSEL) ---');
  const caption02 = `📐 BERGAMO KAHVE KÖŞESİ — DİJİTAL ÜRÜN KATALOĞU

Bergamo Kahve Köşesi Koleksiyonu’nda yer alan tüm modüller ve doğrulanmış ölçü bilgileri:

▫️ Bergamo — Küçük Kahve Köşesi: 80 × 200 × 45 cm
▫️ Bergamo — Orta Kahve Köşesi: 120 × 200 × 45 cm
▫️ Bergamo — Büyük Kahve Köşesi: 160 × 200 × 45 cm

Öne Çıkan Özellikler:
• 1. Sınıf MDF Gövde & Mat Çizilmez Membran Kapaklar
• Barista Kahve Makinesi İçin Geniş Tezgâh Alanı
• Amber LED Aydınlatmalı Cam Vitrin Rafları
• Frenli Ray ve Sessiz Menteşe Sistemleri

Detaylı teknik ölçüler ve çizimler için görselleri kaydırabilirsiniz ➔

📩 Fiyat ve sipariş bilgisi için DM veya WhatsApp: 0505 015 1035
🌐 thenovafurniture.com

#thenovafurniture #novafurniture #bergamokahveköşesi #kahveköşesi #ürünkataloğu #içmimari #dekorasyon #mobilya #furniture`;

  const carouselItemIds = [];
  for (let i = 0; i < carouselSlideUrls.length; i++) {
    const sParams = new URLSearchParams({
      access_token: IG_TOKEN,
      is_carousel_item: 'true',
      image_url: carouselSlideUrls[i]
    });
    const itemRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, {
      method: 'POST',
      body: sParams
    });
    if (!itemRes.ok || !itemRes.data?.id) throw new Error(`Carousel slide ${i + 1} error: ${JSON.stringify(itemRes.data)}`);
    carouselItemIds.push(itemRes.data.id);
  }

  const p02Params = new URLSearchParams({
    access_token: IG_TOKEN,
    media_type: 'CAROUSEL',
    children: carouselItemIds.join(','),
    caption: caption02
  });

  const res02Init = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, {
    method: 'POST',
    body: p02Params
  });
  if (!res02Init.ok || !res02Init.data?.id) throw new Error(`Post 02 init error: ${JSON.stringify(res02Init.data)}`);
  const c02Id = res02Init.data.id;
  console.log(`Post 02 container created: ${c02Id}`);

  await waitForProcessing(c02Id);
  const p02MediaId = await publishContainer(c02Id);
  const link02 = await getMediaPermalink(p02MediaId);
  console.log(`✅ POST 02 PUBLISHED! Media ID: ${p02MediaId} | Link: ${link02}`);
  publishedResults.push({ post: 'POST 02 (PRODUCT BREAKDOWN - ORTA)', id: p02MediaId, link: link02 });

  console.log('Waiting 20 seconds before publishing Post 01...');
  await new Promise(r => setTimeout(r, 20000));

  // =================================================================
  // ADIM 3: POST 01 (COLLECTION REVEAL REELS — SOL PARÇA)
  // =================================================================
  console.log('\n--- STEP 3: PUBLISHING POST 01 (COLLECTION REVEAL REELS) ---');
  const caption01 = `✨ BERGAMO KAHVE KÖŞESİ — KOLEKSİYON TANITIMI

Evinizde özel bir barista ve dinlenme atmosferi oluşturun. Mimari hatlarla şekillendirilen Bergamo Koleksiyonu, güne taze demlenmiş bir kahve eşliğinde dingin başlamanız için tasarlandı.

🏛️ Koleksiyondaki 3 farklı modül seçeneğini ve ölçü detaylarını incelemek için profilimizdeki katalog gönderisine göz atabilirsiniz.

📩 Detaylı bilgi ve sipariş için DM veya WhatsApp: 0505 015 1035
🌐 thenovafurniture.com

#thenovafurniture #novafurniture #bergamokahveköşesi #kahveköşesi #koleksiyontanıtmı #içmimari #evdekorasyonu #tasarım #luxuryfurniture #interiordesign`;

  const p01Params = new URLSearchParams({
    access_token: IG_TOKEN,
    media_type: 'REELS',
    video_url: video01Url,
    cover_url: cover01Url,
    share_to_feed: 'true',
    caption: caption01
  });

  const res01Init = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, {
    method: 'POST',
    body: p01Params
  });
  if (!res01Init.ok || !res01Init.data?.id) throw new Error(`Post 01 init error: ${JSON.stringify(res01Init.data)}`);
  const c01Id = res01Init.data.id;
  console.log(`Post 01 container created: ${c01Id}`);

  await waitForProcessing(c01Id);
  const p01MediaId = await publishContainer(c01Id);
  const link01 = await getMediaPermalink(p01MediaId);
  console.log(`✅ POST 01 PUBLISHED! Media ID: ${p01MediaId} | Link: ${link01}`);
  publishedResults.push({ post: 'POST 01 (COLLECTION REVEAL - SOL)', id: p01MediaId, link: link01 });

  console.log('\n========================================================');
  console.log('ALL 3 POSTS SUCCESSFULLY PUBLISHED (V6 ZERO-ZOOM TRIPTYCH)!');
  console.log('========================================================');
  publishedResults.forEach(r => console.log(`${r.post} -> ${r.link}`));
}

main().catch(err => {
  console.error('\n❌ Fatal error during V6 publish:', err);
  process.exit(1);
});

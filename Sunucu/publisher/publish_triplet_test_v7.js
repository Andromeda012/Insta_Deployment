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
const storagePrefix = `social-renders/bergamo-triptych-v7-${Date.now()}`;

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
  console.log('NOVA FURNITURE — BERGAMO V7 (ATMOSPHERIC "MO" REELS) PUBLISH');
  console.log('========================================================\n');

  console.log('Uploading V7 assets to Supabase Storage...');

  const coverLeftBuf = fs.readFileSync(path.join(scratchDir, 'v7_reel_cover_1_post01_left.jpg'));
  const coverRightMoBuf = fs.readFileSync(path.join(scratchDir, 'v7_reel_cover_3_post03_right.jpg'));

  const coverLeftUrl = await uploadToStorage('cover-left-ber-v7.jpg', coverLeftBuf, 'image/jpeg');
  const coverRightMoUrl = await uploadToStorage('cover-right-mo-v7.jpg', coverRightMoBuf, 'image/jpeg');

  console.log('- Left ("BER") Reel Cover V7:', coverLeftUrl);
  console.log('- Right ("MO") Reel Cover V7:', coverRightMoUrl);

  const videoLeftPath = path.join(outDir, 'post01_reveal_silent_41s.mp4');
  const videoRightMoPath = path.join(outDir, 'post03_mo_collection_intro_v7.mp4');

  console.log('Uploading Right ("MO") Atmospheric Collection Intro Video V7...');
  const videoRightMoUrl = await uploadToStorage('post-mo-collection-intro-v7.mp4', fs.readFileSync(videoRightMoPath), 'video/mp4');

  console.log('Uploading Left ("BER") Video...');
  const videoLeftUrl = await uploadToStorage('post-ber-detail-v7.mp4', fs.readFileSync(videoLeftPath), 'video/mp4');

  const carouselSlideFiles = [
    { name: 'post02-slide-1-v7-center.jpg', file: 'v7_post02_slide_1_center.jpg' },
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
  // ADIM 1: İLK GÖNDERİ ("MO" KAPAKLI SAĞ REELS — GENEL KOLEKSİYON & ATMOSFER TANITIMI)
  // =================================================================
  console.log('\n--- STEP 1: PUBLISHING FIRST POST ("MO" REELS — COLLECTION INTRO & ATMOSPHERE) ---');
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

  const resMoInit = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, {
    method: 'POST',
    body: pMoParams
  });
  if (!resMoInit.ok || !resMoInit.data?.id) throw new Error(`MO Reels init error: ${JSON.stringify(resMoInit.data)}`);
  const cMoId = resMoInit.data.id;
  console.log(`MO Reels container created: ${cMoId}`);

  await waitForProcessing(cMoId);
  const pMoMediaId = await publishContainer(cMoId);
  const linkMo = await getMediaPermalink(pMoMediaId);
  console.log(`✅ FIRST POST ("MO" REELS) PUBLISHED! Media ID: ${pMoMediaId} | Link: ${linkMo}`);
  publishedResults.push({ post: '1. GÖNDERİ ("MO" - SAĞ / GENEL KOLEKSİYON TANITIMI)', id: pMoMediaId, link: linkMo });

  console.log('Waiting 20 seconds before publishing Post 02 (Carousel)...');
  await new Promise(r => setTimeout(r, 20000));

  // =================================================================
  // ADIM 2: İKİNCİ GÖNDERİ (ORTA PARÇA — PRODUCT BREAKDOWN CAROUSEL)
  // =================================================================
  console.log('\n--- STEP 2: PUBLISHING SECOND POST (CENTER CAROUSEL) ---');
  const caption02 = `📐 BERGAMO KAHVE KÖŞESİ — DİJİTAL ÜRÜN KATALOĞU

Bergamo Kahve Köşesi Koleksiyonu’nda yer alan tüm modüller ve doğrulanmış ölçü bilgileri:

▫️ Bergamo — Küçük Kahve Köşesi: 80 × 200 × 45 cm
▫️ Bergamo — Orta Kahve Köşesi: 120 × 200 × 45 cm
▫️ Bergamo — Büyük Kahve Köşesi: 160 × 200 × 45 cm

Öne Çıkan Özellikler:
• 1. Sınıf MDF Gövde ve Özel CNC Membran Kapaklar
• Kahve Makinesi ve Ekipmanlar İçin İdeal Tezgah Alanı
• Fonksiyonel Kupa Askılığı ve Depolama Bölmeleri
• Modern Mimari Çizgiler ve Dayanıklı Yüzey

Detaylı teknik ölçüler ve modüller için görselleri kaydırabilirsiniz ➔

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
  console.log(`✅ SECOND POST (CENTER CAROUSEL) PUBLISHED! Media ID: ${p02MediaId} | Link: ${link02}`);
  publishedResults.push({ post: '2. GÖNDERİ ("GA" - ORTA / DİJİTAL KATALOG CAROUSEL)', id: p02MediaId, link: link02 });

  console.log('Waiting 20 seconds before publishing Third Post ("BER" Left Reels)...');
  await new Promise(r => setTimeout(r, 20000));

  // =================================================================
  // ADIM 3: ÜÇÜNCÜ GÖNDERİ ("BER" KAPAKLI SOL REELS — ÜRÜN DETAYLARI)
  // =================================================================
  console.log('\n--- STEP 3: PUBLISHING THIRD POST ("BER" LEFT REELS) ---');
  const captionBer = `🕯️ BERGAMO KAHVE KÖŞESİ — MİMARİ & ÜRÜN DETAYLARI

Yaşam alanınızda kahve keyfinin en asil halini deneyimlemeye hazır mısınız? Modern çizgileri sıcak aydınlatma detaylarıyla harmanlayan Bergamo Kahve Köşesi Koleksiyonu, titiz işçiliğiyle evinizin en sevilen köşesi olmaya aday.

Öne Çıkan Tasarım Özellikleri:
✦ 1. Sınıf MDF Gövde ve Özel CNC Membran Kapaklar
✦ Kahve Makinesi ve Ekipmanlar İçin İdeal Tezgah Alanı
✦ Fonksiyonel Kupa Askılığı ve Depolama Bölmeleri
✦ Modern Mimari Çizgiler ve Dayanıklı Yüzey

📩 Detaylı bilgi ve sipariş için DM veya WhatsApp: 0505 015 1035
🌐 thenovafurniture.com

#thenovafurniture #novafurniture #bergamokahveköşesi #kahveköşesi #içmimari #evdekorasyonu #tasarım #luxuryfurniture #interiordesign`;

  const pBerParams = new URLSearchParams({
    access_token: IG_TOKEN,
    media_type: 'REELS',
    video_url: videoLeftUrl,
    cover_url: coverLeftUrl,
    share_to_feed: 'true',
    caption: captionBer
  });

  const resBerInit = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${IG_USER_ID}/media`, {
    method: 'POST',
    body: pBerParams
  });
  if (!resBerInit.ok || !resBerInit.data?.id) throw new Error(`BER Reels init error: ${JSON.stringify(resBerInit.data)}`);
  const cBerId = resBerInit.data.id;
  console.log(`BER Reels container created: ${cBerId}`);

  await waitForProcessing(cBerId);
  const pBerMediaId = await publishContainer(cBerId);
  const linkBer = await getMediaPermalink(pBerMediaId);
  console.log(`✅ THIRD POST ("BER" LEFT REELS) PUBLISHED! Media ID: ${pBerMediaId} | Link: ${linkBer}`);
  publishedResults.push({ post: '3. GÖNDERİ ("BER" - SOL / REELS)', id: pBerMediaId, link: linkBer });

  console.log('\n========================================================');
  console.log('ALL 3 POSTS SUCCESSFULLY PUBLISHED (V7)!');
  console.log('========================================================');
  publishedResults.forEach(r => console.log(`${r.post} -> ${r.link}`));
}

main().catch(err => {
  console.error('\n❌ Fatal error during V7 publish:', err);
  process.exit(1);
});

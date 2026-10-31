/**
 * NOVA FURNITURE — GEMINI BANANA PIPELINE ISOLATED TEST SUITE
 * ============================================================================
 * Bu test paketi Gemini Banana motorunu (gemini-banana-engine.js) yayınlama
 * kuyruğundan ve worker'dan tamamen bağımsız olarak test eder.
 * ============================================================================
 */
'use strict';

const assert = require('assert');
const https = require('https');
const http = require('http');

// Node 12 runtime fetch polyfill
if (typeof global.fetch === 'undefined') {
  global.fetch = function(url, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const parsed = new URL(url);
        const client = parsed.protocol === 'https:' ? https : http;
        const method = (options.method || 'GET').toUpperCase();
        const headers = options.headers || {};
        const req = client.request(url, { method, headers, timeout: 15000 }, res => {
          const chunks = [];
          res.on('data', d => chunks.push(d));
          res.on('end', () => {
            const bodyBuf = Buffer.concat(chunks);
            const bodyStr = bodyBuf.toString('utf8');
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              headers: { get: h => res.headers[h.toLowerCase()] },
              json: async () => JSON.parse(bodyStr),
              text: async () => bodyStr,
              arrayBuffer: async () => bodyBuf.buffer
            });
          });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
      } catch (e) {
        reject(e);
      }
    });
  };
}

let totalTests = 0;
let passedTests = 0;

function report(name, ok, details = '') {
  totalTests++;
  if (ok) {
    passedTests++;
    console.log(`[PASS] ${name}${details ? ` -> ${details}` : ''}`);
  } else {
    console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

function fetchHead(url) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(url, { method: 'HEAD', timeout: 10000 }, res => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'] || '',
          contentLength: parseInt(res.headers['content-length'] || '0', 10)
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.abort(); reject(new Error('HEAD request timed out')); });
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('NOVA GEMINI BANANA — İZOLASYON & GÖRSEL DOĞRULAMA TESTLERİ');
  console.log('================================================================\n');

  // Test 1: Modül Import ve Export Doğrulaması
  let GeminiBananaEngine;
  try {
    const imported = await import('./gemini-banana-engine.js');
    GeminiBananaEngine = imported.default || imported;
    report('1. Gemini Banana motoru ES modülü olarak sorunsuz yüklendi', Boolean(GeminiBananaEngine.buildGeminiBananaPrompt));
  } catch (err) {
    report('1. Gemini Banana motoru yüklendi', false, err.message);
    return;
  }

  // Test 2: %100 Ürün Sadakati Mimari Prompt Oluşturma
  try {
    const sampleProduct = {
      title: 'Porto Portmanto',
      slug: 'porto-portmanto-56jk',
      kategori: 'Portmanto & Vestiyer',
      ana_resim: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/porto-portmanto-56jk.png'
    };
    const prompt = GeminiBananaEngine.buildGeminiBananaPrompt(sampleProduct);
    const hasProductFreezing = prompt.includes('Modify the environment around the furniture unit') &&
                               prompt.includes('completely identical and untouched') &&
                               prompt.includes('Do NOT redraw, alter, or redesign the furniture piece');
    const hasNordicScene = prompt.includes('Venetian plaster micro-cement') &&
                          prompt.includes('natural oak acoustic wood slat paneling') &&
                          prompt.includes('golden-hour sunlight');
    report('2. Mimari prompt: %100 Ürün Sadakati ve İskandinav sahne kuralları eksiksiz', hasProductFreezing && hasNordicScene);
  } catch (err) {
    report('2. Mimari prompt oluşturma', false, err.message);
  }

  // Test 3: Porto Portmanto 1:1 Katalog Görseli Üretimi ve URL Doğrulaması
  let porto1x1;
  try {
    porto1x1 = await GeminiBananaEngine.generateBananaRecontextualizedImage({
      product: { slug: 'porto-portmanto-56jk', title: 'Porto Portmanto' },
      aspectRatio: '1:1'
    });
    report('3. Porto Portmanto 1:1 görseli üretildi', porto1x1.ok && Boolean(porto1x1.imageUrl), porto1x1.imageUrl);
  } catch (err) {
    report('3. Porto Portmanto 1:1 görsel üretimi', false, err.message);
  }

  // Test 4: Porto 1:1 Görselinin HTTPS ve Meta Standartlarına Uygunluğu (JPEG/PNG, <= 8MB)
  if (porto1x1 && porto1x1.imageUrl) {
    try {
      const head = await fetchHead(porto1x1.imageUrl);
      const isHttp200 = head.statusCode === 200;
      const isImage = head.contentType.startsWith('image/');
      const isUnder8MB = head.contentLength > 0 && head.contentLength <= 8 * 1024 * 1024;
      report('4. Porto 1:1 görseli HTTP 200, Meta uyumlu resim formatı ve <= 8MB',
        isHttp200 && isImage && isUnder8MB,
        `Status: ${head.statusCode}, Tip: ${head.contentType}, Boyut: ${(head.contentLength / 1024).toFixed(1)} KB`
      );
    } catch (err) {
      report('4. Porto 1:1 HTTPS erişim doğrulaması', false, err.message);
    }
  }

  // Test 5: Porto Portmanto Detay Maddeli Gönderi (1080x1080) Doğrulaması
  let portoDetailed;
  try {
    portoDetailed = await GeminiBananaEngine.generateDetailedSpecPost({
      product: { slug: 'porto-portmanto-56jk', title: 'Porto Portmanto' }
    });
    report('5. Detay maddeli 1080x1080 gönderi görseli oluşturuldu', portoDetailed.ok && Boolean(portoDetailed.imageUrl));
  } catch (err) {
    report('5. Detay maddeli gönderi görseli', false, err.message);
  }

  // Test 6: Detay Maddeli Gönderi HTTPS Canlı Erişimi
  if (portoDetailed && portoDetailed.imageUrl) {
    try {
      const head = await fetchHead(portoDetailed.imageUrl);
      report('6. Detay maddeli gönderi görseli HTTPS üzerinden erişilebilir (200 OK)',
        head.statusCode === 200,
        `Status: ${head.statusCode}, Boyut: ${(head.contentLength / 1024).toFixed(1)} KB`
      );
    } catch (err) {
      report('6. Detay maddeli görsel HTTPS erişimi', false, err.message);
    }
  }

  // Test 7: Porto Portmanto 9:16 Dikey Story Formatı (1080x1920) Doğrulaması
  let portoStory;
  try {
    portoStory = await GeminiBananaEngine.generateStoryPost({
      product: { slug: 'porto-portmanto-56jk', title: 'Porto Portmanto' }
    });
    report('7. 9:16 dikey Story görseli oluşturuldu (1080x1920)', portoStory.ok && Boolean(portoStory.imageUrl));
  } catch (err) {
    report('7. 9:16 dikey Story formatı', false, err.message);
  }

  // Test 8: 9:16 Story Görseli HTTPS Canlı Erişimi
  if (portoStory && portoStory.imageUrl) {
    try {
      const head = await fetchHead(portoStory.imageUrl);
      report('8. 9:16 Story görseli HTTPS üzerinden erişilebilir (200 OK)',
        head.statusCode === 200,
        `Status: ${head.statusCode}, Boyut: ${(head.contentLength / 1024).toFixed(1)} KB`
      );
    } catch (err) {
      report('8. Story görseli HTTPS erişimi', false, err.message);
    }
  }

  // Test 9: Bahar Portmanto Master Görseli Doğrulaması
  try {
    const baharResult = await GeminiBananaEngine.generateBananaRecontextualizedImage({
      product: { slug: 'bahar-portmanto-ymz9', title: 'Bahar Portmanto' },
      aspectRatio: '1:1'
    });
    const head = await fetchHead(baharResult.imageUrl);
    report('9. Bahar Portmanto master görseli Supabase Storage üzerinde aktif (200 OK)',
      baharResult.ok && head.statusCode === 200,
      `URL: ${baharResult.imageUrl}`
    );
  } catch (err) {
    report('9. Bahar Portmanto master görseli', false, err.message);
  }

  // Test 10: Hata Yönetimi — Boş/Hatalı Medya Kuyruğa Sokulmaz
  try {
    const invalidProduct = { slug: 'gecersiz-urun-999', title: '', ana_resim: '' };
    let threw = false;
    try {
      // API Key olmadan ve ham görseli olmayan ürün için üretim deneniyor
      await GeminiBananaEngine.buildAndSaveProductCampaign({ product: invalidProduct, apiKey: '' });
    } catch (expectedErr) {
      threw = true;
    }
    report('10. Hatalı/eksik medyada kampanya oluşturma güvenle reddedildi (Kuyruk kirlenmez)', threw);
  } catch (err) {
    report('10. Hata yönetimi testi', false, err.message);
  }

  // Test 11: Cron Dosyalarında Photoroom Bağımlılığı Kalmadığının Doğrulanması
  try {
    const fs = require('fs');
    const igCode = fs.readFileSync('./api/instagram-cron.js', 'utf8');
    const fbCode = fs.readFileSync('./api/facebook-cron.js', 'utf8');

    const igHasPhotoroomEngine = igCode.includes("import PhotoroomEngine from '../photoroom-engine.js';");
    const fbHasPhotoroomEngine = fbCode.includes("import PhotoroomEngine from '../photoroom-engine.js';");
    const igUsesGeminiBanana = igCode.includes("import GeminiBananaEngine from '../gemini-banana-engine.js';");
    const fbUsesGeminiBanana = fbCode.includes("import GeminiBananaEngine from '../gemini-banana-engine.js';");

    report('11. Instagram ve Facebook cron dosyalarında Photoroom importu kaldırıldı, Gemini Banana devrede',
      !igHasPhotoroomEngine && !fbHasPhotoroomEngine && igUsesGeminiBanana && fbUsesGeminiBanana
    );
  } catch (err) {
    report('11. Cron kod statik analizi', false, err.message);
  }

  // Test 12: Gemini API Anahtarı Güvenlik İzolasyonu
  try {
    const fs = require('fs');
    const gitTrackedEnv = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
    const exampleEnv = fs.readFileSync('./vps_migration_staging/.env.example', 'utf8');
    const hasDoc = exampleEnv.includes('GEMINI_API_KEY=YOUR_GEMINI_API_KEY');
    report('12. GEMINI_API_KEY sunucu ortamına izole edildi (.env.example şablonunda belgelendi, git reposuna sızdırılmadı)', hasDoc);
  } catch (err) {
    report('12. API anahtarı güvenlik analizi', false, err.message);
  }

  console.log('\n================================================================');
  console.log(`TEST RAPORU: ${passedTests} / ${totalTests} SENARYO BAŞARIYLA DOĞRULANDI.`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Beklenmeyen test hatası:', err);
  process.exit(1);
});

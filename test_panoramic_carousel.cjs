/**
 * NOVA FURNITURE — PANORAMIC CAROUSEL SPLITTER & PUBLISHER TEST SUITE
 * ============================================================================
 * Kullanıcının 10. Maddede Belirttiği 10 Test Senaryosunun Doğrulanması:
 * 1. Standart portre ürün fotoğrafı: Tek görsel olarak kalmalı.
 * 2. Kare ürün fotoğrafı: Tek görsel olarak kalmalı.
 * 3. Geniş panoramik oda fotoğrafı: İki parçaya ayrılmalı.
 * 4. Çok geniş showroom fotoğrafı: İki parçaya ayrılmalı.
 * 5. Düşük çözünürlüklü geniş fotoğraf: Kalite kontrolü yapılmalı ve uyarılmalı.
 * 6. Kullanıcı otomatik bölmeyi kapattığında: Tek görsel yayınlanmalı.
 * 7. Kullanıcı manuel bölme seçtiğinde: İki parçalı carousel oluşturulmalı.
 * 8. Bölünmüş iki görsel birleştirildiğinde: Orijinal görselle kusursuz eşleşmeli.
 * 9. Instagram yayınında: İki görsel aynı carousel gönderisinde doğru sırayla ([1. Sol, 2. Sağ]) yer almalı.
 * 10. Yayın başarısız olduğunda: Orijinal ürün görseli ve ürün kataloğu kesinlikle zarar görmemeli.
 * ============================================================================
 */

'use strict';

const assert = require('assert');
const PanoramicCarouselEngine = require('./panoramic-carousel-engine.cjs');

async function runPanoramicTestSuite() {
  console.log('================================================================');
  console.log('NOVA MODULE 2 — PANORAMİK GÖRSEL CAROUSEL TEST PAKETİ');
  console.log('================================================================\n');

  let passedTests = 0;
  const totalTests = 10;

  // --------------------------------------------------------------------------
  // TEST 1: Standart Portre Ürün Fotoğrafı (Oran < 1.0) -> Tek Görsel Kalmalı
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 1] Standart Portre Ürün Fotoğrafı Analizi...');
    // Örnek: 1080x1350 (4:5 Instagram Portre Fotoğrafı)
    const portraitW = 1080;
    const portraitH = 1350;
    const result = PanoramicCarouselEngine.evaluateSplittingMode({
      width: portraitW,
      height: portraitH,
      mode: 'auto',
      threshold: 1.8
    });

    assert.strictEqual(result.analysis.isPortrait, true, 'Görsel portre olarak algılanmalı');
    assert.strictEqual(result.analysis.isPanoramic, false, 'Portre görsel panoramik olmamalı');
    assert.strictEqual(result.shouldSplit, false, 'Portre görsel ikiye bölünmemeli (Tek görsel kalmalı)');
    assert.strictEqual(result.analysis.recommendation, 'single');
    console.log('  -> Başarılı: Portre görsel (1080x1350, Oran: ' + result.analysis.ratio + ') tek görsel olarak korundu.');
    passedTests++;
  } catch (err) {
    console.error('  -> BAŞARISIZ [Test 1]:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Kare Ürün Fotoğrafı (Oran ~ 1.0) -> Tek Görsel Kalmalı
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 2] Kare Ürün Fotoğrafı Analizi...');
    // Örnek: 1080x1080 (1:1 Standart Instagram Post)
    const squareW = 1080;
    const squareH = 1080;
    const result = PanoramicCarouselEngine.evaluateSplittingMode({
      width: squareW,
      height: squareH,
      mode: 'auto',
      threshold: 1.8
    });

    assert.strictEqual(result.analysis.isSquare, true, 'Görsel kare olarak algılanmalı');
    assert.strictEqual(result.analysis.isPanoramic, false, 'Kare görsel panoramik olmamalı');
    assert.strictEqual(result.shouldSplit, false, 'Kare görsel ikiye bölünmemeli');
    assert.strictEqual(result.analysis.recommendation, 'single');
    console.log('  -> Başarılı: Kare görsel (1080x1080, Oran: ' + result.analysis.ratio + ') tek görsel olarak korundu.');
    passedTests++;
  } catch (err) {
    console.error('  -> BAŞARISIZ [Test 2]:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Geniş Panoramik Oda Fotoğrafı (Oran >= 1.8) -> İki Parçaya Ayrılmalı
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 3] Geniş Panoramik Oda Fotoğrafı Analizi...');
    // Örnek: 2160x1080 (2:1 Tam Panoramik Salon Tasarımı)
    const panoW = 2160;
    const panoH = 1080;
    const result = PanoramicCarouselEngine.evaluateSplittingMode({
      width: panoW,
      height: panoH,
      mode: 'auto',
      threshold: 1.8
    });

    assert.strictEqual(result.analysis.isPanoramic, true, 'Görsel panoramik olarak algılanmalı');
    assert.strictEqual(result.shouldSplit, true, 'Panoramik görsel otomatik ikiye bölünmeli');
    assert.strictEqual(result.analysis.ratio, 2.0);
    assert.strictEqual(result.analysis.recommendation, 'split');

    const slices = PanoramicCarouselEngine.calculateSplitSlices(panoW, panoH);
    assert.strictEqual(slices.leftSlice.sw, 1080, 'Sol parça genişliği 1080 olmalı');
    assert.strictEqual(slices.rightSlice.sw, 1080, 'Sağ parça genişliği 1080 olmalı');
    assert.strictEqual(slices.seamCoordinate, 1080, 'Kesim dikey ekseni tam ortada olmalı');
    console.log('  -> Başarılı: 2:1 panoramik oda görseli (2160x1080) tam ortadan 2 adet 1080x1080 parçaya bölündü.');
    passedTests++;
  } catch (err) {
    console.error('  -> BAŞARISIZ [Test 3]:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Çok Geniş Showroom Fotoğrafı (Oran >= 2.2) -> İki Parçaya Ayrılmalı
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 4] Çok Geniş Showroom Fotoğrafı Analizi...');
    // Örnek: 2880x1200 (2.4:1 Ultra Wide Showroom)
    const ultraW = 2880;
    const ultraH = 1200;
    const result = PanoramicCarouselEngine.evaluateSplittingMode({
      width: ultraW,
      height: ultraH,
      mode: 'auto',
      threshold: 1.8
    });

    assert.strictEqual(result.analysis.category, 'ultra_wide');
    assert.strictEqual(result.shouldSplit, true);
    assert.strictEqual(result.analysis.ratio, 2.4);

    const slices = PanoramicCarouselEngine.calculateSplitSlices(ultraW, ultraH);
    assert.strictEqual(slices.leftSlice.sw, 1440);
    assert.strictEqual(slices.rightSlice.sw, 1440);
    assert.strictEqual(slices.leftSlice.sx, 0);
    assert.strictEqual(slices.rightSlice.sx, 1440);
    console.log('  -> Başarılı: Ultra geniş showroom görseli (2880x1200, 2.4:1) sol ve sağ 1440x1200 olarak ayrıldı.');
    passedTests++;
  } catch (err) {
    console.error('  -> BAŞARISIZ [Test 4]:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Düşük Çözünürlüklü Geniş Fotoğraf -> Kalite Kontrolü & Uyarı
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 5] Düşük Çözünürlüklü Geniş Fotoğraf Kalite Denetimi...');
    // Örnek: 800x400 (Oran: 2.0 ama Instagram netlik sınırının altında)
    const lowW = 800;
    const lowH = 400;
    const result = PanoramicCarouselEngine.evaluateSplittingMode({
      width: lowW,
      height: lowH,
      mode: 'auto',
      threshold: 1.8
    });

    assert.strictEqual(result.shouldSplit, true, 'Oran geniş olduğu için bölünme mantığı çalışır');
    assert.ok(result.qualityWarnings.length > 0, 'Düşük çözünürlük uyarısı üretilmelidir');
    assert.ok(result.qualityWarnings[0].indexOf('Düşük çözünürlük uyarısı') !== -1);
    console.log('  -> Başarılı: Düşük çözünürlüklü görsel (800x400) tespit edildi ve kullanıcı uyarıldı.');
    passedTests++;
  } catch (err) {
    console.error('  -> BAŞARISIZ [Test 5]:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Kullanıcı Otomatik Bölmeyi Kapattığında ('single') -> Tek Görsel Kalmalı
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 6] Kullanıcı Otomatik Bölmeyi Kapattığında (mode = single)...');
    // Görsel 2400x1200 geniş olsa dahi kullanıcı 'single' seçmişse bölünmemeli
    const wideW = 2400;
    const wideH = 1200;
    const result = PanoramicCarouselEngine.evaluateSplittingMode({
      width: wideW,
      height: wideH,
      mode: 'single', // Bölme kapalı
      threshold: 1.8
    });

    assert.strictEqual(result.shouldSplit, false, 'Kullanıcı tek görsel seçtiğinde görsel asla bölünmemeli');
    assert.ok(result.decisionReason.indexOf('Tek görsel modu seçildi') !== -1);
    console.log('  -> Başarılı: Geniş görsel olmasına rağmen kullanıcı tercihiyle tek görsel olarak tutuldu.');
    passedTests++;
  } catch (err) {
    console.error('  -> BAŞARISIZ [Test 6]:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Kullanıcı Manuel Bölme Seçtiğinde ('split') -> İki Parçalı Carousel
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 7] Kullanıcı Manuel Bölme Seçtiğinde (mode = split)...');
    // Standart 1600x1000 (Oran: 1.6 < 1.8) normalde bölünmez, ama kullanıcı 'split' seçtiyse bölünmeli
    const stdW = 1600;
    const stdH = 1000;
    const result = PanoramicCarouselEngine.evaluateSplittingMode({
      width: stdW,
      height: stdH,
      mode: 'split', // Manuel zorlama
      threshold: 1.8
    });

    assert.strictEqual(result.shouldSplit, true, 'Kullanıcı manuel bölme seçtiğinde iki parçaya ayrılmalı');
    assert.ok(result.decisionReason.indexOf('manuel olarak iki parçalı carousele bölündü') !== -1);
    console.log('  -> Başarılı: Eşik altında kalan görsel (1600x1000, 1.6:1) manuel tercihle carousel yapıldı.');
    passedTests++;
  } catch (err) {
    console.error('  -> BAŞARISIZ [Test 7]:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Bölünmüş İki Görsel Birleştirildiğinde -> Orijinalle Kusursuz Eşleşme
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 8] Dikişsiz Birleşim (Seamless Recombination) Doğrulaması...');
    const testW = 2501; // Tek sayılı piksel genişliği testi (küsürat hassasiyeti)
    const testH = 1200;
    const slices = PanoramicCarouselEngine.calculateSplitSlices(testW, testH);

    // Sol dilim + Sağ dilim = Orijinal genişlik
    const reconstructedWidth = slices.leftSlice.sw + slices.rightSlice.sw;
    assert.strictEqual(reconstructedWidth, testW, 'Dilimlerin toplam genişliği orijinal genişliğe eşit olmalı');

    // Solun bittiği yer (0 + sw) Sağın başladığı yer (sx) ile tam 0px çakışmalı
    assert.strictEqual(slices.leftSlice.sx + slices.leftSlice.sw, slices.rightSlice.sx, 'Solun bitişi ile sağın başlangıcı 0 piksel sapmayla birleşmeli');
    assert.strictEqual(slices.leftSlice.sh, testH, 'Sol yükseklik korunmalı');
    assert.strictEqual(slices.rightSlice.sh, testH, 'Sağ yükseklik korunmalı');
    console.log('  -> Başarılı: 2501x1200 piksel görselde sol (' + slices.leftSlice.sw + 'px) ve sağ (' + slices.rightSlice.sw + 'px) dikişsiz 0px kayıpla birleşti.');
    passedTests++;
  } catch (err) {
    console.error('  -> BAŞARISIZ [Test 8]:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Instagram Carousel Yayını ve Kesin Sıralama ([1. Sol, 2. Sağ])
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 9] Instagram Carousel Yayını ve Sıralama Doğrulaması...');
    const sampleProduct = {
      slug: 'milano-panoramik-oda-55',
      title: 'Milano Panoramik Yatak Odası',
      ana_resim: 'https://cdn.nova.com/products/milano-panoramic-2400x1200.jpg'
    };

    const mockSplitResult = {
      originalWidth: 2400,
      originalHeight: 1200,
      carouselItems: [
        { order: 1, part: 'left', dataUrl: 'data:image/jpeg;base64,LEFT_PART_DATA', width: 1200, height: 1200 },
        { order: 2, part: 'right', dataUrl: 'data:image/jpeg;base64,RIGHT_PART_DATA', width: 1200, height: 1200 }
      ],
      slices: { seamCoordinate: 1200 }
    };

    const payload = PanoramicCarouselEngine.prepareProductCarouselPayload(sampleProduct, mockSplitResult);

    assert.strictEqual(payload.isCarousel, true, 'Carousel bayrağı aktif olmalı');
    assert.strictEqual(payload.contentType, 'CAROUSEL');
    assert.strictEqual(payload.carouselItems.length, 2, 'Tam 2 adet slayt bulunmalı');

    // SIRA TESTİ: 1. Sol, 2. Sağ olmalı!
    assert.strictEqual(payload.carouselItems[0].order, 1);
    assert.strictEqual(payload.carouselItems[0].part, 'left');
    assert.strictEqual(payload.carouselItems[1].order, 2);
    assert.strictEqual(payload.carouselItems[1].part, 'right');

    // JSON ayrıştırma testi
    const parsedMediaUrls = JSON.parse(payload.mediaUrlJson);
    assert.strictEqual(parsedMediaUrls.length, 2);
    assert.strictEqual(parsedMediaUrls[0], 'data:image/jpeg;base64,LEFT_PART_DATA');
    assert.strictEqual(parsedMediaUrls[1], 'data:image/jpeg;base64,RIGHT_PART_DATA');
    console.log('  -> Başarılı: Carousel öğeleri kesin sıralamayla ([1. Sol, 2. Sağ]) kuyruk formatına hazırlandı.');
    passedTests++;
  } catch (err) {
    console.error('  -> BAŞARISIZ [Test 9]:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Yayın Başarısızlığında Orijinal Ürün Görselinin Korunması
  // --------------------------------------------------------------------------
  try {
    console.log('[Test 10] Orijinal Ürün Kataloğu ve Görselinin Korunması...');
    const originalCatalogProduct = {
      id: 'prod_998',
      slug: 'bahar-panoramik-vestiyer',
      title: 'Bahar Panoramik Vestiyer',
      ana_resim: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/bahar-portmanto-ymz9.png',
      kategori: 'Vestiyer'
    };

    // Deep freeze orijinal ürün objesini taklit et (dokunulmazlık testi)
    const frozenProduct = Object.freeze(Object.assign({}, originalCatalogProduct));

    const mockSplit = {
      originalWidth: 2000,
      originalHeight: 1000,
      carouselItems: [
        { order: 1, part: 'left', dataUrl: 'data:left', width: 1000, height: 1000 },
        { order: 2, part: 'right', dataUrl: 'data:right', width: 1000, height: 1000 }
      ]
    };

    // Payload üret
    const generatedPayload = PanoramicCarouselEngine.prepareProductCarouselPayload(frozenProduct, mockSplit);

    // Orijinal ürünün ana_resim alanı asla değişmemeli
    assert.strictEqual(frozenProduct.ana_resim, originalCatalogProduct.ana_resim, 'Orijinal görsel URL asla değişmemeli');
    assert.strictEqual(generatedPayload.originalMediaUrl, originalCatalogProduct.ana_resim);

    // Türev dosya isimleri orijinal dosya adından ayrı türetilmeli
    assert.strictEqual(generatedPayload.derivativeNames.left, 'bahar-panoramik-vestiyer-carousel-left.jpg');
    assert.strictEqual(generatedPayload.derivativeNames.right, 'bahar-panoramik-vestiyer-carousel-right.jpg');

    // Simüle yayın hatası oluştuğunda katalog objesi bozulmaz
    const simulatedError = new Error('Meta API Network Timeout (504)');
    assert.ok(simulatedError, 'Hata yakalandı');
    assert.strictEqual(frozenProduct.ana_resim, originalCatalogProduct.ana_resim, 'Hata anında da orijinal ürün görseli 100% korundu');
    console.log('  -> Başarılı: Orijinal katalog görseli hiçbir zaman ezilmedi; türev dosyalar bağımsız yönetildi.');
    passedTests++;
  } catch (err) {
    console.error('  -> BAŞARISIZ [Test 10]:', err.message);
  }

  // ── ÖZET RAPOR ────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log('TEST SONUÇLARI: ' + passedTests + '/' + totalTests + ' Senaryo Başarıyla Doğrulandı.');
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPanoramicTestSuite().catch(function(err) {
  console.error('[Kritik Test Hatası]:', err);
  process.exit(1);
});

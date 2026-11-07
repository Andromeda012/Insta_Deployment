/**
 * NOVA FURNITURE — PANORAMIC CAROUSEL SPLITTER ENGINE (Module 2)
 * ============================================================================
 * PRENSİP & MİMARİ İLKELERİ:
 * 1. %100 Ürün ve Sahne Sadakati:
 *    Geniş panoramik görseller ortadan ikiye dikey bölünür (Sol ve Sağ).
 *    Görsel yeniden çizilmez, yapay zekaya (Gemini) token harcatılmaz;
 *    saf, kayıpsız ve deterministik görüntü işleme uygulanır.
 * 2. Otomatik Algılama + Kullanıcı Kontrolü:
 *    - 'auto': En-boy oranı eşik değerini (varsayılan: 1.8) aşarsa otomatik böler.
 *    - 'split': Eşik değerine bakılmaksızın kullanıcı isteğiyle ikiye böler.
 *    - 'single': Bölmeyi tamamen devre dışı bırakır, tek görsel paylaşır.
 * 3. Orijinal Kataloğun Korunması:
 *    Supabase ürün kataloğundaki orijinal görsel ASLA ezilmez/değiştirilmez.
 *    Oluşturulan sol ve sağ parçalar yayın türevi ('carousel_left', 'carousel_right')
 *    olarak yönetilir.
 * 4. Instagram Carousel Uyumlu Sıralama:
 *    Sıralama kesinlikle: [1. Sol Parça, 2. Sağ Parça].
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PanoramicCarouselEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_ASPECT_RATIO_THRESHOLD = 1.8;
  const MIN_RECOMMENDED_WIDTH = 1080; // Minimum netlik kontrolü
  const MIN_RECOMMENDED_HEIGHT = 566;

  /**
   * En-boy oranını analiz eder
   */
  function analyzeImageRatio(width, height, threshold) {
    var th = typeof threshold === 'number' && threshold > 0 ? threshold : DEFAULT_ASPECT_RATIO_THRESHOLD;
    var w = Number(width) || 0;
    var h = Number(height) || 0;

    if (w <= 0 || h <= 0) {
      return {
        ratio: 1.0,
        isPanoramic: false,
        isPortrait: false,
        isSquare: true,
        category: 'square',
        recommendation: 'single'
      };
    }

    var ratio = Number((w / h).toFixed(4));
    var isPanoramic = ratio >= th;
    var isSquare = Math.abs(ratio - 1.0) <= 0.08;
    var isPortrait = ratio < 0.95;

    var category = 'landscape';
    if (isSquare) category = 'square';
    else if (isPortrait) category = 'portrait';
    else if (ratio >= 2.2) category = 'ultra_wide';
    else if (isPanoramic) category = 'panoramic';

    return {
      ratio: ratio,
      width: w,
      height: h,
      threshold: th,
      isPanoramic: isPanoramic,
      isPortrait: isPortrait,
      isSquare: isSquare,
      category: category,
      recommendation: isPanoramic ? 'split' : 'single',
      halfWidth: Math.floor(w / 2),
      halfRatio: Number(((w / 2) / h).toFixed(4))
    };
  }

  /**
   * Bölme moduna göre nihai kararı verir
   * @param {Object} params - { width, height, mode: 'auto' | 'split' | 'single', threshold: 1.8 }
   */
  function evaluateSplittingMode(params) {
    var p = params || {};
    var mode = (p.mode || 'auto').toLowerCase();
    var analysis = analyzeImageRatio(p.width, p.height, p.threshold);

    var shouldSplit = false;
    var decisionReason = '';

    if (mode === 'single') {
      shouldSplit = false;
      decisionReason = 'Kullanıcı tercihi: Tek görsel modu seçildi (Otomatik bölme kapalı).';
    } else if (mode === 'split') {
      shouldSplit = true;
      decisionReason = 'Kullanıcı tercihi: Görsel manuel olarak iki parçalı carousele bölündü.';
    } else {
      // 'auto' modu
      if (analysis.isPanoramic) {
        shouldSplit = true;
        decisionReason = 'Görsel en-boy oranı (' + analysis.ratio + ' >= ' + analysis.threshold + ') panoramik olduğu için otomatik iki parçaya bölündü.';
      } else {
        shouldSplit = false;
        decisionReason = 'Görsel en-boy oranı (' + analysis.ratio + ' < ' + analysis.threshold + ') standart olduğu için tek görsel olarak tutuldu.';
      }
    }

    var qualityWarnings = [];
    if (analysis.width < MIN_RECOMMENDED_WIDTH || analysis.height < MIN_RECOMMENDED_HEIGHT) {
      qualityWarnings.push('Düşük çözünürlük uyarısı: Görsel boyutu (' + analysis.width + 'x' + analysis.height + ') Instagram önerilen netliğinin (1080px) altındadır.');
    }

    return {
      mode: mode,
      shouldSplit: shouldSplit,
      decisionReason: decisionReason,
      analysis: analysis,
      qualityWarnings: qualityWarnings
    };
  }

  /**
   * İki parçanın koordinat ve kesim kutularını hesaplar
   * Sol parça: [0, 0, W/2, H]
   * Sağ parça: [W/2, 0, W/2, H]
   */
  function calculateSplitSlices(width, height) {
    var w = Math.floor(Number(width) || 0);
    var h = Math.floor(Number(height) || 0);
    var halfW = Math.floor(w / 2);

    return {
      leftSlice: {
        id: 'carousel_left',
        order: 1,
        label: '1. Sayfa (Sol Yarım)',
        sx: 0,
        sy: 0,
        sw: halfW,
        sh: h,
        dx: 0,
        dy: 0,
        dw: halfW,
        dh: h,
        aspectRatio: Number((halfW / h).toFixed(4))
      },
      rightSlice: {
        id: 'carousel_right',
        order: 2,
        label: '2. Sayfa (Sağ Yarım)',
        sx: halfW,
        sy: 0,
        sw: w - halfW, // Küsürat kaybını önlemek için kalanı al
        sh: h,
        dx: 0,
        dy: 0,
        dw: w - halfW,
        dh: h,
        aspectRatio: Number(((w - halfW) / h).toFixed(4))
      },
      seamCoordinate: halfW,
      totalWidth: w,
      totalHeight: h
    };
  }

  /**
   * Tarayıcı Canvas'ı kullanarak görseli sıfır kayıpla iki DataURL'e böler
   */
  function splitImageUsingCanvas(imageSource, options) {
    var opts = options || {};
    var mimeType = opts.mimeType || 'image/jpeg';
    var quality = typeof opts.quality === 'number' ? opts.quality : 0.95;

    return new Promise(function (resolve, reject) {
      function processImg(img) {
        try {
          var naturalW = img.naturalWidth || img.width;
          var naturalH = img.naturalHeight || img.height;

          if (!naturalW || !naturalH) {
            return reject(new Error('Görsel boyutları alınamadı.'));
          }

          var slices = calculateSplitSlices(naturalW, naturalH);

          // 1. Sol Parça Canvas
          var canvasLeft = document.createElement('canvas');
          canvasLeft.width = slices.leftSlice.sw;
          canvasLeft.height = slices.leftSlice.sh;
          var ctxLeft = canvasLeft.getContext('2d');
          ctxLeft.drawImage(
            img,
            slices.leftSlice.sx, slices.leftSlice.sy, slices.leftSlice.sw, slices.leftSlice.sh,
            0, 0, slices.leftSlice.sw, slices.leftSlice.sh
          );
          var leftDataUrl = canvasLeft.toDataURL(mimeType, quality);

          // 2. Sağ Parça Canvas
          var canvasRight = document.createElement('canvas');
          canvasRight.width = slices.rightSlice.sw;
          canvasRight.height = slices.rightSlice.sh;
          var ctxRight = canvasRight.getContext('2d');
          ctxRight.drawImage(
            img,
            slices.rightSlice.sx, slices.rightSlice.sy, slices.rightSlice.sw, slices.rightSlice.sh,
            0, 0, slices.rightSlice.sw, slices.rightSlice.sh
          );
          var rightDataUrl = canvasRight.toDataURL(mimeType, quality);

          resolve({
            success: true,
            originalWidth: naturalW,
            originalHeight: naturalH,
            slices: slices,
            carouselItems: [
              {
                index: 0,
                order: 1,
                part: 'left',
                label: 'Sol Sayfa (1/2)',
                dataUrl: leftDataUrl,
                width: slices.leftSlice.sw,
                height: slices.leftSlice.sh
              },
              {
                index: 1,
                order: 2,
                part: 'right',
                label: 'Sağ Sayfa (2/2)',
                dataUrl: rightDataUrl,
                width: slices.rightSlice.sw,
                height: slices.rightSlice.sh
              }
            ]
          });
        } catch (err) {
          reject(err);
        }
      }

      if (typeof Image !== 'undefined' && typeof imageSource === 'string') {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () { processImg(img); };
        img.onerror = function (e) { reject(new Error('Görsel yüklenemedi: ' + (imageSource || ''))); };
        img.src = imageSource;
      } else if (imageSource && (imageSource.nodeName === 'IMG' || imageSource.nodeName === 'CANVAS')) {
        processImg(imageSource);
      } else {
        reject(new Error('Desteklenmeyen görsel kaynağı türü.'));
      }
    });
  }

  /**
   * Ürün nesnesi için türev carousel yayın yapılandırması üretir
   * ORİJİNAL ÜRÜN ASLA DEĞİŞTİRİLMEZ!
   */
  function prepareProductCarouselPayload(product, splitResult, options) {
    var p = product || {};
    var opts = options || {};
    var originalUrl = p.ana_resim || opts.mediaUrl || '';
    var safeSlug = (p.slug || 'product').replace(/[^a-zA-Z0-9_-]/g, '');

    if (!splitResult || !splitResult.carouselItems || splitResult.carouselItems.length < 2) {
      return {
        isCarousel: false,
        contentType: 'POST',
        mediaUrl: originalUrl,
        items: [originalUrl],
        metadata: { mode: 'single', reason: 'Split sonucu bulunamadı veya tek görsel.' }
      };
    }

    var leftItem = splitResult.carouselItems[0];
    var rightItem = splitResult.carouselItems[1];

    // Derivative dosya isimleri (Orijinal URL üzerine yazılmaz!)
    var leftDerivativeName = safeSlug + '-carousel-left.jpg';
    var rightDerivativeName = safeSlug + '-carousel-right.jpg';

    return {
      isCarousel: true,
      contentType: 'CAROUSEL',
      platform: 'instagram',
      originalMediaUrl: originalUrl, // Orijinal görsel referansı korunur
      derivativeNames: {
        left: leftDerivativeName,
        right: rightDerivativeName
      },
      carouselItems: [
        {
          order: 1,
          part: 'left',
          label: '1. Sol Parça',
          url: leftItem.url || leftItem.dataUrl,
          width: leftItem.width,
          height: leftItem.height
        },
        {
          order: 2,
          part: 'right',
          label: '2. Sağ Parça',
          url: rightItem.url || rightItem.dataUrl,
          width: rightItem.width,
          height: rightItem.height
        }
      ],
      // Kuyruğa yazılacak çoklu medya formatı (JSON string veya dizi)
      mediaUrlJson: JSON.stringify([
        leftItem.url || leftItem.dataUrl,
        rightItem.url || rightItem.dataUrl
      ]),
      metadata: {
        mode: opts.mode || 'auto',
        originalDimensions: {
          width: splitResult.originalWidth,
          height: splitResult.originalHeight
        },
        seamCoordinate: splitResult.slices ? splitResult.slices.seamCoordinate : 0
      }
    };
  }

  return {
    DEFAULT_ASPECT_RATIO_THRESHOLD: DEFAULT_ASPECT_RATIO_THRESHOLD,
    analyzeImageRatio: analyzeImageRatio,
    evaluateSplittingMode: evaluateSplittingMode,
    calculateSplitSlices: calculateSplitSlices,
    splitImageUsingCanvas: splitImageUsingCanvas,
    prepareProductCarouselPayload: prepareProductCarouselPayload
  };
}));

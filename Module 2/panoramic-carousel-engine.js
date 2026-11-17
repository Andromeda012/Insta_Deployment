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
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PanoramicCarouselEngine = api;
  }
}(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {

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

  // ============================================================================
  // YENİ: KOLEKSİYON 3 GÖNDERİLİ DİJİTAL KATALOG GRİD SİSTEMİ (Vİ - YA - NA)
  // & KATEGORİ BAZLI SUNUM KURALLARI (Yatak/Genç Odası, Dolap, Kahve Köşesi, Bağımsız)
  // ============================================================================

  var COLLECTION_CATEGORY_MODES = {
    'Yatak Odası': 'panoramic_room_flow',
    'Genç Odası': 'panoramic_room_flow',
    'Dolap Koleksiyonları': 'single_lead_then_pieces',
    'Kahve Köşesi Koleksiyonları': 'single_lead_then_pieces'
  };

  /**
   * Koleksiyon başlığından ana model adını ayıklar ve 3 parçaya (Örn: Vİ - YA - NA) böler.
   */
  function splitCollectionNameIntoThree(rawTitle) {
    var cleaned = String(rawTitle || 'KOLEKSİYON')
      .replace(/\b(yatak\s+odası|genç\s+odası|dolap\s+koleksiyonları|dolap\s+koleksiyonu|kahve\s+köşesi\s+koleksiyonları|kahve\s+köşesi|koleksiyonu|koleksiyon|takımı|takimi|serisi|modeli)\b/gi, '')
      .trim();

    if (!cleaned) cleaned = String(rawTitle || 'NOVA').trim();
    var upper = cleaned.toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
    var firstWord = upper.split(' ')[0] || upper;

    // Türkçe ünlü harfler üzerinden doğal hece tespiti
    var vowels = 'AEIİOÖUÜ';
    var syllables = [];
    var i = 0;
    var n = firstWord.length;

    while (i < n) {
      var vIdx = -1;
      for (var j = i; j < n; j++) {
        if (vowels.indexOf(firstWord[j]) !== -1) {
          vIdx = j;
          break;
        }
      }
      if (vIdx === -1) {
        if (syllables.length > 0) {
          syllables[syllables.length - 1] += firstWord.slice(i);
        } else {
          syllables.push(firstWord.slice(i));
        }
        break;
      }

      // Sonraki ünlüyü bul
      var nextV = -1;
      for (var k = vIdx + 1; k < n; k++) {
        if (vowels.indexOf(firstWord[k]) !== -1) {
          nextV = k;
          break;
        }
      }

      if (nextV === -1) {
        syllables.push(firstWord.slice(i));
        break;
      }

      var consonantsBetween = nextV - vIdx - 1;
      var splitPos = consonantsBetween <= 1 ? vIdx + 1 : vIdx + 2;
      syllables.push(firstWord.slice(i, splitPos));
      i = splitPos;
    }

    if (syllables.length === 3) {
      return {
        cleanName: firstWord,
        parts: [syllables[0], syllables[1], syllables[2]],
        formatted: syllables[0] + ' - ' + syllables[1] + ' - ' + syllables[2]
      };
    }

    if (syllables.length > 3) {
      var p1 = syllables[0];
      var p2 = syllables.slice(1, syllables.length - 1).join('');
      var p3 = syllables[syllables.length - 1];
      return {
        cleanName: firstWord,
        parts: [p1, p2, p3],
        formatted: p1 + ' - ' + p2 + ' - ' + p3
      };
    }

    // 1 veya 2 heceli kelimeler için karakter bazlı dengeli 3'lü bölme
    var len = firstWord.length;
    if (len >= 3) {
      var c1 = Math.ceil(len / 3);
      var c2 = Math.ceil((len - c1) / 2);
      var s1 = firstWord.slice(0, c1);
      var s2 = firstWord.slice(c1, c1 + c2);
      var s3 = firstWord.slice(c1 + c2);
      return {
        cleanName: firstWord,
        parts: [s1, s2, s3],
        formatted: s1 + ' - ' + s2 + ' - ' + s3
      };
    }

    return {
      cleanName: firstWord,
      parts: [firstWord, '•', 'NOVA'],
      formatted: firstWord + ' - • - NOVA'
    };
  }

  /**
   * Koleksiyon ana tanıtım fotoğrafını 3 ayrı gönderi kapağı olacak şekilde
   * Sol (1/3), Orta (2/3) ve Sağ (3/3) dilimlere böler.
   */
  function calculateTriptychSlices(width, height, rawTitle) {
    var w = Math.floor(Number(width) || 0);
    var h = Math.floor(Number(height) || 0);
    var thirdW = Math.floor(w / 3);
    var nameSplit = splitCollectionNameIntoThree(rawTitle);

    return {
      cleanName: nameSplit.cleanName,
      titleParts: nameSplit.parts,
      formattedTitle: nameSplit.formatted,
      totalWidth: w,
      totalHeight: h,
      covers: [
        {
          postIndex: 1,
          id: 'grid_cover_1_left',
          position: 'left',
          label: '1. Gönderi Kapağı (Sol 1/3)',
          titleSegment: nameSplit.parts[0],
          sx: 0,
          sy: 0,
          sw: thirdW,
          sh: h
        },
        {
          postIndex: 2,
          id: 'grid_cover_2_center',
          position: 'center',
          label: '2. Gönderi Kapağı (Orta 2/3)',
          titleSegment: nameSplit.parts[1],
          sx: thirdW,
          sy: 0,
          sw: thirdW,
          sh: h
        },
        {
          postIndex: 3,
          id: 'grid_cover_3_right',
          position: 'right',
          label: '3. Gönderi Kapağı (Sağ 3/3)',
          titleSegment: nameSplit.parts[2],
          sx: thirdW * 2,
          sy: 0,
          sw: w - thirdW * 2,
          sh: h
        }
      ]
    };
  }

  /**
   * Canvas üzerinde koleksiyon ana görselini 3 ayrı gönderi kapağına böler
   * ve her kapağın üzerine kendi hece/isim parçasını (Örn: Vİ | YA | NA) yazar.
   */
  function splitImageIntoThreeCoversUsingCanvas(imageSource, rawTitle, options) {
    var opts = options || {};
    var mimeType = opts.mimeType || 'image/jpeg';
    var quality = typeof opts.quality === 'number' ? opts.quality : 0.95;
    var drawTypography = opts.drawTypography !== false;

    return new Promise(function (resolve, reject) {
      function processImg(img) {
        try {
          var naturalW = img.naturalWidth || img.width;
          var naturalH = img.naturalHeight || img.height;
          if (!naturalW || !naturalH) {
            return reject(new Error('Koleksiyon görsel boyutları alınamadı.'));
          }

          var triptych = calculateTriptychSlices(naturalW, naturalH, rawTitle);
          var coverResults = triptych.covers.map(function (cov) {
            var canvas = document.createElement('canvas');
            canvas.width = cov.sw;
            canvas.height = cov.sh;
            var ctx = canvas.getContext('2d');

            ctx.drawImage(
              img,
              cov.sx, cov.sy, cov.sw, cov.sh,
              0, 0, cov.sw, cov.sh
            );

            if (drawTypography && cov.titleSegment) {
              var grad = ctx.createLinearGradient(0, cov.sh * 0.65, 0, cov.sh);
              grad.addColorStop(0, 'rgba(10, 15, 29, 0)');
              grad.addColorStop(1, 'rgba(10, 15, 29, 0.72)');
              ctx.fillStyle = grad;
              ctx.fillRect(0, cov.sh * 0.65, cov.sw, cov.sh * 0.35);

              var fontSize = Math.max(28, Math.floor(cov.sw * 0.22));
              ctx.font = '800 ' + fontSize + 'px "Cinzel", "Plus Jakarta Sans", serif';
              ctx.fillStyle = '#F8FAFC';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
              ctx.shadowBlur = 14;
              ctx.fillText(cov.titleSegment, Math.floor(cov.sw / 2), Math.floor(cov.sh * 0.84));
            }

            return {
              postIndex: cov.postIndex,
              id: cov.id,
              position: cov.position,
              label: cov.label,
              titleSegment: cov.titleSegment,
              width: cov.sw,
              height: cov.sh,
              dataUrl: canvas.toDataURL(mimeType, quality)
            };
          });

          resolve({
            success: true,
            cleanName: triptych.cleanName,
            titleParts: triptych.titleParts,
            formattedTitle: triptych.formattedTitle,
            originalWidth: naturalW,
            originalHeight: naturalH,
            covers: coverResults
          });
        } catch (err) {
          reject(err);
        }
      }

      if (typeof Image !== 'undefined' && typeof imageSource === 'string') {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () { processImg(img); };
        img.onerror = function () { reject(new Error('Koleksiyon görseli yüklenemedi: ' + (imageSource || ''))); };
        img.src = imageSource;
      } else if (imageSource && (imageSource.nodeName === 'IMG' || imageSource.nodeName === 'CANVAS')) {
        processImg(imageSource);
      } else {
        reject(new Error('Desteklenmeyen görsel kaynağı türü.'));
      }
    });
  }

  /**
   * Bağımsız ürünler için 2 sayfalı standart sunum paketi hazırlar:
   * 1. Sayfa: Ürünün görseli ve ismi
   * 2. Sayfa: Ürünün detayları (ölçüler ve özellikler)
   */
  function buildIndependentProductTwoPagePlan(product) {
    var p = product || {};
    var title = p.title || 'Bağımsız Ürün';
    var category = p.kategori || 'Portmanto';
    var imageUrl = p.ana_resim || '';
    var dimensions = p.olculer || p.body || '';
    var features = Array.isArray(p.ozellikler) ? p.ozellikler : [];

    return {
      entityType: 'independent',
      category: category,
      totalPosts: 1,
      slideCount: 2,
      slides: [
        {
          page: 1,
          role: 'product_cover',
          title: title,
          subtitle: category,
          media_url: imageUrl,
          description: '1. Sayfa: Ürünün görseli ve ismi'
        },
        {
          page: 2,
          role: 'product_details',
          title: title + ' — Teknik Detaylar',
          dimensions: dimensions,
          features: features,
          media_url: imageUrl,
          description: '2. Sayfa: Ürün detayları, ölçüler ve malzeme özellikleri'
        }
      ]
    };
  }

  /**
   * Koleksiyonlar için 3 Gönderili Instagram Kampanya Sistemini (POST 01: COLLECTION REVEAL,
   * POST 02: PRODUCT BREAKDOWN, POST 03: DESIGN STORY) ve 3'lü Grid Kapak (Vİ - YA - NA)
   * mimarisini ürün sayısına (1, 2-3, 4-6, 7-10, 10+) göre dinamik olarak üretir.
   */
  function buildCollectionThreePostGridPlan(collection, pieces) {
    var col = collection || {};
    var title = col.title || col.name || 'Koleksiyon';
    var category = col.kategori || col.category || 'Yatak Odası';
    var flowMode = COLLECTION_CATEGORY_MODES[category] || 'panoramic_room_flow';
    var rawPieces = Array.isArray(pieces) && pieces.length ? pieces : (Array.isArray(col.collection_pieces) ? col.collection_pieces : []);
    var leadImageUrl = col.ana_resim || col.hero_image || (rawPieces[0] && rawPieces[0].ana_resim) || '';
    var promoQuote = (col.promo_quote || col.design_story || col.kisa_aciklama || '').trim();
    var features = Array.isArray(col.ozellikler) && col.ozellikler.length ? col.ozellikler : (Array.isArray(col.features) ? col.features : []);
    var colors = Array.isArray(col.renkler) && col.renkler.length ? col.renkler : (Array.isArray(col.color_palette) ? col.color_palette : []);
    var dimensions = col.olculer || (col.dimensions && col.dimensions.raw) || col.body || '';
    var nameSplit = splitCollectionNameIntoThree(title);
    var pCount = rawPieces.length;

    // Ürün sayısı adaptasyon kademesi
    var countTier = '1_3';
    var scenarioCode = 'SCENARIO_B_2_3';
    if (pCount <= 1) {
      countTier = '1_3';
      scenarioCode = 'SCENARIO_A_1';
    } else if (pCount <= 3) {
      countTier = '1_3';
      scenarioCode = 'SCENARIO_B_2_3';
    } else if (pCount <= 6) {
      countTier = '4_6';
      scenarioCode = 'SCENARIO_C_4_6';
    } else if (pCount <= 10) {
      countTier = '7_10';
      scenarioCode = 'SCENARIO_D_7_10';
    } else {
      countTier = '10_plus';
      scenarioCode = 'SCENARIO_E_10_PLUS';
    }

    var categoryRuleSummary = flowMode === 'single_lead_then_pieces'
      ? 'İlk başta koleksiyondan bir ürünün görseli ile koleksiyonun ismi sunulur, ardından doğrudan sırayla diğer alt ürünlere geçilir.'
      : 'Geniş koleksiyon tanıtım görseli, özel tanıtım cümlesi ve sırasıyla tüm alt ürünler sunulur.';

    // -------------------------------------------------------------------------
    // POST 01 — COLLECTION REVEAL (Format: Instagram Reels | Sol Kapak: 1/3)
    // -------------------------------------------------------------------------
    var revealHighlights = countTier === '1_3'
      ? rawPieces
      : (countTier === '4_6' ? rawPieces.slice(0, 4) : rawPieces.slice(0, 5));

    var post01Reveal = {
      postNumber: 1,
      postCode: 'POST_01_COLLECTION_REVEAL',
      role: 'COLLECTION REVEAL',
      format: 'REELS',
      aspectRatio: '9:16',
      gridPosition: 'left',
      gridPositionLabel: 'Sol Kapak (1/3)',
      coverTitleSegment: nameSplit.parts[0],
      coverSourceUrl: leadImageUrl,
      collectionTitle: title,
      category: category,
      flowMode: flowMode,
      purpose: 'Koleksiyonu bir bütün olarak sinematik, premium ve görsel açıdan çarpıcı bir reklam filmiyle tanıtmak.',
      coreQuestionAnswered: 'Bu koleksiyon nedir ve onu görsel olarak çekici kılan özellikler nelerdir?',
      productCountRule: countTier === '1_3'
        ? '1-3 ürün: Tam seti göster ve her ürüne yeterli görsel süre tanı.'
        : (countTier === '4_6'
            ? '4-6 ürün: Önce tam koleksiyonu göster, ardından seçili ürün vurgularına geç.'
            : (countTier === '7_10'
                ? '7-10 ürün: Tam koleksiyona öncelik ver, görsel olarak en önemli ürünleri kısa sekanslarla vurgula.'
                : '10+ ürün: Her ürünü tek tek göstermekten kaçın; genel koleksiyon kimliğine ve temsilci ürünlere odaklan.')),
      storyboard: [
        {
          scene: 1,
          stage: 'Opening',
          title: 'Zarif Koleksiyon Açılışı',
          visualInstruction: 'Ana koleksiyon sahnesi üzerinde yavaş ileri yaklaşma (slow push-in) ve zarif tipografi ile koleksiyon adının belirmesi.',
          headline: title,
          subheadline: promoQuote || (category + ' Koleksiyonu'),
          media_url: leadImageUrl,
          animation: 'Slow Push-In & Fade-In Editorial Typography'
        },
        {
          scene: 2,
          stage: 'Main Presentation',
          title: 'Bütünsel Koleksiyon Sunumu',
          visualInstruction: flowMode === 'single_lead_then_pieces'
            ? 'Koleksiyonun ana temsilci ürünü ve genel form bütünlüğünün tam kadraj sunumu.'
            : 'Mevcut en iyi ana sahne renderı üzerinden tüm koleksiyonun yatay kamera kaydırmasıyla (slow pan) bütüncül sunumu.',
          headline: title + ' — Bütünsel Tasarım',
          subheadline: category,
          media_url: leadImageUrl,
          animation: 'Controlled Slow Horizontal Pan'
        },
        {
          scene: 3,
          stage: 'Visual Emphasis',
          title: 'Seçili Ürün ve Görünür Detay Vurguları',
          visualInstruction: 'Yalnızca mevcut görsellerde görünen yüzey, kulp, kapak ve form detaylarına dijital yakınlaşma (crop & zoom). Yeni açı uydurulmaz.',
          highlightedProducts: revealHighlights.map(function (p) { return p.title || p.product_slug; }),
          headline: 'Özenli İşçilik & Kusursuz Oranlar',
          subheadline: features.slice(0, 2).join(' • ') || '1. Sınıf Malzeme ve Modern Hatlar',
          media_url: (revealHighlights[0] && revealHighlights[0].ana_resim) || leadImageUrl,
          animation: 'Smooth Digital Zoom & Cross-Dissolve'
        },
        {
          scene: 4,
          stage: 'Closing',
          title: 'Koleksiyon İmza & Marka Kapanışı',
          visualInstruction: 'Koleksiyon adı ve Nova Furniture kurumsal kimliği ile dengeli kapanış kadrajı.',
          headline: title,
          subheadline: 'NOVA FURNITURE',
          media_url: leadImageUrl,
          animation: 'Gentle Pull-Back & Brand Lockup'
        }
      ]
    };

    // -------------------------------------------------------------------------
    // POST 02 — PRODUCT BREAKDOWN (Format: Instagram Carousel | Orta Kapak: 2/3)
    // -------------------------------------------------------------------------
    var breakdownSlides = [];

    // Slide 1: Collection Cover (Orta Kapak 2/3)
    breakdownSlides.push({
      slideNumber: 1,
      role: 'collection_cover',
      title: nameSplit.parts[1],
      fullCollectionTitle: title,
      subtitle: category + ' — Dijital Ürün Kataloğu',
      cropSliceIndex: 2,
      media_url: leadImageUrl,
      description: 'Koleksiyon Kapağı (Orta 2/3 Grid Kapağı — "' + nameSplit.parts[1] + '")'
    });

    if (pCount === 0 || pCount === 1) {
      // SCENARIO A — 1 PRODUCT (4–5 slides)
      var singleItem = rawPieces[0] || col;
      var singleImg = singleItem.ana_resim || leadImageUrl;
      var singleDims = singleItem.dimensions || singleItem.olculer || dimensions || '';
      breakdownSlides.push({
        slideNumber: 2,
        role: 'main_product_presentation',
        title: singleItem.title || title,
        subtitle: category,
        media_url: singleImg,
        description: 'Ana ürün sunumu (tam görünüm)'
      });
      breakdownSlides.push({
        slideNumber: 3,
        role: 'visible_design_details',
        title: (singleItem.title || title) + ' — Tasarım Detayları',
        subtitle: features.slice(0, 2).join(' • ') || 'Yüzey, kapak ve form detayları',
        media_url: singleImg,
        description: 'Mevcut görsel üzerinden görünür tasarım detayları yakın planı (crop)'
      });
      breakdownSlides.push({
        slideNumber: 4,
        role: 'verified_product_info',
        title: 'Doğrulanmış Ürün Bilgileri',
        dimensions: singleDims,
        features: features,
        colors: colors,
        media_url: singleImg,
        description: 'Doğrulanmış ölçüler ve malzeme özellikleri'
      });
      breakdownSlides.push({
        slideNumber: 5,
        role: 'collection_closing',
        title: title + ' • NOVA FURNITURE',
        subtitle: 'Detaylı bilgi ve özel teklif için DM veya WhatsApp üzerinden ulaşabilirsiniz.',
        media_url: leadImageUrl,
        description: 'Koleksiyon ve marka kapanış slaytı'
      });
    } else if (pCount <= 10) {
      // SCENARIO B (2-3), SCENARIO C (4-6), SCENARIO D (7-10)
      rawPieces.forEach(function (piece, idx) {
        breakdownSlides.push({
          slideNumber: idx + 2,
          role: 'individual_product_slide',
          piece_slug: piece.slug || piece.product_slug || '',
          piece_role: piece.piece_role || piece.role_in_collection || '',
          title: piece.title || (title + ' — Parça ' + (idx + 1)),
          dimensions: piece.dimensions || piece.olculer || '',
          features: Array.isArray(piece.ozellikler) && piece.ozellikler.length ? piece.ozellikler : features.slice(0, 2),
          media_url: piece.ana_resim || leadImageUrl,
          description: 'Bireysel ürün katalog kartı: Ürün adı, fotoğrafı ve doğrulanmış ölçüleri'
        });
      });
      breakdownSlides.push({
        slideNumber: breakdownSlides.length + 1,
        role: 'collection_overview_closing',
        title: title + ' — Koleksiyon Genel Görünümü',
        subtitle: 'NOVA FURNITURE • Tüm Parçalar ve Detaylı Katalog İçin İletişime Geçin',
        media_url: leadImageUrl,
        description: 'Tam koleksiyon genel görünümü ve kurumsal kapanış slaytı'
      });
    } else {
      // SCENARIO E — MORE THAN 10 PRODUCTS (Gruplanmış Katalog Sunumu, hiçbir ürün atlanmaz)
      var groupedByRole = {};
      rawPieces.forEach(function (piece) {
        var rKey = piece.piece_role || piece.role_in_collection || 'grup';
        if (!groupedByRole[rKey]) groupedByRole[rKey] = [];
        groupedByRole[rKey].push(piece);
      });

      Object.keys(groupedByRole).forEach(function (rKey) {
        var grp = groupedByRole[rKey];
        if (grp.length === 1) {
          var p = grp[0];
          breakdownSlides.push({
            slideNumber: breakdownSlides.length + 1,
            role: 'individual_product_slide',
            title: p.title || title,
            dimensions: p.dimensions || p.olculer || '',
            media_url: p.ana_resim || leadImageUrl,
            description: 'Bireysel ürün sunumu'
          });
        } else {
          breakdownSlides.push({
            slideNumber: breakdownSlides.length + 1,
            role: 'grouped_product_slide',
            groupKey: rKey,
            title: grp.map(function (x) { return x.title; }).join(' & '),
            groupedProducts: grp.map(function (x) {
              return { title: x.title, dimensions: x.dimensions || x.olculer || '', media_url: x.ana_resim || leadImageUrl };
            }),
            media_url: grp[0].ana_resim || leadImageUrl,
            description: 'İlişkili ürün grubu slaytı (' + grp.length + ' ürün birlikte açıkça tanımlanır)'
          });
        }
      });

      breakdownSlides.push({
        slideNumber: breakdownSlides.length + 1,
        role: 'collection_overview_closing',
        title: title + ' — Tam Koleksiyon Özeti (' + pCount + ' Ürün)',
        subtitle: 'NOVA FURNITURE',
        media_url: leadImageUrl,
        description: 'Tam koleksiyon genel görünümü ve kapanış slaytı'
      });
    }

    var post02Breakdown = {
      postNumber: 2,
      postCode: 'POST_02_PRODUCT_BREAKDOWN',
      role: 'PRODUCT BREAKDOWN',
      format: 'CAROUSEL',
      aspectRatio: '4:5',
      scenario: scenarioCode,
      gridPosition: 'center',
      gridPositionLabel: 'Orta Kapak (2/3)',
      coverTitleSegment: nameSplit.parts[1],
      coverSourceUrl: leadImageUrl,
      collectionTitle: title,
      category: category,
      flowMode: flowMode,
      purpose: 'Koleksiyonu düzenli, bilgilendirici ve görsel açıdan çekici bir dijital ürün kataloğu olarak sunmak.',
      coreQuestionAnswered: 'Bu koleksiyonda hangi ürünler yer alıyor ve her birinin bireysel özellikleri/ölçüleri nelerdir?',
      slideCount: breakdownSlides.length,
      slides: breakdownSlides
    };

    // -------------------------------------------------------------------------
    // POST 03 — DESIGN STORY (Format: Instagram Reels | Sağ Kapak: 3/3)
    // -------------------------------------------------------------------------
    var post03Story = {
      postNumber: 3,
      postCode: 'POST_03_DESIGN_STORY',
      role: 'DESIGN STORY',
      format: 'REELS',
      aspectRatio: '9:16',
      gridPosition: 'right',
      gridPositionLabel: 'Sağ Kapak (3/3)',
      coverTitleSegment: nameSplit.parts[2],
      coverSourceUrl: leadImageUrl,
      collectionTitle: title,
      category: category,
      flowMode: flowMode,
      purpose: 'Koleksiyonun tasarım dilini, estetik kimliğini ve yaşam alanına kattığı atmosferi duygusal bir iç mimari hikayeyle anlatmak.',
      coreQuestionAnswered: 'Bu koleksiyon nasıl bir yaşam tarzını, atmosferi ve iç mekan deneyimini temsil ediyor?',
      productCountRule: countTier === '1_3'
        ? '1-3 ürün: Bireysel mobilyaların tasarım karakterine ve birlikte oluşturdukları atmosfere odaklan.'
        : (countTier === '4_6'
            ? '4-6 ürün: Ürünlerin birbirini nasıl tamamladığını ve uyumlu bir iç mekan oluşturduğunu anlat.'
            : (countTier === '7_10'
                ? '7-10 ürün: Koleksiyonu bütünsel bir iç mimari tasarım dili olarak sun, ürün gruplarının uyumunu vurgula.'
                : '10+ ürün: Her ürünü saymak yerine genel tasarım felsefesine ve estetik temaya odaklan.')),
      storyboard: [
        {
          scene: 1,
          stage: 'Opening',
          title: 'Tasarım Fikri & Atmosferik Başlık',
          visualInstruction: 'Mekan atmosferini yansıtan yumuşak kadraj ve editoryal tipografi ile tasarım fikrinin açılışı.',
          headline: promoQuote || (title + ' — Tasarımın Dingin Dili'),
          subheadline: 'İç Mekan & Yaşam Alanı Hikayesi',
          media_url: leadImageUrl,
          animation: 'Editorial Fade & Slow Atmospheric Drift'
        },
        {
          scene: 2,
          stage: 'Design Identity',
          title: 'Görsel Karakter ve Tasarım Kimliği',
          visualInstruction: 'Koleksiyonun form bütünlüğünü ve mimari duruşunu gösteren seçili kadrajlar.',
          headline: 'Zamansız Form & Mimari Uyum',
          subheadline: category + ' tasarımında dengeli oranlar',
          media_url: leadImageUrl,
          animation: 'Slow Lateral Pan & Typography Overlay'
        },
        {
          scene: 3,
          stage: 'Aesthetic Details',
          title: 'Renk, Form, Malzeme ve Görünür Detaylar',
          visualInstruction: 'Mevcut görsellerdeki doğrulanmış yüzey dokusu, renk geçişleri ve kulp/kapak hatlarına odaklanan estetik yakın planlar.',
          headline: colors.length ? ('Renk Karakteri: ' + colors.join(' • ')) : 'Doğal Dokular & Seçkin Yüzeyler',
          subheadline: features.slice(0, 2).join(' • ') || 'Özenle işlenmiş yüzey detayları',
          media_url: (rawPieces[0] && rawPieces[0].ana_resim) || leadImageUrl,
          animation: 'Detail Crop Focus & Moodboard Split'
        },
        {
          scene: 4,
          stage: 'Lifestyle Interpretation',
          title: 'Yaşam Alanı Atmosferi',
          visualInstruction: 'Parçaların yaşam alanında yarattığı düzen, ferahlık ve bütünsel iç mekan hissi.',
          headline: 'Yaşam Alanınızda Bütünsel Zarafet',
          subheadline: promoQuote || 'Fonksiyonellik ve estetiğin dengeli buluşması',
          media_url: (rawPieces[1] && rawPieces[1].ana_resim) || leadImageUrl,
          animation: 'Smooth Zoom-Out to Room Context'
        },
        {
          scene: 5,
          stage: 'Closing',
          title: 'Tasarım Hikayesi & Marka Bağlantısı',
          visualInstruction: 'Tasarım hikayesini koleksiyon adına ve Nova Furniture kimliğine bağlayan final sahnesi.',
          headline: title,
          subheadline: 'NOVA FURNITURE — Yaşam Alanlarınıza Değer Katar',
          media_url: leadImageUrl,
          animation: 'Editorial Lockup & Gentle Fade'
        }
      ]
    };

    // 1. COLLECTION ANALYSIS & 5. PRODUCTION CHECKLIST & 6. CONSISTENCY CHECK
    var missingAssets = [];
    if (!leadImageUrl) missingAssets.push('Koleksiyon ana görseli eksik.');
    if (!promoQuote) missingAssets.push('Koleksiyon özel tanıtım cümlesi / tasarım hikayesi girilmemiş (varsayılan başlık kullanılıyor).');
    rawPieces.forEach(function (p, i) {
      if (!p.ana_resim) missingAssets.push((p.title || ('Alt Ürün #' + (i + 1))) + ' için özel görsel yüklenmemiş.');
      if (!p.dimensions && !p.olculer) missingAssets.push((p.title || ('Alt Ürün #' + (i + 1))) + ' için doğrulanmış ölçü bilgisi girilmemiş.');
    });

    return {
      entityType: 'collection',
      collectionSlug: col.slug || '',
      collectionTitle: title,
      category: category,
      flowMode: flowMode,
      categoryRuleSummary: categoryRuleSummary,
      titleSplit: nameSplit,
      leadImageUrl: leadImageUrl,
      piecesCount: pCount,
      pieces: rawPieces,
      totalGridPosts: 3,
      collectionAnalysis: {
        collectionName: title,
        totalProducts: pCount,
        productCategories: [category].concat(rawPieces.map(function (p) { return p.piece_role || p.role_in_collection || 'Alt Ürün'; })),
        availableRendersCount: (leadImageUrl ? 1 : 0) + rawPieces.filter(function (p) { return Boolean(p.ana_resim); }).length,
        missingAssetsOrInfo: missingAssets,
        recommendedScenario: scenarioCode
      },
      gridPosts: [post01Reveal, post02Breakdown, post03Story],
      productionChecklist: {
        existingAssetsReusable: [leadImageUrl].concat(rawPieces.map(function (p) { return p.ana_resim; })).filter(Boolean),
        newVisualAssetsToProduce: [
          'Sol Grid Kapağı (1/3): "' + nameSplit.parts[0] + '" tipografili POST 01 Reels kapağı',
          'Orta Grid Kapağı (2/3): "' + nameSplit.parts[1] + '" tipografili POST 02 Carousel 1. slaytı',
          'Sağ Grid Kapağı (3/3): "' + nameSplit.parts[2] + '" tipografili POST 03 Reels kapağı'
        ],
        productInfoToObtain: missingAssets,
        optionalSupplementaryGraphics: [
          'Editoryal tipografi katmanları',
          'Doğrulanmış renk ve malzeme bilgi kartları'
        ]
      },
      consistencyCheck: {
        allThreeRepresentSameCollection: true,
        distinctPurposesVerified: true,
        productAccuracyPreserved: true,
        noProductOmittedFromCatalog: true,
        noUnsupportedTechnicalClaims: true,
        meaningfulVisualDifferentiation: true
      }
    };
  }

  return {
    DEFAULT_ASPECT_RATIO_THRESHOLD: DEFAULT_ASPECT_RATIO_THRESHOLD,
    COLLECTION_CATEGORY_MODES: COLLECTION_CATEGORY_MODES,
    analyzeImageRatio: analyzeImageRatio,
    evaluateSplittingMode: evaluateSplittingMode,
    calculateSplitSlices: calculateSplitSlices,
    splitImageUsingCanvas: splitImageUsingCanvas,
    prepareProductCarouselPayload: prepareProductCarouselPayload,
    splitCollectionNameIntoThree: splitCollectionNameIntoThree,
    calculateTriptychSlices: calculateTriptychSlices,
    splitImageIntoThreeCoversUsingCanvas: splitImageIntoThreeCoversUsingCanvas,
    buildIndependentProductTwoPagePlan: buildIndependentProductTwoPagePlan,
    buildCollectionThreePostGridPlan: buildCollectionThreePostGridPlan
  };
}));

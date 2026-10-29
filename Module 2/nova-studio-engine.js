/**
 * NOVA FURNITURE & GLOBAL KAPAK — LÜKS MİMARİ İÇERİK MOTORU (nova-studio-engine.js)
 * =================================================================================
 * 1. Görsel Tamamlama (Visual Room Extension):
 *    - Ham katalog fotoğrafını alır, etrafına mimari vinyet, stüdyo derinlik ışığı,
 *      lüks koyu antrasit oda gradyanı ve altın akslar ekleyerek 9:16 ve 1:1 kadraja tamamlar.
 * 2. Lüks Tipografi & Rozet Yerleşimi (1. Görsel Referansı):
 *    - Altın "NOVA FURNITURE" üst logo
 *    - Model Adı (örn: NOVA - ZÜRİH YATAK ODASI)
 *    - Malzeme Başlığı (1. Sınıf MDF • CNC Membran Kapak)
 *    - Sol rozetler: 🪵 1. KALİTE MALZEME, ✨ 1. SINIF İŞÇİLİK
 *    - Alt CTA: FİYAT & BİLGİ İÇİN DM & WHATSAPP
 * 3. 2. Görsel Metin Formatı (Instagram/Facebook/TikTok/Shorts Açıklaması):
 *    - Başlık, İskandinav giriş paragrafı, Öne Çıkan Özellikler, Net Ölçüler,
 *      Yoruma "FİYAT" yazma CTA'sı, WhatsApp yönlendirmesi ve hashtag'ler.
 * 4. Video Sinematik Kamera Efekti:
 *    - İleri-geri yavaş kamera hareketi (Ken Burns Zoom In-Out).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NovaStudioEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const NOVA_BRAND = {
    brandTitle: 'NOVA FURNITURE',
    companyName: 'Global Kapak Mobilya & Nova Furniture',
    phone: '0 (505) 015 1035',
    whatsappUrl: 'https://wa.me/905050151035',
    handle: '@thenovafurniture'
  };

  /**
   * 2. Görseldeki kusursuz açıklama metnini (Caption) otomatik üretir.
   */
  function generateNovaLuxuryCaption(product = {}, platform = 'instagram') {
    const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
    const title = rawTitle.toUpperCase();
    const cleanCollectionName = capitalizeTitle(title.replace(/^NOVA\s*[-–—:]*\s*/i, ''));
    
    // Öne Çıkan Özellikler
    const defaultFeatures = [
      '🪵 1. Sınıf Sağlam MDF Gövde & CNC Membran Kapaklar',
      '🪞 Çizilmeye dayanıklı ithal membran yüzey teknolojisi',
      '🗄️ Geniş depolama hacmi ve sessiz frenli ray/menteşe donanımı',
      '🧹 Robot süpürgeye uygun ergonomik yüksek ayak tasarımı'
    ];
    let features = defaultFeatures;
    if (Array.isArray(product.ozellikler) && product.ozellikler.length > 0) {
      features = product.ozellikler.map(f => {
        f = f.trim();
        if (/^[\u{1F300}-\u{1F9FF}🪵✨🪞🗄️🧹✓•-]/u.test(f)) return f;
        return `🪵 ${f}`;
      });
    }

    // Net Katalog Ölçüleri
    const defaultDims = {
      gardirob: 'Genişlik: 240 cm | Yükseklik: 210 cm | Derinlik: 55 cm',
      sifonyer: 'Genişlik: 118 cm | Yükseklik: 80 cm | Derinlik: 44 cm',
      komodin: 'Genişlik: 55 cm | Yükseklik: 56 cm | Derinlik: 44 cm',
      yatak_basligi: 'Genişlik: 160 cm | Yükseklik: 120 cm'
    };

    let dimText = '';
    if (product.olculer) {
      if (typeof product.olculer === 'string') {
        dimText = product.olculer;
      } else if (typeof product.olculer === 'object') {
        dimText = Object.entries(product.olculer)
          .map(([k, v]) => `• ${capitalizeFirst(k.replace(/_/g, ' '))}: ${v}`)
          .join('\n');
      }
    }
    if (!dimText) {
      dimText = Object.entries(defaultDims)
        .map(([k, v]) => `• ${capitalizeFirst(k.replace(/_/g, ' '))}: ${v}`)
        .join('\n');
    }

    // Hashtag'ler
    const cleanTag = cleanCollectionName.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '');
    const hashtags = `#novafurniture #${cleanTag || 'koleksiyon'} #minimalistmobilya #yatakodasıtakımı #gardırop #şifonyer #komodin #membrankapak #mdfmobilya #cnckapak #içmimari #globalkapak`;

    if (platform === 'youtube') {
      return `⛰️ NOVA | ${cleanCollectionName} Koleksiyonu — 1. Sınıf Mimari Tasarım #Shorts

Minimalist tasarım, maksimum düzen! Modern İskandinav çizgilerine sahip ${cleanCollectionName} Koleksiyonu, 1. sınıf MDF gövdesi ve CNC membran kapak kalitesiyle yaşam alanınıza değer katıyor.

✨ Öne Çıkan Özellikler:
${features.join('\n')}

📐 Net Katalog Ölçüleri:
${dimText}

🏷️ FİYAT & SİPARİŞ BİLGİSİ:
💬 Yoruma "FİYAT" yazın, detaylı kataloğu ve güncel liste fiyatını paylaşalım!
📲 WhatsApp Sipariş & Destek Hattı: 0 (505) 015 1035
🌐 Web: https://globalmobilyaweb.vercel.app

${hashtags}`;
    }

    // Instagram / Facebook / TikTok Formatı (Referans 2 Görselinin Birebir Aynısı)
    return `thenovafurniture ⛰️ NOVA | ${cleanCollectionName.toUpperCase()} KOLEKSİYONU

Minimalist tasarım, maksimum düzen! Modern İskandinav çizgilerine sahip ${cleanCollectionName} Koleksiyonu, göz yormayan estetiği ve 1. sınıf malzeme kalitesiyle yaşam alanınızı yeniliyor.

✨ Öne Çıkan Özellikler:
${features.join('\n')}

📐 Net Katalog Ölçüleri:
${dimText}

🏷️ FİYAT & SİPARİŞ BİLGİSİ İÇİN:
💭 Yoruma "FİYAT" yazın, net fiyatımızı ve detaylı kataloğu anında DM kutunuza gönderelim! 👇
📲 Profilimizdeki WhatsApp hattından da bize ulaşabilirsiniz.

📌 Minimalist ev tasarımı için bu gönderiyi KAYDEDİN!

${hashtags}`;
  }

  /**
   * 1. Görseldeki profesyonel mimari afişi HTML5 Canvas üzerinde tam çözünürlüklü çizer.
   * - Ham katalog görselini alır, arkasına ambiyans ve oda derinliği ekleyerek tamamlar.
   * - İleri/geri kamera hareketi için zoomScale parametresi alır (1.00 -> 1.08).
   */
  function drawNovaLuxuryPoster(canvas, {
    productImageEl = null,
    product = {},
    isVertical = true,
    zoomScale = 1.0,
    panX = 0,
    panY = 0,
    fullRes = true
  } = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Hedef çözünürlük: Dikey 1080x1920 (9:16) veya Kare/Yatay 1080x1080 (1:1)
    const targetW = 1080;
    const targetH = isVertical ? 1920 : 1080;
    
    const W = fullRes ? targetW : (targetW / 2);
    const H = fullRes ? targetH : (targetH / 2);
    const scale = W / targetW;

    canvas.width = W;
    canvas.height = H;

    ctx.save();
    ctx.scale(scale, scale);

    const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
    let displayTitle = rawTitle.toUpperCase();
    if (!displayTitle.startsWith('NOVA')) {
      displayTitle = `NOVA - ${displayTitle}`;
    }
    const subCategory = product.kategori || '1. Sınıf MDF • CNC Membran Kapak';
    const brand = NOVA_BRAND.brandTitle;

    // 1. ARKA PLAN: Lüks Koyu Antrasit & Stüdyo Işık Gradyanı
    const bg = ctx.createLinearGradient(0, 0, 0, targetH);
    bg.addColorStop(0, '#07090D');
    bg.addColorStop(0.25, '#10131A');
    bg.addColorStop(0.55, '#0E1117');
    bg.addColorStop(0.85, '#0A0C10');
    bg.addColorStop(1, '#050608');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, targetW, targetH);

    // Mimari Arka Plan Geometrik Işık Çizgileri
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 0); ctx.lineTo(60, targetH);
    ctx.moveTo(targetW - 60, 0); ctx.lineTo(targetW - 60, targetH);
    ctx.stroke();
    ctx.restore();

    // 2. ORTA BÖLÜM: ÜRÜN GÖRSELİNİN ODA ATMOSFERİYLE TAMAMLANMASI (Room Extension)
    const photoW = targetW - 80;
    const photoH = isVertical ? 1040 : 660;
    const photoX = 40;
    const photoY = isVertical ? 410 : 210;

    // Fotoğrafın arkasındaki lüks sıcak vinyet aurası (Genişletilmiş Stüdyo Işığı)
    const aura = ctx.createRadialGradient(
      targetW / 2, photoY + photoH / 2, 60,
      targetW / 2, photoY + photoH / 2, photoW / 1.15
    );
    aura.addColorStop(0, 'rgba(217, 160, 91, 0.22)');
    aura.addColorStop(0.4, 'rgba(20, 24, 33, 0.5)');
    aura.addColorStop(1, 'rgba(5, 7, 10, 0.95)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, photoY - 60, targetW, photoH + 120);

    // Eğer ürünün gerçek fotoğrafı hazırsa odayla tamamlayarak çiz
    if (productImageEl && productImageEl.complete && productImageEl.naturalWidth > 0) {
      // (a) Fotoğrafın etrafını oda gibi tamamlayan bulanık lüks ambiyans dolgusu (Room Ambient Extension)
      ctx.save();
      ctx.filter = 'blur(32px) brightness(0.6)';
      ctx.drawImage(productImageEl, photoX - 25, photoY - 25, photoW + 50, photoH + 50);
      ctx.restore();

      // (b) Zemin Derinlik Gölgesi
      ctx.save();
      const floorGrad = ctx.createLinearGradient(0, photoY + photoH - 120, 0, photoY + photoH);
      floorGrad.addColorStop(0, 'rgba(0,0,0,0)');
      floorGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(photoX, photoY + photoH - 120, photoW, 120);
      ctx.restore();

      // (c) Ana Ürün Fotoğrafı (Kırpılmış & Lüks İç Çerçeveli)
      ctx.save();
      roundRect(ctx, photoX, photoY, photoW, photoH, 14, false, false);
      ctx.clip();

      // Ken Burns Kamera Hareketi (zoomScale & pan)
      const zW = photoW * zoomScale;
      const zH = photoH * zoomScale;
      const zX = photoX - (zW - photoW) / 2 + panX;
      const zY = photoY - (zH - photoH) / 2 + panY;

      ctx.drawImage(productImageEl, zX, zY, zW, zH);
      ctx.restore();

      // (d) Fotoğrafın etrafındaki ince altın/bronz çerçeve aksı
      ctx.save();
      ctx.strokeStyle = 'rgba(217, 160, 91, 0.4)';
      ctx.lineWidth = 2.5;
      roundRect(ctx, photoX, photoY, photoW, photoH, 14, false, true);
      ctx.restore();
    } else {
      // Fotoğraf henüz yüklenmemişse mimari placeholder
      ctx.save();
      ctx.fillStyle = '#141824';
      roundRect(ctx, photoX, photoY, photoW, photoH, 14, true, false);
      ctx.strokeStyle = 'rgba(217, 160, 91, 0.35)';
      ctx.lineWidth = 2;
      roundRect(ctx, photoX, photoY, photoW, photoH, 14, false, true);

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📷 Katalog Fotoğrafı Bekleniyor...', targetW / 2, photoY + photoH / 2);
      ctx.restore();
    }

    // 3. ÜST BÖLÜM: MARKA VE KOLEKSİYON BAŞLIĞI (1. Görsel Referansı)
    // Üst ince altın bordür çizgisi
    ctx.save();
    const goldLine = ctx.createLinearGradient(80, 0, targetW - 80, 0);
    goldLine.addColorStop(0, 'rgba(212, 175, 55, 0.1)');
    goldLine.addColorStop(0.5, 'rgba(212, 175, 55, 0.6)');
    goldLine.addColorStop(1, 'rgba(212, 175, 55, 0.1)');
    ctx.strokeStyle = goldLine;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(80, isVertical ? 65 : 40);
    ctx.lineTo(targetW - 80, isVertical ? 65 : 40);
    ctx.stroke();
    ctx.restore();

    // Altın Logo: NOVA FURNITURE
    ctx.save();
    ctx.fillStyle = '#D4AF37'; // Parlak Varak Altın
    ctx.font = '800 24px "Plus Jakarta Sans", serif';
    ctx.textAlign = 'center';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '7px';
    ctx.fillText(brand, targetW / 2, isVertical ? 128 : 82);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
    ctx.restore();

    // Koleksiyon Adı: NOVA - ZÜRİH YATAK ODASI
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 ${isVertical ? 40 : 34}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(displayTitle, targetW / 2, isVertical ? 188 : 130);
    ctx.restore();

    // Alt Başlık: 1. Sınıf MDF • CNC Membran Kapak
    ctx.save();
    ctx.fillStyle = '#E6C687'; // Sıcak Altın Varak
    ctx.font = '600 21px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(subCategory, targetW / 2, isVertical ? 234 : 168);
    ctx.restore();

    // Sol Üst Prestij Rozetleri (Hap Şeklinde Altın Çerçeveli Rozetler - Referans 1)
    if (isVertical) {
      const pillW = 280;
      const pillH = 46;
      const pillX = 40;
      drawGoldCapsuleBadge(ctx, pillX, 268, pillW, pillH, '🪵 1. KALİTE MALZEME');
      drawGoldCapsuleBadge(ctx, pillX, 328, pillW, pillH, '✨ 1. SINIF İŞÇİLİK');
    }

    // 4. ALT BÖLÜM: BÜYÜK ALTIN CTA BUTONU (FİYAT & BİLGİ İÇİN DM & WHATSAPP)
    const ctaW = targetW - 160;
    const ctaH = isVertical ? 96 : 84;
    const ctaX = 80;
    const ctaY = isVertical ? 1540 : 910;

    // Altın Çerçeveli Lüks Buton Gövdesi
    ctx.save();
    ctx.fillStyle = '#0E1118';
    roundRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2, true, false);

    // Parlak Altın Çerçeve Gradyanı
    const goldBorder = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY);
    goldBorder.addColorStop(0, '#B8860B');
    goldBorder.addColorStop(0.5, '#FDE68A');
    goldBorder.addColorStop(1, '#B8860B');
    ctx.strokeStyle = goldBorder;
    ctx.lineWidth = 3.5;
    roundRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2, false, true);

    // Buton İçi Yazısı
    ctx.fillStyle = '#FDE68A';
    ctx.font = `900 ${isVertical ? 30 : 25}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '1px';
    ctx.fillText('FİYAT & BİLGİ İÇİN DM & WHATSAPP', targetW / 2, ctaY + (isVertical ? 58 : 52));
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
    ctx.restore();

    // Alt Bilgilendirme Metni
    ctx.save();
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sipariş ve Detaylı Ölçüler İçin DM & WhatsApp 📲', targetW / 2, ctaY + (isVertical ? 142 : 124));
    ctx.restore();

    ctx.restore();
  }

  /**
   * Altın çerçeveli prestij kapsül rozeti çizer
   */
  function drawGoldCapsuleBadge(ctx, x, y, w, h, text) {
    ctx.save();
    ctx.fillStyle = 'rgba(14, 18, 25, 0.92)';
    roundRect(ctx, x, y, w, h, h / 2, true, false);
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 1.8;
    roundRect(ctx, x, y, w, h, h / 2, false, true);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 20, y + 29);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y + x, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function capitalizeFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function capitalizeTitle(str) {
    if (!str) return '';
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  /**
   * Video Ken Burns Animasyon Döngüsü
   * - İleri-geri yavaş kamera hareketi (zoomScale 1.00 -> 1.08 -> 1.00)
   */
  function animateKenBurns(canvas, imgEl, product, isVertical = true, onFrame = null) {
    let animId = null;
    let startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
      // 5 saniyelik sinüzoidal ileri-geri hareket döngüsü
      const cycle = (elapsed % 6000) / 6000;
      const zoomScale = 1.00 + 0.08 * (0.5 + 0.5 * Math.sin(cycle * Math.PI * 2));
      const panY = -10 * (0.5 + 0.5 * Math.sin(cycle * Math.PI * 2));

      drawNovaLuxuryPoster(canvas, {
        productImageEl: imgEl,
        product,
        isVertical,
        zoomScale,
        panX: 0,
        panY,
        fullRes: false
      });

      if (typeof onFrame === 'function') onFrame(zoomScale);
      animId = requestAnimationFrame(step);
    }

    animId = requestAnimationFrame(step);

    return {
      stop: () => {
        if (animId) cancelAnimationFrame(animId);
      }
    };
  }

  /**
   * Canlı Canvas'ı MediaRecorder ile gerçek MP4/WEBM videoya kaydeder.
   */
  async function recordCanvasVideo(canvas, imgEl, product, isVertical = true, durationMs = 5000) {
    return new Promise((resolve, reject) => {
      try {
        const stream = canvas.captureStream(30);
        let mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
        }

        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4000000 });
        const chunks = [];

        recorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };

        recorder.start();

        const anim = animateKenBurns(canvas, imgEl, product, isVertical);

        setTimeout(() => {
          anim.stop();
          recorder.stop();
        }, durationMs);
      } catch (err) {
        reject(err);
      }
    });
  }

  return {
    NOVA_BRAND,
    generateNovaLuxuryCaption,
    drawNovaLuxuryPoster,
    animateKenBurns,
    recordCanvasVideo
  };
}));

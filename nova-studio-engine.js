/**
 * NOVA FURNITURE & GLOBAL KAPAK — LÜKS MİMARİ İÇERİK MOTORU (nova-studio-engine.js)
 * =================================================================================
 * 1. Görsel Tamamlama (Visual Room Extension):
 *    - Ham katalog fotoğrafını alır, arkasına gerçekçi İskandinav/İtalyan mimari
 *      stüdyo odası (parke zemin, mimari duvarlar, tavan aydınlatması), zemin temas gölgesi,
 *      sıcak stüdyo spot ışığı ve vinyet ekleyerek yayınlanmaya hazır lüks sahneye dönüştürür.
 * 2. Lüks Tipografi & Rozet Yerleşimi (1. Görsel Referansı):
 *    - Altın "NOVA FURNITURE" üst logo
 *    - Model Adı (örn: NOVA - ZÜRİH YATAK ODASI)
 *    - Malzeme Başlığı (1. Sınıf MDF • CNC Membran Kapak)
 *    - Sol rozetler: 🪵 1. KALİTE MALZEME, ✨ 1. SINIF İŞÇİLİK
 *    - Alt CTA: FİYAT & BİLGİ İÇİN DM & WHATSAPP
 * 3. 2. Görsel Metin Formatı (Google Gemini AI Destekli):
 *    - Başlık, İskandinav giriş paragrafı, Öne Çıkan Özellikler, Net Ölçüler,
 *      Yoruma "FİYAT" yazma CTA'sı, WhatsApp yönlendirmesi ve hashtag'ler.
 * 4. Video Sinematik Kamera Efekti (Ken Burns Zoom In-Out):
 *    - İleri-geri yavaş kamera hareketi ve MediaRecorder ile gerçek MP4 video kaydı.
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

  // Gerçekçi Mimari Showroom / Oda Arka Planları (CDN Supabase)
  const SHOWROOM_ROOMS = [
    'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/showroom/warm_atelier.jpg',
    'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/showroom/luxury_showroom.jpg',
    'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/showroom/nordic_atelier.jpg'
  ];

  const cachedRoomImages = [];
  if (typeof Image !== 'undefined') {
    SHOWROOM_ROOMS.forEach((url, i) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      cachedRoomImages[i] = img;
    });
  }

  function getPreloadedRoomImage(index = 0) {
    const idx = Math.abs(index) % SHOWROOM_ROOMS.length;
    return cachedRoomImages[idx] || null;
  }

  /**
   * 2. Görseldeki kusursuz açıklama metnini (Caption) şablon olarak üretir.
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
        f = String(f).trim();
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
    const rawDims = product.olculer || product.body;
    if (rawDims) {
      if (typeof rawDims === 'string') {
        dimText = rawDims;
      } else if (typeof rawDims === 'object') {
        dimText = Object.entries(rawDims)
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
   * Google Gemini AI kullanarak her ürün için özgün, zengin ve satış odaklı açıklama üretir.
   */
  async function generateGeminiLuxuryCaption(product = {}, geminiKey = '', geminiModel = 'gemini-2.5-flash', platform = 'instagram') {
    const fallback = generateNovaLuxuryCaption(product, platform);
    if (!geminiKey || typeof fetch === 'undefined') {
      return fallback;
    }

    try {
      const rawDims = product.olculer || product.body || 'Gardırop: 240x210x55 cm, Şifonyer: 118x80x44 cm';
      const title = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
      const cleanName = title.replace(/^NOVA\s*[-–—:]*\s*/i, '');

      const promptText = `Sen Nova Furniture ve Global Kapak Mobilya'nın lüks sosyal medya yöneticisisin.
Aşağıdaki mobilya ürünü için ${platform} platformuna özel, tam olarak Reference 2 lüks İskandinav formatında, göz alıcı bir açıklama metni yaz.

Ürün Bilgileri:
- Ürün Adı: ${cleanName}
- Kategori/Detay: ${product.kategori || '1. Sınıf MDF • CNC Membran Kapak'}
- Net Ölçüler: ${typeof rawDims === 'object' ? JSON.stringify(rawDims) : rawDims}

Metin Kuralları:
1. 1. Satır: thenovafurniture ⛰️ NOVA | ${cleanName.toUpperCase()} KOLEKSİYONU
2. 2. Paragraf: Minimalist ve modern İskandinav estetiğini öven, 1. sınıf MDF gövde ve CNC membran kapak kalitesini vurgulayan 2-3 cümlelik akıcı, davetkar metin.
3. ✨ Öne Çıkan Özellikler: başlığı ve altına 4 adet estetik emojili madde (MDF gövde, çizilmez membran, frenli menteşeler, robot süpürge uyumu vb.).
4. 📐 Net Katalog Ölçüleri: başlığı ve ölçüler.
5. 🏷️ FİYAT & SİPARİŞ BİLGİSİ İÇİN:
   💭 Yoruma "FİYAT" yazın, net fiyatımızı ve detaylı kataloğu anında DM kutunuza gönderelim! 👇
   📲 Profilimizdeki WhatsApp hattından da bize ulaşabilirsiniz.
6. 📌 Minimalist ev tasarımı için bu gönderiyi KAYDEDİN!
7. En alta 10-12 adet popüler mobilya ve dekorasyon hashtag'i ekle (#novafurniture #minimalistmobilya #yatakodasıtakımı vb.).

Sadece oluşturduğun metni döndür, başına veya sonuna markdown tırnakları ya da ek açıklama ekleme.`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 60) {
          return text.trim();
        }
      }
    } catch (e) {
      console.warn('Gemini AI Caption generation fallback:', e);
    }
    return fallback;
  }

  /**
   * 1. Görseldeki profesyonel mimari afişi HTML5 Canvas üzerinde tam çözünürlüklü çizer.
   * - Ham katalog görselini alır, arkasına gerçekçi showroom odası, zemin temas gölgesi,
   *   stüdyo spot ışığı ve vinyet ekleyerek tamamlar.
   * - İleri/geri kamera hareketi için zoomScale parametresi alır (1.00 -> 1.08).
   */
  function drawNovaLuxuryPoster(canvas, {
    productImageEl = null,
    product = {},
    isVertical = true,
    zoomScale = 1.0,
    panX = 0,
    panY = 0,
    fullRes = true,
    roomIndex = 0
  } = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Hedef çözünürlük: Dikey 1080x1920 (9:16) veya Kare/Yatay 1080x1080 (1:1)
    const targetW = 1080;
    const targetH = isVertical ? 1920 : 1080;
    
    const W = fullRes ? targetW : Math.round(targetW / 2);
    const H = fullRes ? targetH : Math.round(targetH / 2);
    const scale = W / targetW;

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    ctx.save();
    ctx.scale(scale, scale);

    const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
    let displayTitle = rawTitle.toUpperCase();
    if (!displayTitle.startsWith('NOVA')) {
      displayTitle = `NOVA - ${displayTitle}`;
    }
    const subCategory = product.kategori || '1. Sınıf MDF • CNC Membran Kapak';
    const brand = NOVA_BRAND.brandTitle;

    // 1. KART ARKA PLANI: Lüks Koyu Antrasit & Stüdyo Işık Gradyanı
    const bg = ctx.createLinearGradient(0, 0, 0, targetH);
    bg.addColorStop(0, '#06080C');
    bg.addColorStop(0.25, '#0E1117');
    bg.addColorStop(0.55, '#0B0D13');
    bg.addColorStop(0.85, '#080A0E');
    bg.addColorStop(1, '#040507');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, targetW, targetH);

    // Mimari Arka Plan İnce Geometrik Aks Çizgileri
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 0); ctx.lineTo(60, targetH);
    ctx.moveTo(targetW - 60, 0); ctx.lineTo(targetW - 60, targetH);
    ctx.stroke();
    ctx.restore();

    // 2. ORTA BÖLÜM: ÜRÜN GÖRSELİNİN ODA ATMOSFERİYLE TAMAMLANMASI (Visual Room Extension)
    const photoW = targetW - 80;
    const photoH = isVertical ? 1040 : 660;
    const photoX = 40;
    const photoY = isVertical ? 410 : 210;

    // Fotoğrafın arkasındaki sıcak stüdyo aurası
    const aura = ctx.createRadialGradient(
      targetW / 2, photoY + photoH / 2, 80,
      targetW / 2, photoY + photoH / 2, photoW / 1.1
    );
    aura.addColorStop(0, 'rgba(217, 160, 91, 0.26)');
    aura.addColorStop(0.5, 'rgba(20, 24, 33, 0.55)');
    aura.addColorStop(1, 'rgba(5, 7, 10, 0.95)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, photoY - 60, targetW, photoH + 120);

    // ODA & ÜRÜN ÇERÇEVESİ
    ctx.save();
    roundRect(ctx, photoX, photoY, photoW, photoH, 14, false, false);
    ctx.clip();

    // (A) GERÇEKÇİ ODA ARKA PLANI (Photorealistic Showroom / Atelier Interior)
    const roomImg = getPreloadedRoomImage(roomIndex);
    if (roomImg && roomImg.complete && roomImg.naturalWidth > 0) {
      const rZoom = zoomScale;
      const rW = photoW * rZoom;
      const rH = photoH * rZoom;
      const rX = photoX - (rW - photoW) / 2;
      const rY = photoY - (rH - photoH) / 2 + panY * 0.4;
      ctx.drawImage(roomImg, rX, rY, rW, rH);
    } else {
      // Yedek Mimari Parke Zemin ve Duvar Gradyanı
      const wallGrad = ctx.createLinearGradient(photoX, photoY, photoX, photoY + photoH * 0.65);
      wallGrad.addColorStop(0, '#11151E');
      wallGrad.addColorStop(1, '#1A212E');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(photoX, photoY, photoW, photoH * 0.65);

      const floorGrad = ctx.createLinearGradient(photoX, photoY + photoH * 0.65, photoX, photoY + photoH);
      floorGrad.addColorStop(0, '#2D2218');
      floorGrad.addColorStop(0.3, '#3A2C1E');
      floorGrad.addColorStop(1, '#1E150D');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(photoX, photoY + photoH * 0.65, photoW, photoH * 0.35);
    }

    // (B) ÜRÜN GÖRSELİ & ZEMİN TEMAS GÖLGESİ (Realistic Floor Contact Shadow)
    if (productImageEl && productImageEl.complete && productImageEl.naturalWidth > 0) {
      const pMaxW = photoW * 0.84;
      const pMaxH = photoH * 0.74;
      const pRatio = productImageEl.naturalWidth / productImageEl.naturalHeight;
      let pDrawW = pMaxW;
      let pDrawH = pDrawW / pRatio;
      if (pDrawH > pMaxH) {
        pDrawH = pMaxH;
        pDrawW = pDrawH * pRatio;
      }

      const curZoom = zoomScale;
      const finalW = pDrawW * curZoom;
      const finalH = pDrawH * curZoom;
      const finalX = photoX + (photoW - finalW) / 2 + panX;
      // Mobilyanın alt tabanı parke zemine bassın
      const groundY = photoY + photoH - (photoH * 0.11);
      const finalY = groundY - finalH + panY;

      // 1. Zemin Temas Gölgesi (Contact Ambient Occlusion Shadow)
      ctx.save();
      const shadowGrad = ctx.createRadialGradient(
        finalX + finalW / 2, groundY + 4, 15,
        finalX + finalW / 2, groundY + 10, finalW * 0.54
      );
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
      shadowGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.45)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(finalX + finalW / 2, groundY + 6, finalW * 0.48, Math.max(14, finalH * 0.08), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Ürün Çizimi
      ctx.save();
      ctx.drawImage(productImageEl, finalX, finalY, finalW, finalH);
      ctx.restore();

      // 3. Sıcak Stüdyo Tavan Aydınlatması & Vinyet
      ctx.save();
      const spot = ctx.createRadialGradient(
        photoX + photoW / 2, photoY + 50, 40,
        photoX + photoW / 2, photoY + photoH / 2, photoW * 0.75
      );
      spot.addColorStop(0, 'rgba(255, 235, 195, 0.12)');
      spot.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
      spot.addColorStop(1, 'rgba(5, 7, 10, 0.50)');
      ctx.fillStyle = spot;
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📷 Katalog Fotoğrafı Hazırlanıyor...', targetW / 2, photoY + photoH / 2);
      ctx.restore();
    }

    ctx.restore(); // frame clip kapat

    // (C) Fotoğrafın etrafındaki ince altın çerçeve ve zarif vurgu
    ctx.save();
    ctx.strokeStyle = 'rgba(217, 160, 91, 0.55)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, photoX, photoY, photoW, photoH, 14, false, true);
    ctx.restore();

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
    ctx.fillStyle = 'rgba(14, 17, 24, 0.85)';
    roundRect(ctx, x, y, w, h, h / 2, true, false);

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 1.8;
    roundRect(ctx, x, y, w, h, h / 2, false, true);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 5);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r, fill = false, stroke = false) {
    if (typeof r === 'number') {
      r = { tl: r, tr: r, br: r, bl: r };
    } else {
      r = Object.assign({ tl: 0, tr: 0, br: 0, bl: 0 }, r);
    }

    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, [r.tl, r.tr, r.br, r.bl]);
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
    ctx.lineTo(x + r.bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.arcTo(x, y, x + r.tl, y, r.tl);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function capitalizeTitle(str) {
    if (!str) return '';
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  /**
   * Video Ken Burns Canlı Önizleme Döngüsü
   * - İleri-geri yavaş kamera hareketi (zoomScale 1.00 -> 1.08 -> 1.00)
   */
  function animateKenBurns(canvas, imgEl, product, isVertical = true, onFrame = null, roomIndex = 0) {
    let animId = null;
    let startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
      // 6 saniyelik sinüzoidal yumuşak ileri-geri kamera hareketi
      const cycle = (elapsed % 6000) / 6000;
      const zoomScale = 1.00 + 0.08 * (0.5 + 0.5 * Math.sin(cycle * Math.PI * 2));
      const panY = -12 * (0.5 + 0.5 * Math.sin(cycle * Math.PI * 2));

      drawNovaLuxuryPoster(canvas, {
        productImageEl: imgEl,
        product,
        isVertical,
        zoomScale,
        panX: 0,
        panY,
        fullRes: false,
        roomIndex
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
   * Canlı Canvas'ı MediaRecorder ile gerçek MP4 videoya kaydeder.
   * - H.264 video codec + sessiz Web Audio track ekler (Meta Reels standartlarına tam uyumlu).
   */
  async function recordCanvasVideo(canvas, imgEl, product, isVertical = true, durationMs = 5000, opts = {}) {
    return new Promise((resolve, reject) => {
      try {
        const targetW = 1080;
        const targetH = isVertical ? 1920 : 1080;

        let recCanvas = canvas;
        let isTemp = false;
        if (!canvas || canvas.width < 720) {
          recCanvas = document.createElement('canvas');
          recCanvas.width = targetW;
          recCanvas.height = targetH;
          isTemp = true;
        }

        const stream = recCanvas.captureStream(30);

        // Meta Reels için sessiz ses izi ekle
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            const dest = audioCtx.createMediaStreamDestination();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            gain.gain.value = 0.0001; // sessiz
            osc.connect(gain);
            gain.connect(dest);
            osc.start();
            dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
          }
        } catch (e) {
          console.warn('Audio track init fallback:', e);
        }

        let mimeType = 'video/mp4;codecs=avc1';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 3500000
        });

        const chunks = [];
        recorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const finalMime = chunks[0]?.type || mimeType || 'video/mp4';
          const blob = new Blob(chunks, { type: finalMime });
          resolve(blob);
        };

        recorder.start();

        let animStopped = false;
        const startTs = performance.now();

        function renderFrame(now) {
          if (animStopped) return;
          const elapsed = now - startTs;
          const progress = Math.min(elapsed / durationMs, 1);
          // Ken Burns yumuşak sinüs eğrisi
          const zoomScale = 1.00 + 0.08 * (0.5 - 0.5 * Math.cos(progress * Math.PI));
          const panY = -12 * (0.5 - 0.5 * Math.cos(progress * Math.PI));

          drawNovaLuxuryPoster(recCanvas, {
            productImageEl: imgEl,
            product,
            isVertical,
            zoomScale,
            panX: 0,
            panY,
            fullRes: true,
            roomIndex: opts.roomIndex || 0
          });

          if (canvas && isTemp) {
            const pCtx = canvas.getContext('2d');
            pCtx.drawImage(recCanvas, 0, 0, canvas.width, canvas.height);
          }

          if (progress < 1) {
            requestAnimationFrame(renderFrame);
          } else {
            animStopped = true;
            try { recorder.stop(); } catch (_) {}
          }
        }

        requestAnimationFrame(renderFrame);
      } catch (err) {
        reject(err);
      }
    });
  }

  return {
    NOVA_BRAND,
    SHOWROOM_ROOMS,
    getPreloadedRoomImage,
    generateNovaLuxuryCaption,
    generateGeminiLuxuryCaption,
    drawNovaLuxuryPoster,
    animateKenBurns,
    recordCanvasVideo
  };
}));

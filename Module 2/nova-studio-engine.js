/**
 * NOVA FURNITURE — LÜKS MİMARİ İÇERİK MOTORU (nova-studio-engine.js)
 * =================================================================================
 * 1. MİMARİ ODA SENTEZİ & KUSURSUZ MOBİLYA OTURTMA (composeSeatedProduct):
 *    - Ham katalog veya dekupe (arka plansız) mobilya fotoğrafını alır.
 *    - İskandinav/İtalyan lüks mimari oda arka planı sentezler:
 *      * Perspektif sıcak ahşap parke zemin ve akustik duvar çıtaları.
 *      * Çok katmanlı gerçekçi zemin temas gölgesi (occlusion + diffused contact shadow).
 *      * Zemin vernik yansıması (subtle polished floor reflection).
 *      * Doğal yönlü pencere gün ışığı ve tavan spot aydınlatması.
 * 2. 3 AYRI GÜNLÜK FORMAT MOTORU:
 *    - (A) REELS VİDEOSU (1080x1920): Sinematik Ken Burns ileri-geri kamera hareketi
 *          ve MP4 video kaydı (Sabah 10:00 yayını).
 *    - (B) DETAY MADDE POSTU (1080x1080 Kare): Sol yarıda lüks mimari oda içinde oturtulmuş
 *          ürün fotoğrafı, sağ yarıda madde madde dizilmiş lüks özellik kartları, ölçüler
 *          ve altın WhatsApp/DM CTA butonu (Öğle 14:30 yayını).
 *    - (C) HİKAYE / STORY (1080x1920 Dikey): Üstte mimari çerçevede mobilya, altta
 *          özellik kartları ve etkileşimli Story DM çıkartması formatında altın buton (Akşam 20:00 yayını).
 * 3. GEMINI AI AÇIKLAMA (CAPTION) MOTORU:
 *    - Referans lüks İskandinav formatında, satış odaklı Instagram açıklaması.
 *    - KESİNLİKLE web linki veya #globalkapak içermez; WhatsApp ve DM yönlendirmeli.
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
    companyName: 'Nova Furniture',
    phone: '0 (505) 015 1035',
    whatsappUrl: 'https://wa.me/905050151035',
    handle: '@thenovafurniture'
  };

  /**
   * Ürün nesnesinden 5-6 temiz lüks özellik maddesi çıkarır.
   */
  function extractProductSpecsList(product = {}) {
    const list = [];
    const rawCategory = product.kategori || product.category || 'Özel Tasarım Mobilya';
    
    list.push({
      icon: '🪵',
      title: '1. Sınıf Sağlam Gövde',
      desc: '18mm E1 Sertifikalı Dayanıklı MDF'
    });

    list.push({
      icon: '🪞',
      title: 'İthal Membran Kapaklar',
      desc: 'Çizilmeye & neme dayanıklı CNC yüzey'
    });

    list.push({
      icon: '🗄️',
      title: 'Frenli Donanım Sistemi',
      desc: 'Sessiz kapanan teleskopik ray & menteşe'
    });

    // Ölçü bilgisi
    let dimStr = '';
    const rawDims = product.olculer || product.body;
    if (typeof rawDims === 'string' && rawDims.trim()) {
      dimStr = rawDims.trim().slice(0, 48);
    } else if (typeof rawDims === 'object' && rawDims !== null) {
      const firstEntry = Object.entries(rawDims)[0];
      if (firstEntry) dimStr = `${capitalizeFirst(firstEntry[0])}: ${firstEntry[1]}`;
    }
    if (!dimStr) {
      dimStr = 'G: 240 cm • Y: 210 cm • D: 55 cm';
    }
    list.push({
      icon: '📐',
      title: 'Net Katalog Ölçüleri',
      desc: dimStr
    });

    list.push({
      icon: '🎨',
      title: '50+ Renk & Özel Ölçü',
      desc: 'Mat, soft ve ahşap doku alternatifleri'
    });

    list.push({
      icon: '🛡️',
      title: '5 Yıl Üretici Garantisi',
      desc: '5 İş Gününde Hızlı Güvenli Sevkiyat'
    });

    return list;
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
    const hashtags = `#novafurniture #${cleanTag || 'koleksiyon'} #minimalistmobilya #yatakodasıtakımı #gardırop #şifonyer #komodin #membrankapak #mdfmobilya #cnckapak #içmimari #luxuryfurniture`;

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

${hashtags}`;
    }

    // Instagram / Facebook / TikTok Formatı
    return `thenovafurniture ⛰️ NOVA | ${cleanCollectionName.toUpperCase()} KOLEKSİYONU

Minimalist tasarım, maksimum düzen! Modern İskandinav çizgilerine sahip ${cleanCollectionName} Koleksiyonu, göz yormayan estetiği ve 1. sınıf malzeme kalitesiyle yaşam alanınızı yeniliyor.

✨ Öne Çıkan Özellikler:
${features.join('\n')}

📐 Net Katalog Ölçüleri:
${dimText}

🏷️ FİYAT & SİPARİŞ BİLGİSİ İÇİN:
💭 Yoruma "FİYAT" yazın, net fiyatımızı ve detaylı kataloğu anında DM kutunuza gönderelim! 👇
📲 Profilimizdeki WhatsApp hattından da bize ulaşabilirsiniz (0 505 015 1035).

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

      const promptText = `Sen Nova Furniture'ın (@thenovafurniture) lüks sosyal medya yöneticisisin. KESİNLİKLE hiçbir web sitesi linki verme ve 'Global Kapak' veya '#globalkapak' kelimelerini asla kullanma!
Aşağıdaki mobilya ürünü için ${platform} platformuna özel, tam olarak lüks İskandinav formatında, göz alıcı bir açıklama metni yaz.

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
   📲 Profilimizdeki WhatsApp hattından da bize ulaşabilirsiniz (0 505 015 1035).
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
   * LÜKS MİMARİ İÇ MEKAN / ODA ARKA PLANI SENTEZİ
   * - İskandinav & İtalyan mimari oda: Sıcak grej/antrasit duvar,
   *   akustik ahşap çıtalar, perspektif parke zemin ve yönlü gün ışığı huzmesi.
   */
  function synthesizeArchitecturalRoom(ctx, x, y, w, h, opts = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const floorRatio = opts.floorRatio || 0.68; // Zemin başlangıç oranı (%68)
    const floorY = y + h * floorRatio;
    const floorH = h - (floorY - y);

    // 1. DUVAR: Sıcak Mimari Grej / Koyu Antrasit Gradyanı
    const wallGrad = ctx.createLinearGradient(x, y, x, floorY);
    wallGrad.addColorStop(0, '#151922');
    wallGrad.addColorStop(0.5, '#1A202C');
    wallGrad.addColorStop(1, '#11151D');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(x, y, w, floorY - y);

    // 2. AKUSTİK AHŞAP DUVAR ÇITALARI (Sol Taraf)
    const slatCount = 14;
    const slatW = Math.max(6, Math.round(w * 0.016));
    const slatGap = Math.max(10, Math.round(w * 0.022));
    const slatStartX = x + Math.round(w * 0.04);

    for (let i = 0; i < slatCount; i++) {
      const sx = slatStartX + i * (slatW + slatGap);
      if (sx + slatW > x + w * 0.42) break;

      // Çıtanın gölgesi
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(sx + 3, y, slatW, floorY - y);

      // Çıtanın kendisi (Doğal ceviz / meşe ahşap gradyanı)
      const slatGrad = ctx.createLinearGradient(sx, y, sx + slatW, y);
      slatGrad.addColorStop(0, '#5A3F2A');
      slatGrad.addColorStop(0.4, '#8B6544');
      slatGrad.addColorStop(0.8, '#5A3F2A');
      slatGrad.addColorStop(1, '#3B291A');
      ctx.fillStyle = slatGrad;
      ctx.fillRect(sx, y, slatW, floorY - y);

      // İnce dikey altın/vurgu kenar çizgisi
      ctx.fillStyle = 'rgba(255, 220, 150, 0.15)';
      ctx.fillRect(sx, y, 1, floorY - y);
    }

    // 3. DOĞAL PENCERE GÜN IŞIĞI HUZMESİ (Sol Üstten Sağa Doğru Eğimli)
    ctx.save();
    const beam = ctx.createLinearGradient(x, y, x + w * 0.85, floorY);
    beam.addColorStop(0, 'rgba(255, 240, 215, 0.14)');
    beam.addColorStop(0.35, 'rgba(255, 230, 190, 0.06)');
    beam.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y);
    ctx.lineTo(x + w * 0.65, y);
    ctx.lineTo(x + w, y + h * 0.85);
    ctx.lineTo(x + w * 0.35, floorY + floorH * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 4. SÜPÜRGELİK / ZEMİN AYIRIM ÇİZGİSİ
    const baseH = Math.max(6, Math.round(h * 0.015));
    ctx.fillStyle = '#090B0F';
    ctx.fillRect(x, floorY - baseH, w, baseH);

    // İnce altın aydınlatma şeridi (Gizli LED süpürgelik efekti)
    const ledGrad = ctx.createLinearGradient(x, 0, x + w, 0);
    ledGrad.addColorStop(0, 'rgba(212, 175, 55, 0.05)');
    ledGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.45)');
    ledGrad.addColorStop(1, 'rgba(212, 175, 55, 0.05)');
    ctx.fillStyle = ledGrad;
    ctx.fillRect(x, floorY - 1.5, w, 2.5);

    // 5. PERSPEKTİF PARKE ZEMİN (Lüks Doğal Meşe / Ceviz)
    const floorGrad = ctx.createLinearGradient(x, floorY, x, y + h);
    floorGrad.addColorStop(0, '#1A140F');
    floorGrad.addColorStop(0.3, '#2A1E16');
    floorGrad.addColorStop(0.7, '#1F1610');
    floorGrad.addColorStop(1, '#0F0B08');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(x, floorY, w, floorH);

    // Perspektif Zemin Çizgileri (1 Noktalı Kaçış Perspektifi)
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1.2;
    const vpX = x + w * 0.5;
    const vpY = y + h * 0.25;

    const plankSteps = 16;
    for (let i = 0; i <= plankSteps; i++) {
      const bottomX = x - w * 0.3 + (i / plankSteps) * (w * 1.6);
      ctx.beginPath();
      // Duvar/zemin kesişim noktasını hesapla
      const t = (floorY - vpY) / (y + h - vpY);
      const startFloorX = vpX + (bottomX - vpX) * t;
      ctx.moveTo(startFloorX, floorY);
      ctx.lineTo(bottomX, y + h);
      ctx.stroke();
    }

    // Yatay parke derz çizgileri
    const horizCount = 7;
    for (let j = 1; j <= horizCount; j++) {
      const prog = Math.pow(j / horizCount, 1.8);
      const py = floorY + prog * floorH;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x + w, py);
      ctx.stroke();
    }
    ctx.restore();

    // 6. ÜSTTEN TAVAN SPOT IŞIK AURA KONİSİ
    const spot = ctx.createRadialGradient(
      x + w * 0.5, y + 20, 20,
      x + w * 0.5, floorY, w * 0.75
    );
    spot.addColorStop(0, 'rgba(255, 245, 220, 0.12)');
    spot.addColorStop(0.6, 'rgba(255, 245, 220, 0.02)');
    spot.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = spot;
    ctx.fillRect(x, y, w, h);

    ctx.restore();
  }

  /**
   * MOBİLYAYI ODA İÇİNE KUSURSUZ ŞEKİLDE OTURTUR (composeSeatedProduct)
   * - Odayı çizer,
   * - Ayak ve alt gövde temas gölgesi (multi-tier contact shadow) oluşturur,
   * - İnce zemin yansıması ekler,
   * - Ürün görselini tam oranlı yerleştirir,
   * - Doğal ortam ışıklandırmasıyla mobilyayı sahneye organik olarak yedirir.
   */
  function composeSeatedProduct(ctx, imgEl, x, y, w, h, opts = {}) {
    const zoomScale = opts.zoomScale || 1.0;
    const panX = opts.panX || 0;
    const panY = opts.panY || 0;
    const floorRatio = opts.floorRatio || 0.68;

    // 1. Mimari Odayı Çiz
    synthesizeArchitecturalRoom(ctx, x, y, w, h, { floorRatio });

    const hasImg = imgEl && imgEl.complete && (imgEl.naturalWidth > 0 || imgEl.width > 0);
    if (!hasImg) {
      // Fotoğraf henüz yüklenmediyse şık mimari placeholder
      ctx.save();
      ctx.fillStyle = 'rgba(212, 175, 55, 0.85)';
      ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📷 Ürün Kataloğu İşleniyor...', x + w / 2, y + h / 2);
      ctx.restore();
      return;
    }

    const imgW = imgEl.naturalWidth || imgEl.width;
    const imgH = imgEl.naturalHeight || imgEl.height;
    const imgRatio = imgW / imgH;

    // Mobilyanın oturacağı alan ve hedef boyutlar
    // Taban seviyesi: zemin çizgisinin biraz altında (perspektif temas noktası)
    const groundLevelY = y + h * (floorRatio + 0.14);
    
    // Kadraj içi maksimum genişlik ve yükseklik
    const maxBoxW = w * 0.88;
    const maxBoxH = h * 0.68;

    let targetW, targetH;
    if (imgRatio > (maxBoxW / maxBoxH)) {
      targetW = maxBoxW * zoomScale;
      targetH = targetW / imgRatio;
    } else {
      targetH = maxBoxH * zoomScale;
      targetW = targetH * imgRatio;
    }

    // Mobilyayı yatayda ortala, dikeyde tabanı groundLevelY'ye oturt
    const drawX = x + (w - targetW) / 2 + panX;
    const drawY = groundLevelY - targetH + panY;

    // 2. ÇOK KATMANLI ZEMİN TEMAS GÖLGESİ (Contact & Ambient Shadows)
    ctx.save();
    const shadowCenterY = groundLevelY + panY;
    const shadowW = targetW * 0.82;

    // (A) Geniş Yaygın Ortam Gölgesi (Soft Ambient Spread)
    const ambGrad = ctx.createRadialGradient(
      drawX + targetW / 2 + 10, shadowCenterY + 12, shadowW * 0.15,
      drawX + targetW / 2 + 10, shadowCenterY + 12, shadowW * 0.65
    );
    ambGrad.addColorStop(0, 'rgba(6, 8, 12, 0.65)');
    ambGrad.addColorStop(0.5, 'rgba(10, 14, 20, 0.28)');
    ambGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = ambGrad;
    ctx.beginPath();
    ctx.ellipse(drawX + targetW / 2 + 10, shadowCenterY + 12, shadowW * 0.62, Math.max(14, targetH * 0.09), 0, 0, Math.PI * 2);
    ctx.fill();

    // (B) Keskin Zemin Temas Gölgesi (Tight Dark Occlusion Shadow)
    const occGrad = ctx.createRadialGradient(
      drawX + targetW / 2, shadowCenterY, shadowW * 0.08,
      drawX + targetW / 2, shadowCenterY, shadowW * 0.48
    );
    occGrad.addColorStop(0, 'rgba(2, 3, 5, 0.88)');
    occGrad.addColorStop(0.6, 'rgba(4, 6, 9, 0.50)');
    occGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = occGrad;
    ctx.beginPath();
    ctx.ellipse(drawX + targetW / 2, shadowCenterY, shadowW * 0.46, Math.max(6, targetH * 0.038), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. VERNİKLİ PARKE ZEMİN YANSIMASI (Subtle Floor Reflection)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, shadowCenterY - 2, w, y + h - shadowCenterY);
    ctx.clip();

    ctx.save();
    ctx.globalAlpha = 0.12;
    // Dikey aynalama
    ctx.translate(drawX, shadowCenterY + targetH * 0.4);
    ctx.scale(1, -0.4);
    ctx.drawImage(imgEl, 0, 0, targetW, targetH);
    ctx.restore();

    // Yansımayı aşağı doğru söndüren gradyan maskesi
    const refMask = ctx.createLinearGradient(0, shadowCenterY, 0, shadowCenterY + targetH * 0.35);
    refMask.addColorStop(0, 'rgba(20, 16, 12, 0.1)');
    refMask.addColorStop(1, 'rgba(15, 11, 8, 0.95)');
    ctx.fillStyle = refMask;
    ctx.fillRect(x, shadowCenterY, w, y + h - shadowCenterY);
    ctx.restore();

    // 4. MOBİLYA FOTOĞRAFINI ÇİZ (Asıl Ürün)
    ctx.save();
    ctx.drawImage(imgEl, drawX, drawY, targetW, targetH);
    ctx.restore();

    // 5. ORTAM ENTEGRASYON IŞIĞI (Warm Bounce Tint)
    // Ürünün üzerine sol taraftan vuran mimari gün ışığı tonu
    ctx.save();
    const tint = ctx.createLinearGradient(drawX, drawY, drawX + targetW, drawY + targetH);
    tint.addColorStop(0, 'rgba(255, 235, 200, 0.06)');
    tint.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    tint.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
    ctx.fillStyle = tint;
    ctx.fillRect(drawX, drawY, targetW, targetH);
    ctx.restore();
  }

  /**
   * FORMAT 2: DETAY MADDE POSTU (1080x1080 Kare Gönderi)
   * =======================================================
   * - SOL YARI (~520px): Lüks mimari odada kusursuz oturtulmuş ürün fotoğrafı + altın çerçeve.
   * - SAĞ YARI (~560px): Marka logosu, ürün adı, altın bölücü, madde madde dizilmiş
   *   lüks özellik kartları (MDF, Membran, Raylar, Ölçüler) ve altın WhatsApp/DM CTA butonu.
   */
  function drawNovaSplitSpecPost(canvas, {
    product = {},
    productImageEl = null,
    zoomScale = 1.0,
    panX = 0,
    panY = 0,
    fullRes = true
  } = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const targetW = 1080;
    const targetH = 1080;
    const W = fullRes ? targetW : 540;
    const H = fullRes ? targetH : 540;
    const scale = W / targetW;

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    ctx.save();
    ctx.scale(scale, scale);

    const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
    const displayTitle = rawTitle.replace(/^NOVA\s*[-–—:]*\s*/i, '').toUpperCase();
    const subCategory = product.kategori || '1. Sınıf MDF • CNC Membran Kapak';

    // 1. GENEL KART ARKA PLANI (Derin Mimari Grafit)
    const bgGrad = ctx.createLinearGradient(0, 0, targetW, targetH);
    bgGrad.addColorStop(0, '#090C11');
    bgGrad.addColorStop(0.5, '#0E131C');
    bgGrad.addColorStop(1, '#07090D');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, targetW, targetH);

    // İnce altın aks çizgileri
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, targetW - 40, targetH - 40);
    ctx.restore();

    // 2. SOL YARI: MİMARİ ODADA SEATED ÜRÜN FOTOĞRAFI
    const leftPad = 36;
    const topPad = 36;
    const photoBoxW = 496;
    const photoBoxH = 1008;

    // Fotoğraf konteyneri çerçeve çizgisi
    ctx.save();
    roundRect(ctx, leftPad, topPad, photoBoxW, photoBoxH, 18, false, false);
    ctx.clip();

    // Seated mobilya ve mimari odayı sol yarıya render et
    composeSeatedProduct(ctx, productImageEl, leftPad, topPad, photoBoxW, photoBoxH, {
      zoomScale: zoomScale * 1.05,
      panX,
      panY,
      floorRatio: 0.72
    });

    // Sol Yarı Üst Rozeti
    ctx.restore(); // clip kapat
    ctx.save();
    drawGoldCapsuleBadge(ctx, leftPad + 24, topPad + 24, 210, 42, '👑 NOVA KOLEKSİYON');
    drawGoldCapsuleBadge(ctx, leftPad + 24, topPad + photoBoxH - 66, 260, 42, '🛡️ 5 YIL GARANTİ • 18mm MDF');
    
    // Fotoğraf etrafına altın zarif çerçeve
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, leftPad, topPad, photoBoxW, photoBoxH, 18, false, true);
    ctx.restore();

    // 3. SAĞ YARI: ÜRÜN BİLGİLERİ & MADDE MADDE ÖZELLİKLER
    const rightX = leftPad + photoBoxW + 32;
    const rightW = targetW - rightX - 36;

    // (A) Üst Marka Başlığı
    ctx.save();
    ctx.fillStyle = '#D4AF37'; // Varak Altın
    ctx.font = '800 20px "Plus Jakarta Sans", serif';
    ctx.textAlign = 'left';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '6px';
    ctx.fillText('NOVA FURNITURE', rightX, topPad + 36);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

    // (B) Koleksiyon Başlığı (Büyük Beyaz Tipografi)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 34px "Plus Jakarta Sans", sans-serif';
    // Uzun başlıklarda 2 satıra böl
    const titleWords = displayTitle.split(' ');
    let line1 = displayTitle;
    let line2 = '';
    if (displayTitle.length > 20 && titleWords.length > 1) {
      const mid = Math.ceil(titleWords.length / 2);
      line1 = titleWords.slice(0, mid).join(' ');
      line2 = titleWords.slice(mid).join(' ');
    }

    ctx.fillText(line1, rightX, topPad + 84);
    let titleOffset = 0;
    if (line2) {
      ctx.fillText(line2, rightX, topPad + 124);
      titleOffset = 38;
    }

    // (C) Alt Kategori Açıklaması
    ctx.fillStyle = '#E6C687';
    ctx.font = '600 17px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subCategory, rightX, topPad + 124 + titleOffset);

    // Altın İnce Ayırıcı Çizgi
    const divY = topPad + 148 + titleOffset;
    const divGrad = ctx.createLinearGradient(rightX, divY, rightX + rightW, divY);
    divGrad.addColorStop(0, 'rgba(212, 175, 55, 0.8)');
    divGrad.addColorStop(0.7, 'rgba(212, 175, 55, 0.2)');
    divGrad.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rightX, divY);
    ctx.lineTo(rightX + rightW, divY);
    ctx.stroke();

    // (D) Madde Başlığı
    ctx.fillStyle = '#FDE68A';
    ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '1px';
    ctx.fillText('📌 ÖNE ÇIKAN ÖZELLİKLER', rightX, divY + 34);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
    ctx.restore();

    // (E) MADDE MADDE LÜKS KARTLAR (5-6 Adet)
    const specs = extractProductSpecsList(product);
    const cardStartY = divY + 52;
    const cardH = 68;
    const cardGap = 11;
    const maxCards = 5;

    specs.slice(0, maxCards).forEach((item, idx) => {
      const cy = cardStartY + idx * (cardH + cardGap);

      ctx.save();
      // Kart Gövdesi (Glassmorphism Koyu Panel)
      ctx.fillStyle = 'rgba(18, 24, 34, 0.82)';
      roundRect(ctx, rightX, cy, rightW, cardH, 12, true, false);

      // Kart İnce Bordürü
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
      ctx.lineWidth = 1.2;
      roundRect(ctx, rightX, cy, rightW, cardH, 12, false, true);

      // Sol İkon Dairesi
      const iconCircleX = rightX + 28;
      const iconCircleY = cy + cardH / 2;
      ctx.fillStyle = 'rgba(212, 175, 55, 0.12)';
      ctx.beginPath();
      ctx.arc(iconCircleX, iconCircleY, 20, 0, Math.PI * 2);
      ctx.fill();

      // Emoji İkon
      ctx.font = '20px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.icon, iconCircleX, iconCircleY + 7);

      // Kart Başlığı & Açıklaması
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(item.title, rightX + 58, cy + 28);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 13.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(item.desc, rightX + 58, cy + 50);

      ctx.restore();
    });

    // (F) ALT BÖLÜM: BÜYÜK ALTIN CTA BUTONU
    const ctaY = topPad + photoBoxH - 124;
    const ctaH = 80;

    ctx.save();
    // Buton Gövdesi
    const btnGrad = ctx.createLinearGradient(rightX, ctaY, rightX + rightW, ctaY);
    btnGrad.addColorStop(0, '#0F131D');
    btnGrad.addColorStop(1, '#1A2130');
    ctx.fillStyle = btnGrad;
    roundRect(ctx, rightX, ctaY, rightW, ctaH, 16, true, false);

    // Parlak Altın Çerçeve
    const goldBrd = ctx.createLinearGradient(rightX, ctaY, rightX + rightW, ctaY);
    goldBrd.addColorStop(0, '#D4AF37');
    goldBrd.addColorStop(0.5, '#FDE68A');
    goldBrd.addColorStop(1, '#D4AF37');
    ctx.strokeStyle = goldBrd;
    ctx.lineWidth = 2.5;
    roundRect(ctx, rightX, ctaY, rightW, ctaH, 16, false, true);

    // Buton İçi Yazısı
    ctx.fillStyle = '#FDE68A';
    ctx.font = '800 19px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💬 Yoruma "FİYAT" Yazın', rightX + rightW / 2, ctaY + 34);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('WhatsApp & DM: 0 (505) 015 1035', rightX + rightW / 2, ctaY + 58);

    // Buton altı ek bilgilendirme
    ctx.fillStyle = '#64748B';
    ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Katalog ve Net Fiyat DM Kutunuza Gönderilsin ✨', rightX + rightW / 2, ctaY + 102);
    ctx.restore();

    ctx.restore();
  }

  /**
   * FORMAT 3: HİKAYE / STORY POSTU (1080x1920 Dikey Story)
   * ========================================================
   * - ÜST: Marka ve Başlık.
   * - ORTA: Mimari odada seated mobilya fotoğrafı (büyük kadraj).
   * - ALT: 4 adet lüks özellik hap kartı (MDF, Membran, Raylar, Ölçüler).
   * - EN ALT: Instagram Story DM ve WhatsApp sticker tarzı etkileşimli buton.
   */
  function drawNovaStoryPost(canvas, {
    product = {},
    productImageEl = null,
    zoomScale = 1.0,
    panX = 0,
    panY = 0,
    fullRes = true
  } = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const targetW = 1080;
    const targetH = 1920;
    const W = fullRes ? targetW : 540;
    const H = fullRes ? targetH : 960;
    const scale = W / targetW;

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    ctx.save();
    ctx.scale(scale, scale);

    const rawTitle = (product.title || product.baslik || 'ZÜRİH YATAK ODASI').trim();
    const displayTitle = rawTitle.replace(/^NOVA\s*[-–—:]*\s*/i, '').toUpperCase();
    const subCategory = product.kategori || '1. Sınıf MDF • CNC Membran Kapak';

    // 1. ZEMİN VE ARKA PLAN
    const bgGrad = ctx.createLinearGradient(0, 0, 0, targetH);
    bgGrad.addColorStop(0, '#06080C');
    bgGrad.addColorStop(0.3, '#0D1117');
    bgGrad.addColorStop(0.7, '#0A0D14');
    bgGrad.addColorStop(1, '#050709');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, targetW, targetH);

    // 2. ÜST MARKA VE KOLEKSİYON BAŞLIĞI
    ctx.save();
    ctx.fillStyle = '#D4AF37';
    ctx.font = '800 24px "Plus Jakarta Sans", serif';
    ctx.textAlign = 'center';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '7px';
    ctx.fillText('NOVA FURNITURE', targetW / 2, 100);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 40px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`NOVA - ${displayTitle}`, targetW / 2, 156);

    ctx.fillStyle = '#E6C687';
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subCategory, targetW / 2, 198);
    ctx.restore();

    // 3. ORTA BÖLÜM: MİMARİ ODADA SEATED MOBİLYA FOTOĞRAFI
    const photoX = 48;
    const photoY = 236;
    const photoW = targetW - 96;
    const photoH = 880;

    ctx.save();
    roundRect(ctx, photoX, photoY, photoW, photoH, 20, false, false);
    ctx.clip();

    composeSeatedProduct(ctx, productImageEl, photoX, photoY, photoW, photoH, {
      zoomScale: zoomScale * 1.04,
      panX,
      panY,
      floorRatio: 0.70
    });

    ctx.restore(); // clip kapat

    // Fotoğraf etrafına parlak altın çerçeve ve rozetler
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.65)';
    ctx.lineWidth = 3;
    roundRect(ctx, photoX, photoY, photoW, photoH, 20, false, true);

    drawGoldCapsuleBadge(ctx, photoX + 24, photoY + 24, 250, 44, '👑 ÖZEL MİMARİ SERİ');
    drawGoldCapsuleBadge(ctx, photoX + 24, photoY + photoH - 68, 270, 44, '✨ 1. SINIF İŞÇİLİK');
    ctx.restore();

    // 4. ALT BÖLÜM: MADDE MADDE ÖZELLİK KARTLARI
    const specs = extractProductSpecsList(product);
    const specStartY = photoY + photoH + 34;
    const specCardW = targetW - 96;
    const specCardH = 74;
    const specGap = 12;

    ctx.save();
    ctx.fillStyle = '#FDE68A';
    ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✨ ÜRÜN DETAYLARI & ÖNE ÇIKANLAR', photoX + 8, specStartY - 10);
    ctx.restore();

    specs.slice(0, 4).forEach((item, idx) => {
      const sy = specStartY + 8 + idx * (specCardH + specGap);

      ctx.save();
      ctx.fillStyle = 'rgba(16, 22, 32, 0.85)';
      roundRect(ctx, photoX, sy, specCardW, specCardH, 14, true, false);

      ctx.strokeStyle = 'rgba(212, 175, 55, 0.32)';
      ctx.lineWidth = 1.4;
      roundRect(ctx, photoX, sy, specCardW, specCardH, 14, false, true);

      // İkon
      ctx.font = '24px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.icon, photoX + 42, sy + specCardH / 2 + 8);

      // Başlık ve Açıklama
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(item.title, photoX + 78, sy + 30);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(item.desc, photoX + 78, sy + 54);

      ctx.restore();
    });

    // 5. EN ALT: INSTAGRAM STORY STICKER BUTONU
    const ctaY = targetH - 220;
    const ctaH = 100;
    const ctaW = targetW - 96;

    ctx.save();
    // Buton Gövdesi
    ctx.fillStyle = '#0F1420';
    roundRect(ctx, photoX, ctaY, ctaW, ctaH, ctaH / 2, true, false);

    // Parlak Altın Çerçeve
    const goldBrd = ctx.createLinearGradient(photoX, ctaY, photoX + ctaW, ctaY);
    goldBrd.addColorStop(0, '#B8860B');
    goldBrd.addColorStop(0.5, '#FDE68A');
    goldBrd.addColorStop(1, '#B8860B');
    ctx.strokeStyle = goldBrd;
    ctx.lineWidth = 3.5;
    roundRect(ctx, photoX, ctaY, ctaW, ctaH, ctaH / 2, false, true);

    // Buton Yazısı
    ctx.fillStyle = '#FDE68A';
    ctx.font = '900 24px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💬 FİYAT İÇİN DM ATIN VEYA YAZIN', targetW / 2, ctaY + 44);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 17px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('📲 WhatsApp: 0 (505) 015 1035', targetW / 2, ctaY + 74);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('👆 Fiyat ve detaylar anında DM kutunuza gelsin', targetW / 2, ctaY + 140);
    ctx.restore();

    ctx.restore();
  }

  /**
   * FORMAT 1: REELS POSTERİ & VİDEO ÇERÇEVESİ (1080x1920 Dikey)
   * - composeSeatedProduct ile mimari odaya kusursuz oturtulur.
   * - Ken Burns animasyonu ve video kaydı için kullanılır.
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

    // 2. ORTA BÖLÜM: ÜRÜN GÖRSELİNİN ODA ATMOSFERİYLE TAMAMLANMASI
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
    roundRect(ctx, photoX, photoY, photoW, photoH, 16, false, false);
    ctx.clip();

    // Seated Mobilya & Mimari Oda
    composeSeatedProduct(ctx, productImageEl, photoX, photoY, photoW, photoH, {
      zoomScale,
      panX,
      panY,
      floorRatio: 0.70
    });

    ctx.restore(); // frame clip kapat

    // Fotoğrafın etrafındaki altın çerçeve
    ctx.save();
    ctx.strokeStyle = 'rgba(217, 160, 91, 0.55)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, photoX, photoY, photoW, photoH, 16, false, true);
    ctx.restore();

    // 3. ÜST BÖLÜM: MARKA VE KOLEKSİYON BAŞLIĞI
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
    ctx.fillStyle = '#D4AF37';
    ctx.font = '800 24px "Plus Jakarta Sans", serif';
    ctx.textAlign = 'center';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '7px';
    ctx.fillText(brand, targetW / 2, isVertical ? 128 : 82);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
    ctx.restore();

    // Koleksiyon Adı
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 ${isVertical ? 40 : 34}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(displayTitle, targetW / 2, isVertical ? 188 : 130);
    ctx.restore();

    // Alt Başlık
    ctx.save();
    ctx.fillStyle = '#E6C687';
    ctx.font = '600 21px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(subCategory, targetW / 2, isVertical ? 234 : 168);
    ctx.restore();

    // Prestij Rozetleri
    if (isVertical) {
      const pillW = 280;
      const pillH = 46;
      const pillX = 40;
      drawGoldCapsuleBadge(ctx, pillX, 268, pillW, pillH, '🪵 1. KALİTE MALZEME');
      drawGoldCapsuleBadge(ctx, pillX, 328, pillW, pillH, '✨ 1. SINIF İŞÇİLİK');
    }

    // 4. ALT BÖLÜM: BÜYÜK ALTIN CTA BUTONU
    const ctaW = targetW - 160;
    const ctaH = isVertical ? 96 : 84;
    const ctaX = 80;
    const ctaY = isVertical ? 1540 : 910;

    ctx.save();
    ctx.fillStyle = '#0E1118';
    roundRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2, true, false);

    const goldBorder = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY);
    goldBorder.addColorStop(0, '#B8860B');
    goldBorder.addColorStop(0.5, '#FDE68A');
    goldBorder.addColorStop(1, '#B8860B');
    ctx.strokeStyle = goldBorder;
    ctx.lineWidth = 3.5;
    roundRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2, false, true);

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
    ctx.fillStyle = 'rgba(14, 17, 24, 0.88)';
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
  function animateKenBurns(canvas, imgEl, product, isVertical = true, onFrame = null) {
    let animId = null;
    let startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
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
   * Canlı Canvas'ı MediaRecorder ile gerçek MP4 videoya kaydeder.
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

        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            const dest = audioCtx.createMediaStreamDestination();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            gain.gain.value = 0.0001;
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
          const zoomScale = 1.00 + 0.08 * (0.5 - 0.5 * Math.cos(progress * Math.PI));
          const panY = -12 * (0.5 - 0.5 * Math.cos(progress * Math.PI));

          drawNovaLuxuryPoster(recCanvas, {
            productImageEl: imgEl,
            product,
            isVertical,
            zoomScale,
            panX: 0,
            panY,
            fullRes: true
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
    extractProductSpecsList,
    generateNovaLuxuryCaption,
    generateGeminiLuxuryCaption,
    synthesizeArchitecturalRoom,
    composeSeatedProduct,
    drawNovaSplitSpecPost,
    drawNovaStoryPost,
    drawNovaLuxuryPoster,
    animateKenBurns,
    recordCanvasVideo
  };
}));

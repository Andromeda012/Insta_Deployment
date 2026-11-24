(function () {
  const ANASAYFA_V2 = {
    hero: {
      eyebrow: 'İstanbul Atölyeden Mimari Yaşam Alanları',
      baslik_1: 'Zamansız Formlar,',
      baslik_highlight: 'Sıcak',
      baslik_2: 'Yaşam Alanları',
      alt_yazi: 'Kahve köşesi koleksiyonlarından modüler dolap sistemlerine, portmanto ve şifonyerlere kadar her parçayı mekânınızın oranlarına göre üretiyoruz.',
      cta1_text: 'Koleksiyonları Keşfet →',
      cta1_link: 'koleksiyon.html?kategori=Kahve%20K%C3%B6%C5%9Fesi%20Koleksiyonlar%C4%B1',
      cta2_text: 'Bağımsız Ürünler Merkezi',
      cta2_link: 'galeri.html#sectionBagimsiz',
      carousel_interval_ms: 5200,
      slides: [
        { image_url: 'resim/showroom/hero_marsilya.jpg', caption: 'Sahne 1: Marsilya Kahve Köşesi' },
        { image_url: 'resim/showroom/hero_bergamo.jpg', caption: 'Sahne 2: Bergamo Vitrin Serisi' },
        { image_url: 'resim/showroom/hero_dolap.jpg', caption: 'Sahne 3: Modüler Dolap Sistemleri' },
        { image_url: 'resim/showroom/hero_portmanto.jpg', caption: 'Sahne 4: Portmanto ve Şifonyerler' },
        { image_url: 'resim/showroom/hero_atolye.jpg', caption: 'Sahne 5: Atölye ve Zanaat Süreci' }
      ]
    },
    marquee: {
      duration_ms: 34000,
      items: [
        'Kahve Köşesi Koleksiyonları',
        'Dolap Koleksiyonları',
        'Yatak Odası Koleksiyonları',
        'Bağımsız Ürünler Sunum Merkezi',
        'Ölçüye Özel Atölye Üretimi'
      ]
    },
    categories_section: {
      kicker: 'Koleksiyon Mimarisi',
      title_prefix: 'Üç Ana',
      title_highlight: 'Koleksiyon',
      title_suffix: 'Dünyası',
      lead: 'Tüm tasarımlarımızı kullanım ritmine göre üç alt kategoriye ayırdık. Panellerin üzerine gelerek her dünyanın canlı seri sayısını ve atmosferini inceleyebilirsiniz.',
      panels: [
        {
          key: 'kahve',
          category: 'Kahve Köşesi Koleksiyonları',
          title: 'Kahve Köşesi Koleksiyonları',
          desc: 'Salon, yemek alanı ve nişler için tasarlanan zarif bar tezgâhları, açık raf kurguları ve gizli depolamalı kahve köşeleri.',
          image_url: 'resim/showroom/hero_marsilya.jpg'
        },
        {
          key: 'dolap',
          category: 'Dolap Koleksiyonları',
          title: 'Dolap Koleksiyonları',
          desc: 'Giyinme odası ve antre düzenini mimari cepheye dönüştüren çoklu gardırop ve şifonyer kombinasyonları.',
          image_url: 'resim/showroom/hero_dolap.jpg'
        },
        {
          key: 'yatak',
          category: 'Yatak Odası Koleksiyonları',
          title: 'Yatak Odası Koleksiyonları',
          desc: 'Başlık, komodin ve tam boy dolaplarla bütüncül dinginlik kuran uyku ve dinlenme mekânları.',
          image_url: 'resim/showroom/hero_portmanto.jpg'
        }
      ]
    },
    atelier_about: {
      image_url: 'resim/yonetilen/atelier-craft.jpg',
      badge_title: '15+ Yıl Zanaat',
      badge_sub: '2.000 m² İstanbul Üretim Atölyesi',
      kicker: 'Malzeme, Form Felsefesi & Hakkımızda',
      title_prefix: 'Atölyeden Yaşama',
      title_highlight: 'Dengeli',
      title_suffix: 'Oranlar',
      story: 'Global Mobilya olarak, 15 yılı aşkın deneyime sahip uzman kadromuzla İstanbul Bağcılar’daki 2.000 m² modern atölyemizde kahve köşesi koleksiyonları, modüler dolap sistemleri ve yatak odası mobilyaları üretiyoruz. Her tasarımı standart kalıplara sığdırmak yerine mekânınızın ışık açısına ve doğal doku beklentinize göre ince işçilikle şekillendiriyoruz.',
      pillars: [
        { title: 'Sıcak Ahşap & Mat Doku', desc: 'Doğal meşe, ceviz ve kum taşı yüzeylerle yıllarca eskimeyen sakin paletler.' },
        { title: 'Sessiz Mekanizma', desc: 'Ağır yük taşıyan çekmecelerde ve raylarda yüksek ömürlü yavaş kapanan donanım.' },
        { title: 'Ölçüye Özel Mimari', desc: 'Seçtiğiniz seriyi evinizin niş, duvar ve tavan ölçüsüne birebir uyarlama olanağı.' },
        { title: 'Doğrudan Üretici Güvencesi', desc: 'Aracısız, İstanbul Bağcılar atölyemizden şeffaf fiyat ve montaj koordinasyonu.' }
      ]
    },
    stats_band: [
      { target: 15, prefix: '', suffix: '+', format: '', display: '15+', label: 'Yıl Sektör Deneyimi' },
      { target: 2000, prefix: '', suffix: ' m²', format: 'dot', display: '2.000 m²', label: 'Modern Üretim Atölyesi' },
      { target: 5, prefix: '', suffix: ' Yıl', format: '', display: '5 Yıl', label: 'Üretici Garantisi' },
      { target: 100, prefix: '%', suffix: '', format: '', display: '%100', label: 'Özel Ölçü & Memnuniyet' }
    ],
    principles: {
      eyebrow: 'İlkelerimiz & Standartlar',
      title_prefix: 'Çalışma ve Zanaat',
      title_highlight: 'İlkelerimiz.',
      lead: 'Her koleksiyonumuzda taviz vermediğimiz kalite, hassas mühendislik ve güven prensipleri.',
      cards: [
        { title: 'Tavizsiz Kalite', desc: '1. sınıf doğal kaplama yüzeyler, sağlam gövde birleşimleri ve sessiz frenli ray sistemleri.' },
        { title: 'Güven ve Sorumluluk', desc: '15 yılı aşkın köklü sektör birikimi, 5 yıl üretici garantisi ve şeffaf müşteri iletişimi.' },
        { title: 'Hız ve Hassasiyet', desc: 'Modern işleme parkurumuzla planlı üretim takvimi ve Türkiye geneli korumalı sevkiyat.' },
        { title: 'Yüksek Hassasiyetli CNC', desc: 'Milimetrik kesim ve gönye birleşim teknolojisiyle dolap ve nişlerde sıfır boşluk uyumu.' },
        { title: 'Doğal Yüzey & Mat Cila', desc: 'Doğal meşe, ceviz kaplama ve düşük yansımalı mat lake yüzeylerle dokunsal cepheler.' },
        { title: 'E1 Çevre Dostu Gövde', desc: 'İnsan sağlığına dost, düşük emisyonlu 1. sınıf ahşap esaslı gövde malzemeleriyle uzun ömür.' }
      ]
    },
    mission_vision: {
      kicker: 'Kurumsal Perspektif',
      title_prefix: 'Misyonumuz &',
      title_highlight: 'Vizyonumuz',
      lead: 'Sürdürülebilir malzeme seçimi ve özgün mimari çizgimizle yaşam alanlarınıza kalıcı değer katıyoruz.',
      mission_tag: '01 · Misyonumuz',
      mission_title: 'Ulaşılabilir Mimari Zanaat',
      mission_text: 'Müşterilerimize özgün kahve köşesi, dolap ve yatak odası mobilya tasarımlarını, doğrudan üretici kalitesi ve planlı teslimat güvencesiyle sunarak yaşam alanlarına değer katmak. Sürdürülebilir üretim ilkelerimizle uzun ömürlü bir zanaat mirası bırakmak.',
      vision_tag: '02 · Vizyonumuz',
      vision_title: 'Özgün Koleksiyonların Referans Atölyesi',
      vision_text: "Türkiye'nin önde gelen mimari mobilya üreticilerinden biri olarak; tasarım, malzeme kalitesi ve özgün koleksiyon yaklaşımıyla modern yaşam alanlarına yön vermek. Kahve köşesinden dolap ve yatak odasına uzanan serilerimizle uzun soluklu bir marka vizyonu taşımak."
    },
    nature_section: {
      kicker: '🌱 Sürdürülebilir Üretim & Yaşam Manifestosu',
      title_prefix: 'Doğayı Seviyoruz,',
      title_highlight: 'Geleceği',
      title_suffix: 'İşliyoruz.',
      lead: 'Ürettiğimiz her kahve köşesi, dolap ve portmanto tasarımında yalnızca zamansız çizgiyi değil, ekosistemin dengesini de koruyoruz. E1 sertifikalı çevre dostu gövdeler ve su bazlı cilalarla gelecek nesillere nefes alan yaşam alanları bırakıyoruz.',
      pillars: [
        { title: '🌿 E1 & FSC Sertifikalı Gövde', desc: 'Düşük emisyonlu, yönetilebilir orman kaynaklarından elde edilen 1. sınıf ahşap esaslı yapılar.' },
        { title: '💧 Su Bazlı Ekolojik Cila', desc: 'Çözücü oranı minimize edilmiş, insan sağlığına ve doğaya saygılı uzun ömürlü mat kaplamalar.' },
        { title: '♻️ Sıfır İsraf Kesim & Paket', desc: 'Akıllı CNC plaka optimizasyonu ile en düşük atık oranı ve geri dönüştürülebilir korumalı ambalaj.' }
      ]
    },
    partners_section: {
      eyebrow: 'Tedarikçilerimiz',
      title_prefix: 'Güvenilir Tedarik &',
      title_highlight: 'İş Ortakları.',
      lead: 'Koleksiyonlarımızın kalitesini belirleyen ahşap gövde, doğal kaplama, sessiz donanım ve korumalı sevkiyat iş ortaklarımızla uzun soluklu iş birlikleri yürütüyoruz.'
    },
    blogs_section: {
      eyebrow: 'Bloglar & Rehber',
      title_prefix: 'Atölyeden Yazılar &',
      title_highlight: 'Tasarım',
      title_suffix: 'Rehberi.',
      lead: 'Ev içi kahve istasyonu kurgusundan modüler dolap ergonomi önerilerine, ahşap bakımından doğal renk uyumlarına uzanan güncel yazılarımız.',
      cta_text: 'Tüm Yazıları Gör →'
    },
    gallery_promo: {
      kicker: 'Sunum Merkezi',
      title_prefix: 'Galeri &',
      title_highlight: 'Bağımsız',
      title_suffix: 'Ürünler',
      lead: 'Galeri sayfamızı hem tüm koleksiyonları bir arada sergileyen vitrin hem de konsol, dresuar, sehpa ve tekil parçalar için bağımsız sunum merkezi olarak kurguladık.',
      left_kicker: 'Bağımsız Ürünler Vitrini',
      left_title: 'Tekil Parçalar & Özel Modüller',
      left_desc: 'Koleksiyonlardan bağımsız olarak tek başına sipariş edilebilen tamamlayıcı mobilyalar burada sunulur.',
      left_btn: 'Sunum Merkezine Git →',
      right_image: 'resim/anasayfa-resimleri/warm-hero.jpg',
      right_kicker: 'Kürasyon & Atmosfer',
      right_title: 'Koleksiyon Kareleri',
      right_desc: 'Kahve köşesi, dolap ve oda kombinasyonlarının yaşam alanındaki yansımalarını galeri merkezinde karşılaştırın.',
      right_btn: 'Tüm Galeriyi İncele →'
    },
    quick_quote: {
      kicker: 'Mimari Danışmanlık',
      title_prefix: 'Eviniz İçin',
      title_highlight: 'Özel',
      title_suffix: 'Ölçü & Teklif',
      lead: 'Beğendiğiniz koleksiyonu evinizin duvar ölçüsüne göre uyarlamak veya bağımsız bir parça için üretici fiyatı almak isterseniz ölçü notunuzu bırakın; atölye ekibimiz aynı gün dönüş yapsın.',
      wa_btn_text: 'WhatsApp ile Hızlı Sor →',
      contact_btn_text: 'Showroom Adres & İletişim'
    },
    video: {
      aktif: false,
      otomatik_oynat: false,
      baslik: '2.000 m² Modern Fabrika & Yüksek Hassasiyetli CNC Üretim Hattımız',
      aciklama: 'Hammadde seçiminden ince işçilik ve kuruluma kadar üretim sürecimizi keşfedin.',
      video_url: '',
      harici_url: ''
    }
  };

  const KOLEKSIYON_SAYFASI = {
    category_intros: {
      'Kahve Köşesi Koleksiyonları': {
        kicker: 'Mimari Kahve Köşesi Vitrini',
        title_prefix: 'Kahve Köşesi',
        title_em: 'Koleksiyonları',
        desc: 'Dünyanın farklı mimari esintilerinden ilham alan; sıcak iç aydınlatmalı vitrinleri ve ergonomik barista tezgâhlarıyla her mekâna özgün kimlik katan kahve köşesi serilerimizi keşfedin.',
        cta_label: 'Gezmeye Başla',
        aurora: { base: '#16110D', c1: '#F59E0B', c2: '#0EA5E9', c3: '#FACC15', c4: '#EA580C', accent: '#E2B761' }
      },
      'Dolap Koleksiyonları': {
        kicker: 'Sistematik Depolama Mimarisi',
        title_prefix: 'Dolap',
        title_em: 'Koleksiyonları',
        desc: 'Zeminden tavana milimetrik uyum sağlayan gövde birleşimleri, sessiz donanımlar ve mekânın oranlarına göre şekillenen modüler dolap serilerimizi keşfedin.',
        cta_label: 'Gezmeye Başla',
        aurora: { base: '#0A1924', c1: '#38BDF8', c2: '#EAB308', c3: '#10B981', c4: '#6366F1', accent: '#7DD3FC' }
      },
      'Yatak Odası Koleksiyonları': {
        kicker: 'Özel Uyku & Giyinme Kurguları',
        title_prefix: 'Yatak Odası',
        title_em: 'Koleksiyonları',
        desc: 'Yatak odanızın ölçülerine ve doğal doku tercihlerinize özel tasarlanan gardırop, karyola ve komodin serilerimiz yakında bu kategoride vitrine çıkıyor.',
        cta_label: 'Gezmeye Başla',
        aurora: { base: '#1A1120', c1: '#A855F7', c2: '#F59E0B', c3: '#EC4899', c4: '#14B8A6', accent: '#F0ABFC' }
      }
    }
  };

  const WORLD_PRESETS = {
    bergamo: {
      city: 'BERGAMO',
      country: 'İTALYA',
      coords: '45.6983° K, 9.6773° D',
      aurora: { base: '#231309', c1: '#F59E0B', c2: '#EA580C', c3: '#FBBF24', c4: '#B45309', accent: '#F6C86E' },
      swatches: ['#543C24', '#8E765E', '#CC9C3C', '#E4DAD0'],
      scene_config: {
        id: 'bergamo-interactive-scene-v4',
        stageAspectRatio: '1024 / 571',
        background: { src: '/hero/bg.jpg', alt: 'Bergamo Kahve Köşesi Tuğla ve Sıva Duvarlı Showroom Mekânı', initialScale: 1.05, targetScale: 1.0, entranceDurationSec: 1.5 },
        finalMaster: { src: '/hero/bergamo-final.jpg', alt: 'Bergamo Kahve Köşesi Tam Kompozit Stüdyo Sahnesi', revealDelaySec: 1.48, fadeDurationSec: 0.56 },
        modules: [
          { id: 'bergamo-orta-sol', pieceSlugHint: 'orta-kahve-kosesi', src: '/hero/bergamo-sol-drop.png', alt: 'Bergamo Orta Boy Tek Vitrinli Kahve Köşesi Modülü', leftPct: 16.80, bottomPct: 13.13, widthPct: 21.48, heightPct: 70.23, aspectRatio: '220 / 401', zIndex: 21, entranceY: -210, entranceDelaySec: 0.04, entranceDurationSec: 0.88, eyebrow: 'Tek Vitrinli Modül', label: 'Orta Boy Modül', dimensions: '120 / 200 / 45', link: 'urun.html?id=bergamo-kahve-kosesi-61kf-orta-kahve-kosesi-2' },
          { id: 'bergamo-kucuk-merkez', pieceSlugHint: 'kucuk-kahve-kosesi', src: '/hero/bergamo-orta-drop.png', alt: 'Bergamo Küçük Boy Kahve Köşesi Modülü', leftPct: 41.60, bottomPct: 13.13, widthPct: 17.77, heightPct: 70.23, aspectRatio: '182 / 401', zIndex: 22, entranceY: -210, entranceDelaySec: 0.04, entranceDurationSec: 0.88, eyebrow: 'Kompakt İstasyon', label: 'Küçük Boy Modül', dimensions: '80 / 200 / 45', link: 'urun.html?id=bergamo-kahve-kosesi-61kf-kucuk-kahve-kosesi-1' },
          { id: 'bergamo-buyuk-sag', pieceSlugHint: 'buyuk-kahve-kosesi', src: '/hero/bergamo-sag-drop.png', alt: 'Bergamo Büyük Boy Çift Vitrinli Kahve Köşesi Modülü', leftPct: 62.79, bottomPct: 13.13, widthPct: 30.66, heightPct: 70.23, aspectRatio: '314 / 401', zIndex: 23, entranceY: -210, entranceDelaySec: 0.04, entranceDurationSec: 0.88, eyebrow: 'Çift Vitrinli Amiral', label: 'Büyük Boy Modül', dimensions: '160 / 200 / 45', link: 'urun.html?id=bergamo-kahve-kosesi-61kf-buyuk-kahve-kosesi-3' }
        ],
        decors: [
          { id: 'bergamo-dekor-sol', src: '/hero/dekor-sol.png', alt: 'Ön Plan Bar Masası ve Metal Tabure Dekoru', side: 'left', leftPct: 0, bottomPct: 0, widthPct: 22.13, aspectRatio: '609 / 613', zIndex: 31, entranceX: -115, entranceDelaySec: 0.88, entranceDurationSec: 0.58 },
          { id: 'bergamo-dekor-sag', src: '/hero/dekor-sag.png', alt: 'Ön Plan Deri Berjer ve Kahve Sehpası Dekoru', side: 'right', rightPct: 0, bottomPct: 0, widthPct: 17.22, aspectRatio: '474 / 569', zIndex: 32, entranceX: 115, entranceDelaySec: 0.88, entranceDurationSec: 0.58 }
        ]
      }
    },
    lahey: { city: 'LAHEY', country: 'HOLLANDA', coords: '52.0705° K, 4.3007° D', aurora: { base: '#0B241D', c1: '#10B981', c2: '#FACC15', c3: '#06B6D4', c4: '#84CC16', accent: '#9AE6B4' }, swatches: ['#6C6C54', '#84846C', '#CCB484', '#EFE9DF'] },
    marsilya: { city: 'MARSİLYA', country: 'FRANSA', coords: '43.2965° K, 5.3698° D', aurora: { base: '#081F37', c1: '#0EA5E9', c2: '#FACC15', c3: '#2563EB', c4: '#FBBF24', accent: '#FDE047' }, swatches: ['#1E88E5', '#FACC15', '#6C543C', '#F3EFEA'] },
    palermo: { city: 'PALERMO', country: 'SİCİLYA / İTALYA', coords: '38.1157° K, 13.3615° D', aurora: { base: '#281014', c1: '#F97316', c2: '#FBBF24', c3: '#14B8A6', c4: '#F43F5E', accent: '#FDBA74' }, swatches: ['#6C543C', '#B49C84', '#CC843C', '#E9DFD7'] },
    toronto: { city: 'TORONTO', country: 'KANADA', coords: '43.6532° K, 79.3832° B', aurora: { base: '#0A162B', c1: '#3B82F6', c2: '#06B6D4', c3: '#EAB308', c4: '#8B5CF6', accent: '#93C5FD' }, swatches: ['#543C3C', '#848484', '#B4B4B4', '#B48424'] },
    troyes: { city: 'TROYES', country: 'FRANSA', coords: '48.2973° K, 4.0744° D', aurora: { base: '#270D19', c1: '#E11D48', c2: '#F59E0B', c3: '#D946EF', c4: '#EA580C', accent: '#FDA4AF' }, swatches: ['#3C2424', '#6C543C', '#9C5424', '#B48454'] },
    bohem: { city: 'BOHEM ATÖLYE', country: 'EGE & AKDENİZ', coords: '38.4237° K, 27.1428° D', aurora: { base: '#231024', c1: '#EC4899', c2: '#14B8A6', c3: '#F59E0B', c4: '#A855F7', accent: '#F9A8D4' }, swatches: ['#242424', '#543C3C', '#6C5454', '#B49C9C'] },
    fallback: { city: 'İSTANBUL ATÖLYE', country: 'TÜRKİYE', coords: '41.0082° K, 28.9784° D', aurora: { base: '#0E1C26', c1: '#0EA5E9', c2: '#F59E0B', c3: '#10B981', c4: '#8B5CF6', accent: '#DFC793' }, swatches: ['#3D352E', '#5E7462', '#C5A059', '#F0ECE4'] }
  };

  const GALERI_SAYFASI = {
    hero: {
      image_url: 'resim/showroom/hero_portmanto.jpg',
      kicker: 'Bağımsız Ürünler Sunum Merkezi',
      title_prefix: 'Tekil Tasarım',
      title_em: 'Modülleri',
      desc: 'Kahve köşeleri, tekil dolaplar, antre portmantoları ve yatak odası şifonyerlerini mekânınıza özel ölçülerle bağımsız olarak inceler ve sipariş verebilirsiniz.'
    },
    showcases: {
      'Kahve Köşeleri': {
        kicker: 'Tekil İkram İstasyonları',
        title: 'Kahve Köşeleri',
        title_em: 'Kahve Köşeleri',
        title_prefix: 'Tekil',
        desc: 'Koleksiyon setine bağlı kalmadan, tek bir duvar veya mutfak nişine uyarlanan aydınlatmalı vitrinli, gizli priz ve kablo geçişli solo barista istasyonları.',
        img: 'resim/showroom/hero_marsilya.jpg',
        specs: [
          ['Genişlik Seçenekleri', '80 cm · 120 cm · 160 cm veya Özel Ölçü'],
          ['Gövde & Tezgâh', '1. Sınıf E1 Gövde, Doğal Meşe / Ceviz & Mat Lake'],
          ['Özel Donanım', 'Gizli Kablo Kanalı, Fincan Askılığı & Soft-Close Ray']
        ],
        configs: [
          { dim: 'Kompakt Niş · 80–100 cm', title: 'Minimal Tekil Bar', desc: 'Dar mutfak köşeleri ve ofis odaları için tek gövdeli espresso & kupa modülü.' },
          { dim: 'Dengeli Hacim · 120 cm', title: 'Vitrinli Kahve İstasyonu', desc: 'Üst cam teşhir dolabı ve alt çekmeceli servis tezgâhını birleştiren solo kurgu.' },
          { dim: 'Geniş Duvar · 160+ cm', title: 'Çift Yönlü Barista Alanı', desc: 'Yan boy kiler dolabı eklenebilen ferah ikram ve saklama modülü.' }
        ]
      },
      'Dolaplar': {
        kicker: 'Modüler Gardırop & Depolama',
        title: 'Dolaplar',
        title_prefix: 'Özel Ölçü',
        title_em: 'Dolaplar',
        desc: 'Giyinme odası, koridor nişi veya yatak odası duvarınıza milimetrik oturan; fluted camlı, çıtalı ahşap ya da düz mat lake kapaklı bağımsız dolap sistemleri.',
        img: 'resim/showroom/hero_dolap.jpg',
        specs: [
          ['Ölçü & Yükseklik', '200 cm – Tavan Boy Özel İmalat (Milimetrik Niş Uyumu)'],
          ['İç Düzenleme', 'Sensörlü LED Askılık, Pantolonluk & Bölümlü Çekmece'],
          ['Kapak Seçenekleri', 'Mat Lake, Doğal Meşe Fluted & Bronz Reflekte Cam']
        ],
        configs: [
          { dim: 'Tekil Modül · 90 cm', title: 'Cam Vitrinli Boy Dolap', desc: 'Oda nişlerini değerlendiren sensörlü iç aydınlatmalı dikey gardırop birimi.' },
          { dim: 'Çift Kanat · 140–180 cm', title: 'Çıtalı Ahşap & Lake Dolap', desc: 'Dikey oluklu ahşap yüzeylerle sakin ve sıcak yatak odası dolap kurgusu.' },
          { dim: 'Tam Cephe · 240+ cm', title: 'Giyinme Alanı Duvarı', desc: 'Tavana kadar kesintisiz depolama ve orta ada ile bütünleşen mimari çözüm.' }
        ]
      },
      'Portmantolar': {
        kicker: 'Giriş Holü & Karşılama Mimarisi',
        title: 'Portmantolar',
        title_prefix: 'Antre &',
        title_em: 'Portmantolar',
        desc: 'Ev veya ofis girişlerinde ilk izlenimi kuran; dikey ahşap çıtalı paneller, entegre oturma bankı, yuvarlak hatlı ayna ve gizli ayakkabılık içeren bağımsız portmantolar.',
        img: 'resim/showroom/hero_portmanto.jpg',
        specs: [
          ['Derinlik Opsiyonu', 'Dar Antre (35 cm) veya Standart Derinlik (42–48 cm)'],
          ['İşlevsel Parçalar', 'Oturma Bankı, Gizli Ayakkabı Çekmecesi & Boy Aynası'],
          ['Detay İşçiliği', 'Fırçalı Pirinç Askılık, Masif Çıta & Mat Lake Dolap']
        ],
        configs: [
          { dim: 'Dar Koridor · 90–110 cm', title: 'Compact Ayna & Banklı Ünite', desc: 'Dar antre geçişlerini daraltmayan ince derinlikli karşılama portmantosu.' },
          { dim: 'Standart Antre · 140 cm', title: 'Çıtalı Oturma Köşeli Portmanto', desc: 'Açık palto askılığı, döşemeli bank ve kapalı ayakkabı bölmeli tasarım.' },
          { dim: 'Geniş Hol · 180+ cm', title: 'Tam Boy Vestiyer Ünitesi', desc: 'Valiz ve mevsimlik giysiler için yüksek depolamalı bağımsız vestiyer.' }
        ]
      },
      'Şifonyerler': {
        kicker: 'Yatak Odası & Tamamlayıcı Saklama',
        title: 'Şifonyerler',
        title_prefix: 'Doğal Ahşap',
        title_em: 'Şifonyerler',
        desc: 'Doğal ceviz ve meşe dokusunu pürüzsüz mat çekmece önleriyle dengeleyen; ayna üstü, gardırop yanı veya giyinme adası olarak bağımsız kullanılan şifonyer tasarımları.',
        img: 'resim/showroom/hero_portmanto.jpg',
        specs: [
          ['Çekmece Düzeni', '3, 4, 6 veya Çift Sıralı Gizli Frenli Raylı Çekmeceler'],
          ['Üst Tabla Malzemesi', 'Doğal Ahşap Kaplama, Traverten veya Çizilmez Mat Lake'],
          ['Genişlik Alternatifi', '80 cm Dikey Yüksek veya 140–160 cm Yatay Geniş Form']
        ],
        configs: [
          { dim: 'Dikey Yüksek · 70–85 cm', title: 'Yüksek Boy Çekmeceli Şifonyer', desc: 'Küçük yatak odalarında taban alanından tasarruf sağlayan 5 çekmeceli yapı.' },
          { dim: 'Yatay Geniş · 130 cm', title: 'Çift Sıralı Konsol Şifonyer', desc: 'Takı düzenleyici üst çekmece ve geniş tekstil depolama hacmi.' },
          { dim: 'Giyinme Adası · 150 cm', title: 'İki Yönlü Orta Şifonyer', desc: 'Giyinme odalarının merkezinde sergi üstü ve derin çekmeceli modül.' }
        ]
      }
    }
  };

  const ILETISIM_SAYFASI = {
    hero: {
      image_url: 'resim/showroom/hero_atolye.jpg',
      eyebrow: '✦ Direkt Üretici ile İletişim',
      title_prefix: 'Doğrudan Atölyemizden',
      title_em: 'Fiyat Teklifi',
      title_suffix: 'Alın',
      desc: 'İstanbul Bağcılar atölyemizde doğal kaplama gövde kalitesi ve özel ölçü mimarisiyle kahve köşesi, dolap, portmanto ve yatak odası çözümleri sunuyoruz.',
      form_pill_text: 'Hızlı Teklif Formu ↓',
      map_pill_text: 'Fabrika Harita Konumu ↓'
    },
    tiles: {
      tel_tag: 'Doğrudan Hat',
      tel_title: 'Telefon Hattı',
      tel_note: 'Hafta içi 08:30 – 19:00 arası atölye danışmanlığı',
      wa_tag: 'Hızlı Yanıt',
      wa_title: 'WhatsApp Danışma',
      wa_note: 'Anlık ölçü paylaşımı ve görsel model önizlemesi',
      email_tag: 'Proje Dosyası',
      email_title: 'Kurumsal E-posta',
      email_note: 'Mimari proje, CAD ölçüsü ve toplu teklif talepleri'
    },
    dossier: {
      tag: 'FABRİKA & ATÖLYE SHOWROOM',
      title_prefix: 'Bizi Ziyaret Edin veya',
      title_em: 'Bilgi Alın',
      lead: "İstanbul Bağcılar'daki 2.000 m² modern üretim atölyemize gelerek kahve köşesi koleksiyonlarımızı, dolap kurgularımızı, yüzey kartelalarımızı ve bağımsız tasarım parçalarımızı yerinde inceleyebilirsiniz.",
      capacity_title: 'Üretim Kapasitesi & Garanti',
      capacity_val: '2.000 m² CNC Hatları · 5 Yıl Kapsamlı Üretici Garantisi',
      speed_title: 'Üretim & Teslimat Hızı',
      speed_val: 'Planlı Atölye Takvimi · Türkiye Geneli Korumalı Sevkiyat',
      hours: [
        { day: 'Pazartesi – Cuma', val: '08:30 – 19:00', closed: false },
        { day: 'Cumartesi', val: '09:00 – 16:00', closed: false },
        { day: 'Pazar', val: 'Kapalı', closed: true }
      ]
    },
    form: {
      tag: 'ÜRETİCİ FİYAT TEKLİFİ',
      title: 'Mimari Fiyat & Teklif Formu',
      subtitle: 'Formu doldurarak projeniz veya beğendiğiniz koleksiyon için 2 saat içinde doğrudan üretici fiyatı alın.',
      subjects: [
        { value: 'Kahve Köşesi Koleksiyonları', label: 'Kahve Köşesi Koleksiyonları — Özel Ölçü' },
        { value: 'Dolap Koleksiyonları', label: 'Dolap Koleksiyonları — Özel Ölçü' },
        { value: 'Yatak Odası Koleksiyonları', label: 'Yatak Odası Koleksiyonları — Özel Tasarım' },
        { value: 'Bağımsız Ürün Talebi', label: 'Bağımsız Ürünler (Portmanto / Şifonyer / Tekil Dolap)' },
        { value: 'Diğer Genel Danışma', label: 'Diğer / Genel Soru' }
      ]
    },
    faq: {
      tag: 'SIKÇA SORULAN SORULAR',
      title_prefix: 'Merak Edilen',
      title_em: 'Detaylar',
      items: [
        { q: '✦ Teslimat süreniz kaç gündür?', a: 'Sipariş ve ölçü onayınızın ardından tüm mobilya modülleri Bağcılar atölyemizde planlı üretim takvimine alınır ve çok katmanlı korumalı ambalajlarla Türkiye geneli sevkiyata hazır hale getirilir.' },
        { q: '✦ Üretici garantiniz neleri kapsar?', a: '1. sınıf E1 ahşap gövde sağlamlığı, doğal yüzey bütünlüğü ve kullanılan yüksek taşıma kapasiteli sessiz frenli ray/menteşe mekanizmaları 5 yıl birebir üretici garantimiz altındadır.' },
        { q: '✦ Özel ölçüye göre kahve köşesi, dolap veya portmanto üretimi yapıyor musunuz?', a: 'Evet. Kendi 2.000 m² CNC işleme ve üretim atölyemize sahip olduğumuz için oda ölçülerinize, tavan yüksekliğinize ve duvar nişlerinize göre milimetrik özel ölçü imalatı yapıyoruz.' }
      ]
    },
    map: {
      kicker: 'İSTANBUL BAĞCILAR ÜRETİM MERKEZİ',
      title_prefix: 'Fabrika & Atölye',
      title_em: 'Konumumuz',
      cta_text: "Google Haritalar'da Yol Tarifi Al →",
      address_label: 'Yalçın Koreş Cad. Bağlar Mah. No:6B Bağcılar / İSTANBUL',
      hours_summary: 'Hafta İçi 08:30 – 19:00 · Cumartesi 09:00 – 16:00',
      query: 'Yalçın Koreş Cad. Bağlar Mah. No:6B Bağcılar İstanbul',
      custom_embed_url: '',
      custom_directions_url: ''
    }
  };

  const GENEL_DEFAULT = {
    firma: {
      logo: 'resim/logo.png',
      ad: 'Global Mobilya',
      slogan: 'Yaşam Alanları İçin Mimari Mobilya',
      tagline: 'Estetik, sıcak ve uzun ömürlü tasarımlar'
    },
    iletisim: {
      telefon: '0 (505) 015 1035',
      whatsapp: '905050151035',
      email: 'info@globalkapakmobilya.com',
      adres: 'Yalçın Koreş Cad. Bağlar Mah. No:6B Bağcılar / İstanbul',
      calisma_saatleri: 'Pzt - Cmt: 08:00 – 18:00'
    },
    sosyal_medya: {
      instagram: 'https://instagram.com',
      facebook: 'https://facebook.com',
      twitter: '',
      linkedin: '',
      youtube: ''
    },
    nav_cta: { yazi: 'Teklif Al', link: '/koleksiyon.html' },
    topbar: { metin: '✦ Kahve Köşesi & Dolap Koleksiyonları | 🛠️ Ölçüye Özel Atölye Üretimi | 🚛 Türkiye Geneli Güvenli Sevkiyat', aktif: true },
    footer: {
      cta_tag: '✦ MİMARİ PROJE & ÖZEL ÖLÇÜ İMALAT',
      cta_title: 'Hayalinizdeki Yaşam Alanını Birlikte Üretelim',
      cta_desc: '2.000 m² modern üretim tesisimizde, projenize özel ölçü ve ahşap dokusu seçenekleriyle 5 iş gününde teslimat.',
      cta_btn_text: 'Hemen Teklif Alın →',
      tanitim_metni: 'Yüksek işçilik standartları, E1 sertifikalı ahşap gövdeler ve modern mimari tasarım anlayışıyla mekanlarınıza zamansız estetik katıyoruz.',
      badge_1: '🛡️ 5 Yıl Garanti',
      badge_2: '🌿 Doğa Dostu Üretim',
      badge_3: '⚡ 5 İş Günü Teslimat',
      alt_metin: '© 2026 Global Mobilya — Tüm hakları saklıdır.',
      craft_note: 'İstanbul Fabrika İmalatı • %100 Yerli & Doğa Dostu Üretim'
    }
  };

  const HAKKIMIZDA_DEFAULT = {
    hero: { tag: 'BİZ KİMİZ', baslik: 'Hakkımızda', alt_yazi: 'Yaşam alanları için özgün mobilya tasarımı' },
    ana_metin: {
      tag: 'ATÖLYEMİZ HAKKINDA',
      baslik_1: 'Global Mobilya',
      baslik_2: 'Mimari Mobilya Atölyesi',
      paragraf_1: 'Global Mobilya, sektörde 15 yılı aşkın deneyime sahip uzman kadrosuyla kahve köşesi, dolap ve yatak odası mobilyaları üreten tasarım odaklı bir atölyedir.',
      paragraf_2: 'Müşteri memnuniyetini merkeze alarak her parçada malzeme kalitesi, ergonomi ve estetiği bir arada sunuyoruz.'
    },
    misyon_vizyon: {
      misyon_baslik: 'Misyonumuz',
      misyon_metin: 'Müşterilerimize özgün kahve köşesi, dolap ve yaşam alanı mobilyalarını doğrudan atölye kalitesi ve şeffaf teklif süreciyle sunmak.',
      vizyon_baslik: 'Vizyonumuz',
      vizyon_metin: "Türkiye'nin önde gelen ve mimari çizgisiyle tercih edilen özgün mobilya atölyelerinden biri olmak."
    },
    rakamlar: [
      { sayi: '15+', etiket: 'Yıl Deneyim' },
      { sayi: '2.000+', etiket: 'm² Modern Atölye' },
      { sayi: '5 Yıl', etiket: 'Üretici Garantisi' },
      { sayi: '%100', etiket: 'Müşteri Memnuniyeti' }
    ]
  };

  window.M1_DEFAULTS = {
    WEB_ORIGIN: 'https://beta.globalkapakmobilya.com',
    ANASAYFA_V2,
    KOLEKSIYON_SAYFASI,
    WORLD_PRESETS,
    GALERI_SAYFASI,
    ILETISIM_SAYFASI,
    GENEL_DEFAULT,
    HAKKIMIZDA_DEFAULT
  };
})();

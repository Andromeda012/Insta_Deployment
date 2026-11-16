/**
 * GLOBAL MOBİLYA — 1 HAFTALIK INSTAGRAM & FACEBOOK YAYIN PLANI (17 - 23 KASIM 2026)
 * ============================================================================
 * Bu script, 17-23 Kasım 2026 tarihleri arasındaki 19 adet doğrulanmış
 * sosyal medya görevini Supabase 'social_publish_queue' tablosuna
 * deterministik ve idempotent olarak kaydeder.
 * ============================================================================
 */
// Load environment variables
try { process.loadEnvFile('.env.local'); } catch (e) {}

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY eksik!');
  process.exit(1);
}

async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { ok: res.ok, status: res.status, data: json };
}

export const SEVEN_DAY_SCHEDULE = [
  // ── GÜN 1: 17 KASIM 2026 (PAZARTESİ) — VİYANA YATAK ODASI KOLEKSİYONU ──────
  {
    platform: 'instagram',
    content_type: 'POST',
    slot_label: '17_KASIM_IG_VIYANA_POST',
    product_slug: 'viyana-yatak-odasi-rs83',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana-yatak-odasi-rs83-1794005456481.png',
    caption: 'Viyana Yatak Odası Koleksiyonu | Dingin ve Modern Yaşam Alanı\n\nSade hatların lüks detaylarla harmanlandığı Viyana Koleksiyonu; yatak başlığı, 6 kapılı dolap, komodin ve makyaj masası uyumuyla yatak odanıza ferah ve zarif bir atmosfer kazandırır.',
    hashtags: '#GlobalMobilya #ViyanaKoleksiyonu #YatakOdası #ModernTasarım #İçMimar #MobilyaTasarımı',
    target_link: 'https://globalmobilya.com/koleksiyon/viyana-yatak-odasi',
    scheduled_for_istanbul: '2026-11-17T10:00:00+03:00',
    idempotency_key: 'idemp-20261117-ig-viyana-post'
  },
  {
    platform: 'instagram',
    content_type: 'STORIES',
    slot_label: '17_KASIM_IG_VIYANA_STORY',
    product_slug: 'viyana-yatak-odasi-rs83',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana-yatak-odasi-rs83-1794005456481.png',
    caption: 'Viyana Yatak Odası Koleksiyonunu Keşfedin\n\nDetaylar ve modüler parçalar için profildeki linke göz atabilirsiniz.',
    hashtags: '#GlobalMobilya #YatakOdası #StoryTasarım',
    target_link: 'https://globalmobilya.com/koleksiyon/viyana-yatak-odasi',
    scheduled_for_istanbul: '2026-11-17T14:00:00+03:00',
    idempotency_key: 'idemp-20261117-ig-viyana-story'
  },
  {
    platform: 'facebook',
    content_type: 'PHOTO_POST',
    slot_label: '17_KASIM_FB_VIYANA_POST',
    product_slug: 'viyana-yatak-odasi-rs83',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana-yatak-odasi-rs83-1794005456481.png',
    caption: 'Viyana Yatak Odası Koleksiyonu — Evinizde Çağdaş Bir Esinti\n\nEvinize dinginlik ve şıklık getiren Viyana Yatak Odası Takımı, geniş depolama hacmi ve zarif renk uyumuyla konforlu bir yaşam alanı sunuyor. Koleksiyonumuz hakkında detaylı bilgi almak için sayfamızdan bize ulaşabilirsiniz.',
    hashtags: '#GlobalMobilya #ViyanaYatakOdası #EvDekorasyonu #ModernMobilya #KonforluYaşam',
    target_link: 'https://globalmobilya.com/koleksiyon/viyana-yatak-odasi',
    scheduled_for_istanbul: '2026-11-17T18:30:00+03:00',
    idempotency_key: 'idemp-20261117-fb-viyana-post'
  },

  // ── GÜN 2: 18 KASIM 2026 (SALI) — BAHAR PORTMANTO ─────────────────────────
  {
    platform: 'instagram',
    content_type: 'POST',
    slot_label: '18_KASIM_IG_BAHAR_POST',
    product_slug: 'bahar-portmanto-i6el',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/bahar-portmanto-ymz9.png',
    caption: 'Bahar Portmanto | Antrenizde Düzen ve Şıklık\n\nAntrenizi düzenli ve davetkar kılan Bahar Portmanto; geniş askılık alanı, raflı ayakkabılık bölmesi ve aynalı kapak yapısıyla giriş alanınıza hem derinlik hem de fonksiyonellik katıyor.',
    hashtags: '#GlobalMobilya #BaharPortmanto #AntreDekorasyonu #Portmanto #DüzenliEvler #DekorasyonÖnerileri',
    target_link: 'https://globalmobilya.com/urun/bahar-portmanto',
    scheduled_for_istanbul: '2026-11-18T11:00:00+03:00',
    idempotency_key: 'idemp-20261118-ig-bahar-post'
  },
  {
    platform: 'facebook',
    content_type: 'PHOTO_POST',
    slot_label: '18_KASIM_FB_BAHAR_POST',
    product_slug: 'bahar-portmanto-i6el',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/bahar-portmanto-ymz9.png',
    caption: 'Bahar Portmanto ile Karşılamada Şık Detaylar\n\nGiriş alanları evinizin ilk izlenimidir. Bahar Portmanto, fonksiyonel depolama çözümleri ve estetik görünümüyle antrenizi kusursuz bir şekilde tamamlar. Ceviz ve beyaz renk alternatifleriyle evinize uyum sağlar.',
    hashtags: '#GlobalMobilya #PortmantoTasarımı #AntreMobilyası #EvModası #BaharKoleksiyonu',
    target_link: 'https://globalmobilya.com/urun/bahar-portmanto',
    scheduled_for_istanbul: '2026-11-18T17:00:00+03:00',
    idempotency_key: 'idemp-20261118-fb-bahar-post'
  },

  // ── GÜN 3: 19 KASIM 2026 (ÇARŞAMBA) — VİYANA GARDIROP DETAYLARI ───────────
  {
    platform: 'instagram',
    content_type: 'POST',
    slot_label: '19_KASIM_IG_VIYANA_DOLAP_POST',
    product_slug: 'viyana-yatak-odasi-rs83-wardrobe-2',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana-yatak-odasi-rs83-wardrobe-2-1794005461822.png',
    caption: 'Viyana 6 Kapılı Dolap | Geniş İç Hacim & Akıllı Bölmeler\n\nKıyafetlerinize düzen getiren Viyana Gardırop; 6 kapaklı geniş gövdesi, raf düzeni ve frenli ray/menteşe donanımıyla günlük kullanımda sessiz ve ergonomik bir deneyim sunar.',
    hashtags: '#GlobalMobilya #ViyanaGardırop #DolapTasarımı #GardıropDüzeni #YatakOdasıMobilyası #DepolamaÇözümleri',
    target_link: 'https://globalmobilya.com/urun/viyana-dolap',
    scheduled_for_istanbul: '2026-11-19T10:30:00+03:00',
    idempotency_key: 'idemp-20261119-ig-viyana-dolap-post'
  },
  {
    platform: 'instagram',
    content_type: 'STORIES',
    slot_label: '19_KASIM_IG_VIYANA_DOLAP_STORY',
    product_slug: 'viyana-yatak-odasi-rs83-wardrobe-2',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana-yatak-odasi-rs83-wardrobe-2-1794005461822.png',
    caption: 'Viyana Gardırop Detayları\n\nGeniş hacim, modern kulp tasarımı ve fonksiyonel iç bölmeler. Tüm giysileriniz için ideal düzen.',
    hashtags: '#GlobalMobilya #Gardırop #Storyİlham',
    target_link: 'https://globalmobilya.com/urun/viyana-dolap',
    scheduled_for_istanbul: '2026-11-19T15:30:00+03:00',
    idempotency_key: 'idemp-20261119-ig-viyana-dolap-story'
  },
  {
    platform: 'facebook',
    content_type: 'PHOTO_POST',
    slot_label: '19_KASIM_FB_VIYANA_DOLAP_POST',
    product_slug: 'viyana-yatak-odasi-rs83-wardrobe-2',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana-yatak-odasi-rs83-wardrobe-2-1794005461822.png',
    caption: 'Düzenli Bir Gardırop, Huzurlu Bir Yatak Odası\n\nViyana 6 Kapılı Dolap, fonksiyonel iç dizaynı ve estetik dış tasarımıyla tüm giysileriniz için ferah bir depolama alanı sağlıyor. Kaliteli malzeme yapısı ve zarif kapak tasarımıyla uzun yıllar konfor sunmak için tasarlandı.',
    hashtags: '#GlobalMobilya #GardıropModelleri #YatakOdasıDekorasyonu #GenişDepolama #MobilyaFikirleri',
    target_link: 'https://globalmobilya.com/urun/viyana-dolap',
    scheduled_for_istanbul: '2026-11-19T19:00:00+03:00',
    idempotency_key: 'idemp-20261119-fb-viyana-dolap-post'
  },

  // ── GÜN 4: 20 KASIM 2026 (PERŞEMBE) — RENK VE YÜZEY SEÇENEKLERİ ───────────
  {
    platform: 'instagram',
    content_type: 'POST',
    slot_label: '20_KASIM_IG_RENK_YUZEY_POST',
    product_slug: 'porto-portmanto-56jk',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/porto-portmanto-56jk-1793451341659.png',
    caption: 'Yaşam Alanınıza Özel Yüzey ve Doku Seçenekleri\n\nMobilyada doku ve renk uyumu, mekanın karakterini belirler. Ceviz, Beyaz ve Aytaşı yüzey alternatifleriyle Global Mobilya tasarımları, farklı dekorasyon stillerine kusursuz uyum sağlar.',
    hashtags: '#GlobalMobilya #RenkSeçenekleri #YüzeyTasarımı #MobilyaMalzeme #İçMekan #TasarımDetayları',
    target_link: 'https://globalmobilya.com/renkler-ve-yuzeyler',
    scheduled_for_istanbul: '2026-11-20T11:30:00+03:00',
    idempotency_key: 'idemp-20261120-ig-renk-yuzey-post'
  },
  {
    platform: 'facebook',
    content_type: 'PHOTO_POST',
    slot_label: '20_KASIM_FB_RENK_YUZEY_POST',
    product_slug: 'porto-portmanto-56jk',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/porto-portmanto-56jk-1793451341659.png',
    caption: 'Evinizin Işığına Göre Renk ve Yüzey Tercihleri\n\nMobilya seçiminde doğru renk seçimi odanın aydınlığını ve genişliğini doğrudan etkiler. Doğal ahşap sıcaklığı arayanlar için ceviz dokular, aydınlık ve ferahlık isteyenler için aytaşı ve mat beyaz seçeneklerimiz koleksiyonlarımızda sizleri bekliyor.',
    hashtags: '#GlobalMobilya #RenkUyumu #EvDekorasyonRehberi #AhşapDoku #PortmantoModelleri',
    target_link: 'https://globalmobilya.com/renkler-ve-yuzeyler',
    scheduled_for_istanbul: '2026-11-20T17:30:00+03:00',
    idempotency_key: 'idemp-20261120-fb-renk-yuzey-post'
  },
  {
    platform: 'facebook',
    content_type: 'LINK_CARD',
    slot_label: '20_KASIM_FB_KATALOG_LINK',
    product_slug: 'bahar-portmanto-i6el',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/bahar-portmanto-ymz9.png',
    caption: 'Global Mobilya 2026 Koleksiyonlarını Keşfedin\n\nYeni sezon portmanto ve yatak odası koleksiyonlarımızı, detaylı ölçü tablolarını ve malzeme özelliklerini web sitemiz üzerinden inceleyebilirsiniz.',
    hashtags: '#GlobalMobilya #Katalog #MobilyaAlışverişi #EvDekorasyonu',
    target_link: 'https://globalmobilya.com/katalog',
    scheduled_for_istanbul: '2026-11-20T20:30:00+03:00',
    idempotency_key: 'idemp-20261120-fb-katalog-link'
  },

  // ── GÜN 5: 21 KASIM 2026 (CUMA) — PORTO PORTMANTO ─────────────────────────
  {
    platform: 'instagram',
    content_type: 'POST',
    slot_label: '21_KASIM_IG_PORTO_POST',
    product_slug: 'porto-portmanto-56jk',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/porto-portmanto-56jk-1793451341659.png',
    caption: 'Porto Portmanto | Aytaşı Tonlarının Dingin Şıklığı\n\nMinimalist çizgileri ve Aytaşı renginin dingin zarafetini giriş alanınıza taşıyan Porto Portmanto; yüksek ayak formu sayesinde robot süpürge kullanımına uygun, pratik ve modern bir tasarım sunar.',
    hashtags: '#GlobalMobilya #PortoPortmanto #MinimalistTasarım #AytaşıRengi #AntreFikirleri #ModernMobilya',
    target_link: 'https://globalmobilya.com/urun/porto-portmanto',
    scheduled_for_istanbul: '2026-11-21T10:00:00+03:00',
    idempotency_key: 'idemp-20261121-ig-porto-post'
  },
  {
    platform: 'facebook',
    content_type: 'PHOTO_POST',
    slot_label: '21_KASIM_FB_PORTO_POST',
    product_slug: 'porto-portmanto-56jk',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/porto-portmanto-56jk-1793451341659.png',
    caption: 'Porto Portmanto — Minimalizmin ve Fonksiyonun Buluşması\n\nZarif aytaşı tonu ve modern kapak detaylarıyla Porto Portmanto, evinizin antre bölümünde sade ve sofistike bir atmosfer yaratıyor. Yüksek ayakları temizlik kolaylığı sağlarken, geniş iç rafları ayakkabı ve aksesuarlarınız için ideal alan sunar.',
    hashtags: '#GlobalMobilya #PortoSerisi #AntreDekorasyonu #PratikMobilya #EvGirişi',
    target_link: 'https://globalmobilya.com/urun/porto-portmanto',
    scheduled_for_istanbul: '2026-11-21T18:00:00+03:00',
    idempotency_key: 'idemp-20261121-fb-porto-post'
  },

  // ── GÜN 6: 22 KASIM 2026 (CUMARTESİ) — VİYANA MAKYAJ MASASI VE KOMODİN ────
  {
    platform: 'instagram',
    content_type: 'POST',
    slot_label: '22_KASIM_IG_VIYANA_VANITY_POST',
    product_slug: 'viyana-yatak-odasi-rs83-vanity-4',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana-yatak-odasi-rs83-vanity-4-1794005465772.png',
    caption: 'Viyana Makyaj Masası | Zarif ve Fonksiyonel Kişisel Alan\n\nGeniş aynası, mücevher ve kozmetik eşyalarınız için özel çekmece bölmeleriyle Viyana Makyaj Masası, güne başlarken ihtiyacınız olan konforu ve şıklığı bir arada sunar.',
    hashtags: '#GlobalMobilya #ViyanaMakyajMasası #MakyajMasası #YatakOdasıDetayı #ZarifTasarım #KişiselBakımAlanı',
    target_link: 'https://globalmobilya.com/urun/viyana-vanity',
    scheduled_for_istanbul: '2026-11-22T11:00:00+03:00',
    idempotency_key: 'idemp-20261122-ig-viyana-vanity-post'
  },
  {
    platform: 'instagram',
    content_type: 'STORIES',
    slot_label: '22_KASIM_IG_VIYANA_VANITY_STORY',
    product_slug: 'viyana-yatak-odasi-rs83-vanity-4',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana-yatak-odasi-rs83-vanity-4-1794005465772.png',
    caption: 'Viyana Makyaj Masası ile Tanışın\n\nAyna kalitesi, ergonomik çekmece düzeni ve şık ayak yapısı. Detaylar profilimizdeki linkte.',
    hashtags: '#GlobalMobilya #MakyajMasası #Story',
    target_link: 'https://globalmobilya.com/urun/viyana-vanity',
    scheduled_for_istanbul: '2026-11-22T16:00:00+03:00',
    idempotency_key: 'idemp-20261122-ig-viyana-vanity-story'
  },
  {
    platform: 'facebook',
    content_type: 'PHOTO_POST',
    slot_label: '22_KASIM_FB_VIYANA_VANITY_POST',
    product_slug: 'viyana-yatak-odasi-rs83-vanity-4',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana-yatak-odasi-rs83-vanity-4-1794005465772.png',
    caption: 'Yatak Odanızda Özel Bir Köşe: Viyana Makyaj Masası\n\nEstetik aynası ve düzenli çekmeceleriyle Viyana Makyaj Masası, yatak odanızın en özel ve kullanışlı köşesi olmaya aday. Günlük rutininize zarafet katmak için tasarlandı.',
    hashtags: '#GlobalMobilya #YatakOdasıTakımı #MakyajMasasıModelleri #KonforVeŞıklık #Haftasonuİlhamı',
    target_link: 'https://globalmobilya.com/urun/viyana-vanity',
    scheduled_for_istanbul: '2026-11-22T19:30:00+03:00',
    idempotency_key: 'idemp-20261122-fb-viyana-vanity-post'
  },

  // ── GÜN 7: 23 KASIM 2026 (PAZAR) — EREN PORTMANTO VE MARKA TANITIMI ────────
  {
    platform: 'instagram',
    content_type: 'POST',
    slot_label: '23_KASIM_IG_EREN_POST',
    product_slug: 'eren-portmanto-rzy4',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/eren-portmanto-rzy4-1793451458911.png',
    caption: 'Eren Portmanto | Çağdaş Tasarım, Güvenilir Kalite\n\nKompakt boyutlarına rağmen sunduğu zengin depolama kapasitesiyle Eren Portmanto, küçük ve orta ölçekli antreler için mükemmel bir çözüm. Global Mobilya işçiliği ve kalitesiyle üretildi.',
    hashtags: '#GlobalMobilya #ErenPortmanto #PortmantoModelleri #AntreTasarımı #KaliteliMobilya #EviniYenile',
    target_link: 'https://globalmobilya.com/urun/eren-portmanto',
    scheduled_for_istanbul: '2026-11-23T10:30:00+03:00',
    idempotency_key: 'idemp-20261123-ig-eren-post'
  },
  {
    platform: 'facebook',
    content_type: 'PHOTO_POST',
    slot_label: '23_KASIM_FB_EREN_POST',
    product_slug: 'eren-portmanto-rzy4',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/eren-portmanto-rzy4-1793451458911.png',
    caption: 'Eren Portmanto ile Giriş Alanınızda Akılcı Çözümler\n\nPratik askılık alanı, ayakkabılık rafları ve aynasıyla Eren Portmanto, antrenizin ihtiyacı olan her şeyi tek bir kompakt gövdede buluşturuyor. Global Mobilya güvencesiyle eviniz için en iyisini seçin.',
    hashtags: '#GlobalMobilya #ErenSerisi #PortmantoFikirleri #EvDekorasyonu #Pazarİlhamı',
    target_link: 'https://globalmobilya.com/urun/eren-portmanto',
    scheduled_for_istanbul: '2026-11-23T16:30:00+03:00',
    idempotency_key: 'idemp-20261123-fb-eren-post'
  },
  {
    platform: 'facebook',
    content_type: 'PHOTO_POST',
    slot_label: '23_KASIM_FB_MARKA_TANITIM_POST',
    product_slug: 'viyana-yatak-odasi-rs83',
    media_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana-yatak-odasi-rs83-1794005456481.png',
    caption: 'Global Mobilya: Yaşam Alanlarınıza Değer Katan Tasarımlar\n\nYatak odalarından antrelere, evinizin her köşesinde şıklığı, fonksiyonelliği ve dayanıklılığı buluşturan tasarımlarımızla yanınızdayız. Haftalık koleksiyon rehberimizi inceleyerek evinize en uygun mobilyayı keşfedin.',
    hashtags: '#GlobalMobilya #MobilyaKoleksiyonu #YaşamAlanı #EvTasarımı #KaliteliYaşam #HaftalıkÖzet',
    target_link: 'https://globalmobilya.com/katalog',
    scheduled_for_istanbul: '2026-11-23T20:00:00+03:00',
    idempotency_key: 'idemp-20261123-fb-marka-tanitim-post'
  }
];

export async function populateSchedule() {
  console.log(`[Populate] 7 Günlük Sosyal Medya Görevleri Hazırlanıyor (${SEVEN_DAY_SCHEDULE.length} Görev)...`);

  let insertedCount = 0;
  let existingCount = 0;

  for (const item of SEVEN_DAY_SCHEDULE) {
    const scheduledUtcIso = new Date(item.scheduled_for_istanbul).toISOString();

    const record = {
      platform: item.platform,
      content_type: item.content_type,
      slot_label: item.slot_label,
      product_slug: item.product_slug,
      media_url: item.media_url,
      caption: item.caption,
      hashtags: item.hashtags,
      target_link: item.target_link,
      status: 'pending',
      idempotency_key: item.idempotency_key,
      scheduled_for: scheduledUtcIso,
      retry_count: 0,
      max_retries: 3
    };

    // Idempotent insertion via PostgREST
    const res = await supabaseRequest('/rest/v1/social_publish_queue?on_conflict=idempotency_key', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=ignore-duplicates,return=representation'
      },
      body: JSON.stringify(record)
    });

    if (!res.ok) {
      if (res.status === 409) {
        existingCount++;
        console.log(`[Already Exists / Duplicate Protected] ${item.idempotency_key}`);
      } else {
        console.error(`[Error] ${item.idempotency_key}:`, res.status, res.data);
      }
    } else if (Array.isArray(res.data) && res.data.length > 0) {
      insertedCount++;
      console.log(`[Inserted] ${item.platform.toUpperCase()} (${item.slot_label}) -> ${scheduledUtcIso}`);
    } else {
      existingCount++;
      console.log(`[Already Exists / Ignored] ${item.idempotency_key}`);
    }
  }

  console.log(`\n[Tamamlandı] Toplam: ${SEVEN_DAY_SCHEDULE.length} | Yeni Eklenen: ${insertedCount} | Önceden Mevcut: ${existingCount}`);
  return { total: SEVEN_DAY_SCHEDULE.length, inserted: insertedCount, existing: existingCount };
}

// Direct execution
populateSchedule().catch(console.error);

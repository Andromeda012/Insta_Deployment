// js/modules/campaign-studio.js
// Global Mobilya — Yeni Kampanya Üretme Stüdyosu

export const CAMPAIGN_THEMES_INFO = {
  seasonal: {
    label: '❄️ Mevsimsel Kampanya',
    subOptions: [
      { id: 'winter', label: '❄️ Kış Sezonu', theme: 'Buz Mavisi & 24K Altın Kar Vurgusu', music: 'Modern Lo-Fi / Piyano' },
      { id: 'summer', label: '☀️ Yaz Sezonu', theme: 'Güneş Sarısı & Kumsal Beji', music: 'Sıcak Akustik' },
      { id: 'autumn', label: '🍂 Sonbahar', theme: 'Terra-Cotta & Altın Kahve', music: 'Modern Lo-Fi' },
      { id: 'spring', label: '🌸 İlkbahar', theme: 'Zümrüt Yeşili & Şampanya', music: 'Sıcak Akustik' }
    ]
  },
  special_occasions: {
    label: '🎁 Özel Gün / Bayram Kampanyaları',
    subOptions: [
      { id: 'new_year', label: '🎄 Yılbaşı', theme: 'Geceyarısı Bordo & Kristal Altın', music: 'Sinematik Yaylılar' },
      { id: 'wedding_season', label: '💍 Evlilik & Düğün Sezonu', theme: 'İnci Pembe & Şampanya', music: 'Piyano & Lüks Mimari' },
      { id: 'ramadan', label: '🌙 Ramazan Bayramı', theme: 'Zümrüt & Hilal Altın', music: 'Sinematik Yaylılar' },
      { id: 'eid', label: '🕌 Kurban Bayramı', theme: 'Derin Yeşil & Şenlik Altını', music: 'Sinematik Yaylılar' },
      { id: 'mothers_day', label: '💐 Anneler Günü', theme: 'Gül Kurusu & Sıcak Şampanya', music: 'Sıcak Akustik' }
    ]
  },
  discounts_deals: {
    label: '🏷️ İndirimler & Büyük Fırsatlar',
    subOptions: [
      { id: 'discounts_deals', label: '🏷️ Sezon Sonu / Büyük İndirim', theme: 'Dinamik Kırmızı & Altın', music: 'Dinamik Tasarım Ritmi' }
    ]
  },
  new_launch: {
    label: '🚀 Yeni Ürün / Sezon Lansmanı',
    subOptions: [
      { id: 'new_launch', label: '✨ Yeni Sezon Lansmanı', theme: 'Derin Antrasit & 24K Altın', music: 'Piyano & Lüks Mimari' }
    ]
  },
  brand_corporate: {
    label: '👑 Marka / Kurumsal Tanıtım',
    subOptions: [
      { id: 'brand_corporate', label: '👑 Global Mobilya Atelier', theme: 'Lüks Mimari Lacivert & Altın', music: 'Piyano & Lüks Mimari' }
    ]
  }
};

let cachedCatalog = { collections: [], products: [] };
let selectedMultiSlugs = new Set();

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const PIECE_SLUG_REGEX = /-(?:main-bed|wardrobe|nightstand|dresser|vanity|mirror|bed|dolap|komodin|parca|part)-\d+$/i;
const PIECE_SKU_REGEX = /-(?:P\d+|parca|piece)$/i;

function isPieceOfCollection(p, knownColSlugs = new Set()) {
  if (!p || !p.slug) return false;
  if (p.is_piece === true || p.product_type === 'collection_piece') return true;
  if (PIECE_SLUG_REGEX.test(p.slug) || (p.sku && PIECE_SKU_REGEX.test(p.sku))) return true;
  for (const cSlug of knownColSlugs) {
    if (p.slug.startsWith(cSlug + '-')) return true;
  }
  return false;
}

async function fetchCatalogData() {
  try {
    const [prodRes, colRes] = await Promise.all([
      fetch('/api/module7?action=products', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ products: [] })),
      fetch('/api/module7?action=collections', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ collections: [] }))
    ]);
    const prods = Array.isArray(prodRes.products) ? prodRes.products : [];
    const cols = Array.isArray(colRes.collections) ? colRes.collections : [];
    
    // Koleksiyonları belirle
    const rawCols = cols.length ? cols : prods.filter(p => p.product_type === 'collection' || (!isPieceOfCollection(p) && p.title?.toLowerCase().includes('koleksiyon')));
    const colSlugs = new Set(rawCols.map(c => c.slug));
    for (const p of prods) {
      if (PIECE_SLUG_REGEX.test(p.slug)) {
        colSlugs.add(p.slug.replace(PIECE_SLUG_REGEX, ''));
      }
    }

    // Koleksiyonları başlığa göre tekilleştir (mükerrer kayıtları engelle)
    const uniqueColsMap = new Map();
    for (const c of rawCols) {
      const baseKey = (c.title || c.slug).toLowerCase().trim();
      if (!uniqueColsMap.has(baseKey)) uniqueColsMap.set(baseKey, c);
    }
    if (uniqueColsMap.size === 0) {
      for (const p of prods) {
        if (!isPieceOfCollection(p, colSlugs) && (p.title?.toLowerCase().includes('viyana') || p.slug.includes('viyana'))) {
          uniqueColsMap.set('viyana', {
            slug: p.slug,
            title: p.title.includes('Koleksiyon') ? p.title : `${p.title} Koleksiyonu`,
            parts: prods.filter(x => PIECE_SLUG_REGEX.test(x.slug))
          });
          break;
        }
      }
    }

    // Bağımsız ürünler: Kesinlikle koleksiyon parçası OLMAYAN tekil ürünler
    const uniqueProdsMap = new Map();
    for (const p of prods) {
      if (p.product_type === 'collection' || colSlugs.has(p.slug)) continue;
      if (isPieceOfCollection(p, colSlugs)) continue;
      const key = (p.title || p.slug).toLowerCase().trim();
      if (!uniqueProdsMap.has(key)) {
        uniqueProdsMap.set(key, p);
      }
    }

    cachedCatalog = {
      collections: Array.from(uniqueColsMap.values()),
      products: Array.from(uniqueProdsMap.values())
    };
  } catch (err) {
    console.error('Katalog çekme hatası:', err);
  }
}

export function renderCampaignStudioModalHtml() {
  return `
    <div id="campaignStudioModal" class="campaign-modal-backdrop" style="display:none; position:fixed; inset:0; z-index:100010; background:rgba(3,7,18,0.85); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:16px;">
      <div class="campaign-modal-window" style="background:#0f172a; border:1px solid rgba(212,175,55,0.4); border-radius:18px; width:920px; max-width:100%; max-height:92vh; overflow-y:auto; box-shadow:0 25px 70px rgba(0,0,0,0.7); color:#f8fafc; display:flex; flex-direction:column;">
        
        <!-- MODAL HEADER -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid rgba(148,163,184,0.18); background:linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.8)); position:sticky; top:0; z-index:10;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:linear-gradient(135deg,#d4af37,#9b7220); color:#0b1120; font-size:20px; font-weight:900; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(212,175,55,0.35);">
              ✨
            </div>
            <div>
              <h2 style="font-size:18px; font-weight:800; color:#fff; letter-spacing:-0.2px; margin:0;">Yeni Kampanya Üretme Stüdyosu</h2>
              <p style="font-size:12px; color:#94a3b8; margin:2px 0 0;">4 Sosyal Medya Botu için Kampanyalı Carousel, Reels &amp; Story Üretim Paneli</p>
            </div>
          </div>
          <button type="button" onclick="window.closeCampaignStudioModal()" style="background:none; border:none; color:#94a3b8; font-size:26px; line-height:1; cursor:pointer; padding:4px 8px; border-radius:6px; transition:color .15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">&times;</button>
        </div>

        <!-- MODAL BODY -->
        <div style="padding:22px 24px; display:flex; flex-direction:column; gap:20px;">
          
          <!-- 1. AYAR: GÖNDERİ TÜRÜ -->
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(148,163,184,0.18); border-radius:14px; padding:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
              <label style="font-size:13px; font-weight:800; color:#fde68a; display:flex; align-items:center; gap:6px;">
                <span>1. GÖNDERİ TÜRÜ</span>
                <span style="font-size:10px; font-weight:600; color:#94a3b8;">(Üretim Kapsamı)</span>
              </label>
              <span style="font-size:11px; color:#38bdf8; font-weight:700;" id="cmpKindHelpBadge">Koleksiyona Özel Tam Kampanya</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px;" id="cmpKindSelectorGrid">
              <label class="cmp-kind-card active" data-kind="collection" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; border:1px solid rgba(212,175,55,0.5); background:rgba(212,175,55,0.12); cursor:pointer;">
                <input type="radio" name="cmp_kind" value="collection" checked style="accent-color:#d4af37;" onchange="window.onCampaignKindChange('collection')">
                <div>
                  <strong style="font-size:12.5px; color:#fff; display:block;">🏛️ Koleksiyon Gönderisi</strong>
                  <span style="font-size:10.5px; color:#94a3b8;">Tek bir koleksiyon için kapak + parçalar</span>
                </div>
              </label>
              <label class="cmp-kind-card" data-kind="independent" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; border:1px solid rgba(148,163,184,0.2); background:rgba(30,41,59,0.4); cursor:pointer;">
                <input type="radio" name="cmp_kind" value="independent" style="accent-color:#d4af37;" onchange="window.onCampaignKindChange('independent')">
                <div>
                  <strong style="font-size:12.5px; color:#fff; display:block;">🪑 Bağımsız Ürün Gönderisi</strong>
                  <span style="font-size:10.5px; color:#94a3b8;">Tekil ürün + 2 slaytlı kampanya</span>
                </div>
              </label>
              <label class="cmp-kind-card" data-kind="mixed_multi" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; border:1px solid rgba(148,163,184,0.2); background:rgba(30,41,59,0.4); cursor:pointer;">
                <input type="radio" name="cmp_kind" value="mixed_multi" style="accent-color:#d4af37;" onchange="window.onCampaignKindChange('mixed_multi')">
                <div>
                  <strong style="font-size:12.5px; color:#fff; display:block;">🔀 Karışık / Çoklu Gönderi</strong>
                  <span style="font-size:10.5px; color:#94a3b8;">Birden fazla ürün / koleksiyon seçimi</span>
                </div>
              </label>
            </div>
          </div>

          <!-- DİNAMİK ÜRÜN / KOLEKSİYON SEÇİCİ -->
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(148,163,184,0.18); border-radius:14px; padding:16px;" id="cmpProductSelectSection">
            <!-- TEKİL KOLEKSİYON SEÇİMİ -->
            <div id="cmpSelectBox_collection">
              <label style="font-size:12px; font-weight:800; color:#cbd5e1; display:block; margin-bottom:6px;">
                🏛️ KAMPANYAYA DAHİL EDİLECEK KOLEKSİYON:
              </label>
              <select id="cmpSingleCollectionSelect" class="form-control" style="width:100%; padding:10px; border-radius:8px; background:#090f1c; border:1px solid #334155; color:#f8fafc; font-size:13px;" onchange="window.onSingleCollectionSelected()">
                <option value="">Koleksiyon yükleniyor...</option>
              </select>
            </div>

            <!-- TEKİL BAĞIMSIZ ÜRÜN SEÇİMİ -->
            <div id="cmpSelectBox_independent" style="display:none;">
              <label style="font-size:12px; font-weight:800; color:#cbd5e1; display:block; margin-bottom:6px;">
                🪑 KAMPANYAYA DAHİL EDİLECEK BAĞIMSIZ ÜRÜN:
              </label>
              <select id="cmpSingleProductSelect" class="form-control" style="width:100%; padding:10px; border-radius:8px; background:#090f1c; border:1px solid #334155; color:#f8fafc; font-size:13px;" onchange="window.onSingleProductSelected()">
                <option value="">Ürün yükleniyor...</option>
              </select>
            </div>

            <!-- ÇOKLU / KARIŞIK SEÇİM -->
            <div id="cmpSelectBox_multi" style="display:none;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                <label style="font-size:12px; font-weight:800; color:#cbd5e1;">
                  🔀 KAMPANYAYA DAHİL EDİLECEK KOLEKSİYONLAR VE ÜRÜNLER (Çoklu Seçim):
                </label>
                <span id="cmpMultiCountBadge" style="font-size:11px; background:rgba(56,189,248,0.2); color:#38bdf8; padding:2px 8px; border-radius:99px; font-weight:700;">0 Seçildi</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div style="background:#090f1c; border:1px solid #334155; border-radius:8px; padding:10px; max-height:170px; overflow-y:auto;" id="cmpMultiColsList">
                  <strong style="font-size:11px; color:#d4af37; display:block; margin-bottom:6px;">🏛️ Koleksiyonlar:</strong>
                  <div id="cmpMultiColsItems" style="display:flex; flex-direction:column; gap:5px;"></div>
                </div>
                <div style="background:#090f1c; border:1px solid #334155; border-radius:8px; padding:10px; max-height:170px; overflow-y:auto;" id="cmpMultiProdsList">
                  <strong style="font-size:11px; color:#38bdf8; display:block; margin-bottom:6px;">🪑 Bağımsız Ürünler:</strong>
                  <div id="cmpMultiProdsItems" style="display:flex; flex-direction:column; gap:5px;"></div>
                </div>
              </div>
              <div id="cmpBridgeNotice" style="display:none; margin-top:8px; background:rgba(212,175,55,0.1); border:1px dashed rgba(212,175,55,0.4); border-radius:8px; padding:8px 12px; font-size:11px; color:#fde68a;">
                ℹ️ <strong>Otomatik Geçiş Slaytı Devrede:</strong> Hem koleksiyon hem bağımsız ürün seçildiği için, koleksiyonların bitiminde araya <em>"Kampanyaya dahil diğer ürünlerimiz için kaydırınız ➡️"</em> geçiş slaytı otomatik yerleştirilecektir.
              </div>
            </div>
          </div>

          <!-- 2. AYAR: KAMPANYA TÜRÜ VE ÖZEL GÜN / MEVSİM -->
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(148,163,184,0.18); border-radius:14px; padding:16px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:12px; font-weight:800; color:#fde68a; display:block; margin-bottom:6px;">
                  2. KAMPANYA TÜRÜ:
                </label>
                <select id="cmpTypeSelect" class="form-control" style="width:100%; padding:10px; border-radius:8px; background:#090f1c; border:1px solid #334155; color:#f8fafc; font-size:13px;" onchange="window.onCampaignTypeSelectChange()">
                  <option value="seasonal">❄️ Mevsimsel Kampanya</option>
                  <option value="special_occasions">🎁 Özel Gün / Bayram Kampanyaları</option>
                  <option value="discounts_deals">🏷️ İndirimler &amp; Büyük Fırsatlar</option>
                  <option value="new_launch">🚀 Yeni Ürün / Sezon Lansmanı</option>
                  <option value="brand_corporate">👑 Marka / Kurumsal Tanıtım</option>
                </select>
              </div>

              <!-- DİNAMİK ALT SEÇİM (MEVSİM VEYA ÖZEL GÜN) -->
              <div id="cmpSubOptionContainer">
                <label id="cmpSubOptionLabel" style="font-size:12px; font-weight:800; color:#cbd5e1; display:block; margin-bottom:6px;">
                  MEVSİM SEÇİMİ:
                </label>
                <select id="cmpSubOptionSelect" class="form-control" style="width:100%; padding:10px; border-radius:8px; background:#090f1c; border:1px solid #334155; color:#f8fafc; font-size:13px;" onchange="window.updateCampaignThemeInfo()">
                  <option value="winter">❄️ Kış Sezonu (Varsayılan)</option>
                  <option value="summer">☀️ Yaz Sezonu</option>
                  <option value="autumn">🍂 Sonbahar</option>
                  <option value="spring">🌸 İlkbahar</option>
                </select>
              </div>
            </div>

            <!-- TEMA & MÜZİK EŞLEŞME BİLGİSİ -->
            <div id="cmpThemeInfoBox" style="margin-top:12px; display:flex; align-items:center; justify-content:space-between; background:rgba(30,41,59,0.5); border-radius:8px; padding:8px 12px; font-size:11.5px; border:1px solid rgba(148,163,184,0.12);">
              <span id="cmpThemeColorPill" style="color:#38bdf8; font-weight:600;">🎨 Tema: Buz Mavisi &amp; 24K Altın Kar Vurgusu</span>
              <span id="cmpThemeMusicPill" style="color:#a7f3d0; font-weight:600;">🎵 Fon Müziği: Modern Lo-Fi / Piyano</span>
            </div>
          </div>

          <!-- 3. AYAR: YAYIN TARİHİ VE ÖNCELİKLİ KUŞAK SAATLERİ -->
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(148,163,184,0.18); border-radius:14px; padding:16px;">
            <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:12px;">
              <div>
                <label style="font-size:12px; font-weight:800; color:#fde68a; display:block; margin-bottom:6px;">
                  3. YAYIN TARİHİ:
                </label>
                <input type="date" id="cmpPublishDate" class="form-control" style="width:100%; padding:9px 12px; border-radius:8px; background:#090f1c; border:1px solid #334155; color:#f8fafc; font-size:13px; font-weight:700;">
                <span style="font-size:10.5px; color:#38bdf8; display:block; margin-top:4px;">
                  ⭐ <strong>Öncelik Kuralı:</strong> Bu tarihte normal katalog akışı durdurulur ve sadece bu kampanya yayınlanır.
                </span>
              </div>
              <div>
                <label style="font-size:12px; font-weight:800; color:#fde68a; display:block; margin-bottom:6px;">
                  YAYIN KUŞAĞI:
                </label>
                <select id="cmpPublishTimeSlot" class="form-control" style="width:100%; padding:9px 12px; border-radius:8px; background:#090f1c; border:1px solid #334155; color:#f8fafc; font-size:12.5px;">
                  <option value="all_slots" selected>🌟 Tüm Gün Kuşakları (10:00 + 14:30 + 19:30)</option>
                  <option value="10:00">🌅 Sabah Kuşağı (10:00)</option>
                  <option value="14:30">☀️ Öğleden Sonra Kuşağı (14:30)</option>
                  <option value="19:30">🌙 Akşam Kuşağı (19:30)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 4. AYAR: İNDİRİM MİKTARI & GEMINI METİN ÜRETİMİ -->
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(148,163,184,0.18); border-radius:14px; padding:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <label style="font-size:12px; font-weight:800; color:#fde68a;">
                4. İNDİRİM MİKTARI / KAMPANYA AVANTAJI:
              </label>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="btn-chip" onclick="window.setCmpDiscount('%20 İndirim')">%20</button>
                <button type="button" class="btn-chip" onclick="window.setCmpDiscount('%30 İndirim')">%30</button>
                <button type="button" class="btn-chip" onclick="window.setCmpDiscount('%40\'a Varan İndirim')">%40'a Varan</button>
                <button type="button" class="btn-chip" onclick="window.setCmpDiscount('%50\'ye Varan İndirim')">%50'ye Varan</button>
                <button type="button" class="btn-chip" onclick="window.setCmpDiscount('Lansmana Özel Fırsat')">Lansman</button>
              </div>
            </div>
            <input type="text" id="cmpDiscountInput" class="form-control" placeholder="Örn: %30 İndirim veya %40'a Varan Sezon Sonu Fırsatı" value="%30 İndirim" style="width:100%; padding:10px; border-radius:8px; background:#090f1c; border:1px solid #334155; color:#fde68a; font-weight:700; font-size:13px; margin-bottom:12px;">

            <!-- KAMPANYA BAŞLIĞI VE TANITIM CÜMLESİ -->
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
              <label style="font-size:12px; font-weight:800; color:#cbd5e1;">KAMPANYA BAŞLIĞI &amp; KAPAK TANITIM METNİ:</label>
              <button type="button" id="btnCmpAiCopy" onclick="window.generateCampaignAiCopy()" style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:6px; border:1px solid #d4af37; background:rgba(212,175,55,0.15); color:#fde68a; font-size:11px; font-weight:700; cursor:pointer;">
                ✨ Gemini AI ile Yazdır
              </button>
            </div>
            <input type="text" id="cmpTitleInput" class="form-control" placeholder="Örn: KIŞ SEZONU ÖZEL MİMARİ SEÇKİ" value="KIŞ SEZONU ÖZEL MİMARİ SEÇKİ" style="width:100%; padding:10px; border-radius:8px; background:#090f1c; border:1px solid #334155; color:#fff; font-size:12.5px; margin-bottom:8px;">
            <textarea id="cmpIntroInput" class="form-control" placeholder="Carousel kapak slaytında ve Reels açılışında yer alacak çarpıcı kampanya tanıtım metni..." style="width:100%; height:60px; padding:10px; border-radius:8px; background:#090f1c; border:1px solid #334155; color:#e2e8f0; font-size:12px; resize:vertical;">Geçmişin estetiği ve modern mimari konfor, kış sezonuna özel %30 indirim avantajıyla yaşam alanlarınızda.</textarea>
          </div>

          <!-- 5. AYAR: ÜRETİLECEK GÖNDERİ FORMATLARI -->
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(148,163,184,0.18); border-radius:14px; padding:16px;">
            <label style="font-size:12px; font-weight:800; color:#fde68a; display:block; margin-bottom:10px;">
              5. ÜRETİLECEK GÖNDERİ FORMATLARI:
            </label>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
              <!-- GÖNDERİ / CAROUSEL (ZORUNLU) -->
              <label style="display:flex; align-items:center; gap:8px; background:rgba(30,41,59,0.7); border:1px solid rgba(16,185,129,0.5); border-radius:8px; padding:10px 12px; cursor:not-allowed;">
                <input type="checkbox" id="chkCmpFormatFeed" checked disabled style="width:17px; height:17px; accent-color:#10b981;">
                <div>
                  <strong style="font-size:12px; color:#fff; display:block;">🖼️ Gönderi (Carousel)</strong>
                  <span style="font-size:10px; color:#34d399; font-weight:700;">Zorunlu Format</span>
                </div>
              </label>

              <!-- REELS -->
              <label style="display:flex; align-items:center; gap:8px; background:rgba(30,41,59,0.4); border:1px solid rgba(148,163,184,0.25); border-radius:8px; padding:10px 12px; cursor:pointer;">
                <input type="checkbox" id="chkCmpFormatReels" checked style="width:17px; height:17px; accent-color:#d4af37;">
                <div>
                  <strong style="font-size:12px; color:#fff; display:block;">🎬 Reels / Video</strong>
                  <span style="font-size:10px; color:#94a3b8;">Instagram &amp; YouTube</span>
                </div>
              </label>

              <!-- STORY -->
              <label style="display:flex; align-items:center; gap:8px; background:rgba(30,41,59,0.4); border:1px solid rgba(148,163,184,0.25); border-radius:8px; padding:10px 12px; cursor:pointer;">
                <input type="checkbox" id="chkCmpFormatStories" checked style="width:17px; height:17px; accent-color:#d4af37;">
                <div>
                  <strong style="font-size:12px; color:#fff; display:block;">📱 Dikey Story</strong>
                  <span style="font-size:10px; color:#94a3b8;">Instagram Hikaye (9:16)</span>
                </div>
              </label>
            </div>
          </div>

          <!-- STATUS & PROGRESS -->
          <div id="cmpStatusBox" style="display:none; padding:12px 14px; border-radius:10px; font-size:12px; font-weight:600; line-height:1.5;"></div>

        </div>

        <!-- MODAL FOOTER -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 24px; border-top:1px solid rgba(148,163,184,0.18); background:rgba(15,23,42,0.95); position:sticky; bottom:0;">
          <button type="button" onclick="window.closeCampaignStudioModal()" style="padding:10px 18px; border-radius:8px; border:1px solid #475569; background:transparent; color:#cbd5e1; font-weight:700; cursor:pointer; font-size:12.5px;">
            Vazgeç
          </button>

          <button type="button" id="btnSubmitCampaign" onclick="window.submitCampaignGeneration()" style="display:inline-flex; align-items:center; gap:8px; padding:11px 24px; border-radius:8px; border:1px solid #d4af37; background:linear-gradient(135deg,#d4af37,#9b7220); color:#0b1120; font-weight:800; cursor:pointer; font-size:13px; box-shadow:0 4px 18px rgba(212,175,55,0.35);">
            🚀 Kampanyayı Üret ve 4 Bot Kuyruğuna Ekle
          </button>
        </div>

      </div>
    </div>
  `;
}

// Global modal açma / kapama
export function openCampaignStudioModal(initialDate = null) {
  let modal = document.getElementById('campaignStudioModal');
  if (!modal) {
    const wrap = document.createElement('div');
    wrap.innerHTML = renderCampaignStudioModalHtml();
    document.body.appendChild(wrap.firstElementChild);
    modal = document.getElementById('campaignStudioModal');
  }
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const dateInput = document.getElementById('cmpPublishDate');
  if (dateInput) {
    const today = new Date().toISOString().slice(0, 10);
    dateInput.value = initialDate || today;
    dateInput.min = today;
  }

  fetchCatalogData().then(() => {
    populateCatalogSelectors();
    updateCampaignThemeInfo();
  });
}

export function closeCampaignStudioModal() {
  const modal = document.getElementById('campaignStudioModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

// Katalog Seçicilerini Doldur
function populateCatalogSelectors() {
  const colSelect = document.getElementById('cmpSingleCollectionSelect');
  const prodSelect = document.getElementById('cmpSingleProductSelect');
  const multiColsContainer = document.getElementById('cmpMultiColsItems');
  const multiProdsContainer = document.getElementById('cmpMultiProdsItems');

  if (colSelect) {
    colSelect.innerHTML = cachedCatalog.collections.map(c => 
      `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.title || c.slug)} (${(c.parts || []).length || 0} Parça)</option>`
    ).join('') || '<option value="">Kayıtlı koleksiyon bulunamadı</option>';
  }

  if (prodSelect) {
    prodSelect.innerHTML = cachedCatalog.products.map(p => 
      `<option value="${escapeHtml(p.slug)}">${escapeHtml(p.title || p.slug)} • ${escapeHtml(p.kategori || 'Genel')}</option>`
    ).join('') || '<option value="">Kayıtlı bağımsız ürün bulunamadı</option>';
  }

  if (multiColsContainer) {
    multiColsContainer.innerHTML = cachedCatalog.collections.map(c => `
      <label style="display:flex; align-items:center; gap:7px; font-size:11.5px; color:#e2e8f0; cursor:pointer;">
        <input type="checkbox" value="${escapeHtml(c.slug)}" data-kind="collection" style="accent-color:#d4af37;" onchange="window.onMultiItemToggle(this)">
        <span>${escapeHtml(c.title || c.slug)}</span>
      </label>
    `).join('') || '<span style="font-size:10.5px; color:#64748b;">Koleksiyon yok</span>';
  }

  if (multiProdsContainer) {
    multiProdsContainer.innerHTML = cachedCatalog.products.map(p => `
      <label style="display:flex; align-items:center; gap:7px; font-size:11.5px; color:#e2e8f0; cursor:pointer;">
        <input type="checkbox" value="${escapeHtml(p.slug)}" data-kind="independent" style="accent-color:#38bdf8;" onchange="window.onMultiItemToggle(this)">
        <span>${escapeHtml(p.title || p.slug)}</span>
      </label>
    `).join('') || '<span style="font-size:10.5px; color:#64748b;">Bağımsız ürün yok</span>';
  }
}

// 1. Ayar Değiştiğinde
export function onCampaignKindChange(kind) {
  document.querySelectorAll('.cmp-kind-card').forEach(card => {
    const isCur = card.getAttribute('data-kind') === kind;
    card.classList.toggle('active', isCur);
    card.style.background = isCur ? 'rgba(212,175,55,0.12)' : 'rgba(30,41,59,0.4)';
    card.style.borderColor = isCur ? 'rgba(212,175,55,0.5)' : 'rgba(148,163,184,0.2)';
  });

  const boxCol = document.getElementById('cmpSelectBox_collection');
  const boxProd = document.getElementById('cmpSelectBox_independent');
  const boxMulti = document.getElementById('cmpSelectBox_multi');
  const helpBadge = document.getElementById('cmpKindHelpBadge');

  if (kind === 'collection') {
    if (boxCol) boxCol.style.display = 'block';
    if (boxProd) boxProd.style.display = 'none';
    if (boxMulti) boxMulti.style.display = 'none';
    if (helpBadge) helpBadge.textContent = 'Koleksiyona Özel Tam Kampanya';
  } else if (kind === 'independent') {
    if (boxCol) boxCol.style.display = 'none';
    if (boxProd) boxProd.style.display = 'block';
    if (boxMulti) boxMulti.style.display = 'none';
    if (helpBadge) helpBadge.textContent = 'Bağımsız Ürün + 2 Slaytlı Carousel';
  } else if (kind === 'mixed_multi') {
    if (boxCol) boxCol.style.display = 'none';
    if (boxProd) boxProd.style.display = 'none';
    if (boxMulti) boxMulti.style.display = 'block';
    if (helpBadge) helpBadge.textContent = 'Çoklu Ürün & Otomatik Geçiş Slaytı';
  }
}

// Çoklu seçimde öğe tıklandığında
export function onMultiItemToggle(checkbox) {
  if (checkbox.checked) selectedMultiSlugs.add(checkbox.value);
  else selectedMultiSlugs.delete(checkbox.value);

  const countBadge = document.getElementById('cmpMultiCountBadge');
  if (countBadge) countBadge.textContent = `${selectedMultiSlugs.size} Seçildi`;

  // Koleksiyon ve bağımsız ürünlerin her ikisi de var mı kontrol et
  const checkedCols = document.querySelectorAll('#cmpMultiColsItems input[type="checkbox"]:checked');
  const checkedProds = document.querySelectorAll('#cmpMultiProdsItems input[type="checkbox"]:checked');
  const notice = document.getElementById('cmpBridgeNotice');
  if (notice) {
    notice.style.display = (checkedCols.length > 0 && checkedProds.length > 0) ? 'block' : 'none';
  }
}

// 2. Ayar Kampanya Türü Değiştiğinde
export function onCampaignTypeSelectChange() {
  const type = document.getElementById('cmpTypeSelect').value;
  const subContainer = document.getElementById('cmpSubOptionContainer');
  const subLabel = document.getElementById('cmpSubOptionLabel');
  const subSelect = document.getElementById('cmpSubOptionSelect');
  const themeData = CAMPAIGN_THEMES_INFO[type] || CAMPAIGN_THEMES_INFO.seasonal;

  if (themeData.subOptions.length > 1) {
    subContainer.style.display = 'block';
    subLabel.textContent = type === 'seasonal' ? 'MEVSİM SEÇİMİ:' : 'ÖZEL GÜN / BAYRAM:';
    subSelect.innerHTML = themeData.subOptions.map(opt => `<option value="${opt.id}">${opt.label}</option>`).join('');
  } else {
    subContainer.style.display = 'none';
  }

  updateCampaignThemeInfo();
}

// Tema ve müzik bilgisi güncelle
export function updateCampaignThemeInfo() {
  const type = document.getElementById('cmpTypeSelect')?.value || 'seasonal';
  const subSelect = document.getElementById('cmpSubOptionSelect');
  const subId = subSelect ? subSelect.value : '';
  const themeGroup = CAMPAIGN_THEMES_INFO[type] || CAMPAIGN_THEMES_INFO.seasonal;
  const opt = themeGroup.subOptions.find(o => o.id === subId) || themeGroup.subOptions[0];

  const colorEl = document.getElementById('cmpThemeColorPill');
  const musicEl = document.getElementById('cmpThemeMusicPill');
  if (colorEl && opt) colorEl.textContent = `🎨 Tema: ${opt.theme}`;
  if (musicEl && opt) musicEl.textContent = `🎵 Fon Müziği: ${opt.music}`;
}

export function setCmpDiscount(val) {
  const inp = document.getElementById('cmpDiscountInput');
  if (inp) inp.value = val;
}

// Gemini AI ile Başlık ve Metin Yazdır
export async function generateCampaignAiCopy() {
  const btn = document.getElementById('btnCmpAiCopy');
  const type = document.getElementById('cmpTypeSelect')?.value || 'seasonal';
  const subSelect = document.getElementById('cmpSubOptionSelect');
  const sub = subSelect ? subSelect.value : '';
  const discount = document.getElementById('cmpDiscountInput')?.value || '%30 İndirim';

  let selectedTitles = [];
  const kind = document.querySelector('input[name="cmp_kind"]:checked')?.value || 'collection';
  if (kind === 'collection') {
    const colSel = document.getElementById('cmpSingleCollectionSelect');
    if (colSel && colSel.selectedOptions[0]) selectedTitles.push(colSel.selectedOptions[0].text);
  } else if (kind === 'independent') {
    const prodSel = document.getElementById('cmpSingleProductSelect');
    if (prodSel && prodSel.selectedOptions[0]) selectedTitles.push(prodSel.selectedOptions[0].text);
  } else {
    selectedMultiSlugs.forEach(slug => {
      const match = cachedCatalog.collections.find(c => c.slug === slug) || cachedCatalog.products.find(p => p.slug === slug);
      if (match) selectedTitles.push(match.title || slug);
    });
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Gemini Yazıyor...';
  }

  try {
    const res = await fetch('/api/module2?action=campaign-ai-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_type: type,
        sub_type: sub,
        discount_amount: discount,
        selected_titles: selectedTitles
      })
    }).then(r => r.json());

    if (res.ok) {
      if (res.title) document.getElementById('cmpTitleInput').value = res.title;
      if (res.intro) document.getElementById('cmpIntroInput').value = res.intro;
    }
  } catch (err) {
    console.error('Gemini copy error:', err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '✨ Gemini AI ile Yazdır';
    }
  }
}

// Kampanyayı Üret ve Kaydet
export async function submitCampaignGeneration() {
  const btn = document.getElementById('btnSubmitCampaign');
  const statusBox = document.getElementById('cmpStatusBox');
  const kind = document.querySelector('input[name="cmp_kind"]:checked')?.value || 'collection';
  const type = document.getElementById('cmpTypeSelect')?.value || 'seasonal';
  const sub = document.getElementById('cmpSubOptionSelect')?.value || '';
  const discount = document.getElementById('cmpDiscountInput')?.value || '';
  const title = document.getElementById('cmpTitleInput')?.value.trim();
  const intro = document.getElementById('cmpIntroInput')?.value.trim();

  let selectedSlugs = [];
  if (kind === 'collection') {
    const s = document.getElementById('cmpSingleCollectionSelect')?.value;
    if (s) selectedSlugs.push(s);
  } else if (kind === 'independent') {
    const s = document.getElementById('cmpSingleProductSelect')?.value;
    if (s) selectedSlugs.push(s);
  } else {
    selectedSlugs = Array.from(selectedMultiSlugs);
  }

  if (!selectedSlugs.length) {
    alert('Lütfen en az bir koleksiyon veya ürün seçin.');
    return;
  }

  const publishDate = document.getElementById('cmpPublishDate')?.value || new Date().toISOString().slice(0, 10);
  const publishTime = document.getElementById('cmpPublishTimeSlot')?.value || 'all_slots';

  const formats = {
    feed: true,
    reels: document.getElementById('chkCmpFormatReels')?.checked ?? true,
    stories: document.getElementById('chkCmpFormatStories')?.checked ?? true
  };

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Kampanya Üretiliyor...';
  }
  if (statusBox) {
    statusBox.style.display = 'block';
    statusBox.style.background = 'rgba(56,189,248,0.12)';
    statusBox.style.border = '1px solid rgba(56,189,248,0.35)';
    statusBox.style.color = '#38bdf8';
    statusBox.innerHTML = `
      <div>⏳ <strong>Kampanya Kapak Slaytı ve Format Motoru Hazırlanıyor...</strong></div>
      <div style="font-size:11px; color:#cbd5e1; margin-top:4px;">1. Kapak slaytı, seçilen tema paleti ve 4 bot kuyrukları senkronize ediliyor.</div>
    `;
  }

  try {
    const res = await fetch('/api/module2?action=campaign-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        composition_kind: kind,
        selected_slugs: selectedSlugs,
        campaign_type: type,
        sub_type: sub,
        discount_amount: discount,
        campaign_title: title,
        campaign_intro: intro,
        publish_date: publishDate,
        publish_time: publishTime,
        formats
      })
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || 'Kampanya oluşturulamadı.');

    try {
      window.dispatchEvent(new CustomEvent('campaignCreated', { detail: res.campaign }));
    } catch (_) {}

    if (statusBox) {
      statusBox.style.background = 'rgba(16,185,129,0.14)';
      statusBox.style.border = '1px solid rgba(16,185,129,0.4)';
      statusBox.style.color = '#34d399';
      statusBox.innerHTML = `
        <div style="font-size:13px; font-weight:800;">✅ ${escapeHtml(res.message || 'Kampanya başarıyla üretildi!')}</div>
        <div style="font-size:11.5px; color:#cbd5e1; margin-top:4px;">
          • Carousel Gönderi: <strong>Hazırlandı</strong><br>
          • Reels &amp; Story: <strong>Kuyruğa Eklendi</strong><br>
          • 4 Bot Durumu: <strong>Instagram, Facebook, YouTube, TikTok planlandı.</strong>
        </div>
      `;
    }

    // Module 2 iframe'ini tazele
    const frame = document.getElementById('module2-frame');
    if (frame && frame.contentWindow) {
      try { frame.contentWindow.location.reload(); } catch (_) {}
    }

    setTimeout(() => {
      closeCampaignStudioModal();
      if (typeof window.showToast === 'function') {
        window.showToast(`🎯 "${title}" kampanyası 4 bot kuyruğuna başarıyla eklendi!`);
      }
    }, 2400);

  } catch (err) {
    if (statusBox) {
      statusBox.style.background = 'rgba(239,68,68,0.12)';
      statusBox.style.border = '1px solid rgba(239,68,68,0.35)';
      statusBox.style.color = '#fca5a5';
      statusBox.textContent = `❌ Hata: ${err.message}`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🚀 Kampanyayı Üret ve 4 Bot Kuyruğuna Ekle';
    }
  }
}

// Window export
if (typeof window !== 'undefined') {
  window.openCampaignStudioModal = openCampaignStudioModal;
  window.closeCampaignStudioModal = closeCampaignStudioModal;
  window.onCampaignKindChange = onCampaignKindChange;
  window.onCampaignTypeSelectChange = onCampaignTypeSelectChange;
  window.updateCampaignThemeInfo = updateCampaignThemeInfo;
  window.setCmpDiscount = setCmpDiscount;
  window.generateCampaignAiCopy = generateCampaignAiCopy;
  window.submitCampaignGeneration = submitCampaignGeneration;
  window.onMultiItemToggle = onMultiItemToggle;
  window.onSingleCollectionSelected = () => {};
  window.onSingleProductSelected = () => {};
}

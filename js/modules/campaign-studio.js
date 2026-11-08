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
  if (Boolean(p.collection_id) || Boolean(p.parent_collection_slug)) return true;
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

// Kampanyayı Üret ve Kaydet (Yeni Kapsamlı Kampanya Motoruna Bağlandı)
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

  if (!title) {
    alert('Lütfen bir kampanya başlığı belirleyin.');
    return;
  }

  const publishDate = document.getElementById('cmpPublishDate')?.value || new Date().toISOString().slice(0, 10);
  const publishTime = document.getElementById('cmpPublishTimeSlot')?.value || 'all_slots';

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
      <div>⏳ <strong>Modül 7 Gerçek Verileriyle Kampanya ve Paketler Üretiliyor...</strong></div>
      <div style="font-size:11px; color:#cbd5e1; margin-top:4px;">Strateji, 4 platform içerik paketleri ve video sahne planları hazırlanıyor.</div>
    `;
  }

  try {
    const payload = {
      target_type: kind,
      composition_kind: kind,
      selected_slugs: selectedSlugs,
      collection_slug: (kind === 'collection') ? selectedSlugs[0] : null,
      product_slug: (kind === 'independent') ? selectedSlugs[0] : null,
      campaign_type: type,
      sub_type: sub,
      discount_amount: discount,
      title: title,
      campaign_title: title,
      intro: intro,
      campaign_intro: intro,
      publish_date: publishDate,
      publish_time: publishTime,
      selected_platforms: ['instagram', 'facebook', 'youtube', 'tiktok'],
      creative_controls: {
        campaign_type: type,
        sub_type: sub,
        discount_amount: discount,
        notes: intro
      }
    };

    const res = await fetch('/api/module2?action=campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
        <div style="font-size:13px; font-weight:800;">🚀 Kampanya Üretildi ve 4 Bot Yayın Kuyruğuna Eklendi!</div>
        <div style="font-size:11.5px; color:#cbd5e1; margin-top:4px;">
          • Durum: <strong>Tam Otonom Yayın Akışında (Onay Gerektirmez)</strong><br>
          • 4 Platform: <strong>Instagram, Facebook, YouTube, TikTok paketleri doğrudan yayın sırasına alındı.</strong>
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
        window.showToast(`🚀 "${title}" otonom yayın kuyruğuna eklendi!`);
      }
    }, 1200);

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
      btn.innerHTML = '🚀 Kampanyayı Üret ve İncelemeye Al';
    }
  }
}

// ── KAMPANYA İNCELEME & ONAY MODALI (BÖLÜM 3) ────────────────────────────────
let activeReviewCampaign = null;
let currentReviewPlatformFilter = 'all';

export function renderCampaignReviewModalHtml() {
  return `
    <div id="campaignReviewModal" class="campaign-modal-backdrop" style="display:none; position:fixed; inset:0; z-index:100020; background:rgba(3,7,18,0.88); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:16px;">
      <div class="campaign-modal-window" style="background:#0f172a; border:1px solid rgba(212,175,55,0.45); border-radius:18px; width:1140px; max-width:98vw; max-height:94vh; overflow-y:auto; box-shadow:0 25px 70px rgba(0,0,0,0.75); color:#f8fafc; display:flex; flex-direction:column;">
        
        <!-- HEADER -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid rgba(148,163,184,0.18); background:linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.85)); position:sticky; top:0; z-index:20;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:42px; height:42px; border-radius:10px; background:linear-gradient(135deg,#38bdf8,#0284c7); color:#030712; font-size:22px; font-weight:900; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(56,189,248,0.35);">
              📋
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h2 id="cmpReviewTitle" style="font-size:17px; font-weight:800; color:#fff; letter-spacing:-0.2px; margin:0;">Kampanya İnceleme &amp; Onay Masası</h2>
                <span id="cmpReviewCodeBadge" style="font-size:11px; font-weight:700; background:rgba(212,175,55,0.2); color:#fde68a; padding:2px 8px; border-radius:6px; border:1px solid rgba(212,175,55,0.4);">CMP-000</span>
                <span id="cmpReviewStatusBadge" style="font-size:11px; font-weight:700; background:rgba(56,189,248,0.2); color:#38bdf8; padding:2px 8px; border-radius:6px;">İnceleme Bekliyor</span>
              </div>
              <p id="cmpReviewSubtitle" style="font-size:11.5px; color:#94a3b8; margin:2px 0 0;">Kullanıcı onayı olmadan hiçbir içerik yayın kuyruğuna aktarılmaz. İçerikleri inceleyin, düzenleyin ve onaylayın.</p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <button type="button" onclick="window.refreshActiveCampaignReview()" style="background:rgba(30,41,59,0.7); border:1px solid #475569; color:#cbd5e1; font-size:12px; font-weight:700; padding:6px 12px; border-radius:8px; cursor:pointer;" title="Yenile">🔄 Yenile</button>
            <button type="button" onclick="window.closeCampaignReviewModal()" style="background:none; border:none; color:#94a3b8; font-size:26px; line-height:1; cursor:pointer; padding:4px 8px; border-radius:6px; transition:color .15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">&times;</button>
          </div>
        </div>

        <!-- PLATFORM TABS & SUMMARY -->
        <div style="padding:14px 24px; border-bottom:1px solid rgba(148,163,184,0.12); background:rgba(15,23,42,0.6); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;" id="cmpReviewPlatformTabs">
            <button type="button" class="cmp-rev-tab active" data-platform="all" onclick="window.filterReviewPlatform('all')" style="padding:6px 12px; border-radius:8px; border:1px solid #d4af37; background:rgba(212,175,55,0.18); color:#fde68a; font-size:12px; font-weight:700; cursor:pointer;">
              🌟 Tüm Paketler (<span id="countTabAll">0</span>)
            </button>
            <button type="button" class="cmp-rev-tab" data-platform="instagram" onclick="window.filterReviewPlatform('instagram')" style="padding:6px 12px; border-radius:8px; border:1px solid #334155; background:rgba(30,41,59,0.5); color:#cbd5e1; font-size:12px; font-weight:700; cursor:pointer;">
              📸 Instagram (<span id="countTabIg">0</span>)
            </button>
            <button type="button" class="cmp-rev-tab" data-platform="facebook" onclick="window.filterReviewPlatform('facebook')" style="padding:6px 12px; border-radius:8px; border:1px solid #334155; background:rgba(30,41,59,0.5); color:#cbd5e1; font-size:12px; font-weight:700; cursor:pointer;">
              📘 Facebook (<span id="countTabFb">0</span>)
            </button>
            <button type="button" class="cmp-rev-tab" data-platform="youtube" onclick="window.filterReviewPlatform('youtube')" style="padding:6px 12px; border-radius:8px; border:1px solid #334155; background:rgba(30,41,59,0.5); color:#cbd5e1; font-size:12px; font-weight:700; cursor:pointer;">
              ▶️ YouTube (<span id="countTabYt">0</span>)
            </button>
            <button type="button" class="cmp-rev-tab" data-platform="tiktok" onclick="window.filterReviewPlatform('tiktok')" style="padding:6px 12px; border-radius:8px; border:1px solid #334155; background:rgba(30,41,59,0.5); color:#cbd5e1; font-size:12px; font-weight:700; cursor:pointer;">
              🎵 TikTok (<span id="countTabTt">0</span>)
            </button>
          </div>
          <div id="cmpReviewNoticeBox" style="font-size:11.5px; color:#cbd5e1; background:rgba(30,41,59,0.6); padding:6px 12px; border-radius:6px; border:1px solid rgba(148,163,184,0.15);">
            🔒 <strong>Güvenlik İlkesi:</strong> Yalnızca <span style="color:#34d399; font-weight:700;">Onaylandı</span> durumundaki içerikler yayın kuyruğuna alınır.
          </div>
        </div>

        <!-- ITEMS CONTAINER -->
        <div id="cmpReviewItemsContainer" style="padding:20px 24px; display:flex; flex-direction:column; gap:16px;">
          <div style="text-align:center; padding:40px; color:#94a3b8; font-size:13px;">
            ⏳ Kampanya içerik paketleri yükleniyor...
          </div>
        </div>

        <!-- BULK ACTIONS FOOTER -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 24px; border-top:1px solid rgba(148,163,184,0.18); background:rgba(15,23,42,0.96); position:sticky; bottom:0; z-index:20;">
          <div style="display:flex; align-items:center; gap:12px;">
            <label style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#cbd5e1; cursor:pointer;">
              <input type="checkbox" id="chkSelectAllReviewItems" onchange="window.toggleSelectAllReviewItems(this)" style="width:16px; height:16px; accent-color:#d4af37;">
              <span>Tümünü Seç</span>
            </label>
            <span id="cmpReviewSelectedCount" style="font-size:11.5px; color:#94a3b8;">0 öğe seçildi</span>
          </div>

          <div style="display:flex; align-items:center; gap:10px;">
            <button type="button" onclick="window.bulkApproveSelectedReviewItems()" style="padding:9px 18px; border-radius:8px; border:1px solid #10b981; background:rgba(16,185,129,0.15); color:#34d399; font-weight:800; cursor:pointer; font-size:12.5px;">
              ✅ Seçilenleri Onayla
            </button>
            <button type="button" id="btnBulkQueueApproved" onclick="window.bulkQueueSelectedApprovedItems()" style="display:inline-flex; align-items:center; gap:8px; padding:10px 22px; border-radius:8px; border:1px solid #d4af37; background:linear-gradient(135deg,#d4af37,#9b7220); color:#0b1120; font-weight:800; cursor:pointer; font-size:13px; box-shadow:0 4px 18px rgba(212,175,55,0.35);">
              🚀 Seçilen Onaylıları Yayın Kuyruğuna Gönder
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

export async function openCampaignReviewModal(campaignId = null) {
  let modal = document.getElementById('campaignReviewModal');
  if (!modal) {
    const wrap = document.createElement('div');
    wrap.innerHTML = renderCampaignReviewModalHtml();
    document.body.appendChild(wrap.firstElementChild);
    modal = document.getElementById('campaignReviewModal');
  }
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  await loadCampaignReviewData(campaignId);
}

export function closeCampaignReviewModal() {
  const modal = document.getElementById('campaignReviewModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

export async function refreshActiveCampaignReview() {
  if (activeReviewCampaign && activeReviewCampaign.id) {
    await loadCampaignReviewData(activeReviewCampaign.id);
  } else {
    await loadCampaignReviewData();
  }
}

async function loadCampaignReviewData(targetId = null) {
  const container = document.getElementById('cmpReviewItemsContainer');
  if (container) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8; font-size:13px;">⏳ Kampanya içerik paketleri yükleniyor...</div>';
  }

  try {
    const url = targetId ? `/api/module2?action=campaigns&id=${encodeURIComponent(targetId)}` : '/api/module2?action=campaigns';
    const res = await fetch(url, { cache: 'no-store' }).then(r => r.json());
    if (!res.ok) throw new Error(res.error || 'Kampanya verisi yüklenemedi.');

    if (targetId && res.campaign) {
      activeReviewCampaign = res.campaign;
    } else if (Array.isArray(res.campaigns) && res.campaigns.length > 0) {
      activeReviewCampaign = res.campaigns[0];
    } else {
      activeReviewCampaign = null;
    }

    if (!activeReviewCampaign) {
      if (container) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8; font-size:13px;">Henüz kayıtlı kampanya bulunamadı. "Yeni Kampanya Üret" butonuna tıklayarak ilk kampanyanızı oluşturabilirsiniz.</div>';
      }
      return;
    }

    // Header bilgilerini güncelle
    const titleEl = document.getElementById('cmpReviewTitle');
    const codeEl = document.getElementById('cmpReviewCodeBadge');
    const statusEl = document.getElementById('cmpReviewStatusBadge');
    if (titleEl) titleEl.textContent = activeReviewCampaign.title || 'Kampanya İnceleme Masası';
    if (codeEl) codeEl.textContent = activeReviewCampaign.campaign_code || activeReviewCampaign.id.slice(0, 8);
    if (statusEl) {
      statusEl.textContent = activeReviewCampaign.status || 'pending_review';
    }

    renderReviewCards();
  } catch (err) {
    if (container) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:#fca5a5; font-size:13px;">❌ Veri Yükleme Hatası: ${escapeHtml(err.message)}</div>`;
    }
  }
}

export function filterReviewPlatform(platform) {
  currentReviewPlatformFilter = platform;
  document.querySelectorAll('.cmp-rev-tab').forEach(tab => {
    const isCur = tab.getAttribute('data-platform') === platform;
    tab.classList.toggle('active', isCur);
    tab.style.borderColor = isCur ? '#d4af37' : '#334155';
    tab.style.background = isCur ? 'rgba(212,175,55,0.18)' : 'rgba(30,41,59,0.5)';
    tab.style.color = isCur ? '#fde68a' : '#cbd5e1';
  });
  renderReviewCards();
}

function renderReviewCards() {
  const container = document.getElementById('cmpReviewItemsContainer');
  if (!container || !activeReviewCampaign) return;

  const items = activeReviewCampaign.items || [];

  // Tab sayılarını güncelle
  const countAll = items.length;
  const countIg = items.filter(i => i.platform === 'instagram').length;
  const countFb = items.filter(i => i.platform === 'facebook').length;
  const countYt = items.filter(i => i.platform === 'youtube').length;
  const countTt = items.filter(i => i.platform === 'tiktok').length;

  const elAll = document.getElementById('countTabAll');
  const elIg = document.getElementById('countTabIg');
  const elFb = document.getElementById('countTabFb');
  const elYt = document.getElementById('countTabYt');
  const elTt = document.getElementById('countTabTt');
  if (elAll) elAll.textContent = countAll;
  if (elIg) elIg.textContent = countIg;
  if (elFb) elFb.textContent = countFb;
  if (elYt) elYt.textContent = countYt;
  if (elTt) elTt.textContent = countTt;

  const filteredItems = currentReviewPlatformFilter === 'all'
    ? items
    : items.filter(i => i.platform === currentReviewPlatformFilter);

  if (!filteredItems.length) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8; font-size:12.5px;">Bu platform filtresine (${currentReviewPlatformFilter}) ait içerik paketi bulunamadı.</div>`;
    return;
  }

  const statusColors = {
    pending_review: { bg: 'rgba(56,189,248,0.18)', color: '#38bdf8', border: 'rgba(56,189,248,0.4)', label: 'İnceleme Bekliyor' },
    approved: { bg: 'rgba(16,185,129,0.18)', color: '#34d399', border: 'rgba(16,185,129,0.4)', label: 'Onaylandı' },
    queued: { bg: 'rgba(147,51,234,0.18)', color: '#c084fc', border: 'rgba(147,51,234,0.4)', label: 'Yayın Kuyruğunda' },
    awaiting_platform_connection: { bg: 'rgba(245,158,11,0.18)', color: '#fbbf24', border: 'rgba(245,158,11,0.4)', label: 'Platform Bağlantısı Bekleniyor' },
    revision_required: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5', border: 'rgba(239,68,68,0.4)', label: 'Revizyon Gerekli' },
    manual_action_required: { bg: 'rgba(244,63,94,0.18)', color: '#fb7185', border: 'rgba(244,63,94,0.4)', label: 'Manuel İşlem Gerekli' },
    published: { bg: 'rgba(16,185,129,0.25)', color: '#10b981', border: '#10b981', label: 'Yayınlandı' }
  };

  const platformIcons = {
    instagram: '📸 Instagram',
    facebook: '📘 Facebook',
    youtube: '▶️ YouTube Shorts',
    tiktok: '🎵 TikTok'
  };

  container.innerHTML = filteredItems.map(item => {
    const st = statusColors[item.status] || { bg: 'rgba(148,163,184,0.15)', color: '#cbd5e1', border: '#475569', label: item.status };
    const isVideo = ['REELS', 'FB_REELS', 'SHORTS', 'TIKTOK_VIDEO'].includes(item.content_type);
    const mediaPreview = item.cover_url || item.media_urls?.[0] || '';
    const scenes = Array.isArray(item.scenes) ? item.scenes : [];

    return `
      <div class="cmp-review-card" data-item-id="${escapeHtml(item.id)}" style="background:rgba(15,23,42,0.7); border:1px solid rgba(148,163,184,0.2); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:14px; position:relative;">
        
        <!-- CARD HEADER -->
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <input type="checkbox" class="cmp-item-select-chk" value="${escapeHtml(item.id)}" data-status="${escapeHtml(item.status)}" onchange="window.onReviewItemCheckboxChange()" style="width:17px; height:17px; accent-color:#d4af37;">
            <span style="font-size:12.5px; font-weight:800; color:#fff;">${platformIcons[item.platform] || item.platform}</span>
            <span style="font-size:11px; color:#94a3b8; font-weight:700;">• ${escapeHtml(item.package_type || item.content_type)}</span>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; font-weight:700; padding:3px 9px; border-radius:6px; background:${st.bg}; color:${st.color}; border:1px solid ${st.border};">
              ${escapeHtml(st.label)}
            </span>
          </div>
        </div>

        <!-- CARD BODY (2-COLUMN) -->
        <div style="display:grid; grid-template-columns:240px 1fr; gap:16px;">
          
          <!-- LEFT: VISUAL PREVIEW & SPEC PILLS -->
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="position:relative; width:100%; height:200px; border-radius:8px; overflow:hidden; background:#000; border:1px solid #334155; display:flex; align-items:center; justify-content:center;">
              ${mediaPreview ? `
                <img src="${escapeHtml(mediaPreview)}" alt="Önizleme" style="width:100%; height:100%; object-fit:cover;" onerror="this.src=''; this.alt='Görsel Yüklenemedi';">
              ` : `
                <div style="color:#64748b; font-size:11px; text-align:center; padding:12px;">🖼️ Görsel Henüz Eklenmedi</div>
              `}
              ${isVideo ? `
                <div style="position:absolute; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:#fff; font-size:26px;">
                  ▶
                </div>
                <span style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.75); color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">
                  ${item.duration_seconds || 22} sn
                </span>
              ` : `
                <span style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.75); color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">
                  ${escapeHtml(item.aspect_ratio || '1:1')}
                </span>
              `}
            </div>

            <!-- TEKNİK ETİKETLER -->
            <div style="display:flex; flex-wrap:wrap; gap:4px;">
              <span style="font-size:10px; background:#1e293b; color:#94a3b8; padding:2px 6px; border-radius:4px;">📐 ${escapeHtml(item.resolution || '1080x1080')}</span>
              ${item.slides && item.slides.length ? `<span style="font-size:10px; background:#1e293b; color:#38bdf8; padding:2px 6px; border-radius:4px;">📚 ${item.slides.length} Slayt</span>` : ''}
              ${item.music_track ? `<span style="font-size:10px; background:#1e293b; color:#a7f3d0; padding:2px 6px; border-radius:4px;">🎵 ${escapeHtml(item.music_track.id || 'Müzik')}</span>` : ''}
            </div>

            <!-- MODÜL 8 MEDYA KÜTÜPHANESİNDEN BAĞLA -->
            <div style="margin-top:6px;">
              <button type="button" onclick="window.openM8MediaPickerForItem('${escapeHtml(item.id)}')" style="width:100%; padding:6px 10px; font-size:11px; font-weight:700; background:rgba(212,175,55,0.15); border:1px solid rgba(212,175,55,0.45); color:#fde68a; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                <span>✨</span> Modül 8'den Medya Bağla
              </button>
              ${item.source_asset_id ? `
                <div style="margin-top:4px; font-size:10px; color:#34d399; display:flex; align-items:center; gap:4px; background:rgba(16,185,129,0.1); padding:3px 6px; border-radius:4px; border:1px solid rgba(16,185,129,0.25);">
                  <span>✓</span> Modül 8 Bağlı: <strong>${escapeHtml(item.asset_ref?.file_name || String(item.source_asset_id).slice(0, 8))}</strong>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- RIGHT: EDITABLE FIELDS -->
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div>
              <label style="font-size:11px; font-weight:700; color:#94a3b8; display:block; margin-bottom:3px;">BAŞLIK:</label>
              <input type="text" class="rev-inp-title" value="${escapeHtml(item.title || '')}" style="width:100%; padding:7px 10px; border-radius:6px; background:#090f1c; border:1px solid #334155; color:#fff; font-size:12px; font-weight:600;">
            </div>

            <div>
              <label style="font-size:11px; font-weight:700; color:#94a3b8; display:block; margin-bottom:3px;">AÇIKLAMA METNİ / CAPTION:</label>
              <textarea class="rev-inp-caption" style="width:100%; height:75px; padding:7px 10px; border-radius:6px; background:#090f1c; border:1px solid #334155; color:#e2e8f0; font-size:11.5px; resize:vertical; line-height:1.4;">${escapeHtml(item.caption || '')}</textarea>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div>
                <label style="font-size:11px; font-weight:700; color:#94a3b8; display:block; margin-bottom:3px;">HASHTAGLER:</label>
                <input type="text" class="rev-inp-hashtags" value="${escapeHtml(item.hashtags || '')}" style="width:100%; padding:7px 10px; border-radius:6px; background:#090f1c; border:1px solid #334155; color:#38bdf8; font-size:11.5px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:#94a3b8; display:block; margin-bottom:3px;">PLANLANAN YAYIN ZAMANI (UTC+3):</label>
                <input type="datetime-local" class="rev-inp-time" value="${item.scheduled_for ? item.scheduled_for.slice(0, 16) : ''}" style="width:100%; padding:6px 10px; border-radius:6px; background:#090f1c; border:1px solid #334155; color:#fde68a; font-size:11.5px; font-weight:700;">
              </div>
            </div>

            <div>
              <label style="font-size:11px; font-weight:700; color:#94a3b8; display:block; margin-bottom:3px;">HEDEF WEB BAĞLANTISI:</label>
              <input type="text" class="rev-inp-link" value="${escapeHtml(item.target_link || 'https://globalkapakmobilya.com/galeri.html')}" style="width:100%; padding:6px 10px; border-radius:6px; background:#090f1c; border:1px solid #334155; color:#cbd5e1; font-size:11.5px;">
            </div>

            <!-- VİDEO SAHNELERİ AKORDİYONU (REELS / SHORTS / TIKTOK İÇİN) -->
            ${isVideo && scenes.length ? `
              <details style="background:#090f1c; border:1px solid rgba(148,163,184,0.18); border-radius:8px; padding:8px 12px; margin-top:4px;">
                <summary style="font-size:11.5px; font-weight:800; color:#38bdf8; cursor:pointer;">
                  🎬 Video Sahneleri (${scenes.length} Sahne • Tekil Olarak Düzenlenebilir)
                </summary>
                <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
                  ${scenes.map(sc => `
                    <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                      <div style="flex:1;">
                        <div style="display:flex; align-items:center; gap:6px;">
                          <strong style="font-size:11.5px; color:#fde68a;">Sahne ${sc.scene_index}: ${escapeHtml(sc.title)}</strong>
                          <span style="font-size:10px; color:#94a3b8;">(${sc.duration_seconds} sn)</span>
                        </div>
                        <div style="font-size:11px; color:#cbd5e1; margin-top:2px;">
                          💬 <em>"${escapeHtml(sc.subtitle_text || '')}"</em>
                        </div>
                        <div style="font-size:10px; color:#64748b; margin-top:2px;">
                          🎥 ${escapeHtml(sc.camera_movement || 'Slow Push-In')} • 💡 ${escapeHtml(sc.lighting || 'Golden hour')}
                        </div>
                      </div>
                      <button type="button" onclick="window.regenerateReviewScene('${escapeHtml(sc.id)}', '${escapeHtml(item.id)}', ${sc.scene_index})" style="padding:4px 8px; border-radius:6px; border:1px solid #38bdf8; background:rgba(56,189,248,0.12); color:#38bdf8; font-size:10.5px; font-weight:700; cursor:pointer;">
                        🔄 Sahneyi Düzenle
                      </button>
                    </div>
                  `).join('')}
                </div>
              </details>
            ` : ''}

          </div>
        </div>

        <!-- ITEM ACTION BUTTONS -->
        <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid rgba(148,163,184,0.12); padding-top:10px; margin-top:4px;">
          <div style="display:flex; gap:6px;">
            <button type="button" onclick="window.saveReviewItemChanges('${escapeHtml(item.id)}')" style="padding:6px 12px; border-radius:6px; border:1px solid #475569; background:rgba(30,41,59,0.7); color:#e2e8f0; font-size:11.5px; font-weight:700; cursor:pointer;">
              💾 Kaydet
            </button>
            <button type="button" onclick="window.requestItemRevision('${escapeHtml(item.id)}')" style="padding:6px 12px; border-radius:6px; border:1px solid #f87171; background:rgba(239,68,68,0.12); color:#fca5a5; font-size:11.5px; font-weight:700; cursor:pointer;">
              ✍️ Revizyon İste
            </button>
            <button type="button" onclick="window.holdReviewItem('${escapeHtml(item.id)}')" style="padding:6px 12px; border-radius:6px; border:1px solid #38bdf8; background:rgba(56,189,248,0.1); color:#38bdf8; font-size:11.5px; font-weight:700; cursor:pointer;">
              ⏸️ Beklet
            </button>
          </div>

          <div style="display:flex; gap:8px;">
            <button type="button" onclick="window.approveReviewItem('${escapeHtml(item.id)}')" style="padding:6px 14px; border-radius:6px; border:1px solid #10b981; background:rgba(16,185,129,0.18); color:#34d399; font-size:12px; font-weight:800; cursor:pointer;">
              ✅ Onayla
            </button>
            <button type="button" onclick="window.approveAndQueueReviewItem('${escapeHtml(item.id)}')" style="padding:6px 14px; border-radius:6px; border:1px solid #d4af37; background:linear-gradient(135deg,#d4af37,#9b7220); color:#0b1120; font-size:12px; font-weight:800; cursor:pointer;">
              🚀 Onayla ve Kuyruğa Gönder
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

export function onReviewItemCheckboxChange() {
  const checked = document.querySelectorAll('.cmp-item-select-chk:checked');
  const countEl = document.getElementById('cmpReviewSelectedCount');
  if (countEl) countEl.textContent = `${checked.length} öğe seçildi`;
}

export function toggleSelectAllReviewItems(masterCheckbox) {
  const boxes = document.querySelectorAll('.cmp-item-select-chk');
  boxes.forEach(b => { b.checked = masterCheckbox.checked; });
  onReviewItemCheckboxChange();
}

// Tekil İçerik Alanlarını Kaydet
export async function saveReviewItemChanges(itemId) {
  const card = document.querySelector(`.cmp-review-card[data-item-id="${itemId}"]`);
  if (!card) return;

  const title = card.querySelector('.rev-inp-title')?.value.trim();
  const caption = card.querySelector('.rev-inp-caption')?.value;
  const hashtags = card.querySelector('.rev-inp-hashtags')?.value;
  const scheduledFor = card.querySelector('.rev-inp-time')?.value;
  const targetLink = card.querySelector('.rev-inp-link')?.value.trim();

  try {
    const res = await fetch('/api/module2?action=campaign-item-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: itemId,
        title,
        caption,
        hashtags,
        scheduled_for: scheduledFor,
        target_link: targetLink
      })
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || 'Kaydedilemedi');
    if (typeof window.showToast === 'function') window.showToast('✅ Değişiklikler başarıyla kaydedildi.');
    await refreshActiveCampaignReview();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

// Revizyon İste
export async function requestItemRevision(itemId) {
  const notes = prompt('Revizyon gerekçesini veya istenen düzeltmeyi girin:');
  if (notes === null) return;

  try {
    const res = await fetch('/api/module2?action=campaign-item-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: itemId,
        status: 'revision_required',
        review_notes: notes
      })
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || 'İşlem başarısız');
    if (typeof window.showToast === 'function') window.showToast('✍️ İçerik revizyon durumuna alındı.');
    await refreshActiveCampaignReview();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

// İçeriği Beklet
export async function holdReviewItem(itemId) {
  try {
    const res = await fetch('/api/module2?action=campaign-item-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: itemId,
        status: 'pending_review'
      })
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || 'İşlem başarısız');
    if (typeof window.showToast === 'function') window.showToast('⏸️ İçerik inceleme durumunda bekletiliyor.');
    await refreshActiveCampaignReview();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

// Tekil İçerik Onayla
export async function approveReviewItem(itemId) {
  try {
    const res = await fetch('/api/module2?action=campaign-item-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: itemId,
        status: 'approved'
      })
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || 'Onaylanamadı');
    if (typeof window.showToast === 'function') window.showToast('✅ İçerik onaylandı!');
    await refreshActiveCampaignReview();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

// Tekil İçeriği Onayla ve Kuyruğa Gönder
export async function approveAndQueueReviewItem(itemId) {
  if (!confirm('Bu içeriği onaylayıp sosyal medya yayın kuyruğuna göndermek istiyor musunuz?')) return;

  try {
    const res = await fetch('/api/module2?action=campaign-approve-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: activeReviewCampaign?.id,
        item_id: itemId,
        approve: true
      })
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || 'Yayın kuyruğuna eklenemedi');
    if (typeof window.showToast === 'function') window.showToast('🚀 İçerik başarıyla yayın kuyruğuna aktarıldı!');
    await refreshActiveCampaignReview();
  } catch (err) {
    alert('Kuyruk Hatası: ' + err.message);
  }
}

// Tekil Video Sahnesini Yeniden Düzenle
export async function regenerateReviewScene(sceneId, itemId, sceneIndex) {
  const newSub = prompt(`Sahne ${sceneIndex} için yeni altyazı metni girin:`);
  if (newSub === null) return;

  try {
    const res = await fetch('/api/module2?action=campaign-scene-regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_id: sceneId,
        item_id: itemId,
        scene_index: sceneIndex,
        subtitle_text: newSub
      })
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || 'Sahne güncellenemedi');
    if (typeof window.showToast === 'function') window.showToast(`🎬 Sahne ${sceneIndex} başarıyla güncellendi.`);
    await refreshActiveCampaignReview();
  } catch (err) {
    alert('Sahne Düzenleme Hatası: ' + err.message);
  }
}

// Toplu Onayla
export async function bulkApproveSelectedReviewItems() {
  const selectedBoxes = Array.from(document.querySelectorAll('.cmp-item-select-chk:checked'));
  if (!selectedBoxes.length) {
    alert('Lütfen onaylamak istediğiniz içerikleri seçin.');
    return;
  }

  try {
    for (const chk of selectedBoxes) {
      await fetch('/api/module2?action=campaign-item-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: chk.value, status: 'approved' })
      });
    }
    if (typeof window.showToast === 'function') window.showToast(`✅ ${selectedBoxes.length} içerik onaylandı.`);
    await refreshActiveCampaignReview();
  } catch (err) {
    alert('Toplu Onay Hatası: ' + err.message);
  }
}

// Toplu Onaylıları Kuyruğa Gönder
export async function bulkQueueSelectedApprovedItems() {
  const selectedBoxes = Array.from(document.querySelectorAll('.cmp-item-select-chk:checked'));
  if (!selectedBoxes.length) {
    alert('Lütfen yayın kuyruğuna göndermek istediğiniz içerikleri seçin.');
    return;
  }

  const itemIds = selectedBoxes.map(b => b.value);

  if (!confirm(`Seçili ${itemIds.length} içerik paketini yayın kuyruğuna aktarmak istiyor musunuz?`)) return;

  const btn = document.getElementById('btnBulkQueueApproved');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Kuyruğa Aktarılıyor...';
  }

  try {
    const res = await fetch('/api/module2?action=campaign-approve-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: activeReviewCampaign?.id,
        item_ids: itemIds,
        approve: true
      })
    }).then(r => r.json());

    if (!res.ok) throw new Error(res.error || 'Kuyruğa aktarılamadı.');

    const queuedCount = (res.results || []).filter(r => r.queued).length;
    const ttWaitCount = (res.results || []).filter(r => r.status === 'awaiting_platform_connection').length;

    let msg = `🚀 ${queuedCount} içerik yayın kuyruğuna başarıyla eklendi!`;
    if (ttWaitCount > 0) {
      msg += ` (${ttWaitCount} TikTok içeriği API bağlantı doğrulaması bekliyor).`;
    }

    if (typeof window.showToast === 'function') window.showToast(msg);
    await refreshActiveCampaignReview();
  } catch (err) {
    alert('Kuyruk Gönderim Hatası: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🚀 Seçilen Onaylıları Yayın Kuyruğuna Gönder';
    }
  }
}

// ============================================================================
// MODÜL 8 APPROVED MEDIA INTEGRATION
// ============================================================================
let activePickerItemId = null;
let cachedM8MediaList = [];

function ensureM8PickerModalInDom() {
  if (document.getElementById('m8MediaPickerModal')) return;

  const html = `
    <div id="m8MediaPickerModal" class="campaign-modal-backdrop" style="display:none; position:fixed; inset:0; z-index:100030; background:rgba(3,7,18,0.92); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:16px;">
      <div class="campaign-modal-window" style="background:#0f172a; border:1px solid rgba(212,175,55,0.45); border-radius:18px; width:940px; max-width:96vw; max-height:90vh; overflow-y:auto; box-shadow:0 25px 70px rgba(0,0,0,0.85); color:#f8fafc; display:flex; flex-direction:column;">
        
        <!-- HEADER -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid rgba(148,163,184,0.18); background:linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.85)); position:sticky; top:0; z-index:20;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,#D4AF37,#8c6b1b); color:#030712; font-size:20px; font-weight:900; display:flex; align-items:center; justify-content:center;">
              ✨
            </div>
            <div>
              <h2 style="font-size:16px; font-weight:800; color:#fff; margin:0;">Modül 8 Stüdyo Medya Seçici</h2>
              <p id="m8PickerTargetHint" style="font-size:11.5px; color:#94a3b8; margin:2px 0 0;">Stüdyo render ve görsel varlıklarını seçin.</p>
            </div>
          </div>
          <button type="button" onclick="window.closeM8MediaPicker()" style="background:transparent; border:none; color:#94a3b8; font-size:22px; cursor:pointer;">✕</button>
        </div>

        <!-- FILTER BAR -->
        <div style="padding:14px 24px; border-bottom:1px solid rgba(148,163,184,0.12); display:flex; gap:12px; align-items:center; flex-wrap:wrap; background:rgba(15,23,42,0.6);">
          <select id="m8PickerFilterType" onchange="window.filterM8Picker()" style="padding:6px 12px; border-radius:6px; background:#090f1c; border:1px solid #334155; color:#fff; font-size:11.5px;">
            <option value="ALL">Tüm Varlık Türleri</option>
            <option value="render_output">Render Çıktıları</option>
            <option value="raw_photo">Ham Fotoğraflar</option>
            <option value="cinematic_video">Sinematik Videolar</option>
            <option value="ai_enhanced">AI İyileştirilmiş</option>
            <option value="3d_model">3D Modeller</option>
          </select>
          <input type="text" id="m8PickerSearchInp" oninput="window.filterM8Picker()" placeholder="Dosya adı veya koleksiyon ara..." style="flex:1; min-width:200px; padding:6px 12px; border-radius:6px; background:#090f1c; border:1px solid #334155; color:#fff; font-size:11.5px;">
          <span id="m8PickerCountBadge" style="font-size:11px; color:#cbd5e1; background:#1e293b; padding:4px 8px; border-radius:4px;">0 Varlık</span>
        </div>

        <!-- MEDIA GRID -->
        <div id="m8PickerGrid" style="padding:20px 24px; display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:16px;">
          <div style="text-align:center; padding:40px; color:#94a3b8; font-size:13px; grid-column:1/-1;">Modül 8 medya kütüphanesi taranıyor...</div>
        </div>

        <!-- FOOTER -->
        <div style="padding:14px 24px; border-top:1px solid rgba(148,163,184,0.18); display:flex; justify-content:space-between; align-items:center; background:#0b1120;">
          <span style="font-size:11px; color:#64748b;">🔗 Varlıklar fiziksel olarak çoğaltılmaz; referans URI ile kampanyaya güvenle bağlanır.</span>
          <button type="button" onclick="window.closeM8MediaPicker()" style="padding:7px 16px; border-radius:6px; border:1px solid #475569; background:rgba(30,41,59,0.7); color:#e2e8f0; font-size:12px; font-weight:700; cursor:pointer;">Vazgeç</button>
        </div>

      </div>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstElementChild);
}

export async function openM8MediaPickerForItem(itemId) {
  activePickerItemId = itemId;
  ensureM8PickerModalInDom();

  const modal = document.getElementById('m8MediaPickerModal');
  if (modal) modal.style.display = 'flex';

  const item = (activeReviewCampaign?.items || []).find(i => i.id === itemId);
  const hintEl = document.getElementById('m8PickerTargetHint');
  
  let targetAspect = '1:1';
  let formatLabel = '1:1 Kare / 4:5 Dikey';
  if (item) {
    if (['REELS', 'SHORTS', 'TIKTOK_VIDEO'].includes(item.content_type) || ['tiktok'].includes(item.platform)) {
      targetAspect = '9:16';
      formatLabel = '9:16 Dikey Video/Story';
    } else if (item.platform === 'youtube' && !['SHORTS'].includes(item.content_type)) {
      targetAspect = '16:9';
      formatLabel = '16:9 Yatay';
    }
    if (hintEl) {
      hintEl.innerHTML = `Hedef: <strong>${escapeHtml(item.platform.toUpperCase())}</strong> &bull; Format: <strong style="color:#fde68a;">${escapeHtml(formatLabel)}</strong> &bull; İdeal Oran: <code>${targetAspect}</code>`;
    }
  }

  try {
    const res = await fetch('/api/module8?action=media', { cache: 'no-store' }).then(r => r.json());
    cachedM8MediaList = Array.isArray(res?.media_assets) ? res.media_assets : [];
    renderM8PickerGrid(cachedM8MediaList, targetAspect);
  } catch (err) {
    const grid = document.getElementById('m8PickerGrid');
    if (grid) {
      grid.innerHTML = `<div style="text-align:center; padding:30px; color:#fca5a5; font-size:12px; grid-column:1/-1;">Modül 8 medya verisi yüklenemedi: ${escapeHtml(err.message)}</div>`;
    }
  }
}

export function closeM8MediaPicker() {
  const modal = document.getElementById('m8MediaPickerModal');
  if (modal) modal.style.display = 'none';
  activePickerItemId = null;
}

export function filterM8Picker() {
  const typeFilter = document.getElementById('m8PickerFilterType')?.value || 'ALL';
  const q = (document.getElementById('m8PickerSearchInp')?.value || '').toLowerCase().trim();

  const item = (activeReviewCampaign?.items || []).find(i => i.id === activePickerItemId);
  let targetAspect = '1:1';
  if (item && (['REELS', 'SHORTS', 'TIKTOK_VIDEO'].includes(item.content_type) || item.platform === 'tiktok')) {
    targetAspect = '9:16';
  }

  let list = cachedM8MediaList;
  if (typeFilter !== 'ALL') {
    list = list.filter(m => m.asset_type === typeFilter);
  }
  if (q) {
    list = list.filter(m =>
      (m.file_name && m.file_name.toLowerCase().includes(q)) ||
      (m.product_slug && m.product_slug.toLowerCase().includes(q)) ||
      (m.collection_id && m.collection_id.toLowerCase().includes(q))
    );
  }

  renderM8PickerGrid(list, targetAspect);
}

function renderM8PickerGrid(mediaList, targetAspect = '1:1') {
  const grid = document.getElementById('m8PickerGrid');
  const countBadge = document.getElementById('m8PickerCountBadge');
  if (countBadge) countBadge.textContent = `${mediaList.length} Varlık`;
  if (!grid) return;

  if (!mediaList.length) {
    grid.innerHTML = `
      <div style="text-align:center; padding:40px; color:#94a3b8; font-size:13px; grid-column:1/-1;">
        Kriterlere uygun Modül 8 medya varlığı bulunamadı.
      </div>
    `;
    return;
  }

  grid.innerHTML = mediaList.map(asset => {
    const isImage = (asset.mime_type || '').startsWith('image/');
    const isVideo = (asset.mime_type || '').startsWith('video/');
    const aspect = asset.aspect_ratio || (asset.width_px && asset.height_px ? (asset.height_px > asset.width_px ? '9:16' : asset.width_px === asset.height_px ? '1:1' : '16:9') : '1:1');
    const isCompatible = aspect === targetAspect || (targetAspect === '1:1' && aspect === '4:5');

    return `
      <div style="background:#090f1c; border:1px solid ${isCompatible ? 'rgba(16,185,129,0.5)' : '#334155'}; border-radius:10px; overflow:hidden; display:flex; flex-direction:column; position:relative;">
        <div style="position:relative; width:100%; height:140px; background:#020617; display:flex; align-items:center; justify-content:center; overflow:hidden;">
          ${isImage
            ? `<img src="${asset.public_url || asset.storage_path}" style="width:100%; height:100%; object-fit:cover;" loading="lazy">`
            : isVideo
              ? `<div style="font-size:36px;">🎥</div>`
              : `<div style="font-size:36px;">🧊</div>`
          }
          <span style="position:absolute; top:6px; left:6px; font-size:10px; font-weight:700; background:rgba(0,0,0,0.75); padding:2px 6px; border-radius:4px; color:#cbd5e1;">
            ${asset.asset_type}
          </span>
          ${isCompatible ? `
            <span style="position:absolute; top:6px; right:6px; font-size:10px; font-weight:800; background:rgba(16,185,129,0.85); color:#fff; padding:2px 7px; border-radius:4px;">
              ✓ Format Uyumlu
            </span>
          ` : `
            <span style="position:absolute; top:6px; right:6px; font-size:10px; background:rgba(30,41,59,0.8); color:#94a3b8; padding:2px 6px; border-radius:4px;">
              ${aspect}
            </span>
          `}
        </div>

        <div style="padding:10px 12px; display:flex; flex-direction:column; gap:6px; flex:1;">
          <strong style="font-size:12px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(asset.file_name)}">
            ${escapeHtml(asset.file_name)}
          </strong>
          <div style="display:flex; justify-content:space-between; font-size:10.5px; color:#94a3b8;">
            <span>${escapeHtml(asset.product_slug || asset.collection_id || 'Genel')}</span>
            <span>${(asset.file_size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
          </div>
          <button type="button" onclick="window.attachM8MediaToItem('${escapeHtml(asset.id)}')" style="margin-top:auto; padding:7px 12px; border-radius:6px; border:1px solid #d4af37; background:linear-gradient(135deg,#d4af37,#9b7220); color:#0b1120; font-size:11.5px; font-weight:800; cursor:pointer;">
            ✦ Bu Medyayı Bağla
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export async function attachM8MediaToItem(assetId) {
  if (!activePickerItemId || !activeReviewCampaign) return;

  const asset = cachedM8MediaList.find(m => m.id === assetId);
  const item = (activeReviewCampaign.items || []).find(i => i.id === activePickerItemId);

  if (!asset || !item) {
    alert('Varlık veya kampanya öğesi bulunamadı.');
    return;
  }

  const mediaUrl = asset.public_url || asset.storage_path;
  item.cover_url = mediaUrl;
  item.media_urls = [mediaUrl];
  item.source_asset_id = asset.id;
  item.asset_ref = {
    id: asset.id,
    file_name: asset.file_name,
    asset_type: asset.asset_type,
    resolution: asset.resolution || (asset.width_px && asset.height_px ? `${asset.width_px}x${asset.height_px}` : '1080x1080'),
    aspect_ratio: asset.aspect_ratio || '1:1'
  };

  // Close picker
  closeM8MediaPicker();

  // Re-render review cards immediately
  renderReviewCards();

  // Persist attachment asynchronously
  try {
    await fetch('/api/module2?action=campaign-item-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: item.id,
        cover_url: item.cover_url,
        media_urls: item.media_urls,
        source_asset_id: item.source_asset_id,
        asset_ref: item.asset_ref
      })
    });
  } catch (err) {
    console.warn('Medya bağlama persist uyarısı:', err);
  }

  if (typeof window.showToast === 'function') {
    window.showToast(`✨ Modül 8 varlığı (${asset.file_name}) başarıyla kampanyaya bağlandı.`);
  }
}

// Window export
if (typeof window !== 'undefined') {
  window.openCampaignStudioModal = openCampaignStudioModal;
  window.closeCampaignStudioModal = closeCampaignStudioModal;
  window.openCampaignReviewModal = openCampaignReviewModal;
  window.closeCampaignReviewModal = closeCampaignReviewModal;
  window.refreshActiveCampaignReview = refreshActiveCampaignReview;
  window.filterReviewPlatform = filterReviewPlatform;
  window.onReviewItemCheckboxChange = onReviewItemCheckboxChange;
  window.toggleSelectAllReviewItems = toggleSelectAllReviewItems;
  window.saveReviewItemChanges = saveReviewItemChanges;
  window.requestItemRevision = requestItemRevision;
  window.holdReviewItem = holdReviewItem;
  window.approveReviewItem = approveReviewItem;
  window.approveAndQueueReviewItem = approveAndQueueReviewItem;
  window.regenerateReviewScene = regenerateReviewScene;
  window.bulkApproveSelectedReviewItems = bulkApproveSelectedReviewItems;
  window.bulkQueueSelectedApprovedItems = bulkQueueSelectedApprovedItems;
  window.onCampaignKindChange = onCampaignKindChange;
  window.onCampaignTypeSelectChange = onCampaignTypeSelectChange;
  window.updateCampaignThemeInfo = updateCampaignThemeInfo;
  window.setCmpDiscount = setCmpDiscount;
  window.generateCampaignAiCopy = generateCampaignAiCopy;
  window.submitCampaignGeneration = submitCampaignGeneration;
  window.onMultiItemToggle = onMultiItemToggle;
  window.onSingleCollectionSelected = () => {};
  window.onSingleProductSelected = () => {};
  window.openM8MediaPickerForItem = openM8MediaPickerForItem;
  window.closeM8MediaPicker = closeM8MediaPicker;
  window.filterM8Picker = filterM8Picker;
  window.attachM8MediaToItem = attachM8MediaToItem;
}

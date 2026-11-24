(function () {
  const M1 = window.M1_DEFAULTS || {};
  const WEB_ORIGIN = M1.WEB_ORIGIN || 'https://beta.globalkapakmobilya.com';

  const state = {
    anasayfaV2: structuredClone(M1.ANASAYFA_V2),
    koleksiyonSayfasi: structuredClone(M1.KOLEKSIYON_SAYFASI),
    galeriSayfasi: structuredClone(M1.GALERI_SAYFASI),
    iletisimSayfasi: structuredClone(M1.ILETISIM_SAYFASI),
    genel: structuredClone(M1.GENEL_DEFAULT),
    hakkimizda: structuredClone(M1.HAKKIMIZDA_DEFAULT),
    collections: [],
    products: [],
    galleryItems: [],
    blogs: [],
    suppliers: [],
    activeTab: 'tab-home',
    activeHomeSub: 'hero',
    activeGalSub: 'showcase',
    activeOtherSub: 'about',
    editingColSlug: null,
    editingProdSlug: null,
    editingPhotoSlug: null,
    editingBlogSlug: null,
    editingSupSlug: null,
  };

  function deepMerge(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
    const out = Array.isArray(target) ? [...target] : { ...target };
    for (const [k, v] of Object.entries(source)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        out[k] = structuredClone(v);
      } else if (typeof v === 'object' && target && typeof target[k] === 'object' && !Array.isArray(target[k])) {
        out[k] = deepMerge(target[k], v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  function esc(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function resolvePreviewUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return `${WEB_ORIGIN}/resim/logo.png`;
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
    return `${WEB_ORIGIN}/${raw.replace(/^\/+/, '')}`;
  }

  function showToast(msg, type = 'success') {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type);
      return;
    }
    const toast = document.getElementById('toastMsg');
    const txt = document.getElementById('toastText');
    const icon = document.getElementById('toastIcon');
    if (toast && txt) {
      toast.className = 'toast show ' + type;
      txt.textContent = msg;
      if (icon) icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
      setTimeout(() => toast.classList.remove('show'), 4200);
    }
  }

  async function getAuthHeaders() {
    let token = '';
    try {
      if (window.top?.Clerk?.session) token = await window.top.Clerk.session.getToken();
      else if (window.Clerk?.session) token = await window.Clerk.session.getToken();
    } catch (_) {}
    if (!token) {
      token = sessionStorage.getItem('gm_clerk_jwt') || '';
    }
    if (!token) {
      try {
        const raw = sessionStorage.getItem('gm_central_auth_v1') || localStorage.getItem('gm_central_auth_v1');
        if (raw) token = JSON.parse(raw)?.access_token || '';
      } catch (_) {}
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function apiFetch(url, options = {}) {
    const authHdr = await getAuthHeaders();
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHdr,
      ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, headers, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  async function uploadImageToR2(file, { folder = 'website', slug = 'medya' } = {}) {
    if (!file) throw new Error('Dosya seçilmedi.');
    const cleanSlug = slugify(slug) || 'medya';

    // Büyük dosyalar için doğrudan R2 imzalı yükleme
    if (file.size > 2.2 * 1024 * 1024) {
      const signRes = await apiFetch('/api/module7?action=media', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'sign',
          slug: cleanSlug,
          folder,
          mime_type: file.type || 'image/jpeg',
          file_size: file.size,
        }),
      });
      const putRes = await fetch(signRes.signed_upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      });
      if (!putRes.ok) throw new Error('Cloudflare R2 yüklemesi reddedildi.');
      return signRes.public_url;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Dosya okunamadı.'));
      reader.readAsDataURL(file);
    });

    const upRes = await apiFetch('/api/module7?action=media', {
      method: 'POST',
      body: JSON.stringify({ slug: cleanSlug, folder, data_url: dataUrl }),
    });
    return upRes.public_url;
  }

  function renderMediaInput({ inputId, previewId, value, label, folder = 'website', slug = 'site-img', hint = '' }) {
    const uid = inputId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `
      <div class="m1-media-field">
        ${label ? `<label>${esc(label)}</label>` : ''}
        <div class="m1-media-row">
          <img id="${esc(previewId || uid + '_prev')}" src="${esc(resolvePreviewUrl(value))}" alt="Önizleme"
               class="m1-media-thumb" onerror="this.src='${WEB_ORIGIN}/resim/logo.png'">
          <div class="m1-media-controls">
            <input type="text" class="form-control" id="${esc(inputId)}" value="${esc(value || '')}"
                   placeholder="https://cdn.globalkapakmobilya.com/... veya resim/..."
                   oninput="window.M1CMS.syncPreview('${esc(inputId)}','${esc(previewId || uid + '_prev')}')">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px;">
              <label class="btn-secondary btn-sm" style="cursor:pointer;margin:0;display:inline-flex;align-items:center;gap:6px;">
                📤 Bilgisayardan Yükle (R2)
                <input type="file" accept="image/*" style="display:none;"
                       onchange="window.M1CMS.handleMediaUpload(this,'${esc(inputId)}','${esc(previewId || uid + '_prev')}','${esc(folder)}','${esc(slug)}')">
              </label>
              ${hint ? `<span style="font-size:11px;color:var(--text-muted);">${esc(hint)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function saveSetting(key, dataObj, label) {
    await apiFetch('/api/module1-content', {
      method: 'POST',
      body: JSON.stringify({
        action: 'direct-save',
        entity_type: 'site_setting',
        entity_slug: key,
        payload: { data: dataObj },
      }),
    });
    showToast(`✅ ${label || key} kaydedildi ve canlı sitede yayına alındı.`, 'success');
  }

  async function fetchSettingDirect(key) {
    const client = window.module1SupabaseClient;
    if (!client) return null;
    try {
      const { data, error } = await client.from('site_settings').select('data').eq('key', key).limit(1);
      if (error || !data || !data[0]?.data) return null;
      return data[0].data;
    } catch {
      return null;
    }
  }

  async function loadAllData() {
    try {
      const [pubRes, colsRes, prodsRes, sAnaV2, sKol, sGal, sIlet, sHak, sGenel] = await Promise.all([
        fetch('/api/module7?action=b2c-public&fresh=1', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        apiFetch('/api/module7?action=collections').catch(() => null),
        apiFetch('/api/module7?action=products').catch(() => null),
        fetchSettingDirect('anasayfa_v2'),
        fetchSettingDirect('koleksiyon_sayfasi'),
        fetchSettingDirect('galeri_sayfasi'),
        fetchSettingDirect('iletisim_sayfasi'),
        fetchSettingDirect('hakkimizda'),
        fetchSettingDirect('genel'),
      ]);

      const cmsFromApi = pubRes?.cms || {};
      const anaRaw = sAnaV2 || cmsFromApi.anasayfa_v2;
      if (anaRaw) state.anasayfaV2 = deepMerge(structuredClone(M1.ANASAYFA_V2), anaRaw);

      const kolRaw = sKol || cmsFromApi.koleksiyon_sayfasi;
      if (kolRaw) state.koleksiyonSayfasi = deepMerge(structuredClone(M1.KOLEKSIYON_SAYFASI), kolRaw);

      const galRaw = sGal || cmsFromApi.galeri_sayfasi;
      if (galRaw) state.galeriSayfasi = deepMerge(structuredClone(M1.GALERI_SAYFASI), galRaw);

      const iletRaw = sIlet || cmsFromApi.iletisim_sayfasi;
      if (iletRaw) state.iletisimSayfasi = deepMerge(structuredClone(M1.ILETISIM_SAYFASI), iletRaw);

      const hakRaw = sHak || cmsFromApi.hakkimizda;
      if (hakRaw) state.hakkimizda = deepMerge(structuredClone(M1.HAKKIMIZDA_DEFAULT), hakRaw);

      const genelRaw = sGenel || cmsFromApi.genel;
      if (genelRaw) state.genel = deepMerge(structuredClone(M1.GENEL_DEFAULT), genelRaw);

      state.collections = Array.isArray(colsRes?.collections)
        ? colsRes.collections
        : Array.isArray(pubRes?.collections)
        ? pubRes.collections
        : [];

      const rawProds = Array.isArray(prodsRes?.products) ? prodsRes.products : [];
      state.products = rawProds.filter((p) => p && p.product_type !== 'collection' && p.product_type !== 'collection_piece');

      const client = window.module1SupabaseClient;
      if (client) {
        const [gRes, bRes, supRes] = await Promise.all([
          client.from('gallery').select('*').order('siralama', { ascending: false }),
          client.from('blogs').select('*').order('tarih', { ascending: false }),
          client.from('suppliers').select('*').order('siralama', { ascending: true }),
        ]);
        state.galleryItems = Array.isArray(gRes?.data) ? gRes.data : [];
        state.blogs = Array.isArray(bRes?.data) ? bRes.data : [];
        state.suppliers = Array.isArray(supRes?.data) ? supRes.data : [];
      }

      updateHeaderBadges();
      renderActiveTab();
    } catch (err) {
      console.error('Module 1 CMS yükleme hatası:', err);
      showToast('Veriler yüklenirken sorun oluştu: ' + err.message, 'error');
    }
  }

  function updateHeaderBadges() {
    const colBadge = document.getElementById('colCountBadge');
    const galBadge = document.getElementById('galIndepCountBadge');
    if (colBadge) colBadge.textContent = String(state.collections.length);
    if (galBadge) galBadge.textContent = String(state.products.length + state.galleryItems.length);
  }

  // ---------------------------------------------------------------------------
  // 1. ANA SAYFA YÖNETİMİ (100% DİNAMİK)
  // ---------------------------------------------------------------------------
  function renderHomeTab() {
    const host = document.getElementById('m1HomeMount');
    if (!host) return;
    const h = state.anasayfaV2;

    const subPills = [
      { id: 'hero', label: '🌟 Üst Vitrin & 5 Görsel' },
      { id: 'categories', label: '🧩 Kayan Şerit & 3 Kategori' },
      { id: 'atelier', label: '🛠️ Atölye, Rakamlar & İlkeler' },
      { id: 'nature', label: '🌿 Misyon & Doğayı Seviyoruz' },
      { id: 'bottom', label: '🖼️ Galeri/Blog Bandı & Teklif/Video' },
    ];

    let innerHtml = '';
    if (state.activeHomeSub === 'hero') {
      innerHtml = `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <div class="admin-card-title">🌟 Üst Hero Alanı & 5 Otomatik Dönen Sahne Görseli</div>
              <div class="admin-card-desc">Ana sayfaya giren ziyaretçinin gördüğü ilk ekranın tüm başlık, açıklama, buton ve 5 arka plan görselini yönetin.</div>
            </div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.saveHomeSection()">💾 Ana Sayfayı Yayınla</button>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Üst Etiket (Eyebrow)</label>
              <input type="text" class="form-control" id="h_eyebrow" value="${esc(h.hero.eyebrow)}">
            </div>
            <div class="form-group">
              <label>Slayt Geçiş Hızı (Milisaniye)</label>
              <input type="number" class="form-control" id="h_interval" value="${esc(h.hero.carousel_interval_ms || 5200)}" min="2000" max="15000" step="200">
            </div>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label>Başlık 1. Satır</label>
              <input type="text" class="form-control" id="h_b1" value="${esc(h.hero.baslik_1)}">
            </div>
            <div class="form-group">
              <label>Vurgulu İtalik Kelime</label>
              <input type="text" class="form-control" id="h_bhl" value="${esc(h.hero.baslik_highlight)}">
            </div>
            <div class="form-group">
              <label>Vurgu Devamı</label>
              <input type="text" class="form-control" id="h_b2" value="${esc(h.hero.baslik_2)}">
            </div>
          </div>

          <div class="form-group">
            <label>Manşet Açıklama Paragrafı</label>
            <textarea class="form-control" id="h_desc" rows="2">${esc(h.hero.alt_yazi)}</textarea>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>1. Buton Metni & Linki</label>
              <div style="display:flex;gap:8px;">
                <input type="text" class="form-control" id="h_cta1_t" value="${esc(h.hero.cta1_text)}">
                <input type="text" class="form-control" id="h_cta1_l" value="${esc(h.hero.cta1_link)}" placeholder="koleksiyon.html">
              </div>
            </div>
            <div class="form-group">
              <label>2. Buton Metni & Linki</label>
              <div style="display:flex;gap:8px;">
                <input type="text" class="form-control" id="h_cta2_t" value="${esc(h.hero.cta2_text)}">
                <input type="text" class="form-control" id="h_cta2_l" value="${esc(h.hero.cta2_link)}" placeholder="galeri.html#sectionBagimsiz">
              </div>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin:22px 0 12px;">
            <div class="admin-card-title" style="font-size:15px;">🖼️ Arka Plan Sahne Görselleri (${h.hero.slides.length} Adet)</div>
            <button type="button" class="btn-secondary btn-sm" onclick="window.M1CMS.addHeroSlide()">+ Sahne Ekle</button>
          </div>

          <div class="m1-stack-list">
            ${h.hero.slides
              .map(
                (sl, idx) => `
                <div class="m1-subcard">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <strong style="color:var(--gold);font-size:13px;">Sahne #${idx + 1}</strong>
                    ${
                      h.hero.slides.length > 1
                        ? `<button type="button" class="btn-danger btn-sm" onclick="window.M1CMS.removeHeroSlide(${idx})">Kaldır</button>`
                        : ''
                    }
                  </div>
                  <div class="form-group">
                    <label>Sahne Etiketi (Alt nokta açıklaması)</label>
                    <input type="text" class="form-control m1-hero-cap" data-idx="${idx}" value="${esc(sl.caption)}">
                  </div>
                  ${renderMediaInput({
                    inputId: `h_slide_img_${idx}`,
                    previewId: `h_slide_prev_${idx}`,
                    value: sl.image_url,
                    label: 'Sahne Arka Plan Görseli',
                    folder: 'website/hero',
                    slug: `hero-sahne-${idx + 1}`,
                  })}
                </div>`
              )
              .join('')}
          </div>
        </div>
      `;
    } else if (state.activeHomeSub === 'categories') {
      innerHtml = `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <div class="admin-card-title">🧩 Kayan Şerit & Üç Ana Koleksiyon Dünyası</div>
              <div class="admin-card-desc">Hero altındaki kayan yazı bandını ve 3 açılır koleksiyon kartını düzenleyin.</div>
            </div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.saveHomeSection()">💾 Ana Sayfayı Yayınla</button>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Kayan Şerit Maddeleri (Her satır bir madde)</label>
              <textarea class="form-control" id="h_marquee_items" rows="5">${esc((h.marquee.items || []).join('\n'))}</textarea>
            </div>
            <div class="form-group">
              <label>Kayan Şerit Hız Süresi (ms — büyüdükçe yavaşlar)</label>
              <input type="number" class="form-control" id="h_marquee_dur" value="${esc(h.marquee.duration_ms || 34000)}" min="8000" max="90000" step="1000">
            </div>
          </div>

          <hr class="m1-sep">
          <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">Koleksiyon Dünyaları Bölümü</div>
          <div class="form-grid-3">
            <div class="form-group"><label>Üst Etiket</label><input type="text" class="form-control" id="hc_kicker" value="${esc(h.categories_section.kicker)}"></div>
            <div class="form-group"><label>Başlık Önü</label><input type="text" class="form-control" id="hc_tp" value="${esc(h.categories_section.title_prefix)}"></div>
            <div class="form-group"><label>Vurgulu Kelime + Devamı</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="hc_th" value="${esc(h.categories_section.title_highlight)}"><input type="text" class="form-control" id="hc_ts" value="${esc(h.categories_section.title_suffix)}"></div></div>
          </div>
          <div class="form-group"><label>Bölüm Açıklaması</label><textarea class="form-control" id="hc_lead" rows="2">${esc(h.categories_section.lead)}</textarea></div>

          <div class="m1-stack-list">
            ${h.categories_section.panels
              .map(
                (pn, idx) => `
                <div class="m1-subcard">
                  <strong style="color:var(--gold);display:block;margin-bottom:10px;">Kategori Kartı #${idx + 1}: ${esc(pn.category)}</strong>
                  <div class="form-group"><label>Kart Başlığı</label><input type="text" class="form-control" id="hc_p_title_${idx}" value="${esc(pn.title)}"></div>
                  <div class="form-group"><label>Kart Açıklaması</label><textarea class="form-control" id="hc_p_desc_${idx}" rows="2">${esc(pn.desc)}</textarea></div>
                  ${renderMediaInput({
                    inputId: `hc_p_img_${idx}`,
                    previewId: `hc_p_prev_${idx}`,
                    value: pn.image_url,
                    label: 'Kategori Kartı Kapak Görseli',
                    folder: 'website/categories',
                    slug: `cat-panel-${idx + 1}`,
                  })}
                </div>`
              )
              .join('')}
          </div>
        </div>
      `;
    } else if (state.activeHomeSub === 'atelier') {
      innerHtml = `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <div class="admin-card-title">🛠️ Atölye Hikayesi, Rakamlar & Zanaat İlkelerimiz</div>
              <div class="admin-card-desc">Ana sayfadaki "Atölyeden Yaşama", sayaçlar ve 6 maddeli İlkelerimiz orbit kartlarını düzenleyin.</div>
            </div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.saveHomeSection()">💾 Ana Sayfayı Yayınla</button>
          </div>

          ${renderMediaInput({
            inputId: 'ha_img',
            previewId: 'ha_img_prev',
            value: h.atelier_about.image_url,
            label: 'Atölye Bölümü Sol Görseli',
            folder: 'website/atelier',
            slug: 'atelier-craft',
          })}

          <div class="form-grid" style="margin-top:14px;">
            <div class="form-group"><label>Görsel Üstü Rozet Başlık</label><input type="text" class="form-control" id="ha_badge_t" value="${esc(h.atelier_about.badge_title)}"></div>
            <div class="form-group"><label>Görsel Üstü Rozet Alt Yazı</label><input type="text" class="form-control" id="ha_badge_s" value="${esc(h.atelier_about.badge_sub)}"></div>
          </div>

          <div class="form-grid-3">
            <div class="form-group"><label>Bölüm Etiketi</label><input type="text" class="form-control" id="ha_kicker" value="${esc(h.atelier_about.kicker)}"></div>
            <div class="form-group"><label>Başlık Önü</label><input type="text" class="form-control" id="ha_tp" value="${esc(h.atelier_about.title_prefix)}"></div>
            <div class="form-group"><label>Vurgu & Devam</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="ha_th" value="${esc(h.atelier_about.title_highlight)}"><input type="text" class="form-control" id="ha_ts" value="${esc(h.atelier_about.title_suffix)}"></div></div>
          </div>

          <div class="form-group"><label>Atölye Tanıtım Paragrafı</label><textarea class="form-control" id="ha_story" rows="3">${esc(h.atelier_about.story)}</textarea></div>

          <div class="form-grid">
            ${h.atelier_about.pillars
              .map(
                (pl, idx) => `
                <div class="m1-subcard">
                  <div class="form-group"><label>Zanaat Sütunu #${idx + 1} Başlık</label><input type="text" class="form-control" id="ha_pl_t_${idx}" value="${esc(pl.title)}"></div>
                  <div class="form-group" style="margin-bottom:0;"><label>Açıklama</label><textarea class="form-control" id="ha_pl_d_${idx}" rows="2">${esc(pl.desc)}</textarea></div>
                </div>`
              )
              .join('')}
          </div>

          <hr class="m1-sep">
          <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">Rakamlar Bandı (4 Gösterge Kartı)</div>
          <div class="form-grid">
            ${h.stats_band
              .map(
                (st, idx) => `
                <div class="m1-subcard">
                  <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:8px;">
                    <div class="form-group" style="margin-bottom:0;"><label>Görünen Değer #${idx + 1}</label><input type="text" class="form-control" id="hs_disp_${idx}" value="${esc(st.display)}"></div>
                    <div class="form-group" style="margin-bottom:0;"><label>Alt Etiket</label><input type="text" class="form-control" id="hs_lbl_${idx}" value="${esc(st.label)}"></div>
                  </div>
                </div>`
              )
              .join('')}
          </div>

          <hr class="m1-sep">
          <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">Çalışma ve Zanaat İlkelerimiz (6 Kart)</div>
          <div class="form-grid-3">
            <div class="form-group"><label>Üst Etiket</label><input type="text" class="form-control" id="hp_eye" value="${esc(h.principles.eyebrow)}"></div>
            <div class="form-group"><label>Başlık</label><input type="text" class="form-control" id="hp_tp" value="${esc(h.principles.title_prefix)}"></div>
            <div class="form-group"><label>Vurgu</label><input type="text" class="form-control" id="hp_th" value="${esc(h.principles.title_highlight)}"></div>
          </div>
          <div class="form-group"><label>Merkez Açıklama</label><textarea class="form-control" id="hp_lead" rows="2">${esc(h.principles.lead)}</textarea></div>
          <div class="form-grid">
            ${h.principles.cards
              .map(
                (c, idx) => `
                <div class="m1-subcard">
                  <div class="form-group"><label>İlke #${idx + 1} Başlık</label><input type="text" class="form-control" id="hp_c_t_${idx}" value="${esc(c.title)}"></div>
                  <div class="form-group" style="margin-bottom:0;"><label>İlke Açıklaması</label><textarea class="form-control" id="hp_c_d_${idx}" rows="2">${esc(c.desc)}</textarea></div>
                </div>`
              )
              .join('')}
          </div>
        </div>
      `;
    } else if (state.activeHomeSub === 'nature') {
      innerHtml = `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <div class="admin-card-title">🌿 Misyon, Vizyon & "Doğayı Seviyoruz" Sarmaşık Sahnesi</div>
              <div class="admin-card-desc">Kurumsal perspektif metinleri ve animasyonlu doğa manifestosu bölümünü düzenleyin.</div>
            </div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.saveHomeSection()">💾 Ana Sayfayı Yayınla</button>
          </div>

          <div class="form-grid-3">
            <div class="form-group"><label>Misyon/Vizyon Etiket</label><input type="text" class="form-control" id="hmv_kicker" value="${esc(h.mission_vision.kicker)}"></div>
            <div class="form-group"><label>Başlık</label><input type="text" class="form-control" id="hmv_tp" value="${esc(h.mission_vision.title_prefix)}"></div>
            <div class="form-group"><label>Vurgu</label><input type="text" class="form-control" id="hmv_th" value="${esc(h.mission_vision.title_highlight)}"></div>
          </div>
          <div class="form-group"><label>Alt Açıklama</label><input type="text" class="form-control" id="hmv_lead" value="${esc(h.mission_vision.lead)}"></div>

          <div class="form-grid">
            <div class="m1-subcard">
              <div class="form-group"><label>Misyon Başlık</label><input type="text" class="form-control" id="hm_title" value="${esc(h.mission_vision.mission_title)}"></div>
              <div class="form-group" style="margin-bottom:0;"><label>Misyon Metni</label><textarea class="form-control" id="hm_text" rows="4">${esc(h.mission_vision.mission_text)}</textarea></div>
            </div>
            <div class="m1-subcard">
              <div class="form-group"><label>Vizyon Başlık</label><input type="text" class="form-control" id="hv_title" value="${esc(h.mission_vision.vision_title)}"></div>
              <div class="form-group" style="margin-bottom:0;"><label>Vizyon Metni</label><textarea class="form-control" id="hv_text" rows="4">${esc(h.mission_vision.vision_text)}</textarea></div>
            </div>
          </div>

          <hr class="m1-sep">
          <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">🌱 Doğayı Seviyoruz Alanı</div>
          <div class="form-grid">
            <div class="form-group"><label>Üst Etiket</label><input type="text" class="form-control" id="hn_kicker" value="${esc(h.nature_section.kicker)}"></div>
            <div class="form-group"><label>Başlık (Ön / Vurgu / Devam)</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="hn_tp" value="${esc(h.nature_section.title_prefix)}"><input type="text" class="form-control" id="hn_th" value="${esc(h.nature_section.title_highlight)}"><input type="text" class="form-control" id="hn_ts" value="${esc(h.nature_section.title_suffix)}"></div></div>
          </div>
          <div class="form-group"><label>Doğa Manifestosu Metni</label><textarea class="form-control" id="hn_lead" rows="3">${esc(h.nature_section.lead)}</textarea></div>

          <div class="form-grid-3">
            ${h.nature_section.pillars
              .map(
                (p, idx) => `
                <div class="m1-subcard">
                  <div class="form-group"><label>Madde #${idx + 1} Başlık</label><input type="text" class="form-control" id="hn_p_t_${idx}" value="${esc(p.title)}"></div>
                  <div class="form-group" style="margin-bottom:0;"><label>Açıklama</label><textarea class="form-control" id="hn_p_d_${idx}" rows="3">${esc(p.desc)}</textarea></div>
                </div>`
              )
              .join('')}
          </div>
        </div>
      `;
    } else {
      innerHtml = `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <div class="admin-card-title">🖼️ Tedarikçiler, Bloglar, Galeri Tanıtım & Hızlı Teklif Alanları</div>
              <div class="admin-card-desc">Ana sayfanın alt bölümlerindeki tüm başlık, görsel, açıklama ve butonları yönetin.</div>
            </div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.saveHomeSection()">💾 Ana Sayfayı Yayınla</button>
          </div>

          <div class="form-grid">
            <div class="m1-subcard">
              <strong style="color:var(--gold);display:block;margin-bottom:8px;">Tedarikçilerimiz Bandı</strong>
              <div class="form-group"><label>Üst Etiket</label><input type="text" class="form-control" id="hpa_eye" value="${esc(h.partners_section.eyebrow)}"></div>
              <div class="form-group"><label>Başlık & Vurgu</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="hpa_tp" value="${esc(h.partners_section.title_prefix)}"><input type="text" class="form-control" id="hpa_th" value="${esc(h.partners_section.title_highlight)}"></div></div>
              <div class="form-group" style="margin-bottom:0;"><label>Açıklama</label><textarea class="form-control" id="hpa_lead" rows="2">${esc(h.partners_section.lead)}</textarea></div>
            </div>

            <div class="m1-subcard">
              <strong style="color:var(--gold);display:block;margin-bottom:8px;">Bloglar Bandı</strong>
              <div class="form-group"><label>Üst Etiket & Buton</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="hbl_eye" value="${esc(h.blogs_section.eyebrow)}"><input type="text" class="form-control" id="hbl_cta" value="${esc(h.blogs_section.cta_text)}"></div></div>
              <div class="form-group"><label>Başlık / Vurgu / Devam</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="hbl_tp" value="${esc(h.blogs_section.title_prefix)}"><input type="text" class="form-control" id="hbl_th" value="${esc(h.blogs_section.title_highlight)}"><input type="text" class="form-control" id="hbl_ts" value="${esc(h.blogs_section.title_suffix)}"></div></div>
              <div class="form-group" style="margin-bottom:0;"><label>Açıklama</label><textarea class="form-control" id="hbl_lead" rows="2">${esc(h.blogs_section.lead)}</textarea></div>
            </div>
          </div>

          <hr class="m1-sep">
          <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">Galeri & Bağımsız Ürünler Sunum Bandı</div>
          <div class="form-grid-3">
            <div class="form-group"><label>Etiket</label><input type="text" class="form-control" id="hgp_kicker" value="${esc(h.gallery_promo.kicker)}"></div>
            <div class="form-group"><label>Başlık (Ön/Vurgu/Son)</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="hgp_tp" value="${esc(h.gallery_promo.title_prefix)}"><input type="text" class="form-control" id="hgp_th" value="${esc(h.gallery_promo.title_highlight)}"><input type="text" class="form-control" id="hgp_ts" value="${esc(h.gallery_promo.title_suffix)}"></div></div>
            <div class="form-group"><label>Sağ Kart Başlığı</label><input type="text" class="form-control" id="hgp_rt" value="${esc(h.gallery_promo.right_title)}"></div>
          </div>
          <div class="form-group"><label>Üst Bölüm Açıklaması</label><textarea class="form-control" id="hgp_lead" rows="2">${esc(h.gallery_promo.lead)}</textarea></div>

          <div class="form-grid">
            <div class="m1-subcard">
              <div class="form-group"><label>Sol Kart Etiketi & Başlığı</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="hgp_lk" value="${esc(h.gallery_promo.left_kicker)}"><input type="text" class="form-control" id="hgp_lt" value="${esc(h.gallery_promo.left_title)}"></div></div>
              <div class="form-group"><label>Sol Kart Açıklaması</label><textarea class="form-control" id="hgp_ld" rows="2">${esc(h.gallery_promo.left_desc)}</textarea></div>
              <div class="form-group" style="margin-bottom:0;"><label>Sol Buton</label><input type="text" class="form-control" id="hgp_lb" value="${esc(h.gallery_promo.left_btn)}"></div>
            </div>
            <div class="m1-subcard">
              ${renderMediaInput({
                inputId: 'hgp_rimg',
                previewId: 'hgp_rimg_prev',
                value: h.gallery_promo.right_image,
                label: 'Sağ Vitrin Kartı Görseli',
                folder: 'website/home-gallery',
                slug: 'home-gallery-card',
              })}
              <div class="form-group" style="margin-top:8px;"><label>Sağ Kart Açıklaması</label><textarea class="form-control" id="hgp_rd" rows="2">${esc(h.gallery_promo.right_desc)}</textarea></div>
              <div class="form-group" style="margin-bottom:0;"><label>Sağ Buton</label><input type="text" class="form-control" id="hgp_rb" value="${esc(h.gallery_promo.right_btn)}"></div>
            </div>
          </div>

          <hr class="m1-sep">
          <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">Hızlı Teklif & Ölçü Bölümü (Sayfa Sonu)</div>
          <div class="form-grid-3">
            <div class="form-group"><label>Üst Etiket</label><input type="text" class="form-control" id="hqq_kicker" value="${esc(h.quick_quote.kicker)}"></div>
            <div class="form-group"><label>Başlık (Ön/Vurgu/Son)</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="hqq_tp" value="${esc(h.quick_quote.title_prefix)}"><input type="text" class="form-control" id="hqq_th" value="${esc(h.quick_quote.title_highlight)}"><input type="text" class="form-control" id="hqq_ts" value="${esc(h.quick_quote.title_suffix)}"></div></div>
            <div class="form-group"><label>Buton Yazıları</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="hqq_wa" value="${esc(h.quick_quote.wa_btn_text)}"><input type="text" class="form-control" id="hqq_ct" value="${esc(h.quick_quote.contact_btn_text)}"></div></div>
          </div>
          <div class="form-group"><label>Açıklama Metni</label><textarea class="form-control" id="hqq_lead" rows="2">${esc(h.quick_quote.lead)}</textarea></div>

          <hr class="m1-sep">
          <div class="admin-card-title" style="font-size:15px;margin-bottom:10px;">🎬 Kurumsal Tanıtım Videosu (Opsiyonel Band)</div>
          <div class="form-grid-3">
            <div class="form-group"><label>Durum</label><label style="display:flex;align-items:center;gap:8px;padding-top:8px;font-weight:600;cursor:pointer;"><input type="checkbox" id="hvid_aktif" ${h.video?.aktif ? 'checked' : ''}> Ana Sayfada Göster</label></div>
            <div class="form-group"><label>Video Bölüm Başlığı</label><input type="text" class="form-control" id="hvid_title" value="${esc(h.video?.baslik || '')}"></div>
            <div class="form-group"><label>Video Dosya URL (.mp4 / R2)</label><input type="text" class="form-control" id="hvid_url" value="${esc(h.video?.video_url || h.video?.harici_url || '')}" placeholder="https://cdn.globalkapakmobilya.com/..."></div>
          </div>
          <div class="form-group" style="margin-bottom:0;"><label>Video Açıklaması</label><input type="text" class="form-control" id="hvid_desc" value="${esc(h.video?.aciklama || '')}"></div>
        </div>
      `;
    }

    host.innerHTML = `
      <div class="m1-subtabs">
        ${subPills
          .map(
            (p) => `<button type="button" class="m1-subtab-btn ${state.activeHomeSub === p.id ? 'active' : ''}"
                      onclick="window.M1CMS.switchHomeSub('${p.id}')">${p.label}</button>`
          )
          .join('')}
      </div>
      ${innerHtml}
    `;
  }

  function collectCurrentHomeSubIntoState() {
    const h = state.anasayfaV2;
    const val = (id) => document.getElementById(id)?.value?.trim();

    if (state.activeHomeSub === 'hero' && document.getElementById('h_eyebrow')) {
      h.hero.eyebrow = val('h_eyebrow') ?? h.hero.eyebrow;
      h.hero.baslik_1 = val('h_b1') ?? h.hero.baslik_1;
      h.hero.baslik_highlight = val('h_bhl') ?? h.hero.baslik_highlight;
      h.hero.baslik_2 = val('h_b2') ?? h.hero.baslik_2;
      h.hero.alt_yazi = val('h_desc') ?? h.hero.alt_yazi;
      h.hero.cta1_text = val('h_cta1_t') ?? h.hero.cta1_text;
      h.hero.cta1_link = val('h_cta1_l') ?? h.hero.cta1_link;
      h.hero.cta2_text = val('h_cta2_t') ?? h.hero.cta2_text;
      h.hero.cta2_link = val('h_cta2_l') ?? h.hero.cta2_link;
      h.hero.carousel_interval_ms = Number(val('h_interval') || 5200);
      h.hero.slides = h.hero.slides.map((sl, idx) => ({
        image_url: val(`h_slide_img_${idx}`) || sl.image_url,
        caption: document.querySelector(`.m1-hero-cap[data-idx="${idx}"]`)?.value?.trim() || sl.caption,
      }));
    } else if (state.activeHomeSub === 'categories' && document.getElementById('hc_kicker')) {
      const lines = (document.getElementById('h_marquee_items')?.value || '')
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (lines.length) h.marquee.items = lines;
      h.marquee.duration_ms = Number(val('h_marquee_dur') || 34000);
      h.categories_section.kicker = val('hc_kicker') ?? '';
      h.categories_section.title_prefix = val('hc_tp') ?? '';
      h.categories_section.title_highlight = val('hc_th') ?? '';
      h.categories_section.title_suffix = val('hc_ts') ?? '';
      h.categories_section.lead = val('hc_lead') ?? '';
      h.categories_section.panels = h.categories_section.panels.map((pn, idx) => ({
        ...pn,
        title: val(`hc_p_title_${idx}`) || pn.title,
        desc: val(`hc_p_desc_${idx}`) || pn.desc,
        image_url: val(`hc_p_img_${idx}`) || pn.image_url,
      }));
    } else if (state.activeHomeSub === 'atelier' && document.getElementById('ha_story')) {
      h.atelier_about.image_url = val('ha_img') || h.atelier_about.image_url;
      h.atelier_about.badge_title = val('ha_badge_t') ?? '';
      h.atelier_about.badge_sub = val('ha_badge_s') ?? '';
      h.atelier_about.kicker = val('ha_kicker') ?? '';
      h.atelier_about.title_prefix = val('ha_tp') ?? '';
      h.atelier_about.title_highlight = val('ha_th') ?? '';
      h.atelier_about.title_suffix = val('ha_ts') ?? '';
      h.atelier_about.story = val('ha_story') ?? '';
      h.atelier_about.pillars = h.atelier_about.pillars.map((pl, idx) => ({
        title: val(`ha_pl_t_${idx}`) ?? pl.title,
        desc: val(`ha_pl_d_${idx}`) ?? pl.desc,
      }));
      h.stats_band = h.stats_band.map((st, idx) => ({
        ...st,
        display: val(`hs_disp_${idx}`) ?? st.display,
        label: val(`hs_lbl_${idx}`) ?? st.label,
      }));
      h.principles.eyebrow = val('hp_eye') ?? '';
      h.principles.title_prefix = val('hp_tp') ?? '';
      h.principles.title_highlight = val('hp_th') ?? '';
      h.principles.lead = val('hp_lead') ?? '';
      h.principles.cards = h.principles.cards.map((c, idx) => ({
        title: val(`hp_c_t_${idx}`) ?? c.title,
        desc: val(`hp_c_d_${idx}`) ?? c.desc,
      }));
    } else if (state.activeHomeSub === 'nature' && document.getElementById('hn_lead')) {
      h.mission_vision.kicker = val('hmv_kicker') ?? '';
      h.mission_vision.title_prefix = val('hmv_tp') ?? '';
      h.mission_vision.title_highlight = val('hmv_th') ?? '';
      h.mission_vision.lead = val('hmv_lead') ?? '';
      h.mission_vision.mission_title = val('hm_title') ?? '';
      h.mission_vision.mission_text = val('hm_text') ?? '';
      h.mission_vision.vision_title = val('hv_title') ?? '';
      h.mission_vision.vision_text = val('hv_text') ?? '';
      h.nature_section.kicker = val('hn_kicker') ?? '';
      h.nature_section.title_prefix = val('hn_tp') ?? '';
      h.nature_section.title_highlight = val('hn_th') ?? '';
      h.nature_section.title_suffix = val('hn_ts') ?? '';
      h.nature_section.lead = val('hn_lead') ?? '';
      h.nature_section.pillars = h.nature_section.pillars.map((p, idx) => ({
        title: val(`hn_p_t_${idx}`) ?? p.title,
        desc: val(`hn_p_d_${idx}`) ?? p.desc,
      }));
    } else if (state.activeHomeSub === 'bottom' && document.getElementById('hgp_lead')) {
      h.partners_section.eyebrow = val('hpa_eye') ?? '';
      h.partners_section.title_prefix = val('hpa_tp') ?? '';
      h.partners_section.title_highlight = val('hpa_th') ?? '';
      h.partners_section.lead = val('hpa_lead') ?? '';
      h.blogs_section.eyebrow = val('hbl_eye') ?? '';
      h.blogs_section.cta_text = val('hbl_cta') ?? '';
      h.blogs_section.title_prefix = val('hbl_tp') ?? '';
      h.blogs_section.title_highlight = val('hbl_th') ?? '';
      h.blogs_section.title_suffix = val('hbl_ts') ?? '';
      h.blogs_section.lead = val('hbl_lead') ?? '';
      h.gallery_promo.kicker = val('hgp_kicker') ?? '';
      h.gallery_promo.title_prefix = val('hgp_tp') ?? '';
      h.gallery_promo.title_highlight = val('hgp_th') ?? '';
      h.gallery_promo.title_suffix = val('hgp_ts') ?? '';
      h.gallery_promo.lead = val('hgp_lead') ?? '';
      h.gallery_promo.left_kicker = val('hgp_lk') ?? '';
      h.gallery_promo.left_title = val('hgp_lt') ?? '';
      h.gallery_promo.left_desc = val('hgp_ld') ?? '';
      h.gallery_promo.left_btn = val('hgp_lb') ?? '';
      h.gallery_promo.right_image = val('hgp_rimg') || h.gallery_promo.right_image;
      h.gallery_promo.right_kicker = h.gallery_promo.right_kicker;
      h.gallery_promo.right_title = val('hgp_rt') ?? '';
      h.gallery_promo.right_desc = val('hgp_rd') ?? '';
      h.gallery_promo.right_btn = val('hgp_rb') ?? '';
      h.quick_quote.kicker = val('hqq_kicker') ?? '';
      h.quick_quote.title_prefix = val('hqq_tp') ?? '';
      h.quick_quote.title_highlight = val('hqq_th') ?? '';
      h.quick_quote.title_suffix = val('hqq_ts') ?? '';
      h.quick_quote.wa_btn_text = val('hqq_wa') ?? '';
      h.quick_quote.contact_btn_text = val('hqq_ct') ?? '';
      h.quick_quote.lead = val('hqq_lead') ?? '';
      h.video = {
        ...(h.video || {}),
        aktif: Boolean(document.getElementById('hvid_aktif')?.checked),
        baslik: val('hvid_title') ?? '',
        aciklama: val('hvid_desc') ?? '',
        video_url: val('hvid_url') ?? '',
        harici_url: val('hvid_url') ?? '',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2. KOLEKSİYONLAR YÖNETİMİ (KATEGORİ GİRİŞLERİ + SERİLER + AURORA + KATMANLAR)
  // ---------------------------------------------------------------------------
  function resolveWorldPresetForCol(col) {
    const s = String(col?.slug || col?.name || '').toLowerCase();
    const key = Object.keys(M1.WORLD_PRESETS).find((k) => k !== 'fallback' && s.includes(k));
    return M1.WORLD_PRESETS[key || 'fallback'];
  }

  function renderCollectionsTab() {
    const host = document.getElementById('m1CollectionsMount');
    if (!host) return;
    const intros = state.koleksiyonSayfasi.category_intros || {};

    if (state.editingColSlug !== null) {
      renderCollectionFormEditor(host);
      return;
    }

    const introCardsHtml = Object.entries(intros)
      .map(([catKey, info]) => {
        const uid = slugify(catKey);
        const au = info.aurora || {};
        return `
          <div class="m1-subcard">
            <strong style="color:var(--gold);display:block;margin-bottom:10px;">${esc(catKey)} Açılış Ekranı</strong>
            <div class="form-grid-3">
              <div class="form-group"><label>Üst Etiket</label><input type="text" class="form-control" id="ki_k_${uid}" value="${esc(info.kicker)}"></div>
              <div class="form-group"><label>Başlık Önü</label><input type="text" class="form-control" id="ki_tp_${uid}" value="${esc(info.title_prefix)}"></div>
              <div class="form-group"><label>İtalik Vurgu</label><input type="text" class="form-control" id="ki_te_${uid}" value="${esc(info.title_em)}"></div>
            </div>
            <div class="form-group"><label>Açıklama Metni</label><textarea class="form-control" id="ki_d_${uid}" rows="2">${esc(info.desc)}</textarea></div>
            <div class="form-grid">
              <div class="form-group"><label>Başla Buton Yazısı</label><input type="text" class="form-control" id="ki_cta_${uid}" value="${esc(info.cta_label || 'Gezmeye Başla')}"></div>
              <div class="form-group">
                <label>Açılış Aurora Renkleri (Zemin · Vurgu · Işıklar)</label>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                  ${['base', 'c1', 'c2', 'c3', 'c4', 'accent']
                    .map(
                      (ck) => `<label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--text-muted);margin:0;">
                                <input type="color" id="ki_au_${uid}_${ck}" value="${esc(au[ck] || '#16110D')}" style="width:28px;height:28px;border:none;background:none;cursor:pointer;">
                                ${ck}
                              </label>`
                    )
                    .join('')}
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    const colsListHtml = state.collections.length
      ? state.collections
          .map((c) => {
            const preset = resolveWorldPresetForCol(c);
            const cityLabel = c.city || preset.city;
            const visible = c.is_visible !== false;
            const hasScene = Boolean(c.scene_config?.modules?.length || /bergamo/i.test(c.slug || ''));
            return `
              <div class="product-card">
                <div class="product-card-img-wrap">
                  <img src="${esc(resolvePreviewUrl(c.hero_image_url || c.hero_image))}" alt="${esc(c.name || c.title)}"
                       onerror="this.src='${WEB_ORIGIN}/resim/logo.png'">
                  <span class="product-card-badge">${esc(c.category || 'Koleksiyon')}</span>
                </div>
                <div class="product-card-body">
                  <div style="font-size:11px;color:var(--gold);font-weight:700;margin-bottom:4px;">
                    📍 ${esc(cityLabel)} • Sıra: ${esc(c.sort_order ?? 0)} ${hasScene ? '• ✨ Animasyonlu Sahne' : ''}
                  </div>
                  <div class="product-card-title">${esc(c.name || c.title)}</div>
                  <div class="product-card-desc">${esc(c.design_story || c.short_description || '')}</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
                    <span class="badge" style="background:${visible ? 'rgba(16,185,129,0.18);color:#34d399' : 'rgba(239,68,68,0.18);color:#f87171'};">
                      ${visible ? '🟢 Sitede Yayında' : '⏸️ Gizli (Taslak)'}
                    </span>
                    <span class="badge">${(c.parts || c.pieces || []).length} Modül</span>
                  </div>
                  <div class="product-card-actions">
                    <button type="button" class="btn-primary btn-sm" style="flex:1;" onclick="window.M1CMS.openColEditor('${esc(c.slug)}')">✏️ Tümünü Düzenle</button>
                    <button type="button" class="btn-danger btn-sm" onclick="window.M1CMS.deleteCollection('${esc(c.slug)}')">🗑️</button>
                  </div>
                </div>
              </div>
            `;
          })
          .join('')
      : `<div style="padding:36px;text-align:center;color:var(--text-muted);">Kayıtlı koleksiyon bulunamadı.</div>`;

    host.innerHTML = `
      <div class="admin-card" style="margin-bottom:20px;">
        <div class="admin-card-header">
          <div>
            <div class="admin-card-title">🌍 3 Kategori Açılış Slaytları (Koleksiyon Giriş Ekranları)</div>
            <div class="admin-card-desc">Kahve Köşesi, Dolap ve Yatak Odası giriş ekranlarının başlık, açıklama ve gökyüzü öncesi renk atmosferini düzenleyin.</div>
          </div>
          <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.saveCollectionIntros()">💾 Giriş Ekranlarını Kaydet</button>
        </div>
        <div class="m1-stack-list">${introCardsHtml}</div>
      </div>

      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <div class="admin-card-title">🏛️ Canlı Koleksiyon Serileri & Sahneleri (${state.collections.length})</div>
            <div class="admin-card-desc">Her koleksiyonun görselini, arka plan Aurora renklerini, şehir/koordinatını, kartela renklerini ve yukarıdan inen mobilya/dekor katmanlarını özelleştirin.</div>
          </div>
          <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.openColEditor('__new__')">➕ Yeni Koleksiyon Oluştur</button>
        </div>
        <div class="product-grid">${colsListHtml}</div>
      </div>
    `;
  }

  let _draftColScene = null;

  function renderCollectionFormEditor(host) {
    const isNew = state.editingColSlug === '__new__';
    const existing = isNew ? {} : (state.collections.find((c) => c.slug === state.editingColSlug) || {});
    const preset = resolveWorldPresetForCol(existing);
    const au = existing.aurora || preset.aurora;
    const swatches = Array.isArray(existing.color_palette) && existing.color_palette.length ? existing.color_palette : preset.swatches;

    if (!_draftColScene) {
      const existingScene = existing.scene_config || (String(existing.slug || '').toLowerCase().includes('bergamo') ? preset.scene_config : null);
      _draftColScene = existingScene
        ? structuredClone(existingScene)
        : {
            enabled: false,
            background: { src: '/hero/bg.jpg', alt: 'Showroom Arka Planı' },
            finalMaster: { src: existing.hero_image_url || '/hero/bergamo-final.jpg', alt: 'Tam Stüdyo Sahnesi' },
            modules: [],
            decors: [],
          };
      if (existingScene) _draftColScene.enabled = true;
    }

    const sc = _draftColScene;

    host.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <div class="admin-card-title">${isNew ? '➕ Yeni Koleksiyon Oluştur' : `✏️ Koleksiyon Düzenle: ${esc(existing.name || existing.title)}`}</div>
            <div class="admin-card-desc">Kaydettiğiniz anda hem Modül 7 veritabanı hem de koleksiyon.html canlı sahnesi güncellenir.</div>
          </div>
          <button type="button" class="btn-secondary btn-sm" onclick="window.M1CMS.closeColEditor()">← Listeye Dön</button>
        </div>

        <form onsubmit="window.M1CMS.saveCollectionForm(event)">
          <div class="form-grid-3">
            <div class="form-group">
              <label>Koleksiyon Adı *</label>
              <input type="text" class="form-control" id="col_title" required value="${esc(existing.name || existing.title || '')}"
                     ${isNew ? 'oninput="document.getElementById(\'col_slug\').value = window.M1CMS.slugify(this.value)"' : ''}>
            </div>
            <div class="form-group">
              <label>Koleksiyon Kodu (Slug) *</label>
              <input type="text" class="form-control" id="col_slug" required value="${esc(existing.slug || '')}" ${isNew ? '' : 'readonly'}>
            </div>
            <div class="form-group">
              <label>Ana Kategori *</label>
              <select class="form-control" id="col_category">
                ${['Kahve Köşesi Koleksiyonları', 'Dolap Koleksiyonları', 'Yatak Odası Koleksiyonları']
                  .map((cat) => `<option value="${esc(cat)}" ${String(existing.category || '').includes(cat.split(' ')[0]) ? 'selected' : ''}>${esc(cat)}</option>`)
                  .join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Tasarım Hikayesi & Vitrin Açıklaması</label>
            <textarea class="form-control" id="col_story" rows="3">${esc(existing.design_story || existing.short_description || '')}</textarea>
          </div>

          <div class="form-grid">
            ${renderMediaInput({
              inputId: 'col_hero_img',
              previewId: 'col_hero_prev',
              value: existing.hero_image_url || existing.hero_image || '',
              label: 'Ana Vitrin Fotoğrafı *',
              folder: 'website/collections',
              slug: existing.slug || 'collection-hero',
            })}
            ${renderMediaInput({
              inputId: 'col_amb_img',
              previewId: 'col_amb_prev',
              value: existing.ambient_image_url || '',
              label: 'Arka Plan Bulanık Görsel (Opsiyonel — boşsa Ana Görsel kullanılır)',
              folder: 'website/collections',
              slug: (existing.slug || 'col') + '-ambient',
            })}
          </div>

          <div class="form-grid-3" style="margin-top:12px;">
            <div class="form-group"><label>Şehir Adı</label><input type="text" class="form-control" id="col_city" value="${esc(existing.city || preset.city)}"></div>
            <div class="form-group"><label>Ülke / Bölge</label><input type="text" class="form-control" id="col_country" value="${esc(existing.country || preset.country)}"></div>
            <div class="form-group"><label>Coğrafi Koordinatlar</label><input type="text" class="form-control" id="col_coords" value="${esc(existing.coords || preset.coords)}"></div>
          </div>

          <div class="form-grid-3">
            <div class="form-group"><label>Görüntülenme Sırası</label><input type="number" class="form-control" id="col_sort" value="${esc(existing.sort_order ?? 0)}"></div>
            <div class="form-group"><label>Kartela Renkleri (Hex, virgülle ayırın)</label><input type="text" class="form-control" id="col_swatches" value="${esc(swatches.join(', '))}" placeholder="#543C24, #8E765E, #CC9C3C"></div>
            <div class="form-group" style="display:flex;align-items:flex-end;">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 14px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;width:100%;">
                <input type="checkbox" id="col_visible" ${existing.is_visible !== false ? 'checked' : ''}> 🌐 Canlı Sitede Göster
              </label>
            </div>
          </div>

          <div class="m1-subcard" style="margin-top:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
              <strong style="color:var(--gold);font-size:13.5px;">🎨 Arka Plan Aurora Işık Renk Paleti</strong>
            </div>
            <div style="display:flex;gap:14px;flex-wrap:wrap;">
              ${['base', 'c1', 'c2', 'c3', 'c4', 'accent']
                .map(
                  (ck) => `<div style="display:flex;align-items:center;gap:6px;background:rgba(15,23,42,0.5);padding:6px 10px;border-radius:8px;">
                            <input type="color" id="col_au_${ck}" value="${esc(au[ck] || '#0E1C26')}" style="width:28px;height:28px;border:none;background:none;cursor:pointer;">
                            <span style="font-size:12px;color:var(--text-muted);">${ck}</span>
                          </div>`
                )
                .join('')}
            </div>
          </div>

          <!-- INTERACTIVE LAYERED SCENE CONFIG -->
          <div class="m1-subcard" style="margin-top:16px;border-color:rgba(56,189,248,0.35);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
              <div>
                <strong style="color:#38bdf8;font-size:14px;">✨ İnteraktif Animasyonlu Sahne & Katmanlı Yerleşim (Bergamo Mantığı)</strong>
                <div style="font-size:12px;color:var(--text-muted);">Aktif edildiğinde bulut geçişi sonrası mobilyalar yukarıdan iner, dekorlar sağ/soldan gelir ve üzerine gelince parça kartları vurgulanır.</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <button type="button" class="btn-secondary btn-sm" onclick="window.M1CMS.applyBergamoSceneTemplate()">📋 Bergamo Şablonunu Yükle</button>
                <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;cursor:pointer;margin:0;">
                  <input type="checkbox" id="col_scene_enabled" ${sc.enabled ? 'checked' : ''} onchange="window.M1CMS.toggleColScene(this.checked)"> Aktif
                </label>
              </div>
            </div>

            <div id="colSceneEditorBody" style="display:${sc.enabled ? 'block' : 'none'};">
              <div class="form-grid">
                ${renderMediaInput({
                  inputId: 'sc_bg_src',
                  previewId: 'sc_bg_prev',
                  value: sc.background?.src || '/hero/bg.jpg',
                  label: 'Boş Oda / Duvar Arka Plan Görseli',
                  folder: 'website/scenes',
                  slug: (existing.slug || 'col') + '-bg',
                })}
                ${renderMediaInput({
                  inputId: 'sc_final_src',
                  previewId: 'sc_final_prev',
                  value: sc.finalMaster?.src || '/hero/bergamo-final.jpg',
                  label: 'En Son Oturan Tam Stüdyo Fotoğrafı',
                  folder: 'website/scenes',
                  slug: (existing.slug || 'col') + '-final',
                })}
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 8px;">
                <strong style="font-size:13px;color:#fff;">Yukarıdan İnen Dolap / Modül PNG Katmanları (${(sc.modules || []).length})</strong>
                <button type="button" class="btn-secondary btn-sm" onclick="window.M1CMS.addSceneModule()">+ Modül Katmanı Ekle</button>
              </div>
              <div class="m1-stack-list">
                ${(sc.modules || [])
                  .map(
                    (m, idx) => `
                    <div class="m1-subcard" style="background:rgba(10,15,29,0.55);">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <strong style="font-size:12.5px;color:#DFC793;">Modül Katmanı #${idx + 1}: ${esc(m.label)}</strong>
                        <button type="button" class="btn-danger btn-sm" onclick="window.M1CMS.removeSceneModule(${idx})">Sil</button>
                      </div>
                      <div class="form-grid-3">
                        <div class="form-group"><label>Modül Başlığı</label><input type="text" class="form-control" id="sm_lbl_${idx}" value="${esc(m.label)}"></div>
                        <div class="form-group"><label>Üst Etiket</label><input type="text" class="form-control" id="sm_eye_${idx}" value="${esc(m.eyebrow)}"></div>
                        <div class="form-group"><label>Ölçü (G/Y/D)</label><input type="text" class="form-control" id="sm_dim_${idx}" value="${esc(m.dimensions)}"></div>
                      </div>
                      <div class="form-grid">
                        <div class="form-group"><label>Detay Sayfası Linki</label><input type="text" class="form-control" id="sm_lnk_${idx}" value="${esc(m.link)}"></div>
                        <div class="form-group"><label>Konum/Boyut % (Sol / Alt / Gen / Yük)</label>
                          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
                            <input type="number" step="0.01" class="form-control" id="sm_lp_${idx}" value="${esc(m.leftPct)}" title="Sol %">
                            <input type="number" step="0.01" class="form-control" id="sm_bp_${idx}" value="${esc(m.bottomPct)}" title="Alt %">
                            <input type="number" step="0.01" class="form-control" id="sm_wp_${idx}" value="${esc(m.widthPct)}" title="Genişlik %">
                            <input type="number" step="0.01" class="form-control" id="sm_hp_${idx}" value="${esc(m.heightPct)}" title="Yükseklik %">
                          </div>
                        </div>
                      </div>
                      ${renderMediaInput({
                        inputId: `sm_src_${idx}`,
                        previewId: `sm_prev_${idx}`,
                        value: m.src,
                        label: 'Modül PNG Görseli (Şeffaf Arka Plan)',
                        folder: 'website/scenes',
                        slug: `mod-${idx + 1}`,
                      })}
                    </div>`
                  )
                  .join('')}
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 8px;">
                <strong style="font-size:13px;color:#fff;">Sağ / Sol Ön Plan Dekor PNG Katmanları (${(sc.decors || []).length})</strong>
                <button type="button" class="btn-secondary btn-sm" onclick="window.M1CMS.addSceneDecor()">+ Dekor Katmanı Ekle</button>
              </div>
              <div class="m1-stack-list">
                ${(sc.decors || [])
                  .map(
                    (d, idx) => `
                    <div class="m1-subcard" style="background:rgba(10,15,29,0.55);">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <strong style="font-size:12.5px;color:#38bdf8;">Dekor #${idx + 1}</strong>
                        <button type="button" class="btn-danger btn-sm" onclick="window.M1CMS.removeSceneDecor(${idx})">Sil</button>
                      </div>
                      <div class="form-grid-3">
                        <div class="form-group"><label>Geliş Yönü</label>
                          <select class="form-control" id="sd_side_${idx}">
                            <option value="left" ${d.side === 'left' ? 'selected' : ''}>Soldan Gel</option>
                            <option value="right" ${d.side === 'right' ? 'selected' : ''}>Sağdan Gel</option>
                          </select>
                        </div>
                        <div class="form-group"><label>Genişlik %</label><input type="number" step="0.01" class="form-control" id="sd_wp_${idx}" value="${esc(d.widthPct || 20)}"></div>
                        <div class="form-group"><label>Açıklama (Alt)</label><input type="text" class="form-control" id="sd_alt_${idx}" value="${esc(d.alt || '')}"></div>
                      </div>
                      ${renderMediaInput({
                        inputId: `sd_src_${idx}`,
                        previewId: `sd_prev_${idx}`,
                        value: d.src,
                        label: 'Dekor PNG Görseli',
                        folder: 'website/scenes',
                        slug: `decor-${idx + 1}`,
                      })}
                    </div>`
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div style="margin-top:20px;display:flex;gap:12px;">
            <button type="submit" class="btn-gold" id="btnSaveCol">💾 Koleksiyonu Kaydet & Yayınla</button>
            <button type="button" class="btn-secondary" onclick="window.M1CMS.closeColEditor()">İptal</button>
          </div>
        </form>
      </div>
    `;
  }

  function syncDraftSceneFromInputs() {
    if (!_draftColScene) return;
    _draftColScene.enabled = Boolean(document.getElementById('col_scene_enabled')?.checked);
    const bgSrc = document.getElementById('sc_bg_src')?.value?.trim();
    const finSrc = document.getElementById('sc_final_src')?.value?.trim();
    if (bgSrc) _draftColScene.background = { ...(_draftColScene.background || {}), src: bgSrc };
    if (finSrc) _draftColScene.finalMaster = { ...(_draftColScene.finalMaster || {}), src: finSrc };

    _draftColScene.modules = (_draftColScene.modules || []).map((m, idx) => ({
      ...m,
      label: document.getElementById(`sm_lbl_${idx}`)?.value?.trim() || m.label,
      eyebrow: document.getElementById(`sm_eye_${idx}`)?.value?.trim() || m.eyebrow,
      dimensions: document.getElementById(`sm_dim_${idx}`)?.value?.trim() || m.dimensions,
      link: document.getElementById(`sm_lnk_${idx}`)?.value?.trim() || m.link,
      leftPct: Number(document.getElementById(`sm_lp_${idx}`)?.value ?? m.leftPct ?? 20),
      bottomPct: Number(document.getElementById(`sm_bp_${idx}`)?.value ?? m.bottomPct ?? 13),
      widthPct: Number(document.getElementById(`sm_wp_${idx}`)?.value ?? m.widthPct ?? 22),
      heightPct: Number(document.getElementById(`sm_hp_${idx}`)?.value ?? m.heightPct ?? 70),
      src: document.getElementById(`sm_src_${idx}`)?.value?.trim() || m.src,
    }));

    _draftColScene.decors = (_draftColScene.decors || []).map((d, idx) => {
      const side = document.getElementById(`sd_side_${idx}`)?.value || d.side || 'left';
      return {
        ...d,
        side,
        leftPct: side === 'left' ? 0 : undefined,
        rightPct: side === 'right' ? 0 : undefined,
        bottomPct: 0,
        widthPct: Number(document.getElementById(`sd_wp_${idx}`)?.value ?? d.widthPct ?? 20),
        alt: document.getElementById(`sd_alt_${idx}`)?.value?.trim() || d.alt || '',
        src: document.getElementById(`sd_src_${idx}`)?.value?.trim() || d.src,
        entranceX: side === 'left' ? -115 : 115,
        entranceDelaySec: 0.88,
        entranceDurationSec: 0.58,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 3. GALERİ & BAĞIMSIZ ÜRÜNLER YÖNETİMİ
  // ---------------------------------------------------------------------------
  function renderGalleryTab() {
    const host = document.getElementById('m1GalleryMount');
    if (!host) return;
    const g = state.galeriSayfasi;

    if (state.editingProdSlug !== null) {
      renderIndepProductForm(host);
      return;
    }
    if (state.editingPhotoSlug !== null) {
      renderGalleryPhotoForm(host);
      return;
    }

    const subTabs = `
      <div class="m1-subtabs">
        <button type="button" class="m1-subtab-btn ${state.activeGalSub === 'showcase' ? 'active' : ''}" onclick="window.M1CMS.switchGalSub('showcase')">🏛️ Üst Hero & 4 Kategori Vitrini</button>
        <button type="button" class="m1-subtab-btn ${state.activeGalSub === 'products' ? 'active' : ''}" onclick="window.M1CMS.switchGalSub('products')">🪑 Bağımsız Ürünler (${state.products.length})</button>
        <button type="button" class="m1-subtab-btn ${state.activeGalSub === 'photos' ? 'active' : ''}" onclick="window.M1CMS.switchGalSub('photos')">📸 Vitrin / Proje Fotoğrafları (${state.galleryItems.length})</button>
      </div>
    `;

    if (state.activeGalSub === 'showcase') {
      const catCards = Object.entries(g.showcases || {})
        .map(([catKey, info]) => {
          const uid = slugify(catKey);
          return `
            <div class="m1-subcard">
              <strong style="color:var(--gold);display:block;margin-bottom:10px;font-size:15px;">Kategori Vitrini: ${esc(catKey)}</strong>
              <div class="form-grid-3">
                <div class="form-group"><label>Üst Etiket</label><input type="text" class="form-control" id="gs_k_${uid}" value="${esc(info.kicker)}"></div>
                <div class="form-group"><label>Başlık Önü</label><input type="text" class="form-control" id="gs_tp_${uid}" value="${esc(info.title_prefix || '')}"></div>
                <div class="form-group"><label>Vurgulu Kelime</label><input type="text" class="form-control" id="gs_te_${uid}" value="${esc(info.title_em || info.title)}"></div>
              </div>
              <div class="form-group"><label>Açıklama Metni</label><textarea class="form-control" id="gs_d_${uid}" rows="2">${esc(info.desc)}</textarea></div>
              ${renderMediaInput({
                inputId: `gs_img_${uid}`,
                previewId: `gs_prev_${uid}`,
                value: info.img,
                label: 'Vitrin Görseli',
                folder: 'website/gallery',
                slug: `gal-${uid}`,
              })}
              <div class="form-grid" style="margin-top:10px;">
                <div>
                  <label style="font-size:12px;color:var(--text-muted);font-weight:700;display:block;margin-bottom:6px;">Teknik Özellik Satırları (3 Satır)</label>
                  ${(info.specs || [])
                    .map(
                      (sp, idx) => `<div style="display:grid;grid-template-columns:1fr 1.6fr;gap:6px;margin-bottom:6px;">
                                      <input type="text" class="form-control" id="gs_sp_k_${uid}_${idx}" value="${esc(sp[0])}">
                                      <input type="text" class="form-control" id="gs_sp_v_${uid}_${idx}" value="${esc(sp[1])}">
                                    </div>`
                    )
                    .join('')}
                </div>
                <div>
                  <label style="font-size:12px;color:var(--text-muted);font-weight:700;display:block;margin-bottom:6px;">Ölçü Alternatif Kartları (3 Kart)</label>
                  ${(info.configs || [])
                    .map(
                      (cf, idx) => `<div style="display:grid;grid-template-columns:1fr 1fr 1.5fr;gap:6px;margin-bottom:6px;">
                                      <input type="text" class="form-control" id="gs_cf_d_${uid}_${idx}" value="${esc(cf.dim)}" placeholder="Ölçü">
                                      <input type="text" class="form-control" id="gs_cf_t_${uid}_${idx}" value="${esc(cf.title)}" placeholder="Başlık">
                                      <input type="text" class="form-control" id="gs_cf_s_${uid}_${idx}" value="${esc(cf.desc)}" placeholder="Açıklama">
                                    </div>`
                    )
                    .join('')}
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      host.innerHTML = `
        ${subTabs}
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <div class="admin-card-title">🖼️ Galeri Hero & Bağımsız Sunum Kategorileri</div>
              <div class="admin-card-desc">Galeri giriş ekranı ve Kahve Köşeleri, Dolaplar, Portmantolar, Şifonyerler vitrinlerini tamamen özelleştirin.</div>
            </div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.saveGaleriPage()">💾 Galeri Ayarlarını Yayınla</button>
          </div>

          ${renderMediaInput({
            inputId: 'gh_img',
            previewId: 'gh_prev',
            value: g.hero.image_url,
            label: 'Galeri Sayfası Üst Hero Görseli',
            folder: 'website/gallery',
            slug: 'gal-hero',
          })}
          <div class="form-grid-3" style="margin-top:12px;">
            <div class="form-group"><label>Üst Etiket</label><input type="text" class="form-control" id="gh_kicker" value="${esc(g.hero.kicker)}"></div>
            <div class="form-group"><label>Başlık Önü</label><input type="text" class="form-control" id="gh_tp" value="${esc(g.hero.title_prefix)}"></div>
            <div class="form-group"><label>Vurgulu Kelime</label><input type="text" class="form-control" id="gh_te" value="${esc(g.hero.title_em)}"></div>
          </div>
          <div class="form-group"><label>Galeri Alt Açıklaması</label><textarea class="form-control" id="gh_desc" rows="2">${esc(g.hero.desc)}</textarea></div>

          <hr class="m1-sep">
          <div class="m1-stack-list">${catCards}</div>
        </div>
      `;
    } else if (state.activeGalSub === 'products') {
      const prodCards = state.products.length
        ? state.products
            .map(
              (p) => `
              <div class="product-card">
                <div class="product-card-img-wrap">
                  <img src="${esc(resolvePreviewUrl(p.ana_resim))}" alt="${esc(p.title)}" onerror="this.src='${WEB_ORIGIN}/resim/logo.png'">
                  <span class="product-card-badge">${esc(p.kategori || 'Bağımsız')}</span>
                </div>
                <div class="product-card-body">
                  <div class="product-card-title">${esc(p.title)}</div>
                  <div class="product-card-desc">${esc(p.kisa_aciklama || p.body || '')}</div>
                  <div style="margin-bottom:10px;">
                    <span class="badge" style="background:${p.web_gorunur !== false ? 'rgba(16,185,129,0.18);color:#34d399' : 'rgba(239,68,68,0.18);color:#f87171'};">
                      ${p.web_gorunur !== false ? '🟢 Galeride Görünür' : '⏸️ Gizli'}
                    </span>
                  </div>
                  <div class="product-card-actions">
                    <button type="button" class="btn-primary btn-sm" style="flex:1;" onclick="window.M1CMS.openIndepProductEditor('${esc(p.slug)}')">✏️ Düzenle</button>
                    <button type="button" class="btn-danger btn-sm" onclick="window.M1CMS.deleteIndepProduct('${esc(p.slug)}')">🗑️</button>
                  </div>
                </div>
              </div>`
            )
            .join('')
        : `<div style="padding:36px;text-align:center;color:var(--text-muted);">Henüz bağımsız ürün eklenmedi. "+ Yeni Bağımsız Ürün" ile ekleyebilirsiniz.</div>`;

      host.innerHTML = `
        ${subTabs}
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <div class="admin-card-title">🪑 Bağımsız Ürünler (Portmanto, Şifonyer, Tekil Dolap, Dresuar)</div>
              <div class="admin-card-desc">Galeri altında ve Ana Sayfada görünen tekil mobilya ürünlerini ekleyin, düzenleyin veya gizleyin.</div>
            </div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.openIndepProductEditor('__new__')">➕ Yeni Bağımsız Ürün</button>
          </div>
          <div class="product-grid">${prodCards}</div>
        </div>
      `;
    } else {
      const photoCards = state.galleryItems.length
        ? state.galleryItems
            .map(
              (gp) => `
              <div class="product-card">
                <div class="product-card-img-wrap">
                  <img src="${esc(resolvePreviewUrl(gp.resim))}" alt="${esc(gp.baslik || gp.slug)}" onerror="this.src='${WEB_ORIGIN}/resim/logo.png'">
                  <span class="product-card-badge">${esc(gp.kategori || 'Proje')}</span>
                </div>
                <div class="product-card-body">
                  <div class="product-card-title">${esc(gp.baslik || gp.slug)}</div>
                  <div class="product-card-desc">Sıra: ${Number(gp.siralama || 1)} · ${gp.anasayfada_goster !== false ? '🟢 Sitede Aktif' : '⏸️ Gizli'}</div>
                  <div class="product-card-actions">
                    <button type="button" class="btn-primary btn-sm" style="flex:1;" onclick="window.M1CMS.openGalleryPhotoEditor('${esc(gp.slug)}')">✏️ Düzenle</button>
                    <button type="button" class="btn-danger btn-sm" onclick="window.M1CMS.deleteGalleryPhoto('${esc(gp.slug)}')">🗑️</button>
                  </div>
                </div>
              </div>`
            )
            .join('')
        : `<div style="padding:36px;text-align:center;color:var(--text-muted);">Henüz galeri fotoğrafı eklenmemiş. "+ Yeni Galeri Fotoğrafı" ile ekleyebilirsiniz.</div>`;

      host.innerHTML = `
        ${subTabs}
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <div class="admin-card-title">📸 Proje & Atölye Fotoğraf Galerisi (gallery tablosu)</div>
              <div class="admin-card-desc">Proje uygulama karelerini ve showroom fotoğraflarını yönetin.</div>
            </div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.openGalleryPhotoEditor('__new__')">➕ Yeni Galeri Fotoğrafı</button>
          </div>
          <div class="product-grid">${photoCards}</div>
        </div>
      `;
    }
  }

  function renderGalleryPhotoForm(host) {
    const isNew = state.editingPhotoSlug === '__new__';
    const gp = isNew ? {} : (state.galleryItems.find((x) => x.slug === state.editingPhotoSlug) || {});
    host.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div class="admin-card-title">${isNew ? '➕ Yeni Galeri Fotoğrafı Ekle' : `✏️ Fotoğrafı Düzenle: ${esc(gp.baslik || gp.slug)}`}</div>
          <button type="button" class="btn-secondary btn-sm" onclick="window.M1CMS.closeGalleryPhotoEditor()">← Listeye Dön</button>
        </div>
        <form onsubmit="window.M1CMS.saveGalleryPhotoForm(event)">
          <div class="form-grid-3">
            <div class="form-group"><label>Başlık *</label><input type="text" class="form-control" id="gph_baslik" required value="${esc(gp.baslik || '')}" ${isNew ? 'oninput="document.getElementById(\'gph_slug\').value=window.M1CMS.slugify(this.value)"' : ''}></div>
            <div class="form-group"><label>Slug *</label><input type="text" class="form-control" id="gph_slug" required value="${esc(gp.slug || '')}" ${isNew ? '' : 'readonly'}></div>
            <div class="form-group"><label>Kategori</label><input type="text" class="form-control" id="gph_kat" value="${esc(gp.kategori || 'Kahve Köşeleri')}"></div>
          </div>
          ${renderMediaInput({
            inputId: 'gph_resim',
            previewId: 'gph_prev',
            value: gp.resim || '',
            label: 'Fotoğraf URL *',
            folder: 'website/gallery-photos',
            slug: gp.slug || 'galeri-foto',
          })}
          <div class="form-grid" style="margin-top:12px;">
            <div class="form-group"><label>Sıralama</label><input type="number" class="form-control" id="gph_sira" value="${Number(gp.siralama || 1)}"></div>
            <div class="form-group"><label>Durum</label><label style="display:flex;align-items:center;gap:8px;padding-top:8px;cursor:pointer;"><input type="checkbox" id="gph_show" ${gp.anasayfada_goster !== false ? 'checked' : ''}> 🌐 Sitede Göster</label></div>
          </div>
          <div style="display:flex;gap:10px;">
            <button type="submit" class="btn-gold">💾 Fotoğrafı Kaydet</button>
            <button type="button" class="btn-secondary" onclick="window.M1CMS.closeGalleryPhotoEditor()">İptal</button>
          </div>
        </form>
      </div>
    `;
  }

  function renderIndepProductForm(host) {
    const isNew = state.editingProdSlug === '__new__';
    const p = isNew ? {} : (state.products.find((x) => x.slug === state.editingProdSlug) || {});
    const colors = Array.isArray(p.renkler) ? p.renkler.join(', ') : '';
    const feats = Array.isArray(p.ozellikler) ? p.ozellikler.join('\n') : '';

    host.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <div class="admin-card-title">${isNew ? '➕ Yeni Bağımsız Ürün Ekle' : `✏️ Ürünü Düzenle: ${esc(p.title)}`}</div>
          </div>
          <button type="button" class="btn-secondary btn-sm" onclick="window.M1CMS.closeIndepProductEditor()">← Listeye Dön</button>
        </div>
        <form onsubmit="window.M1CMS.saveIndepProductForm(event)">
          <div class="form-grid-3">
            <div class="form-group">
              <label>Ürün Adı *</label>
              <input type="text" class="form-control" id="ip_title" required value="${esc(p.title || '')}"
                     ${isNew ? 'oninput="document.getElementById(\'ip_slug\').value = window.M1CMS.slugify(this.value)"' : ''}>
            </div>
            <div class="form-group">
              <label>URL Kodu (Slug) *</label>
              <input type="text" class="form-control" id="ip_slug" required value="${esc(p.slug || '')}" ${isNew ? '' : 'readonly'}>
            </div>
            <div class="form-group">
              <label>SKU / Stok Kodu *</label>
              <input type="text" class="form-control" id="ip_sku" required value="${esc(p.sku || (isNew ? 'GM-IND-' + Math.floor(100 + Math.random() * 899) : ''))}">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Galeri Alt Kategorisi *</label>
              <select class="form-control" id="ip_cat">
                ${['Kahve Köşeleri', 'Dolaplar', 'Portmantolar', 'Şifonyerler']
                  .map((c) => `<option value="${esc(c)}" ${p.kategori === c ? 'selected' : ''}>${esc(c)}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Ölçüler / Teknik Not</label>
              <input type="text" class="form-control" id="ip_body" value="${esc(p.body || '')}" placeholder="Örn: 140 / 210 / 45 cm">
            </div>
          </div>
          <div class="form-group"><label>Kısa Açıklama</label><textarea class="form-control" id="ip_short" rows="2">${esc(p.kisa_aciklama || '')}</textarea></div>
          ${renderMediaInput({
            inputId: 'ip_img',
            previewId: 'ip_prev',
            value: p.ana_resim || '',
            label: 'Ana Ürün Fotoğrafı *',
            folder: 'products',
            slug: p.slug || 'bagimsiz-urun',
          })}
          <div class="form-grid" style="margin-top:12px;">
            <div class="form-group"><label>Renk Seçenekleri (virgülle)</label><input type="text" class="form-control" id="ip_colors" value="${esc(colors)}" placeholder="Doğal Meşe, Kaşmir, Antrasit"></div>
            <div class="form-group"><label>Özellikler (her satır bir madde)</label><textarea class="form-control" id="ip_feats" rows="3">${esc(feats)}</textarea></div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:16px;">
            <input type="checkbox" id="ip_visible" ${p.web_gorunur !== false ? 'checked' : ''}> 🌐 Galeri Sayfasında Görünür
          </label>
          <div style="display:flex;gap:10px;">
            <button type="submit" class="btn-gold">💾 Bağımsız Ürünü Kaydet</button>
            <button type="button" class="btn-secondary" onclick="window.M1CMS.closeIndepProductEditor()">İptal</button>
          </div>
        </form>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // 4. İLETİŞİM, FİRMA, HARİTA & SSS YÖNETİMİ
  // ---------------------------------------------------------------------------
  function renderContactTab() {
    const host = document.getElementById('m1ContactMount');
    if (!host) return;
    const il = state.iletisimSayfasi;
    const g = state.genel;

    const previewQuery = il.map.query || g.iletisim.adres || 'İstanbul Bağcılar';
    const previewEmbed = il.map.custom_embed_url
      ? il.map.custom_embed_url
      : `https://maps.google.com/maps?q=${encodeURIComponent(previewQuery)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

    host.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <div class="admin-card-title">📞 İletişim Sayfası, Firma Bilgileri, Harita & Footer Yönetimi</div>
            <div class="admin-card-desc">Header, Footer, WhatsApp hattı, Fabrika Konumu (Google Maps) ve Sıkça Sorulan Soruları tek ekrandan güncelleyin.</div>
          </div>
          <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.saveContactAndGenel()">💾 İletişim & Firma Ayarlarını Yayınla</button>
        </div>

        <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">1. İletişim Üst Hero Görseli & Başlıkları</div>
        ${renderMediaInput({
          inputId: 'il_h_img',
          previewId: 'il_h_prev',
          value: il.hero.image_url,
          label: 'İletişim Hero Arka Plan Görseli',
          folder: 'website/contact',
          slug: 'contact-hero',
        })}
        <div class="form-grid-3" style="margin-top:10px;">
          <div class="form-group"><label>Eyebrow</label><input type="text" class="form-control" id="il_h_eye" value="${esc(il.hero.eyebrow)}"></div>
          <div class="form-group"><label>Başlık Önü</label><input type="text" class="form-control" id="il_h_tp" value="${esc(il.hero.title_prefix)}"></div>
          <div class="form-group"><label>Vurgu & Sonu</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="il_h_te" value="${esc(il.hero.title_em)}"><input type="text" class="form-control" id="il_h_ts" value="${esc(il.hero.title_suffix)}"></div></div>
        </div>
        <div class="form-group"><label>Hero Açıklaması</label><textarea class="form-control" id="il_h_desc" rows="2">${esc(il.hero.desc)}</textarea></div>

        <hr class="m1-sep">
        <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">2. Marka Kimliği, Logo & Global İletişim Kanalları (Header/Footer Senkron)</div>
        ${renderMediaInput({
          inputId: 'ge_logo',
          previewId: 'ge_logo_prev',
          value: g.firma.logo,
          label: 'Marka Logosu (Header & Footer)',
          folder: 'website/brand',
          slug: 'global-logo',
        })}
        <div class="form-grid-3" style="margin-top:10px;">
          <div class="form-group"><label>Marka Adı</label><input type="text" class="form-control" id="ge_ad" value="${esc(g.firma.ad)}"></div>
          <div class="form-group"><label>Telefon</label><input type="text" class="form-control" id="ge_tel" value="${esc(g.iletisim.telefon)}"></div>
          <div class="form-group"><label>WhatsApp (905XXXXXXXXX)</label><input type="text" class="form-control" id="ge_wa" value="${esc(g.iletisim.whatsapp)}"></div>
        </div>
        <div class="form-grid">
          <div class="form-group"><label>Kurumsal E-posta</label><input type="email" class="form-control" id="ge_email" value="${esc(g.iletisim.email)}"></div>
          <div class="form-group"><label>Açık Fabrika Adresi</label><input type="text" class="form-control" id="ge_adres" value="${esc(g.iletisim.adres)}"></div>
        </div>
        <div class="form-grid-3">
          <div class="form-group"><label>Instagram Linki</label><input type="url" class="form-control" id="ge_ig" value="${esc(g.sosyal_medya.instagram)}"></div>
          <div class="form-group"><label>Facebook Linki</label><input type="url" class="form-control" id="ge_fb" value="${esc(g.sosyal_medya.facebook)}"></div>
          <div class="form-group"><label>YouTube / LinkedIn Linki</label><input type="url" class="form-control" id="ge_yt" value="${esc(g.sosyal_medya.youtube || g.sosyal_medya.linkedin || '')}"></div>
        </div>
        <div class="form-grid">
          <div class="form-group"><label>Üst Duyuru Bandı (Topbar) Metni</label><input type="text" class="form-control" id="ge_topbar_txt" value="${esc(g.topbar?.metin || '')}"></div>
          <div class="form-group"><label>Topbar & Sağ Üst Buton</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <label style="display:flex;align-items:center;gap:6px;white-space:nowrap;font-weight:600;"><input type="checkbox" id="ge_topbar_act" ${g.topbar?.aktif !== false ? 'checked' : ''}> Aktif</label>
              <input type="text" class="form-control" id="ge_nav_cta_yazi" value="${esc(g.nav_cta?.yazi || 'Teklif Al')}" placeholder="Buton Yazısı">
              <input type="text" class="form-control" id="ge_nav_cta_link" value="${esc(g.nav_cta?.link || '/koleksiyon.html')}" placeholder="Buton Linki">
            </div>
          </div>
        </div>

        <hr class="m1-sep">
        <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">3. Hızlı İletişim Kartları, Atölye Bilgi Kartı & Çalışma Saatleri</div>
        <div class="form-grid-3">
          <div class="form-group"><label>Telefon Kartı Alt Notu</label><input type="text" class="form-control" id="il_t_tel_n" value="${esc(il.tiles?.tel_note || '')}"></div>
          <div class="form-group"><label>WhatsApp Kartı Alt Notu</label><input type="text" class="form-control" id="il_t_wa_n" value="${esc(il.tiles?.wa_note || '')}"></div>
          <div class="form-group"><label>E-posta Kartı Alt Notu</label><input type="text" class="form-control" id="il_t_em_n" value="${esc(il.tiles?.email_note || '')}"></div>
        </div>
        <div class="form-grid">
          <div class="form-group"><label>Üretim Kapasitesi & Garanti Metni</label><input type="text" class="form-control" id="il_d_cap_v" value="${esc(il.dossier?.capacity_val || '')}"></div>
          <div class="form-group"><label>Üretim & Teslimat Hızı Metni</label><input type="text" class="form-control" id="il_d_spd_v" value="${esc(il.dossier?.speed_val || '')}"></div>
        </div>
        <div class="form-grid">
          <div class="form-group"><label>Dossier Başlığı (Ön / Vurgu)</label><div style="display:flex;gap:6px;"><input type="text" class="form-control" id="il_d_tp" value="${esc(il.dossier.title_prefix)}"><input type="text" class="form-control" id="il_d_te" value="${esc(il.dossier.title_em)}"></div></div>
          <div class="form-group"><label>Atölye Açıklaması</label><input type="text" class="form-control" id="il_d_lead" value="${esc(il.dossier.lead)}"></div>
        </div>
        <div class="form-grid-3">
          ${(il.dossier.hours || [])
            .map(
              (hr, idx) => `<div class="form-group">
                              <label>Saat Satırı #${idx + 1} (${esc(hr.day)})</label>
                              <div style="display:flex;gap:6px;">
                                <input type="text" class="form-control" id="il_hr_d_${idx}" value="${esc(hr.day)}">
                                <input type="text" class="form-control" id="il_hr_v_${idx}" value="${esc(hr.val)}">
                              </div>
                            </div>`
            )
            .join('')}
        </div>

        <hr class="m1-sep">
        <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">4. Google Maps Fabrika Konumu</div>
        <div class="form-grid">
          <div>
            <div class="form-group"><label>Harita Arama Sorgusu veya Koordinat (Örn: Yalçın Koreş Cad. No:6B Bağcılar İstanbul)</label>
              <input type="text" class="form-control" id="il_map_q" value="${esc(il.map.query)}" oninput="window.M1CMS.updateMapPreview(this.value)">
            </div>
            <div class="form-grid">
              <div class="form-group"><label>Harita Üstü Adres Etiketi</label><input type="text" class="form-control" id="il_map_lbl" value="${esc(il.map.address_label)}"></div>
              <div class="form-group"><label>Harita Üstü Saat Özeti</label><input type="text" class="form-control" id="il_map_hrs" value="${esc(il.map.hours_summary)}"></div>
            </div>
            <div class="form-group"><label>Özel Google Maps Embed URL (Opsiyonel)</label><input type="text" class="form-control" id="il_map_emb" value="${esc(il.map.custom_embed_url)}" placeholder="Boş bırakırsanız yukarıdaki adresten otomatik üretilir"></div>
          </div>
          <div>
            <iframe id="m1MapPreviewFrame" src="${esc(previewEmbed)}" style="width:100%;height:210px;border:1px solid var(--border);border-radius:10px;background:#0f172a;" loading="lazy"></iframe>
          </div>
        </div>

        <hr class="m1-sep">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div class="admin-card-title" style="font-size:15px;">5. Sıkça Sorulan Sorular (SSS) & Form Metinleri</div>
          <button type="button" class="btn-secondary btn-sm" onclick="window.M1CMS.addFaqItem()">+ Yeni Soru Ekle</button>
        </div>
        <div class="form-grid">
          <div class="form-group"><label>Teklif Formu Başlığı</label><input type="text" class="form-control" id="il_f_title" value="${esc(il.form.title)}"></div>
          <div class="form-group"><label>Teklif Formu Alt Yazısı</label><input type="text" class="form-control" id="il_f_sub" value="${esc(il.form.subtitle)}"></div>
        </div>
        <div class="form-group">
          <label>Teklif Formu Konu Seçenekleri (Her satıra 1 konu yazın)</label>
          <textarea class="form-control" id="il_f_subjs" rows="3">${esc((il.form.subjects || []).map((s) => (typeof s === 'string' ? s : s.label || s.value)).join('\n'))}</textarea>
        </div>
        <div class="m1-stack-list" id="ilFaqList">
          ${(il.faq.items || [])
            .map(
              (fq, idx) => `
              <div class="m1-subcard">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <strong style="font-size:12.5px;color:#DFC793;">Soru #${idx + 1}</strong>
                  <button type="button" class="btn-danger btn-sm" onclick="window.M1CMS.removeFaqItem(${idx})">Sil</button>
                </div>
                <div class="form-group"><label>Soru</label><input type="text" class="form-control" id="il_fq_q_${idx}" value="${esc(fq.q)}"></div>
                <div class="form-group" style="margin-bottom:0;"><label>Cevap</label><textarea class="form-control" id="il_fq_a_${idx}" rows="2">${esc(fq.a)}</textarea></div>
              </div>`
            )
            .join('')}
        </div>

        <hr class="m1-sep">
        <div class="admin-card-title" style="font-size:15px;margin-bottom:12px;">6. Alt Bilgi (Footer) Metinleri & Rozetler</div>
        <div class="form-grid">
          <div class="form-group"><label>Footer Marka Açıklaması</label><textarea class="form-control" id="gf_tanitim" rows="2">${esc(g.footer.tanitim_metni)}</textarea></div>
          <div class="form-group"><label>Alt Banner Başlığı & Açıklaması</label>
            <input type="text" class="form-control" id="gf_cta_t" value="${esc(g.footer.cta_title)}" style="margin-bottom:6px;">
            <input type="text" class="form-control" id="gf_cta_d" value="${esc(g.footer.cta_desc)}">
          </div>
        </div>
        <div class="form-grid-3">
          <div class="form-group"><label>Rozet 1</label><input type="text" class="form-control" id="gf_b1" value="${esc(g.footer.badge_1)}"></div>
          <div class="form-group"><label>Rozet 2</label><input type="text" class="form-control" id="gf_b2" value="${esc(g.footer.badge_2)}"></div>
          <div class="form-group"><label>Rozet 3</label><input type="text" class="form-control" id="gf_b3" value="${esc(g.footer.badge_3)}"></div>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // 5. DİĞER SAYFALAR: HAKKIMIZDA, BLOGLAR & TEDARİKÇİLER
  // ---------------------------------------------------------------------------
  function renderOthersTab() {
    const host = document.getElementById('m1OthersMount');
    if (!host) return;
    const hak = state.hakkimizda;

    const subPills = `
      <div class="m1-subtabs">
        <button type="button" class="m1-subtab-btn ${state.activeOtherSub === 'about' ? 'active' : ''}" onclick="window.M1CMS.switchOtherSub('about')">ℹ️ Hakkımızda Sayfası</button>
        <button type="button" class="m1-subtab-btn ${state.activeOtherSub === 'blogs' ? 'active' : ''}" onclick="window.M1CMS.switchOtherSub('blogs')">📝 Bloglar (${state.blogs.length})</button>
        <button type="button" class="m1-subtab-btn ${state.activeOtherSub === 'suppliers' ? 'active' : ''}" onclick="window.M1CMS.switchOtherSub('suppliers')">🤝 Tedarikçiler (${state.suppliers.length})</button>
      </div>
    `;

    if (state.activeOtherSub === 'about') {
      host.innerHTML = `
        ${subPills}
        <div class="admin-card">
          <div class="admin-card-header">
            <div><div class="admin-card-title">ℹ️ Hakkımızda Sayfası Yönetimi</div></div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.saveAboutPage()">💾 Hakkımızda Ayarlarını Kaydet</button>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Hero Başlık</label><input type="text" class="form-control" id="hk_hb" value="${esc(hak.hero.baslik)}"></div>
            <div class="form-group"><label>Hero Alt Yazı</label><input type="text" class="form-control" id="hk_ha" value="${esc(hak.hero.alt_yazi)}"></div>
          </div>
          <div class="form-group"><label>Ana Hikaye Paragraf 1</label><textarea class="form-control" id="hk_p1" rows="3">${esc(hak.ana_metin.paragraf_1)}</textarea></div>
          <div class="form-group"><label>Ana Hikaye Paragraf 2</label><textarea class="form-control" id="hk_p2" rows="3">${esc(hak.ana_metin.paragraf_2)}</textarea></div>
          <div class="form-grid">
            <div class="form-group"><label>Misyon Metni</label><textarea class="form-control" id="hk_mis" rows="3">${esc(hak.misyon_vizyon.misyon_metin)}</textarea></div>
            <div class="form-group"><label>Vizyon Metni</label><textarea class="form-control" id="hk_viz" rows="3">${esc(hak.misyon_vizyon.vizyon_metin)}</textarea></div>
          </div>
        </div>
      `;
    } else if (state.activeOtherSub === 'blogs') {
      if (state.editingBlogSlug !== null) {
        const isNew = state.editingBlogSlug === '__new__';
        const b = isNew ? {} : (state.blogs.find((x) => x.slug === state.editingBlogSlug) || {});
        host.innerHTML = `
          ${subPills}
          <div class="admin-card">
            <div class="admin-card-header">
              <div class="admin-card-title">${isNew ? '➕ Yeni Blog Yazısı' : '✏️ Yazıyı Düzenle'}</div>
              <button type="button" class="btn-secondary btn-sm" onclick="window.M1CMS.closeBlogEditor()">← Listeye Dön</button>
            </div>
            <form onsubmit="window.M1CMS.saveBlogForm(event)">
              <div class="form-grid-3">
                <div class="form-group"><label>Başlık *</label><input type="text" class="form-control" id="bl_t" required value="${esc(b.title || '')}" ${isNew ? 'oninput="document.getElementById(\'bl_s\').value=window.M1CMS.slugify(this.value)"' : ''}></div>
                <div class="form-group"><label>Slug *</label><input type="text" class="form-control" id="bl_s" required value="${esc(b.slug || '')}" ${isNew ? '' : 'readonly'}></div>
                <div class="form-group"><label>Kategori</label><input type="text" class="form-control" id="bl_c" value="${esc(b.kategori || 'Tasarım Rehberi')}"></div>
              </div>
              ${renderMediaInput({ inputId: 'bl_img', previewId: 'bl_prev', value: b.kapak_resim || '', label: 'Kapak Görseli', folder: 'website/blog', slug: b.slug || 'blog' })}
              <div class="form-group" style="margin-top:10px;"><label>Özet</label><textarea class="form-control" id="bl_o" rows="2">${esc(b.ozet || '')}</textarea></div>
              <div class="form-group"><label>Makale İçeriği</label><textarea class="form-control" id="bl_b" rows="6">${esc(b.body || '')}</textarea></div>
              <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;"><input type="checkbox" id="bl_home" ${b.anasayfada_goster !== false ? 'checked' : ''}> Ana Sayfada Göster</label>
              <button type="submit" class="btn-gold">💾 Yazıyı Kaydet</button>
            </form>
          </div>
        `;
        return;
      }

      host.innerHTML = `
        ${subPills}
        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-title">📝 Blog Yazıları & Tasarım Rehberi</div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.openBlogEditor('__new__')">➕ Yeni Yazı Ekle</button>
          </div>
          <div class="product-grid">
            ${state.blogs
              .map(
                (b) => `<div class="product-card">
                          <div class="product-card-img-wrap">
                            <img src="${esc(resolvePreviewUrl(b.kapak_resim))}" alt="${esc(b.title)}" onerror="this.src='${WEB_ORIGIN}/resim/logo.png'">
                            <span class="product-card-badge">${esc(b.kategori || 'Blog')}</span>
                          </div>
                          <div class="product-card-body">
                            <div class="product-card-title">${esc(b.title)}</div>
                            <div class="product-card-desc">${esc(b.ozet || '')}</div>
                            <div class="product-card-actions">
                              <button type="button" class="btn-primary btn-sm" style="flex:1;" onclick="window.M1CMS.openBlogEditor('${esc(b.slug)}')">✏️ Düzenle</button>
                              <button type="button" class="btn-danger btn-sm" onclick="window.M1CMS.deleteBlog('${esc(b.slug)}')">🗑️</button>
                            </div>
                          </div>
                        </div>`
              )
              .join('') || '<div class="text-muted">Kayıtlı blog yazısı yok.</div>'}
          </div>
        </div>
      `;
    } else {
      if (state.editingSupSlug !== null) {
        const isNew = state.editingSupSlug === '__new__';
        const s = isNew ? {} : (state.suppliers.find((x) => x.slug === state.editingSupSlug) || {});
        host.innerHTML = `
          ${subPills}
          <div class="admin-card">
            <div class="admin-card-header">
              <div class="admin-card-title">${isNew ? '➕ Yeni Tedarikçi Ekle' : '✏️ Tedarikçi Düzenle'}</div>
              <button type="button" class="btn-secondary btn-sm" onclick="window.M1CMS.closeSupEditor()">← Listeye Dön</button>
            </div>
            <form onsubmit="window.M1CMS.saveSupForm(event)">
              <div class="form-grid-3">
                <div class="form-group"><label>Firma Adı *</label><input type="text" class="form-control" id="sp_ad" required value="${esc(s.ad || '')}" ${isNew ? 'oninput="document.getElementById(\'sp_slug\').value=window.M1CMS.slugify(this.value)"' : ''}></div>
                <div class="form-group"><label>Slug *</label><input type="text" class="form-control" id="sp_slug" required value="${esc(s.slug || '')}" ${isNew ? '' : 'readonly'}></div>
                <div class="form-group"><label>Kategori</label><input type="text" class="form-control" id="sp_cat" value="${esc(s.kategori || 'Doğal Ahşap & Yüzey')}"></div>
              </div>
              ${renderMediaInput({ inputId: 'sp_img', previewId: 'sp_prev', value: s.logo || '', label: 'Logo / Görsel', folder: 'website/suppliers', slug: s.slug || 'sup' })}
              <div class="form-grid" style="margin-top:10px;">
                <div class="form-group"><label>Açıklama</label><textarea class="form-control" id="sp_desc" rows="2">${esc(s.aciklama || '')}</textarea></div>
                <div class="form-group"><label>Sıra & Web Linki</label><input type="number" class="form-control" id="sp_ord" value="${esc(s.siralama || 1)}" style="margin-bottom:6px;"><input type="url" class="form-control" id="sp_lnk" value="${esc(s.link || '')}"></div>
              </div>
              <button type="submit" class="btn-gold">💾 Tedarikçiyi Kaydet</button>
            </form>
          </div>
        `;
        return;
      }

      host.innerHTML = `
        ${subPills}
        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-title">🤝 Tedarikçilerimiz & İş Ortaklarımız</div>
            <button type="button" class="btn-gold btn-sm" onclick="window.M1CMS.openSupEditor('__new__')">➕ Yeni Tedarikçi Ekle</button>
          </div>
          <div class="product-grid">
            ${state.suppliers
              .map(
                (s) => `<div class="product-card">
                          <div class="product-card-img-wrap">
                            <img src="${esc(resolvePreviewUrl(s.logo))}" alt="${esc(s.ad)}" onerror="this.src='${WEB_ORIGIN}/resim/logo.png'">
                            <span class="product-card-badge">${esc(s.kategori || 'İş Ortağı')}</span>
                          </div>
                          <div class="product-card-body">
                            <div class="product-card-title">${esc(s.ad)}</div>
                            <div class="product-card-desc">${esc(s.aciklama || '')}</div>
                            <div class="product-card-actions">
                              <button type="button" class="btn-primary btn-sm" style="flex:1;" onclick="window.M1CMS.openSupEditor('${esc(s.slug)}')">✏️ Düzenle</button>
                              <button type="button" class="btn-danger btn-sm" onclick="window.M1CMS.deleteSup('${esc(s.slug)}')">🗑️</button>
                            </div>
                          </div>
                        </div>`
              )
              .join('') || '<div class="text-muted">Kayıtlı tedarikçi yok.</div>'}
          </div>
        </div>
      `;
    }
  }

  function renderActiveTab() {
    if (state.activeTab === 'tab-home') renderHomeTab();
    else if (state.activeTab === 'tab-collections') renderCollectionsTab();
    else if (state.activeTab === 'tab-gallery') renderGalleryTab();
    else if (state.activeTab === 'tab-contact') renderContactTab();
    else if (state.activeTab === 'tab-others') renderOthersTab();
  }

  window.switchMainTab = function (e, tabId) {
    if (state.activeTab === 'tab-home') collectCurrentHomeSubIntoState();
    state.activeTab = tabId || 'tab-home';
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      const oc = btn.getAttribute('onclick') || '';
      btn.classList.toggle('active', oc.includes(`'${state.activeTab}'`) || oc.includes(`"${state.activeTab}"`));
    });
    document.querySelectorAll('.tab-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === state.activeTab);
    });
    renderActiveTab();
  };

  window.M1CMS = {
    slugify,
    boot: loadAllData,

    syncPreview(inputId, previewId) {
      const val = document.getElementById(inputId)?.value;
      const img = document.getElementById(previewId);
      if (img) img.src = resolvePreviewUrl(val);
    },

    async handleMediaUpload(fileInput, inputId, previewId, folder, slug) {
      const file = fileInput?.files?.[0];
      if (!file) return;
      showToast('Görsel Cloudflare R2 bulutuna yükleniyor...', 'info');
      try {
        const publicUrl = await uploadImageToR2(file, { folder, slug });
        const inp = document.getElementById(inputId);
        if (inp) inp.value = publicUrl;
        const img = document.getElementById(previewId);
        if (img) img.src = publicUrl;
        showToast('✅ Görsel R2 CDN üzerine yüklendi.', 'success');
      } catch (err) {
        showToast('Görsel yüklenemedi: ' + err.message, 'error');
      }
    },

    switchHomeSub(sub) {
      collectCurrentHomeSubIntoState();
      state.activeHomeSub = sub;
      renderHomeTab();
    },

    addHeroSlide() {
      collectCurrentHomeSubIntoState();
      state.anasayfaV2.hero.slides.push({
        image_url: 'resim/showroom/hero_marsilya.jpg',
        caption: `Sahne ${state.anasayfaV2.hero.slides.length + 1}`,
      });
      renderHomeTab();
    },

    removeHeroSlide(idx) {
      collectCurrentHomeSubIntoState();
      state.anasayfaV2.hero.slides.splice(idx, 1);
      renderHomeTab();
    },

    async saveHomeSection() {
      collectCurrentHomeSubIntoState();
      try {
        await saveSetting('anasayfa_v2', state.anasayfaV2, 'Ana Sayfa İçerikleri');
      } catch (err) {
        showToast('Ana sayfa kaydedilemedi: ' + err.message, 'error');
      }
    },

    async saveCollectionIntros() {
      const intros = state.koleksiyonSayfasi.category_intros || {};
      for (const catKey of Object.keys(intros)) {
        const uid = slugify(catKey);
        const info = intros[catKey];
        info.kicker = document.getElementById(`ki_k_${uid}`)?.value?.trim() || info.kicker;
        info.title_prefix = document.getElementById(`ki_tp_${uid}`)?.value?.trim() || info.title_prefix;
        info.title_em = document.getElementById(`ki_te_${uid}`)?.value?.trim() || info.title_em;
        info.desc = document.getElementById(`ki_d_${uid}`)?.value?.trim() || info.desc;
        info.cta_label = document.getElementById(`ki_cta_${uid}`)?.value?.trim() || info.cta_label;
        info.aurora = info.aurora || {};
        for (const ck of ['base', 'c1', 'c2', 'c3', 'c4', 'accent']) {
          const cv = document.getElementById(`ki_au_${uid}_${ck}`)?.value;
          if (cv) info.aurora[ck] = cv;
        }
      }
      try {
        await saveSetting('koleksiyon_sayfasi', state.koleksiyonSayfasi, 'Koleksiyon Giriş Ekranları');
      } catch (err) {
        showToast('Hata: ' + err.message, 'error');
      }
    },

    openColEditor(slug) {
      state.editingColSlug = slug;
      _draftColScene = null;
      renderCollectionsTab();
    },

    closeColEditor() {
      state.editingColSlug = null;
      _draftColScene = null;
      renderCollectionsTab();
    },

    toggleColScene(enabled) {
      syncDraftSceneFromInputs();
      if (_draftColScene) _draftColScene.enabled = Boolean(enabled);
      const body = document.getElementById('colSceneEditorBody');
      if (body) body.style.display = enabled ? 'block' : 'none';
    },

    applyBergamoSceneTemplate() {
      _draftColScene = { ...structuredClone(M1.WORLD_PRESETS.bergamo.scene_config), enabled: true };
      renderCollectionsTab();
    },

    addSceneModule() {
      syncDraftSceneFromInputs();
      _draftColScene.modules.push({
        id: 'mod-' + Date.now(),
        src: '/hero/bergamo-orta-drop.png',
        alt: 'Yeni Mobilya Modülü',
        eyebrow: 'Özel Modül',
        label: 'Yeni Modül',
        dimensions: '100 / 200 / 45',
        leftPct: 35,
        bottomPct: 13.13,
        widthPct: 22,
        heightPct: 70.23,
        zIndex: 24,
        entranceY: -210,
        entranceDelaySec: 0.04,
        entranceDurationSec: 0.88,
        link: 'koleksiyon.html',
      });
      renderCollectionsTab();
    },

    removeSceneModule(idx) {
      syncDraftSceneFromInputs();
      _draftColScene.modules.splice(idx, 1);
      renderCollectionsTab();
    },

    addSceneDecor() {
      syncDraftSceneFromInputs();
      _draftColScene.decors.push({
        id: 'decor-' + Date.now(),
        src: '/hero/dekor-sol.png',
        alt: 'Ön Plan Dekor Katmanı',
        side: 'left',
        leftPct: 0,
        bottomPct: 0,
        widthPct: 18,
        zIndex: 33,
        entranceX: -115,
        entranceDelaySec: 0.88,
        entranceDurationSec: 0.58,
      });
      renderCollectionsTab();
    },

    removeSceneDecor(idx) {
      syncDraftSceneFromInputs();
      _draftColScene.decors.splice(idx, 1);
      renderCollectionsTab();
    },

    async saveCollectionForm(e) {
      e.preventDefault();
      syncDraftSceneFromInputs();
      const btn = document.getElementById('btnSaveCol');
      if (btn) btn.disabled = true;

      try {
        const swatches = (document.getElementById('col_swatches')?.value || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);

        const aurora = {};
        for (const ck of ['base', 'c1', 'c2', 'c3', 'c4', 'accent']) {
          aurora[ck] = document.getElementById(`col_au_${ck}`)?.value || '#16110D';
        }

        const scenePayload = _draftColScene && _draftColScene.enabled
          ? {
              stageAspectRatio: _draftColScene.stageAspectRatio || '1024 / 571',
              background: _draftColScene.background,
              finalMaster: _draftColScene.finalMaster,
              modules: _draftColScene.modules,
              decors: _draftColScene.decors,
            }
          : null;

        const payload = {
          slug: document.getElementById('col_slug')?.value?.trim(),
          title: document.getElementById('col_title')?.value?.trim(),
          category: document.getElementById('col_category')?.value,
          design_story: document.getElementById('col_story')?.value?.trim() || '',
          short_description: document.getElementById('col_story')?.value?.trim() || '',
          hero_image: document.getElementById('col_hero_img')?.value?.trim(),
          ambient_image_url: document.getElementById('col_amb_img')?.value?.trim() || '',
          city: document.getElementById('col_city')?.value?.trim() || '',
          country: document.getElementById('col_country')?.value?.trim() || '',
          coords: document.getElementById('col_coords')?.value?.trim() || '',
          sort_order: Number(document.getElementById('col_sort')?.value || 0),
          is_visible: Boolean(document.getElementById('col_visible')?.checked),
          color_palette: swatches,
          aurora,
          scene_config: scenePayload,
        };

        await apiFetch('/api/module7?action=collections', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('✅ Koleksiyon ve sahne verileri canlı siteye kaydedildi.', 'success');
        state.editingColSlug = null;
        _draftColScene = null;
        await loadAllData();
      } catch (err) {
        showToast('Koleksiyon kaydedilemedi: ' + err.message, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    },

    async deleteCollection(slug) {
      if (!confirm(`"${slug}" koleksiyonunu silmek istediğinize emin misiniz?`)) return;
      try {
        await apiFetch('/api/module7?action=collections', {
          method: 'DELETE',
          body: JSON.stringify({ slug }),
        });
        showToast('Koleksiyon silindi.', 'success');
        await loadAllData();
      } catch (err) {
        showToast('Silinemedi: ' + err.message, 'error');
      }
    },

    switchGalSub(sub) {
      state.activeGalSub = sub;
      state.editingProdSlug = null;
      state.editingPhotoSlug = null;
      renderGalleryTab();
    },

    async saveGaleriPage() {
      const g = state.galeriSayfasi;
      g.hero.image_url = document.getElementById('gh_img')?.value?.trim() || g.hero.image_url;
      g.hero.kicker = document.getElementById('gh_kicker')?.value?.trim() || g.hero.kicker;
      g.hero.title_prefix = document.getElementById('gh_tp')?.value?.trim() || g.hero.title_prefix;
      g.hero.title_em = document.getElementById('gh_te')?.value?.trim() || g.hero.title_em;
      g.hero.desc = document.getElementById('gh_desc')?.value?.trim() || g.hero.desc;

      for (const [catKey, info] of Object.entries(g.showcases || {})) {
        const uid = slugify(catKey);
        info.kicker = document.getElementById(`gs_k_${uid}`)?.value?.trim() || info.kicker;
        info.title_prefix = document.getElementById(`gs_tp_${uid}`)?.value?.trim() || '';
        info.title_em = document.getElementById(`gs_te_${uid}`)?.value?.trim() || info.title_em;
        info.title = [info.title_prefix, info.title_em].filter(Boolean).join(' ').trim() || info.title;
        info.desc = document.getElementById(`gs_d_${uid}`)?.value?.trim() || info.desc;
        info.img = document.getElementById(`gs_img_${uid}`)?.value?.trim() || info.img;
        info.specs = (info.specs || []).map((sp, idx) => [
          document.getElementById(`gs_sp_k_${uid}_${idx}`)?.value?.trim() || sp[0],
          document.getElementById(`gs_sp_v_${uid}_${idx}`)?.value?.trim() || sp[1],
        ]);
        info.configs = (info.configs || []).map((cf, idx) => ({
          dim: document.getElementById(`gs_cf_d_${uid}_${idx}`)?.value?.trim() || cf.dim,
          title: document.getElementById(`gs_cf_t_${uid}_${idx}`)?.value?.trim() || cf.title,
          desc: document.getElementById(`gs_cf_s_${uid}_${idx}`)?.value?.trim() || cf.desc,
        }));
      }

      try {
        await saveSetting('galeri_sayfasi', g, 'Galeri & Sunum Vitrini');
      } catch (err) {
        showToast('Galeri kaydedilemedi: ' + err.message, 'error');
      }
    },

    openIndepProductEditor(slug) {
      state.editingProdSlug = slug;
      renderGalleryTab();
    },

    closeIndepProductEditor() {
      state.editingProdSlug = null;
      renderGalleryTab();
    },

    async saveIndepProductForm(e) {
      e.preventDefault();
      try {
        const payload = {
          slug: document.getElementById('ip_slug')?.value?.trim(),
          title: document.getElementById('ip_title')?.value?.trim(),
          sku: document.getElementById('ip_sku')?.value?.trim(),
          kategori: document.getElementById('ip_cat')?.value,
          body: document.getElementById('ip_body')?.value?.trim() || '',
          kisa_aciklama: document.getElementById('ip_short')?.value?.trim() || '',
          ana_resim: document.getElementById('ip_img')?.value?.trim(),
          renkler: (document.getElementById('ip_colors')?.value || '').split(',').map((x) => x.trim()).filter(Boolean),
          ozellikler: (document.getElementById('ip_feats')?.value || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
          web_gorunur: Boolean(document.getElementById('ip_visible')?.checked),
          product_type: 'independent',
        };
        await apiFetch('/api/module7?action=products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('✅ Bağımsız ürün galeriye kaydedildi.', 'success');
        state.editingProdSlug = null;
        await loadAllData();
      } catch (err) {
        showToast('Ürün kaydedilemedi: ' + err.message, 'error');
      }
    },

    async deleteIndepProduct(slug) {
      if (!confirm(`"${slug}" ürününü silmek istiyor musunuz?`)) return;
      try {
        await apiFetch('/api/module7?action=products', { method: 'DELETE', body: JSON.stringify({ slug }) });
        showToast('Ürün silindi.', 'success');
        await loadAllData();
      } catch (err) {
        showToast('Silinemedi: ' + err.message, 'error');
      }
    },

    openGalleryPhotoEditor(slug) {
      state.editingPhotoSlug = slug;
      renderGalleryTab();
    },

    closeGalleryPhotoEditor() {
      state.editingPhotoSlug = null;
      renderGalleryTab();
    },

    async saveGalleryPhotoForm(e) {
      e.preventDefault();
      try {
        const slug = document.getElementById('gph_slug')?.value?.trim();
        await apiFetch('/api/module1-content', {
          method: 'POST',
          body: JSON.stringify({
            action: 'direct-save',
            entity_type: 'gallery',
            entity_slug: slug,
            payload: {
              baslik: document.getElementById('gph_baslik')?.value?.trim() || slug,
              kategori: document.getElementById('gph_kat')?.value?.trim() || 'Kahve Köşeleri',
              resim: document.getElementById('gph_resim')?.value?.trim(),
              siralama: Number(document.getElementById('gph_sira')?.value || 1),
              anasayfada_goster: Boolean(document.getElementById('gph_show')?.checked),
            },
          }),
        });
        showToast('✅ Galeri fotoğrafı kaydedildi.', 'success');
        state.editingPhotoSlug = null;
        await loadAllData();
      } catch (err) {
        showToast('Fotoğraf kaydedilemedi: ' + err.message, 'error');
      }
    },

    async deleteGalleryPhoto(slug) {
      if (!confirm(`"${slug}" galeri fotoğrafını silmek istiyor musunuz?`)) return;
      try {
        await apiFetch('/api/module1-content', {
          method: 'POST',
          body: JSON.stringify({
            action: 'direct-save',
            entity_type: 'gallery',
            entity_slug: slug,
            payload: { _delete: true },
          }),
        });
        showToast('Fotoğraf silindi.', 'success');
        await loadAllData();
      } catch (err) {
        showToast('Silinemedi: ' + err.message, 'error');
      }
    },

    updateMapPreview(queryStr) {
      const f = document.getElementById('m1MapPreviewFrame');
      if (f && queryStr?.trim()) {
        f.src = `https://maps.google.com/maps?q=${encodeURIComponent(queryStr.trim())}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
      }
    },

    collectContactDraft() {
      const il = state.iletisimSayfasi;
      const g = state.genel;
      il.hero.image_url = document.getElementById('il_h_img')?.value?.trim() || il.hero.image_url;
      il.hero.eyebrow = document.getElementById('il_h_eye')?.value?.trim() ?? il.hero.eyebrow;
      il.hero.title_prefix = document.getElementById('il_h_tp')?.value?.trim() ?? il.hero.title_prefix;
      il.hero.title_em = document.getElementById('il_h_te')?.value?.trim() ?? il.hero.title_em;
      il.hero.title_suffix = document.getElementById('il_h_ts')?.value?.trim() ?? il.hero.title_suffix;
      il.hero.desc = document.getElementById('il_h_desc')?.value?.trim() ?? il.hero.desc;

      g.firma.logo = document.getElementById('ge_logo')?.value?.trim() || g.firma.logo;
      g.firma.ad = document.getElementById('ge_ad')?.value?.trim() || g.firma.ad;
      g.iletisim.telefon = document.getElementById('ge_tel')?.value?.trim() || g.iletisim.telefon;
      g.iletisim.whatsapp = document.getElementById('ge_wa')?.value?.trim() || g.iletisim.whatsapp;
      g.iletisim.email = document.getElementById('ge_email')?.value?.trim() || g.iletisim.email;
      g.iletisim.adres = document.getElementById('ge_adres')?.value?.trim() || g.iletisim.adres;
      g.sosyal_medya.instagram = document.getElementById('ge_ig')?.value?.trim() || '';
      g.sosyal_medya.facebook = document.getElementById('ge_fb')?.value?.trim() || '';
      g.sosyal_medya.youtube = document.getElementById('ge_yt')?.value?.trim() || '';
      g.topbar = {
        metin: document.getElementById('ge_topbar_txt')?.value?.trim() || '',
        aktif: Boolean(document.getElementById('ge_topbar_act')?.checked),
      };
      g.nav_cta = {
        yazi: document.getElementById('ge_nav_cta_yazi')?.value?.trim() || 'Teklif Al',
        link: document.getElementById('ge_nav_cta_link')?.value?.trim() || '/koleksiyon.html',
      };

      il.tiles = {
        ...(il.tiles || {}),
        tel_note: document.getElementById('il_t_tel_n')?.value?.trim() ?? il.tiles?.tel_note,
        wa_note: document.getElementById('il_t_wa_n')?.value?.trim() ?? il.tiles?.wa_note,
        email_note: document.getElementById('il_t_em_n')?.value?.trim() ?? il.tiles?.email_note,
      };
      il.dossier.title_prefix = document.getElementById('il_d_tp')?.value?.trim() ?? il.dossier.title_prefix;
      il.dossier.title_em = document.getElementById('il_d_te')?.value?.trim() ?? il.dossier.title_em;
      il.dossier.lead = document.getElementById('il_d_lead')?.value?.trim() ?? il.dossier.lead;
      il.dossier.capacity_val = document.getElementById('il_d_cap_v')?.value?.trim() ?? il.dossier.capacity_val;
      il.dossier.speed_val = document.getElementById('il_d_spd_v')?.value?.trim() ?? il.dossier.speed_val;
      il.dossier.hours = (il.dossier.hours || []).map((hr, idx) => ({
        ...hr,
        day: document.getElementById(`il_hr_d_${idx}`)?.value?.trim() || hr.day,
        val: document.getElementById(`il_hr_v_${idx}`)?.value?.trim() || hr.val,
      }));

      il.map.query = document.getElementById('il_map_q')?.value?.trim() || il.map.query;
      il.map.address_label = document.getElementById('il_map_lbl')?.value?.trim() || il.map.address_label;
      il.map.hours_summary = document.getElementById('il_map_hrs')?.value?.trim() || il.map.hours_summary;
      il.map.custom_embed_url = document.getElementById('il_map_emb')?.value?.trim() || '';

      il.form.title = document.getElementById('il_f_title')?.value?.trim() || il.form.title;
      il.form.subtitle = document.getElementById('il_f_sub')?.value?.trim() || il.form.subtitle;
      const subjRaw = document.getElementById('il_f_subjs')?.value || '';
      const subjLines = subjRaw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      if (subjLines.length) {
        il.form.subjects = subjLines.map((line) => ({ value: line, label: line }));
      }

      il.faq.items = (il.faq.items || []).map((fq, idx) => ({
        q: document.getElementById(`il_fq_q_${idx}`)?.value?.trim() || fq.q,
        a: document.getElementById(`il_fq_a_${idx}`)?.value?.trim() || fq.a,
      }));

      g.footer.tanitim_metni = document.getElementById('gf_tanitim')?.value?.trim() || g.footer.tanitim_metni;
      g.footer.cta_title = document.getElementById('gf_cta_t')?.value?.trim() || g.footer.cta_title;
      g.footer.cta_desc = document.getElementById('gf_cta_d')?.value?.trim() || g.footer.cta_desc;
      g.footer.badge_1 = document.getElementById('gf_b1')?.value?.trim() || g.footer.badge_1;
      g.footer.badge_2 = document.getElementById('gf_b2')?.value?.trim() || g.footer.badge_2;
      g.footer.badge_3 = document.getElementById('gf_b3')?.value?.trim() || g.footer.badge_3;
    },

    addFaqItem() {
      this.collectContactDraft();
      state.iletisimSayfasi.faq.items.push({ q: '✦ Yeni Soru?', a: 'Yanıt metnini buraya yazın.' });
      renderContactTab();
    },

    removeFaqItem(idx) {
      this.collectContactDraft();
      state.iletisimSayfasi.faq.items.splice(idx, 1);
      renderContactTab();
    },

    async saveContactAndGenel() {
      this.collectContactDraft();
      try {
        await Promise.all([
          saveSetting('iletisim_sayfasi', state.iletisimSayfasi, 'İletişim & Harita'),
          saveSetting('genel', state.genel, 'Genel Marka, Header & Footer'),
        ]);
      } catch (err) {
        showToast('Kaydedilemedi: ' + err.message, 'error');
      }
    },

    switchOtherSub(sub) {
      state.activeOtherSub = sub;
      state.editingBlogSlug = null;
      state.editingSupSlug = null;
      renderOthersTab();
    },

    async saveAboutPage() {
      const h = state.hakkimizda;
      h.hero.baslik = document.getElementById('hk_hb')?.value?.trim() || h.hero.baslik;
      h.hero.alt_yazi = document.getElementById('hk_ha')?.value?.trim() || h.hero.alt_yazi;
      h.ana_metin.paragraf_1 = document.getElementById('hk_p1')?.value?.trim() || h.ana_metin.paragraf_1;
      h.ana_metin.paragraf_2 = document.getElementById('hk_p2')?.value?.trim() || h.ana_metin.paragraf_2;
      h.misyon_vizyon.misyon_metin = document.getElementById('hk_mis')?.value?.trim() || h.misyon_vizyon.misyon_metin;
      h.misyon_vizyon.vizyon_metin = document.getElementById('hk_viz')?.value?.trim() || h.misyon_vizyon.vizyon_metin;
      try {
        await saveSetting('hakkimizda', h, 'Hakkımızda Sayfası');
      } catch (err) {
        showToast('Hata: ' + err.message, 'error');
      }
    },

    openBlogEditor(slug) { state.editingBlogSlug = slug; renderOthersTab(); },
    closeBlogEditor() { state.editingBlogSlug = null; renderOthersTab(); },
    async saveBlogForm(e) {
      e.preventDefault();
      try {
        await apiFetch('/api/module1-content', {
          method: 'POST',
          body: JSON.stringify({
            action: 'direct-save',
            entity_type: 'blog',
            entity_slug: document.getElementById('bl_s')?.value?.trim(),
            payload: {
              title: document.getElementById('bl_t')?.value?.trim(),
              kategori: document.getElementById('bl_c')?.value?.trim(),
              kapak_resim: document.getElementById('bl_img')?.value?.trim() || '/resim/logo.png',
              ozet: document.getElementById('bl_o')?.value?.trim() || '',
              body: document.getElementById('bl_b')?.value?.trim() || '',
              anasayfada_goster: Boolean(document.getElementById('bl_home')?.checked),
            },
          }),
        });
        showToast('✅ Blog yazısı kaydedildi.', 'success');
        state.editingBlogSlug = null;
        await loadAllData();
      } catch (err) { showToast('Hata: ' + err.message, 'error'); }
    },
    async deleteBlog(slug) {
      if (!confirm('Bu yazıyı silmek istiyor musunuz?')) return;
      await apiFetch('/api/module1-content', { method: 'POST', body: JSON.stringify({ action: 'direct-save', entity_type: 'blog', entity_slug: slug, payload: { _delete: true } }) });
      showToast('Yazı silindi.', 'success');
      await loadAllData();
    },

    openSupEditor(slug) { state.editingSupSlug = slug; renderOthersTab(); },
    closeSupEditor() { state.editingSupSlug = null; renderOthersTab(); },
    async saveSupForm(e) {
      e.preventDefault();
      try {
        await apiFetch('/api/module1-content', {
          method: 'POST',
          body: JSON.stringify({
            action: 'direct-save',
            entity_type: 'supplier',
            entity_slug: document.getElementById('sp_slug')?.value?.trim(),
            payload: {
              ad: document.getElementById('sp_ad')?.value?.trim(),
              kategori: document.getElementById('sp_cat')?.value?.trim(),
              logo: document.getElementById('sp_img')?.value?.trim() || '/resim/logo.png',
              aciklama: document.getElementById('sp_desc')?.value?.trim() || '',
              siralama: Number(document.getElementById('sp_ord')?.value || 1),
              link: document.getElementById('sp_lnk')?.value?.trim() || '',
            },
          }),
        });
        showToast('✅ Tedarikçi kaydedildi.', 'success');
        state.editingSupSlug = null;
        await loadAllData();
      } catch (err) { showToast('Hata: ' + err.message, 'error'); }
    },
    async deleteSup(slug) {
      if (!confirm('Bu tedarikçiyi silmek istiyor musunuz?')) return;
      await apiFetch('/api/module1-content', { method: 'POST', body: JSON.stringify({ action: 'direct-save', entity_type: 'supplier', entity_slug: slug, payload: { _delete: true } }) });
      showToast('Tedarikçi silindi.', 'success');
      await loadAllData();
    },
  };
})();

// js/modules/publish-calendar.js
// Büyük Sosyal Medya Yayın ve Kampanya Takvimi Modalı

let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth(); // 0-indexed
let selectedDayStr = new Date().toISOString().slice(0, 10);
let cachedCampaigns = [];

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const DAY_NAMES_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export function renderPublishCalendarModalHtml() {
  return `
    <div id="publishCalendarModal" class="campaign-modal-backdrop" style="display:none; position:fixed; inset:0; z-index:100015; background:rgba(3,7,18,0.88); backdrop-filter:blur(10px); align-items:center; justify-content:center; padding:16px;">
      <div class="calendar-modal-window" style="background:#0b1120; border:1px solid rgba(56,189,248,0.35); border-radius:20px; width:1100px; max-width:100%; max-height:94vh; overflow:hidden; box-shadow:0 30px 90px rgba(0,0,0,0.85); color:#f8fafc; display:flex; flex-direction:column;">
        
        <!-- HEADER -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid rgba(148,163,184,0.18); background:linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.85));">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:linear-gradient(135deg, #38bdf8, #0284c7); display:flex; align-items:center; justify-content:center; font-size:20px; box-shadow:0 4px 14px rgba(56,189,248,0.35);">
              📅
            </div>
            <div>
              <h2 style="font-size:16px; font-weight:800; color:#fff; margin:0;">Sosyal Medya Yayın &amp; Kampanya Takvimi</h2>
              <p style="font-size:11px; color:#94a3b8; margin:2px 0 0 0;">Planlanan tüm kampanyalar, öncelikli günler ve otonom 4 bot yayın akışı</p>
            </div>
          </div>

          <!-- AY GEÇİŞLERİ VE AKSİYONLAR -->
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="display:flex; align-items:center; background:rgba(15,23,42,0.8); border:1px solid rgba(148,163,184,0.25); border-radius:9px; padding:3px 6px;">
              <button type="button" onclick="window.changeCalendarMonth(-1)" style="padding:5px 10px; background:transparent; border:0; color:#cbd5e1; font-weight:700; cursor:pointer; font-size:13px;" title="Önceki Ay">◀</button>
              <button type="button" onclick="window.jumpCalendarToToday()" style="padding:5px 10px; background:transparent; border:0; color:#38bdf8; font-weight:700; cursor:pointer; font-size:11.5px;">Bugün</button>
              <button type="button" onclick="window.changeCalendarMonth(1)" style="padding:5px 10px; background:transparent; border:0; color:#cbd5e1; font-weight:700; cursor:pointer; font-size:13px;" title="Sonraki Ay">▶</button>
            </div>
            
            <h3 id="calMonthYearTitle" style="font-size:15px; font-weight:800; color:#fde68a; margin:0; min-width:140px; text-align:center;">Kasım 2026</h3>

            <button type="button" onclick="window.closePublishCalendarModal()" style="padding:6px 12px; border-radius:8px; border:1px solid #475569; background:transparent; color:#cbd5e1; font-weight:700; cursor:pointer; font-size:14px; margin-left:8px;">
              ✕
            </button>
          </div>
        </div>

        <!-- MAIN CALENDAR GRID & SIDEBAR SPLIT -->
        <div style="display:grid; grid-template-columns:1fr 340px; flex:1; overflow:hidden;">
          
          <!-- SOL: TAKVİM IZGARASI -->
          <div style="padding:16px 20px; overflow-y:auto; border-right:1px solid rgba(148,163,184,0.15);">
            <!-- GÜN BAŞLIKLARI -->
            <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; margin-bottom:8px; text-align:center;">
              ${DAY_NAMES_TR.map(d => `<div style="font-size:11px; font-weight:700; color:#94a3b8; padding:6px 0;">${d}</div>`).join('')}
            </div>
            <!-- GÜN HÜCRELERİ -->
            <div id="calDaysGrid" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px;">
              <!-- JavaScript ile doldurulur -->
            </div>
          </div>

          <!-- SAĞ: SEÇİLİ GÜN DETAYLARI & KAMPANYA OLUŞTURMA PANELİ -->
          <div style="padding:18px 20px; background:rgba(15,23,42,0.6); display:flex; flex-direction:column; justify-content:space-between; overflow-y:auto;">
            <div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                <span style="font-size:11px; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:1px;">Seçili Gün İncelemesi</span>
                <span id="calSelectedDayBadge" style="font-size:11px; padding:2px 8px; border-radius:99px; background:rgba(56,189,248,0.2); color:#38bdf8; font-weight:700;">Bugün</span>
              </div>
              
              <h3 id="calSelectedDayTitle" style="font-size:16px; font-weight:800; color:#fff; margin:0 0 10px 0;">7 Kasım 2026</h3>
              
              <div id="calDayDetailsBox" style="margin-bottom:16px;">
                <!-- JavaScript gün içeriğini doldurur -->
              </div>
            </div>

            <!-- BUTON: BU GÜNE KAMPANYA OLUŞTUR -->
            <div style="padding-top:16px; border-top:1px solid rgba(148,163,184,0.18);">
              <button
                type="button"
                id="btnCreateCampaignForSelectedDay"
                onclick="window.triggerCampaignForSelectedDay()"
                style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; border-radius:9px; border:1px solid #d4af37; background:linear-gradient(135deg, #d4af37, #9b7220); color:#0b1120; font-size:13px; font-weight:800; cursor:pointer; box-shadow:0 4px 16px rgba(212,175,55,0.35); transition:all .2s ease;"
                onmouseover="this.style.filter='brightness(1.15)'"
                onmouseout="this.style.filter='none'"
              >
                ✨ Bu Güne Özel Kampanya Oluştur
              </button>
              <small style="display:block; text-align:center; color:#94a3b8; font-size:10.5px; margin-top:6px;">
                Tarih otomatik seçilir, o gün sadece bu kampanya yayınlanır.
              </small>
            </div>

          </div>

        </div>

      </div>
    </div>
  `;
}

// Takvimi Aç
export async function openPublishCalendarModal() {
  let modal = document.getElementById('publishCalendarModal');
  if (!modal) {
    const wrap = document.createElement('div');
    wrap.innerHTML = renderPublishCalendarModalHtml();
    document.body.appendChild(wrap.firstElementChild);
    modal = document.getElementById('publishCalendarModal');
  }
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  await fetchCampaignsList();
  renderCalendarView();
}

// Takvimi Kapat
export function closePublishCalendarModal() {
  const modal = document.getElementById('publishCalendarModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

// Ay Değiştir
export function changeCalendarMonth(delta) {
  currentCalMonth += delta;
  if (currentCalMonth < 0) {
    currentCalMonth = 11;
    currentCalYear -= 1;
  } else if (currentCalMonth > 11) {
    currentCalMonth = 0;
    currentCalYear += 1;
  }
  renderCalendarView();
}

// Bugüne Atla
export function jumpCalendarToToday() {
  const now = new Date();
  currentCalYear = now.getFullYear();
  currentCalMonth = now.getMonth();
  selectedDayStr = now.toISOString().slice(0, 10);
  renderCalendarView();
}

// Kampanyaları API'den Çek
async function fetchCampaignsList() {
  try {
    const res = await fetch('/api/module2?action=campaigns', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    cachedCampaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
  } catch (err) {
    console.error('Takvim kampanya yükleme hatası:', err);
    cachedCampaigns = [];
  }
}

// Takvim Izgarasını Çiz
function renderCalendarView() {
  const titleEl = document.getElementById('calMonthYearTitle');
  if (titleEl) {
    titleEl.textContent = `${MONTH_NAMES_TR[currentCalMonth]} ${currentCalYear}`;
  }

  const grid = document.getElementById('calDaysGrid');
  if (!grid) return;

  const firstDayOfMonth = new Date(currentCalYear, currentCalMonth, 1);
  const lastDayOfMonth = new Date(currentCalYear, currentCalMonth + 1, 0);
  const totalDays = lastDayOfMonth.getDate();

  // Pazartesi başlangıçlı indeks (0: Pzt, 6: Paz)
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const prevMonthLastDay = new Date(currentCalYear, currentCalMonth, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  let cellsHtml = '';

  // Önceki ayın günleri
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dNum = prevMonthLastDay - i;
    cellsHtml += `
      <div style="background:rgba(15,23,42,0.3); border:1px solid rgba(148,163,184,0.06); border-radius:10px; min-height:85px; padding:6px; opacity:0.35;">
        <span style="font-size:11px; font-weight:700; color:#64748b;">${dNum}</span>
      </div>
    `;
  }

  // Bu ayın günleri
  for (let d = 1; d <= totalDays; d++) {
    const mm = String(currentCalMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${currentCalYear}-${mm}-${dd}`;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDayStr;

    // Bu güne ait kampanya var mı?
    const dayCampaigns = cachedCampaigns.filter(c => {
      const cDate = c.publish_date || (c.created_at ? c.created_at.slice(0, 10) : '');
      return cDate === dateStr;
    });

    const hasCampaign = dayCampaigns.length > 0;
    const borderCol = isSelected ? '#38bdf8' : (isToday ? '#d4af37' : (hasCampaign ? 'rgba(212,175,55,0.4)' : 'rgba(148,163,184,0.12)'));
    const bgCol = isSelected ? 'rgba(56,189,248,0.12)' : (isToday ? 'rgba(212,175,55,0.08)' : (hasCampaign ? 'rgba(212,175,55,0.04)' : 'rgba(30,41,59,0.3)'));

    cellsHtml += `
      <div
        onclick="window.selectCalendarDay('${dateStr}')"
        style="background:${bgCol}; border:1.5px solid ${borderCol}; border-radius:10px; min-height:92px; padding:7px; cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; transition:all .15s ease;"
        onmouseover="this.style.transform='scale(1.02)'"
        onmouseout="this.style.transform='none'"
      >
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; font-weight:800; color:${isToday ? '#fde68a' : (isSelected ? '#38bdf8' : '#e2e8f0')};">
            ${d}
          </span>
          ${isToday ? '<span style="font-size:9.5px; background:#d4af37; color:#0b1120; font-weight:800; padding:1px 5px; border-radius:4px;">BUGÜN</span>' : ''}
          ${hasCampaign && !isToday ? '<span style="font-size:9.5px; background:rgba(212,175,55,0.25); color:#fde68a; font-weight:800; padding:1px 4px; border-radius:4px;">⭐ KAMPANYA</span>' : ''}
        </div>

        <div style="margin-top:4px; display:flex; flex-direction:column; gap:3px;">
          ${dayCampaigns.slice(0, 2).map(c => `
            <div style="background:linear-gradient(135deg, rgba(212,175,55,0.25), rgba(15,23,42,0.85)); border:1px solid rgba(212,175,55,0.4); border-radius:5px; padding:3px 5px; font-size:10px; color:#fde68a; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              🏷️ ${escapeHtml(c.title || 'Özel Kampanya')} ${c.discount_amount ? `(${escapeHtml(c.discount_amount)})` : ''}
            </div>
          `).join('')}
          ${!hasCampaign ? `
            <div style="font-size:9.5px; color:#64748b; line-height:1.2;">
              🔄 Standart Akış
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  grid.innerHTML = cellsHtml;
  updateDayDetailsPanel();
}

// Gün Seçildiğinde
export function selectCalendarDay(dateStr) {
  selectedDayStr = dateStr;
  renderCalendarView();
}

// Seçili Gün Detay Panelini Güncelle
function updateDayDetailsPanel() {
  const titleEl = document.getElementById('calSelectedDayTitle');
  const badgeEl = document.getElementById('calSelectedDayBadge');
  const box = document.getElementById('calDayDetailsBox');
  if (!titleEl || !box) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = selectedDayStr === todayStr;

  const parts = selectedDayStr.split('-');
  const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const formattedDate = `${dateObj.getDate()} ${MONTH_NAMES_TR[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  titleEl.textContent = formattedDate;
  if (badgeEl) {
    badgeEl.textContent = isToday ? 'Bugün' : (selectedDayStr > todayStr ? 'Gelecek Gün' : 'Geçmiş');
    badgeEl.style.background = isToday ? 'rgba(212,175,55,0.25)' : 'rgba(56,189,248,0.2)';
    badgeEl.style.color = isToday ? '#fde68a' : '#38bdf8';
  }

  // Bu güne ait kampanya
  const dayCampaigns = cachedCampaigns.filter(c => {
    const cDate = c.publish_date || (c.created_at ? c.created_at.slice(0, 10) : '');
    return cDate === selectedDayStr;
  });

  if (dayCampaigns.length > 0) {
    box.innerHTML = dayCampaigns.map(c => `
      <div style="background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.35); border-radius:12px; padding:14px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:10px; background:#d4af37; color:#0b1120; font-weight:800; padding:2px 6px; border-radius:4px;">⭐ ÖNCELİKLİ GÜN</span>
          <span style="font-size:11px; color:#fde68a; font-weight:700;">${escapeHtml(c.discount_amount || '')}</span>
        </div>
        <h4 style="font-size:13.5px; font-weight:800; color:#fff; margin:0 0 4px 0;">${escapeHtml(c.title)}</h4>
        <p style="font-size:11px; color:#cbd5e1; margin:0 0 10px 0; line-height:1.4;">${escapeHtml(c.campaign_intro || '')}</p>
        
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <span style="font-size:10px; background:rgba(30,41,59,0.7); color:#94a3b8; padding:3px 7px; border-radius:5px;">📸 10:00 Carousel</span>
          <span style="font-size:10px; background:rgba(30,41,59,0.7); color:#94a3b8; padding:3px 7px; border-radius:5px;">📱 14:30 Story</span>
          <span style="font-size:10px; background:rgba(30,41,59,0.7); color:#94a3b8; padding:3px 7px; border-radius:5px;">🎬 19:30 Reels</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; flex-wrap:wrap; gap:8px;">
          <div style="font-size:10.5px; color:#38bdf8; font-weight:600;">
            ℹ️ Bu tarihte normal katalog akışı durdurulacak, yalnızca bu kampanya yayınlanacaktır.
          </div>
          <button type="button" onclick="window.openCampaignReviewModal('${escapeHtml(c.id)}')" style="padding:5px 12px; border-radius:6px; border:1px solid #d4af37; background:rgba(212,175,55,0.18); color:#fde68a; font-size:11px; font-weight:700; cursor:pointer;">
            🔍 İncele &amp; Onayla
          </button>
        </div>
      </div>
    `).join('');
  } else {
    box.innerHTML = `
      <div style="background:rgba(30,41,59,0.4); border:1px dashed rgba(148,163,184,0.2); border-radius:12px; padding:14px; text-align:center;">
        <div style="font-size:24px; margin-bottom:6px;">🔄</div>
        <h4 style="font-size:13px; font-weight:700; color:#e2e8f0; margin:0 0 4px 0;">Standart Katalog Yayın Akışı</h4>
        <p style="font-size:11px; color:#94a3b8; margin:0 0 10px 0; line-height:1.4;">
          Bu gün için planlanmış özel bir kampanya bulunmuyor. Katalogdaki mobilyalar belirlenen saatlerde otonom olarak paylaşılır:
        </p>
        <div style="display:flex; justify-content:center; gap:6px;">
          <span style="font-size:10px; background:rgba(15,23,42,0.8); color:#38bdf8; padding:2px 6px; border-radius:4px;">10:00 Gönderi</span>
          <span style="font-size:10px; background:rgba(15,23,42,0.8); color:#38bdf8; padding:2px 6px; border-radius:4px;">14:30 Story</span>
          <span style="font-size:10px; background:rgba(15,23,42,0.8); color:#38bdf8; padding:2px 6px; border-radius:4px;">19:30 Reels</span>
        </div>
      </div>
    `;
  }
}

// Seçili Gün İçin Kampanya Oluştur Butonu
export function triggerCampaignForSelectedDay() {
  closePublishCalendarModal();
  if (typeof window.openCampaignStudioModal === 'function') {
    window.openCampaignStudioModal(selectedDayStr);
  }
}

// Global window erişimi
if (typeof window !== 'undefined') {
  window.openPublishCalendarModal = openPublishCalendarModal;
  window.closePublishCalendarModal = closePublishCalendarModal;
  window.changeCalendarMonth = changeCalendarMonth;
  window.jumpCalendarToToday = jumpCalendarToToday;
  window.selectCalendarDay = selectCalendarDay;
  window.triggerCampaignForSelectedDay = triggerCampaignForSelectedDay;

  // Kampanya oluşturulduğunda takvimi güncelle
  window.addEventListener('campaignCreated', async () => {
    await fetchCampaignsList();
    renderCalendarView();
  });
}

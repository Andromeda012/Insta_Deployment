// Global Mobilya — Master Application Coordinator
import { mockData } from './js/data.js';
import { renderDashboard } from './js/modules/dashboard.js';
import { renderWebsiteModule } from './js/modules/website.js';
import { renderSocialModule } from './js/modules/social.js';
import { renderCrmModule } from './js/modules/crm.js';
import { renderProductionModule } from './js/modules/production.js';
import { renderOperationsModule } from './js/modules/operations.js';
import { renderAnalyticsModule } from './js/modules/analytics.js';
import { renderPermissionsModule } from './js/modules/permissions.js';

// Application State
const state = {
    currentRoute: 'dashboard',
    currentRole: mockData.roles[0], // default: Sistem Yöneticisi
    isAnalyticsEmpty: false
};

// DOM Mount Elements
const contentContainer = document.getElementById('main-content-view');
const activeRoleBadge = document.getElementById('active-role-badge');
const roleSelectHeader = document.getElementById('role-select-header');
const toastEl = document.getElementById('toast');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

// Navigation Controller
export function navigateTo(route) {
    state.currentRoute = route;

    // Update active class on sidebar items
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.route === route) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
    }

    renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render View Router
function renderCurrentView() {
    if (!contentContainer) return;

    const isEmbeddedModule = state.currentRoute === 'website' || state.currentRoute === 'social' || state.currentRoute === 'production';
    contentContainer.classList.toggle('full-bleed-module', isEmbeddedModule);
    document.body.classList.toggle('module-immersive-view', isEmbeddedModule);

    switch (state.currentRoute) {
        case 'dashboard':
            contentContainer.innerHTML = renderDashboard(mockData, navigateTo);
            break;
        case 'website':
            contentContainer.innerHTML = renderWebsiteModule(mockData);
            break;
        case 'social':
            contentContainer.innerHTML = renderSocialModule(mockData);
            break;
        case 'crm':
            contentContainer.innerHTML = renderCrmModule(mockData);
            break;
        case 'production':
            contentContainer.innerHTML = renderProductionModule(mockData);
            break;
        case 'operations':
            contentContainer.innerHTML = renderOperationsModule(mockData);
            break;
        case 'analytics':
            contentContainer.innerHTML = renderAnalyticsModule(mockData);
            break;
        case 'permissions':
            contentContainer.innerHTML = renderPermissionsModule(mockData, state.currentRole);
            break;
        default:
            contentContainer.innerHTML = renderDashboard(mockData, navigateTo);
    }
}

// Global Role Switcher
export function setRole(roleId) {
    const role = mockData.roles.find(r => r.id === roleId);
    if (!role) return;

    state.currentRole = role;

    if (activeRoleBadge) {
        activeRoleBadge.textContent = role.badge;
    }
    if (roleSelectHeader) {
        roleSelectHeader.value = role.id;
    }

    // Sync role with Module 4 (Production Order System)
    const mod4Role = roleId === 'admin' ? 'admin' : (roleId === 'management' || roleId === 'sales') ? 'staff_authorized' : 'viewer';
    localStorage.setItem('global_kapak_role', mod4Role);

    showToast(`Aktif Rol Değiştirildi: ${role.name}`);
    renderCurrentView();
}

// Toast Notifications
export function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3200);
}

// Modal Manager
export function showModal(title, bodyHtml) {
    if (!modalOverlay || !modalTitle || !modalBody) return;
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalOverlay.classList.add('active');
}

export function closeModal() {
    if (modalOverlay) {
        modalOverlay.classList.remove('active');
    }
}

// Detail View Helpers
export function showProductDetail(productId) {
    const product = mockData.website.products.find(p => p.id === productId);
    if (!product) return;

    const html = `
        <div class="detail-drawer-content">
            <div class="detail-header-row">
                <span class="badge badge-accent">${product.category}</span>
                <code>SKU: ${product.sku}</code>
            </div>
            <h2 style="margin: 10px 0;">${product.name}</h2>
            <div class="detail-price-box">
                <span>Fiyat:</span>
                <strong>${product.price}</strong>
            </div>
            <div class="info-metric-list" style="margin-top: 16px;">
                <div class="info-metric-item">
                    <span>Malzeme & Ağaç Türü:</span>
                    <strong>${product.material}</strong>
                </div>
                <div class="info-metric-item">
                    <span>Mevcut Depo Stoğu:</span>
                    <strong>${product.stock} Adet</strong>
                </div>
                <div class="info-metric-item">
                    <span>Ürün Durumu:</span>
                    <strong class="${product.status === 'Stokta' ? 'text-success' : 'text-warning'}">${product.status}</strong>
                </div>
                <div class="info-metric-item">
                    <span>Öne Çıkan Ürün:</span>
                    <strong>${product.featured ? 'Evet (Ana Sayfada Gösterilir)' : 'Hayır'}</strong>
                </div>
            </div>
            <div style="margin-top: 24px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="window.closeModal()">Kapat</button>
                <button class="btn btn-primary" onclick="window.showToast('${product.name} için katalog düzenleme modu simüle edildi.'); window.closeModal();">Düzenle</button>
            </div>
        </div>
    `;
    showModal('Ürün Detay Kartı', html);
}

export function showLeadDetail(leadId) {
    const lead = mockData.crm.leads.find(l => l.id === leadId);
    if (!lead) return;

    const html = `
        <div class="detail-drawer-content">
            <div class="detail-header-row">
                <span class="badge badge-primary">${lead.channel}</span>
                <code>${lead.id}</code>
            </div>
            <h2 style="margin: 10px 0;">${lead.customer}</h2>
            <p style="color: var(--text-muted);">${lead.scope}</p>

            <div class="info-metric-list" style="margin-top: 16px;">
                <div class="info-metric-item">
                    <span>Huni Aşaması:</span>
                    <span class="badge badge-accent">${lead.stage}</span>
                </div>
                <div class="info-metric-item">
                    <span>Tahmini Teklif Tutarı:</span>
                    <strong class="text-success">${lead.value}</strong>
                </div>
                <div class="info-metric-item">
                    <span>Sorumlu Temsilci:</span>
                    <strong>${lead.assignedTo}</strong>
                </div>
                <div class="info-metric-item">
                    <span>Son Not:</span>
                    <p style="margin: 0; font-size: 13px;">${lead.notes}</p>
                </div>
            </div>

            <div style="margin-top: 24px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="window.closeModal()">Kapat</button>
                <button class="btn btn-primary" onclick="window.showToast('${lead.id} için teklif PDF oluşturma penceresi açıldı.'); window.closeModal();">Teklif Hazırla</button>
            </div>
        </div>
    `;
    showModal('Müşteri Fırsat Detayı', html);
}

export function showWorkOrderDetail(orderId) {
    const ord = mockData.production.workOrders.find(o => o.id === orderId);
    if (!ord) return;

    const html = `
        <div class="detail-drawer-content">
            <div class="detail-header-row">
                <span class="badge badge-accent">${ord.stage}</span>
                <code>İş Emri: ${ord.id}</code>
            </div>
            <h2 style="margin: 10px 0;">${ord.item}</h2>
            <p style="color: var(--text-muted);">Müşteri: <strong>${ord.customer}</strong> • Miktar: ${ord.quantity}</p>

            <div class="cnc-workflow-timeline" style="margin: 20px 0;">
                <h4>Üretim Aşamaları Takibi:</h4>
                <div class="workflow-steps">
                    <span class="step-badge done">1. Kesim ✓</span> →
                    <span class="step-badge ${ord.stageIndex >= 2 ? 'done' : 'pending'}">2. CNC İşleme</span> →
                    <span class="step-badge ${ord.stageIndex >= 3 ? 'done' : 'pending'}">3. Zımpara/Cila</span> →
                    <span class="step-badge ${ord.stageIndex >= 4 ? 'done' : 'pending'}">4. Döşeme</span> →
                    <span class="step-badge ${ord.stageIndex >= 5 ? 'done' : 'pending'}">5. Montaj</span> →
                    <span class="step-badge ${ord.stageIndex >= 6 ? 'done' : 'pending'}">6. Kalite</span>
                </div>
            </div>

            <div class="info-metric-list">
                <div class="info-metric-item">
                    <span>Sorumlu Fabrika Ekibi:</span>
                    <strong>${ord.team}</strong>
                </div>
                <div class="info-metric-item">
                    <span>İlerleme Oranı:</span>
                    <strong>%${ord.progress}</strong>
                </div>
                <div class="info-metric-item">
                    <span>Planlanan Teslim:</span>
                    <strong>${ord.targetDate}</strong>
                </div>
                ${ord.bottleneck ? `
                    <div class="info-metric-item" style="color: var(--warning);">
                        <span>Darboğaz / Not:</span>
                        <strong>${ord.bottleneck}</strong>
                    </div>
                ` : ''}
            </div>

            <div style="margin-top: 24px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="window.closeModal()">Kapat</button>
                <button class="btn btn-primary" onclick="window.showToast('${ord.id} sonraki aşamaya taşındı.'); window.closeModal();">Aşamayı İlerlet</button>
            </div>
        </div>
    `;
    showModal('İmalat İş Emri Kartı', html);
}

// Tab Switcher
export function switchTab(buttonElement, targetId) {
    const parentContainer = buttonElement.closest('.tab-container');
    if (!parentContainer) return;

    parentContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    parentContainer.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    buttonElement.classList.add('active');
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
        targetContent.classList.add('active');
    }
}

// Table Filtering Utilities
export function filterTable(tableId, query) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    const lowerQuery = query.toLowerCase().trim();

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(lowerQuery) ? '' : 'none';
    });
}

export function filterTableByCategory(tableId, category) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        if (!category) {
            row.style.display = '';
        } else {
            row.style.display = row.textContent.includes(category) ? '' : 'none';
        }
    });
}

export function filterTableByStage(tableId, stage) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        if (!stage) {
            row.style.display = '';
        } else {
            row.style.display = row.textContent.includes(stage) ? '' : 'none';
        }
    });
}

// Empty State Toggle for Analytics
export function toggleAnalyticsEmptyState() {
    state.isAnalyticsEmpty = !state.isAnalyticsEmpty;
    const analyticsBox = document.getElementById('analytics-content');
    if (!analyticsBox) return;

    if (state.isAnalyticsEmpty) {
        analyticsBox.innerHTML = `
            <div class="card panel empty-state-box">
                <div class="empty-icon">📊</div>
                <h3>Seçili Tarih Aralığında Veri Bulunamadı</h3>
                <p>Bu filtreleme kriteri için kayıtlı ciro, üretim veya sosyal medya telemetrisi mevcut değil.</p>
                <button class="btn btn-primary" onclick="window.toggleAnalyticsEmptyState()">Örnek Verileri Yeniden Göster</button>
            </div>
        `;
        showToast('Analitik Boş Durum (Empty State) Gösteriliyor');
    } else {
        renderCurrentView();
        showToast('Örnek Analitik Verileri Yenilendi');
    }
}

// Trigger Refresh
export function triggerRefresh() {
    showToast('Platform metrikleri ve üretim telemetrisi yenilendi.');
    renderCurrentView();
}

// Embedded Module 1 & Module 4 Bridge Controllers
export function controlModule1Tab(btnEl, tabId) {
    if (btnEl) {
        btnEl.closest('.embed-quick-tabs')?.querySelectorAll('.embed-tab-chip').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
    }
    const frame = document.getElementById('module1-frame');
    if (frame && frame.contentWindow && typeof frame.contentWindow.switchMainTab === 'function') {
        const doc = frame.contentDocument || frame.contentWindow.document;
        const targetBtn = doc.querySelector(`.nav-tab-btn[onclick*="${tabId}"]`);
        frame.contentWindow.switchMainTab({ currentTarget: targetBtn }, tabId);
    }
}

export function openModule1TokenModal() {
    const frame = document.getElementById('module1-frame');
    if (frame && frame.contentWindow && typeof frame.contentWindow.openTokenModal === 'function') {
        frame.contentWindow.openTokenModal();
    }
}

export function controlModule4Tab(btnEl, tabName) {
    if (btnEl) {
        btnEl.closest('.embed-quick-tabs')?.querySelectorAll('.embed-tab-chip').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
    }
    const frame = document.getElementById('module4-frame');
    if (frame && frame.contentWindow && typeof frame.contentWindow.setTab === 'function') {
        frame.contentWindow.setTab(tabName);
    }
}

export function openModule4Modal(modalId) {
    const frame = document.getElementById('module4-frame');
    if (frame && frame.contentWindow && typeof frame.contentWindow.openModal === 'function') {
        frame.contentWindow.openModal(modalId);
    }
}

export function syncModule4Cloud() {
    const frame = document.getElementById('module4-frame');
    if (frame && frame.contentWindow && typeof frame.contentWindow.syncWithCloud === 'function') {
        frame.contentWindow.syncWithCloud(false);
    }
}

export function reloadModuleFrame(frameId) {
    const frame = document.getElementById(frameId);
    if (frame && frame.contentWindow) {
        frame.contentWindow.location.reload();
        showToast('Modül görünümü yenilendi.');
    }
}

// In-App Fullscreen Controller (Expands module to 100% inside the platform without opening a new tab)
export function toggleInAppFullscreen(forceState) {
    const isNowFullscreen = typeof forceState === 'boolean'
        ? document.body.classList.toggle('in-app-fullscreen', forceState)
        : document.body.classList.toggle('in-app-fullscreen');

    // Sync button labels inside embedded module frames if present
    ['module1-frame', 'module2-frame', 'module4-frame'].forEach(id => {
        const frame = document.getElementById(id);
        const doc = frame?.contentDocument || frame?.contentWindow?.document;
        const btn = doc?.getElementById('inAppFsBtn');
        if (btn) {
            btn.innerHTML = isNowFullscreen ? '✕ Normal Görünüm' : '⛶ Tam Ekran';
        }
    });

    return isNowFullscreen;
}

// Module 2 Multi-Bot Channel Switcher
export function switchSocialBotChannel(btnEl, channel) {
    const frame = document.getElementById('module2-frame');
    if (channel === 'instagram' || channel === 'facebook') {
        if (btnEl) {
            btnEl.parentElement?.querySelectorAll('.embed-tab-chip').forEach(b => b.classList.remove('active'));
            btnEl.classList.add('active');
        }
        if (channel === 'instagram') {
            if (frame && !frame.src.includes('Module%202/Instagram/index.html')) {
                frame.src = 'Module%202/Instagram/index.html';
            }
            showToast('📸 Instagram Bulut Bot Kontrol Merkezi aktif.');
        } else if (channel === 'facebook') {
            if (frame && !frame.src.includes('Module%202/Facebook/index.html')) {
                frame.src = 'Module%202/Facebook/index.html';
            }
            showToast('📘 Facebook Kurumsal Sayfa Botu Kontrol Merkezi aktif.');
        }
        return;
    }
    const labelMap = {
        tiktok: 'TikTok Bot (Module 2/Tiktok)',
        youtube: 'YouTube Shorts Bot (Module 2/Youtube Shorts)'
    };
    showToast(`ℹ️ ${labelMap[channel] || channel} bir sonraki adımda kodlanacaktır. Şu an Instagram ve Facebook Botları aktif!`);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // Expose helpers globally to window for inline template handlers
    window.navigateTo = navigateTo;
    window.setRole = setRole;
    window.showToast = showToast;
    window.showModal = showModal;
    window.closeModal = closeModal;
    window.showProductDetail = showProductDetail;
    window.showLeadDetail = showLeadDetail;
    window.showWorkOrderDetail = showWorkOrderDetail;
    window.switchTab = switchTab;
    window.filterTable = filterTable;
    window.filterTableByCategory = filterTableByCategory;
    window.filterTableByStage = filterTableByStage;
    window.toggleAnalyticsEmptyState = toggleAnalyticsEmptyState;
    window.triggerRefresh = triggerRefresh;
    window.controlModule1Tab = controlModule1Tab;
    window.openModule1TokenModal = openModule1TokenModal;
    window.controlModule4Tab = controlModule4Tab;
    window.openModule4Modal = openModule4Modal;
    window.syncModule4Cloud = syncModule4Cloud;
    window.reloadModuleFrame = reloadModuleFrame;
    window.toggleInAppFullscreen = toggleInAppFullscreen;
    window.switchSocialBotChannel = switchSocialBotChannel;

    // Allow Escape key to exit in-app fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('in-app-fullscreen')) {
            toggleInAppFullscreen(false);
        }
    });

    // Sidebar navigation clicks
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const route = item.dataset.route;
            if (route) {
                navigateTo(route);
            }
        });
    });

    // Mobile sidebar toggle
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }

    // Role switcher in top header
    if (roleSelectHeader) {
        roleSelectHeader.addEventListener('change', (e) => {
            setRole(e.target.value);
        });
    }

    // Modal close button
    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    // Global quick search handler
    const globalSearchInput = document.getElementById('global-search-input');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const q = e.target.value.trim();
                if (q) {
                    showToast(`"${q}" için platform genelinde arama simüle edildi`);
                }
            }
        });
    }

    // Initial render
    navigateTo('dashboard');
});

// Global Mobilya — Master Application Coordinator
import { mockData } from './js/data.js';
import {
    initializeCentralAuth,
    getUserRoles,
    signOutCentral,
    canDepartmentAccessRoute,
    getDepartmentConfig,
    enforceReadOnlyDomLockIfNeeded,
    isViewerReadOnly
} from './js/auth.js';
import { renderWebsiteModule } from './js/modules/website.js';
import { renderSocialModule } from './js/modules/social.js';
import { renderProductsModule } from './js/modules/products.js';
import { renderCrmModule } from './js/modules/crm.js';
import { renderProductionModule } from './js/modules/production.js';
import { renderOperationsModule } from './js/modules/operations.js';
import { renderAnalyticsModule } from './js/modules/analytics.js';
import { renderPermissionsModule } from './js/modules/permissions.js';
import { renderStudioModule } from './js/modules/studio.js';

// Application State
const state = {
    currentRoute: 'products',
    currentRole: mockData.roles[0],
    user: null,
    department: 'viewer',
    roles: [],
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

function canAccessRoute(route) {
    return canDepartmentAccessRoute(state.department, route);
}

function getDefaultRoute() {
    const deptCfg = getDepartmentConfig(state.department);
    if (deptCfg?.defaultRoute && canAccessRoute(deptCfg.defaultRoute)) {
        return deptCfg.defaultRoute;
    }
    for (const candidate of ['products', 'production', 'crm', 'social', 'website', 'studio', 'analytics', 'operations']) {
        if (canAccessRoute(candidate)) return candidate;
    }
    return 'products';
}

function propagateAuthAndReadOnlyToIframes() {
    document.querySelectorAll('iframe').forEach(frame => {
        const applyToFrame = () => {
            try {
                const doc = frame.contentDocument || frame.contentWindow?.document;
                if (doc) {
                    enforceReadOnlyDomLockIfNeeded(doc);
                }
            } catch (_) {}
        };
        applyToFrame();
        frame.addEventListener('load', applyToFrame);
    });
}

function applyAuthenticatedUser(user) {
    state.user = user;
    state.department = user.department || 'viewer';
    state.roles = getUserRoles(user);
    const deptCfg = getDepartmentConfig(state.department);

    if (activeRoleBadge) {
        activeRoleBadge.textContent = `${deptCfg.label} (${deptCfg.badge})`;
    }
    const displayUser = user.username || user.fullName || user.email || 'Yetkili personel';
    const email = user.email || displayUser;
    const emailEl = document.getElementById('central-user-email');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarEmail = document.getElementById('sidebar-user-email');
    if (emailEl) emailEl.textContent = `${displayUser} • ${deptCfg.badge}`;
    if (sidebarName) sidebarName.textContent = displayUser;
    if (sidebarEmail) sidebarEmail.textContent = deptCfg.label;

    document.querySelectorAll('.nav-item[data-route]').forEach(item => {
        const routeName = item.dataset.route;
        const allowed = canAccessRoute(routeName);
        item.hidden = !allowed;
        item.style.display = allowed ? '' : 'none';
    });

    // Viewer departmanı için üst bilgi şeridi göster
    let roBanner = document.getElementById('erp-viewer-top-banner');
    if (isViewerReadOnly(user)) {
        if (!roBanner) {
            roBanner = document.createElement('div');
            roBanner.id = 'erp-viewer-top-banner';
            roBanner.style.cssText = 'background:rgba(245,158,11,0.14);border-bottom:1px solid rgba(245,158,11,0.38);color:#fde68a;padding:8px 20px;font-size:12px;font-weight:700;text-align:center;letter-spacing:0.3px;';
            roBanner.innerHTML = '👁️ <strong>SALT OKUNUR YETKİ (VIEWER):</strong> Tüm modülleri ve raporları inceleyebilirsiniz; oluşturma, düzenleme ve silme işlemleri devre dışıdır.';
            const topbar = document.querySelector('.topbar');
            if (topbar && topbar.parentNode) {
                topbar.parentNode.insertBefore(roBanner, topbar.nextSibling);
            }
        }
    } else if (roBanner) {
        roBanner.remove();
    }

    const logout = document.getElementById('central-logout-btn');
    if (logout && !logout.dataset.bound) {
        logout.dataset.bound = '1';
        logout.addEventListener('click', async () => {
            logout.disabled = true;
            try { await signOutCentral(); } catch (error) { showToast(error.message || 'Çıkış yapılamadı.'); logout.disabled = false; }
        });
    }
}

// Navigation Controller
export function navigateTo(route) {
    if (!state.user || document.getElementById('gm-central-auth')) {
        return;
    }
    if (!route || route === 'dashboard' || route.startsWith('/')) {
        route = getDefaultRoute();
    }
    if (!canAccessRoute(route)) {
        const deptCfg = getDepartmentConfig(state.department);
        showToast(`⛔ Departman Yetki Sınırı: "${deptCfg.label}" bu modüle erişemez.`);
        route = getDefaultRoute();
    }
    state.currentRoute = route;
    if (window.location.hash !== `#${route}`) {
        window.history.replaceState(null, '', `#${route}`);
    }

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
    enforceReadOnlyDomLockIfNeeded(document);
    propagateAuthAndReadOnlyToIframes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
if (typeof window !== 'undefined') window.navigateTo = navigateTo;

// Render View Router
function renderCurrentView() {
    if (!contentContainer) return;

    const isEmbeddedModule = state.currentRoute === 'website' || state.currentRoute === 'social' || state.currentRoute === 'products' || state.currentRoute === 'production' || state.currentRoute === 'studio';
    contentContainer.classList.toggle('full-bleed-module', isEmbeddedModule);
    document.body.classList.toggle('module-immersive-view', isEmbeddedModule);

    switch (state.currentRoute) {
        case 'website':
            contentContainer.innerHTML = renderWebsiteModule(mockData);
            break;
        case 'social':
            contentContainer.innerHTML = renderSocialModule(mockData);
            break;
        case 'products':
            contentContainer.innerHTML = renderProductsModule(mockData);
            break;
        case 'studio':
            contentContainer.innerHTML = renderStudioModule(mockData);
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
            contentContainer.innerHTML = renderProductsModule(mockData);
    }
}

// Global Role Switcher
export function setRole(roleId) {
    showToast('Rol değişikliği kullanıcı hesabının yetkileri üzerinden yönetilir.');
    return;
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

// Detail View Helpers (Canlı Supabase / API Sorguları)
export async function showProductDetail(productId) {
    try {
        const res = await fetch('/api/b2c-public?scope=catalog', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        const products = Array.isArray(json?.products) ? json.products : [];
        const collections = Array.isArray(json?.collections) ? json.collections : [];
        const target = String(productId || '').trim().toLowerCase();
        const product = products.find(p =>
            String(p.id || '').toLowerCase() === target ||
            String(p.slug || '').toLowerCase() === target ||
            String(p.sku || '').toLowerCase() === target
        ) || collections.find(c =>
            String(c.id || '').toLowerCase() === target ||
            String(c.slug || '').toLowerCase() === target
        );

        if (!product) {
            showToast('Aranan ürün veya koleksiyon canlı katalogda bulunamadı.');
            return;
        }

        const title = product.title || product.name || product.slug;
        const category = product.kategori || product.category || 'Mobilya Koleksiyonu';
        const imgUrl = product.ana_resim || product.hero_image || '';
        const dims = product.body || product.short_description || '-';
        const colors = Array.isArray(product.renkler) ? product.renkler.join(', ') : (product.renkler || '-');

        const html = `
            <div class="detail-drawer-content">
                <div class="detail-header-row">
                    <span class="badge badge-accent">${category}</span>
                    <code>${product.sku ? `SKU: ${product.sku}` : `SLUG: ${product.slug}`}</code>
                </div>
                <h2 style="margin: 10px 0;">${title}</h2>
                ${imgUrl ? `<img src="${imgUrl}" alt="${title}" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin:10px 0;">` : ''}
                <div class="info-metric-list" style="margin-top: 12px;">
                    <div class="info-metric-item">
                        <span>Ölçü / Açıklama:</span>
                        <strong>${dims}</strong>
                    </div>
                    <div class="info-metric-item">
                        <span>Renk Seçenekleri:</span>
                        <strong>${colors}</strong>
                    </div>
                    <div class="info-metric-item">
                        <span>Yayın Durumu:</span>
                        <strong class="text-success">${product.web_gorunur === false ? 'Taslak' : 'Yayında'}</strong>
                    </div>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="window.closeModal()">Kapat</button>
                    <button class="btn btn-primary" onclick="window.closeModal(); window.navigateTo('products');">Modül 7'de Aç</button>
                </div>
            </div>
        `;
        showModal('Canlı Katalog Detayı', html);
    } catch (err) {
        showToast('Ürün detayı yüklenemedi: ' + err.message);
    }
}

export async function showLeadDetail(leadId) {
    try {
        const res = await fetch('/api/crm-customers', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        const customers = Array.isArray(json?.customers) ? json.customers : [];
        const quotes = Array.isArray(json?.quotes) ? json.quotes : [];
        const target = String(leadId || '').trim().toLowerCase();
        const lead = customers.find(c =>
            String(c.id || '').toLowerCase() === target ||
            String(c.email || '').toLowerCase() === target
        );

        if (!lead) {
            showToast('CRM kaydı bulunamadı.');
            return;
        }

        const relQuotes = quotes.filter(q =>
            (q.customer_id && q.customer_id === lead.id) ||
            (q.email && lead.email && q.email === lead.email)
        );

        const html = `
            <div class="detail-drawer-content">
                <div class="detail-header-row">
                    <span class="badge badge-primary">${lead.source || 'B2C Vitrin'}</span>
                    <code>${lead.id || '-'}</code>
                </div>
                <h2 style="margin: 10px 0;">${lead.full_name || lead.email || 'Müşteri'}</h2>
                <p style="color: var(--text-muted);">${lead.email || '-'} ${lead.phone ? `• ${lead.phone}` : ''}</p>
                <div class="info-metric-list" style="margin-top: 16px;">
                    <div class="info-metric-item">
                        <span>Huni Aşaması:</span>
                        <span class="badge badge-accent">${lead.stage || 'Yeni Teklif Talebi'}</span>
                    </div>
                    <div class="info-metric-item">
                        <span>Teklif Talepleri:</span>
                        <strong>${relQuotes.length} Adet</strong>
                    </div>
                    <div class="info-metric-item">
                        <span>Kayıt Tarihi:</span>
                        <strong>${lead.created_at ? new Date(lead.created_at).toLocaleString('tr-TR') : '-'}</strong>
                    </div>
                </div>
                <div style="margin-top: 24px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="window.closeModal()">Kapat</button>
                    <button class="btn btn-primary" onclick="window.closeModal(); window.navigateTo('crm');">Modül 3 CRM'e Git</button>
                </div>
            </div>
        `;
        showModal('Canlı CRM Müşteri Detayı', html);
    } catch (err) {
        showToast('CRM detayı yüklenemedi: ' + err.message);
    }
}

export function showWorkOrderDetail(orderId) {
    const html = `
        <div class="detail-drawer-content">
            <div class="detail-header-row">
                <span class="badge badge-accent">Üretim / MRP</span>
                <code>${orderId || '-'}</code>
            </div>
            <h2 style="margin: 10px 0;">Üretim İş Emri Takibi</h2>
            <p style="color: var(--text-muted);">
                İş emirleri doğrudan Modül 4 (Üretim & Fabrika Planlama) üzerinden yönetilmektedir.
            </p>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="window.closeModal()">Kapat</button>
                <button class="btn btn-primary" onclick="window.closeModal(); window.navigateTo('production');">Modül 4'ü Aç</button>
            </div>
        </div>
    `;
    showModal('İmalat İş Emri Kartı', html);
}

async function runGlobalSearch(rawQuery) {
    const q = String(rawQuery || '').trim();
    if (!q) return;
    const ql = q.toLowerCase();

    showModal('Platform Genel Arama', `<div style="padding:20px;text-align:center;color:var(--text-muted);">"${q}" için canlı Supabase kataloğu ve CRM taranıyor…</div>`);

    try {
        const [catRes, crmRes] = await Promise.all([
            fetch('/api/b2c-public?scope=catalog', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
            fetch('/api/crm-customers', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
        ]);

        const products = (Array.isArray(catRes?.products) ? catRes.products : []).filter(p =>
            JSON.stringify(p).toLowerCase().includes(ql)
        ).slice(0, 8);
        const collections = (Array.isArray(catRes?.collections) ? catRes.collections : []).filter(c =>
            JSON.stringify(c).toLowerCase().includes(ql)
        ).slice(0, 6);
        const customers = (Array.isArray(crmRes?.customers) ? crmRes.customers : []).filter(c =>
            JSON.stringify(c).toLowerCase().includes(ql)
        ).slice(0, 6);

        const total = products.length + collections.length + customers.length;
        if (total === 0) {
            showModal('Platform Genel Arama', `<div style="padding:20px;text-align:center;color:var(--text-muted);">"${q}" için canlı veritabanında eşleşen kayıt bulunamadı.</div>`);
            return;
        }

        const section = (title, itemsHtml) => itemsHtml ? `<div style="margin-bottom:16px;"><h4 style="margin-bottom:8px;color:var(--accent);">${title}</h4>${itemsHtml}</div>` : '';
        const html = `
            <div class="detail-drawer-content">
                <p style="margin-bottom:14px;color:var(--text-muted);">"${q}" için <strong>${total}</strong> canlı sonuç bulundu:</p>
                ${section('Koleksiyonlar', collections.map(c => `<div class="info-metric-item" style="cursor:pointer;" onclick="window.showProductDetail('${c.slug}')"><strong>${c.title || c.slug}</strong><span class="badge badge-accent">${c.category || 'Koleksiyon'}</span></div>`).join(''))}
                ${section('Ürünler', products.map(p => `<div class="info-metric-item" style="cursor:pointer;" onclick="window.showProductDetail('${p.slug || p.sku}')"><strong>${p.title || p.slug}</strong><code>${p.sku || p.slug}</code></div>`).join(''))}
                ${section('CRM Müşterileri', customers.map(c => `<div class="info-metric-item" style="cursor:pointer;" onclick="window.showLeadDetail('${c.id || c.email}')"><strong>${c.full_name || c.email}</strong><span class="badge badge-primary">${c.stage || 'CRM'}</span></div>`).join(''))}
                <div style="margin-top:16px;display:flex;justify-content:flex-end;">
                    <button class="btn btn-secondary" onclick="window.closeModal()">Kapat</button>
                </div>
            </div>
        `;
        showModal(`Arama Sonuçları: "${q}"`, html);
    } catch (err) {
        showToast('Arama sırasında hata oluştu: ' + err.message);
    }
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
    if (!frame) return;

    if (btnEl) {
        btnEl.parentElement?.querySelectorAll('.embed-tab-chip').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
    }

    const channelMap = {
        instagram: { path: 'Module%202/Instagram/index.html', label: '📸 Instagram Bot Kontrol Merkezi aktif.' },
        facebook: { path: 'Module%202/Facebook/index.html', label: '📘 Facebook Bot Kontrol Merkezi aktif.' },
        youtube: { path: 'Module%202/Youtube%20Shorts/index.html', label: '▶️ YouTube Shorts Bot Kontrol Merkezi aktif.' },
        tiktok: { path: 'Module%202/Tiktok/index.html', label: '🎵 TikTok Bot Kontrol Merkezi aktif.' }
    };

    const target = channelMap[channel];
    if (target) {
        frame.src = target.path;
        if (typeof showToast === 'function') {
            showToast(target.label);
        }
    }
}

// Initialize Application
async function initApp() {
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

    // Global quick search handler (Canlı Supabase Kataloğu + CRM)
    const globalSearchInput = document.getElementById('global-search-input');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = e.target.value.trim();
                if (q) {
                    runGlobalSearch(q);
                }
            }
        });
    }

    // Hash change handler for browser navigation (Clerk giriş ekranı açıkken veya #/... rotalarında müdahale etme)
    window.addEventListener('hashchange', () => {
        if (!state.user || document.getElementById('gm-central-auth')) return;
        const r = window.location.hash.replace('#', '');
        if (!r || r.startsWith('/')) return;
        if (r !== state.currentRoute) navigateTo(r);
    });

    // Central authentication: Clerk Production Organization protects the platform shell and its modules.
    try {
        const user = await initializeCentralAuth();
        applyAuthenticatedUser(user);
        const hashRoute = window.location.hash ? window.location.hash.replace('#', '') : '';
        const initialRoute = (!hashRoute || hashRoute === 'dashboard' || hashRoute.startsWith('/')) ? getDefaultRoute() : hashRoute;
        navigateTo(initialRoute);
    } catch (error) {
        console.error('Central authentication initialization failed:', error);
        showToast('Kimlik doğrulama başlatılamadı. Sayfayı yenileyin.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

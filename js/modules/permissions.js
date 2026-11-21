// ============================================================================
// GLOBAL KAPAK MOBİLYA — CLERK DEPARTMAN BAZLI YETKİ MATRİSİ (publicMetadata.department)
// ============================================================================

export function renderPermissionsModule(data, currentRole) {
  const departments = [
    {
      id: 'admin',
      name: 'Sistem & Kurum Yöneticisi',
      badge: 'org:admin / admin',
      desc: 'Tüm ERP modüllerine, altyapı ayarlarına, katalog yönetimine ve sosyal medya botlarına tam okuma/yazma erişimi.',
      modules: 'Tüm 8 Modül + Yetki Yönetimi (Tam Yetki)'
    },
    {
      id: 'factory',
      name: 'Fabrika & Üretim Planlama',
      badge: 'mrp_manager / factory',
      desc: 'Sadece MRP üretim iş emirleri, stok/katalog yönetimi ve 3D teknik çizim stüdyosu modüllerine erişim.',
      modules: 'Modül 4 (MRP), Modül 7 (Stok/Katalog), Modül 8 (Teknik Çizim)'
    },
    {
      id: 'sales',
      name: 'CRM, Satış & Teklif',
      badge: 'crm_sales / sales',
      desc: 'Sadece CRM müşterileri (Vitrin B2C Lazy Registration kayıtları dahil), teklifler ve sipariş/katalog modüllerine erişim.',
      modules: 'Modül 3 (CRM & Teklifler), Modül 7 (Ürün & Sipariş)'
    },
    {
      id: 'social_media',
      name: 'Sosyal Medya & İçerik',
      badge: 'social_operator / social_media',
      desc: 'Sadece 4 sosyal medya botu, kurumsal web sitesi içerik akışı ve medya/sunum kütüphanesi modüllerine erişim.',
      modules: 'Modül 1 (Web İçerik), Modül 2 (4 Bot), Modül 8 (Medya & Sunum)'
    },
    {
      id: 'viewer',
      name: 'Salt Okunur Denetçi',
      badge: 'viewer (Read-Only)',
      desc: 'Tüm panellere ve raporlara salt okunur (Read-Only) erişim; hiçbir oluşturma, düzenleme veya silme işlemi yapamaz.',
      modules: 'Tüm 8 Modül (Sadece Görüntüleme — GET)'
    }
  ];

  const modules = [
    { id: 'website', name: '1. Web Sitesi Yönetimi', admin: 'Tam Yetki', factory: 'Erişim Yok', sales: 'Erişim Yok', social: 'Yazma & Yönetim', viewer: 'Salt Okunur' },
    { id: 'social', name: '2. Sosyal Medya Botları (4 Bot)', admin: 'Tam Yetki', factory: 'Erişim Yok', sales: 'Erişim Yok', social: 'Yazma & Yönetim', viewer: 'Salt Okunur' },
    { id: 'crm', name: '3. CRM, Müşteriler & Teklifler', admin: 'Tam Yetki', factory: 'Erişim Yok', sales: 'Yazma & Yönetim', viewer: 'Salt Okunur', social: 'Erişim Yok' },
    { id: 'production', name: '4. MRP, Üretim Emirleri & Fabrika', admin: 'Tam Yetki', factory: 'Yazma & Yönetim', sales: 'Erişim Yok', social: 'Erişim Yok', viewer: 'Salt Okunur' },
    { id: 'operations', name: '5. Altyapı & Sistem Sağlığı', admin: 'Tam Yetki', factory: 'Erişim Yok', sales: 'Erişim Yok', social: 'Erişim Yok', viewer: 'Salt Okunur' },
    { id: 'analytics', name: '6. Gelir/Gider & İstatistik', admin: 'Tam Yetki', factory: 'Erişim Yok', sales: 'Erişim Yok', social: 'Erişim Yok', viewer: 'Salt Okunur' },
    { id: 'products', name: '7. Ürün, Stok & Katalog Yönetimi', admin: 'Tam Yetki', factory: 'Stok & Teknik', sales: 'Teklif & Sipariş', social: 'Erişim Yok', viewer: 'Salt Okunur' },
    { id: 'studio', name: '8. 3D Teknik Çizim & Sunum Stüdyosu', admin: 'Tam Yetki', factory: '3D & Teknik Çizim', sales: 'Erişim Yok', social: 'Medya & Sunum', viewer: 'Salt Okunur' }
  ];

  const badgeHtml = val => {
    if (val === 'Tam Yetki' || val === 'Yazma & Yönetim' || val === 'Stok & Teknik' || val === 'Teklif & Sipariş' || val === '3D & Teknik Çizim' || val === 'Medya & Sunum') {
      return `<span class="badge badge-success">${val}</span>`;
    }
    if (val === 'Salt Okunur') {
      return `<span class="badge badge-primary">👁️ ${val}</span>`;
    }
    return `<span class="badge badge-secondary">🔒 ${val}</span>`;
  };

  return `
    <div class="page-header">
      <div class="page-title-group">
        <div class="breadcrumbs">
          <span>Platform Yönetimi: Clerk Organizations &amp; Departman RBAC</span>
        </div>
        <h1>Clerk Kurumsal Departman &amp; Yetki Matrisi</h1>
        <p class="subtitle">
          Global Kapak Mobilya Clerk Organization (<code>org_3MQEn3zykDenqO7WuKDpWfKDInY</code>) üyeliği ve
          <code>publicMetadata.department</code> (<code>sessionClaims.metadata.department</code>) bazlı canlı yetkilendirme mimarisi.
        </p>
      </div>
    </div>

    <div class="alert-banner info">
      <div class="alert-icon">🔐</div>
      <div class="alert-content">
        <strong>Canlı Clerk Production &amp; Svix Webhook Koruma Kuralı:</strong>
        <p>
          Global Kapak Mobilya Clerk Organizasyonuna (<code>orgId</code>) üye olmayan bireysel vitrin müşterileri ERP paneline alınmaz.
          Personel yetkileri Clerk <code>publicMetadata.department</code> alanı üzerinden hem sol menüde, hem doğrudan modül URL'lerinde hem de API uçlarında zorunlu tutulur.
        </p>
      </div>
    </div>

    <div class="section-title-row">
      <h3>Tanımlı Clerk Departmanları (5 Departman)</h3>
      <span class="tag">Webhook: <code>/api/webhooks/clerk</code> (Svix Aktif)</span>
    </div>

    <div class="channel-grid">
      ${departments.map(d => `
        <div class="card channel-card">
          <div class="channel-header">
            <h4>${d.name}</h4>
            <span class="badge badge-primary">${d.badge}</span>
          </div>
          <p style="font-size: 13px; color: var(--text-muted); margin: 8px 0 12px 0;">${d.desc}</p>
          <div style="font-size: 12px;">
            <span>Yetkili Alanlar:</span>
            <strong style="display:block; margin-top:4px; color:#f8fafc;">${d.modules}</strong>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card panel" style="margin-top: 24px;">
      <div class="panel-header">
        <div class="panel-title-wrap">
          <h3>Departman x Modül &amp; API Erişim Matrisi</h3>
          <span class="tag">publicMetadata.department</span>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Modül / İşlev Alanı</th>
              <th>admin (org:admin)</th>
              <th>factory (mrp_manager)</th>
              <th>sales (crm_sales)</th>
              <th>social_media (social_operator)</th>
              <th>viewer (Read-Only)</th>
            </tr>
          </thead>
          <tbody>
            ${modules.map(m => `
              <tr>
                <td><strong>${m.name}</strong></td>
                <td>${badgeHtml(m.admin)}</td>
                <td>${badgeHtml(m.factory)}</td>
                <td>${badgeHtml(m.sales)}</td>
                <td>${badgeHtml(m.social)}</td>
                <td>${badgeHtml(m.viewer)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

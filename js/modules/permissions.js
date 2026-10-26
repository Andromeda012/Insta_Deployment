// Shared Platform Feature: User Roles and Permission Management
export function renderPermissionsModule(data, currentRole) {
    const modules = [
        { id: "website", name: "1. Web Sitesi Yönetimi" },
        { id: "social", name: "2. Sosyal Medya & Bot" },
        { id: "crm", name: "3. CRM & Satış" },
        { id: "production", name: "4. Üretim & Fabrika" },
        { id: "operations", name: "5. Altyapı & Operasyon" },
        { id: "analytics", name: "6. Performans Analitiği" }
    ];

    return `
        <div class="page-header">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span onclick="window.navigateTo('dashboard')">Ana Sayfa</span> / 
                    <span>Platform Yönetimi: Kullanıcı Rolleri & Yetkilendirme</span>
                </div>
                <h1>Kullanıcı Rolleri & Erişim Matrisi (RBAC)</h1>
                <p class="subtitle">Platform düzeyinde rol bazlı yetkilendirme modeli. Modül erişimleri, yetki sınırları ve prototip rol simülatörü.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-secondary" onclick="window.showToast('Yetki Matrisi Şablonu Kaydedildi (Prototip)')">
                    💾 Matrisi Kaydet
                </button>
            </div>
        </div>

        <!-- Prototype Disclaimer Banner -->
        <div class="alert-banner info">
            <div class="alert-icon">ℹ️</div>
            <div class="alert-content">
                <strong>Prototip Bilgilendirmesi:</strong>
                <p>Bu ekran, kurumsal rol bazlı erişim denetiminin (RBAC) frontend modellemesidir. Gerçek bir veritabanı veya kimlik doğrulama servisi henüz bağlanmamıştır. Rol değiştirici yalnızca arayüz önizlemesi amacıyla çalışmaktadır.</p>
            </div>
        </div>

        <!-- Role Cards Grid -->
        <div class="section-title-row">
            <h3>Tanımlı Kurumsal Roller (5 Rol)</h3>
            <span class="tag">Aktif Rolünüz: <strong>${currentRole.name}</strong></span>
        </div>

        <div class="channel-grid">
            ${data.roles.map(r => `
                <div class="card channel-card ${r.id === currentRole.id ? 'active-role-card' : ''}">
                    <div class="channel-header">
                        <h4>${r.name}</h4>
                        <span class="badge ${r.id === currentRole.id ? 'badge-primary' : 'badge-secondary'}">${r.badge}</span>
                    </div>
                    <p style="font-size: 13px; color: var(--text-muted); margin: 8px 0 12px 0;">${r.description}</p>
                    <div style="font-size: 12px; margin-bottom: 14px;">
                        <span>Erişebildiği Modüller:</span>
                        <strong>${r.modules.includes('all') ? 'Tüm 6 Modül' : r.modules.length + ' Modül'}</strong>
                    </div>
                    <button class="btn ${r.id === currentRole.id ? 'btn-secondary' : 'btn-primary'}" style="width: 100%; justify-content: center;" onclick="window.setRole('${r.id}')">
                        ${r.id === currentRole.id ? '✓ Bu Role Geçildi' : 'Bu Role Geç (Simüle Et)'}
                    </button>
                </div>
            `).join('')}
        </div>

        <!-- Permission Matrix Table -->
        <div class="card panel" style="margin-top: 24px;">
            <div class="panel-header">
                <div class="panel-title-wrap">
                    <h3>Modül ve İşlem Yetki Matrisi</h3>
                    <span class="tag">Rol x Modül İzinleri</span>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Modül / İşlev Alanı</th>
                            <th>Sistem Yöneticisi</th>
                            <th>Şirket Yönetimi</th>
                            <th>Satış & Pazarlama</th>
                            <th>Üretim Sorumlusu</th>
                            <th>Altyapı Operatörü</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${modules.map(m => `
                            <tr>
                                <td><strong>${m.name}</strong></td>
                                <td><span class="badge badge-success">Tam Yetki</span></td>
                                <td>
                                    ${['website', 'crm', 'production', 'analytics'].includes(m.id) 
                                        ? '<span class="badge badge-primary">Görüntüleme</span>' 
                                        : '<span class="badge badge-secondary">Kısıtlı</span>'}
                                </td>
                                <td>
                                    ${['website', 'social', 'crm'].includes(m.id) 
                                        ? '<span class="badge badge-success">Yazma & Yönetim</span>' 
                                        : m.id === 'analytics' ? '<span class="badge badge-primary">Raporlar</span>' : '<span class="badge badge-secondary">Erişim Yok</span>'}
                                </td>
                                <td>
                                    ${m.id === 'production' 
                                        ? '<span class="badge badge-success">İmalat & CNC Tam</span>' 
                                        : m.id === 'analytics' ? '<span class="badge badge-primary">Üretim Raporu</span>' : '<span class="badge badge-secondary">Erişim Yok</span>'}
                                </td>
                                <td>
                                    ${m.id === 'operations' 
                                        ? '<span class="badge badge-success">DevOps & Cloud Tam</span>' 
                                        : m.id === 'analytics' ? '<span class="badge badge-primary">Sistem Sağlığı</span>' : '<span class="badge badge-secondary">Erişim Yok</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Restricted State Example Simulation -->
        <div class="card panel" style="margin-top: 24px;">
            <div class="panel-header">
                <h3>Yetkisiz Erişim / Kısıtlı Arayüz Örneği (UI Preview)</h3>
                <span class="badge badge-warning">Örnek Durum</span>
            </div>
            <p style="font-size: 13.5px; color: var(--text-muted); margin-bottom: 16px;">
                Bir kullanıcı kendi yetki alanında olmayan bir sayfaya doğrudan erişmeye çalıştığında görüntülenecek kurumsal kısıtlama arayüzü:
            </p>
            <div class="restricted-box">
                <div class="restricted-icon">🔒</div>
                <h3>Erişim Yetkisi Bulunmuyor (403 Yetkisiz İşlem)</h3>
                <p>Mevcut rolünüz (<strong>${currentRole.name}</strong>), bu modül için tanımlı yönetici izinlerine sahip değildir. Erişim talebinde bulunmak için şirket IT yöneticinizle iletişime geçebilirsiniz.</p>
                <div style="margin-top: 16px;">
                    <button class="btn btn-secondary" onclick="window.navigateTo('dashboard')">Merkezi Panele Dön</button>
                    <button class="btn btn-primary" onclick="window.setRole('admin')">Yönetici Rolüne Geç (Admin)</button>
                </div>
            </div>
        </div>
    `;
}

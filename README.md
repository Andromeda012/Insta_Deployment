# 🛋️ Global Mobilya — Modüler Operasyon Yönetim Platformu (Frontend Prototip v0.1)

Mobilya üretimi ve kurumsal operasyonlar gerçekleştiren **Global Mobilya A.Ş.** için geliştirilmiş profesyonel, modern ve duyarlı (responsive) modüler operasyon yönetim platformu ön yüz prototipi.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAndromeda012%2FInsta_Deployment)

---

## 📌 Proje Amacı ve Kapsamı

Bu proje, Global Mobilya'nın üretim, satış, pazarlama ve teknik altyapı operasyonlarını tek bir çatı altında birleştiren kurumsal yazılımın **frontend prototipidir (v0.1)**. 

Gerçek iş mantığı ve veritabanı bağlanmadan önce; görsel tasarım standartları, bilgi mimarisi, modül sınırları, kullanıcı deneyimi ve rol bazlı erişim modeli (RBAC) bu prototip ile somutlaştırılmıştır.

---

## 🏛️ Temel 6 İşletme Modülü

Platform tam olarak 6 ana iş modülünden oluşmaktadır:

1. **🌐 Modül 1 — Web Sitesi Yönetim Paneli:**
   - Kurumsal web sitesi yayın durumu, sayfa ağacı ve navigasyon yönetimi.
   - Mobilya ürün kataloğu (Masif meşe masalar, bukle koltuklar, TV üniteleri, stok ve SKU takibi).
   - Ürün kategorileri, blog & makale içerikleri, SEO sağlık skoru ve gelen web iletişim formları.

2. **🤖 Modül 2 — Sosyal Medya Bot Kontrol Paneli:**
   - Çok kanallı hesap izleme (Instagram `@globalmobilya_tr`, Facebook, TikTok, YouTube).
   - Bot durum göstergeleri (Otomatik DM, katalog senkronizasyonu, webhook gecikme süreleri).
   - Zamanlanmış içerik takvimi ve yayın kuyruğu.
   - Gelen yorumlar, otomatik bot yanıtları ve servis log terminali.

3. **👥 Modül 3 — CRM & Satış Hunisi:**
   - B2B ve perakende müşteri fırsatları (Otel projeleri, holding ofisleri, rezidans işleri).
   - 5 Aşamalı Satış Hunisi (Yeni Talep → İletişim Kuruldu → Keşif & Projelendirme → Teklif Sunuldu → Sözleşme & Üretimde).
   - Çok kanallı talep kaynakları (Web Formu, Instagram DM, Showroom, Telefon).
   - Temsilci atamaları, teklif tutarları ve müşteri detay pencereleri.

4. **🏭 Modül 4 — Üretim & Fabrika Kontrol Paneli:**
   - İmalat iş emirleri ve atölye aşama takibi (Kesim → CNC → Zımpara/Cila → Döşeme → Montaj → Kalite).
   - CNC İşleme Merkezleri canlı kapasite telemetrisi (Homag 5-Eksen, Biesse Ebatlama, Brandt Bantlama).
   - Atölye ekipleri, termin tarihleri ve üretim darboğazı/gecikme uyarıları.

5. **🛡️ Modül 5 — Altyapı & Operasyon Paneli:**
   - Vercel Edge, AWS S3 Asset Bucket, Cloudflare DNS ve PostgreSQL servis sağlığı.
   - Alan adları ve SSL sertifikaları takibi (`globalmobilya.com.tr`).
   - Maskelenmiş API entegrasyon anahtarları (Instagram Graph API, Nebim ERP, IYS, S3).
   - Aylık tahmini operasyon maliyetleri dökümü ve sistem denetim kayıtları (Audit Log).

6. **📈 Modül 6 — Performans Analitiği Paneli:**
   - Konsolide yönetici KPI göstergeleri ve tarih aralığı filtreleme (Son 7 Gün, Son 30 Gün, Q4, Yıllık).
   - İnteraktif aylık ciro ve bütçe hedefi trend grafikleri (Tooltipli görsel barlar).
   - Kanal bazlı gelir dağılımı (Mimari B2B %48, Web %26, Sosyal Medya %16, Showroom %10).
   - Departman bazlı verimlilik karşılaştırması ve boş durum (empty state) simülasyonu.

---

## 🔐 Paylaşılan Platform Özelliği: Kullanıcı Rolleri & Yetki Matrisi (RBAC)

Modüllerden bağımsız paylaşılan bir platform özelliği olarak 5 kurumsal rolün yetki modeli tanımlanmıştır:
- **Sistem Yöneticisi (Admin):** Tüm modüllere tam erişim ve yönetim.
- **Şirket Yönetimi (Yönetici):** Konsolide ciro, finans ve performans analitiği.
- **Satış & Pazarlama:** CRM, web sitesi içerikleri ve sosyal medya bot takibi.
- **Üretim Sorumlusu:** Fabrika iş emirleri, CNC tezgahları ve atölye süreçleri.
- **Altyapı Operatörü (DevOps):** Bulut servisleri, alan adları, API anahtarları ve sistem logları.

> *Not: Üst bardaki rol değiştirici prototip simülasyonu olup, roller arası geçişin arayüzdeki etkilerini canlı olarak test etmeye olanak sağlar.*

---

## 🛠️ Teknik Mimari ve Dosya Yapısı

Sıfır bağımlılık (zero-dependency), ultra hızlı açılış ve tam Vercel Edge uyumluluğu için **Modern Modüler Vanilla ES6+ & CSS Tasarım Sistemi** kullanılmıştır:

```
Insta_Deployment/
├── index.html               # Uygulama ana kabuğu (Sidebar, Topbar, Modal/Toast konteynerleri)
├── style.css                # Global Mobilya kurumsal tasarım sistemi (Dark architectural UI)
├── app.js                   # Ana koordinatör, SPA router, arama, filtreleme ve modal yöneticisi
├── js/
│   ├── data.js              # 6 modüle ve rollere ait gerçekçi mock veri deposu
│   └── modules/
│       ├── dashboard.js     # Merkezi genel bakış paneli
│       ├── website.js       # Modül 1: Web sitesi kontrolü
│       ├── social.js        # Modül 2: Sosyal medya & bot paneli
│       ├── crm.js           # Modül 3: CRM & satış hunisi
│       ├── production.js    # Modül 4: Üretim & CNC takip paneli
│       ├── operations.js    # Modül 5: Altyapı & bulut servisleri
│       ├── analytics.js     # Modül 6: Konsolide performans analitiği
│       └── permissions.js   # Platform Rolleri & Erişim Matrisi (RBAC)
├── vercel.json              # "framework": null statik Vercel yapılandırması
├── .gitignore               # Gereksiz dosyaların filtrelenmesi
└── README.md                # Dokümantasyon
```

---

## 🌐 Vercel Dağıtımı (Deployment)

Proje doğrudan Vercel üzerinde tek tıkla çalışacak şekilde yapılandırılmıştır (`"framework": null`).

1. Vercel Dashboard üzerinde **Settings** ➜ **General** bölümünde:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./` (veya boş)
2. `main` dalına push yapıldığında Vercel Edge Static motoru saniyeler içinde canlıya alacaktır.

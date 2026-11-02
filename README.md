# Global Mobilya — Modüler Operasyon Platformu

Global Mobilya'nın web sitesi, ürün kataloğu, müşteri ilişkileri, üretim, sosyal medya ve kurumsal operasyon süreçlerini tek bir platformda birleştirmek üzere geliştirilen modüler uygulama.

> **Mimari hedef:** Modüllerin kendi sorumluluk alanlarını koruduğu, ortak servisler üzerinden haberleştiği ve zaman içinde katalogdan üretime, içerik üretiminden dağıtıma kadar otonom iş akışlarını destekleyebilen tek bir operasyon platformu.

## Modül haritası

| Modül | Kapsam | Ana kod alanı |
|---|---|---|
| **1 — Web Sitesi & CMS** | Kurumsal site, sayfa/içerik yönetimi ve web kataloğu | `Module 1/`, `api/module1-content.js` |
| **2 — Sosyal Medya** | Instagram, Facebook, TikTok, YouTube botları ve yayın akışları | `Module 2/`, `api/module2.js`, webhook/cron uçları |
| **3 — CRM** | Müşteri ilişkileri ve satış süreçleri | `Module 3/`, `js/modules/crm.js` |
| **4 — Üretim** | Üretim ve sipariş takip arayüzleri | `Module 4/`, `js/modules/production.js` |
| **5 — Operasyon & Altyapı** | Servisler, sunucu ve operasyon görünümü | `Module 5/`, `js/modules/operations.js` |
| **6 — Performans Analitiği** | Yönetim KPI'ları ve performans görünümü | `js/modules/analytics.js` |
| **7 — Ürün Yönetimi & AI Studio** | Ürün kataloğu ve ürün bazlı AI profilleri | `Module 7/`, `api/module7.js` |

Paylaşılan yetenekler: ana uygulama kabuğu, kimlik doğrulama, rol/yetki arayüzü ve ortak API yardımcıları.

## Teknik mimari

- **Frontend:** Vanilla JavaScript, HTML ve CSS.
- **Hosting / dağıtım:** Vercel. Proje kök dizininden statik arayüz ve `api/` altındaki serverless fonksiyonlar dağıtılır.
- **Veri katmanı:** Supabase.
- **Zamanlanmış işler:** Vercel Cron ve GitHub Actions iş akışları.
- **VPS geçiş hazırlığı:** `vps_migration_staging/` altında ayrı bir hazırlık alanı bulunur; bu alan canlı VPS altyapısı olarak değerlendirilmemelidir.

### Depo yapısı

```text
/
├── index.html, app.js, style.css       # Ana uygulama kabuğu
├── js/
│   ├── auth.js, data.js                # Paylaşılan istemci katmanı
│   └── modules/                        # Modül arayüz yükleyicileri
├── Module 1/ ... Module 7/             # Modüllerin kendi arayüz ve varlıkları
├── api/
│   ├── _lib/                           # Ortak sunucu yardımcıları
│   ├── module1-content.js
│   ├── module2.js
│   ├── module7.js
│   └── *-cron.js / *-webhook.js        # Entegrasyon uçları
├── supabase/
│   └── migrations/                     # Sıralı veritabanı değişiklikleri
├── docs/                               # Mimari, API ve işletim belgeleri
├── scripts/repo-check.mjs              # Statik depo kalite kontrolü
├── vps_migration_staging/              # VPS geçiş hazırlıkları
├── vercel.json                         # Vercel yönlendirme, cron ve fonksiyon ayarları
└── package.json
```

Daha ayrıntılı mevcut mimari için [docs/architecture.md](docs/architecture.md), temizlik ve bağımlılık envanteri için [docs/cleanup-inventory.md](docs/cleanup-inventory.md), API güvenliği için [docs/api-security-audit.md](docs/api-security-audit.md), veri erişim matrisi için [docs/database-access-matrix.md](docs/database-access-matrix.md) ve test/yayın standardı için [docs/testing-and-release.md](docs/testing-and-release.md) dosyalarına bakın.

## Mimari ilkeler

1. Her modül kendi UI, istemci mantığı ve API sözleşmesinin sahibi olur.
2. Kimlik doğrulama, yetki, loglama ve veri erişimi gibi ortak kabiliyetler tekrar yazılmaz; ortak katmanda tutulur.
3. Modüller birbirlerinin iç dosyalarını doğrudan kullanmak yerine açık API sözleşmeleri üzerinden entegre edilir.
4. Otonom iş akışları adım adım kurulurken insan onayı, yetki sınırları, işlem kayıtları, tekrar deneme ve hata telafisi desteklenir.
5. API anahtarları yalnızca sunucu ortam değişkenlerinde tutulur; tarayıcıya gönderilmez.
6. Dosya veya endpoint taşımadan önce import, URL, cron, webhook, Vercel rewrite ve veritabanı bağımlılıkları kontrol edilir.

## Modül 2 çalışma notu

Modül 2'nin mevcut botları, yayın sistemi ve Gemini görsel üretim motoru bu aşamada korunmaktadır. Görsel üretim API/model geçişi, Nano Banana erişimi ve ödeme yapılandırması hazır olduğunda ayrı bir geliştirme adımı olarak ele alınacaktır. Onaylanmış ana prompt değiştirilmez.

## Geliştirme ve dağıtım

- Yerel statik kalite kontrolü: `npm run check` (JSON, JavaScript sözdizimi, migration adları ve gizli ortam dosyası kontrolü).
- Canlı görsel üretimi/Storage erişimi yapan eski entegrasyon testleri varsayılan olarak kapalıdır. Yalnızca bilinçli canlı testte `RUN_LIVE_AI_TESTS=true` ile çalıştırılmalıdır.

- Vercel projesinin Root Directory ayarı depo kök dizinidir.
- `main` dalına gönderilen commit'ler bağlı Vercel projesinde otomatik dağıtımı tetikler.
- `vercel.json` içindeki endpoint rewrite ve cron tanımları API dosyalarıyla birlikte değerlendirilmelidir.
- Veritabanı şema değişiklikleri `supabase/migrations/` altında sıralı migration olarak tutulmalıdır.
- Her anlamlı değişiklikten sonra Vercel Preview/Production durumu ve ilgili endpoint smoke testleri kontrol edilmelidir.

## Güvenlik

- Gerçek `.env` dosyaları, token'lar ve API anahtarları Git'e eklenmez.
- Supabase Service Role anahtarı yalnızca güvenilir sunucu ortamında kullanılabilir.
- Admin işlemleri sunucu tarafında yetkilendirilir.
- Webhook ve cron uçları kendi doğrulama mekanizmalarını kullanır.
- Canlı veritabanı veya dağıtım yapılandırmasında yıkıcı değişiklikler öncesinde geri dönüş planı hazırlanır.

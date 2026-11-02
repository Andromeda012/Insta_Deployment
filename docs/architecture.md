# Global Mobilya — Sistem Mimarisi

Bu belge, depodaki mevcut kodun fiilî yerleşimini ve sorumluluk sınırlarını tanımlar. Planlanan özellikler, canlıda mevcutmuş gibi gösterilmez.

## 1. Çalışma modeli

- **Web uygulaması:** Kök dizindeki `index.html`, `app.js`, `style.css` ve `js/` dosyaları ana yönetim kabuğunu oluşturur.
- **Dağıtım:** Vercel, kök dizinden statik dosyaları ve `api/` altındaki Node.js serverless fonksiyonlarını dağıtır.
- **Veri ve kimlik:** Supabase, uygulama verileri ve oturum/erişim akışlarının ana veri katmanıdır.
- **Zamanlanmış işler:** `vercel.json` içinde tanımlı cron uçları ve `.github/workflows/` altındaki GitHub Actions iş akışları ayrı ayrı değerlendirilmelidir.
- **VPS geçişi:** `infra/vps-migration-staging/` bir geçiş hazırlık alanıdır; mevcut canlı yayın altyapısı olarak kabul edilmemelidir.

## 2. Modül sınırları

| Alan | Kod konumu | Sorumluluk |
|---|---|---|
| Modül 1 — Web sitesi ve CMS | `Module 1/`, `api/module1-content.js` | Site içerikleri, CMS ve web kataloğu |
| Modül 2 — Sosyal medya | `Module 2/`, `api/module2.js`, `api/*-cron.js`, `api/*-webhook.js` | Bot arayüzleri, sosyal kanal iş akışları, yayın kuyruğu |
| Modül 3 — CRM | `Module 3/`, `js/modules/crm.js` | Müşteri ve satış süreçleri |
| Modül 4 — Üretim | `Module 4/`, `js/modules/production.js` | Üretim ve sipariş takip arayüzleri |
| Modül 5 — Operasyon ve altyapı | `Module 5/`, `js/modules/operations.js` | Servis, altyapı ve operasyon görünümü |
| Modül 6 — Analitik | `js/modules/analytics.js` | Yönetim ve performans göstergeleri |
| Modül 7 — Ürün ve AI Studio | `Module 7/`, `api/module7.js` | Ürün kataloğu ve ürün bazlı AI profilleri |

Modül numaraları ile ana kabuktaki modül yükleyicileri eşleşecek şekilde korunmalıdır. Modül 2 bu temizlik çalışmasında dondurulmuştur.

## 3. Ortak platform katmanları

- `js/auth.js`: tarayıcı oturum ve kimlik doğrulama arayüzü.
- `js/data.js`: ana kabukta kullanılan paylaşılan veri/arayüz durumu.
- `js/modules/permissions.js`: rol ve yetki arayüzü.
- `api/_lib/`: API tarafında ortak kimlik doğrulama ve yayın yardımcıları.
- `supabase/migrations/`: veritabanı şema ve güvenlik değişikliklerinin sıralı kayıtları. Bu klasörün dışına taşınmaz.
- `supabase/legacy/`: tarihsel başlangıç/Photoroom SQL dosyaları; migration değildir ve tekrar çalıştırılmamalıdır.
- `infra/vps-migration-staging/`: canlıya alınmamış VPS geçiş taslakları, Docker publisher/webhook ve testleri.
- `tests/`: kontrollü manuel entegrasyon testleri; canlı API/Storage erişimi için açık opt-in gerekir.
- `docs/`: teknik kararlar, API sözleşmeleri, veri erişim matrisi ve işletim dokümantasyonu.
- `scripts/repo-check.mjs`: CI ve yerel geliştirme için salt-okunur statik kalite kontrolü.

## 4. API dosyaları neden hemen taşınmıyor?

Vercel'de `api/` altındaki dosya yolları aynı zamanda HTTP endpoint'leridir. Örneğin `api/module7.js` dosyasını `api/module7/index.js` konumuna taşımak URL sözleşmesini değiştirebilir. Cron tanımları, webhook sağlayıcıları, yeniden yazımlar ve istemci çağrıları birlikte güncellenmeden böyle bir taşıma yapılmamalıdır.

Bu nedenle API'ler mantıksal olarak modüllere göre belgelenir; fiziksel taşıma ayrı bir kontrollü geçiş olarak planlanır.

## 5. Motorlar ve eski entegrasyonlar

- `Module 2/gemini-banana-engine.js`: Modül 2 kapsamındadır; bu temizlikte değiştirilmeyecektir.
- `nova-studio-engine.js` ve `Module 2/nova-studio-engine.js`: aynı Git blob içeriğine sahip iki kopyadır. `Module 7/index.html` içindeki yinelenen yükleme kaldırılmış ve yalnızca kök motor bırakılmıştır. `Module 2/Catalog/index.html` ile Modül 2 kopyası dondurma kararı nedeniyle değiştirilmemiştir.
- `photoroom-engine.js`: `api/photoroom-campaign.js` tarafından import edilmektedir. Dolayısıyla yalnızca motor dosyasını silmek canlı API fonksiyonunu kırar.
- `Module 2/photoroom-engine.js` kullanılmayan eski kopya olarak bağımlılık taramasından sonra kaldırılmıştır (2 Kasım 2026).
- `api/photoroom-campaign.js` ve `supabase/legacy/supabase_photoroom_setup.sql`: eski Photoroom akışının parçalarıdır. İç kodda çağrı bulunmaması, harici sistem veya eski panel tarafından kullanılmadığını kanıtlamaz. Silme kararı öncesinde endpoint erişim/logları ve Supabase bağımlılıkları doğrulanmalıdır.

## 6. Güvenlik ve yapılandırma

- Gizli anahtarlar yalnızca Vercel Environment Variables veya güvenli sunucu secret store içinde tutulmalıdır.
- `.env` dosyaları Git'e eklenmemelidir; örnek dosyalarda yalnızca değişken adları ve sahte değerler bulunmalıdır.
- Servis rolü anahtarları tarayıcı koduna gönderilmemelidir.
- API uçları ortak auth yardımcılarını kullanmalı; CORS `*` gibi geniş izinler yalnızca gerekçelendirilmiş, herkese açık uçlarda bulunmalıdır.
- Veritabanı değişiklikleri migration dosyalarıyla izlenmeli; canlı şemaya doğrudan ve kayıtsız müdahale edilmemelidir.

## 7. Kalite kapısı

- `npm run check`, depo içindeki JSON dosyalarını, JavaScript/CJS sözdizimini, migration dosya adlarını ve yanlışlıkla izlenen gerçek ortam dosyalarını kontrol eder.
- Canlı API/AI/Storage testi, statik kontrollerden ayrıdır ve açık `RUN_LIVE_AI_TESTS=true` onayı olmadan çalışmaz.
- `.env*` dosyaları varsayılan olarak Git dışında tutulur; yalnızca `.env.example` şablonları izlenebilir.
- GitHub Actions, `main` ve pull request değişikliklerinde aynı statik kalite kapısını çalıştırır.

## 8. Modül 4 müşteri takip route'u

- Müşteri takip arayüzü `Module 4/takip.html` dosyasıdır; `Module 4/siparis-paneli.html` yönetim paneliyle aynı içeriktedir.
- Sipariş mesajlarının ürettiği `/siparis-paneli?kod=...` adresi için henüz Vercel rewrite yoktur.
- Takip sayfası şu anda Firebase `/siparisler.json` listesini tarayıcıda indirip filtrelemektedir. Firebase kuralları doğrulanmadan bu sayfa müşteri verisi açısından güvenli kabul edilmez ve route açılmaz.
- Geçmiş notlarının XSS riski `textContent` tabanlı DOM render'ı ile giderildi. Firebase koleksiyon erişimi ve takip API'si ayrı bir güvenlik işi olarak kalır.

## 9. Temizlik sırası

1. Dosya envanteri ve import/endpoint bağımlılıklarını doğrula.
2. Kullanılmayan, sıfır bayt veya yinelenen dosyaları referans kontrolünden sonra kaldır.
3. Ortak sunucu yardımcılarını `api/_lib/` altında tut; modül API sözleşmelerini dokümante et.
4. Her modülün UI, istemci kodu, API sözleşmesi ve migration referanslarını tek yerde belgelemeye devam et.
5. Her değişiklikten sonra Vercel preview dağıtımı ve ilgili endpoint smoke testlerini çalıştır.
6. Canlı cron, webhook ve yayın akışlarını doğrulamadan production temizliği yapma.


## 10. Depo klasör standardı — 2 Kasım 2026

- `tests/`: manuel entegrasyon testleri; canlı servis erişimi açık onay gerektirir.
- `infra/vps-migration-staging/`: VPS geçiş taslağı; canlı deployment değildir.
- `supabase/migrations/`: Supabase CLI tarafından sıralı olarak yürütülen gerçek migration'lar.
- `supabase/legacy/`: eski başlangıç/kurulum SQL'leri; migration dizinine alınmaz ve tekrar çalıştırılmaz.
- `Module 2/AI Studio/`, `Module 2/gemini-banana-engine.js`, `Module 2/nova-studio-engine.js`: Modül 2 yaratıcı akışı.
- `Module 7/ai-studio.js`: Modül 7 ürün bazlı AI profil editörü. İki AI Studio alanı farklı sorumluluk taşır; tek dosyada birleştirilmez.
- Kök `gemini-banana-engine.js`, `nova-studio-engine.js` ve `photoroom-engine.js` mevcut cron/API veya tarayıcı URL giriş noktalarıdır. Bunlar bağımlılıkları değiştirilmeden fiziksel olarak taşınmaz.

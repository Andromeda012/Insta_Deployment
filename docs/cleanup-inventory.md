# Depo Temizlik Envanteri

## Güvenli şekilde korunacak alanlar

- `Module 2/` ve mevcut Gemini görsel motoru: kullanıcı kararıyla dondurulmuştur.
- `api/` endpoint yolları: URL sözleşmeleri nedeniyle bağımlılık kontrolü olmadan taşınmayacaktır.
- `supabase/migrations/`: geçmiş migration dosyaları silinmeyecektir.
- `vps_migration_staging/`: canlıya geçiş tamamlanmış sayılmayacaktır; geçiş kararı verilene kadar arşiv/ hazırlık alanı olarak kalır.

## İnceleme gerektiren eski/tekrarlı öğeler

| Öğe | Bulgu | İşlem |
|---|---|---|
| `photoroom-engine.js` | `api/photoroom-campaign.js` tarafından import ediliyor | Endpoint kullanım ve logları doğrulanmadan silinmeyecek |
| `api/photoroom-campaign.js` | Eski Photoroom kampanya endpoint'i | Harici çağrılar ve DB bağımlılıkları doğrulanmadan silinmeyecek |
| `supabase_photoroom_setup.sql` | Photoroom'a özel eski kurulum SQL'i | Mevcut tablo/policy bağımlılıkları kontrol edilmeden silinmeyecek |
| `Module 2/photoroom-engine.js` | Modül 2 altında eski motor dosyası | Modül 2 dondurulduğu için dokunulmayacak |
| `nova-studio-engine.js` ve `Module 2/nova-studio-engine.js` | Git blob SHA aynı; katalog sayfası iki yolu da script olarak yüklüyor | İki script yüklemesinin davranışı test edilmeden bir kopya kaldırılmayacak |
| `Module 4/app.js` | Sıfır bayt dosya | HTML ve diğer dosyalarda referansı olmadığı teyit edilince kaldırılabilir |
| `Module 4/index.html` ve `Module 4/siparis-paneli.html` | Aynı boyutta; içerik eşitliği ve route kullanımı ayrıca kontrol edilmeli | Şimdilik korunacak |

## Temizlik kuralı

Bir dosyanın eski görünmesi veya adında eski bir servis geçmesi tek başına silme gerekçesi değildir. Önce import, script, fetch URL, cron, webhook, Vercel rewrite, SQL ve harici tüketici bağımlılıkları kontrol edilir. Silme işlemi ancak bağımlılıklar taşındıktan veya kullanım dışı olduğu doğrulandıktan sonra yapılır.

## Kök dizin ve işletim dosyaları — ikinci inceleme

| Öğe | Doğrulanan bulgu | Karar |
|---|---|---|
| `gemini-banana-engine.js` (kök) | `test_gemini_banana.cjs` ve `test_verification_suite.cjs` bu dosyayı import ediyor. `api/module2.js` ise ayrı olarak `Module 2/gemini-banana-engine.js` dosyasını kullanıyor. | Modül 2 motoruna dokunulmayacak. Kök motor testlerin parçası olduğu için testler taşınmadan silinmeyecek. |
| `run_dm_scanner.ps1` / `.bat` | PowerShell betiği canlı Instagram DM tarama ve Instagram/Facebook cron endpoint'lerini düzenli çağırıyor; BAT dosyası bunu başlatıyor. | Kullanım dışı değil; yerel işletim aracı olarak korunacak. 7/24 çalışması için açık bir Windows oturumu gerektirdiği ayrıca not edilmeli. |
| `Module 4/index.html` / `Module 4/siparis-paneli.html` | Dosyalar aynı Git blob SHA değerine ve aynı boyuta sahip; içerikleri birebir aynı. | Yinelenen içerik doğrulandı, fakat iki ayrı URL doğrudan kullanılıyor olabilir. URL/harici bağlantı kullanımı doğrulanmadan biri silinmeyecek. |
| `package.json` (kök) | Yalnızca proje adı, sürüm, ESM tipi ve private işaretini içeriyor; script veya dependency tanımlamıyor. | Şu an gereksiz değil; ESM davranışını açıkça tanımlıyor. |
| `vps_migration_staging/` | Docker publisher/webhook, SQL yamaları, testler ve migration checklist içeriyor. | Aktif VPS olarak değerlendirilmez; geçiş kararı verilene kadar staging arşivi olarak korunur. |

## Güvenlik / eski entegrasyon notu

- `api/photoroom-campaign.js` içinde Supabase anon anahtarı için sabit bir fallback tanımı var. Anon anahtar tek başına servis rolü sırrı değildir; asıl güvenlik sınırı Supabase RLS politikalarıdır.
- `supabase_photoroom_setup.sql`, Photoroom tablolarında `FOR ALL` ve herkese açık `USING (true)` / `WITH CHECK (true)` politikaları tanımlıyor. Bu SQL dosyası yeniden çalıştırılmamalı; canlı projedeki mevcut tablolar ve politikalar ayrıca denetlenmeli.
- Photoroom API'si kök `photoroom-engine.js` dosyasını import ediyor. Depo içi aramada görünür çağrı bulunmaması, Vercel endpoint'ine dışarıdan istek gelmediğini kanıtlamaz. Erişim logları ve Supabase bağımlılıkları doğrulanmadan tüm akış birlikte kaldırılmayacak.

## Photoroom / kampanya akışı — canlı Supabase denetimi (2 Kasım 2026)

| Kontrol | Canlı bulgu | Temizlik kararı |
|---|---|---|
| `public.social_campaign_assets` tablosu | Mevcut değil | SQL dosyasındaki tablo tanımı canlı şemayla eşleşmiyor; tabloyu oluşturma veya silme işlemi yapılmayacak |
| `public.photoroom_config` tablosu | Mevcut değil | Eski kurulum SQL'inin bu bölümü canlı sistemde kullanılmıyor görünüyor |
| `site_settings.social_campaign_assets` | 3 kampanya kaydı var; 31 Ekim ve 2 Kasım 2026 tarihli kayıtlar dahil | Aktif/son dönem kampanya verisi içeriyor; kesinlikle silinmeyecek |
| Supabase Storage | `media` bucket mevcut; kampanya kayıtları `products/`, `posts/`, `stories/` ve eski `photoroom/` yollarına işaret ediyor | Dosyalar ve bucket korunacak; kullanılmayan nesneler ayrı envanter ve referans taraması olmadan silinmeyecek |
| `photoroom-engine.js` | `site_settings` içindeki `social_campaign_assets` anahtarına kayıt yazıyor ve oradan okuyor; görselleri `media` bucket'ına yüklüyor | Dosya yalnızca eski Photoroom motoru değil, kampanya veri akışının da parçası. Şimdilik korunacak |
| `api/photoroom-campaign.js` | Motoru import ediyor; GET kampanyayı okuyor, POST ürün kataloğundan kampanya üretip kaydediyor | Endpoint dışarıdan çağrılabilir. Depo içi çağrı bulunmaması kaldırmak için yeterli değil |
| `supabase_photoroom_setup.sql` | Olmayan iki tabloyu tanımlıyor ve ikisine de `FOR ALL USING (true) WITH CHECK (true)` politikası öneriyor | **Tekrar çalıştırılmamalı.** Bu geniş izinler yeni oluşturulacak tablolar için güvenli varsayılan değildir. Dosya tarihsel referans olarak tutulacak; canlı politikaları değiştirmek için kullanılmayacak |
| Vercel runtime logları | Son 30 dakikalık sorguda eşleşme bulunmadı. Hobby planı 1 saatten eski runtime loglarını saklamadığından 7 günlük sorgu reddedildi | Bu sonuç endpoint'in kullanılmadığını kanıtlamaz. Erişim geçmişi için daha uzun saklama/başka log kaynağı gerekir |

### Sonuç

Photoroom adı yanıltıcı: kök `photoroom-engine.js` içinde kampanya motoru Gemini Banana akışını da yürütüyor. Canlı `site_settings` kayıtları ve Storage varlıkları yakın tarihli olduğundan, bu dosyaları veya kampanya verisini şu aşamada kaldırmak güvenli değil. `Module 2/photoroom-engine.js` dondurulmuş Modül 2 kapsamı nedeniyle ayrıca korunur.

Bir sonraki temizlik adımı, `api/photoroom-campaign.js` endpoint'inin tüm HTML/JS/cron/webhook referanslarını ve Vercel erişim isteklerini (mevcut log saklama sınırları dahilinde) doğrulamak; ardından Photoroom adı taşıyan parçaları **aktif Gemini Banana kampanya akışından ayırmak** olmalıdır. Bu ayrım tamamlanmadan dosya silinmeyecek veya API yolu değiştirilmeyecektir.

### Kampanya motorlarının ayrıştırılması — ek kod ve yayın akışı denetimi (2 Kasım 2026)

- Canlı yayın zamanlayıcıları `api/instagram-cron.js` ve `api/facebook-cron.js`, kökteki `gemini-banana-engine.js` dosyasını import eder. Bu motor `buildAndSaveProductCampaign()`, `fetchActiveCampaignFromSupabase()` ve `saveAssetRecordToSupabase()` üzerinden `site_settings.social_campaign_assets` anahtarını kullanır.
- `Module 2/gemini-banana-engine.js` de aynı kampanya kayıt anahtarını kullanır; Modül 2 dondurulduğu için korunur.
- Kök `photoroom-engine.js`, bu iki cron dosyasının import zincirinde görünmüyor. Eski `api/photoroom-campaign.js` endpoint'i tarafından import ediliyor. Bu nedenle eski motor ile güncel yayın motoru ayrı kod yolları; fakat aynı kampanya kayıt alanını paylaşıyorlar.
- `Module 7/index.html` içindeki ürün dönüştürme ayarları ve medya yükleme işlemleri `/api/module7?action=...` uçlarını kullanıyor. Bu sayfada `/api/photoroom-campaign` veya Photoroom API çağrısı bulunmuyor.
- Depo kod araması `/api/photoroom-campaign` için sonuç döndürmedi. Ancak GitHub kod araması sonuçsuz kaldığından bu tek başına harici tüketici olmadığını kanıtlamaz. Vercel'de son 30 dakikalık log sorgusunda da eşleşme bulunmadı; bu yalnızca dar zaman penceresidir.
- `api/photoroom-campaign.js` tüm origin'lere CORS izni veriyor ve `POST` yolunda kimlik/rol doğrulaması yapmıyor. Buna rağmen kök motor, Supabase service-role anahtarıyla Storage ve `site_settings` üzerinde yazma işlemleri yapıyor. `photoroom_api_key` gövde alanı da kabul ediliyor; mevcut motorun Gemini anahtarını fiilen kullanıp kullanmadığı ayrıca kodda doğrulanmalıdır.

### Karar ve sonraki güvenli adım

1. Canlı yayın akışının kök `gemini-banana-engine.js` üzerinden devam ettiği doğrulandı; bu dosya ve ortak kampanya kayıtları korunacak.
2. Eski `api/photoroom-campaign.js` endpoint'i ve kök `photoroom-engine.js` henüz silinmeyecek. Önce endpoint için harici çağrı sahibi/iş akışı teyit edilmeli.
3. Endpoint'in yazma işlemi yetkisiz erişime açık göründüğünden, kullanım sahibi belirlendikten sonra `POST` için `authenticateRoles` veya eşdeğer güvenli servis kimlik doğrulaması eklenmeli. Çağıran istemci doğrulanmadan bu değişiklik yapılmayacak; aksi halde mevcut entegrasyon kırılabilir.
4. `supabase_photoroom_setup.sql` yeniden çalıştırılmayacak. `social_campaign_assets` kaydı ve Storage nesneleri, güncel motorun ortak kullandığı veriler olarak korunacak.
5. Eski motorun yalnızca adlandırma/uyumluluk kalıntısı olan alanları, aktif motorun beklediği kayıt şemasıyla karşılaştırılarak ayrı bir refactor olarak ele alınacak.

### Tekrarlı Nova Studio script yüklemesi — güvenli sadeleştirme

- `Module 7/index.html` ve `Module 2/Catalog/index.html` aynı Nova Studio motorunu hem `/Module%202/nova-studio-engine.js` hem de `/nova-studio-engine.js` yolundan iki kez yüklüyordu.
- İki dosyanın Git blob SHA'sı aynı ve motor `window.NovaStudioEngine` globalini atayarak dışa açıyor. Sayfalarda kullanılan çağrılar bu global üzerinden yapılıyor.
- Modül 2 dondurulduğu için `Module 2/Catalog/index.html` ve `Module 2/nova-studio-engine.js` değiştirilmedi.
- Yalnızca `Module 7/index.html` içindeki ilk, yinelenen `/Module%202/nova-studio-engine.js` script etiketi kaldırıldı. Kök `/nova-studio-engine.js` yüklemesi ve Module 7'nin kullandığı global API korundu.
- Kök motor dosyası ve Modül 2 kopyası şimdilik korunuyor; Module 2 katalog sayfası hâlâ kendi mevcut yükleme zincirine bağlı.
- Değişiklik commit'i: `ee28d808125314bcebf59048023670a551d4208d`.

### Modül 4 yinelenen HTML dosyası ve takip URL'si

- `Module 4/index.html` ile `Module 4/siparis-paneli.html` aynı Git blob SHA değerine sahiptir; içerikleri birebir aynıdır. Ayrı müşteri takip sayfası `Module 4/takip.html` dosyasıdır.
- Ana uygulama `js/modules/production.js` üzerinden `Module%204/index.html` dosyasını iframe içinde açar.
- Her iki HTML dosyasındaki sipariş mesajı oluşturma kodu `{window.location.origin}/siparis-paneli?kod=...` adresini üretir.
- Ayrı müşteri takip sayfası `Module 4/takip.html` mevcut; ancak `vercel.json` içinde `/siparis-paneli` için rewrite tanımı yok. Bu nedenle üretilen takip bağlantısı şu anda doğru sayfaya yönlenmiyor.
- `Module 4/siparis-paneli.html` adı bir müşteri takip sayfası izlenimi verse de içeriği ayrı bir müşteri ekranı değil; yönetim paneliyle birebir aynı dosya.
- Karar: iki dosyadan hiçbiri silinmedi. Önce müşteriye açık takip sayfasının gerçekten var olup olmadığı ve doğru URL sözleşmesinin ne olması gerektiği netleştirilmeli. Müşteriye açık olması gereken bir bağlantıyı yönetim paneline yönlendirmek güvenlik ve erişim kontrolü açısından kabul edilemez.


## API ve canlı Supabase güvenlik denetimi — 2 Kasım 2026

- Ayrıntılı bulgular ve aşamalı düzeltme planı `docs/api-security-audit.md` dosyasına eklendi.
- Canlı `products` tablosunda herkese açık tam yazma politikası ve `site_settings` üzerinde eski public denylist yazma politikaları doğrulandı. Harici yazıcılar ve gerçek yetkili Modül 7 hesabı doğrulanmadan canlı policy/grant değişikliği yapılmadı.
- `api/photoroom-campaign.js` ve `api/render.js` için kimlik doğrulaması eksikliği tespit edildi; bilinmeyen harici çağrılar kırılmasın diye bu turda endpoint'ler değiştirilmedi.
- Sosyal webhook'larda sağlayıcı imza doğrulaması eksikliği görüldü. Modül 2 ve onaylı prompt dondurulmuş kapsamda kaldığından bu dosyalara dokunulmadı.
- Ortak `api/_lib/auth.js` yardımcısının Supabase Auth token doğrulaması ve `app_metadata` rol kontrolü olumlu bulundu.
- Supabase advisor: leaked-password protection kapalı; `site_settings` üzerinde birden fazla permissive policy uyarısı; `content_revisions` ve `publication_logs` policy yok (mevcut grant'ler yalnızca service_role ile sınırlı); altı kullanılmayan index bildirimi. Bunlar için otomatik veya körlemesine DB değişikliği yapılmadı.
- Bu denetim turunda canlı Supabase'e yazılmadı; yalnızca repo dokümantasyonu değiştirildi.


### Test güvenliği ve depo kalite kapısı

- `test_gemini_banana.cjs` ve `test_verification_suite.cjs` normal çalıştırmada gerçek Gemini/Storage işlemlerini başlatabiliyordu. İki dosyanın canlı test yürütme çağrısı artık yalnızca `RUN_LIVE_AI_TESTS=true` iken çalışır; test kodu ve kapsamı silinmedi.
- Kök `package.json` içine bağımlılıksız `npm run check` komutu eklendi; statik depo denetimi canlı entegrasyon testlerinden ayrıldı.
- `.gitignore` genişletilerek tüm gerçek `.env*` dosyaları ve Node bağımlılık/coverage klasörleri dışlanacak; `.env.example` şablonları izlenebilir kalacak.
- Modül 2 kaynakları değişmeden yalnızca statik sözdizimi denetimine dahil edilir; prompt veya yayın davranışında değişiklik yapılmaz.

- `scripts/repo-check.mjs` ve `.github/workflows/repository-quality.yml` eklendi. CI, JSON/JS sözdizimi, migration adlandırması ve izlenen gerçek ortam dosyalarını kontrol eder.
- `docs/testing-and-release.md` testlerin güvenli çalıştırılma ve yayın kontrol prosedürünü tanımlar.
- Canlı Supabase tablo/Storage yetkileri için `docs/database-access-matrix.md` oluşturuldu; bu doküman canlı veritabanı değişikliği değildir.

- `Module 4/takip.html` içindeki geçmiş notları için stored XSS riski tespit edildi ve `innerHTML` yerine DOM `textContent` ile render edilecek şekilde düzeltildi. Ayrıntı: `docs/module4-tracking-security.md`.
- Takip sayfası Firebase `/siparisler.json` koleksiyonunun tamamını tarayıcıya çekiyor. Firebase anonim okuma kuralları doğrulanmadığından `/siparis-paneli` rewrite'i açılmadı; önce müşteri verisi erişim modeli güvenli hâle getirilmeli.

- İlk CI çalışması, `_data/galeri/galeri-1787672363723.json` içinde kalmış bir Git merge-conflict işaretini tespit etti. İşaretler kaldırılarak geçerli JSON hâline getirildi; sonraki CI kontrolü 159 izlenen dosya, 31 JSON, 55 JS/CJS ve 9 migration üzerinde başarılı oldu.
- Vercel Production dağıtımı son commit `5a26020c5452ef3e03b3b6b376f4c66a622c1a8d` için `READY`; GitHub Actions statik kalite kontrolü de aynı commit üzerinde başarılı.

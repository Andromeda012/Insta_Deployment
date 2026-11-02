# API ve Supabase Güvenlik Denetimi

**Tarih:** 2 Kasım 2026  
**Kapsam:** Vercel `api/` uçları, ortak kimlik doğrulama yardımcıları, canlı Supabase RLS/grant/policy durumu, kök kurulum SQL'i.  
**Koruma sınırı:** `Module 2/`, onaylanmış Bahar Portmanto prompt'u ve mevcut yayın motoru değiştirilmedi. 2 Kasım 2026'da yalnızca ürün ve site ayarı yazma yetkilerini daraltan, Modül 2 policy'lerini koruyan bir Supabase migration uygulandı.

## Yönetici özeti

Denetimde ürün tablosunda public CRUD ve `site_settings` üzerinde public denylist yazma politikaları doğrulandı. 2 Kasım 2026'da bu iki risk alanı, mevcut okuma akışını ve Modül 2'nin rol/anahtar bazlı politikalarını koruyacak şekilde daraltıldı. `api/render.js`, Storage klasör politikaları, webhook imzaları ve Auth ayarları ayrı uyumluluk çalışması gerektirdiğinden henüz değiştirilmedi.

## Bulgular

### Yüksek öncelik

| ID | Bulgu | Kanıt / etki | Bu turdaki karar |
|---|---|---|---|
| API-01 | `public.products` tablosunda public CRUD policy ve grant'i vardı. | Anonim istemciye ürün verisini değiştirme/silme imkânı verebilirdi. | **Düzeltildi:** `Public full access on products` kaldırıldı; anon/authenticated için yalnızca SELECT kaldı. INSERT/UPDATE/DELETE yalnızca service_role. Modül 7 yazma yolu `/api/module7` ile uyumlu. |
| API-02 | `site_settings` üzerinde `TO public` denylist tabanlı eski INSERT/UPDATE/DELETE policy'leri vardı. | Kara listeye eklenmemiş yeni veya unutulmuş ayar anahtarları anonim yazmaya açık kalabilirdi. | **Düzeltildi:** Eski üç public denylist policy kaldırıldı; anon DML grant'leri iptal edildi. Authenticated DML grant'i korundu; Modül 2'nin `admin`/`content_manager` + key-scope RLS policy'leri yazma sınırı olarak kaldı. Modül 1/7 yazımları server-side service_role ile devam ediyor. |
| API-03 | `api/photoroom-campaign.js` POST yolu merkezi rol doğrulaması kullanıyor; kök Photoroom motoru Supabase Storage ve `site_settings` üzerinde ayrıcalıklı yazma yapabiliyor. | Önceki sürümde POST anonim erişime açıktı. Yeni sürümde `admin` veya `product_manager` rolü zorunlu; sağlayıcı anahtarı yalnızca `PHOTOROOM_API_KEY` sunucu ortam değişkeninden okunuyor. | **Düzeltildi:** POST için `authenticateRoles(req, ['admin', 'product_manager'])` eklendi; body içinden API key kabulü kaldırıldı; hata yanıtları ortak `apiError` üzerinden dönüyor. GET mevcut public okuma davranışını koruyor. Dış çağıran envanteri yine tamamlanmalı. |
| API-04 | `api/render.js` GET/POST üzerinden SVG render ediyor; TikTok POST akışında `SUPABASE_SERVICE_ROLE_KEY` mevcutsa `media/tiktok/` alanına yükleme yapabiliyor. Handler'da merkezi rol doğrulaması görünmüyor. | Açık render/upload yüzeyi maliyet, kaynak tüketimi ve depolama kötüye kullanımı doğurabilir. | Endpoint'in harici tüketicisi ve beklenen erişim modeli netleşmeden auth eklenmedi; aksi hâlde çalışan entegrasyon kırılabilir. |
| API-09 | `storage.objects` üzerinde `media` bucket'ı için public SELECT ve belirli klasörler HARİÇ public INSERT/UPDATE/DELETE politikaları etkin. | Yeni veya listede olmayan klasörler varsayılan olarak anonim yükleme/değiştirme/silmeye açık kalabilir. | Modül 2 medya akışları korunarak, kullanılan klasörlerin tam envanteri çıkarılmadan policy daraltılmadı.

### Orta öncelik / entegrasyon riski

| ID | Bulgu | Kanıt / etki | Bu turdaki karar |
|---|---|---|---|
| API-05 | Facebook, Instagram, TikTok ve YouTube webhook dosyalarında sağlayıcı imza doğrulaması (ör. Meta `X-Hub-Signature-256`) açıkça doğrulanmıyor. Bazı uçlar ayrıca `simulate_message` gibi doğrudan POST girdileri kabul ediyor. | Sahte webhook olayları otomatik yanıt veya kayıt akışını tetikleyebilir. | Bu uçlar Modül 2 yayın/iletişim kapsamına bağlı ve dondurulmuş durumda; hiçbirine dokunulmadı. İleride ayrı bir güvenlik değişikliği olarak ele alınmalı. |
| API-06 | Bazı eski webhook dosyaları Supabase anon anahtarını kod içi fallback olarak taşıyor. | Anon anahtar gizli anahtar değildir; tek başına service-role erişimi sağlamaz. Ancak fallback ve RLS beklentilerinin karışması yapılandırma hatalarını gizleyebilir. | Anahtar rotasyonu yapılmadı; anon anahtarın gizliymiş gibi ele alınmadığı not edildi. Service-role anahtarının istemciye sızdığına dair bu denetimde kanıt bulunmadı. |
| API-07 | `site_settings` için aynı role/action üzerinde birden fazla permissive policy var. | Supabase performans danışmanı dört policy grubu için uyarı veriyor; birden fazla politika değerlendirmesi gereksiz maliyet yaratabilir. | Politika birleştirme yapılmadı; yetki semantiği değişebileceği için güvenlik düzeltmesiyle birlikte kontrollü test gerektiriyor. |
| API-08 | Supabase Auth'ta leaked-password protection kapalı. | Sızdırılmış parolaların kullanılmasını engelleyen kontrol devre dışı. | Dashboard/Auth ayarıdır; bu denetimde canlı Auth ayarı değiştirilmedi. |

### Bilgilendirme / yanlış alarm olmaması gerekenler

- `content_revisions` ve `publication_logs` tablolarında RLS açık, fakat kullanıcı rolleri için policy yok. Canlı grant incelemesinde bu tablolar yalnızca `service_role` erişimine açık görünüyor; bu nedenle mevcut API tasarımında bilinçli sunucu tarafı erişim olabilir. Sırf advisor INFO uyarısı nedeniyle public/authenticated policy eklenmemeli.
- Performance advisor altı kullanılmamış index bildirdi. Düşük trafik veya yeni tablolar için bu normal olabilir; sorgu planı ve kullanım süresi incelenmeden index silinmemeli.
- `Access-Control-Allow-Origin: *` tek başına kimlik doğrulama değildir ve webhook güvenliği yerine geçmez. CORS'u daraltmak, sunucu tarafı auth/signature doğrulamasının yerine kullanılamaz.

## Olumlu doğrulamalar

- `api/_lib/auth.js`, Bearer token'ı Supabase Auth `/auth/v1/user` üzerinden doğruluyor ve yetkiyi kullanıcı tarafından değiştirilebilir `user_metadata` yerine `app_metadata` üzerinden okuyor.
- `api/module1-content.js` ve `api/module7.js` yazma yolları server-side rol kontrolü yapıyor.
- Modül 7 arayüzü ürün yazma/silme, ayar kaydetme ve medya yükleme için `/api/module7?action=...` uçlarını kullanıyor. Dokümana göre tarayıcı doğrudan tablo/Storage yazımı yapmıyor.
- `api/module2.js` yönetim işlemlerinde merkezi rol kontrolü kullanıyor; cron uçlarında `CRON_SECRET` doğrulaması var.
- `content_revisions` ve `publication_logs` için anon/authenticated tablo grant'i görünmüyor.

## Güvenli uygulama planı

1. **Harici yazıcı envanteri:** Ürün ve site ayarlarına doğrudan Supabase REST/JS ile yazan tüm istemciler, yerel araçlar, cron'lar ve üçüncü taraf entegrasyonlar listelenecek. Depo içi GitHub araması tek başına yeterli kanıt sayılmayacak.
2. **Ürün tablosu:** Public write grant/policy kaldırıldı; public SELECT ve server-side service-role yazımı kaldı. Sonraki doğrulama, gerçek admin/product_manager hesabıyla Modül 7 katalog CRUD ve medya yükleme testidir.
3. **Site ayarları:** Eski public denylist yazma policy'leri kaldırıldı; anon DML kapatıldı. Authenticated DML grant'i yalnızca mevcut Modül 2 admin/content_manager key-scope RLS policy'leriyle kullanılabilir. Modül 2 kodu ve policy'leri değiştirilmedi.
4. **Eski ayrıcalıklı endpoint'ler:** `api/photoroom-campaign.js` POST yolu artık `admin`/`product_manager` rol doğrulaması yapıyor ve sağlayıcı API anahtarını yalnızca sunucu ortamından alıyor. Kalan açık konu `api/render.js`: tüketici/çağıran envanteri ve Modül 2 bağımlılığı doğrulanmadan auth veya rate-limit davranışı değiştirilmemeli.
5. **Webhook imzaları:** Modül 2 kapsamı yeniden açıldığında Meta/TikTok/YouTube sağlayıcı imzaları ham request body üzerinden doğrulanacak; simülasyon çağrıları ayrı ve yetkili test yoluna taşınacak.
6. **Auth ayarı:** Leaked-password protection Supabase Dashboard'da açılacak; ardından giriş akışı kontrollü test edilecek.
7. **Policy/index temizliği:** Yetki matrisi sabitlendikten sonra redundant permissive policy'ler birleştirilecek; kullanılmayan index'ler ancak gerçek sorgu istatistikleriyle teyit edilirse kaldırılacak.

## Bu turda yapılan değişiklikler

- Kök `supabase_setup.sql` dosyasının başına, mevcut geniş public-write politikaları nedeniyle üretimde tekrar çalıştırılmaması gerektiğini belirten güvenlik uyarısı eklendi. Bu yalnızca depo dosyasını korur; canlı Supabase'e uygulanmış bir değişiklik değildir.

- Canlı Supabase şeması, policy'ler, grant'ler, kullanıcılar, Storage nesneleri veya Auth ayarları değiştirilmedi.
- Modül 4 takip sayfasındaki stored XSS riski `textContent` tabanlı render ile giderildi; Firebase tüm sipariş koleksiyonunu istemciye indirme davranışı ayrı risk olarak belgelendi ve route açılmadı.
- İki canlı entegrasyon testinin varsayılan çalışması kapatıldı; yalnızca `RUN_LIVE_AI_TESTS=true` ile çalışırlar.
- `npm run check` ve GitHub Actions statik kalite kapısı eklendi. İlk çalışmada bulunan bozuk galeri JSON dosyası düzeltildi; sonraki statik kontrol başarılı.
- `api/photoroom-campaign.js` POST erişimi merkezi rol doğrulamasına alındı; `PHOTOROOM_API_KEY` yalnızca sunucu ortam değişkeninden okunuyor. Bu değişiklik Modül 2 dosyalarını veya onaylanmış prompt'u değiştirmedi.
- Son Photoroom API düzeltmesinden sonra GitHub Actions `Repository Quality` kontrolü başarılı oldu ve aynı commit'in Vercel production dağıtımı `READY` durumuna ulaştı.
- Modül 2 dosyaları, onaylanmış prompt ve canlı bot/yayın davranışı değiştirilmedi.
- Bu karar bilinçli: henüz doğrulanmamış harici tüketicileri kırmadan, riskli noktaları ve uygulanma sırasını kayıt altına almak.


## Denetim kapsamı düzeltmesi — etkin izinlerin doğrulanması

- `products` ve `site_settings` için yalnızca `information_schema.role_table_grants` çıktısına bakmak yeterli değildir; PostgreSQL rol kalıtımı nedeniyle `has_table_privilege` ile etkin izinler ayrıca sorgulandı.
- Etkin izin sorgusu `anon` ve `authenticated` rollerinin `products` ve `site_settings` üzerinde SELECT/INSERT/UPDATE/DELETE yetkilerine sahip olduğunu doğruladı. RLS politikaları da `TO public` ve geniş `USING/WITH CHECK (true)` ya da denylist koşullarıyla bunu destekliyor. Dolayısıyla API-01 ve API-02 bulguları doğrulanmıştır.
- `storage.objects` için de anon/authenticated rolleri INSERT/UPDATE/DELETE tablo izinlerine sahip; RLS policy'leri `media` bucket'ında belirli korunan klasörler dışındaki yollara public yazmayı/silmeyi açıyor. Bu bir uyumluluk politikası gibi görünse de izin verilen klasörler allowlist yerine denylist ile tanımlandığı için yeni klasörler varsayılan olarak korumasız kalabilir.
- Migration `202611010005_restore_module7_product_crud.sql` açıkça `GRANT SELECT, INSERT, UPDATE, DELETE TO public` ve `Public full access on products` politikasını geri getiriyor. Migration `006-009` sosyal medya ayarları ve Storage klasörlerini daraltıyor ancak ürün tablosunun public CRUD iznini kaldırmıyor.
- Bu nedenle önceki rapordaki ürün/site ayarı risk değerlendirmesi teyit edildi; Storage için ayrıca yeni bir yüksek öncelikli bulgu eklendi. Canlı DB'de bu denetim sırasında hiçbir değişiklik yapılmadı.


## Modül 4 müşteri takip sayfası

- `Module 4/takip.html` içinde sipariş geçmişi alanlarında stored XSS riski vardı; `stageName` ve `note` artık `textContent` ile DOM'a yazılıyor.
- Sayfa tüm Firebase `/siparisler.json` koleksiyonunu istemciye indirip takip koduna göre filtreliyor. Firebase Security Rules canlı konsoldan doğrulanamadığı için veri gizliliği riski koşullu fakat önemli kabul edildi.
- `/siparis-paneli` route'u henüz müşteri takip sayfasına yönlendirilmedi. Önce Firebase anonim okuma kuralları ve tek siparişe sınırlı sorgu/API modeli doğrulanmalı.


## 2 Kasım 2026 — Ürün ve site ayarı yazma yetkileri daraltıldı

Migration `public_catalog_write_restrictions` canlı Supabase projesinde başarıyla uygulandı; depo karşılığı `supabase/migrations/20261102093133_public_catalog_write_restrictions.sql`.

**Önceki etkin izinler (has_table_privilege):**
- `products`: anon ve authenticated SELECT/INSERT/UPDATE/DELETE.
- `site_settings`: anon ve authenticated SELECT/INSERT/UPDATE/DELETE.

**Migration sonrası doğrulama:**
- `products`: anon/authenticated yalnızca SELECT; service_role CRUD.
- `site_settings`: anon yalnızca SELECT; authenticated DML grant'i korunmuş durumda fakat yalnızca mevcut RLS role/key policy'leri yazmaya izin veriyor; service_role CRUD.
- `products` için tek `Public read products` SELECT policy'si var.
- `site_settings` üzerindeki üç `Legacy non-Module-1 settings insert/update/delete` policy'si kaldırıldı. Mevcut Modül 2 admin/bot/campaign policy'leri ve safe SELECT policy'si aynen korundu.
- Migration sonrası pg_policies ve etkin rol grant'leri tekrar sorgulandı. Modül 2 policy adları ve koşulları değişmedi.

**Etki sınırı:** Ürün okuma ve web kataloğu için public SELECT korunur. Modül 7 ürün yazma/silme işlemleri zaten `/api/module7` üzerinden server-side service_role kullanır. Modül 1 ürün web görünürlüğü `product_web_settings` ve CMS API akışını kullanır. Modül 1/7 site ayarı yazımları server-side API üzerinden devam eder. Modül 2 kaynak kodu, prompt, kampanya kayıtları ve bot verileri değiştirilmedi.

**Kalan test:** Gerçek admin/product_manager hesabıyla Modül 7 ekle/güncelle/sil/görsel yükle; admin/content_manager hesabıyla Modül 2 bot ayarı/kampanya yönetimi ve cron yayın akışını test et. Bu testler yapılana kadar daha fazla policy sadeleştirmesi yapılmayacak.


## Storage klasör bağımlılıkları — 2 Kasım 2026

- Canlı `media` bucket envanteri: `instagram` 19, `photoroom` 4, `posts` 23, `products` 8, `samples` 2, `showroom` 3 ve `stories` 24 nesne.
- Modül 1 upload yardımcı fonksiyonu `urunler/`, `anasayfa/`, `galeri/`, `blog/`, `tedarikciler/` yollarını kullanıyor; bunlar mevcut korumalı klasör listesinde.
- Modül 7 API `products/` yoluna service_role ile yüklüyor. Kök Gemini Banana motoru `products/`, `posts/`, `stories/` yollarına service_role ile yazıyor.
- Dondurulmuş `Module 2/photoroom-engine.js` `photoroom/`, `posts/`, `stories/` yollarına yazıyor; yapılandırmasında `SUPABASE_KEY` için anon anahtar fallback'i bulunuyor. Üretimde hangi anahtarın kullanıldığı ve bu motorun nerede çağrıldığı doğrulanmadan `photoroom/` public write erişimini kapatmak Modül 2'yi bozabilir.
- `samples/` ve `showroom/` için depo içinde yazıcı bulunamadı; canlı nesneler mevcut olduğundan harici yazıcı kaynağı henüz bilinmiyor.
- Karar: Storage policy'lerine bu adımda dokunulmadı. Public write denylist'ten allowlist'e geçiş için önce bu iki klasörün ve Modül 2 Photoroom anahtarının kaynağı netleştirilmeli.

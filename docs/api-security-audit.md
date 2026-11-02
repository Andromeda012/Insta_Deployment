# API ve Supabase Güvenlik Denetimi

**Tarih:** 2 Kasım 2026  
**Kapsam:** Vercel `api/` uçları, ortak kimlik doğrulama yardımcıları, canlı Supabase RLS/grant/policy durumu, kök kurulum SQL'i.  
**Koruma sınırı:** `Module 2/`, onaylanmış Bahar Portmanto prompt'u ve mevcut yayın motoru değiştirilmedi. Canlı veritabanında bu denetim kapsamında hiçbir yazma/DDL işlemi yapılmadı.

## Yönetici özeti

Mevcut sistemde merkezi API kimlik doğrulaması doğru yönde kurulmuş olsa da canlı veritabanında eski ve geniş yetkili politikalar hâlâ bulunuyor. En önemli risk, ürün tablosundaki herkese açık yazma politikası ve `site_settings` üzerindeki eski, denylist tabanlı yazma politikalarıdır. Ayrıca bazı eski/entegrasyon endpoint'leri kimlik doğrulamasız biçimde ayrıcalıklı işlemler yapabiliyor.

Bunları doğrudan canlıda kapatmak, bilinmeyen harici entegrasyonları veya dondurulmuş Modül 2 akışlarını bozabileceğinden bu turda uygulanmadı. Güvenli sonraki adımlar ve engeller aşağıda kayıt altına alındı.

## Bulgular

### Yüksek öncelik

| ID | Bulgu | Kanıt / etki | Bu turdaki karar |
|---|---|---|---|
| API-01 | `public.products` tablosunda `Public full access on products` politikası `TO public USING (true) WITH CHECK (true)` olarak etkin; ayrıca `public` rolüne INSERT/UPDATE/DELETE grant'i var. | Anonim istemciye yalnızca katalog okuma değil, ürün verisini değiştirme/silme imkânı verebilir. | Canlı RLS/grant değiştirilmedi. Modül 7'nin yazma akışı `/api/module7` üzerinden, server-side service-role ile çalışıyor; ancak tüm harici yazıcılar ve gerçek yetkili kullanıcı akışı henüz kanıtlanmadı. |
| API-02 | `site_settings` üzerinde `Legacy non-Module-1 settings insert/update/delete` politikaları `TO public` ve yalnızca bazı anahtarları dışlayan denylist kullanıyor. Tabloya public INSERT/UPDATE/DELETE grant'i de mevcut. | İzin listesine alınmamış bazı site ayarları anonim yazmaya açık kalabilir. Korunan anahtarlar hariç yeni/unutulmuş anahtarlar da risk oluşturabilir. | Bot/kampanya ve eski entegrasyon bağımlılıkları nedeniyle canlı politika değiştirilmedi. Önce tüm istemci ve servis yazıcıları doğrulanmalı. |
| API-03 | `api/photoroom-campaign.js` POST yolu rol doğrulaması yapmadan kök Photoroom motorunu çağırıyor; motor Supabase service-role ile Storage ve `site_settings` üzerinde yazabiliyor. | Endpoint'e erişebilen anonim bir çağıran ayrıcalıklı kampanya işlemi başlatabilir. CORS'un `*` olması tek başına yetki açığı değildir; asıl sorun sunucu tarafı kimlik doğrulamasının olmamasıdır. | Depo içi çağrı bulunamadı; GitHub kod araması ve kısa Vercel log penceresi harici tüketici olmadığını kanıtlamaz. Çağıran doğrulanmadan endpoint kapatılmadı veya auth zorunlu kılınmadı. |
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
2. **Ürün tablosu:** Modül 7 gerçek admin/product_manager hesabıyla katalog okuma, ekleme, güncelleme, silme ve görsel yükleme testlerinden geçirilecek. Harici yazıcı kalmadığı doğrulanınca public write grant/policy kaldırılıp yalnızca public SELECT ve server-side service-role yazımı bırakılacak.
3. **Site ayarları:** Anahtar bazlı mevcut erişim matrisi çıkarılacak. Public denylist yazma politikaları, gerekiyorsa admin rolüne bağlı allowlist ve server-side service-role yazımıyla değiştirilecek. Modül 2'nin mevcut verileri ve kullanıcı akışı korunmadan bu adım uygulanmayacak.
4. **Eski ayrıcalıklı endpoint'ler:** `api/photoroom-campaign.js` ve `api/render.js` için tüketici/çağıran belirlenip uygun Supabase rol doğrulaması veya sunucu-servis imzası eklenecek. Bilinmeyen harici çağrılar kesilmeden endpoint kapatılmayacak.
5. **Webhook imzaları:** Modül 2 kapsamı yeniden açıldığında Meta/TikTok/YouTube sağlayıcı imzaları ham request body üzerinden doğrulanacak; simülasyon çağrıları ayrı ve yetkili test yoluna taşınacak.
6. **Auth ayarı:** Leaked-password protection Supabase Dashboard'da açılacak; ardından giriş akışı kontrollü test edilecek.
7. **Policy/index temizliği:** Yetki matrisi sabitlendikten sonra redundant permissive policy'ler birleştirilecek; kullanılmayan index'ler ancak gerçek sorgu istatistikleriyle teyit edilirse kaldırılacak.

## Bu turda yapılan değişiklikler

- Kök `supabase_setup.sql` dosyasının başına, mevcut geniş public-write politikaları nedeniyle üretimde tekrar çalıştırılmaması gerektiğini belirten güvenlik uyarısı eklendi. Bu yalnızca depo dosyasını korur; canlı Supabase'e uygulanmış bir değişiklik değildir.

- Canlı Supabase şeması, policy'ler, grant'ler, kullanıcılar, Storage nesneleri veya Auth ayarları değiştirilmedi.
- Modül 4 takip sayfasındaki stored XSS riski `textContent` tabanlı render ile giderildi; Firebase tüm sipariş koleksiyonunu istemciye indirme davranışı ayrı risk olarak belgelendi ve route açılmadı.
- İki canlı entegrasyon testinin varsayılan çalışması kapatıldı; yalnızca `RUN_LIVE_AI_TESTS=true` ile çalışırlar.
- `npm run check` ve GitHub Actions statik kalite kapısı eklendi. İlk çalışmada bulunan bozuk galeri JSON dosyası düzeltildi; sonraki statik kontrol başarılı.
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

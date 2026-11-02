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
| API-04 | `api/render.js` GET/POST üzerinden render işlemi yapıyor ve yapılandırmaya göre service-role anahtarıyla `media` Storage alanına yükleyebiliyor; handler'da merkezi rol doğrulaması görünmüyor. | Açık render/upload yüzeyi maliyet, kaynak tüketimi ve depolama kötüye kullanımı doğurabilir. | Endpoint'in harici tüketicisi ve beklenen erişim modeli netleşmeden auth eklenmedi; aksi hâlde çalışan entegrasyon kırılabilir. |

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

- Yalnızca bu denetim raporu ve depo temizlik envanteri güncellendi.
- Canlı Supabase şeması, policy'ler, grant'ler, kullanıcılar, Storage nesneleri veya Auth ayarları değiştirilmedi.
- API endpoint kodu, Modül 2 dosyaları, yayın prompt'u ve canlı veri akışları değiştirilmedi.
- Bu karar bilinçli: henüz doğrulanmamış harici tüketicileri kırmadan, riskli noktaları ve uygulanma sırasını kayıt altına almak.

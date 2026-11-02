# Canlı Supabase Veri Erişim Matrisi

**Denetim tarihi:** 2 Kasım 2026  
**Proje:** `vrfujrpsjzqjthaqdalx`  
**Yöntem:** `pg_policies`, etkin rol izinleri (`has_table_privilege`) ve canlı migration dosyalarının karşılaştırılması.  
**Not:** Bu belge canlı Supabase erişim yapılandırmasını ve uygulanan değişiklikleri kaydeder. Storage nesnelerinin kendisi değiştirilmedi.

## Tablo erişimleri

| Kaynak | Anonim (`anon`) | Oturum açmış (`authenticated`) | Sunucu (`service_role`) | Değerlendirme |
|---|---|---|---|---|
| `public.products` | SELECT | SELECT | CRUD | **Düzeltildi (2 Kasım 2026):** Public full-access policy kaldırıldı; anon/authenticated için yalnızca SELECT policy ve grant kaldı. Yazma yalnızca `service_role` üzerinden. Modül 7 ürün yazma/silme işlemleri `/api/module7` üzerinden yürütülüyor. |
| `public.site_settings` | SELECT (RLS safe-key listesi) | SELECT + RLS ile sınırlandırılmış DML | CRUD | **Düzeltildi (2 Kasım 2026):** Eski public denylist INSERT/UPDATE/DELETE policy'leri kaldırıldı; anon DML grant'leri iptal edildi. Authenticated DML grant'i korunuyor ancak yalnızca mevcut Modül 2 admin/content_manager key policy'leri yazmaya izin veriyor. Modül 1/7 sunucu API'leri service_role kullanıyor. |
| `public.product_web_settings` | SELECT | SELECT | CRUD | CMS köprüsü için makul ayrım: tarayıcı okur, CMS API service-role ile yazar. |
| `public.content_revisions` | Erişim yok | Erişim yok | CRUD | RLS açık, kullanıcı policy'si yok; service-role sunucu akışı için uygun görünüyor. |
| `public.publication_logs` | Erişim yok | Erişim yok | CRUD | RLS açık, kullanıcı policy'si yok; service-role sunucu akışı için uygun görünüyor. |

## Storage — `media` bucket

| İşlem | Anonim | Oturum açmış | Mevcut kural |
|---|---|---|---|
| SELECT | Evet | Evet | Bucket genelinde public read policy. |
| INSERT | Evet, bazı klasörler hariç | Evet, bazı klasörlerde rol kontrollü | Public policy korunan klasör adlarını hariç tutuyor. 2 Kasım 2026 tarihli `protect_products_storage_folder` migration'ı ile `products` da INSERT/UPDATE/DELETE denylist'ine eklendi. `photoroom`, `samples` ve `showroom` henüz public write denylist'inde değil. `instagram` (19), `posts` (23), `products` (8), `stories` (24), `photoroom` (4), `samples` (2), `showroom` (3) nesneleri mevcut. Modül 1/2 yöneticileri kendi korunan klasörlerine yükleyebilir. |
| UPDATE | Evet, bazı klasörler hariç | Evet, bazı klasörlerde rol kontrollü | INSERT ile benzer denylist mantığı. |
| DELETE | Evet, bazı klasörler hariç | Evet, bazı klasörlerde rol kontrollü | INSERT ile benzer denylist mantığı. |

**Önemli ayrıntı:** Public Storage yazma politikaları hâlâ bir allowlist değil, denylist kullanıyor. Korunan klasör listesine eklenmemiş yeni bir klasör açılırsa public write erişimi varsayılan olarak açılabilir. Depo kodu incelemesinde Modül 1 `urunler/`, `anasayfa/`, `galeri/`, `blog/`, `tedarikciler/` yollarını kullanıyor. Modül 7 API ve kök Gemini motoru `products/`, `posts/`, `stories/` yollarına service-role ile yazıyor. Vercel Production değişken envanterinde `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` ve `SUPABASE_URL` bulundu; `SUPABASE_KEY` bulunamadı. Bu nedenle `Module 2/photoroom-engine.js` varsayılan anonim anahtara düşüyor. Dondurulmuş `Module 2/photoroom-engine.js` ise `photoroom/`, `posts/`, `stories/` yollarına yazıyor ve varsayılan yapılandırmasında anon anahtara düşebiliyor. Bu nedenle `photoroom/` klasörünü korumaya almak, üretimde service-role yapılandırması yoksa Modül 2 akışını bozabilir. `samples/` ve `showroom/` için depo içi yazıcı bulunamadı; harici tüketici kaynağı bilinmiyor. Bu nedenle `photoroom/` policy'si değiştirilmedi. `products/` için ayrı bir güvenlik daraltması uygulandı.

## Yetki sınırları ve önerilen hedef

1. Ürün master verisinin sahibi Modül 7 olmalı; tarayıcıdan doğrudan Supabase CRUD yerine `api/module7.js` ve merkezi rol kontrolü kullanılmalı.
2. Ürün tablosunda public SELECT korunmalı; public INSERT/UPDATE/DELETE kaldırılmalı. Yazma yalnızca server-side service-role API'si üzerinden yapılmalı.
3. `site_settings` için public yazma denylist'i yerine anahtar bazlı dar allowlist veya tamamen server-side yazım tercih edilmeli. Modül 2'nin `social_campaign_assets` ve bot state akışları ayrıca korunmalı.
4. Storage'da public read gereksinimi ayrı tutulmalı; upload/update/delete için denylist yerine klasör allowlist'i ve rol doğrulaması hedeflenmeli.
5. Her değişiklik öncesi Modül 1/2/7 gerçek yetkili hesapla ve anonim isteklerle test edilmeli; geri dönüş migration'ı hazırlanmalı.

## Uygulanan değişiklik — 2 Kasım 2026

Migration `public_catalog_write_restrictions` canlı Supabase projesine uygulandı. Depodaki karşılığı `supabase/migrations/20261102093133_public_catalog_write_restrictions.sql` dosyasıdır.

- `products`: `Public full access on products` policy kaldırıldı. Anon/authenticated yalnızca SELECT yapabilir; INSERT/UPDATE/DELETE yalnızca `service_role` için kaldı.
- `site_settings`: üç eski public denylist yazma policy'si kaldırıldı. Anon INSERT/UPDATE/DELETE grant'leri iptal edildi. Authenticated DML grant'i korundu; RLS'de mevcut Modül 2 `admin`/`content_manager` ve anahtar bazlı policy'ler değiştirilmedi.
- `site_settings` public-safe SELECT policy'si ve `products` public read policy'si korundu.
- Canlı `has_table_privilege` sorgusuyla izinler yeniden doğrulandı. Modül 2 policy envanteri değişmeden kaldı.

Storage policy'leri ve Auth ayarları bu adımda değiştirilmedi.


## Storage klasörlerinin canlı kullanım envanteri — 2 Kasım 2026

| Klasör | Canlı nesne | Depo içi kullanım | Güvenli karar |
|---|---:|---|---|
| `instagram` | 19 | Varsayılan Reels medyası; Modül 2 yayın varlıkları | Modül 2 kapsamı korunur |
| `posts` | 23 | Kök ve Modül 2 Gemini/Photoroom motorları | Korunan klasör olarak kalır |
| `stories` | 24 | Kök ve Modül 2 Gemini/Photoroom motorları | Korunan klasör olarak kalır |
| `products` | 8 | Modül 7 API ve kök Gemini motoru | 2 Kasım 2026: public INSERT/UPDATE/DELETE engellendi; public read korundu; service-role yazımı devam eder |
| `photoroom` | 4 | Modül 2 Photoroom motoru; anon fallback anahtarı mevcut | Modül 2 dondurulmuş; service-role yapılandırması doğrulanmadan public write kapatılmaz |
| `samples` | 2 | Depo içi yazıcı bulunamadı | Harici tüketici araştırılmalı |
| `showroom` | 3 | Depo içi yazıcı bulunamadı | Harici tüketici araştırılmalı |

Canlı nesne sorgusunda en son oluşturulma zamanları: `posts` ve `stories` 2 Kasım 2026; `products`, `instagram`, `photoroom`, `samples` 31 Ekim 2026; `showroom` 29 Ekim 2026. Hiçbir Storage nesnesi silinmedi veya değiştirilmedi.

## Uygulanan Storage değişikliği — 2 Kasım 2026

Migration `protect_products_storage_folder` canlı Supabase projesine uygulandı; depodaki karşılığı `supabase/migrations/20261102110000_protect_products_storage_folder.sql`.

- `media` bucket'ında `products/` için public INSERT, UPDATE ve DELETE policy erişimi kaldırıldı.
- Public SELECT policy'si değişmedi; mevcut ürün görselleri herkese açık okunabilir durumda.
- `service_role` kullanan Modül 7 API ve kök motor yüklemeleri bu değişiklikten etkilenmez.
- `photoroom/`, `samples/` ve `showroom/` değiştirilmedi.
- Modül 2 policy'leri ve kaynak kodu değiştirilmedi.
- Canlı `pg_policies` sorgusu üç public write policy'sinin de `products` klasörünü hariç tuttuğunu doğruladı.

## Photoroom motor ayrımı ve kalan doğrulama — 2 Kasım 2026

Photoroom tarafında iki ayrı motor dosyası bulunuyor ve yetki davranışları aynı değil:

- Kök dizindeki `photoroom-engine.js`, `SUPABASE_SERVICE_ROLE_KEY` kullanacak şekilde yapılandırılmış. `api/photoroom-campaign.js` bu motoru sunucu tarafında çağırıyor; POST isteği `admin` veya `product_manager` rolüyle sınırlandırılmış. Bu akışta ürün kataloğu okuması anon anahtarla yapılabiliyor çünkü `products` public SELECT korunuyor; medya ve kampanya yazımı kök motorun service-role yapılandırmasına dayanıyor.
- `Module 2/photoroom-engine.js` ayrı bir kopya ve kendi varsayılan yapılandırmasında anon anahtara düşüyor. Bu kopyanın depodaki çağrı noktası doğrulanamadı; Modül 2'nin dondurulmuş kapsamı nedeniyle dosya ve prompt değiştirilmedi.
- Bu nedenle `photoroom/` klasörünün public yazma izni henüz kaldırılmadı. Kök API akışı service-role ile çalışabilecek olsa da, Modül 2 kopyasının veya depo dışındaki bir çalıştırıcının anon yazmaya bağımlı olup olmadığı kesinleşmeden politika değişikliği yapılmayacak.
- `samples/` ve `showroom/` klasörlerinde de depo içi yazıcı bulunamadı; harici tüketici doğrulanana kadar mevcut izinler ve nesneler korunacak.

Bu incelemede canlı tablo/Storage politikası değiştirilmedi ve Storage nesnelerine dokunulmadı. Sonraki güvenli adım, Modül 2 motorunun fiilî çalışma noktasını (Vercel route, harici worker veya yerel servis) doğrulayıp gerekiyorsa ayrı bir sunucu tarafı yazma köprüsü tasarlamaktır.

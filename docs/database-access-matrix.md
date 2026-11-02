# Canlı Supabase Veri Erişim Matrisi

**Denetim tarihi:** 2 Kasım 2026  
**Proje:** `vrfujrpsjzqjthaqdalx`  
**Yöntem:** `pg_policies`, etkin rol izinleri (`has_table_privilege`) ve canlı migration dosyalarının karşılaştırılması.  
**Not:** Bu belge yalnızca mevcut durumu kaydeder. Bu denetim sırasında canlı şemaya, grant'lere, policy'lere veya Storage nesnelerine yazılmadı.

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
| INSERT | Evet, bazı klasörler hariç | Evet, bazı klasörlerde rol kontrollü | Public policy yalnızca korunan klasör adlarını hariç tutuyor; `urunler`, `anasayfa`, `galeri`, `blog`, `tedarikciler`, `instagram`, `facebook`, `tiktok`, `youtube`, `posts`, `stories` korunmuş. Modül 1/2 yöneticileri kendi korunan klasörlerine yükleyebilir. |
| UPDATE | Evet, bazı klasörler hariç | Evet, bazı klasörlerde rol kontrollü | INSERT ile benzer denylist mantığı. |
| DELETE | Evet, bazı klasörler hariç | Evet, bazı klasörlerde rol kontrollü | INSERT ile benzer denylist mantığı. |

**Önemli ayrıntı:** Public Storage yazma politikaları bir allowlist değil, denylist kullanıyor. Korunan klasör listesine eklenmemiş yeni bir klasör açılırsa public write erişimi varsayılan olarak açılabilir. Bu nedenle yeni medya klasörleri oluşturulmadan önce policy envanteri güncellenmeli.

## Yetki sınırları ve önerilen hedef

1. Ürün master verisinin sahibi Modül 7 olmalı; tarayıcıdan doğrudan Supabase CRUD yerine `api/module7.js` ve merkezi rol kontrolü kullanılmalı.
2. Ürün tablosunda public SELECT korunmalı; public INSERT/UPDATE/DELETE kaldırılmalı. Yazma yalnızca server-side service-role API'si üzerinden yapılmalı.
3. `site_settings` için public yazma denylist'i yerine anahtar bazlı dar allowlist veya tamamen server-side yazım tercih edilmeli. Modül 2'nin `social_campaign_assets` ve bot state akışları ayrıca korunmalı.
4. Storage'da public read gereksinimi ayrı tutulmalı; upload/update/delete için denylist yerine klasör allowlist'i ve rol doğrulaması hedeflenmeli.
5. Her değişiklik öncesi Modül 1/2/7 gerçek yetkili hesapla ve anonim isteklerle test edilmeli; geri dönüş migration'ı hazırlanmalı.

## Uygulanan değişiklik — 2 Kasım 2026

Migration `public_catalog_write_restrictions` canlı Supabase projesine uygulandı. Depodaki karşılığı `supabase/migrations/202611020001_public_catalog_write_restrictions.sql` dosyasıdır.

- `products`: `Public full access on products` policy kaldırıldı. Anon/authenticated yalnızca SELECT yapabilir; INSERT/UPDATE/DELETE yalnızca `service_role` için kaldı.
- `site_settings`: üç eski public denylist yazma policy'si kaldırıldı. Anon INSERT/UPDATE/DELETE grant'leri iptal edildi. Authenticated DML grant'i korundu; RLS'de mevcut Modül 2 `admin`/`content_manager` ve anahtar bazlı policy'ler değiştirilmedi.
- `site_settings` public-safe SELECT policy'si ve `products` public read policy'si korundu.
- Canlı `has_table_privilege` sorgusuyla izinler yeniden doğrulandı. Modül 2 policy envanteri değişmeden kaldı.

Storage policy'leri ve Auth ayarları bu adımda değiştirilmedi.

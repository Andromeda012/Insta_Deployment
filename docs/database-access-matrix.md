# Canlı Supabase Veri Erişim Matrisi

**Denetim tarihi:** 2 Kasım 2026  
**Proje:** `vrfujrpsjzqjthaqdalx`  
**Yöntem:** `pg_policies`, etkin rol izinleri (`has_table_privilege`) ve canlı migration dosyalarının karşılaştırılması.  
**Not:** Bu belge yalnızca mevcut durumu kaydeder. Bu denetim sırasında canlı şemaya, grant'lere, policy'lere veya Storage nesnelerine yazılmadı.

## Tablo erişimleri

| Kaynak | Anonim (`anon`) | Oturum açmış (`authenticated`) | Sunucu (`service_role`) | Değerlendirme |
|---|---|---|---|---|
| `public.products` | SELECT / INSERT / UPDATE / DELETE | SELECT / INSERT / UPDATE / DELETE | CRUD | **Yüksek risk.** `Public full access on products` policy'si `TO public`, `USING (true)`, `WITH CHECK (true)`. Migration `005_restore_module7_product_crud.sql` public CRUD grant'ini açıkça geri getiriyor. |
| `public.site_settings` | SELECT / INSERT / UPDATE / DELETE | SELECT / INSERT / UPDATE / DELETE | CRUD | **Yüksek risk.** Public yazma policy'leri birkaç anahtarı denylist ile hariç tutuyor. Yeni veya unutulmuş anahtarlar varsayılan olarak public yazmaya açık kalabilir. |
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

## Uygulanmayan değişiklikler

Bu turda canlı RLS, GRANT/REVOKE, Storage policy veya Auth ayarı değiştirilmedi. Çünkü Modül 2'nin kampanya/bot verileri ve bilinmeyen harici yazıcılar için uyumluluk testi henüz tamamlanmadı. Güvenli geçiş, bağımlılık envanteri ve staging doğrulamasından sonra ayrı migration olarak uygulanmalı.

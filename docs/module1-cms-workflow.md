# Modül 1 CMS — Taslak, Önizleme ve Yayınlama

Bu aşama, mevcut canlı içerik tablolarını değiştirmeden taslak/yayın katmanını ekler.

## Akış
1. Yetkili kullanıcı Supabase Auth ile oturum açar.
2. CMS API, access token'ı Supabase Auth üzerinden doğrular ve yalnızca `app_metadata.role` değeri `admin` veya `content_manager` olan kullanıcıları kabul eder.
3. Düzenlemeler `content_revisions` tablosuna taslak olarak yazılır.
4. Önizleme taslak snapshot'ını kullanır; canlı tablolar değişmez.
5. Yayınlama, `publish_content_revision` fonksiyonu ile tek veritabanı işlemi içinde canlı tabloya aktarılır ve `publication_logs` kaydı oluşturulur.

## Desteklenen taslak türleri
- `blog`
- `gallery`
- `supplier`
- `site_setting`
- `product_web_settings` (Modül 7 ürün ana verisini değiştirmez)

## Gerekli Vercel ortam değişkenleri
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — yalnızca server-side; tarayıcıya kesinlikle gönderilmez.

## Kurulum notları
- SQL migration: `supabase/migrations/202611010001_module1_cms_workflow.sql`
- Bu migration mevcut `supabase_setup.sql` dosyasının yerine geçmez ve o eski dosya tekrar çalıştırılmamalıdır.
- Migration henüz veritabanına uygulanmadı. Önce preview ortamında test edilmelidir.
- Supabase Auth yönetici hesabı ve `app_metadata.role` ataması tamamlanmadan API 401/403 döndürür; bu beklenen güvenli davranıştır.
- Mevcut Modül 1 form kaydetme fonksiyonları henüz bu API'ye geçirilmedi. Bu dosyalar altyapı katmanını sağlar; canlı yazma davranışı değiştirilmeden önce form bazlı entegrasyon ve test yapılmalıdır.

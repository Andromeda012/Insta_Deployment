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

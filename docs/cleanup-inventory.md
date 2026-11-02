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


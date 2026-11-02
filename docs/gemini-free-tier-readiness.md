# Gemini API — Ücretsiz Katman Hazırlığı

## Karar

İlk entegrasyon aşamasında Gemini API için ücretli kullanıma geçilmeyecek. Metin üretimi ve içerik açıklaması testleri, Google AI Studio'da ilgili proje/model için ücretsiz katman kullanılabilir olduğu sürece ücretsiz katman üzerinden yürütülecek.

Bu hazırlık, ücretli görsel üretim modelini veya ücretli video üretimini etkinleştirmez. Ücretsiz katman limitleri model, bölge ve hesap/proje uygunluğuna göre değişebilir; kod tarafında ücretsiz kullanım garantisi verilemez. Limit aşılırsa istek başarısız kabul edilmeli, otomatik olarak ücretli bir modele geçilmemelidir.

## Depo denetiminde görülen mevcut durum

- `Module 2/nova-studio-engine.js` içindeki `generateGeminiLuxuryCaption` fonksiyonu metin üretimi için varsayılan olarak `gemini-2.5-flash` modelini kullanıyor. Bu, metin üretimi için ücretsiz katman uygunluğu kontrol edilerek kullanılabilecek ayrı bir akıştır.
- Aynı fonksiyon API anahtarını URL query string'ine ekliyor ve tarayıcı tarafında çalışabilecek biçimde yazılmış. Bu yöntem üretim için güvenli kabul edilmemeli. API anahtarı sunucu tarafında tutulmalı ve istek `x-goog-api-key` başlığıyla sunucu tarafından yapılmalı. Bu dosyanın mevcut istemci çağrı sözleşmesi doğrulanmadan doğrudan değiştirilmemelidir.
- `Module 2/gemini-banana-engine.js` görsel düzenleme/üretim bekleyen bir akış içeriyor; ancak çağrısı `gemini-1.5-flash:generateContent` modeline gidiyor ve yanıtı görsel verisi gibi okumaya çalışıyor. Bu model çağrısı gerçek bir görsel üretim entegrasyonu olarak kabul edilemez. Ücretsiz metin modeline çevrilerek görsel üretim varmış gibi gösterilmemelidir.
- Onaylı Bahar Portmanto ana promptu korunacaktır. Bu hazırlıkta prompt metni değiştirilmemiştir.

## Ücretsiz aşamada izin verilen kapsam

1. Gemini ile kısa metin/açıklama üretimi.
2. Modelin kullanılabilirliğini ve kota/429 yanıtlarını kontrollü test etme.
3. API anahtarının yalnızca sunucu ortam değişkeninde tutulması.
4. Ücretsiz kota bittiğinde açık hata/fallback gösterilmesi; ücretli modele otomatik geçiş yapılmaması.

## Ücretli plan açılana kadar kapalı tutulacak kapsam

- Nano Banana / Gemini görsel üretimi ve görsel düzenleme.
- Veo veya başka ücretli video üretim API'leri.
- Ücretsiz katman dışındaki model/özelliklere otomatik fallback.

## Güvenli entegrasyon koşulları

- Anahtar adı: `GEMINI_API_KEY`; yalnızca sunucu ortam değişkeni.
- İstemciye API anahtarı veya Google API çağrısı için doğrudan anahtar gönderilmez.
- Metin üretimi için sunucu API katmanı kullanılmalı; Module 2 yönetici yetkisiyle korunmalı.
- Model varsayılanı açıkça `gemini-2.5-flash` olmalı; ücretli modele otomatik geçiş yapılmamalı.
- İstek hatalarında HTTP durum kodu ve güvenli hata özeti loglanmalı; anahtar, prompt içindeki hassas veri veya tam sağlayıcı hata gövdesi loglanmamalı.
- Gerçek üretim testi yalnızca kullanıcı açıkça istediğinde yapılmalı; canlı ürün verisi ve Storage'a yazma yapılmamalı.

## Yayın notu

Bu belge yalnızca hazırlık ve teknik karar kaydıdır. `gemini-free-tier-prep` dalında tutulur; `main` dalına birleştirilmediği ve Vercel'e dağıtılmadığı sürece mevcut canlı siteyi değiştirmez.

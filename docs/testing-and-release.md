# Test ve Yayın Kontrol Standardı

## Varsayılan statik kontrol

Her geliştirme değişikliğinden önce ve sonra:

```bash
npm run check
```

Bu komut Git tarafından izlenen JSON dosyalarını parse eder, JavaScript/CommonJS/ESM sözdizimini kontrol eder, Supabase migration adlandırma standardını denetler ve gerçek `.env` dosyalarının Git'e eklenmesini engeller.

GitHub Actions aynı kontrolü `main` push ve pull request'lerinde çalıştırır.

## Canlı entegrasyon testleri

`tests/` klasöründeki iki eski entegrasyon testi gerçek Gemini görsel üretimi, Supabase Storage erişimi ve ağ çağrıları yapabilir. Bu testler varsayılan olarak çalışmaz.

Yalnızca test ortamı, API anahtarları, maliyet ve veri etkisi bilinçli biçimde onaylandığında:

Linux/macOS:

```bash
RUN_LIVE_AI_TESTS=true node tests/test_gemini_banana.cjs
RUN_LIVE_AI_TESTS=true node tests/test_verification_suite.cjs
```

Windows PowerShell:

```powershell
$env:RUN_LIVE_AI_TESTS="true"
node tests/test_gemini_banana.cjs
node tests/test_verification_suite.cjs
Remove-Item Env:RUN_LIVE_AI_TESTS
```

Bu testler statik CI işine bağlanmaz; üretim verisine veya ücretli API'ye erişebilecekleri için yalnızca kontrollü manuel doğrulama olarak kalırlar.

## Yayın öncesi kontrol listesi

1. `npm run check` başarılı.
2. Değişiklikle ilgili modülün manuel işlev testi tamam.
3. Vercel dağıtımı `READY`.
4. İlgili API/route için smoke test başarılı.
5. Supabase migration gerekiyorsa önce staging veya güvenli doğrulama ortamında test edildi.
6. Modül 2 kapsamı açılmadıkça bot davranışı ve onaylı prompt değişmedi.

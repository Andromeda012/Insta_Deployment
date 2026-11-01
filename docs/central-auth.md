# Merkezi Kimlik Doğrulama — Global Mobilya

## Mimari

- Ana platform oturumu Supabase Auth tarafından yönetilir.
- Ana kabuk, Modül 1, Modül 2 ve Modül 7 aynı Supabase proje kimliğini ve aynı auth storage anahtarını kullanır: `sb-vrfujrpsjzqjthaqdalx-auth-token`.
- İstemci modülleri yalnızca publishable/anon anahtarı kullanır. `service_role` anahtarı yalnızca Vercel sunucu fonksiyonlarında kalır.
- Sunucu API'leri Bearer access token'ı Supabase Auth `/auth/v1/user` endpoint'inde doğrular ve yetkiyi `app_metadata` üzerinden denetler.
- Yetkilendirme `user_metadata` üzerinden yapılmaz.

## Cihaz oturumu tercihi

Giriş ekranındaki **Bu cihazda oturumu açık tut** seçeneği:

- Seçili: Supabase oturumu `localStorage` içinde tutulur; tarayıcı yeniden başlatıldıktan sonra da geçerli oturum geri yüklenebilir.
- Seçili değil: Oturum `sessionStorage` içinde tutulur; normalde ilgili sekme/oturum kapandığında kalıcı depoda bırakılmaz.
- Tercih işareti `gm_auth_remember_device` anahtarıyla saklanır. Oturum token'ı Supabase'in kendi refresh-token mekanizmasıyla yönetilir.
- Çıkışta oturum kapatılır ve her iki depodaki token anahtarı temizlenir.
- Supabase Auth oturum ömrü, JWT ömrü ve varsa inactivity/time-box ayarları geçerliliğini korur. “Açık tut” bu güvenlik sınırlarını aşmaz.

Paylaşılan veya ortak kullanılan bilgisayarlarda kutu işaretlenmemelidir.

## Roller

İlk aşama için üç rol:

| Rol | Erişim |
|---|---|
| `admin` | Tüm modüller ve platform yönetimi |
| `product_manager` | Dashboard ve Modül 7 ürün yönetimi |
| `content_manager` | Dashboard, Modül 1 CMS ve Modül 2 sosyal medya yönetimi |

İleride aynı kullanıcıya birden fazla rol verilebilir. Tercih edilen claim `app_metadata.roles` dizisidir:

```json
{
  "roles": ["product_manager", "content_manager"]
}
```

Geriye dönük uyumluluk için `app_metadata.role` tekil alanı da kabul edilir. Yetki bilgisi yalnızca güvenilir sunucu/admin işlemiyle değiştirilmelidir; kullanıcı tarafından düzenlenebilen `user_metadata` kullanılmamalıdır.

## Uygulanan noktalar

- Ana platformda merkezi giriş ekranı ve güvenli çıkış.
- Simüle edilmiş rol seçicinin kaldırılması.
- Ana menüde rol bazlı modül görünürlüğü ve route kontrolü.
- Modül 1, Modül 2 (Instagram, Facebook, TikTok, YouTube Shorts) ve Modül 7 istemcilerinde aynı oturum deposu.
- Modül 1 ve Modül 7 istemci tarafında hem `roles` hem eski `role` claim'ini kabul eder.
- Ortak API yetkilendirme yardımcısı birden fazla role izin verir.

## Yayına alma öncesi kontrol

1. Supabase Auth'ta kullanıcı hesabı oluşturun.
2. Kullanıcının `app_metadata.roles` alanına uygun rol/rolleri güvenilir admin işlemiyle atayın.
3. Ana platformda ilk girişi deneyin; önce kutu kapalı, sonra açık oturum davranışını ayrı ayrı test edin.
4. Modül 1 CMS, Modül 2 kuyruk/state işlemleri ve Modül 7 ürün CRUD/medya yüklemesini gerçek yetkili hesapla doğrulayın.
5. Ortak bilgisayarlarda kalıcı oturum seçeneğini kullanmayın.

Not: Mevcut Supabase kullanıcı sayısı daha önce sıfır olarak görülmüştü. Bu nedenle gerçek kullanıcıyla uçtan uca oturum ve rol testi yapılmadan üretim güvenliği tamamlanmış sayılmaz. Mevcut RLS/storage politikaları bu değişiklik kapsamında gevşetilmedi veya değiştirilmedi.

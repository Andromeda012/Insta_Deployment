# GLOBAL MOBİLYA — MODÜL 8: SUPABASE STORAGE & PRODUCTION JOB QUEUE ENTEGRASYON RAPORU

**Tarih:** 8 Kasım 2026  
**Kapsam:** Modül 8 (3D Render & Creative Production Studio) — Supabase Storage & Production Job Queue Entegrasyonu  
**Hedef Ortam:** DigitalOcean Ubuntu VPS (`nova_render_worker` Docker Container, Blender 4.2 Cycles CPU) + Supabase (`media` Bucket & PostgreSQL) + Vercel (`api/module8.js`)

---

## 1. Mevcut Mimari Analizi

Entegrasyon öncesinde yapılan kod tabanı ve veritabanı incelemesinde aşağıdaki mimari yapı tespit edilmiştir:

1. **Veritabanı ve Kuyruk Yapısı:**
   - Modül 2 (`Sunucu/02_social_publish_queue.sql`) içerisinde `social_publish_queue` tablosu ve `FOR UPDATE SKIP LOCKED` kullanan `claim_next_publish_task` RPC fonksiyonu bulunmaktadır. Bu yapı sosyal medya yayınlayıcısına (`nova-publisher`) aittir ve korunmuştur.
   - Modül 8 için `supabase/migrations/20261108180000_module8_creative_production_studio.sql` içerisinde `public.production_jobs`, `public.media_assets`, `public.production_outputs`, `public.production_events` ve `public.production_costs` tabloları tanımlanmıştır. Ayrıca ilişkisel migration henüz çalıştırılmamış ortamlarda dahi kesintisiz çalışabilmesi için `api/module8.js` üzerinde `site_settings` (`key = 'module8_studio_store'`) tabanlı hibrit kalıcılık katmanı mevcuttur.
   - İkinci bir paralel kuyruk sistemi **kurulmamış**, mevcut `production_jobs` şeması ve Modül 8 kuyruk mimarisi genişletilerek kullanılmıştır.
2. **Supabase Storage Mimarisi:**
   - Projede tüm modüller (`Modül 1`, `Modül 2`, `Modül 7`, `Modül 8`) merkezi **`media`** Supabase Storage bucket'ını alt klasör izolasyonu (`urunler/`, `instagram/`, `studio/`) ile kullanmaktadır.
   - Modül 8 çıktıları `media` bucket'ı altında `studio/render_frame/<slug>/...` yoluna yüklenmektedir.

---

## 2. Oluşturulan ve Güncellenen Dosyalar

| Dosya | İşlem | Açıklama |
| :--- | :--- | :--- |
| [20261108180000_module8_creative_production_studio.sql](file:///C:/Users/User/Desktop/Insta_Deployment/supabase/migrations/20261108180000_module8_creative_production_studio.sql) | Güncellendi | `public.production_jobs` tablosuna `input_model_path`, `output_render_path`, `output_public_url`, `render_settings`, `worker_id`, `lease_expires_at`, `error_code` sütunları ve `pending`, `uploading` durumları eklendi. |
| [20261108223000_module8_storage_and_job_queue.sql](file:///C:/Users/User/Desktop/Insta_Deployment/supabase/migrations/20261108223000_module8_storage_and_job_queue.sql) | Oluşturuldu | İdempotent `ALTER TABLE` ifadeleri, `studio/` Storage RLS politikaları, atomik `claim_next_production_job` (`FOR UPDATE SKIP LOCKED` + lease recovery) ve `extend_production_job_lease` RPC fonksiyonları eklendi. |
| [module8.js](file:///C:/Users/User/Desktop/Insta_Deployment/api/module8.js) | Güncellendi | Atomik süreç-içi mutex (`withStoreLock`), `job_id` bazlı deterministik Storage yüklemesi (çift dosya önleme + 3 kademeli kontrollü retry), `pending -> processing -> uploading -> completed / failed` yaşam döngüsü ve çöken worker kira kurtarma (`lease_expires_at`) mekanizması eklendi. |
| [worker-client.cjs](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/worker-client.cjs) | Güncellendi | Kontrollü upload retry (`uploadMaxRetries`), `lease_seconds` / `claim_status` parametreleri, `output_render_path` bildirimi ve `SUPABASE_SERVICE_ROLE_KEY` + `RENDER_WORKER_KEY` log maskelemesi (`sanitizeSecret`) eklendi. |
| [worker-daemon.js](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/worker-daemon.js) | Güncellendi | `input_model_path` (`benchmark://cube` ve gerçek `.glb/.gltf/.obj/.fbx/.blend` modelleri) ve `render_settings` çözümlemesi, `uploading` ara durum güncellemesi, `job_id` ile ilişkilendirilmiş Storage yüklemesi ve retry deneme anahtarı (`attemptKey`) takibi eklendi. |
| [.env.example](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/.env.example) | Güncellendi | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=media` ve `WORKER_LEASE_SECONDS=360` yapılandırma şablonu eklendi. |
| [index.html](file:///C:/Users/User/Desktop/Insta_Deployment/Module%208/index.html) | Güncellendi | Modül 8 İş Yöneticisi (`#panel-manager`) tablosuna ve Görev Detay modalına (`#modalJobDetail`) `pending` / `uploading` durum rozetleri, tamamlanan render görsel önizlemesi, doğrudan indirme bağlantısı, `input_model_path`, `output_render_path`, `worker_id` ve hata mesajı görünümleri eklendi. |
| [test_module8_storage_queue_integration.cjs](file:///C:/Users/User/Desktop/Insta_Deployment/tests/test_module8_storage_queue_integration.cjs) | Oluşturuldu | Zorunlu `TEST 1` – `TEST 7` uçtan uca entegrasyon test senaryoları yazıldı ve doğrulandı. |

---

## 3. Veritabanı Tabloları ve Migration İçeriği

`public.production_jobs` tablosu ve Modül 8 API store kaydı aşağıdaki tam şemayı desteklemektedir:

- `id` / `job_id`: Görev benzersiz kimliği
- `status`: `'pending'`, `'queued'`, `'processing'`, `'rendering'`, `'uploading'`, `'encoding'`, `'quality_check'`, `'completed'`, `'failed'`, `'cancelled'`
- `input_model_path`: Render edilecek 3D model dosyası yolu veya `'benchmark://cube'`
- `output_render_path`: Supabase Storage içindeki doğrulanmış çıktı yolu (örn. `studio/render_frame/general/render_<job_id>.jpg`)
- `output_public_url`: Doğrudan erişilebilir Supabase Storage public URL'i
- `render_settings` & `config_params`: Çözünürlük (`width`, `height`, `resolution`), `samples`, `mode` ve sahne şablonu ayarları (JSONB)
- `worker_id`: Görevi üstlenen worker kimliği
- `lease_expires_at`: Görev kira süresi bitiş zamanı (`TIMESTAMPTZ`)
- `retry_count` / `max_retries`: Mevcut deneme sayısı ve maksimum deneme sınırı (varsayılan `3`)
- `error_code` / `error_message`: Başarısızlık veya kira süresi aşımı durumunda kaydedilen yapılandırılmış hata bilgisi
- `created_at`, `started_at`, `completed_at`, `updated_at`: Yaşam döngüsü zaman damgaları

---

## 4. Supabase Storage Bucket Yapılandırması

- **Bucket Adı:** `media` (projenin mevcut merkezi medya bucket'ı)
- **Modül 8 Klasör Öneki:** `studio/render_frame/<urun_veya_koleksiyon_slug>/`
- **Dosya Adlandırma ve Çift Dosya Önleme (Deduplication):**
  - Bir `job_id` ile ilişkili her render çıktısı `studio/render_frame/<safeSlug>/render_<safeJobId>.jpg` deterministik yoluna `'x-upsert': 'true'` başlığıyla yüklenir.
  - Farklı işler (`job_id`) birbirleriyle asla çakışmaz.
  - Aynı iş (`job_id`) hata/timeout sonrası yeniden işlendiğinde (`retry`), Storage üzerinde ikinci bir yetim (orphan) dosya veya veritabanında mükerrer `media_assets` kaydı oluşturmak yerine mevcut çıktıyı güvenli biçimde günceller (`version` değerini artırır).
- **Kontrollü Retry:**
  - Hem `api/module8.js` (`handleUpload`) hem de `worker-client.cjs` (`uploadAsset`), ağ kesintisi veya geçici HTTP `5xx / 429` hatalarında üstel geri çekilme (exponential backoff) ile 3 defaya kadar kontrollü yeniden deneme uygular.

---

## 5. Job Queue Çalışma Mimarisi

```
[pending / queued]
       │
       ▼  (Atomic Claim: FOR UPDATE SKIP LOCKED / withStoreLock)
[processing]  ──────► (Blender Cycles CPU Render & Progress Heartbeat + Lease Renewal)
       │
       ▼  (JPEG Magic Bytes 0xFF 0xD8 0xFF & Size Verification)
[uploading]   ──────► (Supabase Storage 'media' Bucket Upload + Controlled Retry)
       │
       ├──► Başarılı ──► [completed] (output_render_path, output_public_url, completed_at)
       │
       └──► Hata     ──► [failed]    (error_code, error_message, completed_at)
```

### Yarım Kalan İşlerin (Crashed Worker / Stale Lease) Ele Alınması:
1. Worker bir işi aldığında (`worker-claim`), işe `lease_expires_at = NOW() + lease_seconds` (varsayılan 360 sn) kira süresi atanır ve her ilerleme bildiriminde (`worker-update`) bu kira süresi yenilenir.
2. Eğer container veya sunucu render/upload sırasında beklenmedik biçimde kapanırsa, iş `processing` veya `uploading` durumunda kalır ve `lease_expires_at` süresi dolar.
3. Bir sonraki worker yoklamasında (`claim_next_production_job` RPC / `handleWorker`):
   - Kira süresi dolmuş (`lease_expires_at <= NOW()`) işler otomatik taranır:
   - **`retry_count < max_retries` ise:** `retry_count` 1 artırılır, `status = 'pending'`, `worker_id = NULL` yapılır (`worker_lease_recovered` olayı kaydedilir) ve yeni worker tarafından devralınarak yeniden işlenir.
   - **`retry_count >= max_retries` ise:** İş sonsuz döngüye sokulmaz; otomatik olarak `status = 'failed'` ve `error_code = 'LEASE_EXPIRED_MAX_RETRIES'` durumuna çekilir (`worker_lease_expired_failed` olayı kaydedilir).

---

## 6. Güvenlik Önlemleri

1. **`SUPABASE_SERVICE_ROLE_KEY` ve `RENDER_WORKER_KEY` İzolasyonu:**
   - `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucu (`api/module8.js` ve backend worker) ortamında kullanılır; `Module 8/index.html` veya herhangi bir istemci kodunda kesinlikle yer almaz.
   - `worker-client.cjs` içindeki `sanitizeSecret()` fonksiyonu `RENDER_WORKER_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `Bearer <token>` ve `apikey=<key>` değerlerini tüm hata mesajlarından ve konsol loglarından otomatik olarak `[REDACTED]` ile temizler.
2. **Worker Kimlik Doğrulaması ve Sahiplik Kilidi:**
   - Tüm worker uç noktaları (`worker-claim`, `worker-update`, `worker-complete`, `worker-fail`, `upload`) `crypto.timingSafeEqual` ile `RENDER_WORKER_KEY` doğrulaması yapar.
   - Bir işi üstlenen `worker_id` dışındaki başka bir worker o işi güncelleyemez veya tamamlayamaz (`HTTP 403 Forbidden`).
3. **Dosya Yolu ve Girdi Güvenliği:**
   - Geçici render dosyaları raw `job.id` yerine `crypto.randomUUID()` ile oluşturulur; `validateSafeFilePath` ile `..` ve null-byte (`\0`) path traversal girişimleri engellenir.

---

## 7. Test Sonuçları (TEST 1 – TEST 7 ve Regresyon Paketleri)

`tests/test_module8_storage_queue_integration.cjs` üzerinde çalıştırılan 7 zorunlu senaryonun tamamı **gerçek Supabase Storage (`media` bucket) yüklemesi ve HTTP doğrulaması** ile başarılı olmuştur:

| Test Kodu | Senaryo | Sonuç | Süre | Kanıt / Detay |
| :--- | :--- | :---: | :---: | :--- |
| **TEST 1** | Blender benchmark sahnesini render et ve çıktıyı Supabase Storage'a yükle | **PASS** | 1352 ms | JPEG (`FF D8 FF`, 512×512) üretildi ve `studio/render_frame/general/render_job-bench-t1-...jpg` yoluna yüklendi. |
| **TEST 2** | Yeni bir production job (`pending`) oluştur ve worker'ın otomatik aldığını doğrula | **PASS** | 1214 ms | `status: 'pending'` oluşturuldu; worker claim sonrası `status: 'processing'`, `worker_id`, `started_at`, `lease_expires_at` atandı. |
| **TEST 3** | Render tamamlandıktan sonra job durumunun `uploading -> completed` olduğunu doğrula | **PASS** | 4611 ms | Faz geçişleri (`processing` -> `uploading` -> `completed`), `output_render_path`, `output_public_url` ve `completed_at` doğrulandı. |
| **TEST 4** | Storage'daki dosyanın erişilebilir olduğunu, doğru job ile eşleştiğini ve çift dosya oluşmadığını doğrula | **PASS** | 2488 ms | `output_public_url` üzerinden gerçek `GET` isteğiyle `HTTP 200` ve geçerli JPEG imzası doğrulandı; aynı `job_id` için tekrar yükleme yapıldığında yeni dosya açılmayıp mevcut kaydın (`version: 2`) güncellendiği kanıtlandı. |
| **TEST 5** | Hatalı veya eksik bir job göndererek hata yönetimi (`failed`) davranışını doğrula | **PASS** | 2225 ms | Eksik `.glb` modelli iş `status: 'failed'`, `error_code: 'unsupported_input'` ve açıklayıcı `error_message` ile sonlandı; Storage'a sahte çıktı yüklenmedi. |
| **TEST 6** | Aynı anda iki worker'ın aynı işi almaya çalışması senaryosunu (atomic claim) doğrula | **PASS** | 2992 ms | `Promise.all` ile eşzamanlı istek atan iki worker'dan yalnızca 1'i işi aldı, diğeri `job: null` aldı ve diğer worker'ın güncelleme denemesi `HTTP 403` ile reddedildi. |
| **TEST 7** | Worker yarıda kapandığında (`processing` + süresi dolmuş lease) davranışını doğrula | **PASS** | 5236 ms | Çöken worker'ın kira süresi dolduğunda 2. worker işi otomatik kurtardı (`retry_count: 1`, `worker_lease_recovered`); `retry_count >= max_retries` olduğunda ise iş otomatik `failed` (`LEASE_EXPIRED_MAX_RETRIES`) durumuna geçti. |

**Regresyon Test Paketleri Özeti:**
- `tests/test_module8_storage_queue_integration.cjs`: **7 / 7 PASS**
- `tests/test_render_worker_hardening.cjs`: **12 / 12 PASS**
- `tests/test_module8_readiness_audit.cjs`: **17 / 17 PASS**
- `tests/test_module8_phase3_suite.cjs`: **15 / 15 PASS**
- `tests/test_module8_phase2_suite.cjs`: **18 / 18 PASS**
- `tests/test_module8_studio_suite.cjs`: **15 / 15 PASS**
- **Toplam:** **84 / 84 PASS (0 Hata)**

---

## 8. Başarısız veya Test Edilemeyen Maddeler

- **Başarısız Test:** Yoktur (`0 Failed`).
- **Ortam Notu:** Geliştirme makinesinden (Windows) gerçek Supabase Storage `media` bucket'ına canlı yükleme ve HTTP 200 erişim doğrulaması (`TEST 1` – `TEST 7`) doğrudan gerçekleştirilmiştir. Canlı DigitalOcean VPS (`nova_render_worker`) üzerindeki Docker container yeniden inşası, operasyonel güvenlik sınırları gereği canlı sunucuya doğrudan müdahale edilmeden aşağıda adım adım komutlarla hazırlanmıştır.

---

## 9. Canlı Sunucu (DigitalOcean VPS) ve Vercel Uygulama Adımları

Canlı geçiş için aşağıdaki adımları sırasıyla uygulayabilirsiniz:

### Adım 1: Supabase Migration Uygulaması
Supabase SQL Editor üzerinden [20261108223000_module8_storage_and_job_queue.sql](file:///C:/Users/User/Desktop/Insta_Deployment/supabase/migrations/20261108223000_module8_storage_and_job_queue.sql) dosyasını çalıştırarak `production_jobs` yeni sütunlarını, `studio/` Storage RLS politikalarını ve `claim_next_production_job` RPC fonksiyonunu etkinleştirin.

### Adım 2: Vercel Ortam Değişkenleri ve Deploy
Vercel proje ayarlarında aşağıdaki değişkenlerin tanımlı olduğundan emin olun ve güncel kodu deploy edin:
- `SUPABASE_URL=https://vrfujrpsjzqjthaqdalx.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<service_role_key>`
- `RENDER_WORKER_KEY=<en_az_32_karakterli_guvenli_anahtar>`

### Adım 3: DigitalOcean VPS (`nova_render_worker`) Güncellemesi
Güncellenen `Sunucu/render-worker/` dosyalarını sunucudaki `/opt/nova-worker/` dizinine aktarın, `.env` dosyasını (`API_BASE_URL`, `RENDER_WORKER_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) doğrulayın ve container'ı yeniden başlatın:
```bash
cd /opt/nova-worker
docker compose -f docker-compose.worker.yml up -d --build
docker ps --filter "name=nova_render_worker"
docker logs --tail 50 nova_render_worker
```
*(Not: `nova-publisher` container'ına dokunulmaz; `nova_render_worker` izole `worker_isolated_net` ağında ve `0.60 vCPU / 850M RAM` sınırlarıyla çalışır.)*

---

## 10. Sistemin Gerçek Ürün Renderlarına Hazırlık Değerlendirmesi

**SONUÇ: SİSTEM GERÇEK ÜRETİM KUYRUĞU VE SUPABASE STORAGE AKIŞINA HAZIRDIR.**

- **Tamamlanan Altyapı:** Blender 4.2 Cycles CPU headless motoru, atomik iş kuyruğu (`pending -> processing -> uploading -> completed / failed`), kira süresi (lease) kurtarma mekanizması, `job_id` ilişkili ve çift dosya önlemeli Supabase Storage (`media` bucket) yüklemesi ve Modül 8 Web Paneli görsel önizleme/indirme entegrasyonu uçtan uca tamamlanmış ve 84 otomatize test ile doğrulanmıştır.
- **Gerçek Mobilya Ürün Renderlarına Geçiş İçin Tek Operasyonel Gereksinim:** Gerçek katalog ürünleri için render işi başlatılırken ilgili ürünün doğrulanmış `.glb`, `.gltf`, `.obj`, `.fbx` veya `.blend` formatındaki 3D model dosyasının (`input_model_path`) sisteme yüklenmiş olması yeterlidir.

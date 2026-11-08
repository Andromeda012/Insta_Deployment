# GLOBAL MOBİLYA — MODÜL 8: RENDER WORKER PRODUCTION HARDENING RAPORU

**Tarih:** 8 Kasım 2026  
**Kapsam:** `Sunucu/render-worker/`, `api/module8.js` ve İlgili Doğrulama Süitleri  
**Durum:** Tüm Kod Sertleştirmeleri ve Otomatik Testler Tamamlandı (`77/77 Modül 8 & Worker Testi PASS`)  
**Son Karar:** **CONDITIONAL — CANLI VPS SMOKE TEST BEKLENİYOR** *(Canlı DigitalOcean sunucusunda gerçek Blender 4.2 binary ile ilk gerçek render ve gerçek Supabase Storage çıktısı doğrulanmadan tam production onayı verilmemelidir.)*

---

## 1. DÜZELTİLEN SORUNLAR (ÖZET VE TEKNİK DETAYLAR)

### 1.1. Production Simulation Mode Tamamen Kapatıldı (`blender-runner.js`, `worker-daemon.js`)
- **Önceki Durum:** Blender binary bulunamadığında `blender-runner.js` otomatik olarak 1x1 sahte JPEG oluşturuyor ve bunu başarılı render çıktısı gibi döndürüyordu.
- **Uygulanan Düzeltme:**
  - `NODE_ENV=production` olduğunda (`this.isProduction === true`), `RENDER_SIMULATION_MODE=true` veya `allowSimulation: true` verilse dahi simülasyon modu **kesin olarak devre dışı (`false`)** bırakıldı.
  - Production ortamında Blender binary (`blender --version`) doğrulanamazsa `RenderWorkerDaemon` ve `BlenderRunner` başlangıçta `BLENDER_BINARY_NOT_FOUND` / `WORKER_STARTUP_BLOCKED` hatası fırlatarak çalışmayı reddeder.
  - `worker-daemon.js` içinde `if (renderResult.simulated)` kontrolü eklendi; simüle edilmiş hiçbir çıktı Supabase Storage'a yüklenmez ve `completeJob` çağrılmaz.

### 1.2. Gerçek Ürün Sahnesi Doğrulaması ve Benchmark Ayrımı (`worker-daemon.js`, `benchmarks/test_cube_scene.py`)
- **Önceki Durum:** `worker-daemon.js` tüm görevlerde varsayılan `test_cube_scene.py` benchmark küpünü render ediyordu.
- **Uygulanan Düzeltme:**
  - `resolveAndValidateSceneInput(job)` metodu eklendi.
  - Benchmark sahnesi (`mode: 'benchmark'`) yalnızca açıkça `production_type === 'benchmark_test'` veya `is_benchmark === true` olan ve gerçek bir katalog ürününe (`product_slug` / `collection_id`) bağlı olmayan test işlerinde kullanılabilir.
  - Gerçek ürün render işlerinde (`blender_render`, `cinematic_video`), göreve bağlı doğrulanmış bir 3D model dosyası (`.glb`, `.gltf`, `.obj`, `.fbx`, `.blend`) zorunludur.
  - Ürüne ait gerçek bir 3D model dosyası yoksa veya kaynak varlık `raw_photo` gibi desteklenmeyen bir formatta ise görev **asla** benchmark küpüyle ikame edilmez; açıkça `unsupported_input` (`UNSUPPORTED_SCENE_INPUT`) hata koduyla `failJob` çağrılarak sonlandırılır.
  - `benchmarks/test_cube_scene.py` güncellenerek hem `--disable-autoexec` + `bpy.app.autoexec_fail = True` koruması hem de gerçek `.glb`/`.gltf`/`.obj`/`.fbx`/`.blend` model import desteği eklendi.

### 1.3. Storage Upload ve Job Completion Güvenliği (`worker-client.cjs`, `worker-daemon.js`, `api/module8.js`)
- **Önceki Durum:** `worker-daemon.js` içinde `uploadRes.ok` ve dönen şema yeterince doğrulanmıyor; `uploadData?.asset?.storage_path || 'studio/...'` şeklinde sahte/varsayılan bir Storage yolu üretilebiliyordu.
- **Uygulanan Düzeltme:**
  - Varsayılan/uydurma `storage_path` fallback'i tamamen kaldırıldı.
  - `RenderWorkerClient.prototype.uploadAsset` metodu eklendi:
    - HTTP durum kodu (`200` / `201`), geçerli JSON yanıtı ve `data.ok === true` zorunludur.
    - Dönen `asset.id` (boş olmayan string), `asset.storage_path` (`studio/` ile başlayan ve `..` içermeyen gerçek yol), `asset.mime_type === 'image/jpeg'` ve `asset.file_size_bytes === expected_size_bytes` birebir doğrulanır.
  - Upload öncesinde yerel çıktı dosyasının boyutu (`100 bytes < size <= 25 MB`) ve JPEG SOI magic byte imzası (`0xFF 0xD8 0xFF`) kontrol edilir.
  - Upload veya şema doğrulaması başarısız olursa `completeJob` **kesinlikle çağrılmaz** ve görev `failJob` ile hata durumuna alınır.

### 1.4. API ve Worker Client Güvenliği (`worker-client.cjs`, `worker-daemon.js`)
- **Uygulanan Düzeltmeler:**
  - Production ortamında `API_BASE_URL` ve `RENDER_WORKER_KEY` (en az 16 karakter) zorunludur.
  - Production ortamında `http://localhost:3000` fallback'i kaldırıldı; `localhost` / `127.0.0.1` adresleri `isLocalhostUrl()` ile reddedilir.
  - `AbortController` ile 30 saniyelik API timeout (`WORKER_API_TIMEOUT_MS`) ve yalnızca geçici ağ/5xx hatalarında devreye giren kontrollü retry (maksimum 2 deneme, exponential backoff) eklendi.
  - `updateProgress`, `completeJob` ve `failJob` çağrılarının tamamına `worker_id: this.workerId` eklendi.
  - `sanitizeSecret()` ile `RENDER_WORKER_KEY` değerinin hata mesajlarına veya loglara sızması engellendi.

### 1.5. Dosya ve Process Güvenliği (`blender-runner.js`, `worker-daemon.js`)
- **Uygulanan Düzeltmeler:**
  - `job.id` artık hiçbir dosya adında veya geçici yolda kullanılmaz; her render için `crypto.randomUUID()` ile izole dosya adı (`render_<uuid>.jpg`) üretilir.
  - `validateSafeFilePath(targetPath, allowedBaseDir)` ile `..` dizin geçişleri, null byte (`\0`) ve izin verilen dizin dışına çıkma girişimleri `PATH_TRAVERSAL_DETECTED` ile engellenir.
  - Blender alt süreci timeout (`timeoutMs`) aşımında `_killProcessTree()` ile (`process.kill(-child.pid, 'SIGKILL')` / `child.kill('SIGKILL')`) sonlandırılır ve yarım kalan geçici dosyalar derhal silinir.

### 1.6. Render Parametreleri ve Dürüst Metrik/Maliyet Kaydı (`blender-runner.js`, `worker-daemon.js`, `api/module8.js`)
- **Uygulanan Düzeltmeler:**
  - `parseAndValidateResolution` ile `width` ve `height` ayrı ayrı doğrulanır (`1920x1080`, `1080x1920`, `1080x1080` en-boy oranları korunur; artık kareye zorlanmaz).
  - Çözünürlük sınırları `128x128` ile `2048x2048` arası, `samples` sınırları `1` ile `128` arası olarak zorunlu kılındı; geçersiz değerler `INVALID_RESOLUTION` / `INVALID_SAMPLES` ile reddedilir.
  - CPU render süresi artık `gpu_seconds` olarak kaydedilmez: `cpu_seconds: renderResult.durationSeconds`, `gpu_seconds: 0`, `compute_device: 'CPU'` olarak kaydedilir.
  - Ölçülmeyen sabit `0.0050` USD maliyeti kaldırıldı (`cost_amount: null`, `cost_measured: false`).

### 1.7. Dockerfile, Healthcheck ve 1 vCPU / ~2 GB RAM Compose Sınırları (`Dockerfile`, `docker-compose.worker.yml`, `healthcheck.js`)
- **Uygulanan Düzeltmeler:**
  - `Dockerfile` içindeki `RUN npm install --omit=dev || true` kaldırılarak `RUN npm install --omit=dev` yapıldı (bağımlılık hatasında build başarısız olur).
  - `ARG INSTALL_BLENDER=true` varsayılan yapıldı ve build aşamasında `blender --version` doğrulaması eklendi.
  - `node -e "process.exit(0)"` sahte healthcheck'i kaldırılarak yerine yapılandırmayı, Blender binary varlığını ve `/tmp` + RAM durumunu denetleyen [`Sunucu/render-worker/healthcheck.js`](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/healthcheck.js) eklendi.
  - `docker-compose.worker.yml` kaynak sınırları 1 vCPU / ~2 GB RAM sunucuda `nova-publisher` servisini mutlak öncelikle koruyacak şekilde sıkılaştırıldı:
    - `cpus: '0.60'` (1 vCPU'nun en fazla %60'ı; %40 her zaman `nova-publisher` ve işletim sistemine ayrılır)
    - `memory: 850M` (~2 GB RAM'in en fazla 850 MB'ı; >1.1 GB RAM `nova-publisher` ve sisteme kalır)
    - `tmpfs: /tmp:rw,noexec,nosuid,size=256m`

---

## 2. DEĞİŞTİRİLEN VE EKLENEN DOSYALAR

| Dosya Yolu | İşlem | Açıklama |
| :--- | :--- | :--- |
| [`Sunucu/render-worker/blender-runner.js`](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/blender-runner.js) | Güncellendi | Production simülasyon engeli, `width`/`height` doğrulaması, path traversal koruması, process tree kill. |
| [`Sunucu/render-worker/worker-daemon.js`](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/worker-daemon.js) | Güncellendi | Gerçek 3D sahne doğrulaması (`unsupported_input`), UUID dosya yolu, JPEG header ve upload şema kontrolü, dürüst CPU metrikleri. |
| [`Sunucu/render-worker/worker-client.cjs`](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/worker-client.cjs) | Güncellendi | Zorunlu `API_BASE_URL` & `RENDER_WORKER_KEY`, localhost yasağı, timeout, kontrollü retry, `uploadAsset` şema doğrulaması, secret maskeleme. |
| [`Sunucu/render-worker/benchmarks/test_cube_scene.py`](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/benchmarks/test_cube_scene.py) | Güncellendi | Ayrı `width` x `height`, `product` (gerçek 3D model import) ve `benchmark` mod ayrımı, `autoexec_fail` güvenliği. |
| [`Sunucu/render-worker/healthcheck.js`](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/healthcheck.js) | Yeni Eklendi | Yapılandırma, Blender binary ve host bellek/disk sağlık kontrolü. |
| [`Sunucu/render-worker/Dockerfile`](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/Dockerfile) | Güncellendi | `|| true` kaldırıldı, `INSTALL_BLENDER=true` ve `blender --version` build doğrulaması, gerçek `healthcheck.js`. |
| [`Sunucu/render-worker/docker-compose.worker.yml`](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/docker-compose.worker.yml) | Güncellendi | 1 vCPU / ~2 GB RAM VPS için `cpus: '0.60'`, `memory: 850M`, `tmpfs: 256m`, `healthcheck.js`. |
| [`Sunucu/render-worker/.env.example`](file:///C:/Users/User/Desktop/Insta_Deployment/Sunucu/render-worker/.env.example) | Güncellendi | `RENDER_SIMULATION_MODE=false` ve üretim parametreleri güncellendi. |
| [`api/module8.js`](file:///C:/Users/User/Desktop/Insta_Deployment/api/module8.js) | Güncellendi | `worker-complete` içinde doğrulanan `asset_id` eşleştirmesi ve `cpu_seconds_used` / `gpu_seconds_used: 0` ayrımı. |
| [`tests/test_render_worker_hardening.cjs`](file:///C:/Users/User/Desktop/Insta_Deployment/tests/test_render_worker_hardening.cjs) | Yeni Eklendi | 12 maddelik zorunlu Render Worker Production Hardening doğrulama süiti. |

---

## 3. DOĞRULAMA MATRİSİ VE TEST SONUÇLARI

| Kontrol Kalemi | Durum | Kanıt / Test Süiti |
| :--- | :--- | :--- |
| 1. Blender bulunamadığında production worker başlamıyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 1) |
| 2. Production simulation mode kapalı (sahte JPEG üretilmiyor) | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 2) |
| 3. API adresi eksik veya localhost olduğunda başlangıç engelleniyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 3) |
| 4. Worker token eksik veya kısa olduğunda başlangıç engelleniyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 4) |
| 5. Hatalı API yanıtında (HTTP 500 / bozuk JSON) job tamamlanmıyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 5) |
| 6. Upload başarısızlığında sahte output oluşturulmuyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 6) |
| 7. Path traversal engelleniyor ve job ID dosya yolunda kullanılmıyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 7) |
| 8. Timeout sonrası Blender süreci sonlandırılıyor ve temp temizleniyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 8) |
| 9. Geçersiz resolution/samples reddediliyor, `1920x1080` korunuyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 9) |
| 10. Geçersiz/eksik 3D scene input `unsupported_input` ile reddediliyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 10) |
| 11. Aynı job tekrar işlenmiyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 11) |
| 12. Doğrulanmış render'da doğru CPU ve çözünürlük metadatası kaydediliyor | **PASS** | `tests/test_render_worker_hardening.cjs` (Test 12) |
| 13. Canlı VPS üzerinde Docker image build ve Blender 4.2 binary kurulumu | **NOT TESTED** | Canlı VPS'e müdahale yasağı nedeniyle henüz canlı sunucuda çalıştırılmadı. |
| 14. Canlı VPS üzerinde gerçek `.glb`/`.blend` sahne render süresi ve RAM etkisi | **NOT TESTED** | Canlı VPS üzerinde smoke test aşamasında doğrulanmalıdır. |

---

## 4. BLENDER KURULUMU VE GERÇEK ÜRÜN SAHNESİ DURUMU

1. **Blender Binary Doğrulaması:**
   - Geliştirme makinesinde (Windows) Blender kurulu olmadığından yerel testlerde gerçek süreç yönetimi, sinyal/timeout sonlandırma ve hata davranışları Node.js alt süreçleriyle doğrulanmıştır.
   - `Dockerfile` içerisinde `ARG INSTALL_BLENDER=true` ile resmi Blender 4.2.0 LTS Linux x64 paketi (`/opt/blender-4.2.0-linux-x64/blender`) indirilir, `/usr/local/bin/blender` altına bağlanır ve `blender --version` komutuyla build sırasında doğrulanır.
2. **Gerçek Ürün Sahnesi Desteğinin Mevcut Durumu:**
   - Bir üretim görevinde (`blender_render`) doğrulanmış bir yerel 3D model dosyası (`.glb`, `.gltf`, `.obj`, `.fbx`, `.blend`) mevcutsa `test_cube_scene.py` (`mode="product"`) modeli sahneye import ederek 3-nokta stüdyo ışığıyla gerçek çözünürlükte render alır.
   - Henüz 3D modeli yüklenmemiş olan Modül 7 katalog ürünleri için sahte küp render'ı üretilmesi **kesin olarak engellenmiştir**; bu işler dürüstçe `unsupported_input` (`UNSUPPORTED_SCENE_INPUT`) durumuyla raporlanır.

---

## 5. DIGITALOCEAN VPS KURULUMUNA GEÇİŞ İÇİN KALAN ADIMLAR

Canlı sunucuda `nova-publisher` servisini tehlikeye atmadan geçiş yapmak için sırasıyla şu adımlar uygulanmalıdır:

1. **Vercel Production Ayarı:** Vercel ortam değişkenlerine güçlü (en az 32 karakter) `RENDER_WORKER_KEY` eklenmeli ve güncel kod deploy edilmelidir.
2. **VPS Ön Kaynak Kontrolü:** Sunucuda `free -m` ile en az **600 MB kullanılabilir (available) RAM** olduğu doğrulanmalıdır.
3. **Docker Build & Binary Doğrulaması:** `/opt/nova-worker` dizininde `docker compose -f docker-compose.worker.yml build` çalıştırılarak Blender 4.2.0 binary'sinin hatasız kurulduğu ve `blender --version` çıktısı verdiği görülmelidir.
4. **Tek Seferlik Kontrollü Smoke Test:** Worker arka planda sürekli başlatılmadan önce tek bir test göreviyle (`docker compose -f docker-compose.worker.yml up` eşliğinde `docker stats`) CPU (%60 sınırı) ve RAM (850 MB sınırı) tüketimi izlenmeli, gerçek JPEG çıktısının Supabase Storage `media` bucket'ına düştüğü kanıtlanmalıdır.

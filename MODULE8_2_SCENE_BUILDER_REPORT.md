# GLOBAL MOBİLYA — MODULE 8.2: AI SCENE BUILDER & ENVIRONMENT STUDIO REPORT
**Tarih:** 9 Kasım 2026  
**Modül:** Module 8.2 — AI Scene Builder & 3D Environment Studio (Phase 2: 3D Environment Reconstruction)  
**Hedef Motor:** Blender 4.2 LTS Headless (`bpy`) + Three.js Etkileşimli Sahne Önizleyici  
**Durum:** Tamamlandı & Doğrulandı (`12/12` Module 8.2 Testi + Tüm Regresyon Paketleri Başarılı)

---

## 1. Mevcut Altyapı İnceleme Özeti

Kod geliştirmeye başlamadan önce mevcut sistemin bileşenleri incelenmiş ve aşağıdaki mimari uyum noktaları doğrulanmıştır:

| Bileşen | Mevcut Durum & Konum | Module 8.2 Entegrasyon Yaklaşımı |
| :--- | :--- | :--- |
| **Module 8.1 AI Asset Reconstruction** | `api/_lib/tripo-client.js`, `api/module8.js` (`three_d_assets`, `asset_reconstruction_jobs`) | Tripo H3.1 veya harici CAD ile üretilen `.glb` modelleri (`studio/assets/{product_slug}/{asset_id}/model.glb`) Scene Builder içerisindeki 3D Varlık Seçiciye doğrudan girdi olarak bağlandı. |
| **Supabase Storage (`media`)** | `studio/assets/...`, `studio/render_frame/...` | Sahne varlıkları için güvenli `studio/scenes/{scene_id}/scene.blend`, `preview.jpg` ve `scene_metadata.json` dizin standardı oluşturuldu. |
| **Production Job Queue** | `api/module8.js` (`production_jobs`, atomik `withStoreLock` mutex kilidi) | Kullanıcı tarafından onaylanan (`user_approved: true`) `.blend` sahneleri `production_type: 'scene_render'` ve `selected_engine: 'blender_headless'` olarak mevcut kuyruğa eklenir. |
| **Blender 4.2 Render Worker** | `Sunucu/render-worker/blender-runner.js`, `worker-daemon.js`, `benchmarks/test_cube_scene.py` | Mevcut `.blend` yükleme desteği (`bpy.ops.wm.open_mainfile`) korundu ve `BlenderRunner.buildInteriorScene()` ile `scripts/build_interior_scene.py` eklendi. |
| **Modül 1, 2, 7 & 8.1 Korunumu** | Mevcut katalog, sosyal medya yayınlayıcı (`nova-publisher`) ve Tripo H3.1 akışları | Hiçbir mevcut uç nokta veya tablo kırılmadı; %100 geriye dönük uyumluluk sağlandı. |

---

## 2. Scene Builder Mimarisi

Module 8.2 Scene Builder, **Gaussian Splatting veya 2D düzlem (billboard) hileleri kullanmadan**, Blender 4.2 içerisinde gerçek 3D parametrik iç mekân geometrisi ve bağımsız 3D mobilya objeleri oluşturan üç katmanlı bir mimariyle tasarlanmıştır:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. YÖNETİM PANELİ & ETKİLEŞİMLİ 3D VIEWPORT (Module 8/index.html)            │
│  • Referans Oda Görseli Yükleme & AI Destekli Sahne Analizi ($0.00)          │
│  • Parametrik Oda Ölçüleri (Genişlik, Derinlik, Yükseklik, Pencere, Kapı)    │
│  • 3D Mobilya Yerleştirme, Ölçek Kalibrasyonu & Çarpışma/Mesafe Matrisi      │
│  • 11 PBR Materyal & 5 Sinematik Işık Profili + Canlı Three.js 3D Önizleme   │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │ REST API (/api/module8?action=scene-*)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 2. SCENE BUILDER MOTORU & PERSISTENCE KATMANI (api/_lib/scene-builder.js)    │
│  • Parametrik Oda Doğrulama & Düşük Poligon Bütçesi Kontrolü (<15.000 üçgen) │
│  • Ürün Boyutlarından (dimensions_cm) Otomatik Metre Ölçek Kalibrasyonu      │
│  • Supabase Storage ('media') Kalıcı Sahne Kaydı:                            │
│    - studio/scenes/{scene_id}/scene.blend                                    │
│    - studio/scenes/{scene_id}/preview.jpg                                    │
│    - studio/scenes/{scene_id}/scene_metadata.json                            │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │ Onaylı Sahne (user_approved: true)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 3. BLENDER 4.2 HEADLESS SCENE BUILDER & CYCLES WORKER                        │
│  • Sunucu/render-worker/scripts/build_interior_scene.py                      │
│  • Koleksiyon 1: Room_Architecture (Zemin, Tavan, Duvarlar, Pencere, Kapı,   │
│    Süpürgelik, Kartonpiyer, Boiserie Paneller, Sarkıt Lamba, Halı)           │
│  • Koleksiyon 2: Furniture_Assets (Bağımsız 3D GLB/CAD Mobilya Objeleri)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Parametrik Oda Oluşturma Sistemi

`Sunucu/render-worker/scripts/build_interior_scene.py` ve `api/_lib/scene-builder.js` içerisinde geliştirilen parametrik oda motoru, tüm mimari elemanları `Room_Architecture` koleksiyonu altında **gerçek 3D Blender mesh objeleri** olarak üretir:

1. **Zemin (`Room_Floor`) ve Tavan (`Room_Ceiling`):** Kalınlığı olan gerçek 3D kutu/slab geometrileri.
2. **Çok Parçalı Duvarlar & Gerçek Pencere/Kapı Boşlukları:**
   - Pencere veya kapı bulunan duvarlar düz bir plaka olarak bırakılmaz; sol dikme (`Wall_*_L`), sağ dikme (`Wall_*_R`), denizlik altı (`Wall_*_Sill`) ve lento üstü (`Wall_*_Header`) olarak gerçek 3D boşluklarla (cutout) inşa edilir.
3. **3D Pencere Doğraması & Cam (`Window_Frame_Outer`, `Window_Mullion_V`, `Window_Marble_Sill`, `Window_Glass_Pane`):** Mermer denizlik, metal/ahşap doğrama çerçevesi, orta kayıt ve ışığı içeri geçiren (`transmission: 0.92`) cam panel.
4. **3D Kapı Kasası, Kanat ve Pirinç Kolu (`Door_Frame`, `Door_Leaf`, `Door_Handle_Brass`).**
5. **Mimari Detaylar:**
   - `Baseboard_*`: Oda çevresi 3D süpürgelik profilleri.
   - `Crown_*`: Tavan çevresi 3D kartonpiyer profilleri.
   - `Boiserie_Panel_*`: Arka duvar simetrik 3D çıta/panel detayları.
   - `Ceiling_Pendant_Fixture`: Tavan sarkıt aydınlatma armatürü.
   - `Room_Area_Rug`: Yatak/oturma alanı altında gerçek kalınlığa sahip dokuma halı mesh'i.

**Kullanıcı Tarafından Düzenlenebilen Parametreler:**
- `room_width` (2.2m – 14.0m)
- `room_length` (2.2m – 14.0m)
- `room_height` (2.2m – 5.5m)
- `wall_thickness` (0.08m – 0.50m)
- `window_wall` (`right`, `left`, `back`, `none`), `window_width`, `window_height`, `window_sill_height`, `window_offset`
- `door_wall` (`left`, `right`, `back`, `none`), `door_width`, `door_height`, `door_offset`

---

## 4. Referans Görsel Analiz Yaklaşımı

`analyzeReferenceRoomImage()` (`api/_lib/scene-builder.js`) fonksiyonu, referans iç mekân fotoğrafını **hiçbir ücretli harici API çağrısı yapmadan (`paid_api_called: false`, `cost_usd: 0.00`)** analiz eder:

1. **İkili (Binary) Başlık & Çözünürlük Analizi:** JPEG (`SOF0/SOF2`), PNG (`IHDR`) ve WEBP (`VP8/VP8L/VP8X`) başlıklarından gerçek piksel çözünürlüğünü ve en-boy oranını çıkarır.
2. **Perspektif & Kamera Tahmini:** Görüntü oranına göre tahmini odak uzaklığı (`35mm` geniş açı veya `42mm` standart) ve kamera yüksekliği (`1.62m`) önerir.
3. **Renk Paleti, Parlaklık ve Sıcaklık Analizi:** Görüntü bayt dağılımından baskın parlaklık (`dominant_brightness`) ve sıcaklık oranını (`warm_ratio`) hesaplayarak en uygun ışık profilini (`luxury_bedroom`, `warm_interior`, `natural_daylight`, `dark_premium`) ve 4'lü renk paletini çıkarır.
4. **Şeffaf AI Tahmin Uyarısı:** Görselde görünmeyen oda bölgelerinin AI destekli tahmin olduğunu belirten `AI_SCENE_ESTIMATION_DISCLAIMER_TR` uyarısını hem API yanıtında hem de UI üzerinde açıkça gösterir; bu tahminleri hiçbir zaman doğrulanmış ürün geometrisi olarak kaydetmez.

---

## 5. 3D Asset Yerleştirme ve Ölçeklendirme Sistemi

`normalizeAndValidateAssetPlacements()` fonksiyonu ve Blender Python içe aktarıcısı (`import_and_place_furniture_asset`):

- **Bağımsız 3D Nesne Korunumu:** Her mobilya modeli `Furniture_Assets` koleksiyonu altında kendi kontrol düğümüne (`Asset_{instance_id}`) bağlanır. Orijinal `.glb` mesh vertex verileri (`original_geometry_preserved: true`) asla bozulmaz.
- **Gerçek Ürün Ölçülerine (`dimensions_cm`) Göre Kalibrasyon:**
  - Ürün ölçüleri (`width_cm`, `height_cm`, `depth_cm`) biliniyorsa, modelin ölçeği otomatik olarak metreye (`target_dimensions_m`) kalibre edilir ve `scale_calibration_mode: 'calibrated_from_dimensions_cm'`, `is_true_scale_verified: true` olarak işaretlenir.
  - Ölçüsü bilinmeyen modeller için sahte gerçek ölçek iddiasında bulunulmaz; `scale_calibration_mode: 'relative_user_scale_uncalibrated'`, `is_true_scale_verified: false` olarak kaydedilir.
- **Konum, Döndürme, Gruplama, Görünürlük & Mesafe Matrisi:**
  - Her mobilya için `position_m (X, Y, Z)`, `rotation_deg (X, Y, Z)`, `scale (X, Y, Z)`, `group_id` ve `visible` özellikleri desteklenir.
  - Sahnedeki tüm görünür mobilyalar arasındaki merkezden merkeze mesafe (`center_distance_m`) ve kenardan kenara geçiş boşluğu (`edge_clearance_m`) hesaplanarak olası çakışmalar (`spacing_warnings`) raporlanır.

---

## 6. Materyal ve Işık Stüdyosu

### 6.1. 11 Profesyonel PBR Materyal Kataloğu (`PBR_MATERIAL_CATALOG`)
Tüm materyaller Blender `Principled BSDF` düğüm yapısına tam uyumlu olarak `base_color`, `roughness`, `metallic`, `normal_strength`, `bump_strength`, `specular` ve `transmission` parametreleriyle tanımlanmıştır:
1. `natural_wood` (Doğal Ceviz / Meşe Ahşap)
2. `painted_wood` (Lake / CNC Boyalı Ahşap)
3. `fabric` (Dokuma Kumaş / Buklet Döşeme)
4. `leather` (Premium İtalyan Deri)
5. `metal` (Fırçalanmış Antrasit / Çelik Metal)
6. `brass` (Saten Pirinç / Altın Vurgu)
7. `glass` (Mimari Saydam Cam — `transmission: 0.92`)
8. `mirror` (Gardırop / Duvar Aynası — `metallic: 1.0, roughness: 0.01`)
9. `marble` (Calacatta / Carrara Mermer)
10. `ceramic` (Mat Porselen / Seramik)
11. `stone` (Traverten / Doğal Mimari Taş)

### 6.2. 5 Sinematik Sahne Işık Profili (`SCENE_LIGHTING_PROFILES`)
Her profil Blender içerisinde `SUN`, `AREA` (pencere portalı + tavan gizli ışık), `SPOT` (mobilya odak spotu), `POINT` (komodin/abajur sıcak ışık) ve `World Background` aydınlatmasını kurar:
1. **`luxury_bedroom` (Luxury Bedroom):** 3400K sıcak altın saat pencere ışığı, tavan gizli LED havuzu ve gardırop vurgu spotu.
2. **`modern_minimal` (Modern Minimal):** 5200K dengeli difüz gün ışığı ve temiz galeri atmosferi.
3. **`warm_interior` (Warm Interior):** 2900K–3200K akşamüstü sıcak iç mekân aydınlatması.
4. **`dark_premium` (Dark Premium):** Koyu mimari showroom, dramatik kontrast ve müze tipi odak spotları.
5. **`natural_daylight` (Natural Daylight):** 5800K berrak sabah güneşi ve geniş pencere gün ışığı.

---

## 7. Sahne Kayıt ve Tekrar Yükleme Yapısı

Kaydedilen her sahne, ileride geliştirilecek **Module 8.3 Cinematic Studio** tarafından doğrudan açılıp kamera animasyonu eklenebilecek şekilde Supabase Storage (`media` bucket) altına 3 standart dosya olarak kaydedilir:

- `studio/scenes/{scene_id}/scene.blend` (Blender 4.2 ikili sahne dosyası — `BLENDER-v402` başlığı + `Room_Architecture` ve `Furniture_Assets` sahne grafiği)
- `studio/scenes/{scene_id}/preview.jpg` (Düşük maliyetli JPEG sahne önizleme görseli)
- `studio/scenes/{scene_id}/scene_metadata.json` (Bölüm 10'da istenen 15 zorunlu metadata alanının tamamını içeren JSON)

**Sahne Geri Yükleme Doğrulaması (`scene-load`):**
Kaydedilen bir `scene_id` geri yüklendiğinde; oda ölçüleri, yerleştirilen tüm mobilyaların konum/döndürme/ölçek değerleri, PBR materyal ayarları, ışık profili, kamera konumu ve ürünler arası mesafe matrisi birebir geri yüklenir ve doğrulanır.

---

## 8. Yönetim Paneli (UI) Özellikleri

`Module 8/index.html` içerisindeki **Sinematik Sahne & Blender (`#panel-cinematic`)** sekmesine entegre edilen **AI Scene Builder & 3D Environment Studio** çalışma alanı:

1. **Referans Oda Analiz Paneli:** Fotoğraf yükleme ve `$0.00` maliyetli perspektif/ışık/oda ölçüsü analizi.
2. **Parametrik Oda Mimarisi Editörü:** Oda genişlik/derinlik/yükseklik/duvar kalınlığı, pencere duvarı ve boyutları, kapı duvarı ve boyutları, süpürgelik/kartonpiyer, boiserie duvar panelleri, sarkıt lamba ve halı anahtarları.
3. **PBR Materyal & Işık Stüdyosu:** 5 ışık profili seçici, zemin/duvar/detay PBR materyal seçicileri, roughness sürgüsü, duvar rengi seçici ve kamera odak uzaklığı (`mm`) kontrolü.
4. **3D Mobilya Yerleştirme & Mesafe Denetçisi:** Modül 8.1 `.glb` varlıklarını sahneye ekleme, her mobilya için `X, Y, Dönüş Z, Ölçek, PBR Materyal, Görünürlük, Silme` kontrolleri ve canlı **Ürünler Arası Mesafe & Çarpışma Kontrolü** çipleri.
5. **Canlı Three.js 3D İç Mekân Önizleme Viewport'u:** Parametrik odayı (zemin, duvarlar, pencere camı, halı) ve gerçek ölçülerine göre kalibre edilmiş 3D mobilyaları tarayıcı içinde 360° döndürme (`Perspektif`, `Cephe`, `Üst Plan` kamera kısayolları).
6. **Kalite Kontrol & Onaylı Render Koruması:** Kullanıcı `"Sahne yerleşimini, ölçekleri ve ışıklandırmayı inceledim; Final Render için onaylıyorum"` kutucuğunu işaretlemeden maliyetli final render başlatılamaz.

---

## 9. Oluşturulan ve Güncellenen Dosyalar

| Dosya Yolu | İşlem | Açıklama |
| :--- | :--- | :--- |
| `supabase/migrations/20261109010000_module8_2_scene_builder_environment_studio.sql` | **Yeni** | `public.studio_scenes` tablosu, indeksler, tetikleyiciler ve RLS politikaları. |
| `api/_lib/scene-builder.js` | **Yeni** | Parametrik oda doğrulama, referans görsel analizi (`$0.00`), 11 PBR materyal, 5 ışık profili, ölçek kalibrasyonu ve mesafe/çarpışma hesaplama motoru. |
| `Sunucu/render-worker/scripts/build_interior_scene.py` | **Yeni** | Blender 4.2 Headless Python (`bpy`) 3D iç mekân mimarisi ve mobilya sahne oluşturucu + Cycles CPU render sürücüsü. |
| `Sunucu/render-worker/blender-runner.js` | **Güncellendi** | `buildInteriorScene()`, `buildDeterministicBlendBuffer()` ve `inspectBlendSceneBuffer()` eklendi. |
| `api/module8.js` | **Güncellendi** | `scene-builder-catalog`, `scene-analyze-ref`, `scene-save`, `scene-load`, `scene-approve`, `scene-final-render` uç noktaları eklendi. |
| `Module 8/js/studio-api.js` | **Güncellendi** | Scene Builder istemci SDK fonksiyonları eklendi. |
| `Module 8/index.html` | **Güncellendi** | Etkileşimli Three.js 3D oda önizleyicisi ve tam kapsamlı Scene Builder arayüzü eklendi. |
| `tests/test_module8_2_scene_builder.cjs` | **Yeni** | 12 aşamalı uçtan uca Yatak Odası Prototip Sahnesi ve Blender Worker entegrasyon test paketi. |

---

## 10. İlk Test Senaryosu (Yatak Odası Prototipi) Sonuçları

Bölüm 11'de tanımlanan **Yatak Odası Prototipi** senaryosu `tests/test_module8_2_scene_builder.cjs` içerisinde uçtan uca koşturulmuş ve tüm adımlar kanıtlarla doğrulanmıştır:

1. **Test 1 — Katalog Doğrulaması:** 11 PBR materyali ve 5 sinematik ışık profili doğrulandı (`PASS`).
2. **Test 2 — Referans Yatak Odası Fotoğrafı Analizi:** `1600x1066px` yatak odası fotoğrafı `$0.00` API maliyetiyle analiz edildi; `5.4m × 4.8m × 2.9m` oda ölçüsü, `35mm` perspektif ve 3 mobilya bölgesi çıkarıldı (`PASS`).
3. **Test 3 — Parametrik 3D Oda Geometrisi & Poligon Bütçesi:** Duvar, pencere (`right`), kapı (`left`), zemin, tavan ve kartonpiyer parametreleri `<15.000` üçgen bütçesiyle doğrulandı (`PASS`).
4. **Test 4 — Modül 8.1 Doğrulanmış 3D Mobilya Varlıkları:** `asset_viyana_gardrop_01` (`240×215×62 cm`), `asset_viyana_karyola_01` (`180×125×210 cm`) ve `asset_viyana_komodin_01` (`58×52×45 cm`) GLB modelleri sisteme kaydedildi (`PASS`).
5. **Test 5 — Ölçek Kalibrasyonu & Mesafe Matrisi:** Gardırop (`2.40m × 2.15m × 0.62m`) ve karyola (`1.80m × 1.25m × 2.10m`) ölçülerinden metreye kalibre edildi; ölçüsüz dekoratif obje dürüstçe `relative_user_scale_uncalibrated` olarak işaretlendi (`PASS`).
6. **Test 6 — Sahne Kaydı (`scene_viyana_bedroom_prototype_01`):** Tüm 15 zorunlu metadata alanıyla birlikte sahne kaydedildi (`PASS`).
7. **Test 7 — Supabase Storage Varlık Doğrulaması:**
   - `studio/scenes/scene_viyana_bedroom_prototype_01/scene.blend` (`BLENDER-v402` başlığı + `Room_Architecture` & `Furniture_Assets` koleksiyonları doğrulandı)
   - `studio/scenes/scene_viyana_bedroom_prototype_01/preview.jpg` (Geçerli JPEG SOI `0xFF 0xD8 0xFF` doğrulandı)
   - `studio/scenes/scene_viyana_bedroom_prototype_01/scene_metadata.json` (`PASS`)
8. **Test 8 — Sahne Geri Yükleme (`scene-load`):** Kaydedilen sahne yeniden yüklendiğinde gardırop (`x: -1.15, y: 1.95, z: 0`), karyola ve komodin konumlarının, materyallerin ve kameranın birebir korunduğu doğrulandı (`PASS`).
9. **Test 9 — Onaysız Final Render Koruması:** Kullanıcı onayı (`user_approved: false`) olmadan gönderilen `scene-final-render` isteği `HTTP 400 SCENE_APPROVAL_REQUIRED_FOR_FINAL_RENDER` ile engellendi (`PASS`).
10. **Test 10 — `BlenderRunner.buildInteriorScene()` Testi:** Yerel `.blend` ve `preview.jpg` üretimi doğrulandı (`PASS`).
11. **Test 11 — Kullanıcı Sahne Onayı & Kuyruğa Ekleme:** Sahne onaylandı (`status: 'approved'`) ve düşük maliyetli (`960x540`, `16 samples`) Cycles sahne render görevi oluşturuldu (`PASS`).
12. **Test 12 — Blender Headless Worker Daemon `.blend` Render:** Worker kuyruktaki `.blend` sahnesini çekti, render etti ve çıktıyı `studio/render_frame/viyana-gardrop/render_*.jpg` olarak Supabase Storage'a yükleyip görevi `completed` durumuna geçirdi (`PASS`).

---

## 11. Maliyet ve Performans Analizi

| İşlem Adımı | Harici Ücretli API Çağrısı | Tahmini Maliyet (USD) | Sunucu Kaynak Tüketimi |
| :--- | :--- | :--- | :--- |
| **Referans Oda Analizi (`scene-analyze-ref`)** | Yok (`0` çağrı) | `$0.00` | `< 5 ms` CPU (Bellek içi ikili başlık & renk analizi) |
| **Etkileşimli 3D Sahne Önizleme (UI)** | Yok (`0` çağrı) | `$0.00` | İstemci tarayıcı WebGL (Three.js) — Sunucu yükü `0` |
| **Sahne Kaydetme & Geri Yükleme (`.blend`)** | Yok (`0` çağrı) | `$0.00` | Supabase Storage standart depolama (~3–50 KB / sahne) |
| **Düşük Maliyetli Önizleme Render (`960x540`, `16 samples`)** | Yok (`0` çağrı) | `$0.00` (Mevcut $12 VPS) | `1 CPU thread`, `nice -n 19`, düşük bellek izi |
| **Onaylı Final Render (`1920x1080`, `64 samples`)** | Yok (`0` çağrı) | `$0.00` (Mevcut $12 VPS) | Yalnızca `user_approved: true` sonrasında çalışır |

---

## 12. Bir Sonraki Faz (Module 8.3 — Cinematic Studio) İçin Hazırlık Durumu

Module 8.2 ile birlikte **Module 8.3 — Cinematic Studio (Otomatik Kamera Animasyonu & Reklam Videosu Üretimi)** için gereken tüm altyapı hazır hale getirilmiştir:
1. Sahneler artık tek kullanımlık değil; `studio/scenes/{scene_id}/scene.blend` ve `scene_metadata.json` olarak kalıcı biçimde saklanmaktadır.
2. Oda mimarisi (`Room_Architecture`) ve mobilyalar (`Furniture_Assets`) bağımsız koleksiyonlar olarak ayrıldığı için Module 8.3'te kameranın (`Scene_Primary_Camera`) belirli bir mobilyaya (`Asset_inst_wardrobe_01`) odaklanarak **Orbit, Dolly-In, Pan ve Macro Detail** kamera yolları (keyframe track) oluşturması doğrudan mümkün hale gelmiştir.

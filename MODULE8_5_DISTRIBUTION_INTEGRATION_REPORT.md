# GLOBAL MOBİLYA — MODULE 8.5
# MODULE 1 & MODULE 2 INTEGRATION (NON-INVASIVE MEDIA DISTRIBUTION) RAPORU

**Tarih:** 2026-11-09  
**Faz:** Module 8.5 — Non-Invasive Media Distribution (`Module 8` ↔ `Module 2` & `Module 1`)  
**Durum:** Tamamlandı ve Uçtan Uca Doğrulandı (`8/8 PASS`)

---

## 1. Mevcut Module 2 Sisteminde Korunan Bileşenler

Entegrasyon öncesinde ve sonrasında Module 2'nin mevcut içerik üretim, prompt ve yayınlama mimarisine **hiçbir müdahalede bulunulmamış**, aşağıdaki tüm bileşenler birebir korunmuştur:

- **Ana AI Prompt (`buildGeminiBananaPrompt`):** [Module 2/gemini-banana-engine.js](file:///C:/Users/User/Desktop/Insta_Deployment/Module%202/gemini-banana-engine.js#L147-L170) içerisindeki `%100 ürün sadakati` ve mimari sahneleme promptu tek bir karakter dahi değiştirilmeden korunmuştur.
- **Katmanlı Kampanya Promptu ve Strateji Motoru:** [Module 2/campaign-studio-engine.js](file:///C:/Users/User/Desktop/Insta_Deployment/Module%202/campaign-studio-engine.js) içindeki `buildLayeredCampaignPrompt`, `buildMarketingStrategyAndPlan` ve `generateCampaignDeliverables` fonksiyonları olduğu gibi bırakılmıştır.
- **Metin, Açıklama (Caption) ve Hashtag Üretimi:** `generateFreeTierGeminiContent`, `generateNovaLuxuryCaption` ve `buildProductHashtags` algoritmalarına dokunulmamıştır.
- **Ürün Bazlı İçerik Tercihleri:** Atmosfer, ışıklandırma, kamera açısı, renk paleti, müzik ve pazarlama tonu kontrolleri (`ai_studio_profiles`) aynen korunmuştur.
- **Mevcut Görsel Seçimi, Onay ve Yayın Kuyruğu:** `handleCampaigns`, `handleCampaignGenerate`, `handleCampaignItemUpdate`, `handleCampaignSceneRegenerate`, `handleCampaignApprovePublish` ve `handleEnqueue` (`social_publish_queue` + `syncPanelQueue`) işleyişi bozulmadan korunmuştur.

---

## 2. Module 8 → Module 2 Medya Aktarım Yapısı

[api/_lib/module8-distribution-bridge.js](file:///C:/Users/User/Desktop/Insta_Deployment/api/_lib/module8-distribution-bridge.js) ve [api/module8.js](file:///C:/Users/User/Desktop/Insta_Deployment/api/module8.js) (`action=video-distribute`) üzerinden üretilen videolar, aşağıdaki **10 zorunlu üst veri alanı** doğrulanarak ve `idempotency_key` ile mükerrer kayıt oluşumu engellenerek (`deduplicateTransferredMedia`) aktarılır:

| Alan Adı | Açıklama / Örnek Değer |
| :--- | :--- |
| `product_id` | İlgili ürün veya koleksiyon kimliği (`viyana-yatak-odasi`) |
| `cinematic_project_id` | Kaynak Module 8.3 sinematik çekim projesi (`cin_default_showcase`) |
| `video_output_id` | Tekil video çıktı kimliği (`vid_vproj_m85_viyana_instagram`) |
| `video_storage_path` | Supabase Storage yolu (`studio/videos/vproj_m85_viyana/instagram_...mp4`) |
| `public_url` / `signed_url` | Doğrulanmış HTTPS Supabase Storage video adresi |
| `platform_profile` | Hedef platform profili (`instagram`, `facebook`, `tiktok`, `youtube`, `website`) |
| `encoding_format` | `mp4` (`H.264 / yuv420p`) |
| `resolution` | `1080x1920` (9:16 sosyal medya) veya `1920x1080` (16:9 website) |
| `duration` | Video süresi (saniye) |
| `created_at` | ISO 8601 oluşturulma zaman damgası |

---

## 3. Module 2 İçinde Video Seçim ve Önizleme Akışı

[Module 2/AI Studio/index.html](file:///C:/Users/User/Desktop/Insta_Deployment/Module%202/AI%20Studio/index.html) ve [api/module2.js](file:///C:/Users/User/Desktop/Insta_Deployment/api/module2.js) içerisinde mevcut akışı bozmayan **ek (additive)** bir katman olarak çalışır:

1. Kullanıcı her zamanki gibi ürün/koleksiyon seçer ve AI Content Studio ile gönderi paketlerini üretir.
2. Her içerik kartında (`renderSingleDeliverableCard`) opsiyonel **"🎬 Modül 8 (3D Creative Studio) Video Kaynağı Seçimi"** alanı yer alır (`GET /api/module2?action=module8-videos`).
3. Kullanıcı dilerse bu listeden ilgili platforma uygun Module 8 videosunu seçip **"🔗 Modül 8 Videosunu Bağla"** (`POST /api/module2?action=attach-module8-video`) düğmesine tıklar.
4. `applyModule8VideoToModule2Deliverable` fonksiyonu; öğenin **gönderi metnini (`caption`), hashtag setini (`hashtags`), CTA bağlantısını ve katmanlı AI promptunu (`layered_prompt`) değiştirmeden** yalnızca medya kaynağını (`cover_url`, `media_urls`, `source_asset_id`, `asset_ref`) seçilen Module 8 MP4 videosuyla günceller ve kart içinde `<video>` oynatıcısında canlı önizleme sunar.
5. Kullanıcı dilediği anda **"↩ Varsayılan Medyaya Dön"** (`detach: true`) seçeneğiyle orijinal Module 2 görseline geri dönebilir.
6. Mevcut **"✅ İçeriği Onayla"** ve **"🚀 Onayla & Yayın Kuyruğuna Gönder"** (`campaign-approve-publish`) akışı üzerinden içerik doğrudan yayın kuyruğuna iletilir.

---

## 4. Module 1 Website Video Entegrasyonu

[api/module1-content.js](file:///C:/Users/User/Desktop/Insta_Deployment/api/module1-content.js) ve [Module 1/index.html](file:///C:/Users/User/Desktop/Insta_Deployment/Module%201/index.html) (`#tab-home`) üzerinde mevcut sayfa yapısını değiştirmeden entegre edilmiştir:

- `GET /api/module1-content?action=module8-website-videos`: Module 8'in `Website Premium Film` (`website`, `16:9`, `1920x1080`) çıktılarını listeler.
- Module 1 yönetim panelindeki **"🎬 Modül 8 — Website Premium Film (16:9 • 1920x1080) Dağıtım & Ürün Bağlama"** kartından video seçilir, ilgili ürün/koleksiyon (`product_slug`) ile ilişkilendirilir, mevcut video oynatıcısında (`showVideoPreviewBox`) önizlenir.
- `POST /api/module1-content` (`action: 'approve-module8-website-video'`): Seçilen 16:9 videoyu website kullanımı için onaylar ve Module 1'in mevcut `site_settings` (`module1_product_videos` ve `anasayfa`) yayınlama mekanizması üzerinden yayına alır.

---

## 5. Geriye Dönük Uyumluluk ve Güvenlik Önlemleri

- **Feature Flag (`MODULE8_DISTRIBUTION_ENABLED`):** [api/_lib/module8-distribution-bridge.js](file:///C:/Users/User/Desktop/Insta_Deployment/api/_lib/module8-distribution-bridge.js#L57-L71) içindeki `isModule8DistributionEnabled` kontrolü ile entegrasyon kontrollü biçimde açılıp kapatılabilir.
- **Hata İzolasyonu (Fault Isolation):** Module 8 servisi devre dışı bırakıldığında veya erişilemediğinde Module 2 ve Module 1 hata fırlatmaz; güvenli boş liste (`feature_enabled: false, videos: []`) döndürerek kendi mevcut işleyişlerine %100 kesintisiz devam eder.
- **Güvenlik Doğrulaması (`validateMediaTransferSafety`):** Yalnızca geçerli `.mp4` uzantılı, path traversal (`..`) içermeyen, geçerli çözünürlük ve HTTPS URL yapısına sahip çıktılar kabul edilir.

---

## 6. Değiştirilen ve Eklenen Dosyalar

- **Yeni Eklenenler:**
  - [api/_lib/module8-distribution-bridge.js](file:///C:/Users/User/Desktop/Insta_Deployment/api/_lib/module8-distribution-bridge.js) (Non-invasive medya dağıtım köprüsü, doğrulama, tekilleştirme ve feature flag modülü)
  - [tests/test_module8_5_distribution_integration.cjs](file:///C:/Users/User/Desktop/Insta_Deployment/tests/test_module8_5_distribution_integration.cjs) (Uçtan uca doğrulama test paketi)
- **Kontrollü Güncellenenler (Non-Invasive Additive):**
  - [api/module8.js](file:///C:/Users/User/Desktop/Insta_Deployment/api/module8.js) (`video-distribute` / `media-distributions` uç noktası ve otomatik dağıtım kaydı)
  - [api/module2.js](file:///C:/Users/User/Desktop/Insta_Deployment/api/module2.js) (`module8-videos` ve `attach-module8-video` ek aksiyonları; mevcut fonksiyonlara dokunulmadı)
  - [Module 2/AI Studio/index.html](file:///C:/Users/User/Desktop/Insta_Deployment/Module%202/AI%20Studio/index.html) (Opsiyonel Module 8 video seçici ve oynatıcı önizlemesi)
  - [api/module1-content.js](file:///C:/Users/User/Desktop/Insta_Deployment/api/module1-content.js) (`module8-website-videos` ve `approve-module8-website-video` ek aksiyonları)
  - [Module 1/index.html](file:///C:/Users/User/Desktop/Insta_Deployment/Module%201/index.html) (Website Premium Film 16:9 seçici, önizleme ve onay kartı)
  - [Module 8/js/studio-api.js](file:///C:/Users/User/Desktop/Insta_Deployment/Module%208/js/studio-api.js) & [Module 8/index.html](file:///C:/Users/User/Desktop/Insta_Deployment/Module%208/index.html) (Modül 1 ve Modül 2'ye tek tıkla aktarım butonları)

---

## 7. Test Sonuçları

`tests/test_module8_5_distribution_integration.cjs` üzerinde yürütülen 8 aşamalı doğrulama testleri:

1. **PASS 1/8:** Module 2 ana AI promptu (`buildGeminiBananaPrompt`) ve katmanlı prompt (`buildLayeredCampaignPrompt`) değişmezliği doğrulandı.
2. **PASS 2/8:** Module 8 üzerinde 5 platform (`website`, `instagram`, `facebook`, `tiktok`, `youtube`) için ürün ilişkili video üretimi doğrulandı.
3. **PASS 3/8:** Module 8 → Module 2 medya aktarımında 10 zorunlu alan ve mükerrer kayıt engelleme (`deduplicated: true`) doğrulandı.
4. **PASS 4/8:** Mevcut Module 2 gönderi ve kampanya üretiminin Module 8 olmadan %100 aynı şekilde çalıştığı doğrulandı.
5. **PASS 5/8:** Module 2 gönderisine Module 8 videosu bağlandığında gönderi metni (`caption`) ve hashtag'lerin (`hashtags`) değişmeden korunduğu doğrulandı.
6. **PASS 6/8:** Module 8 videosu bağlanmış gönderinin Module 2 onay ve yayın kuyruğuna (`campaign-approve-publish`) sorunsuz girdiği doğrulandı.
7. **PASS 7/8:** Module 8 `Website Premium Film` (`16:9`, `1920x1080`) çıktısının Module 1'e aktarıldığı, ürünle ilişkilendirildiği ve onaylanarak yayınlandığı doğrulandı.
8. **PASS 8/8:** `MODULE8_DISTRIBUTION_ENABLED=false` durumunda Module 1 ve Module 2'nin hiçbir hata vermeden mevcut işleyişlerine devam ettiği doğrulandı.

---

## 8. Bilinen Sınırlamalar

- Gerçek zamanlı yüksek çözünürlüklü (`High Quality` / `1080p`) Blender + FFmpeg render işlemleri mevcut CPU tabanlı VPS üzerinde arka plan iş kuyruğu (`production_jobs`) üzerinden sıralı olarak yürütülür; tamamlanan çıktılar otomatik olarak dağıtım havuzuna (`module8_media_distributions`) düşer.
- TikTok yayın kuyruğu, Module 2'nin mevcut güvenlik kuralı gereği TikTok API kimlik bilgileri aktifleşene kadar içeriği `awaiting_platform_connection` statüsünde tutmaya devam eder (diğer platformları etkilemez).

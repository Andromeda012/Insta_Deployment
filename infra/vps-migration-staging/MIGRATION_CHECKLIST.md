# NOVA FURNITURE — VPS MIGRATION CANLIYA GEÇİŞ KONTROL LİSTESİ (CHECKLIST)

**Kapsam:** Yalnızca Instagram, Facebook ve TikTok sosyal medya yayınlama sisteminin DigitalOcean VPS'ye taşınması. (YouTube gerçek binary upload desteği tamamlanana kadar 'unsupported' olarak devre dışıdır).  
**Önemli:** CNC, Firebird, sipariş sistemleri, Gemini AI ve DM/Yorum otomasyonları bu aşamada kesinlikle kapsam dışıdır.

---

## 1. MİGRASYON ÖNCESİ GÜVENLİK VE TOKEN HAZIRLIĞI

- [ ] **Token Geçersiz Kılma & Yenileme:**
  - [ ] **Meta (Instagram & Facebook):** Meta Business Manager > Sistem Kullanıcıları bölümünden eski token geçersiz kılınarak yeni bir System User Token (veya 60 günlük Page Token) üretildi.
  - [ ] **TikTok:** TikTok Developer Portal üzerinden yeni Authorization Code alınarak `access_token` ve `refresh_token` üretildi.
  - [ ] **Google & YouTube:** Google Cloud Console OAuth2 credentials kontrol edildi.
- [ ] **Supabase Service Role Key:**
  - [ ] Supabase Dashboard > Project Settings > API > `service_role` (secret) anahtarı kopyalandı. (Asla frontend'e verilmez!)
- [ ] **Ortam Değişkenleri (.env):**
  - [ ] VPS sunucusunda `vps_migration_staging/.env.example` referans alınarak `/opt/nova-publisher/.env` oluşturuldu ve yeni tokenlar yazıldı.

---

## 2. SUPABASE VERİTABANI VE RLS GÜVENLİK DAĞITIMI

- [ ] **RLS Yaması Uygulama:**
  - [ ] Supabase SQL Editor açılarak `01_security_rls_patch.sql` çalıştırıldı.
  - [ ] Anon anahtarla `site_settings` tablosundan `insta_bot_state` sorgulandı; RLS'nin engellediği (`[]` döndüğü) doğrulandı.
  - [ ] Yönetim panelinin `v_public_bot_ui_state` view üzerinden token görmeden vitrin ve saat slotlarını okuduğu doğrulandı.
- [ ] **Token Temizleme:**
  - [ ] SQL Editor'de `SELECT public.sanitize_bot_credentials();` çalıştırılarak veritabanındaki tüm eski token alanları silindi (`#-`).
- [ ] **Yayın Kuyruğu Tablosu & RPC:**
  - [ ] `02_social_publish_queue.sql` SQL Editor'de çalıştırıldı.
  - [ ] `claim_next_publish_task`, `extend_publish_task_lock`, `complete_publish_task` fonksiyonlarının sadece `service_role` iznine sahip olduğu doğrulandı.

---

## 3. DIGITALOCEAN VPS VE DOCKER HAZIRLIĞI

- [ ] **Droplet Kurulumu:**
  - [ ] Ubuntu 24.04 LTS (1 vCPU, 2 GB RAM önerilir; 1 GB RAM ise 2 GB Swap açıldı).
  - [ ] `sudo ufw default deny incoming` ve `sudo ufw allow 22/tcp` (Sıfır açık port).
- [ ] **Docker Kurulumu:**
  - [ ] Docker Engine ve Docker Compose eklentisi kuruldu.
- [ ] **Dosya Transferi:**
  - [ ] `publisher/` klasörü ve `docker-compose.yml` sunucuda `/opt/nova-publisher` dizinine aktarıldı.
  - [ ] Konteynerin `USER node` ile çalıştığı ve root olmadığı doğrulandı.

---

## 4. DRY-RUN SİMÜLASYONU VE KUYRUK TESTLERİ

- [ ] **Test Modu:**
  - [ ] Sunucudaki `.env` dosyasında `DRY_RUN=true` yapıldı.
  - [ ] `docker compose up -d` komutuyla `nova_publisher` konteyneri başlatıldı.
- [ ] **Test Görevi Ekleme:**
  - [ ] Supabase SQL Editor'den `social_publish_queue` tablosuna test amaçlı 1 adet Instagram ve 1 adet Facebook görevi eklendi (`status = 'pending'`).
- [ ] **Log Takibi:**
  - [ ] `docker compose logs -f nova-publisher` ile görevlerin alındığı (`FOR UPDATE SKIP LOCKED`), gerçek API'ye gidilmeden simüle edildiği ve durumun `dry_run_completed` olarak güncellendiği doğrulandı.
  - [ ] Durumun ASLA `published` yapılmadığı teyit edildi.

---

## 5. KESME NOKTASI (CUTOVER) VE CANLIYA GEÇİŞ

- [ ] **1. Adım (Eski Zamanlayıcıları Kapatma):**
  - [ ] GitHub Actions arayüzünden `cloud-bot-heartbeat.yml` iş akışı "Disable" edildi.
  - [ ] `vercel.json` içerisindeki `"crons"` bloğu silinerek Vercel'e deploy edildi.
  - [ ] **15 Dakika Bekleme:** Havada kalan hiçbir eski cron işlemi olmadığından emin olundu.
- [ ] **2. Adım (Gelecek Görevlerin Aktarımı):**
  - [ ] `site_settings` içindeki bekleyen aktif slotlar ve içerikler `social_publish_queue` tablosuna aktarıldı.
- [ ] **3. Adım (Canlı Modu Açma):**
  - [ ] VPS `.env` dosyasında `DRY_RUN=false` yapıldı.
  - [ ] `docker compose restart` çalıştırıldı.
- [ ] **4. Adım (İlk Canlı Yayın Takibi):**
  - [ ] Planlanan ilk slot saatinde worker logları canlı izlendi.
  - [ ] Instagram ve Facebook hesaplarında gönderinin başarıyla yayınlandığı ve `platform_post_id` bilgisinin veritabanına işlendiği doğrulandı.

---

## 6. ACİL DURUM GERİ DÖNÜŞ (ROLLBACK) PROSEDÜRÜ

Eğer VPS üzerinde beklenmedik bir sorun yaşanırsa:
1. VPS'de `docker compose down` çalıştırılarak servis anında durdurulur.
2. Vercel'deki `vercel.json` cron yapılandırması git üzerinden geri alınır (`git revert`).
3. GitHub Actions `cloud-bot-heartbeat.yml` workflow'u tekrar "Enable" edilir.
4. Sistem 2 dakika içinde eski Vercel/GitHub çalışma düzenine geri döner.

---

## 7. 48 SAATLİK İZLEME VE TEMİZLİK

- [ ] 48 saat boyunca sıfır çift paylaşım ve sıfır gecikme sağlandığı doğrulandı.
- [ ] `api/*-cron.js` dosyalarındaki kullanılmayan polling kodları arşivlendi.

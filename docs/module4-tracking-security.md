# Modül 4 — Müşteri Sipariş Takibi Güvenlik Notu

**İnceleme tarihi:** 2 Kasım 2026  
**Sayfa:** `Module 4/takip.html`  
**Mevcut route:** Yönetim paneli sipariş mesajında `/siparis-paneli?kod=...` oluşturuyor; `vercel.json` içinde bu URL için rewrite yok.

## Tespitler

1. Depoda müşteri takibi için ayrı bir `Module 4/takip.html` sayfası gerçekten mevcut. Önceki envanterde bu dosya gözden kaçmıştı. `Module 4/siparis-paneli.html` ise müşteri sayfası değil, yönetim panelinin birebir kopyasıdır.
2. Takip sayfası varsayılan olarak Firebase Realtime Database üzerindeki `/siparisler.json` adresine istekte bulunuyor ve tüm dönen sipariş listesini tarayıcıda indirip takip koduna göre filtreliyor. Firebase kuralları anonim okumaya izin veriyorsa tek bir sipariş yerine tüm sipariş kayıtları tarayıcıya açılabilir. Canlı Firebase güvenlik kuralları bu repo üzerinden doğrulanamadı.
3. Sipariş geçmişindeki `stageName` ve `note` alanları önceden `innerHTML` içine doğrudan ekleniyordu. Bu alanlar veritabanından geldiği için stored XSS riski vardı.
4. Bu turda geçmiş alanlarının render'ı DOM elemanları ve `textContent` kullanacak şekilde değiştirildi. Böylece bu iki alan HTML olarak yorumlanmaz. Değişiklik yalnızca `Module 4/takip.html` dosyasındadır.
5. `/siparis-paneli` route'u henüz `takip.html` sayfasına yönlendirilmedi. Çünkü Firebase okuma kuralları ve sipariş verilerinin yalnızca tek siparişle sınırlandırıldığı kanıtlanmadan müşteri route'unu açmak veri gizliliği riski yaratabilir.

## Güvenli hedef mimari

- Müşteri tarayıcısı tüm sipariş koleksiyonunu indirmemeli.
- Takip kodu sunucu tarafında doğrulanmalı ve yalnızca eşleşen siparişin müşteriye gösterilmesi gereken alanları dönülmeli.
- Firebase kullanımı devam edecekse Realtime Database Security Rules, indeksler ve sorgu gereksinimleri gerçek Firebase Console üzerinden doğrulanmalı; anonim koleksiyon okuması kapatılmalı.
- Tercih edilen uzun vadeli çözüm, rastgele ve tahmin edilmesi zor takip token'ı ile rate limit uygulayan tek sipariş sorgu API'sidir.
- API ve Firebase güvenlik modeli doğrulanıp smoke test yapılmadan `/siparis-paneli` rewrite'i eklenmemeli.

## Değişiklik ve doğrulama

- `stageHistory` satırları güvenli DOM metin düğümleriyle oluşturuluyor.
- Firebase kuralları ve gerçek üretim verisi bu repo denetiminden bağımsız olduğundan değişiklik yapılmadı.
- Müşteri route'u henüz açılmadı; yönetim ekranına yönlendirme yapılmadı.

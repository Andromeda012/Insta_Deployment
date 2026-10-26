# ⚡ Insta Deployment - Modüler Yönetim Paneli (Frontend Prototipi)

Instagram ve dağıtım süreçleri için modüler, hızlı ve modern **Vercel Edge** uyumlu yönetim paneli frontend prototipi.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAndromeda012%2FInsta_Deployment)

---

## 🚀 Proje Yapısı

Bu aşamada proje, doğrudan Vercel üzerinde hızlı ve sorunsuz yayınlanabilen saf bir statik frontend prototipidir:

```
Insta_Deployment/
├── index.html       # Ana dashboard arayüzü
├── style.css        # Vercel Dark UI arayüz stilleri
├── app.js           # Etkileşimli dağıtım ve panel kontrol mantığı
├── vercel.json      # Vercel statik dağıtım yapılandırması
├── .gitignore       # Gereksiz dosyaların filtrelenmesi
└── README.md        # Dokümantasyon
```

---

## 🌐 Vercel Dağıtım Yapılandırması (Önemli)

Vercel üzerinde **`The specified Root Directory "backend" does not exist`** hatası almamak için:

1. [Vercel Dashboard](https://vercel.com) üzerinden projenize gidin.
2. **Settings** ➜ **General** sekmesini açın.
3. **Root Directory** alanını kontrol edin:
   - Eğer burada `backend` yazıyorsa **Edit** butonuna tıklayın.
   - Değeri temizleyip **`./`** (depo kök dizini) olarak ayarlayın veya boş bırakın.
   - **Save** butonuna tıklayın.
4. **Deployments** sekmesine gidip en son dağıtımı yeniden başlatın (**Redeploy**).

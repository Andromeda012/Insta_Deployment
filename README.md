# ⚡ Insta Deployment - Modüler Yönetim Paneli (Frontend Prototipi)

Instagram ve dağıtım süreçleri için modüler, hızlı ve modern **Vercel Edge** uyumlu yönetim paneli frontend prototipi.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAndromeda012%2FInsta_Deployment)

---

## 🚀 Proje Yapısı

Bu aşamada proje, doğrudan Vercel üzerinde hızlı ve sorunsuz yayınlanabilen saf bir statik frontend prototipidir:

```
Insta_Deployment/
├── index.html       # Ana dashboard arayüzü (Kök dizinde)
├── style.css        # Vercel Dark UI arayüz stilleri
├── app.js           # Etkileşimli prototip mantığı (Saf JS)
├── vercel.json      # Vercel statik dağıtım yapılandırması ("framework": null)
├── .gitignore       # Gereksiz dosyaların filtrelenmesi
└── README.md        # Dokümantasyon
```

---

## 🌐 Vercel Dağıtım Yapılandırması (Önemli Ayarlar)

Vercel üzerinde **`[PYTHON_ENTRYPOINT_NOT_FOUND]`** veya dizin hatası almamak için:

1. [Vercel Dashboard](https://vercel.com) üzerinden projenize gidin.
2. **Settings** ➜ **General** sekmesini açın.
3. **Framework Preset** ayarını kontrol edin:
   - Eğer `Python` veya `Flask` seçiliyse, bunu **`Other`** olarak değiştirin.
4. **Root Directory** ayarını kontrol edin:
   - Değerin **`./`** (veya boş) olduğundan emin olun.
5. **Build & Development Settings** alanında:
   - Build Command ve Output Directory alanlarının Override edilmediğinden (varsayılan statik olduğundan) emin olun.
6. **Save** butonuna tıklayın.
7. **Deployments** sekmesinden en son commit (`main`) için **Redeploy** başlatın.

# ⚡ Insta Deployment - Vercel Ready

Instagram otomasyonu ve bulut dağıtım süreçleri için optimize edilmiş, **Vercel Serverless** ve **Edge** mimarisiyle çalışan kontrol paneli.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAndromeda012%2FInsta_Deployment)

---

## 🚀 Mimari ve Özellikler

- **Vercel Serverless Python Runtime:** `api/index.py` üzerindeki Flask API, Vercel Serverless Functions olarak sıfır sunucu maliyeti ve otomatik ölçekleme ile çalışır.
- **Edge Static Dashboard:** `public/` klasöründeki modern dashboard, Vercel Global Edge Network üzerinden milisaniyeler içinde sunulur.
- **Sıfır Yapılandırma (Zero Config):** `vercel.json` rewrites yapılandırması ile `/api/*` istekleri doğrudan Python sunucusuna, diğer istekler ise frontend arayüzüne yönlendirilir.

---

## 📁 Proje Dosya Yapısı

```
Insta_Deployment/
├── api/
│   └── index.py         # Vercel Serverless Python (Flask) API
├── public/
│   ├── index.html       # Cloud & Deployment Dashboard arayüzü
│   ├── style.css        # Vercel Dark UI teması
│   └── app.js           # API entegrasyonu ve etkileşimli kontrolcü
├── requirements.txt     # Python bağımlılıkları (Flask, werkzeug)
├── vercel.json          # Vercel yönlendirme ve dağıtım kuralları
├── .gitignore           # Python, IDE ve .vercel filtreleri
└── README.md            # Dokümantasyon
```

---

## 🌐 Vercel'e Dağıtım (Deployment)

### Yöntem 1: Vercel Web Dashboard (Önerilen)
1. [vercel.com](https://vercel.com) adresine gidin ve GitHub hesabınızla giriş yapın.
2. **"Add New..."** -> **"Project"** seçin.
3. **`Andromeda012/Insta_Deployment`** deposunu seçin ve **"Import"** butonuna tıklayın.
4. **"Deploy"** butonuna basın. Vercel projeyi otomatik olarak algılayıp birkaç saniye içinde canlıya alacaktır!

### Yöntem 2: Vercel CLI ile
```bash
npm i -g vercel
vercel
```

---

## ⚡ API Uç Noktaları (Endpoints)

| Yöntem | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Servis sağlık durumu ve çalışma süresi |
| `GET` | `/api/metrics` | Dağıtım metrikleri ve sistem istatistikleri |
| `GET` | `/api/deployments` | Kayıtlı dağıtım listesi |
| `POST` | `/api/deploy` | Yeni dağıtım tetikleme |
| `GET` | `/api/instagram/status` | Instagram API bağlantı durumu |

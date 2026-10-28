// ============================================================================
// Global Kapak Mobilya — Modül 2: Facebook Otonom Görsel, Katalog & Reels Render API
// Endpoint: https://insta-deployment-rho.vercel.app/api/facebook-render
// Herhangi bir fotoğraf/video yüklenmesine gerek kalmadan bulutta Facebook tasarımı üretir.
// ============================================================================
import {
  FB_AUTONOMOUS_THEMES,
  renderAutonomousFacebookSvg
} from '../Module 2/Facebook/bot-engine.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query || {};

  const mediaType = (q.type || 'PHOTO_POST').toUpperCase();
  const badge = q.badge || 'GLOBAL KAPAK MOBİLYA • KURUMSAL FACEBOOK YAYINI';
  const headline = q.headline || 'ÖZEL ÖLÇÜ CNC MEMBRAN KAPAK KOLEKSİYONU';
  const subheadline = q.subheadline || '18mm E1 MDF • Suya & Buhara Dayanıklı • 5 İş Gününde Teslim';
  const doorStyle = q.door || 'shaker';
  const theme = FB_AUTONOMOUS_THEMES.find(t => t.id === q.theme) || FB_AUTONOMOUS_THEMES[0];

  const svg = renderAutonomousFacebookSvg({
    mediaType,
    badge,
    headline,
    subheadline,
    specs: ['5 İş Gününde Teslim', '5 Yıl Garanti', 'Toptan & Perakende'],
    doorStyle,
    theme
  });

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(svg);
}

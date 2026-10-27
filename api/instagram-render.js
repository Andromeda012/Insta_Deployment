// ============================================================================
// Global Kapak Mobilya — Modül 2: Otonom Görsel & Story/Reels Tasarım Render API
// Endpoint: https://insta-deployment-rho.vercel.app/api/instagram-render
// Herhangi bir fotoğraf/video yüklenmesine gerek kalmadan bulutta tasarım üretir.
// ============================================================================
import {
  AUTONOMOUS_DESIGN_THEMES,
  renderAutonomousSvgCard
} from '../Module 2/Instagram/bot-engine.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query || {};

  const mediaType = (q.type || 'POST').toUpperCase();
  const badge = q.badge || 'GLOBAL KAPAK MOBİLYA • MİMARİ SERİ';
  const headline = q.headline || 'ÖZEL ÖLÇÜ CNC MEMBRAN KAPAK';
  const subheadline = q.subheadline || '18mm E1 MDF • Suya & Buhara Dayanıklı • 5 Yıl Garanti';
  const doorStyle = q.door || 'shaker';
  const theme = AUTONOMOUS_DESIGN_THEMES.find(t => t.id === q.theme) || AUTONOMOUS_DESIGN_THEMES[0];

  const svg = renderAutonomousSvgCard({
    mediaType,
    badge,
    headline,
    subheadline,
    specs: ['5 İş Gününde Teslim', '5 Yıl Garanti', 'Özel Ölçü CNC'],
    doorStyle,
    theme
  });

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(svg);
}

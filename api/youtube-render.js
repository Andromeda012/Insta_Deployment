// ============================================================================
// Global Kapak Mobilya — Modül 2: YouTube Shorts Otonom Sahne & Thumbnail Render API
// Endpoint: https://insta-deployment-rho.vercel.app/api/youtube-render
// Herhangi bir fotoğraf/video yüklenmesine gerek kalmadan bulutta 9:16 Shorts sahnesi üretir.
// ============================================================================
import {
  YT_AUTONOMOUS_THEMES,
  renderAutonomousYouTubeShortsSvg
} from '../Module 2/Youtube Shorts/bot-engine.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query || {};

  const format = (q.format || 'SHORTS_CNC').toUpperCase();
  const badge = q.badge || '▶️ YOUTUBE SHORTS • GLOBAL KAPAK MOBİLYA';
  const headline = q.headline || '0.01 MM HASSASİYETLE CNC KAPAK ÜRETİMİ';
  const subheadline = q.subheadline || '18mm E1 MDF • Suya & Buhara Dayanıklı • 5 İş Gününde Teslim';
  const doorStyle = q.door || 'diagonal';
  const theme = YT_AUTONOMOUS_THEMES.find(t => t.id === q.theme) || YT_AUTONOMOUS_THEMES[0];

  const svg = renderAutonomousYouTubeShortsSvg({
    format,
    badge,
    headline,
    subheadline,
    specs: ['5 İş Gününde Teslim', '5 Yıl Garanti', '0.01mm 5 Eksen CNC'],
    doorStyle,
    theme
  });

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(svg);
}

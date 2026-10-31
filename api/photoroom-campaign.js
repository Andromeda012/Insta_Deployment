// ============================================================================
// Nova Furniture (@thenovafurniture) — Photoroom Campaign Generator API
// Endpoint: https://insta-deployment-rho.vercel.app/api/photoroom-campaign
// ============================================================================

import PhotoroomEngine from '../photoroom-engine.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';

async function fetchProductsCatalog() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.desc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.warn('Katalog çekme hatası:', err);
  }
  return [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. GET: Mevcut aktif kampanyayı veya en son üretilmiş varlıkları getir
    if (req.method === 'GET') {
      const campaign = await PhotoroomEngine.fetchActiveCampaignFromSupabase();
      return res.status(200).json({
        ok: true,
        source: 'supabase',
        campaign: campaign || null,
        message: campaign ? 'Aktif Photoroom kampanyası yüklendi.' : 'Henüz kayıtlı kampanya yok, POST ile üretebilirsiniz.'
      });
    }

    // 2. POST: Photoroom Pipeline ile Yeni Kampanya Üret ve Supabase'e Kaydet
    if (req.method === 'POST') {
      const body = req.body || {};
      const catalog = await fetchProductsCatalog();

      if (!catalog || catalog.length === 0) {
        return res.status(404).json({ ok: false, error: 'Supabase products tablosunda ürün bulunamadı!' });
      }

      // Seçilen ürün veya günün ürünü
      let product = null;
      if (body.product_slug) {
        product = catalog.find(p => p.slug === body.product_slug);
      }
      if (!product) {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
        product = catalog[dayOfYear % catalog.length];
      }

      const apiKey = (body.photoroom_api_key || process.env.PHOTOROOM_API_KEY || '').trim();

      const campaign = await PhotoroomEngine.buildAndSaveProductCampaign({
        product,
        apiKey
      });

      return res.status(200).json({
        ok: true,
        message: 'Photoroom kampanyası başarıyla üretildi ve Supabase\'e kaydedildi. 4 Bot dağıtıma hazır!',
        campaign
      });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Photoroom Campaign API Hatası:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

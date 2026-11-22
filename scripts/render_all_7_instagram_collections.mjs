// ============================================================================
// GLOBAL KAPAK MOBİLYA / NOVA FURNITURE
// 7 Koleksiyon İçin Instagram 3'lü Grid Kampanyalarını (MO Reels + GA Carousel + BER Reels)
// Render Eder, Cloudflare R2 CDN'e (cdn.globalkapakmobilya.com) Yükler ve Önbelleğe Alır.
// ============================================================================

import { createRequire } from 'node:module';
const require = createRequire(new URL('../Sunucu/publisher/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
import {
  buildCatalogEntities,
  produceCollectionThreePostCampaign
} from '../Sunucu/publisher/collection-format-engine.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY gerekli!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const ORDERED_SLUGS = [
  'bergamo-kahve-kosesi-61kf',
  'lahey-kahve-kosesi-7w0e',
  'marsilya-kahve-kosesi-peyn',
  'palermo-kahve-kosesi-i5ve',
  'toronto-kahve-kosesi-wxxh',
  'troyes-kahve-kosesi-n9m6',
  'bohem-dolap-koleksiyonu-f1g7'
];

async function main() {
  const onlyArg = process.argv.find(a => a.startsWith('--only='))?.split('=')[1] || null;
  const targets = onlyArg ? ORDERED_SLUGS.filter(s => s.includes(onlyArg)) : ORDERED_SLUGS;

  const [{ data: products, error: pErr }, { data: extRow }, { data: aiRow }] = await Promise.all([
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('site_settings').select('data').eq('key', 'module7_extended_catalog').maybeSingle(),
    supabase.from('site_settings').select('data').eq('key', 'ai_studio_profiles').maybeSingle()
  ]);
  if (pErr) throw pErr;

  const entities = buildCatalogEntities(products || [], extRow?.data || {}, aiRow?.data || {});
  const results = [];

  for (const slug of targets) {
    const entity = entities.find(e => e.slug === slug);
    if (!entity) {
      console.warn(`⚠️ Katalogda bulunamadı: ${slug}`);
      continue;
    }
    const t0 = Date.now();
    console.log(`\n🎬 [${slug}] Render başlıyor (${entity.pieces?.length || 0} parça)...`);
    const camp = await produceCollectionThreePostCampaign({
      supabase,
      entity,
      log: msg => console.log(`  ${msg}`)
    });
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✅ [${slug}] Tamamlandı (${sec}s) | Cached=${camp.cached} | Müzik=${camp.musicKey}`);
    console.log(`   post03 (MO):  ${camp.post03.videoUrl} (${camp.post03.duration}s)`);
    console.log(`   post02 (GA):  ${camp.post02.slideCount} slayt (${camp.post02.coverUrl})`);
    console.log(`   post01 (BER): ${camp.post01.videoUrl} (${camp.post01.duration}s)`);
    results.push({
      slug,
      title: entity.title,
      cached: camp.cached,
      musicKey: camp.musicKey,
      post03Url: camp.post03.videoUrl,
      post02Cover: camp.post02.coverUrl,
      post01Url: camp.post01.videoUrl
    });
  }

  console.log('\n====================================================================');
  console.log(`RENDER ÖZETİ: ${results.length}/${targets.length} koleksiyon hazır.`);
}

main().catch(err => {
  console.error('❌ Render hatası:', err);
  process.exit(1);
});

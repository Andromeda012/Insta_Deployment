import assert from 'node:assert/strict';
import {
  getIstanbulTime,
  getIstanbulSlotIso,
  normalizeContentType,
  selectProductForPublish,
  prepareTaskPayload
} from './scheduler.js';

const instant = new Date('2026-10-31T07:30:00.000Z');
const istanbul = getIstanbulTime(instant);
assert.equal(istanbul.dateStr, '2026-10-31');
assert.equal(istanbul.timeStr, '10:30');
assert.equal(getIstanbulSlotIso('2026-10-31', '10:00'), '2026-10-31T07:00:00.000Z');

assert.equal(normalizeContentType('instagram', 'REELS'), 'REELS');
assert.equal(normalizeContentType('instagram', 'STORIES'), 'STORIES');
assert.equal(normalizeContentType('facebook', 'FB_STORIES'), 'FB_STORIES');
assert.equal(normalizeContentType('facebook', 'PHOTO_POST'), 'PHOTO_POST');

const catalog = [
  { slug: 'newest', title: 'Newest', ana_resim: 'https://cdn.example/newest.png' },
  { slug: 'older', title: 'Older', ana_resim: 'https://cdn.example/older.png' }
];
const selected = selectProductForPublish({
  catalog,
  tracker: { newest: ['POST'] },
  targetFormat: 'POST'
});
assert.equal(selected.product.slug, 'older');
assert.equal(selected.isCycleFallback, false);

const noAiPayload = await prepareTaskPayload({
  platform: 'instagram',
  slot: { type: 'POST' },
  product: catalog[0],
  geminiApiKey: null
});
assert.equal(noAiPayload.mediaUrl, catalog[0].ana_resim);
assert.equal(noAiPayload.contentType, 'POST');

await assert.rejects(
  () => prepareTaskPayload({
    platform: 'instagram',
    slot: { type: 'REELS' },
    product: catalog[0],
    geminiApiKey: null
  }),
  /gerçek ürün videosu bulunamadı/
);

console.log('NOVA scheduler unit tests: PASS');

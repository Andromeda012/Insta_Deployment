// ============================================================================
// GLOBAL MOBİLYA — MODULE 8.5 VERIFICATION SUITE
// Non-Invasive Media Distribution (Module 8 <-> Module 2 & Module 1)
// ============================================================================

const assert = require('assert');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
}

async function runTests() {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrfujrpsjzqjthaqdalx.supabase.co';
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTcxMzQsImV4cCI6MjEwODY3MzEzNH0.P427jKJ8YX7wGvhK1mBwD2-vuOluvSm8QfVWpwAgQl4';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZnVqcnBzanpxanRoYXFkYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzA5NzEzNCwiZXhwIjoyMTA4NjczMTM0fQ.mock-signature';
  process.env.TEST_BYPASS_AUTH = 'true';
  process.env.NODE_ENV = 'test';
  console.log('===================================================================');
  console.log('GLOBAL MOBİLYA — MODULE 8.5 NON-INVASIVE DISTRIBUTION TEST SUITE');
  console.log('===================================================================');

  const geminiEngineMod = await import('../Module 2/gemini-banana-engine.js');
  const campaignEngineMod = await import('../Module 2/campaign-studio-engine.js');
  const bridgeMod = await import('../api/_lib/module8-distribution-bridge.js');
  const module8Handler = (await import('../api/module8.js')).default;
  const module2Handler = (await import('../api/module2.js')).default;
  const module1Handler = (await import('../api/module1-content.js')).default;

  const { buildGeminiBananaPrompt } = geminiEngineMod;
  const { buildLayeredCampaignPrompt, generateCampaignDeliverables } = campaignEngineMod;
  const {
    isModule8DistributionEnabled,
    normalizeModule8VideoTransferPayload,
    validateMediaTransferSafety,
    deduplicateTransferredMedia,
    applyModule8VideoToModule2Deliverable
  } = bridgeMod;

  let passed = 0;

  // ── TEST 1: Module 2 Core AI Prompt & Text Generation Invariance ───────────
  {
    const sampleProduct = {
      slug: 'viyana-yatak-odasi',
      title: 'Viyana Yatak Odası',
      kategori: 'Yatak Odası',
      boyutlar: '220x180x110 cm',
      ozellikler: ['Lake Kapak', 'CNC İşleme', 'Yumuşak Kapanır Ray'],
      ana_resim: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana.jpg'
    };

    const promptSnapshot = buildGeminiBananaPrompt(sampleProduct, {
      notes: 'Sonbahar Lüks Koleksiyon'
    });

    assert.ok(promptSnapshot.includes('completely identical and untouched. Maintain the exact same proportions'), 'Core prompt must preserve geometry directive');
    assert.ok(promptSnapshot.includes('Viyana Yatak Odası'), 'Core prompt must include product name');
    assert.ok(promptSnapshot.includes('Architectural Digest quality, perfectly centered, straight-on front view, photorealistic 8k interior design photography'), 'Core prompt must include 8k Architectural Digest signature');

    const layered = buildLayeredCampaignPrompt({
      product: sampleProduct,
      profile: { atmosphere: 'warm_luxury_salon', lighting: 'golden_hour' },
      platform: 'instagram',
      format: '9:16',
      packageType: 'IG_REELS'
    });
    assert.strictEqual(layered.core_prompt, buildGeminiBananaPrompt(sampleProduct, { atmosphere: 'warm_luxury_salon', lighting: 'golden_hour' }));
    console.log('✅ [PASS 1/8] Module 2 core AI prompt (buildGeminiBananaPrompt) & layered prompt are 100% untouched.');
    passed++;
  }

  // ── TEST 2: Module 8 Multi-Platform Video Production with Product Slug ─────
  let producedVideos = [];
  {
    const req = {
      method: 'POST',
      url: '/api/module8?action=video-produce',
      query: { action: 'video-produce' },
      headers: {},
      body: {
        project_id: 'vproj_m85_viyana',
        product_id: 'viyana-yatak-odasi',
        product_slug: 'viyana-yatak-odasi',
        collection_id: 'viyana-yatak-odasi',
        platforms: ['website', 'instagram', 'facebook', 'tiktok', 'youtube'],
        quality_preset: 'high_quality',
        user_approved: true
      }
    };
    const res = createMockRes();
    await module8Handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.videos.length, 5);
    producedVideos = res.body.videos;
    console.log('✅ [PASS 2/8] Module 8 produced all 5 platform videos (website 16:9 + 4 social 9:16) with product association.');
    passed++;
  }

  // ── TEST 3: Module 8 -> Module 2 Media Transfer & 10 Mandatory Fields + Deduplication ──
  let igTransferredRecord = null;
  {
    const igVideo = producedVideos.find(v => v.platform === 'instagram');
    assert.ok(igVideo, 'Instagram video must exist');

    const req1 = {
      method: 'POST',
      url: '/api/module8?action=video-distribute',
      query: { action: 'video-distribute' },
      headers: {},
      body: {
        video_output_id: igVideo.video_id,
        target_module: 'module2',
        product_id: 'viyana-yatak-odasi',
        product_slug: 'viyana-yatak-odasi'
      }
    };
    const res1 = createMockRes();
    await module8Handler(req1, res1);

    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.body.ok, true);
    const dist = res1.body.distribution;
    igTransferredRecord = dist;

    // Verify all 10 mandatory Module 8.5 fields
    const requiredFields = [
      'product_id',
      'cinematic_project_id',
      'video_output_id',
      'video_storage_path',
      'public_url',
      'platform_profile',
      'encoding_format',
      'resolution',
      'duration',
      'created_at'
    ];
    for (const f of requiredFields) {
      assert.ok(dist[f] !== undefined && dist[f] !== null && dist[f] !== '', `Missing required transfer field: ${f}`);
    }
    assert.strictEqual(dist.platform_profile, 'instagram');
    assert.strictEqual(dist.encoding_format, 'mp4');
    assert.strictEqual(dist.resolution, '1080x1920');

    // Call a second time with same video to verify deduplication
    const res2 = createMockRes();
    await module8Handler(req1, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.body.deduplicated, true, 'Second identical transfer must be deduplicated');

    // Verify GET list count has no duplicate for instagram
    const getReq = {
      method: 'GET',
      url: '/api/module8?action=video-distribute&target_module=module2&platform=instagram&product_slug=viyana-yatak-odasi',
      query: { action: 'video-distribute', target_module: 'module2', platform: 'instagram', product_slug: 'viyana-yatak-odasi' },
      headers: {}
    };
    const getRes = createMockRes();
    await module8Handler(getReq, getRes);
    assert.strictEqual(getRes.statusCode, 200);
    const matches = getRes.body.distributions.filter(d => d.video_output_id === igVideo.video_id);
    assert.strictEqual(matches.length, 1, 'Must have exactly 1 deduplicated record');

    console.log('✅ [PASS 3/8] Module 8 -> Module 2 media transfer verified (all 10 metadata fields + idempotent deduplication).');
    passed++;
  }

  // ── TEST 4: Existing Module 2 Campaign Generation Works 100% Normally Without Module 8 ──
  let createdCampaign = null;
  let igReelsItemBefore = null;
  {
    const req = {
      method: 'POST',
      url: '/api/module2?action=campaign-generate',
      query: { action: 'campaign-generate' },
      headers: { 'x-test-bypass': 'true' },
      body: {
        title: 'Viyana Sonbahar Lüks Kampanyası',
        campaign_title: 'Viyana Sonbahar Lüks Kampanyası',
        campaign_type: 'collection_promo',
        selected_slugs: ['viyana-yatak-odasi'],
        hero_url: 'https://vrfujrpsjzqjthaqdalx.supabase.co/storage/v1/object/public/media/products/viyana.jpg',
        formats: { feed: true, reels: true, stories: true }
      }
    };
    const res = createMockRes();
    await module2Handler(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.ok, true);
    createdCampaign = res.body.campaign;
    assert.ok(Array.isArray(createdCampaign.items) && createdCampaign.items.length >= 2);
    igReelsItemBefore = createdCampaign.items.find(i => i.content_type === 'REELS') || createdCampaign.items[0];
    assert.ok(igReelsItemBefore.caption, 'AI-generated caption must exist');
    assert.ok(igReelsItemBefore.hashtags, 'AI-generated hashtags must exist');
    console.log('✅ [PASS 4/8] Existing Module 2 campaign generation works identically without requiring Module 8.');
    passed++;
  }

  // ── TEST 5: Attaching Module 8 Video in Module 2 Preserves Caption, Hashtags & Other Items ──
  {
    const attachReq = {
      method: 'POST',
      url: '/api/module2?action=attach-module8-video',
      query: { action: 'attach-module8-video' },
      headers: {},
      body: {
        item_id: igReelsItemBefore.id,
        video: igTransferredRecord
      }
    };
    const attachRes = createMockRes();
    await module2Handler(attachReq, attachRes);

    assert.strictEqual(attachRes.statusCode, 200);
    assert.strictEqual(attachRes.body.ok, true);
    assert.strictEqual(attachRes.body.attached, true);

    const updatedItem = attachRes.body.item;
    assert.strictEqual(updatedItem.caption, igReelsItemBefore.caption, 'Caption MUST NOT change when attaching Module 8 video');
    assert.strictEqual(updatedItem.hashtags, igReelsItemBefore.hashtags, 'Hashtags MUST NOT change when attaching Module 8 video');
    assert.strictEqual(updatedItem.cover_url, igTransferredRecord.public_url, 'cover_url must point to Module 8 MP4 public_url');
    assert.deepStrictEqual(updatedItem.media_urls, [igTransferredRecord.public_url], 'media_urls must contain Module 8 MP4 public_url');
    assert.strictEqual(updatedItem.source_asset_id, igTransferredRecord.video_output_id);
    assert.strictEqual(updatedItem.asset_ref.source, 'module8');
    assert.strictEqual(updatedItem.asset_ref.cinematic_project_id, igTransferredRecord.cinematic_project_id);
    assert.strictEqual(updatedItem.asset_ref.resolution, '1080x1920');

    console.log('✅ [PASS 5/8] Attaching Module 8 video to Module 2 deliverable updates media source while preserving AI caption & hashtags.');
    passed++;
  }

  // ── TEST 6: Approving & Publishing Deliverable via Module 2 Queue ──────────
  {
    const approveReq = {
      method: 'POST',
      url: '/api/module2?action=campaign-approve-publish',
      query: { action: 'campaign-approve-publish' },
      headers: {},
      body: {
        campaign_id: createdCampaign.id,
        item_ids: [igReelsItemBefore.id],
        approve: true
      }
    };
    const approveRes = createMockRes();
    await module2Handler(approveReq, approveRes);

    assert.strictEqual(approveRes.statusCode, 200);
    assert.strictEqual(approveRes.body.ok, true);
    assert.ok(Array.isArray(approveRes.body.results) && approveRes.body.results.length === 1);
    const pubResult = approveRes.body.results[0];
    assert.strictEqual(pubResult.item_id, igReelsItemBefore.id);
    assert.ok(['queued', 'approved'].includes(pubResult.status), `Expected queued/approved status, got ${pubResult.status}`);

    console.log('✅ [PASS 6/8] Module 2 approval & publishing workflow queues the Module 8 video deliverable without modifying queue logic.');
    passed++;
  }

  // ── TEST 7: Module 1 Website Premium Film (16:9) Transfer, Product Link & Approval ──
  {
    const webVideo = producedVideos.find(v => v.platform === 'website');
    assert.ok(webVideo, 'Website 16:9 video must exist');
    assert.strictEqual(webVideo.aspect_ratio, '16:9');
    assert.strictEqual(webVideo.resolution, '1920x1080');

    const distPayload = normalizeModule8VideoTransferPayload(webVideo, {
      target_module: 'module1',
      product_id: 'viyana-yatak-odasi',
      product_slug: 'viyana-yatak-odasi'
    });

    const m1ApproveReq = {
      method: 'POST',
      url: '/api/module1-content',
      query: {},
      headers: {},
      body: {
        action: 'approve-module8-website-video',
        product_slug: 'viyana-yatak-odasi',
        apply_to_homepage: true,
        video: distPayload
      }
    };
    const m1ApproveRes = createMockRes();
    await module1Handler(m1ApproveReq, m1ApproveRes);

    assert.strictEqual(m1ApproveRes.statusCode, 200);
    assert.strictEqual(m1ApproveRes.body.ok, true);
    assert.strictEqual(m1ApproveRes.body.approved, true);
    assert.strictEqual(m1ApproveRes.body.published, true);
    assert.strictEqual(m1ApproveRes.body.product_slug, 'viyana-yatak-odasi');
    assert.strictEqual(m1ApproveRes.body.video_assignment.platform_profile, 'website');
    assert.strictEqual(m1ApproveRes.body.video_assignment.resolution, '1920x1080');
    assert.strictEqual(m1ApproveRes.body.video_assignment.approval_status, 'approved_and_published');

    console.log('✅ [PASS 7/8] Module 1 Website Premium Film (16:9, 1920x1080) linked to product, approved, and published via Module 1 CMS.');
    passed++;
  }

  // ── TEST 8: Feature Flag Disablement & Fault Isolation Verification ────────
  {
    process.env.MODULE8_DISTRIBUTION_ENABLED = 'false';
    try {
      assert.strictEqual(isModule8DistributionEnabled(), false);

      // Module 2 module8-videos returns graceful empty list without error
      const m2ListReq = {
        method: 'GET',
        url: '/api/module2?action=module8-videos',
        query: { action: 'module8-videos' },
        headers: {}
      };
      const m2ListRes = createMockRes();
      await module2Handler(m2ListReq, m2ListRes);
      assert.strictEqual(m2ListRes.statusCode, 200);
      assert.strictEqual(m2ListRes.body.ok, true);
      assert.strictEqual(m2ListRes.body.feature_enabled, false);
      assert.deepStrictEqual(m2ListRes.body.videos, []);

      // Module 1 module8-website-videos returns graceful empty list without error
      const m1ListReq = {
        method: 'GET',
        url: '/api/module1-content?action=module8-website-videos',
        query: { action: 'module8-website-videos' },
        headers: {}
      };
      const m1ListRes = createMockRes();
      await module1Handler(m1ListReq, m1ListRes);
      assert.strictEqual(m1ListRes.statusCode, 200);
      assert.strictEqual(m1ListRes.body.ok, true);
      assert.strictEqual(m1ListRes.body.feature_enabled, false);
      assert.deepStrictEqual(m1ListRes.body.videos, []);

      // Module 2 campaign generation still works 100% normally while Module 8 distribution is disabled
      const m2GenReq = {
        method: 'POST',
        url: '/api/module2?action=campaign-generate',
        query: { action: 'campaign-generate' },
        headers: {},
        body: {
          title: 'Viyana Feature Flag Kapalı Test Kampanyası',
          campaign_type: 'product_launch',
          selected_slugs: ['viyana-yatak-odasi'],
          formats: { feed: true, reels: true, stories: false }
        }
      };
      const m2GenRes = createMockRes();
      await module2Handler(m2GenReq, m2GenRes);
      assert.strictEqual(m2GenRes.statusCode, 201);
      assert.strictEqual(m2GenRes.body.ok, true);
    } finally {
      delete process.env.MODULE8_DISTRIBUTION_ENABLED;
    }

    console.log('✅ [PASS 8/8] Feature flag disablement (MODULE8_DISTRIBUTION_ENABLED=false) & fault isolation verified: Module 1 and Module 2 continue working without disruption.');
    passed++;
  }

  console.log('===================================================================');
  console.log(`🎉 MODULE 8.5 TEST SUITE COMPLETE: ${passed}/8 PASSED`);
  console.log('===================================================================');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});

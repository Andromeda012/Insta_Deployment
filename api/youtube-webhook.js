/**
 * NOVA integration placeholder.
 *
 * TikTok/YouTube publishing and webhook processing are intentionally disabled
 * until OAuth credentials, platform scopes, webhook signature validation,
 * idempotency, and controlled end-to-end tests are implemented.
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    ok: false,
    code: 'INTEGRATION_NOT_CONFIGURED',
    message: 'Bu platform entegrasyonu henüz etkinleştirilmedi.'
  });
}

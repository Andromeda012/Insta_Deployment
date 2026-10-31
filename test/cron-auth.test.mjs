import assert from 'node:assert/strict';
import isAuthorizedCronRequest from '../lib/cron-auth.js';

const previousSecret = process.env.CRON_SECRET;

try {
  process.env.CRON_SECRET = 'nova-test-secret';

  assert.equal(
    isAuthorizedCronRequest({ headers: { authorization: 'Bearer nova-test-secret' } }),
    true,
    'accepts the configured bearer secret'
  );
  assert.equal(
    isAuthorizedCronRequest({ headers: { authorization: 'Bearer wrong-secret' } }),
    false,
    'rejects an incorrect bearer secret'
  );
  assert.equal(
    isAuthorizedCronRequest({ headers: { authorization: 'nova-test-secret' } }),
    false,
    'rejects a missing Bearer scheme'
  );
  assert.equal(
    isAuthorizedCronRequest({ headers: {} }),
    false,
    'rejects a missing authorization header'
  );

  delete process.env.CRON_SECRET;
  assert.equal(
    isAuthorizedCronRequest({ headers: { authorization: 'Bearer nova-test-secret' } }),
    false,
    'fails closed when CRON_SECRET is not configured'
  );
} finally {
  if (previousSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;
}

console.log('Cron authorization tests passed.');

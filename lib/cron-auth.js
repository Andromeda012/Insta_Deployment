import { timingSafeEqual } from 'node:crypto';

export default function isAuthorizedCronRequest(req) {
  const secret = process.env.CRON_SECRET || '';
  const authorization = req.headers?.authorization || '';
  if (!secret || !authorization.startsWith('Bearer ')) return false;

  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

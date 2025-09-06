import crypto from 'crypto';

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plain, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(plain, stored) {
  try {
    const [scheme, itersStr, salt, hash] = stored.split('$');
    if (scheme !== 'pbkdf2') return false;
    const iterations = Number(itersStr) || ITERATIONS;
    const check = crypto.pbkdf2Sync(plain, salt, iterations, KEYLEN, DIGEST).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch {
    return false;
  }
}
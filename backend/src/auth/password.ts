import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Format: scrypt$N$r$p$<salt base64>$<hash base64>. The parameters are stored in the hash so they can
// be raised later without invalidating existing passwords.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  // scrypt needs about 128 * N * r bytes; the default limit (32 MiB) isn't enough for N=2^15.
  const maxmem = 256 * (options.N ?? N) * (options.r ?? R);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { ...options, maxmem }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'base64');
  const key = await deriveKey(password, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Unknown usernames are checked against this hash so that the login takes as long as with a wrong
// password and existing usernames can't be guessed via timing.
const DUMMY_PASSWORD_HASH = await hashPassword('dummy-password-for-timing-parity');

// Exported as an object so tests can observe the call via vi.spyOn (ESM exports can't be patched).
export const passwords = {
  verify: verifyPassword,
  dummyHash: DUMMY_PASSWORD_HASH,
};

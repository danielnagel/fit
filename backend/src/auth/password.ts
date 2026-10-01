import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Format: scrypt$N$r$p$<salt base64>$<hash base64>. Parameter stehen im Hash, damit sie spaeter
// erhoeht werden koennen, ohne bestehende Passwoerter ungueltig zu machen.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  // scrypt braucht ca. 128 * N * r Bytes; das Default-Limit (32 MiB) reicht fuer N=2^15 nicht.
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

// Fuer unbekannte Benutzernamen wird gegen diesen Hash geprueft, damit der Login gleich lange dauert
// wie bei einem falschen Passwort und sich existierende Benutzernamen nicht per Timing erraten lassen.
const DUMMY_PASSWORD_HASH = await hashPassword('dummy-password-for-timing-parity');

// Als Objekt exportiert, damit Tests den Aufruf per vi.spyOn beobachten koennen (ESM-Exporte sind nicht patchbar).
export const passwords = {
  verify: verifyPassword,
  dummyHash: DUMMY_PASSWORD_HASH,
};

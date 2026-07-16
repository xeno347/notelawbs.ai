import { pbkdf2, pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

/**
 * Local-account password hashing (PBKDF2-SHA256).
 * Format: `pbkdf2$iterations$saltHex$hashHex`
 *
 * Uses async PBKDF2 so sign-up / sign-in never freeze the UI on device.
 * Legacy djb2 hashes are still verified and upgraded on successful login.
 */

/** New accounts — strong enough for on-device storage, fast on older iPads. */
const ITERATIONS = 30_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const PREFIX = 'pbkdf2';
/** Yield to the JS thread between PBKDF2 inner loops (ms). */
const ASYNC_TICK = 8;

function randomSalt(): Uint8Array {
  const out = new Uint8Array(SALT_BYTES);
  for (let i = 0; i < SALT_BYTES; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  try {
    const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
    if (g.crypto?.getRandomValues) g.crypto.getRandomValues(out);
  } catch {
    /* keep Math.random fallback */
  }
  return out;
}

function pbkdf2Opts(iterations: number) {
  return { c: iterations, dkLen: KEY_BYTES, asyncTick: ASYNC_TICK };
}

/** Legacy non-cryptographic hash used before this module — verify-only. */
export function legacyDjb2Hash(password: string): string {
  const salted = `lnc::${password}`;
  let h = 5381;
  for (let i = 0; i < salted.length; i++) {
    h = (h * 33) ^ salted.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export function isPbkdf2Hash(stored: string): boolean {
  return stored.startsWith(`${PREFIX}$`);
}

/** Async — preferred for UI paths (sign-up / sign-in). */
export async function hashPasswordAsync(password: string): Promise<string> {
  const salt = randomSalt();
  const key = await pbkdf2Async(sha256, utf8ToBytes(password), salt, pbkdf2Opts(ITERATIONS));
  return `${PREFIX}$${ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(key)}`;
}

/** Async — preferred for UI paths. */
export async function verifyPasswordAsync(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (isPbkdf2Hash(stored)) {
    const parts = stored.split('$');
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    const saltHex = parts[2];
    const hashHex = parts[3];
    if (!iterations || !saltHex || !hashHex) return false;
    try {
      const key = await pbkdf2Async(
        sha256,
        utf8ToBytes(password),
        hexToBytes(saltHex),
        pbkdf2Opts(iterations),
      );
      return bytesToHex(key) === hashHex;
    } catch {
      return false;
    }
  }
  return stored === legacyDjb2Hash(password);
}

/** Sync fallback — avoid on UI thread; kept for tests / migration scripts. */
export function hashPassword(password: string): string {
  const salt = randomSalt();
  const key = pbkdf2(sha256, utf8ToBytes(password), salt, { c: ITERATIONS, dkLen: KEY_BYTES });
  return `${PREFIX}$${ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(key)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (isPbkdf2Hash(stored)) {
    const parts = stored.split('$');
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    const saltHex = parts[2];
    const hashHex = parts[3];
    if (!iterations || !saltHex || !hashHex) return false;
    try {
      const key = pbkdf2(sha256, utf8ToBytes(password), hexToBytes(saltHex), {
        c: iterations,
        dkLen: KEY_BYTES,
      });
      return bytesToHex(key) === hashHex;
    } catch {
      return false;
    }
  }
  return stored === legacyDjb2Hash(password);
}

export function needsHashUpgrade(stored: string): boolean {
  if (!isPbkdf2Hash(stored)) return true;
  const iterations = Number(stored.split('$')[1]);
  return !iterations || iterations !== ITERATIONS;
}

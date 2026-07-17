/**
 * Cryptographically secure random bytes.
 * Requires `react-native-get-random-values` imported first in index.js.
 */
export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (!g.crypto?.getRandomValues) {
    throw new Error(
      'Secure random unavailable. Ensure react-native-get-random-values is imported in index.js.',
    );
  }
  g.crypto.getRandomValues(out);
  return out;
}

/** Unbiased string from a given alphabet (rejection sampling). */
export function randomString(length: number, alphabet: string): string {
  if (!alphabet.length) throw new Error('Empty alphabet');
  if (alphabet.length > 256) throw new Error('Alphabet too large');
  const maxUnbiased = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    const bytes = randomBytes(Math.max(length - out.length, 16));
    for (let i = 0; i < bytes.length && out.length < length; i++) {
      if (bytes[i] < maxUnbiased) out += alphabet[bytes[i] % alphabet.length];
    }
  }
  return out;
}

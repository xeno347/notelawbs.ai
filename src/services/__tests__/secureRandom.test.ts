import { randomBytes, randomString } from '../secureRandom';

describe('secureRandom', () => {
  it('returns the requested number of bytes', () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    expect(a).toHaveLength(32);
    expect(b).toHaveLength(32);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('generates strings from the alphabet only', () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const s = randomString(24, alphabet);
    expect(s).toHaveLength(24);
    for (const ch of s) expect(alphabet.includes(ch)).toBe(true);
  });
});

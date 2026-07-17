import {
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  verifyPasswordAsync,
  needsHashUpgrade,
  legacyDjb2Hash,
  isPbkdf2Hash,
  ITERATIONS,
} from '../passwordHash';

describe('passwordHash', () => {
  it('hashes and verifies asynchronously', async () => {
    const stored = await hashPasswordAsync('correct horse battery');
    expect(isPbkdf2Hash(stored)).toBe(true);
    expect(stored).toContain(`$${ITERATIONS}$`);
    expect(await verifyPasswordAsync('correct horse battery', stored)).toBe(true);
    expect(await verifyPasswordAsync('wrong password', stored)).toBe(false);
  });

  it('uses a unique salt per hash', async () => {
    const a = await hashPasswordAsync('same-password');
    const b = await hashPasswordAsync('same-password');
    expect(a).not.toEqual(b);
    expect(await verifyPasswordAsync('same-password', a)).toBe(true);
    expect(await verifyPasswordAsync('same-password', b)).toBe(true);
  });

  it('verifies legacy djb2 hashes and flags them for upgrade', () => {
    const legacy = legacyDjb2Hash('legacy-pass');
    expect(isPbkdf2Hash(legacy)).toBe(false);
    expect(verifyPassword('legacy-pass', legacy)).toBe(true);
    expect(needsHashUpgrade(legacy)).toBe(true);
  });

  it('flags low-iteration PBKDF2 hashes for upgrade', () => {
    // Manually craft a 30k-iteration record shape (hash bytes irrelevant for needsHashUpgrade).
    const low = `pbkdf2$30000${'$'}${'ab'.repeat(16)}$${'cd'.repeat(32)}`;
    expect(needsHashUpgrade(low)).toBe(true);
    expect(needsHashUpgrade(hashPassword('x'))).toBe(false);
  });
});

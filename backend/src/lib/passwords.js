const crypto = require('crypto');

const ITERATIONS = 120000;
const KEYLEN = 64;
const DIGEST = 'sha512';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return {
    salt,
    hash: derivedKey,
    iterations: ITERATIONS,
    digest: DIGEST,
  };
}

function verifyPassword(password, record) {
  if (!record || !record.salt || !record.hash) {
    return false;
  }

  const iterations = Number(record.iterations || ITERATIONS);
  const digest = record.digest || DIGEST;
  const derivedKey = crypto.pbkdf2Sync(password, record.salt, iterations, KEYLEN, digest).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derivedKey, 'hex'), Buffer.from(record.hash, 'hex'));
}

module.exports = {
  hashPassword,
  verifyPassword,
};

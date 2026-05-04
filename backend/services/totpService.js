'use strict';
const crypto = require('crypto');
const cardCrypto = require('./cardCrypto');

// Tiny TOTP (RFC 6238) implementation — keeps us off speakeasy/otpauth as
// dependencies for the smallest possible attack surface. SHA-1 / 30-second /
// 6-digit, matching every common authenticator app (Google, Authy, 1Password).

const STEP = 30;
const DIGITS = 6;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).replace(/=+$/g, '').toUpperCase().replace(/\s+/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function code(secretBase32, t = Math.floor(Date.now() / 1000)) {
  const counter = Math.floor(t / STEP);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secretBase32)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const truncated = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(truncated % 10 ** DIGITS).padStart(DIGITS, '0');
}

function verify(secretBase32, token, window = 1) {
  if (!secretBase32 || !token) return false;
  const t = Math.floor(Date.now() / 1000);
  const target = String(token).padStart(DIGITS, '0');
  for (let w = -window; w <= window; w++) {
    if (code(secretBase32, t + w * STEP) === target) return true;
  }
  return false;
}

function otpauthUrl({ secret, label, issuer = 'NexBank' }) {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP)
  });
  const path = `${encodeURIComponent(issuer)}:${encodeURIComponent(label)}`;
  return `otpauth://totp/${path}?${params.toString()}`;
}

function encryptSecret(plain) { return cardCrypto.encrypt(plain); }
function decryptSecret(encrypted) { return cardCrypto.decrypt(encrypted); }

module.exports = { generateSecret, code, verify, otpauthUrl, encryptSecret, decryptSecret };

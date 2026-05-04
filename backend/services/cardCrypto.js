'use strict';
// Card-data encryption helper. AES-256-GCM when CARD_ENC_KEY is set, plain
// passthrough in demo mode (no key = no-op). The decrypt path detects the
// "v1:" prefix so legacy plaintext rows still read correctly after a key is
// provisioned later.
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY_HEX = process.env.CARD_ENC_KEY;

let key = null;
if (KEY_HEX && /^[0-9a-fA-F]{64}$/.test(KEY_HEX)) {
  key = Buffer.from(KEY_HEX, 'hex');
} else if (KEY_HEX) {
  console.warn('⚠️  CARD_ENC_KEY is invalid (need 64 hex chars). Storing card data in plain text — demo mode.');
} else {
  // Silent — demo mode default, log only on first encrypt to avoid spam.
}

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  if (!key) console.warn('ℹ️  CARD_ENC_KEY not set; CVVs stored in plain text. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

// "v1:<iv>:<authTag>:<ciphertext>" — plaintext otherwise.
function encrypt(plain) {
  if (plain == null) return plain;
  if (!key) { warnOnce(); return String(plain); }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(payload) {
  if (payload == null) return payload;
  if (typeof payload !== 'string' || !payload.startsWith('v1:')) return payload;
  if (!key) return payload; // ciphertext exists but no key — return as-is rather than throw
  const [, ivHex, tagHex, dataHex] = payload.split(':');
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return payload;
  }
}

module.exports = { encrypt, decrypt };

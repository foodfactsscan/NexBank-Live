'use strict';
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY_HEX = process.env.CARD_ENC_KEY;

let key = null;
if (KEY_HEX && /^[0-9a-fA-F]{64}$/.test(KEY_HEX)) {
  key = Buffer.from(KEY_HEX, 'hex');
}

function ensureKey() {
  if (!key) {
    throw new Error('CARD_ENC_KEY missing or invalid. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
}

// Encrypted format: "v1:<iv hex>:<authTag hex>:<ciphertext hex>"
// Plain values (legacy data) are detected by the absence of the "v1:" prefix.
function encrypt(plain) {
  if (plain == null) return plain;
  ensureKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(payload) {
  if (payload == null) return payload;
  if (typeof payload !== 'string' || !payload.startsWith('v1:')) {
    return payload;
  }
  ensureKey();
  const [, ivHex, tagHex, dataHex] = payload.split(':');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

module.exports = { encrypt, decrypt };

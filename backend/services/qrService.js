'use strict';
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const TTL_SECONDS = 5 * 60;
const ISSUER = 'nexbank-qr';

// QR payloads are short-lived signed JWTs so a payer can scan and trust the
// destination account without an extra round-trip to verify the number.
function encode({ accountNumber, name, accountId }) {
  return jwt.sign(
    { sub: 'pay-to', acc: accountNumber, n: name, aid: accountId },
    JWT_SECRET,
    { expiresIn: TTL_SECONDS, issuer: ISSUER }
  );
}

function decode(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: ISSUER });
  } catch {
    return null;
  }
}

module.exports = { encode, decode, TTL_SECONDS };

'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OneTimeCodes } = require('../models/db');
const mailer = require('./mailer');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;

// Six-digit OTP from crypto.randomInt — uniformly distributed, not modulo-biased.
function generateNumericCode() {
  const max = 10 ** OTP_LENGTH;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(OTP_LENGTH, '0');
}

async function issueAndDeliver({ identifier, purpose, deliverTo, subjectPrefix }) {
  await OneTimeCodes.invalidatePrior(identifier, purpose);
  const code = generateNumericCode();
  const codeHash = await bcrypt.hash(code, 10);
  await OneTimeCodes.create({
    identifier,
    purpose,
    codeHash,
    expiresAt: new Date(Date.now() + OTP_TTL_MS)
  });

  const subject = `${subjectPrefix} — your NexBank code`;
  const text = `Your code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`;
  await mailer.send({ to: deliverTo || identifier, subject, text }).catch(err => {
    console.error('OTP delivery failed:', err);
  });

  return { ttlSeconds: Math.floor(OTP_TTL_MS / 1000) };
}

async function verify({ identifier, purpose, code }) {
  const record = await OneTimeCodes.findActive(identifier, purpose);
  if (!record) return { ok: false, reason: 'not_found' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  const matches = await bcrypt.compare(String(code || ''), record.codeHash);
  if (!matches) {
    await OneTimeCodes.bumpAttempts(record._id);
    return { ok: false, reason: 'invalid' };
  }
  await OneTimeCodes.markUsed(record._id);
  return { ok: true };
}

module.exports = { issueAndDeliver, verify };

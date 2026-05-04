'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { RefreshTokens } = require('../models/db');

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

async function issuePair({ userId, email, accountId, deviceLabel, userAgent, ip }) {
  const accessToken = signAccessToken({ userId, email, accountId });
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await RefreshTokens.create({
    userId,
    tokenHash: hash(refreshToken),
    deviceLabel: deviceLabel || 'web',
    userAgent: userAgent || '',
    ip: ip || '',
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
  });
  return { accessToken, refreshToken, accessExpiresIn: 15 * 60 };
}

// Atomic rotation: the OLD refresh token is removed and a NEW one inserted in
// the same MongoDB transaction. Re-using a rotated token therefore fails — a
// classic refresh-token theft signal.
async function rotate({ presentedToken, deviceLabel, userAgent, ip, payloadOverrides = {} }) {
  const oldHash = hash(presentedToken);
  const existing = await RefreshTokens.findByHash(oldHash);
  if (!existing) return null;
  if (existing.expiresAt < new Date()) {
    await RefreshTokens.delete(oldHash);
    return null;
  }

  const newToken = crypto.randomBytes(48).toString('base64url');
  const newDoc = {
    userId: existing.userId,
    tokenHash: hash(newToken),
    deviceLabel: deviceLabel || existing.deviceLabel,
    userAgent: userAgent || existing.userAgent,
    ip: ip || existing.ip,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
  };
  await RefreshTokens.rotate(oldHash, newDoc);

  const accessToken = signAccessToken({
    userId: existing.userId.toString(),
    ...payloadOverrides
  });
  return { accessToken, refreshToken: newToken, accessExpiresIn: 15 * 60 };
}

async function revoke(token) {
  if (!token) return;
  await RefreshTokens.delete(hash(token));
}

module.exports = { issuePair, rotate, revoke, signAccessToken, hash, ACCESS_TTL, REFRESH_TTL_MS };

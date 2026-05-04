'use strict';
const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';

// Generic API ceiling — kept loose so legitimate dashboards don't hit it.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Login: keyed on email (or IP fallback). Stops credential stuffing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = (req.body && req.body.email) ? String(req.body.email).toLowerCase() : '';
    return email ? `login:${email}` : `login-ip:${req.ip}`;
  },
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' }
});

// Account enumeration on /verify-account and /lookup endpoints.
const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `lookup:${req.ip}`,
  message: { error: 'Too many lookup requests. Please slow down.' }
});

// Money movement — keyed on authenticated user, not IP, so shared NATs don't break.
const transferLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user ? `transfer:${req.user.userId}` : `transfer-ip:${req.ip}`,
  message: { error: 'Transfer rate limit reached. Please try again in an hour.' }
});

// Password change — same idea, smaller bucket.
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user ? `pwch:${req.user.userId}` : `pwch-ip:${req.ip}`,
  message: { error: 'Too many password change attempts. Please try again in an hour.' }
});

module.exports = {
  apiLimiter,
  loginLimiter,
  lookupLimiter,
  transferLimiter,
  passwordChangeLimiter
};

'use strict';
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body } = require('express-validator');

const { Users, Accounts, Notifications, Cards, RefreshTokens, User } = require('../models/db');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const otpService = require('../services/otpService');
const totpService = require('../services/totpService');
const refreshTokenService = require('../services/refreshTokenService');
const { loginLimiter, passwordChangeLimiter } = require('../middleware/rateLimit');

// ─── Password policy ─────────────────────────────────────────────────────────
// Demo-grade: 8 chars minimum, no complexity requirements. The legacy frontend
// shows "min 8 chars" in placeholder text and we honour that here so existing
// users can still register and reset their passwords without surprises.
const PASSWORD_RULE = body('password')
  .isString().withMessage('password is required')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateCardNumber() {
  const groups = [];
  for (let i = 0; i < 4; i++) {
    groups.push(String(crypto.randomInt(1000, 10000)));
  }
  return groups.join(' ');
}
function generateCVV() {
  return String(crypto.randomInt(100, 1000));
}
function generateExpiryDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}
function safeUser(u) {
  if (!u) return null;
  const o = u.toObject ? u.toObject() : { ...u };
  delete o.passwordHash;
  if (o.twoFA) delete o.twoFA.secret;
  return o;
}

const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_MS = 30 * 60 * 1000;

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register',
  validate([
    body('firstName').isString().trim().notEmpty(),
    body('lastName').isString().trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('phone').isString().trim().isLength({ min: 7, max: 20 }),
    PASSWORD_RULE
  ]),
  async (req, res) => {
    try {
      const { firstName, lastName, email, phone, password,
              dateOfBirth, address, gender, panNumber, aadharNumber, referralCode } = req.body;

      if (await Users.findByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
      if (await Users.findByPhone(phone)) return res.status(409).json({ error: 'Phone number already registered' });

      let referredBy = null;
      if (referralCode) {
        // Users is the wrapper API; the raw Mongoose model `User` is the one
        // with .findOne. Confusing both was a bug that 500'd registration.
        const referrer = await User.findOne({ referralCode: String(referralCode).toUpperCase() });
        if (referrer) referredBy = referrer._id;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await Users.create({
        firstName, lastName, email, phone, passwordHash,
        dateOfBirth, address, gender,
        panNumber: panNumber || null, aadharNumber: aadharNumber || null,
        kycStatus: 'pending', profilePicture: null,
        referralCode: generateReferralCode(),
        referredBy
      });

      const account = await Accounts.create({
        userId: user._id, accountType: 'savings',
        accountName: `${firstName} ${lastName}`,
        balance: 1000.00, currency: 'INR', interestRate: 3.5,
        minimumBalance: 500, ifscCode: 'NEXB0001234',
        branch: 'Main Branch', nomineeName: null
      });

      await Cards.create({
        userId: user._id, accountId: account._id, cardType: 'debit', cardNetwork: 'Visa',
        cardNumber: generateCardNumber(), cvv: generateCVV(), expiryDate: generateExpiryDate(),
        cardHolderName: `${firstName} ${lastName}`.toUpperCase(),
        status: 'active', dailyLimit: 100000, internationalUsage: false, contactlessEnabled: true
      });

      await Notifications.create({
        userId: user._id, type: 'welcome',
        title: 'Welcome to NexBank! 🎉',
        message: `Hello ${firstName}! Your account has been created. Account Number: ${account.accountNumber}. We've added ₹1,000 as a welcome bonus!`,
        icon: 'gift'
      });

      const tokens = await refreshTokenService.issuePair({
        userId: user._id.toString(),
        email: user.email,
        accountId: account._id.toString(),
        deviceLabel: 'web',
        userAgent: req.headers['user-agent'] || '',
        ip: req.ip
      });

      res.status(201).json({
        message: 'Account created successfully',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExpiresIn: tokens.accessExpiresIn,
        token: tokens.accessToken,                    // backward-compat for legacy frontend
        user: safeUser(user),
        account
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ 
        error: 'Registration failed due to a server error.',
        diagnostic: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
      });
    }
  });

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', loginLimiter,
  validate([
    body('password').isString().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('accountNumber').optional().isString(),
    body('totp').optional().isString()
  ]),
  async (req, res) => {
    try {
      const { email, password, accountNumber, totp } = req.body;
      let user = null;
      if (email) {
        user = await Users.findByEmail(email);
      } else if (accountNumber) {
        const account = await Accounts.findByAccountNumber(accountNumber);
        if (account) user = await Users.findById(account.userId);
      } else {
        return res.status(400).json({ error: 'email or accountNumber is required' });
      }
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return res.status(423).json({ error: 'Account temporarily locked. Try again later.' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        const failed = (user.failedLoginCount || 0) + 1;
        const updates = { failedLoginCount: failed };
        if (failed >= LOCKOUT_THRESHOLD) {
          updates.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
          updates.failedLoginCount = 0;
        }
        await User.updateOne({ _id: user._id }, updates);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // 2FA gate
      if (user.twoFA && user.twoFA.enabled) {
        if (!totp) {
          return res.status(401).json({ error: '2FA required', twoFARequired: true });
        }
        const secret = totpService.decryptSecret(user.twoFA.secret);
        if (!totpService.verify(secret, totp)) {
          return res.status(401).json({ error: 'Invalid 2FA code' });
        }
      }

      const accounts = await Accounts.findByUserId(user._id);
      const primaryAccount = accounts[0];

      await User.updateOne({ _id: user._id }, {
        lastLogin: new Date(),
        failedLoginCount: 0,
        lockedUntil: null
      });

      const tokens = await refreshTokenService.issuePair({
        userId: user._id.toString(),
        email: user.email,
        accountId: primaryAccount?._id?.toString(),
        deviceLabel: req.body.deviceLabel || 'web',
        userAgent: req.headers['user-agent'] || '',
        ip: req.ip
      });

      res.json({
        message: 'Login successful',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExpiresIn: tokens.accessExpiresIn,
        token: tokens.accessToken,
        user: safeUser(user),
        accounts
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ 
        error: 'Login failed due to a server error.',
        diagnostic: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
      });
    }
  });

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const presented = req.body && req.body.refreshToken;
  if (!presented) return res.status(400).json({ error: 'refreshToken required' });

  try {
    const rotated = await refreshTokenService.rotate({
      presentedToken: presented,
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip
    });
    if (!rotated) return res.status(401).json({ error: 'Invalid or expired refresh token' });
    res.json(rotated);
  } catch (err) {
    if (err && err.message === 'refresh token not found or already used') {
      return res.status(401).json({ error: 'Refresh token already used. Please log in again.' });
    }
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  await refreshTokenService.revoke(req.body && req.body.refreshToken);
  res.json({ message: 'Logged out' });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post('/forgot-password',
  validate([body('email').isEmail().normalizeEmail()]),
  async (req, res) => {
    const { email } = req.body;
    // Always respond 200 — leaking which emails exist would help enumeration.
    try {
      const user = await Users.findByEmail(email);
      if (user) {
        await otpService.issueAndDeliver({
          identifier: email,
          purpose: 'password-reset',
          deliverTo: email,
          subjectPrefix: 'Reset your password'
        });
      }
    } catch (err) {
      console.error('forgot-password error:', err);
    }
    res.json({ message: 'If that email exists, a reset code has been sent.' });
  });

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password',
  validate([
    body('email').isEmail().normalizeEmail(),
    body('code').isString().isLength({ min: 4, max: 10 }),
    PASSWORD_RULE
  ]),
  async (req, res) => {
    try {
      const { email, code, password } = req.body;
      const verdict = await otpService.verify({ identifier: email, purpose: 'password-reset', code });
      if (!verdict.ok) return res.status(400).json({ error: 'Invalid or expired code' });

      const user = await Users.findByEmail(email);
      if (!user) return res.status(400).json({ error: 'Invalid or expired code' });

      const passwordHash = await bcrypt.hash(password, 12);
      await User.updateOne({ _id: user._id }, { passwordHash, failedLoginCount: 0, lockedUntil: null });
      await RefreshTokens.deleteAllForUser(user._id);

      await Notifications.create({
        userId: user._id, type: 'security',
        title: 'Password reset',
        message: 'Your password was reset successfully. If this was not you, contact support immediately.',
        icon: 'lock'
      });

      res.json({ message: 'Password reset successful. Please log in.' });
    } catch (err) {
      console.error('reset-password error:', err);
      res.status(500).json({ error: 'Reset failed' });
    }
  });

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post('/change-password', authMiddleware, passwordChangeLimiter,
  validate([
    body('currentPassword').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ]),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await Users.findById(req.user.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

      const newHash = await bcrypt.hash(newPassword, 12);
      await User.updateOne({ _id: user._id }, { passwordHash: newHash });
      await RefreshTokens.deleteAllForUser(user._id);

      await Notifications.create({
        userId: user._id, type: 'security',
        title: 'Password changed',
        message: 'Your account password has been successfully changed. All other sessions have been signed out.',
        icon: 'lock'
      });
      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error('change-password error:', err);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await Users.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const accounts = await Accounts.findByUserId(user._id);
    res.json({ user: safeUser(user), accounts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// ─── 2FA / TOTP ──────────────────────────────────────────────────────────────
router.post('/2fa/enroll', authMiddleware, async (req, res) => {
  try {
    const user = await Users.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const secret = totpService.generateSecret();
    // Stash encrypted secret pending verification — we only mark `enabled:true`
    // once the user proves they can produce a valid code.
    await User.updateOne({ _id: user._id }, {
      'twoFA.secret': totpService.encryptSecret(secret),
      'twoFA.enabled': false
    });
    const otpauth = totpService.otpauthUrl({ secret, label: user.email });
    res.json({ secret, otpauth });
  } catch (err) {
    console.error('2fa enroll error:', err);
    res.status(500).json({ error: 'Failed to start 2FA enrollment' });
  }
});

router.post('/2fa/verify', authMiddleware,
  validate([body('code').isString().isLength({ min: 6, max: 6 })]),
  async (req, res) => {
    try {
      const user = await Users.findById(req.user.userId);
      if (!user || !user.twoFA || !user.twoFA.secret) {
        return res.status(400).json({ error: '2FA not initialized' });
      }
      const secret = totpService.decryptSecret(user.twoFA.secret);
      if (!totpService.verify(secret, req.body.code)) {
        return res.status(400).json({ error: 'Invalid code' });
      }
      // Issue 8 single-use backup codes (hashed at rest).
      const plain = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
      const hashed = await Promise.all(plain.map(c => bcrypt.hash(c, 8)));
      await User.updateOne({ _id: user._id }, { 'twoFA.enabled': true, 'twoFA.backupCodes': hashed });
      await Notifications.create({
        userId: user._id, type: 'security',
        title: 'Two-factor authentication enabled',
        message: 'Your account is now protected by an authenticator app.',
        icon: 'shield-check'
      });
      res.json({ message: '2FA enabled', backupCodes: plain });
    } catch (err) {
      console.error('2fa verify error:', err);
      res.status(500).json({ error: 'Failed to verify 2FA' });
    }
  });

router.post('/2fa/disable', authMiddleware,
  validate([
    body('password').isString().notEmpty(),
    body('code').optional().isString()
  ]),
  async (req, res) => {
    try {
      const user = await Users.findById(req.user.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const ok = await bcrypt.compare(req.body.password, user.passwordHash);
      if (!ok) return res.status(400).json({ error: 'Password is incorrect' });
      if (user.twoFA && user.twoFA.enabled) {
        const code = req.body.code;
        if (!code) return res.status(400).json({ error: '2FA code required' });
        const secret = totpService.decryptSecret(user.twoFA.secret);
        if (!totpService.verify(secret, code)) return res.status(400).json({ error: 'Invalid 2FA code' });
      }
      await User.updateOne({ _id: user._id }, {
        'twoFA.enabled': false, 'twoFA.secret': null, 'twoFA.backupCodes': []
      });
      await Notifications.create({
        userId: user._id, type: 'security',
        title: 'Two-factor authentication disabled',
        message: '2FA was turned off on your account. If this was not you, change your password and re-enable immediately.',
        icon: 'shield-off'
      });
      res.json({ message: '2FA disabled' });
    } catch (err) {
      console.error('2fa disable error:', err);
      res.status(500).json({ error: 'Failed to disable 2FA' });
    }
  });

module.exports = router;

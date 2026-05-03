const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Users, Accounts, Notifications, Cards } = require('../models/db');

const JWT_SECRET = process.env.JWT_SECRET || 'nexbank_secret_key_2024_ultra_secure';

function generateCardNumber() {
  const groups = [];
  for (let i = 0; i < 4; i++) {
    groups.push(Math.floor(1000 + Math.random() * 9000).toString());
  }
  return groups.join(' ');
}

function generateCVV() {
  return Math.floor(100 + Math.random() * 900).toString();
}

function generateExpiryDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, dateOfBirth, address, gender, panNumber, aadharNumber } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (Users.findByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    if (Users.findByPhone(phone)) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = Users.create({
      firstName, lastName, email: email.toLowerCase(), phone,
      passwordHash, dateOfBirth, address, gender,
      panNumber: panNumber || null, aadharNumber: aadharNumber || null,
      kycStatus: 'pending', profilePicture: null
    });

    // Auto-create Savings Account
    const account = Accounts.create({
      userId: user.id,
      accountType: 'savings',
      accountName: `${firstName} ${lastName}`,
      balance: 1000.00, // ₹1000 welcome bonus
      currency: 'INR',
      interestRate: 3.5,
      minimumBalance: 500,
      ifscCode: 'NEXB0001234',
      branch: 'Main Branch',
      nomineeName: null
    });

    // Create virtual debit card
    Cards.create({
      userId: user.id,
      accountId: account.id,
      cardType: 'debit',
      cardNetwork: 'Visa',
      cardNumber: generateCardNumber(),
      cvv: generateCVV(),
      expiryDate: generateExpiryDate(),
      cardHolderName: `${firstName} ${lastName}`.toUpperCase(),
      status: 'active',
      dailyLimit: 100000,
      internationalUsage: false,
      contactlessEnabled: true
    });

    // Welcome notification
    Notifications.create({
      userId: user.id,
      type: 'welcome',
      title: 'Welcome to NexBank! 🎉',
      message: `Hello ${firstName}! Your account has been created successfully. Your Account Number is ${account.accountNumber}. We've added ₹1,000 as a welcome bonus!`,
      icon: 'gift'
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, accountId: account.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: safeUser,
      account
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, accountNumber } = req.body;

    let user = null;
    if (email) {
      user = Users.findByEmail(email);
    } else if (accountNumber) {
      const account = Accounts.findByAccountNumber(accountNumber);
      if (account) user = Users.findById(account.userId);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accounts = Accounts.findByUserId(user.id);
    const primaryAccount = accounts[0];

    const token = jwt.sign(
      { userId: user.id, email: user.email, accountId: primaryAccount?.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    Users.update(user.id, { lastLogin: new Date().toISOString() });

    const { passwordHash: _, ...safeUser } = user;
    res.json({
      message: 'Login successful',
      token,
      user: safeUser,
      accounts
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/change-password
const authMiddleware = require('../middleware/auth');
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = Users.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) return res.status(400).json({ error: 'Current password is incorrect' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const newHash = await bcrypt.hash(newPassword, 12);
    Users.update(user.id, { passwordHash: newHash });

    Notifications.create({
      userId: user.id,
      type: 'security',
      title: 'Password Changed',
      message: 'Your account password has been successfully changed.',
      icon: 'lock'
    });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = Users.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash: _, ...safeUser } = user;
  const accounts = Accounts.findByUserId(user.id);
  res.json({ user: safeUser, accounts });
});

module.exports = router;

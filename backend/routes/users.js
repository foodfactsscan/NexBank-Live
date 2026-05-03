const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Users, Accounts, Cards, Loans, Notifications } = require('../models/db');
const mongoose = require('mongoose');

// GET /api/users/profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await Users.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    
    const accounts = await Accounts.findByUserId(user._id);
    const cards = await Cards.findByUserId(user._id);
    res.json({ user: safeUser, accounts, cards });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/users/profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, phone, address, dateOfBirth, gender, panNumber, aadharNumber } = req.body;
    const user = await Users.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await Users.update(req.user.userId, {
      firstName, lastName, phone, address, dateOfBirth, gender,
      panNumber, aadharNumber
    });

    // Update account names
    const accounts = await Accounts.findByUserId(req.user.userId);
    for (const acc of accounts) {
      await Accounts.update(acc._id, { accountName: `${firstName} ${lastName}` });
    }

    await Notifications.create({
      userId: req.user.userId,
      type: 'profile',
      title: 'Profile Updated',
      message: 'Your profile information has been successfully updated.',
      icon: 'user'
    });

    const safeUser = updated.toObject();
    delete safeUser.passwordHash;
    res.json({ message: 'Profile updated', user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/users/cards
router.get('/cards', authMiddleware, async (req, res) => {
  try {
    const cards = await Cards.findByUserId(req.user.userId);
    // Mask card numbers
    const maskedCards = cards.map(c => {
      const obj = c.toObject ? c.toObject() : c;
      return {
        ...obj,
        cardNumber: obj.cardNumber.replace(/\d{4}(?= \d{4})/g, '****').replace(/(\d{4}) (\d{4}) (\d{4})/, '**** **** ****'),
        cvv: '***'
      };
    });
    res.json({ cards: maskedCards });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// PUT /api/users/cards/:id - Update card settings
router.put('/cards/:id', authMiddleware, async (req, res) => {
  try {
    const userCards = await Cards.findByUserId(req.user.userId);
    const card = userCards.find(c => c._id.toString() === req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const { status, dailyLimit, internationalUsage, contactlessEnabled } = req.body;
    const updated = await Cards.update(req.params.id, { status, dailyLimit, internationalUsage, contactlessEnabled });

    const actionMsg = status === 'blocked' ? 'Card blocked successfully' : status === 'active' ? 'Card activated' : 'Card settings updated';
    await Notifications.create({
      userId: req.user.userId,
      type: 'card',
      title: 'Card Updated',
      message: actionMsg,
      icon: 'credit-card'
    });

    const updatedObj = updated.toObject();
    res.json({ 
      message: actionMsg, 
      card: { ...updatedObj, cvv: '***', cardNumber: updatedObj.cardNumber.replace(/\d{4}(?= \d{4})/g, '****') } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// POST /api/users/loans/apply - Apply for loan
router.post('/loans/apply', authMiddleware, async (req, res) => {
  try {
    const { loanType, amount, tenureMonths, purpose, monthlyIncome } = req.body;
    if (!loanType || !amount || !tenureMonths) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const rates = { personal: 12.5, home: 8.5, auto: 9.5, education: 10.5, gold: 7.5 };
    const interestRate = rates[loanType] || 12;
    const monthlyRate = interestRate / 100 / 12;
    const emi = parseFloat(((amount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1)).toFixed(2));

    const loan = await Loans.create({
      userId: req.user.userId,
      loanType,
      amount: parseFloat(amount),
      tenureMonths,
      interestRate,
      emi,
      purpose,
      monthlyIncome,
      status: 'under_review',
      applicationDate: new Date()
    });

    await Notifications.create({
      userId: req.user.userId,
      type: 'loan',
      title: 'Loan Application Received',
      message: `Your ${loanType} loan application for ₹${parseFloat(amount).toLocaleString('en-IN')} is under review. We'll notify you within 2-3 business days.`,
      icon: 'file-text'
    });

    res.status(201).json({
      message: 'Loan application submitted successfully',
      loan,
      calculatedEMI: emi,
      totalInterest: parseFloat((emi * tenureMonths - amount).toFixed(2)),
      totalPayable: parseFloat((emi * tenureMonths).toFixed(2))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to apply for loan' });
  }
});

// GET /api/users/loans
router.get('/loans', authMiddleware, async (req, res) => {
  try {
    const loans = await Loans.findByUserId(req.user.userId);
    res.json({ loans });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// GET /api/users/lookup/:accountNumber - Look up account holder (for sending money)
router.get('/lookup/:accountNumber', authMiddleware, async (req, res) => {
  try {
    const account = await Accounts.findByAccountNumber(req.params.accountNumber);
    if (!account || account.status !== 'active') {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ accountHolderName: account.accountName, accountNumber: account.accountNumber });
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed' });
  }
});

module.exports = router;

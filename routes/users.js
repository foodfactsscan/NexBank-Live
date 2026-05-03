const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Users, Accounts, Cards, Loans, Notifications } = require('../models/db');

// GET /api/users/profile
router.get('/profile', authMiddleware, (req, res) => {
  const user = Users.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash: _, ...safeUser } = user;
  const accounts = Accounts.findByUserId(user.id);
  const cards = Cards.findByUserId(user.id);
  res.json({ user: safeUser, accounts, cards });
});

// PUT /api/users/profile
router.put('/profile', authMiddleware, (req, res) => {
  const { firstName, lastName, phone, address, dateOfBirth, gender, panNumber, aadharNumber } = req.body;
  const user = Users.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updated = Users.update(req.user.userId, {
    firstName, lastName, phone, address, dateOfBirth, gender,
    panNumber, aadharNumber
  });

  // Update account names
  const accounts = Accounts.findByUserId(req.user.userId);
  accounts.forEach(acc => {
    Accounts.update(acc.id, { accountName: `${firstName} ${lastName}` });
  });

  Notifications.create({
    userId: req.user.userId,
    type: 'profile',
    title: 'Profile Updated',
    message: 'Your profile information has been successfully updated.',
    icon: 'user'
  });

  const { passwordHash: _, ...safeUser } = updated;
  res.json({ message: 'Profile updated', user: safeUser });
});

// GET /api/users/cards
router.get('/cards', authMiddleware, (req, res) => {
  const cards = Cards.findByUserId(req.user.userId);
  // Mask card numbers
  const maskedCards = cards.map(c => ({
    ...c,
    cardNumber: c.cardNumber.replace(/\d{4}(?= \d{4})/g, '****').replace(/(\d{4}) (\d{4}) (\d{4})/, '**** **** ****'),
    cvv: '***'
  }));
  res.json({ cards: maskedCards });
});

// PUT /api/users/cards/:id - Update card settings
router.put('/cards/:id', authMiddleware, (req, res) => {
  const card = Cards.findByUserId(req.user.userId).find(c => c.id === req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const { status, dailyLimit, internationalUsage, contactlessEnabled } = req.body;
  const updated = Cards.update(req.params.id, { status, dailyLimit, internationalUsage, contactlessEnabled });

  const actionMsg = status === 'blocked' ? 'Card blocked successfully' : status === 'active' ? 'Card activated' : 'Card settings updated';
  Notifications.create({
    userId: req.user.userId,
    type: 'card',
    title: 'Card Updated',
    message: actionMsg,
    icon: 'credit-card'
  });

  res.json({ message: actionMsg, card: { ...updated, cvv: '***', cardNumber: updated.cardNumber.replace(/\d{4}(?= \d{4})/g, '****') } });
});

// POST /api/users/loans/apply - Apply for loan
router.post('/loans/apply', authMiddleware, (req, res) => {
  const { loanType, amount, tenureMonths, purpose, monthlyIncome } = req.body;
  if (!loanType || !amount || !tenureMonths) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Interest rates by loan type
  const rates = {
    personal: 12.5,
    home: 8.5,
    auto: 9.5,
    education: 10.5,
    gold: 7.5
  };

  const interestRate = rates[loanType] || 12;
  const monthlyRate = interestRate / 100 / 12;
  const emi = parseFloat(((amount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1)).toFixed(2));

  const loan = Loans.create({
    userId: req.user.userId,
    loanType,
    amount: parseFloat(amount),
    tenureMonths,
    interestRate,
    emi,
    purpose,
    monthlyIncome,
    status: 'under_review',
    applicationDate: new Date().toISOString()
  });

  Notifications.create({
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
});

// GET /api/users/loans
router.get('/loans', authMiddleware, (req, res) => {
  const loans = Loans.findByUserId(req.user.userId);
  res.json({ loans });
});

// GET /api/users/lookup/:accountNumber - Look up account holder (for sending money)
router.get('/lookup/:accountNumber', authMiddleware, (req, res) => {
  const account = Accounts.findByAccountNumber(req.params.accountNumber);
  if (!account || account.status !== 'active') {
    return res.status(404).json({ error: 'Account not found' });
  }
  res.json({ accountHolderName: account.accountName, accountNumber: account.accountNumber });
});

module.exports = router;

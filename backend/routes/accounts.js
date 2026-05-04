const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Accounts, Transactions, Notifications, Users, FixedDeposits } = require('../models/db');
const mongoose = require('mongoose');

// GET /api/accounts - Get all accounts for logged-in user
router.get('/', authMiddleware, async (req, res) => {
  const accounts = await Accounts.findByUserId(req.user.userId);
  res.json({ accounts });
});

// GET /api/accounts/:id - Get single account details
router.get('/:id', authMiddleware, async (req, res) => {
  const account = await Accounts.findById(req.params.id);
  if (!account || account.userId.toString() !== req.user.userId) {
    return res.status(404).json({ error: 'Account not found' });
  }
  res.json({ account });
});

// GET /api/accounts/:id/statement - Get statement (transactions for account)
router.get('/:id/statement', authMiddleware, async (req, res) => {
  const account = await Accounts.findById(req.params.id);
  if (!account || account.userId.toString() !== req.user.userId) {
    return res.status(404).json({ error: 'Account not found' });
  }
  const limit = parseInt(req.query.limit) || 100;
  const transactions = await Transactions.findByAccountId(req.params.id, limit);

  // Compute running balance (reverse order for statement)
  const stmtTxns = [...transactions].reverse().map((t) => {
    const isCredit = t.toAccountId === req.params.id;
    return {
      ...t.toObject(),
      type: isCredit ? 'credit' : 'debit',
      amount: t.amount
    };
  });

  res.json({ account, transactions: stmtTxns.reverse() });
});

// GET /api/accounts/:id/summary - Get spending summary
router.get('/:id/summary', authMiddleware, async (req, res) => {
  const account = await Accounts.findById(req.params.id);
  if (!account || account.userId.toString() !== req.user.userId) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const allTxns = await Transactions.findByAccountId(req.params.id, 200); // Reduced limit for dashboard performance

  // Optimized summary calculation
  const monthlyData = [];
  const categories = {};
  let totalDebits = 0;
  let totalCredits = 0;

  // Pre-calculate month ranges to avoid repeated Date object creation
  const monthRanges = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    monthRanges.push({ start, end, label: start.toLocaleString('default', { month: 'short', year: '2-digit' }), credit: 0, debit: 0 });
  }

  allTxns.forEach(t => {
    const tDate = new Date(t.createdAt);
    const isCredit = t.toAccountId === req.params.id;
    const isDebit = t.fromAccountId === req.params.id;

    // This month totals
    if (tDate >= startOfMonth) {
      if (isCredit) totalCredits += t.amount;
      if (isDebit) {
        totalDebits += t.amount;
        const cat = t.category || 'Others';
        categories[cat] = (categories[cat] || 0) + t.amount;
      }
    }

    // Monthly buckets
    monthRanges.forEach(range => {
      if (tDate >= range.start && tDate <= range.end) {
        if (isCredit) range.credit += t.amount;
        if (isDebit) range.debit += t.amount;
      }
    });
  });

  res.json({
    summary: {
      currentBalance: account.balance,
      monthlyIncome: parseFloat(totalCredits.toFixed(2)),
      monthlyExpense: parseFloat(totalDebits.toFixed(2)),
      netSavings: parseFloat((totalCredits - totalDebits).toFixed(2)),
      categoryBreakdown: categories,
      monthlyData: monthRanges.map(r => ({ month: r.label, credit: r.credit, debit: r.debit }))
    }
  });
});

// POST /api/accounts/fd/create - Open Fixed Deposit
router.post('/fd/create', authMiddleware, async (req, res) => {
  try {
    const { accountId, amount, tenureMonths, interestRate } = req.body;
    const account = await Accounts.findById(accountId);
    if (!account || account.userId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const transferAmount = parseFloat(parseFloat(amount).toFixed(2));
    if (transferAmount < 1000) return res.status(400).json({ error: 'Minimum FD amount is ₹1,000' });
    if (account.balance < transferAmount) return res.status(400).json({ error: 'Insufficient balance' });

    // Deduct from account
    await Accounts.updateBalance(accountId, -transferAmount);

    // Calculate maturity
    const rate = interestRate || 6.5;
    const maturityAmount = parseFloat((transferAmount * Math.pow(1 + rate / 100 / 4, 4 * (tenureMonths / 12))).toFixed(2));
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + tenureMonths);

    const fd = await FixedDeposits.create({
      userId: req.user.userId,
      accountId,
      principalAmount: transferAmount,
      interestRate: rate,
      tenureMonths,
      maturityAmount,
      maturityDate: maturityDate,
      status: 'active',
      fdNumber: 'FD' + Date.now()
    });

    // Create transaction record
    await Transactions.create({
      fromAccountId: accountId,
      toAccountId: 'FD_ACCOUNT',
      amount: transferAmount,
      type: 'fd_creation',
      category: 'Investment',
      description: `Fixed Deposit Created - ${tenureMonths} months`,
      mode: 'internal'
    });

    await Notifications.create({
      userId: req.user.userId,
      type: 'fd',
      title: 'Fixed Deposit Created',
      message: `Your FD of ₹${transferAmount.toLocaleString('en-IN')} has been created. Matures on ${maturityDate.toLocaleDateString('en-IN')}.`,
      icon: 'trending-up'
    });

    // Broadcast real-time
    const broadcast = req.app.locals.broadcastToAccount;
    const updatedAcc = await Accounts.findById(accountId);
    if (broadcast) {
      broadcast(accountId, { type: 'balance_update', accountId, balance: updatedAcc.balance });
    }

    res.status(201).json({ message: 'Fixed Deposit created successfully', fd, updatedAccount: updatedAcc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create Fixed Deposit' });
  }
});

// GET /api/accounts/fd/list
router.get('/fd/list', authMiddleware, async (req, res) => {
  const fds = await FixedDeposits.findByUserId(req.user.userId);
  res.json({ fixedDeposits: fds });
});

// POST /api/accounts/fd/:id/break
router.post('/fd/:id/break', authMiddleware, async (req, res) => {
  try {
    const fdId = req.params.id;
    const fds = await FixedDeposits.findByUserId(req.user.userId);
    const fd = fds.find(f => f._id.toString() === fdId);
    
    if (!fd) return res.status(404).json({ error: 'Fixed Deposit not found' });
    if (fd.status !== 'active') return res.status(400).json({ error: 'FD is already ' + fd.status });

    // Calculate return (penalty applied for breaking)
    const returnAmount = parseFloat((fd.principalAmount * 1.01).toFixed(2));

    // Update FD status
    await FixedDeposits.update(fdId, { status: 'closed' });

    // Credit to account
    await Accounts.updateBalance(fd.accountId.toString(), returnAmount);

    // Create transaction record
    await Transactions.create({
      fromAccountId: 'FD_ACCOUNT',
      toAccountId: fd.accountId.toString(),
      amount: returnAmount,
      type: 'fd_break',
      category: 'Investment',
      description: `FD Broken Early - Principal + 1% (${fd.fdNumber})`,
      mode: 'internal'
    });

    await Notifications.create({
      userId: req.user.userId,
      type: 'fd',
      title: 'Fixed Deposit Closed',
      message: `Your FD ${fd.fdNumber} was broken. ₹${returnAmount.toLocaleString('en-IN')} has been credited.`,
      icon: 'check-circle'
    });

    // Broadcast real-time
    const broadcast = req.app.locals.broadcastToAccount;
    const acc = await Accounts.findById(fd.accountId.toString());
    if (broadcast) {
      broadcast(fd.accountId.toString(), { type: 'balance_update', accountId: fd.accountId.toString(), balance: acc.balance });
    }

    res.status(200).json({ message: 'FD broken successfully. Funds credited.', fd, updatedAccount: acc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to break Fixed Deposit' });
  }
});

// PUT /api/accounts/:id/update
router.put('/:id/update', authMiddleware, async (req, res) => {
  try {
    const account = await Accounts.findById(req.params.id);
    if (!account || account.userId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const { nomineeName, minimumBalance } = req.body;
    const updated = await Accounts.update(req.params.id, { nomineeName, minimumBalance });
    res.json({ message: 'Account updated', account: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});

module.exports = router;

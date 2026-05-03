const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Accounts, Transactions, Notifications, Users, FixedDeposits } = require('../models/db');

// GET /api/accounts - Get all accounts for logged-in user
router.get('/', authMiddleware, (req, res) => {
  const accounts = Accounts.findByUserId(req.user.userId);
  res.json({ accounts });
});

// GET /api/accounts/:id - Get single account details
router.get('/:id', authMiddleware, (req, res) => {
  const account = Accounts.findById(req.params.id);
  if (!account || account.userId !== req.user.userId) {
    return res.status(404).json({ error: 'Account not found' });
  }
  res.json({ account });
});

// GET /api/accounts/:id/statement - Get statement (transactions for account)
router.get('/:id/statement', authMiddleware, (req, res) => {
  const account = Accounts.findById(req.params.id);
  if (!account || account.userId !== req.user.userId) {
    return res.status(404).json({ error: 'Account not found' });
  }
  const limit = parseInt(req.query.limit) || 100;
  const transactions = Transactions.findByAccountId(req.params.id, limit);

  // Compute running balance (reverse order for statement)
  const stmtTxns = [...transactions].reverse().map((t, i, arr) => {
    const isCredit = t.toAccountId === account.id;
    return {
      ...t,
      type: isCredit ? 'credit' : 'debit',
      amount: t.amount
    };
  });

  res.json({ account, transactions: stmtTxns.reverse() });
});

// GET /api/accounts/:id/summary - Get spending summary
router.get('/:id/summary', authMiddleware, (req, res) => {
  const account = Accounts.findById(req.params.id);
  if (!account || account.userId !== req.user.userId) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const allTxns = Transactions.findByAccountId(req.params.id, 1000);

  const thisMonthTxns = allTxns.filter(t => new Date(t.createdAt) >= startOfMonth);

  const totalDebits = thisMonthTxns
    .filter(t => t.fromAccountId === req.params.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCredits = thisMonthTxns
    .filter(t => t.toAccountId === req.params.id)
    .reduce((sum, t) => sum + t.amount, 0);

  // Category breakdown
  const categories = {};
  thisMonthTxns.filter(t => t.fromAccountId === req.params.id).forEach(t => {
    const cat = t.category || 'Others';
    categories[cat] = (categories[cat] || 0) + t.amount;
  });

  // Last 6 months
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const mTxns = allTxns.filter(t => {
      const d = new Date(t.createdAt);
      return d >= mStart && d <= mEnd;
    });
    const credit = mTxns.filter(t => t.toAccountId === req.params.id).reduce((s, t) => s + t.amount, 0);
    const debit = mTxns.filter(t => t.fromAccountId === req.params.id).reduce((s, t) => s + t.amount, 0);
    monthlyData.push({
      month: mStart.toLocaleString('default', { month: 'short', year: '2-digit' }),
      credit: parseFloat(credit.toFixed(2)),
      debit: parseFloat(debit.toFixed(2))
    });
  }

  res.json({
    summary: {
      currentBalance: account.balance,
      monthlyIncome: parseFloat(totalCredits.toFixed(2)),
      monthlyExpense: parseFloat(totalDebits.toFixed(2)),
      netSavings: parseFloat((totalCredits - totalDebits).toFixed(2)),
      categoryBreakdown: categories,
      monthlyData
    }
  });
});

// POST /api/accounts/fd - Open Fixed Deposit
router.post('/fd/create', authMiddleware, (req, res) => {
  try {
    const { accountId, amount, tenureMonths, interestRate } = req.body;
    const account = Accounts.findById(accountId);
    if (!account || account.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (amount < 1000) return res.status(400).json({ error: 'Minimum FD amount is ₹1,000' });
    if (account.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    // Deduct from account
    Accounts.updateBalance(accountId, -amount);

    // Calculate maturity
    const rate = interestRate || 6.5;
    const maturityAmount = parseFloat((amount * Math.pow(1 + rate / 100 / 4, 4 * (tenureMonths / 12))).toFixed(2));
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + tenureMonths);

    const fd = FixedDeposits.create({
      userId: req.user.userId,
      accountId,
      principalAmount: amount,
      interestRate: rate,
      tenureMonths,
      maturityAmount,
      maturityDate: maturityDate.toISOString(),
      status: 'active',
      fdNumber: 'FD' + Date.now()
    });

    // Create transaction record
    Transactions.create({
      fromAccountId: accountId,
      toAccountId: 'FD_ACCOUNT',
      amount,
      type: 'fd_creation',
      category: 'Investment',
      description: `Fixed Deposit Created - ${tenureMonths} months`,
      mode: 'internal'
    });

    const user = Users.findById(req.user.userId);
    Notifications.create({
      userId: req.user.userId,
      type: 'fd',
      title: 'Fixed Deposit Created',
      message: `Your FD of ₹${amount.toLocaleString('en-IN')} has been created. Matures on ${maturityDate.toLocaleDateString('en-IN')}.`,
      icon: 'trending-up'
    });

    // Broadcast real-time
    const broadcast = req.app.locals.broadcastToAccount;
    const acc = Accounts.findById(accountId);
    if (broadcast) {
      broadcast(req.user.accountId, { type: 'balance_update', accountId, balance: acc.balance });
    }

    res.status(201).json({ message: 'Fixed Deposit created successfully', fd, updatedAccount: acc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create Fixed Deposit' });
  }
});

// GET /api/accounts/fd/list
router.get('/fd/list', authMiddleware, (req, res) => {
  const fds = FixedDeposits.findByUserId(req.user.userId);
  res.json({ fixedDeposits: fds });
});

// POST /api/accounts/fd/:id/break
router.post('/fd/:id/break', authMiddleware, (req, res) => {
  try {
    const fdId = req.params.id;
    const fds = FixedDeposits.findByUserId(req.user.userId);
    const fd = fds.find(f => f.id === fdId);
    
    if (!fd) return res.status(404).json({ error: 'Fixed Deposit not found' });
    if (fd.status !== 'active') return res.status(400).json({ error: 'FD is already ' + fd.status });

    // Calculate return (penalty applied for breaking)
    // Real-world: compute days active. For this implementation, return Principal + 1% interest if broken early.
    const returnAmount = parseFloat((fd.principalAmount * 1.01).toFixed(2));

    // Update FD status
    FixedDeposits.update(fdId, {
      status: 'closed',
      updatedAt: new Date().toISOString()
    });

    // Credit to account
    Accounts.updateBalance(fd.accountId, returnAmount);

    // Create transaction record
    Transactions.create({
      fromAccountId: 'FD_ACCOUNT',
      toAccountId: fd.accountId,
      amount: returnAmount,
      type: 'fd_break',
      category: 'Investment',
      description: `FD Broken Early - Principal + 1% (${fd.fdNumber})`,
      mode: 'internal'
    });

    Notifications.create({
      userId: req.user.userId,
      type: 'fd',
      title: 'Fixed Deposit Closed',
      message: `Your FD ${fd.fdNumber} was broken. ₹${returnAmount.toLocaleString('en-IN')} has been credited.`,
      icon: 'check-circle'
    });

    // Broadcast real-time
    const broadcast = req.app.locals.broadcastToAccount;
    const acc = Accounts.findById(fd.accountId);
    if (broadcast) {
      broadcast(req.user.accountId, { type: 'balance_update', accountId: fd.accountId, balance: acc.balance });
    }

    res.status(200).json({ message: 'FD broken successfully. Funds credited.', fd, updatedAccount: acc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to break Fixed Deposit' });
  }
});

// PUT /api/accounts/:id/update-profile
router.put('/:id/update', authMiddleware, (req, res) => {
  const account = Accounts.findById(req.params.id);
  if (!account || account.userId !== req.user.userId) {
    return res.status(404).json({ error: 'Account not found' });
  }
  const { nomineeName, minimumBalance } = req.body;
  const updated = Accounts.update(req.params.id, { nomineeName, minimumBalance });
  res.json({ message: 'Account updated', account: updated });
});

module.exports = router;

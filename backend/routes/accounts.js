const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Accounts, Transactions, Notifications, Users, FixedDeposits, Transaction } = require('../models/db');
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

  // Ultra-Performant Single-Query Aggregation
  try {
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    const summaryAgg = await Transaction.aggregate([
      { $match: { 
          $or: [{ fromAccountId: req.params.id }, { toAccountId: req.params.id }],
          createdAt: { $gte: sixMonthsAgo }
      }},
      { $facet: {
          "thisMonth": [
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: {
                _id: null,
                income: { $sum: { $cond: [{ $eq: ["$toAccountId", req.params.id] }, "$amount", 0] } },
                expense: { $sum: { $cond: [{ $eq: ["$fromAccountId", req.params.id] }, "$amount", 0] } },
                categories: { $push: { $cond: [{ $eq: ["$fromAccountId", req.params.id] }, { cat: "$category", amt: "$amount" }, "$$REMOVE"] } }
            }}
          ],
          "trends": [
            { $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                credit: { $sum: { $cond: [{ $eq: ["$toAccountId", req.params.id] }, "$amount", 0] } },
                debit: { $sum: { $cond: [{ $eq: ["$fromAccountId", req.params.id] }, "$amount", 0] } }
            }},
            { $sort: { "_id": 1 } }
          ]
      }}
    ]);

    const result = summaryAgg[0];
    const monthData = result.thisMonth[0] || { income: 0, expense: 0, categories: [] };
    
    const categoryBreakdown = {};
    monthData.categories.forEach(c => {
      if (c && c.cat) categoryBreakdown[c.cat] = (categoryBreakdown[c.cat] || 0) + c.amt;
    });

    // Format monthly trend data
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const trend = result.trends.find(t => t._id === key) || { credit: 0, debit: 0 };
      monthlyData.push({
        month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
        credit: parseFloat(trend.credit.toFixed(2)),
        debit: parseFloat(trend.debit.toFixed(2))
      });
    }

    res.json({
      summary: {
        currentBalance: account.balance,
        monthlyIncome: parseFloat(monthData.income.toFixed(2)),
        monthlyExpense: parseFloat(monthData.expense.toFixed(2)),
        netSavings: parseFloat((monthData.income - monthData.expense).toFixed(2)),
        categoryBreakdown,
        monthlyData
      }
    });
  } catch (err) {
    console.error('Ultra Summary Error:', err);
    res.status(500).json({ error: 'System busy. Please try again.' });
  }
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

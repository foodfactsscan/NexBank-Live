const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Users, Accounts, Transactions, FixedDeposits, Loans, Cards } = require('../models/db');

// Admin Auth Middleware
const adminAuth = (req, res, next) => {
  const user = Users.findById(req.user.userId);
  if (user && user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access Denied: Admin privileges required' });
  }
};

// GET /api/admin/stats
router.get('/stats', authMiddleware, adminAuth, (req, res) => {
  const allUsers = Users.getAll();
  const allAccounts = Accounts.getAll();
  const allTxns = Transactions.getAll();
  const allLoans = Loans.findByUserId ? Loans.findByUserId() : require('../models/db')._data?.loans || [];

  const totalBalance = allAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalUsers = allUsers.filter(u => u.role !== 'admin').length;
  const activeLoans = allLoans.length;

  res.json({
    totalBalance,
    totalUsers,
    activeLoans,
    totalTransactions: allTxns.length
  });
});

// GET /api/admin/users
router.get('/users', authMiddleware, adminAuth, (req, res) => {
  const users = Users.getAll().filter(u => u.role !== 'admin').map(u => {
    const acc = Accounts.findByUserId(u.id)[0];
    return {
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      phone: u.phone,
      accountNumber: acc ? acc.accountNumber : 'N/A',
      balance: acc ? acc.balance : 0,
      status: acc ? acc.status : 'inactive'
    };
  });
  res.json({ users });
});

// POST /api/admin/users/:id/block
router.post('/users/:id/block', authMiddleware, adminAuth, (req, res) => {
  const acc = Accounts.findById(req.params.id);
  if(!acc) return res.status(404).json({ error: 'Account not found' });
  Accounts.update(acc.id, { status: acc.status === 'blocked' ? 'active' : 'blocked' });
  res.json({ message: 'Account status updated', status: acc.status === 'blocked' ? 'active' : 'blocked' });
});

module.exports = router;

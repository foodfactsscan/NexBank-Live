const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Users, Accounts, Transactions, FixedDeposits, Loans, Cards } = require('../models/db');

// Admin Auth Middleware
const adminAuth = async (req, res, next) => {
  try {
    const user = await Users.findById(req.user.userId);
    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Access Denied: Admin privileges required' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error during admin auth' });
  }
};

// GET /api/admin/stats
router.get('/stats', authMiddleware, adminAuth, async (req, res) => {
  try {
    const [allUsers, allAccounts, allTxns, activeLoans] = await Promise.all([
      Users.getAll(),
      Accounts.getAll(),
      Transactions.getAll(),
      Loans.countActive()
    ]);

    const totalBalance = allAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalUsers = allUsers.filter(u => u.role !== 'admin').length;
    const totalTransactions = allTxns.length;

    res.json({
      totalBalance,
      totalUsers,
      activeLoans,
      totalTransactions
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/admin/users
router.get('/users', authMiddleware, adminAuth, async (req, res) => {
  try {
    const allUsers = await Users.getAll();
    const usersList = [];
    
    const targetUsers = allUsers.filter(u => u.role !== 'admin');
    
    for (const u of targetUsers) {
      const accounts = await Accounts.findByUserId(u._id);
      const acc = accounts[0];
      usersList.push({
        id: u._id.toString(),
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        phone: u.phone,
        accountNumber: acc ? acc.accountNumber : 'N/A',
        balance: acc ? acc.balance : 0,
        status: acc ? acc.status : 'inactive'
      });
    }
    
    res.json({ users: usersList });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users list' });
  }
});

// POST /api/admin/users/:id/block
router.post('/users/:id/block', authMiddleware, adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const accounts = await Accounts.findByUserId(userId);
    const acc = accounts[0];
    
    if(!acc) return res.status(404).json({ error: 'Account not found' });
    
    const newStatus = acc.status === 'blocked' ? 'active' : 'blocked';
    await Accounts.update(acc._id, { status: newStatus });
    
    res.json({ message: 'Account status updated', status: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account status' });
  }
});

module.exports = router;

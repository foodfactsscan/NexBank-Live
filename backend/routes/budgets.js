'use strict';
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { Budgets, Accounts, Transaction, mongoose } = require('../models/db');

router.use(authMiddleware);

// GET /budgets — list with current-month spent + alert flags
router.get('/', async (req, res) => {
  const budgets = await Budgets.findByUserId(req.user.userId);
  const accounts = await Accounts.findByUserId(req.user.userId);
  const accountIds = accounts.map(a => a._id.toString());
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);

  const agg = await Transaction.aggregate([
    { $match: { fromAccountId: { $in: accountIds }, createdAt: { $gte: start } } },
    { $group: { _id: '$category', spent: { $sum: '$amount' } } }
  ]);
  const spentByCategory = Object.fromEntries(agg.map(r => [r._id || 'Other', r.spent]));

  res.json({
    budgets: budgets.map(b => {
      const spent = spentByCategory[b.category] || 0;
      const ratio = b.monthlyLimit > 0 ? spent / b.monthlyLimit : 0;
      return {
        category: b.category,
        monthlyLimit: b.monthlyLimit,
        alertThreshold: b.alertThreshold,
        spent,
        ratio,
        breached: ratio >= 1,
        warning: ratio >= b.alertThreshold && ratio < 1
      };
    })
  });
});

// PUT /budgets/:category — upsert a budget for one category
router.put('/:category',
  validate([
    body('monthlyLimit').isFloat({ gt: 0 }),
    body('alertThreshold').optional().isFloat({ gt: 0, lt: 1 })
  ]),
  async (req, res) => {
    const category = req.params.category;
    const updated = await Budgets.upsert(
      req.user.userId, category,
      Math.round(parseFloat(req.body.monthlyLimit) * 100) / 100,
      parseFloat(req.body.alertThreshold || 0.8)
    );
    res.json({ budget: updated });
  });

// DELETE /budgets/:category
router.delete('/:category', async (req, res) => {
  await Budgets.delete(req.user.userId, req.params.category);
  res.json({ message: 'Budget removed' });
});

module.exports = router;

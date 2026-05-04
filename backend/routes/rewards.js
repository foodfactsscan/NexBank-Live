'use strict';
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const { Rewards, User } = require('../models/db');

router.use(authMiddleware);

router.get('/balance', async (req, res) => {
  const total = await Rewards.totalForUser(req.user.userId);
  res.json({ balance: total });
});

router.get('/history', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const items = await Rewards.findByUserId(req.user.userId, limit);
  res.json({ rewards: items });
});

router.get('/referral-code', async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ code: user.referralCode || null });
});

module.exports = router;

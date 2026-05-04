'use strict';
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const idempotency = require('../middleware/idempotency');
const { Goals, Accounts, Account, mongoose } = require('../models/db');

router.use(authMiddleware);

// GET /goals — list user's savings goals
router.get('/', async (req, res) => {
  const goals = await Goals.findByUserId(req.user.userId);
  res.json({ goals });
});

// POST /goals — create a new goal
router.post('/',
  validate([
    body('name').isString().trim().isLength({ min: 1, max: 80 }),
    body('targetAmount').isFloat({ gt: 0 }),
    body('accountId').isString().notEmpty(),
    body('deadline').optional().isISO8601(),
    body('icon').optional().isString().isLength({ max: 32 })
  ]),
  async (req, res) => {
    const { name, targetAmount, accountId, deadline, icon } = req.body;
    const account = await Accounts.findById(accountId);
    if (!account || account.userId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const goal = await Goals.create({
      userId: req.user.userId,
      accountId,
      name,
      icon: icon || 'target',
      targetAmount: Math.round(targetAmount * 100) / 100,
      currentAmount: 0,
      deadline: deadline ? new Date(deadline) : null,
      status: 'active'
    });
    res.status(201).json({ goal });
  });

// POST /goals/:id/contribute — atomic move from main account into goal vault
router.post('/:id/contribute',
  idempotency('goal-contribute'),
  validate([body('amount').isFloat({ gt: 0 })]),
  async (req, res) => {
    const goal = await Goals.findById(req.params.id);
    if (!goal || goal.userId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    if (goal.status !== 'active') return res.status(400).json({ error: 'Goal is not active' });

    const amount = Math.round(parseFloat(req.body.amount) * 100) / 100;
    const session = await mongoose.startSession();
    try {
      let updatedGoal, updatedAccount;
      await session.withTransaction(async () => {
        const debited = await Account.findOneAndUpdate(
          { _id: goal.accountId, userId: req.user.userId, status: 'active', balance: { $gte: amount } },
          { $inc: { balance: -amount } },
          { new: true, session }
        );
        if (!debited) throw new Error('Insufficient balance or account inactive');
        updatedAccount = debited;
        updatedGoal = await (await Goals.findById(goal._id)).constructor
          .findByIdAndUpdate(goal._id, { $inc: { currentAmount: amount } }, { new: true, session });
        if (updatedGoal.currentAmount >= updatedGoal.targetAmount) {
          updatedGoal.status = 'completed';
          await updatedGoal.save({ session });
        }
      });
      res.json({ goal: updatedGoal, account: updatedAccount });
    } catch (err) {
      const msg = err.message === 'Insufficient balance or account inactive'
        ? err.message : 'Goal contribution failed';
      res.status(400).json({ error: msg });
    } finally {
      session.endSession();
    }
  });

// POST /goals/:id/withdraw — pull money back out of a goal
router.post('/:id/withdraw',
  validate([body('amount').isFloat({ gt: 0 })]),
  async (req, res) => {
    const goal = await Goals.findById(req.params.id);
    if (!goal || goal.userId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    const amount = Math.round(parseFloat(req.body.amount) * 100) / 100;
    if (amount > goal.currentAmount) return res.status(400).json({ error: 'Goal does not have that much saved' });

    const session = await mongoose.startSession();
    try {
      let updatedGoal, updatedAccount;
      await session.withTransaction(async () => {
        updatedGoal = await (await Goals.findById(goal._id)).constructor
          .findOneAndUpdate(
            { _id: goal._id, userId: req.user.userId, currentAmount: { $gte: amount } },
            { $inc: { currentAmount: -amount } },
            { new: true, session }
          );
        if (!updatedGoal) throw new Error('Goal balance changed concurrently');
        updatedAccount = await Account.findOneAndUpdate(
          { _id: goal.accountId, userId: req.user.userId },
          { $inc: { balance: amount } },
          { new: true, session }
        );
      });
      res.json({ goal: updatedGoal, account: updatedAccount });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Withdrawal failed' });
    } finally {
      session.endSession();
    }
  });

// DELETE /goals/:id — only if balance is zero
router.delete('/:id', async (req, res) => {
  const goal = await Goals.findById(req.params.id);
  if (!goal || goal.userId.toString() !== req.user.userId) {
    return res.status(404).json({ error: 'Goal not found' });
  }
  if (goal.currentAmount > 0) {
    return res.status(400).json({ error: 'Withdraw all funds before deleting the goal' });
  }
  await Goals.delete(goal._id, req.user.userId);
  res.json({ message: 'Goal deleted' });
});

module.exports = router;

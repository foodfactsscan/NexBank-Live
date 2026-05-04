'use strict';
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const idempotency = require('../middleware/idempotency');
const { MoneyRequests, Accounts, Notifications, User } = require('../models/db');
const { executeTransfer, TransferError } = require('../services/transferService');
const { categorize } = require('../services/categorize');
const pushService = require('../services/pushService');

router.use(authMiddleware);

// GET /money-requests — incoming + outgoing
router.get('/', async (req, res) => {
  const [incoming, outgoing] = await Promise.all([
    MoneyRequests.findIncoming(req.user.userId),
    MoneyRequests.findOutgoing(req.user.userId)
  ]);
  res.json({ incoming, outgoing });
});

// POST /money-requests — request money from another user (by username)
router.post('/',
  validate([
    body('username').isString().trim().toLowerCase().matches(/^[a-z0-9_.]{3,32}$/),
    body('amount').isFloat({ gt: 0 }),
    body('fromAccountId').isString().notEmpty(),
    body('note').optional().isString().isLength({ max: 200 })
  ]),
  async (req, res) => {
    const { username, amount, fromAccountId, note } = req.body;
    const payer = await User.findOne({ username });
    if (!payer) return res.status(404).json({ error: 'No user with that username' });
    if (payer._id.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Cannot request from yourself' });
    }
    const myAccount = await Accounts.findById(fromAccountId);
    if (!myAccount || myAccount.userId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Your account not found' });
    }

    const reqDoc = await MoneyRequests.create({
      fromUserId: req.user.userId,
      toUserId: payer._id,
      fromAccountId: myAccount._id,
      amount: Math.round(parseFloat(amount) * 100) / 100,
      note: note || '',
      status: 'pending'
    });

    Notifications.create({
      userId: payer._id, type: 'request',
      title: 'New money request',
      message: `${myAccount.accountName} requested ₹${reqDoc.amount.toLocaleString('en-IN')} ${note ? '— ' + note : ''}`,
      icon: 'inbox'
    }).catch(() => {});
    pushService.sendToUser(payer._id, {
      title: 'New money request',
      body: `₹${reqDoc.amount.toLocaleString('en-IN')} from ${myAccount.accountName}`,
      url: '/?page=requests'
    }).catch(() => {});

    res.status(201).json({ moneyRequest: reqDoc });
  });

// POST /money-requests/:id/pay — pay a pending request
router.post('/:id/pay',
  idempotency('moneyrequest-pay'),
  validate([body('fromAccountId').isString().notEmpty()]),
  async (req, res) => {
    try {
      const reqDoc = await MoneyRequests.findById(req.params.id);
      if (!reqDoc || reqDoc.toUserId.toString() !== req.user.userId) {
        return res.status(404).json({ error: 'Request not found' });
      }
      if (reqDoc.status !== 'pending') return res.status(400).json({ error: `Request is ${reqDoc.status}` });

      const requesterAccount = await Accounts.findById(reqDoc.fromAccountId);
      if (!requesterAccount) return res.status(400).json({ error: 'Requester account no longer exists' });

      const result = await executeTransfer({
        fromAccountId: req.body.fromAccountId,
        toAccountNumber: requesterAccount.accountNumber,
        amount: reqDoc.amount,
        mode: 'UPI',
        description: `Paid request: ${reqDoc.note || ''}`.trim(),
        category: categorize({ description: reqDoc.note || '', category: 'Transfer' }),
        userId: req.user.userId
      });
      await MoneyRequests.update(reqDoc._id, { status: 'paid', paidTxnId: result.transaction.transactionId });
      res.json({ moneyRequest: { ...reqDoc.toObject(), status: 'paid' }, transaction: result.transaction });
    } catch (err) {
      if (err instanceof TransferError) return res.status(err.statusCode).json({ error: err.message });
      console.error('pay request error:', err);
      res.status(500).json({ error: 'Failed to pay request' });
    }
  });

router.post('/:id/decline', async (req, res) => {
  const reqDoc = await MoneyRequests.findById(req.params.id);
  if (!reqDoc || reqDoc.toUserId.toString() !== req.user.userId) {
    return res.status(404).json({ error: 'Request not found' });
  }
  if (reqDoc.status !== 'pending') return res.status(400).json({ error: `Request is ${reqDoc.status}` });
  await MoneyRequests.update(reqDoc._id, { status: 'declined' });
  res.json({ message: 'Request declined' });
});

router.post('/:id/cancel', async (req, res) => {
  const reqDoc = await MoneyRequests.findById(req.params.id);
  if (!reqDoc || reqDoc.fromUserId.toString() !== req.user.userId) {
    return res.status(404).json({ error: 'Request not found' });
  }
  if (reqDoc.status !== 'pending') return res.status(400).json({ error: `Request is ${reqDoc.status}` });
  await MoneyRequests.update(reqDoc._id, { status: 'cancelled' });
  res.json({ message: 'Request cancelled' });
});

module.exports = router;

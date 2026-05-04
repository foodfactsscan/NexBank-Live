'use strict';
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const idempotency = require('../middleware/idempotency');
const { Accounts, Transactions, Notifications, Users, Beneficiaries, User, Transaction } = require('../models/db');
const { executeTransfer, TransferError } = require('../services/transferService');
const { categorize } = require('../services/categorize');
const rewardsEngine = require('../services/rewardsEngine');
const qrService = require('../services/qrService');
const pushService = require('../services/pushService');
const { transferLimiter, lookupLimiter } = require('../middleware/rateLimit');

// Best-effort post-transfer side effects. These run after the money has
// already moved; if any fails we log but do not unwind the transfer.
async function postTransferEffects({ req, txn, fromAccount, toAccount, saveBeneficiary, beneficiaryName }) {
  try {
    if (saveBeneficiary) {
      const existing = await Beneficiaries.findByUserId(req.user.userId);
      const exists = existing.find(b => b.accountNumber === toAccount.accountNumber);
      if (!exists) {
        await Beneficiaries.create({
          userId: req.user.userId,
          accountNumber: toAccount.accountNumber,
          accountHolderName: beneficiaryName || toAccount.accountName,
          ifscCode: toAccount.ifscCode || 'NEXB0001234',
          bankName: 'NexBank',
          nickname: beneficiaryName || toAccount.accountName
        });
      }
    }

    const masked = toAccount.accountNumber.slice(-4).padStart(toAccount.accountNumber.length, '*');

    await Notifications.create({
      userId: req.user.userId, type: 'debit',
      title: 'Money Sent ✓',
      message: `₹${txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} sent to ${toAccount.accountName} (${masked}). Txn ID: ${txn.transactionId}`,
      icon: 'send', transactionId: txn._id.toString()
    });

    const receiverUser = await Users.findById(toAccount.userId);
    if (receiverUser) {
      await Notifications.create({
        userId: receiverUser._id, type: 'credit',
        title: 'Money Received 💰',
        message: `₹${txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} received from ${fromAccount.accountName}. Txn ID: ${txn.transactionId}`,
        icon: 'download', transactionId: txn._id.toString()
      });
      pushService.sendToUser(receiverUser._id, {
        title: 'Money received', body: `₹${txn.amount.toLocaleString('en-IN')} from ${fromAccount.accountName}`,
        url: '/?page=transactions'
      }).catch(() => {});
    }

    pushService.sendToUser(req.user.userId, {
      title: 'Money sent', body: `₹${txn.amount.toLocaleString('en-IN')} to ${toAccount.accountName}`,
      url: '/?page=transactions'
    }).catch(() => {});

    const broadcast = req.app.locals.broadcastToAccount;
    if (broadcast) {
      broadcast(fromAccount._id.toString(), {
        type: 'transaction', event: 'debit', transaction: txn,
        newBalance: fromAccount.balance, accountId: fromAccount._id.toString()
      });
      broadcast(toAccount._id.toString(), {
        type: 'transaction', event: 'credit', transaction: txn,
        newBalance: toAccount.balance, accountId: toAccount._id.toString(),
        message: `₹${txn.amount.toLocaleString('en-IN')} received from ${fromAccount.accountName}`
      });
    }

    await rewardsEngine.awardForTransaction(req.user.userId, txn);
  } catch (err) {
    console.error('Transfer side-effect error (money already moved):', err);
  }
}

// ─── POST /transactions/transfer ─────────────────────────────────────────────
router.post('/transfer',
  authMiddleware,
  transferLimiter,
  idempotency('transfer'),
  validate([
    body('fromAccountId').isString().notEmpty(),
    body('toAccountNumber').isString().notEmpty(),
    body('amount').isFloat({ gt: 0 }),
    body('mode').isIn(['IMPS', 'NEFT', 'RTGS', 'UPI'])
  ]),
  async (req, res) => {
    try {
      const { fromAccountId, toAccountNumber, amount, mode, description, category,
              saveBeneficiary, beneficiaryName } = req.body;

      const result = await executeTransfer({
        fromAccountId, toAccountNumber, amount, mode,
        description, category: categorize({ description, category }),
        userId: req.user.userId, toAccountHolderName: beneficiaryName
      });

      postTransferEffects({ req, ...result, saveBeneficiary, beneficiaryName }).catch(() => {});
      res.json({
        message: 'Transfer successful',
        transaction: result.transaction,
        newBalance: result.fromAccount.balance,
        transactionId: result.transaction.transactionId
      });
    } catch (err) {
      if (err instanceof TransferError) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      console.error('Transfer error:', err);
      res.status(500).json({ error: 'Transfer failed. Please try again.' });
    }
  });

// ─── POST /transactions/transfer-to-username ─────────────────────────────────
router.post('/transfer-to-username',
  authMiddleware,
  transferLimiter,
  idempotency('transfer'),
  validate([
    body('fromAccountId').isString().notEmpty(),
    body('username').isString().trim().toLowerCase().matches(/^[a-z0-9_.]{3,32}$/),
    body('amount').isFloat({ gt: 0 }),
    body('mode').optional().isIn(['IMPS', 'UPI'])
  ]),
  async (req, res) => {
    try {
      const { fromAccountId, username, amount, description, category, mode } = req.body;
      const recipient = await User.findOne({ username });
      if (!recipient) return res.status(404).json({ error: 'No user with that username' });
      const accs = await Accounts.findByUserId(recipient._id);
      const target = accs.find(a => a.status === 'active');
      if (!target) return res.status(404).json({ error: 'Recipient has no active account' });

      const result = await executeTransfer({
        fromAccountId, toAccountNumber: target.accountNumber, amount,
        mode: mode || 'UPI', description: description || `Sent to @${username}`,
        category: categorize({ description, category }),
        userId: req.user.userId, toAccountHolderName: target.accountName
      });

      postTransferEffects({ req, ...result }).catch(() => {});
      res.json({
        message: 'Transfer successful',
        transaction: result.transaction,
        newBalance: result.fromAccount.balance,
        recipient: { username, accountHolderName: target.accountName }
      });
    } catch (err) {
      if (err instanceof TransferError) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      console.error('username transfer error:', err);
      res.status(500).json({ error: 'Transfer failed. Please try again.' });
    }
  });

// ─── POST /transactions/transfer-from-qr ────────────────────────────────────
router.post('/transfer-from-qr',
  authMiddleware,
  transferLimiter,
  idempotency('transfer'),
  validate([
    body('fromAccountId').isString().notEmpty(),
    body('qrToken').isString().notEmpty(),
    body('amount').isFloat({ gt: 0 })
  ]),
  async (req, res) => {
    try {
      const { fromAccountId, qrToken, amount, description, category, mode } = req.body;
      const decoded = qrService.decode(qrToken);
      if (!decoded) return res.status(400).json({ error: 'QR code is invalid or expired' });

      const result = await executeTransfer({
        fromAccountId, toAccountNumber: decoded.acc, amount,
        mode: mode || 'UPI', description: description || `Pay ${decoded.n}`,
        category: categorize({ description, category }),
        userId: req.user.userId, toAccountHolderName: decoded.n
      });

      postTransferEffects({ req, ...result }).catch(() => {});
      res.json({
        message: 'Transfer successful',
        transaction: result.transaction,
        newBalance: result.fromAccount.balance
      });
    } catch (err) {
      if (err instanceof TransferError) return res.status(err.statusCode).json({ error: err.message, code: err.code });
      console.error('qr transfer error:', err);
      res.status(500).json({ error: 'Transfer failed. Please try again.' });
    }
  });

// ─── GET /transactions/qr/:accountId ────────────────────────────────────────
router.get('/qr/:accountId', authMiddleware, async (req, res) => {
  const account = await Accounts.findById(req.params.accountId);
  if (!account || account.userId.toString() !== req.user.userId) {
    return res.status(404).json({ error: 'Account not found' });
  }
  const token = qrService.encode({
    accountNumber: account.accountNumber,
    name: account.accountName,
    accountId: account._id.toString()
  });
  res.json({ qrToken: token, expiresIn: qrService.TTL_SECONDS });
});

// ─── GET /transactions ──────────────────────────────────────────────────────
// Cursor-based pagination by createdAt; one aggregation across all of the
// user's accounts (replaces the previous per-account loop + in-memory dedupe).
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

    const accounts = await Accounts.findByUserId(req.user.userId);
    const accountIds = accounts.map(a => a._id.toString());
    if (!accountIds.length) return res.json({ transactions: [], nextCursor: null });

    const match = {
      $or: [
        { fromAccountId: { $in: accountIds } },
        { toAccountId: { $in: accountIds } }
      ]
    };
    if (cursor && !isNaN(cursor.getTime())) {
      match.createdAt = { $lt: cursor };
    }

    const txns = await Transaction.find(match).sort({ createdAt: -1 }).limit(limit + 1);
    const hasMore = txns.length > limit;
    const items = hasMore ? txns.slice(0, limit) : txns;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    res.json({ transactions: items, nextCursor });
  } catch (err) {
    console.error('list transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ─── GET /transactions/:id ──────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const txn = await Transactions.findById(req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const accounts = await Accounts.findByUserId(req.user.userId);
    const ids = accounts.map(a => a._id.toString());
    if (!ids.includes(txn.fromAccountId) && !ids.includes(txn.toAccountId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.json({ transaction: txn });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// ─── GET /transactions/verify-account/:accountNumber ────────────────────────
router.get('/verify-account/:accountNumber', authMiddleware, lookupLimiter, async (req, res) => {
  try {
    const account = await Accounts.findByAccountNumber(req.params.accountNumber);
    if (!account || account.status !== 'active') {
      return res.status(404).json({ error: 'Account not found or inactive' });
    }
    res.json({
      verified: true,
      accountHolderName: account.accountName,
      accountNumber: account.accountNumber,
      ifscCode: account.ifscCode
    });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── Beneficiaries ──────────────────────────────────────────────────────────
router.get('/beneficiaries/list', authMiddleware, async (req, res) => {
  try {
    const beneficiaries = await Beneficiaries.findByUserId(req.user.userId);
    res.json({ beneficiaries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch beneficiaries' });
  }
});

router.post('/beneficiaries/add', authMiddleware,
  validate([
    body('accountNumber').isString().notEmpty(),
    body('accountHolderName').optional().isString().trim()
  ]),
  async (req, res) => {
    try {
      const { accountNumber, accountHolderName, ifscCode, bankName, nickname } = req.body;
      const account = await Accounts.findByAccountNumber(accountNumber);
      if (!account) return res.status(404).json({ error: 'Account not found' });

      const ben = await Beneficiaries.create({
        userId: req.user.userId,
        accountNumber,
        accountHolderName: accountHolderName || account.accountName,
        ifscCode: ifscCode || 'NEXB0001234',
        bankName: bankName || 'NexBank',
        nickname: nickname || (accountHolderName || account.accountName)
      });
      res.status(201).json({ message: 'Beneficiary added', beneficiary: ben });
    } catch (err) {
      res.status(500).json({ error: 'Failed to add beneficiary' });
    }
  });

router.delete('/beneficiaries/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await Beneficiaries.delete(req.params.id, req.user.userId);
    if (!deleted) return res.status(404).json({ error: 'Beneficiary not found' });
    res.json({ message: 'Beneficiary removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove beneficiary' });
  }
});

module.exports = router;

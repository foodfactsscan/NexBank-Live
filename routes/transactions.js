const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Accounts, Transactions, Notifications, Users, Beneficiaries } = require('../models/db');
const mongoose = require('mongoose');

// POST /api/transactions/transfer - Core transfer (IMPS/NEFT/RTGS)
router.post('/transfer', authMiddleware, async (req, res) => {
  try {
    const {
      fromAccountId,
      toAccountNumber,
      amount,
      mode, // IMPS, NEFT, RTGS, UPI
      description,
      category,
      saveBeneficiary,
      beneficiaryName
    } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────
    if (!fromAccountId || !toAccountNumber || !amount || !mode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const transferAmount = parseFloat(parseFloat(amount).toFixed(2));
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ error: 'Invalid transfer amount' });
    }
    if (transferAmount < 1) {
      return res.status(400).json({ error: 'Minimum transfer amount is ₹1' });
    }

    // Mode-specific limits
    const limits = { IMPS: 500000, NEFT: 1000000, RTGS: 10000000, UPI: 100000 };
    if (limits[mode] && transferAmount > limits[mode]) {
      return res.status(400).json({ error: `Maximum ${mode} limit is ₹${limits[mode].toLocaleString('en-IN')}` });
    }
    if (mode === 'RTGS' && transferAmount < 200000) {
      return res.status(400).json({ error: 'Minimum RTGS amount is ₹2,00,000' });
    }

    // ── Source account ───────────────────────────────────────────────────────
    const fromAccount = await Accounts.findById(fromAccountId);
    if (!fromAccount) return res.status(404).json({ error: 'Source account not found' });
    if (fromAccount.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized access to account' });
    }
    if (fromAccount.status !== 'active') {
      return res.status(400).json({ error: 'Source account is not active' });
    }

    // ── Destination account ──────────────────────────────────────────────────
    const toAccount = await Accounts.findByAccountNumber(toAccountNumber);
    if (!toAccount) return res.status(404).json({ error: 'Destination account not found. Please verify account number.' });
    if (toAccount.status !== 'active') {
      return res.status(400).json({ error: 'Destination account is not active' });
    }
    if (toAccount._id.toString() === fromAccountId) {
      return res.status(400).json({ error: 'Cannot transfer to the same account' });
    }

    // ── Balance check ────────────────────────────────────────────────────────
    const availableBalance = fromAccount.balance - (fromAccount.minimumBalance || 0);
    if (transferAmount > availableBalance) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        availableBalance
      });
    }

    // ── Execute atomic transfer ──────────────────────────────────────────────
    await Accounts.updateBalance(fromAccountId, -transferAmount);
    await Accounts.updateBalance(toAccount._id, transferAmount);

    const txn = await Transactions.create({
      fromAccountId,
      toAccountId: toAccount._id.toString(),
      fromAccountNumber: fromAccount.accountNumber,
      toAccountNumber: toAccount.accountNumber,
      amount: transferAmount,
      type: 'transfer',
      mode,
      category: category || 'Transfer',
      description: description || `${mode} Transfer`,
      toAccountHolderName: toAccount.accountName,
      fromAccountHolderName: fromAccount.accountName,
      status: 'completed'
    });

    // ── Save beneficiary if requested ────────────────────────────────────────
    if (saveBeneficiary) {
      const existingBeneficiaries = await Beneficiaries.findByUserId(req.user.userId);
      const alreadyExists = existingBeneficiaries.find(b => b.accountNumber === toAccountNumber);
      if (!alreadyExists) {
        await Beneficiaries.create({
          userId: req.user.userId,
          accountNumber: toAccountNumber,
          accountHolderName: beneficiaryName || toAccount.accountName,
          ifscCode: toAccount.ifscCode || 'NEXB0001234',
          bankName: 'NexBank',
          nickname: beneficiaryName || toAccount.accountName
        });
      }
    }

    // ── Notifications ────────────────────────────────────────────────────────
    const senderUser = await Users.findById(req.user.userId);
    const receiverUser = await Users.findById(toAccount.userId);

    // Sender notification
    await Notifications.create({
      userId: req.user.userId,
      type: 'debit',
      title: `Money Sent ✓`,
      message: `₹${transferAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} sent to ${toAccount.accountName} (${toAccountNumber.slice(-4).padStart(toAccountNumber.length, '*')}). Txn ID: ${txn.transactionId}`,
      icon: 'send',
      transactionId: txn._id.toString()
    });

    // Receiver notification
    if (receiverUser) {
      await Notifications.create({
        userId: receiverUser._id,
        type: 'credit',
        title: `Money Received 💰`,
        message: `₹${transferAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} received from ${fromAccount.accountName}. Txn ID: ${txn.transactionId}`,
        icon: 'download',
        transactionId: txn._id.toString()
      });
    }

    // ── Real-time WebSocket broadcast ────────────────────────────────────────
    const broadcast = req.app.locals.broadcastToAccount;
    if (broadcast) {
      const updatedFrom = await Accounts.findById(fromAccountId);
      const updatedTo = await Accounts.findById(toAccount._id);

      // Notify sender
      broadcast(fromAccountId, {
        type: 'transaction',
        event: 'debit',
        transaction: txn,
        newBalance: updatedFrom.balance,
        accountId: fromAccountId
      });

      // Notify receiver (use their primary accountId)
      broadcast(toAccount._id.toString(), {
        type: 'transaction',
        event: 'credit',
        transaction: txn,
        newBalance: updatedTo.balance,
        accountId: toAccount._id.toString(),
        message: `₹${transferAmount.toLocaleString('en-IN')} received from ${fromAccount.accountName}`
      });
    }

    const updatedFromAccount = await Accounts.findById(fromAccountId);
    res.json({
      message: 'Transfer successful',
      transaction: txn,
      newBalance: updatedFromAccount.balance,
      transactionId: txn.transactionId
    });

  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json({ error: 'Transfer failed. Please try again.' });
  }
});

// GET /api/transactions - Get user's transactions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const accounts = await Accounts.findByUserId(req.user.userId);
    const limit = parseInt(req.query.limit) || 50;

    let allTxns = [];
    for (const acc of accounts) {
      const txns = await Transactions.findByAccountId(acc._id.toString(), limit);
      allTxns.push(...txns);
    }

    // Deduplicate and sort
    const unique = Array.from(new Set(allTxns.map(t => t._id.toString())))
      .map(id => allTxns.find(t => t._id.toString() === id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);

    res.json({ transactions: unique });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/transactions/:id - Get specific transaction
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const txn = await Transactions.findById(req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const accounts = await Accounts.findByUserId(req.user.userId);
    const accountIds = accounts.map(a => a._id.toString());
    if (!accountIds.includes(txn.fromAccountId) && !accountIds.includes(txn.toAccountId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ transaction: txn });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// GET /api/transactions/verify-account/:accountNumber - Verify before transfer
router.get('/verify-account/:accountNumber', authMiddleware, async (req, res) => {
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

// GET /api/transactions/beneficiaries/list
router.get('/beneficiaries/list', authMiddleware, async (req, res) => {
  try {
    const beneficiaries = await Beneficiaries.findByUserId(req.user.userId);
    res.json({ beneficiaries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch beneficiaries' });
  }
});

// POST /api/transactions/beneficiaries/add
router.post('/beneficiaries/add', authMiddleware, async (req, res) => {
  try {
    const { accountNumber, accountHolderName, ifscCode, bankName, nickname } = req.body;
    if (!accountNumber || !accountHolderName) {
      return res.status(400).json({ error: 'Account number and holder name required' });
    }
    const account = await Accounts.findByAccountNumber(accountNumber);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const ben = await Beneficiaries.create({
      userId: req.user.userId,
      accountNumber,
      accountHolderName: accountHolderName || account.accountName,
      ifscCode: ifscCode || 'NEXB0001234',
      bankName: bankName || 'NexBank',
      nickname: nickname || accountHolderName
    });
    res.status(201).json({ message: 'Beneficiary added', beneficiary: ben });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add beneficiary' });
  }
});

// DELETE /api/transactions/beneficiaries/:id
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

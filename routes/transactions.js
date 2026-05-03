const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Accounts, Transactions, Notifications, Users, Beneficiaries } = require('../models/db');

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
    const fromAccount = Accounts.findById(fromAccountId);
    if (!fromAccount) return res.status(404).json({ error: 'Source account not found' });
    if (fromAccount.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized access to account' });
    }
    if (fromAccount.status !== 'active') {
      return res.status(400).json({ error: 'Source account is not active' });
    }

    // ── Destination account ──────────────────────────────────────────────────
    const toAccount = Accounts.findByAccountNumber(toAccountNumber);
    if (!toAccount) return res.status(404).json({ error: 'Destination account not found. Please verify account number.' });
    if (toAccount.status !== 'active') {
      return res.status(400).json({ error: 'Destination account is not active' });
    }
    if (toAccount.id === fromAccountId) {
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
    Accounts.updateBalance(fromAccountId, -transferAmount);
    Accounts.updateBalance(toAccount.id, transferAmount);

    const txn = Transactions.create({
      fromAccountId,
      toAccountId: toAccount.id,
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
      const existingBeneficiaries = Beneficiaries.findByUserId(req.user.userId);
      const alreadyExists = existingBeneficiaries.find(b => b.accountNumber === toAccountNumber);
      if (!alreadyExists) {
        Beneficiaries.create({
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
    const senderUser = Users.findById(req.user.userId);
    const receiverUser = Users.findById(toAccount.userId);

    // Sender notification
    Notifications.create({
      userId: req.user.userId,
      type: 'debit',
      title: `Money Sent ✓`,
      message: `₹${transferAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} sent to ${toAccount.accountName} (${toAccountNumber.slice(-4).padStart(toAccountNumber.length, '*')}). Txn ID: ${txn.transactionId}`,
      icon: 'send',
      transactionId: txn.id
    });

    // Receiver notification
    if (receiverUser) {
      Notifications.create({
        userId: receiverUser.id,
        type: 'credit',
        title: `Money Received 💰`,
        message: `₹${transferAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} received from ${fromAccount.accountName}. Txn ID: ${txn.transactionId}`,
        icon: 'download',
        transactionId: txn.id
      });
    }

    // ── Real-time WebSocket broadcast ────────────────────────────────────────
    const broadcast = req.app.locals.broadcastToAccount;
    if (broadcast) {
      const updatedFrom = Accounts.findById(fromAccountId);
      const updatedTo = Accounts.findById(toAccount.id);

      // Notify sender
      broadcast(fromAccountId, {
        type: 'transaction',
        event: 'debit',
        transaction: txn,
        newBalance: updatedFrom.balance,
        accountId: fromAccountId
      });

      // Notify receiver (use their primary accountId)
      broadcast(toAccount.id, {
        type: 'transaction',
        event: 'credit',
        transaction: txn,
        newBalance: updatedTo.balance,
        accountId: toAccount.id,
        message: `₹${transferAmount.toLocaleString('en-IN')} received from ${fromAccount.accountName}`
      });
    }

    const updatedFromAccount = Accounts.findById(fromAccountId);
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
router.get('/', authMiddleware, (req, res) => {
  const accounts = Accounts.findByUserId(req.user.userId);
  const limit = parseInt(req.query.limit) || 50;

  let allTxns = [];
  accounts.forEach(acc => {
    const txns = Transactions.findByAccountId(acc.id, limit);
    allTxns.push(...txns);
  });

  // Deduplicate by id and sort
  const seen = new Set();
  const unique = allTxns.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);

  res.json({ transactions: unique });
});

// GET /api/transactions/:id - Get specific transaction
router.get('/:id', authMiddleware, (req, res) => {
  const txn = Transactions.findById(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });

  const accounts = Accounts.findByUserId(req.user.userId);
  const accountIds = accounts.map(a => a.id);
  if (!accountIds.includes(txn.fromAccountId) && !accountIds.includes(txn.toAccountId)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  res.json({ transaction: txn });
});

// GET /api/transactions/verify-account/:accountNumber - Verify before transfer
router.get('/verify-account/:accountNumber', authMiddleware, (req, res) => {
  const account = Accounts.findByAccountNumber(req.params.accountNumber);
  if (!account || account.status !== 'active') {
    return res.status(404).json({ error: 'Account not found or inactive' });
  }
  // Don't expose full account details - just name for verification
  res.json({
    verified: true,
    accountHolderName: account.accountName,
    accountNumber: account.accountNumber,
    ifscCode: account.ifscCode
  });
});

// GET /api/transactions/beneficiaries/list
router.get('/beneficiaries/list', authMiddleware, (req, res) => {
  const beneficiaries = Beneficiaries.findByUserId(req.user.userId);
  res.json({ beneficiaries });
});

// POST /api/transactions/beneficiaries/add
router.post('/beneficiaries/add', authMiddleware, (req, res) => {
  const { accountNumber, accountHolderName, ifscCode, bankName, nickname } = req.body;
  if (!accountNumber || !accountHolderName) {
    return res.status(400).json({ error: 'Account number and holder name required' });
  }
  const account = Accounts.findByAccountNumber(accountNumber);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const ben = Beneficiaries.create({
    userId: req.user.userId,
    accountNumber,
    accountHolderName: accountHolderName || account.accountName,
    ifscCode: ifscCode || 'NEXB0001234',
    bankName: bankName || 'NexBank',
    nickname: nickname || accountHolderName
  });
  res.status(201).json({ message: 'Beneficiary added', beneficiary: ben });
});

// DELETE /api/transactions/beneficiaries/:id
router.delete('/beneficiaries/:id', authMiddleware, (req, res) => {
  const deleted = Beneficiaries.delete(req.params.id, req.user.userId);
  if (!deleted) return res.status(404).json({ error: 'Beneficiary not found' });
  res.json({ message: 'Beneficiary removed' });
});

module.exports = router;

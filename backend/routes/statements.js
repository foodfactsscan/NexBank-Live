'use strict';
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const { Accounts, Users, Transaction } = require('../models/db');
const pdfService = require('../services/pdfService');

router.use(authMiddleware);

// GET /statements/:accountId.pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/:accountId.pdf', async (req, res) => {
  try {
    const account = await Accounts.findById(req.params.accountId);
    if (!account || account.userId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const user = await Users.findById(req.user.userId);

    const toDate = req.query.to ? new Date(req.query.to) : new Date();
    const fromDate = req.query.from ? new Date(req.query.from)
      : new Date(toDate.getFullYear(), toDate.getMonth() - 1, toDate.getDate());

    const accId = account._id.toString();
    const transactions = await Transaction.find({
      $or: [{ fromAccountId: accId }, { toAccountId: accId }],
      createdAt: { $gte: fromDate, $lte: toDate }
    }).sort({ createdAt: 1 }).limit(2000);

    const filename = `nexbank-${account.accountNumber}-${fromDate.toISOString().slice(0,10)}_${toDate.toISOString().slice(0,10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    pdfService.streamStatement({ stream: res, account, user, transactions, fromDate, toDate });
  } catch (err) {
    if (err && err.message === 'pdfkit not installed') {
      return res.status(501).json({ error: 'PDF service not configured. Install pdfkit.' });
    }
    console.error('statement error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate statement' });
  }
});

module.exports = router;

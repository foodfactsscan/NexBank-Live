'use strict';
const { Rewards } = require('../models/db');

// Cashback / loyalty rules. Pure functions return the credit amount for a
// given transaction; the caller is responsible for actually persisting the
// reward record and bumping the user's balance.

function cashbackForTransfer(txn) {
  if (!txn || txn.type !== 'transfer') return 0;
  if (txn.amount >= 10000) return Math.round(txn.amount * 0.005 * 100) / 100; // 0.5 %
  return 0;
}

function cashbackForBill(txn) {
  if (!txn) return 0;
  if (txn.category === 'Bills & Utilities') {
    return Math.round(txn.amount * 0.01 * 100) / 100; // 1 %
  }
  return 0;
}

async function awardForTransaction(userId, txn) {
  const credits = [];
  const transferCb = cashbackForTransfer(txn);
  if (transferCb > 0) {
    credits.push({
      userId,
      type: 'cashback',
      amount: transferCb,
      sourceTxnId: txn.transactionId,
      description: `0.5% cashback on ${txn.mode || 'transfer'}`,
      status: 'credited'
    });
  }
  const billCb = cashbackForBill(txn);
  if (billCb > 0) {
    credits.push({
      userId,
      type: 'cashback',
      amount: billCb,
      sourceTxnId: txn.transactionId,
      description: '1% cashback on bills',
      status: 'credited'
    });
  }
  for (const c of credits) {
    // eslint-disable-next-line no-await-in-loop
    await Rewards.create(c).catch(err => console.error('reward write failed:', err));
  }
  return credits.reduce((s, c) => s + c.amount, 0);
}

module.exports = { cashbackForTransfer, cashbackForBill, awardForTransaction };

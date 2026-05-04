'use strict';
const mongoose = require('mongoose');
const { Account, Transaction, generateTransactionId } = require('../models/db');

class TransferError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

const MODE_LIMITS = { IMPS: 500000, NEFT: 1000000, RTGS: 10000000, UPI: 100000 };

async function executeTransfer({
  fromAccountId,
  toAccountNumber,
  amount,
  mode,
  description,
  category,
  userId,
  toAccountHolderName: hintedReceiverName
}) {
  const transferAmount = Math.round(parseFloat(amount) * 100) / 100;
  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    throw new TransferError('INVALID_AMOUNT', 'Invalid transfer amount');
  }
  if (transferAmount < 1) {
    throw new TransferError('AMOUNT_TOO_LOW', 'Minimum transfer amount is ₹1');
  }
  if (MODE_LIMITS[mode] && transferAmount > MODE_LIMITS[mode]) {
    throw new TransferError('LIMIT_EXCEEDED', `Maximum ${mode} limit is ₹${MODE_LIMITS[mode].toLocaleString('en-IN')}`);
  }
  if (mode === 'RTGS' && transferAmount < 200000) {
    throw new TransferError('RTGS_MIN', 'Minimum RTGS amount is ₹2,00,000');
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const fromAccount = await Account.findById(fromAccountId).session(session);
      if (!fromAccount) throw new TransferError('SRC_NOT_FOUND', 'Source account not found', 404);
      if (fromAccount.userId.toString() !== userId) {
        throw new TransferError('FORBIDDEN', 'Unauthorized access to account', 403);
      }
      if (fromAccount.status !== 'active') {
        throw new TransferError('SRC_INACTIVE', 'Source account is not active');
      }

      const toAccount = await Account.findOne({ accountNumber: toAccountNumber }).session(session);
      if (!toAccount) throw new TransferError('DEST_NOT_FOUND', 'Destination account not found. Please verify account number.', 404);
      if (toAccount.status !== 'active') throw new TransferError('DEST_INACTIVE', 'Destination account is not active');
      if (toAccount._id.toString() === fromAccountId) {
        throw new TransferError('SELF_TRANSFER', 'Cannot transfer to the same account');
      }

      const minBalance = fromAccount.minimumBalance || 0;

      // Atomic conditional debit — guarantees no double-spend under concurrency.
      const debited = await Account.findOneAndUpdate(
        {
          _id: fromAccount._id,
          status: 'active',
          balance: { $gte: transferAmount + minBalance }
        },
        { $inc: { balance: -transferAmount } },
        { new: true, session }
      );
      if (!debited) {
        const available = Math.max(0, fromAccount.balance - minBalance);
        throw new TransferError('INSUFFICIENT_FUNDS',
          `Insufficient balance. Available: ₹${available.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      }

      const credited = await Account.findOneAndUpdate(
        { _id: toAccount._id, status: 'active' },
        { $inc: { balance: transferAmount } },
        { new: true, session }
      );
      if (!credited) {
        throw new TransferError('CREDIT_FAILED', 'Destination account became inactive', 409);
      }

      const [txn] = await Transaction.create([{
        fromAccountId: fromAccount._id.toString(),
        toAccountId: toAccount._id.toString(),
        fromAccountNumber: fromAccount.accountNumber,
        toAccountNumber: toAccount.accountNumber,
        amount: transferAmount,
        type: 'transfer',
        mode,
        category: category || 'Transfer',
        description: description || `${mode} Transfer`,
        toAccountHolderName: hintedReceiverName || toAccount.accountName,
        fromAccountHolderName: fromAccount.accountName,
        status: 'completed',
        transactionId: generateTransactionId()
      }], { session });

      result = {
        transaction: txn,
        fromAccount: debited,
        toAccount: credited
      };
    });
  } finally {
    session.endSession();
  }

  return result;
}

module.exports = { executeTransfer, TransferError, MODE_LIMITS };

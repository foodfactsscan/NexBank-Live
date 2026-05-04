'use strict';
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { body } = require('express-validator');

const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const idempotency = require('../middleware/idempotency');
const { Cards, Accounts, Notifications } = require('../models/db');

router.use(authMiddleware);

function generateCardNumber() {
  const groups = [];
  for (let i = 0; i < 4; i++) groups.push(String(crypto.randomInt(1000, 10000)));
  return groups.join(' ');
}
function generateCVV() { return String(crypto.randomInt(100, 1000)); }
function generateExpiryDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}
function maskCard(card) {
  if (!card) return null;
  const o = card.toObject ? card.toObject() : { ...card };
  if (o.cardNumber) {
    const last = o.cardNumber.slice(-4);
    o.cardNumber = `**** **** **** ${last}`;
  }
  o.cvv = '***';
  return o;
}

// POST /cards/virtual — issue a new virtual debit card on an existing account
router.post('/virtual',
  idempotency('card-issue'),
  validate([
    body('accountId').isString().notEmpty(),
    body('label').optional().isString().isLength({ max: 32 })
  ]),
  async (req, res) => {
    const account = await Accounts.findById(req.body.accountId);
    if (!account || account.userId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const card = await Cards.create({
      userId: req.user.userId,
      accountId: account._id,
      cardType: 'debit',
      cardNetwork: 'Visa',
      cardNumber: generateCardNumber(),
      cvv: generateCVV(),
      expiryDate: generateExpiryDate(),
      cardHolderName: account.accountName.toUpperCase(),
      status: 'active',
      dailyLimit: 100000,
      internationalUsage: false,
      contactlessEnabled: true
    });
    Notifications.create({
      userId: req.user.userId, type: 'card',
      title: 'Virtual card issued',
      message: `Your new virtual card ending ${card.cardNumber.slice(-4)} is ready to use.`,
      icon: 'credit-card'
    }).catch(() => {});
    res.status(201).json({ card: maskCard(card) });
  });

// PATCH /cards/:id/freeze — toggle status active/blocked
router.patch('/:id/freeze',
  validate([body('frozen').isBoolean()]),
  async (req, res) => {
    const cards = await Cards.findByUserId(req.user.userId);
    const card = cards.find(c => c._id.toString() === req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    const updated = await Cards.update(card._id, { status: req.body.frozen ? 'blocked' : 'active' });
    Notifications.create({
      userId: req.user.userId, type: 'card',
      title: req.body.frozen ? 'Card frozen' : 'Card unfrozen',
      message: req.body.frozen
        ? `Card ending ${card.cardNumber.slice(-4)} is now frozen.`
        : `Card ending ${card.cardNumber.slice(-4)} is active again.`,
      icon: 'snowflake'
    }).catch(() => {});
    res.json({ card: maskCard(updated) });
  });

// PATCH /cards/:id/limits — daily limit + toggles
router.patch('/:id/limits',
  validate([
    body('dailyLimit').optional().isFloat({ gt: 0, lt: 10000000 }),
    body('internationalUsage').optional().isBoolean(),
    body('contactlessEnabled').optional().isBoolean()
  ]),
  async (req, res) => {
    const cards = await Cards.findByUserId(req.user.userId);
    const card = cards.find(c => c._id.toString() === req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    const patch = {};
    if (req.body.dailyLimit !== undefined) patch.dailyLimit = req.body.dailyLimit;
    if (req.body.internationalUsage !== undefined) patch.internationalUsage = req.body.internationalUsage;
    if (req.body.contactlessEnabled !== undefined) patch.contactlessEnabled = req.body.contactlessEnabled;
    const updated = await Cards.update(card._id, patch);
    res.json({ card: maskCard(updated) });
  });

module.exports = router;

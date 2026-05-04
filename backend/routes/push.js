'use strict';
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { PushSubscriptions } = require('../models/db');
const pushService = require('../services/pushService');

router.get('/public-key', (req, res) => {
  res.json({ publicKey: pushService.publicKey() });
});

router.post('/subscribe', authMiddleware,
  validate([
    body('endpoint').isString().notEmpty(),
    body('keys.p256dh').isString().notEmpty(),
    body('keys.auth').isString().notEmpty()
  ]),
  async (req, res) => {
    const { endpoint, keys } = req.body;
    await PushSubscriptions.upsert(
      req.user.userId, endpoint, keys.p256dh, keys.auth, req.headers['user-agent'] || ''
    );
    res.status(201).json({ message: 'Subscribed' });
  });

router.post('/unsubscribe', authMiddleware,
  validate([body('endpoint').isString().notEmpty()]),
  async (req, res) => {
    await PushSubscriptions.deleteByEndpoint(req.body.endpoint);
    res.json({ message: 'Unsubscribed' });
  });

module.exports = router;

'use strict';
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const { RefreshTokens } = require('../models/db');

router.use(authMiddleware);

// GET /devices — every active refresh token is one signed-in device
router.get('/', async (req, res) => {
  const tokens = await RefreshTokens.listForUser(req.user.userId);
  res.json({
    devices: tokens.map(t => ({
      id: t._id,
      label: t.deviceLabel,
      userAgent: t.userAgent,
      ip: t.ip,
      lastUsedAt: t.lastUsedAt,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt
    }))
  });
});

// DELETE /devices/:id — revoke a single device
router.delete('/:id', async (req, res) => {
  const tokens = await RefreshTokens.listForUser(req.user.userId);
  const target = tokens.find(t => t._id.toString() === req.params.id);
  if (!target) return res.status(404).json({ error: 'Device not found' });
  await RefreshTokens.delete(target.tokenHash);
  res.json({ message: 'Device signed out' });
});

// POST /devices/revoke-all — sign out everywhere except possibly the caller
router.post('/revoke-all', async (req, res) => {
  await RefreshTokens.deleteAllForUser(req.user.userId);
  res.json({ message: 'All sessions revoked. Sign in again.' });
});

module.exports = router;

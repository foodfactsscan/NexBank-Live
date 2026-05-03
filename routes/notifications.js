const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Notifications } = require('../models/db');

// GET /api/notifications
router.get('/', authMiddleware, (req, res) => {
  const notifications = Notifications.findByUserId(req.user.userId);
  const unreadCount = notifications.filter(n => !n.read).length;
  res.json({ notifications, unreadCount });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authMiddleware, (req, res) => {
  const notif = Notifications.markRead(req.params.id, req.user.userId);
  if (!notif) return res.status(404).json({ error: 'Notification not found' });
  res.json({ message: 'Marked as read', notification: notif });
});

// PUT /api/notifications/read-all
router.put('/read-all/mark', authMiddleware, (req, res) => {
  Notifications.markAllRead(req.user.userId);
  res.json({ message: 'All notifications marked as read' });
});

module.exports = router;

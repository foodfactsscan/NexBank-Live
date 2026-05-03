const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Notifications } = require('../models/db');

// GET /api/notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notifications.findByUserId(req.user.userId);
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notif = await Notifications.markRead(req.params.id, req.user.userId);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Marked as read', notification: notif });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all/mark', authMiddleware, async (req, res) => {
  try {
    await Notifications.markAllRead(req.user.userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

module.exports = router;

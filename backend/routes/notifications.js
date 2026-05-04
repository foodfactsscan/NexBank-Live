const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { Notifications, Notification } = require('../models/db');

// GET /api/notifications?cursor=<iso>&limit=20
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

    const match = { userId: req.user.userId };
    if (cursor && !isNaN(cursor.getTime())) match.createdAt = { $lt: cursor };

    const items = await Notification.find(match).sort({ createdAt: -1 }).limit(limit + 1);
    const hasMore = items.length > limit;
    const notifications = hasMore ? items.slice(0, limit) : items;
    const unreadCount = await Notification.countDocuments({ userId: req.user.userId, read: false });

    res.json({
      notifications,
      unreadCount,
      nextCursor: hasMore ? notifications[notifications.length - 1].createdAt.toISOString() : null
    });
  } catch (err) {
    console.error('list notifications error:', err);
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

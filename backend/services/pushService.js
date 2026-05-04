'use strict';
const { PushSubscriptions } = require('../models/db');

let webpush = null;
try { webpush = require('web-push'); } catch { /* optional dep */ }

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@nexbank.local';

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!webpush) return false;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

function publicKey() {
  return VAPID_PUBLIC || null;
}

async function sendToUser(userId, payload) {
  if (!ensureConfigured()) return { sent: 0, skipped: 'not-configured' };
  const subs = await PushSubscriptions.findByUserId(userId);
  let sent = 0;
  for (const s of subs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        // Browser dropped the subscription — clean it up.
        // eslint-disable-next-line no-await-in-loop
        await PushSubscriptions.deleteByEndpoint(s.endpoint).catch(() => {});
      } else {
        console.error('push send failed:', err);
      }
    }
  }
  return { sent };
}

module.exports = { sendToUser, publicKey, ensureConfigured };

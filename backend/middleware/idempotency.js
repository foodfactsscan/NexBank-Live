'use strict';
const crypto = require('crypto');
const { Idempotencies } = require('../models/db');

// Twenty-four hours of replay protection per key per user per scope.
const TTL_MS = 24 * 60 * 60 * 1000;

function hashRequest(body) {
  const json = JSON.stringify(body || {});
  return crypto.createHash('sha256').update(json).digest('hex');
}

// Usage:  router.post('/transfer', auth, idempotency('transfer'), handler)
// Requires `req.user` to already be set, so place AFTER authMiddleware.
//
// If the client did not send Idempotency-Key, we proceed without dedupe and
// just monkey-patch res.json so a key supplied later in the same flow gets
// stored. (Mirrors the Stripe convention of "optional key, recommended for
// money movement".)
function idempotency(scope) {
  return async function idempotencyMiddleware(req, res, next) {
    const key = req.headers['idempotency-key'];
    if (!key) return next();

    if (typeof key !== 'string' || key.length < 8 || key.length > 128) {
      return res.status(400).json({ error: 'Idempotency-Key must be 8–128 characters' });
    }
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'Idempotency requires authentication' });
    }

    const requestHash = hashRequest(req.body);

    try {
      const existing = await Idempotencies.find(req.user.userId, scope, key);
      if (existing) {
        if (existing.requestHash !== requestHash) {
          return res.status(409).json({
            error: 'Idempotency-Key reused with different request body',
            code: 'IDEMPOTENCY_MISMATCH'
          });
        }
        res.setHeader('Idempotent-Replayed', '1');
        return res.status(existing.statusCode).json(existing.response);
      }
    } catch (err) {
      console.error('Idempotency lookup failed:', err);
      // Fail open on lookup errors — don't block the user. Side-effect dedupe
      // still relies on transaction-level uniqueness in the DB.
    }

    const origJson = res.json.bind(res);
    res.json = (body) => {
      // Only persist successful or otherwise final-state responses.
      if (res.statusCode < 500) {
        Idempotencies.store({
          key,
          userId: req.user.userId,
          scope,
          requestHash,
          statusCode: res.statusCode,
          response: body,
          expiresAt: new Date(Date.now() + TTL_MS)
        }).catch(err => console.error('Idempotency store failed:', err));
      }
      return origJson(body);
    };

    next();
  };
}

module.exports = idempotency;
module.exports.hashRequest = hashRequest;

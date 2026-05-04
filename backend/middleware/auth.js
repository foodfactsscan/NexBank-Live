'use strict';
// JWT verification middleware for Express + a stateless `verifyToken` helper
// for the WebSocket handshake. Demo-grade: if JWT_SECRET isn't set we fall
// back to a built-in dev key with a warning so the server still boots.
const jwt = require('jsonwebtoken');

const FALLBACK_SECRET = 'nexbank_demo_secret_change_me_for_production_2026';
const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16
  ? process.env.JWT_SECRET
  : FALLBACK_SECRET;

if (JWT_SECRET === FALLBACK_SECRET) {
  console.warn('⚠️  JWT_SECRET is missing or short — using built-in demo key. Set a real one in production.');
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Used by the WebSocket handshake — synchronous, no Express context.
function verifyToken(token) {
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

module.exports = authMiddleware;
module.exports.verifyToken = verifyToken;
module.exports.JWT_SECRET = JWT_SECRET;

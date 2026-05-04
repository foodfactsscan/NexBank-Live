// ───────────────────────────────────────────────────────────────────────────
//  NexBank — Express + Mongoose API and WebSocket gateway.
//
//  Entry point. Bootstraps env validation, security middleware (helmet/CSP,
//  CORS whitelist, rate limiting, request-id), MongoDB connection pre-warm,
//  the authenticated WebSocket server, all REST routes (mounted under both
//  /api/v1 and /api as a legacy alias), the SPA static fallback (web/dist
//  if built, otherwise the legacy frontend/), and a graceful SIGTERM/SIGINT
//  shutdown that drains in-flight transfers before exit.
// ───────────────────────────────────────────────────────────────────────────

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config();

// ─── ENV validation ──────────────────────────────────────────────────────────
const requiredEnv = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  console.error('   Copy .env.example to .env and fill in real values, or set them in your hosting provider.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET must be at least 32 characters. Generate one with:');
  console.error('   node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const goalsRoutes = require('./routes/goals');
const budgetsRoutes = require('./routes/budgets');
const devicesRoutes = require('./routes/devices');
const statementsRoutes = require('./routes/statements');
const pushRoutes = require('./routes/push');
const moneyRequestsRoutes = require('./routes/moneyRequests');
const cardsRoutes = require('./routes/cards');
const rewardsRoutes = require('./routes/rewards');

const { connectDB, mongoose, getLastError, Accounts } = require('./models/db');
const { verifyToken } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimit');
const requestId = require('./middleware/requestId');

connectDB().then(() => console.log('🔥 Connection warmed up')).catch(err => console.error('Warmup failed', err));

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const server = http.createServer(app);

// ─── WebSocket: authenticated real-time ──────────────────────────────────────
// First message MUST be { type:'authenticate', token, accountId }. We verify
// the JWT, then confirm the user actually owns the account before subscribing.
// Any other message before auth, missing token, or ownership mismatch → close.
const wss = new WebSocket.Server({ server, path: '/ws' });
const connectedClients = new Map(); // accountId → ws

wss.on('connection', (ws) => {
  let accountId = null;
  let authed = false;
  const authTimeout = setTimeout(() => {
    if (!authed) try { ws.close(1008, 'auth timeout'); } catch {}
  }, 10000);

  ws.on('message', async (message) => {
    let data;
    try { data = JSON.parse(message); } catch { return; }
    if (authed) return; // already done; ignore further messages

    if (data.type !== 'authenticate' || !data.token || !data.accountId) {
      try { ws.send(JSON.stringify({ type: 'error', message: 'authentication required' })); } catch {}
      return ws.close(1008, 'auth required');
    }
    const decoded = verifyToken(data.token);
    if (!decoded) return ws.close(1008, 'invalid token');

    try {
      const account = await Accounts.findById(data.accountId);
      if (!account || account.userId.toString() !== decoded.userId) {
        return ws.close(1008, 'account ownership mismatch');
      }
    } catch {
      return ws.close(1011, 'lookup failed');
    }

    accountId = data.accountId;
    authed = true;
    clearTimeout(authTimeout);
    // Replace any stale socket for the same account.
    const prev = connectedClients.get(accountId);
    if (prev && prev !== ws) try { prev.close(1000, 'replaced'); } catch {}
    connectedClients.set(accountId, ws);
    ws.send(JSON.stringify({ type: 'authenticated', message: 'Connected to NexBank real-time service' }));
  });

  const cleanup = () => {
    clearTimeout(authTimeout);
    if (accountId && connectedClients.get(accountId) === ws) {
      connectedClients.delete(accountId);
    }
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

app.locals.broadcastToAccount = (targetAccountId, payload) => {
  const client = connectedClients.get(targetAccountId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(payload));
  }
};

// ─── Security & request middleware ───────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'connect-src': ["'self'", 'ws:', 'wss:'],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / curl / mobile webview
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));

app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(requestId);

app.use('/api/', apiLimiter);

// Health Check
function buildHealthHandler() {
  return (req, res) => {
    const dbState = mongoose.connection.readyState;
    const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
    res.json({
      status: dbState === 1 ? 'OK' : 'Error',
      database: states[dbState],
      error: getLastError(),
      region: process.env.VERCEL_REGION || 'local',
      env: 'Loaded',
      version: 'v1',
      timestamp: new Date()
    });
  };
}
app.get('/api/health', buildHealthHandler());
app.get('/api/v1/health', buildHealthHandler());

// Serve the built SPA when present, otherwise fall back to the legacy
// vanilla-JS frontend. On Vercel the static rewrites in vercel.json take
// precedence so this only matters for local single-server testing.
const fs = require('fs');
const distDir = path.join(__dirname, '../web/dist');
const legacyDir = path.join(__dirname, '../frontend');
const staticDir = fs.existsSync(distDir) ? distDir : legacyDir;
app.use(express.static(staticDir));

// ─── API mounting ────────────────────────────────────────────────────────────
// Every route is mounted under /api/v1; legacy /api/* kept for one release as
// a permanent-redirect alias so existing frontend builds keep working until we
// cut over to the React SPA (Phase 4).
function mountAll(prefix) {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/accounts`, accountRoutes);
  app.use(`${prefix}/transactions`, transactionRoutes);
  app.use(`${prefix}/users`, userRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/goals`, goalsRoutes);
  app.use(`${prefix}/budgets`, budgetsRoutes);
  app.use(`${prefix}/devices`, devicesRoutes);
  app.use(`${prefix}/statements`, statementsRoutes);
  app.use(`${prefix}/push`, pushRoutes);
  app.use(`${prefix}/money-requests`, moneyRequestsRoutes);
  app.use(`${prefix}/cards`, cardsRoutes);
  app.use(`${prefix}/rewards`, rewardsRoutes);
}
mountAll('/api/v1');
mountAll('/api');   // legacy alias

// ─── SPA fallback ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err && err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: origin not allowed', requestId: req.requestId });
  }
  console.error(`[${req.requestId || 'no-id'}]`, err.stack || err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`\n🏦 NexBank Server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server active on ws://localhost:${PORT}/ws`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });

  // ─── Graceful shutdown ─────────────────────────────────────────────────────
  // Stop accepting new HTTP connections, close active WebSockets, drain mongo,
  // then exit. Important on Vercel/PaaS so in-flight transfers complete cleanly
  // when the runtime sends SIGTERM.
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received — shutting down gracefully…`);
    try { wss.clients.forEach(c => { try { c.close(1001, 'server shutting down'); } catch {} }); } catch {}
    server.close(() => {
      mongoose.connection.close(false).then(() => {
        console.log('✓ HTTP closed, mongo closed.');
        process.exit(0);
      }).catch(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = process.env.VERCEL ? app : { app, server, wss };

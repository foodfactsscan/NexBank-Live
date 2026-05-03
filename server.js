const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

const { connectDB } = require('./models/db');

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// WebSocket Server for real-time updates
const wss = new WebSocket.Server({ server, path: '/ws' });

// Store connected clients keyed by accountId
const connectedClients = new Map();

wss.on('connection', (ws, req) => {
  let accountId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'authenticate' && data.accountId) {
        accountId = data.accountId;
        connectedClients.set(accountId, ws);
        ws.send(JSON.stringify({ type: 'authenticated', message: 'Connected to NexBank real-time service' }));
      }
    } catch (e) {
      // ignore
    }
  });

  ws.on('close', () => {
    if (accountId) connectedClients.delete(accountId);
  });

  ws.on('error', () => {
    if (accountId) connectedClients.delete(accountId);
  });
});

// Export broadcast function for use in routes
app.locals.broadcastToAccount = (targetAccountId, payload) => {
  const client = connectedClients.get(targetAccountId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(payload));
  }
};

// Security & middleware
app.use(helmet({
  contentSecurityPolicy: false // allow inline styles/scripts for single-file approach
}));
app.use(cors({ origin: '*' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'NexBank API is running', timestamp: new Date().toISOString() });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
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
}

module.exports = process.env.VERCEL ? app : { app, server, wss };

// In-memory database simulation with persistence via JSON
// In production, replace with PostgreSQL/MongoDB

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, 'data', 'db.json');

// Default data structure
const defaultData = {
  users: [],
  accounts: [],
  transactions: [],
  notifications: [],
  beneficiaries: [],
  fixedDeposits: [],
  recurringDeposits: [],
  loans: [],
  cards: []
};

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load or initialize database
function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return { ...defaultData, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('DB load error:', e.message);
  }
  return { ...defaultData };
}

function saveDB(db) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('DB save error:', e.message);
  }
}

let db = loadDB();

// ─── User Operations ─────────────────────────────────────────────────────────

function generateAccountNumber() {
  let num;
  do {
    num = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  } while (db.accounts.find(a => a.accountNumber === num));
  return num;
}

function generateTransactionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `NXB${ts}${rand}`;
}

// Users
const Users = {
  findByEmail: (email) => db.users.find(u => u.email.toLowerCase() === email.toLowerCase()),
  findById: (id) => db.users.find(u => u.id === id),
  findByPhone: (phone) => db.users.find(u => u.phone === phone),
  create: (data) => {
    // If it's the specific admin email or no users exist, make them admin
    const isFirst = db.users.length === 0;
    const role = (data.email === 'admin@nexbank.com' || isFirst) ? 'admin' : (data.role || 'user');
    const user = { ...data, role, id: require('crypto').randomUUID(), createdAt: new Date().toISOString() };
    db.users.push(user);
    saveDB(db);
    return user;
  },
  update: (id, updates) => {
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    db.users[idx] = { ...db.users[idx], ...updates, updatedAt: new Date().toISOString() };
    saveDB(db);
    return db.users[idx];
  },
  getAll: () => db.users
};

// Accounts
const Accounts = {
  findByUserId: (userId) => db.accounts.filter(a => a.userId === userId),
  findByAccountNumber: (num) => db.accounts.find(a => a.accountNumber === num),
  findById: (id) => db.accounts.find(a => a.id === id),
  create: (data) => {
    const account = {
      ...data,
      id: require('crypto').randomUUID(),
      accountNumber: generateAccountNumber(),
      balance: data.balance || 0,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    db.accounts.push(account);
    saveDB(db);
    return account;
  },
  updateBalance: (id, amount) => {
    const idx = db.accounts.findIndex(a => a.id === id);
    if (idx === -1) return null;
    db.accounts[idx].balance = parseFloat((db.accounts[idx].balance + amount).toFixed(2));
    db.accounts[idx].updatedAt = new Date().toISOString();
    saveDB(db);
    return db.accounts[idx];
  },
  update: (id, updates) => {
    const idx = db.accounts.findIndex(a => a.id === id);
    if (idx === -1) return null;
    db.accounts[idx] = { ...db.accounts[idx], ...updates, updatedAt: new Date().toISOString() };
    saveDB(db);
    return db.accounts[idx];
  },
  getAll: () => db.accounts
};

// Transactions
const Transactions = {
  findByAccountId: (accountId, limit = 50) => {
    return db.transactions
      .filter(t => t.fromAccountId === accountId || t.toAccountId === accountId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  },
  findById: (id) => db.transactions.find(t => t.id === id),
  create: (data) => {
    const txn = {
      ...data,
      id: require('crypto').randomUUID(),
      transactionId: generateTransactionId(),
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    db.transactions.push(txn);
    saveDB(db);
    return txn;
  },
  getAll: () => db.transactions
};

// Notifications
const Notifications = {
  findByUserId: (userId) => db.notifications
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50),
  create: (data) => {
    const notif = { ...data, id: require('crypto').randomUUID(), read: false, createdAt: new Date().toISOString() };
    db.notifications.push(notif);
    saveDB(db);
    return notif;
  },
  markRead: (id, userId) => {
    const idx = db.notifications.findIndex(n => n.id === id && n.userId === userId);
    if (idx === -1) return null;
    db.notifications[idx].read = true;
    saveDB(db);
    return db.notifications[idx];
  },
  markAllRead: (userId) => {
    db.notifications.forEach((n, i) => { if (n.userId === userId) db.notifications[i].read = true; });
    saveDB(db);
  }
};

// Beneficiaries
const Beneficiaries = {
  findByUserId: (userId) => db.beneficiaries.filter(b => b.userId === userId),
  create: (data) => {
    const ben = { ...data, id: require('crypto').randomUUID(), createdAt: new Date().toISOString() };
    db.beneficiaries.push(ben);
    saveDB(db);
    return ben;
  },
  findById: (id) => db.beneficiaries.find(b => b.id === id),
  delete: (id, userId) => {
    const idx = db.beneficiaries.findIndex(b => b.id === id && b.userId === userId);
    if (idx === -1) return false;
    db.beneficiaries.splice(idx, 1);
    saveDB(db);
    return true;
  }
};

// Fixed Deposits
const FixedDeposits = {
  findByUserId: (userId) => db.fixedDeposits.filter(f => f.userId === userId),
  create: (data) => {
    const fd = { ...data, id: require('crypto').randomUUID(), createdAt: new Date().toISOString() };
    db.fixedDeposits.push(fd);
    saveDB(db);
    return fd;
  },
  update: (id, updates) => {
    const idx = db.fixedDeposits.findIndex(f => f.id === id);
    if (idx === -1) return null;
    db.fixedDeposits[idx] = { ...db.fixedDeposits[idx], ...updates };
    saveDB(db);
    return db.fixedDeposits[idx];
  }
};

// Loans
const Loans = {
  findByUserId: (userId) => db.loans.filter(l => l.userId === userId),
  create: (data) => {
    const loan = { ...data, id: require('crypto').randomUUID(), createdAt: new Date().toISOString() };
    db.loans.push(loan);
    saveDB(db);
    return loan;
  }
};

// Cards
const Cards = {
  findByUserId: (userId) => db.cards.filter(c => c.userId === userId),
  findByAccountId: (accountId) => db.cards.filter(c => c.accountId === accountId),
  create: (data) => {
    const card = { ...data, id: require('crypto').randomUUID(), createdAt: new Date().toISOString() };
    db.cards.push(card);
    saveDB(db);
    return card;
  },
  update: (id, updates) => {
    const idx = db.cards.findIndex(c => c.id === id);
    if (idx === -1) return null;
    db.cards[idx] = { ...db.cards[idx], ...updates };
    saveDB(db);
    return db.cards[idx];
  }
};

module.exports = { Users, Accounts, Transactions, Notifications, Beneficiaries, FixedDeposits, Loans, Cards, generateTransactionId };

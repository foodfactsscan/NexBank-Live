const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development and across function invocations in serverless (Vercel).
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
    };

    if (!MONGODB_URI) {
      throw new Error('❌ CRITICAL: MONGODB_URI is not defined in environment variables.');
    }

    console.log('⏳ Attempting to connect to MongoDB Atlas...');
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ MongoDB Connected Successfully (Serverless Mode)');
      return mongoose;
    }).catch(err => {
      cached.promise = null;
      console.error('❌ MongoDB Connection Error:', err.message);
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  dateOfBirth: String,
  address: String,
  gender: String,
  panNumber: String,
  aadharNumber: String,
  kycStatus: { type: String, default: 'pending' },
  role: { type: String, default: 'user' }
}, { timestamps: true });

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountType: { type: String, required: true },
  accountName: String,
  accountNumber: { type: String, required: true, unique: true },
  balance: { type: Number, default: 1000 },
  status: { type: String, default: 'active' }
}, { timestamps: true });

const transactionSchema = new mongoose.Schema({
  fromAccountId: String,
  toAccountId: String,
  fromAccountNumber: String,
  toAccountNumber: String,
  amount: Number,
  type: String,
  description: String,
  status: { type: String, default: 'completed' },
  transactionId: { type: String, required: true, unique: true },
  toAccountHolderName: String,
  fromAccountHolderName: String
}, { timestamps: true });

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: String,
  title: String,
  message: String,
  read: { type: Boolean, default: false },
  icon: String
}, { timestamps: true });

const cardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  cardType: { type: String, default: 'debit' },
  cardNumber: { type: String, required: true, unique: true },
  cvv: { type: String, required: true },
  expiryDate: { type: String, required: true },
  status: { type: String, default: 'active' }
}, { timestamps: true });

// ─── Models ──────────────────────────────────────────────────────────────────

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Account = mongoose.models.Account || mongoose.model('Account', accountSchema);
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generateAccountNumber() {
  let num;
  let exists = true;
  while (exists) {
    num = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const check = await Account.findOne({ accountNumber: num });
    if (!check) exists = false;
  }
  return num;
}

function generateTransactionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `NXB${ts}${rand}`;
}

// ─── API Wrapper ─────────────────────────────────────────────────────────────

const Users = {
  findByEmail: async (email) => { await connectDB(); return await User.findOne({ email: email.toLowerCase() }); },
  findById: async (id) => { await connectDB(); return await User.findById(id); },
  create: async (data) => {
    await connectDB();
    const userCount = await User.countDocuments();
    const role = (data.email === 'admin@nexbank.com' || userCount === 0) ? 'admin' : 'user';
    const user = new User({ ...data, role });
    return await user.save();
  },
  update: async (id, updates) => { await connectDB(); return await User.findByIdAndUpdate(id, updates, { new: true }); },
  getAll: async () => { await connectDB(); return await User.find(); }
};

const Accounts = {
  findByUserId: async (userId) => { await connectDB(); return await Account.find({ userId }); },
  findByAccountNumber: async (num) => { await connectDB(); return await Account.findOne({ accountNumber: num }); },
  create: async (data) => {
    await connectDB();
    const accountNumber = await generateAccountNumber();
    const account = new Account({ ...data, accountNumber });
    return await account.save();
  },
  updateBalance: async (id, amount) => {
    await connectDB();
    const account = await Account.findById(id);
    if (!account) return null;
    account.balance = parseFloat((account.balance + amount).toFixed(2));
    return await account.save();
  }
};

const Transactions = {
  findByAccountId: async (accountId) => { await connectDB(); return await Transaction.find({ $or: [{ fromAccountId: accountId }, { toAccountId: accountId }] }).sort({ createdAt: -1 }); },
  create: async (data) => {
    await connectDB();
    const transactionId = generateTransactionId();
    const txn = new Transaction({ ...data, transactionId });
    return await txn.save();
  },
  getAll: async () => { await connectDB(); return await Transaction.find().sort({ createdAt: -1 }); }
};

const Notifications = {
  findByUserId: async (userId) => { await connectDB(); return await Notification.find({ userId }).sort({ createdAt: -1 }); },
  create: async (data) => { await connectDB(); return await new Notification(data).save(); },
  markRead: async (id, userId) => { await connectDB(); return await Notification.findOneAndUpdate({ _id: id, userId }, { read: true }, { new: true }); }
};

const Cards = {
  findByUserId: async (userId) => { await connectDB(); return await Card.find({ userId }); },
  create: async (data) => { await connectDB(); return await new Card(data).save(); }
};

module.exports = { 
  Users, Accounts, Transactions, Notifications, Cards, 
  connectDB, generateTransactionId, mongoose 
};

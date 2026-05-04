// ───────────────────────────────────────────────────────────────────────────
//  Database layer.
//
//  Defines every Mongoose schema (User, Account, Transaction, Card, FD, Loan,
//  Notification, Beneficiary, plus Phase-2 additions: RefreshToken,
//  Idempotency, OneTimeCode, Goal, Budget, Reward, MoneyRequest,
//  PushSubscription, WebAuthnCredential), exposes a connection cache that's
//  safe across Vercel cold starts, and offers thin helper wrappers (Users,
//  Accounts, Transactions, ...) that keep call-sites readable while still
//  exporting the raw models for aggregation pipelines.
// ───────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');
const crypto = require('crypto');
const cardCrypto = require('../services/cardCrypto');

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global.mongoose;
let lastError = null;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

mongoose.set('bufferCommands', false); // Disable buffering globally

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 30000, // Wait 30s for server selection
      connectTimeoutMS: 30000,
    };
    
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI is missing!');
      throw new Error('MONGODB_URI missing');
    }

    console.log('⏳ Connecting to MongoDB...');
    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((m) => {
        console.log('✅ Connected');
        return m;
      })
      .catch(err => {
        cached.promise = null; 
        lastError = err.message;
        console.error('❌ Connection failed:', err.message);
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
  firstName: String, lastName: String, email: { type: String, unique: true },
  phone: { type: String, unique: true }, passwordHash: String,
  dateOfBirth: String, address: String, gender: String, panNumber: String, aadharNumber: String,
  kycStatus: { type: String, default: 'pending' }, profilePicture: String,
  role: { type: String, default: 'user' }, lastLogin: Date,
  // P2P + referrals
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  // 2FA (TOTP)
  twoFA: {
    enabled: { type: Boolean, default: false },
    secret: { type: String, default: null },          // encrypted at rest via cardCrypto
    backupCodes: { type: [String], default: [] }      // hashed
  },
  // Login lockout
  failedLoginCount: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null }
}, { timestamps: true });

userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ username: 1 });
userSchema.index({ referralCode: 1 });

const accountSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, accountType: { type: String, default: 'savings' }, 
  accountName: String, accountNumber: { type: String, unique: true }, 
  balance: { type: Number, default: 1000 }, status: { type: String, default: 'active' },
  ifscCode: { type: String, default: 'NEXB0001234' }, branch: { type: String, default: 'Digital Branch, Mumbai' },
  currency: { type: String, default: 'INR' }, interestRate: { type: Number, default: 3.5 },
  minimumBalance: { type: Number, default: 500 }, nomineeName: String
}, { timestamps: true });

accountSchema.index({ userId: 1 });
accountSchema.index({ accountNumber: 1 });

const transactionSchema = new mongoose.Schema({
  fromAccountId: String, toAccountId: String, fromAccountNumber: String, toAccountNumber: String,
  amount: Number, type: String, category: String, description: String, 
  status: { type: String, default: 'completed' }, transactionId: { type: String, unique: true },
  toAccountHolderName: String, fromAccountHolderName: String, mode: { type: String, default: 'IMPS' }
}, { timestamps: true });

transactionSchema.index({ fromAccountId: 1 });
transactionSchema.index({ toAccountId: 1 });
transactionSchema.index({ createdAt: -1 });

const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, accountId: mongoose.Schema.Types.ObjectId, 
  cardNumber: { type: String, unique: true }, cvv: String, expiryDate: String, 
  cardType: { type: String, default: 'debit' }, cardNetwork: { type: String, default: 'Visa' },
  cardHolderName: String, status: { type: String, default: 'active' },
  dailyLimit: { type: Number, default: 100000 }, internationalUsage: { type: Boolean, default: false },
  contactlessEnabled: { type: Boolean, default: true }
}, { timestamps: true });

cardSchema.index({ userId: 1 });
cardSchema.index({ accountId: 1 });
cardSchema.index({ cardNumber: 1 });

const fdSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, accountId: mongoose.Schema.Types.ObjectId, 
  principalAmount: Number, interestRate: Number, tenureMonths: Number, 
  maturityAmount: Number, maturityDate: Date, status: { type: String, default: 'active' },
  fdNumber: { type: String, unique: true }
}, { timestamps: true });

// ─── Models ──────────────────────────────────────────────────────────────────

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Account = mongoose.models.Account || mongoose.model('Account', accountSchema);
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
const Card = mongoose.models.Card || mongoose.model('Card', cardSchema);
const FixedDeposit = mongoose.models.FixedDeposit || mongoose.model('FixedDeposit', fdSchema);
const Notification = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, type: String, title: String, message: String, 
  read: { type: Boolean, default: false }, icon: String
}, { timestamps: true }));
const Beneficiary = mongoose.models.Beneficiary || mongoose.model('Beneficiary', new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, accountNumber: String, accountHolderName: String, nickname: String,
  ifscCode: { type: String, default: 'NEXB0001234' }, bankName: { type: String, default: 'NexBank' }
}, { timestamps: true }));
const Loan = mongoose.models.Loan || mongoose.model('Loan', new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, loanType: String, amount: Number,
  tenureMonths: Number, emi: Number, status: { type: String, default: 'under_review' },
  interestRate: Number, monthlyIncome: Number
}, { timestamps: true }));

// ─── New Phase-2 schemas ─────────────────────────────────────────────────────

const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  tokenHash: { type: String, unique: true },
  deviceLabel: String,
  userAgent: String,
  ip: String,
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: { expires: 0 } }
}, { timestamps: true });
const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);

const idempotencySchema = new mongoose.Schema({
  key: String,
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  scope: String,                          // 'transfer' | 'goal-contribute' | 'card-issue' …
  requestHash: String,
  statusCode: Number,
  response: mongoose.Schema.Types.Mixed,
  expiresAt: { type: Date, index: { expires: 0 } }
}, { timestamps: true });
idempotencySchema.index({ userId: 1, key: 1, scope: 1 }, { unique: true });
const Idempotency = mongoose.models.Idempotency || mongoose.model('Idempotency', idempotencySchema);

const otpSchema = new mongoose.Schema({
  identifier: { type: String, index: true },   // email (lowercased) or phone
  purpose: String,                              // 'password-reset' | 'transfer-otp' | …
  codeHash: String,
  attempts: { type: Number, default: 0 },
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, index: { expires: 0 } }
}, { timestamps: true });
const OneTimeCode = mongoose.models.OneTimeCode || mongoose.model('OneTimeCode', otpSchema);

const goalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  accountId: mongoose.Schema.Types.ObjectId,    // funding source
  name: String,
  icon: String,
  targetAmount: Number,
  currentAmount: { type: Number, default: 0 },
  deadline: Date,
  status: { type: String, default: 'active' }   // active | completed | archived
}, { timestamps: true });
const Goal = mongoose.models.Goal || mongoose.model('Goal', goalSchema);

const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  category: String,
  monthlyLimit: Number,
  alertThreshold: { type: Number, default: 0.8 } // notify at 80 %
}, { timestamps: true });
budgetSchema.index({ userId: 1, category: 1 }, { unique: true });
const Budget = mongoose.models.Budget || mongoose.model('Budget', budgetSchema);

const rewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  type: String,                                 // 'cashback' | 'referral' | 'bonus'
  amount: Number,
  sourceTxnId: String,
  description: String,
  status: { type: String, default: 'credited' } // credited | pending | reversed
}, { timestamps: true });
const Reward = mongoose.models.Reward || mongoose.model('Reward', rewardSchema);

const moneyRequestSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, index: true },   // requester
  toUserId:   { type: mongoose.Schema.Types.ObjectId, index: true },   // payer
  fromAccountId: mongoose.Schema.Types.ObjectId,                       // requester's account (where to receive)
  amount: Number,
  note: String,
  status: { type: String, default: 'pending' }, // pending | paid | declined | cancelled
  paidTxnId: String
}, { timestamps: true });
const MoneyRequest = mongoose.models.MoneyRequest || mongoose.model('MoneyRequest', moneyRequestSchema);

const pushSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  endpoint: { type: String, unique: true },
  p256dh: String,
  auth: String,
  userAgent: String
}, { timestamps: true });
const PushSubscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', pushSubscriptionSchema);

const webauthnCredentialSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  credentialID: { type: String, unique: true },     // base64url
  publicKey: String,                                 // base64url
  counter: { type: Number, default: 0 },
  transports: [String],
  deviceName: String,
  lastUsedAt: { type: Date, default: Date.now }
}, { timestamps: true });
const WebAuthnCredential = mongoose.models.WebAuthnCredential || mongoose.model('WebAuthnCredential', webauthnCredentialSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generateAccountNumber() {
  // 10-digit account number from cryptographically strong randomness.
  // Loops until we find one that isn't taken — collision odds are ~1/9e9.
  for (let attempt = 0; attempt < 8; attempt++) {
    const buf = crypto.randomBytes(8).readBigUInt64BE();
    const num = (1000000000n + (buf % 9000000000n)).toString();
    const check = await Account.findOne({ accountNumber: num });
    if (!check) return num;
  }
  throw new Error('Failed to allocate unique account number');
}

function generateTransactionId() {
  // 12 hex chars of crypto randomness — unguessable, collision-resistant.
  return `NXB${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

// ─── API Wrapper ─────────────────────────────────────────────────────────────

const Users = {
  findByEmail: async (email) => { await connectDB(); return await User.findOne({ email: email.toLowerCase() }); },
  findById: async (id) => { await connectDB(); return await User.findById(id); },
  findByPhone: async (phone) => { await connectDB(); return await User.findOne({ phone }); },
  create: async (data) => {
    await connectDB();
    const role = (data.email.toLowerCase() === 'admin@nexbank.com') ? 'admin' : 'user';
    return await new User({ ...data, role }).save();
  },
  update: async (id, updates) => { await connectDB(); return await User.findByIdAndUpdate(id, updates, { new: true }); },
  getAll: async () => { await connectDB(); return await User.find(); }
};

const Accounts = {
  findByUserId: async (userId) => { await connectDB(); return await Account.find({ userId }); },
  findByAccountNumber: async (num) => { await connectDB(); return await Account.findOne({ accountNumber: num }); },
  findById: async (id) => { await connectDB(); return await Account.findById(id); },
  getAll: async () => { await connectDB(); return await Account.find(); },
  create: async (data) => {
    await connectDB();
    const accountNumber = await generateAccountNumber();
    return await new Account({ ...data, accountNumber }).save();
  },
  // Non-atomic single-account balance bump. Used only for FD credit/debit and
  // similar internal flows. User-to-user transfers MUST go through
  // services/transferService.executeTransfer, which uses an atomic
  // findOneAndUpdate inside a session.
  updateBalance: async (id, amount) => {
    await connectDB();
    const updated = await Account.findByIdAndUpdate(
      id,
      [{ $set: { balance: { $round: [{ $add: ['$balance', amount] }, 2] } } }],
      { new: true }
    );
    return updated;
  },
  update: async (id, updates) => { await connectDB(); return await Account.findByIdAndUpdate(id, updates, { new: true }); }
};

const Transactions = {
  findByAccountId: async (accountId, limit = 100) => {
    await connectDB();
    return await Transaction.find({ $or: [{ fromAccountId: accountId }, { toAccountId: accountId }] }).sort({ createdAt: -1 }).limit(limit);
  },
  findById: async (id) => { await connectDB(); return await Transaction.findById(id); },
  create: async (data) => {
    await connectDB();
    const payload = { ...data };
    if (!payload.transactionId) payload.transactionId = generateTransactionId();
    return await new Transaction(payload).save();
  },
  getAll: async () => { await connectDB(); return await Transaction.find().sort({ createdAt: -1 }); }
};

const Notifications = {
  findByUserId: async (userId) => { await connectDB(); return await Notification.find({ userId }).sort({ createdAt: -1 }); },
  create: async (data) => { await connectDB(); return await new Notification(data).save(); },
  markRead: async (id, userId) => { await connectDB(); return await Notification.findOneAndUpdate({ _id: id, userId }, { read: true }, { new: true }); },
  markAllRead: async (userId) => { await connectDB(); return await Notification.updateMany({ userId }, { read: true }); }
};

const Beneficiaries = {
  findByUserId: async (userId) => { await connectDB(); return await Beneficiary.find({ userId }); },
  create: async (data) => { await connectDB(); return await new Beneficiary(data).save(); },
  delete: async (id, userId) => { await connectDB(); return await Beneficiary.deleteOne({ _id: id, userId }); }
};

const FixedDeposits = {
  findByUserId: async (userId) => { await connectDB(); return await FixedDeposit.find({ userId }); },
  create: async (data) => { await connectDB(); return await new FixedDeposit(data).save(); },
  update: async (id, updates) => { await connectDB(); return await FixedDeposit.findByIdAndUpdate(id, updates, { new: true }); }
};

const Cards = {
  findByUserId: async (userId) => { await connectDB(); return await Card.find({ userId }); },
  create: async (data) => {
    await connectDB();
    const payload = { ...data };
    if (payload.cvv != null) payload.cvv = cardCrypto.encrypt(String(payload.cvv));
    return await new Card(payload).save();
  },
  update: async (id, updates) => { await connectDB(); return await Card.findByIdAndUpdate(id, updates, { new: true }); }
};

const Loans = {
  findByUserId: async (userId) => { await connectDB(); return await Loan.find({ userId }); },
  create: async (data) => { await connectDB(); return await new Loan(data).save(); },
  getAll: async () => { await connectDB(); return await Loan.find(); },
  countActive: async () => {
    await connectDB();
    return await Loan.countDocuments({ status: { $in: ['approved', 'under_review'] } });
  }
};

// ─── Phase-2 wrappers ────────────────────────────────────────────────────────

const RefreshTokens = {
  create: async (data) => { await connectDB(); return await new RefreshToken(data).save(); },
  findByHash: async (tokenHash) => { await connectDB(); return await RefreshToken.findOne({ tokenHash }); },
  delete: async (tokenHash) => { await connectDB(); return await RefreshToken.deleteOne({ tokenHash }); },
  deleteAllForUser: async (userId) => { await connectDB(); return await RefreshToken.deleteMany({ userId }); },
  listForUser: async (userId) => { await connectDB(); return await RefreshToken.find({ userId }).sort({ lastUsedAt: -1 }); },
  rotate: async (oldHash, newDoc) => {
    await connectDB();
    const session = await mongoose.startSession();
    try {
      let inserted;
      await session.withTransaction(async () => {
        const existing = await RefreshToken.findOneAndDelete({ tokenHash: oldHash }).session(session);
        if (!existing) throw new Error('refresh token not found or already used');
        [inserted] = await RefreshToken.create([newDoc], { session });
      });
      return inserted;
    } finally {
      session.endSession();
    }
  }
};

const Idempotencies = {
  find: async (userId, scope, key) => {
    await connectDB();
    return await Idempotency.findOne({ userId, scope, key });
  },
  store: async (data) => {
    await connectDB();
    return await Idempotency.create(data);
  }
};

const OneTimeCodes = {
  invalidatePrior: async (identifier, purpose) => {
    await connectDB();
    return await OneTimeCode.updateMany({ identifier, purpose, used: false }, { used: true });
  },
  create: async (data) => { await connectDB(); return await new OneTimeCode(data).save(); },
  findActive: async (identifier, purpose) => {
    await connectDB();
    return await OneTimeCode.findOne({ identifier, purpose, used: false }).sort({ createdAt: -1 });
  },
  markUsed: async (id) => { await connectDB(); return await OneTimeCode.updateOne({ _id: id }, { used: true }); },
  bumpAttempts: async (id) => { await connectDB(); return await OneTimeCode.updateOne({ _id: id }, { $inc: { attempts: 1 } }); }
};

const Goals = {
  findByUserId: async (userId) => { await connectDB(); return await Goal.find({ userId }).sort({ createdAt: -1 }); },
  findById: async (id) => { await connectDB(); return await Goal.findById(id); },
  create: async (data) => { await connectDB(); return await new Goal(data).save(); },
  update: async (id, updates) => { await connectDB(); return await Goal.findByIdAndUpdate(id, updates, { new: true }); },
  delete: async (id, userId) => { await connectDB(); return await Goal.deleteOne({ _id: id, userId }); }
};

const Budgets = {
  findByUserId: async (userId) => { await connectDB(); return await Budget.find({ userId }); },
  upsert: async (userId, category, monthlyLimit, alertThreshold) => {
    await connectDB();
    return await Budget.findOneAndUpdate(
      { userId, category },
      { monthlyLimit, alertThreshold },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  },
  delete: async (userId, category) => { await connectDB(); return await Budget.deleteOne({ userId, category }); }
};

const Rewards = {
  findByUserId: async (userId, limit = 50) => {
    await connectDB();
    return await Reward.find({ userId }).sort({ createdAt: -1 }).limit(limit);
  },
  create: async (data) => { await connectDB(); return await new Reward(data).save(); },
  totalForUser: async (userId) => {
    await connectDB();
    const [agg] = await Reward.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'credited' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    return agg ? agg.total : 0;
  }
};

const MoneyRequests = {
  findIncoming: async (userId) => {
    await connectDB();
    return await MoneyRequest.find({ toUserId: userId }).sort({ createdAt: -1 }).limit(100);
  },
  findOutgoing: async (userId) => {
    await connectDB();
    return await MoneyRequest.find({ fromUserId: userId }).sort({ createdAt: -1 }).limit(100);
  },
  findById: async (id) => { await connectDB(); return await MoneyRequest.findById(id); },
  create: async (data) => { await connectDB(); return await new MoneyRequest(data).save(); },
  update: async (id, updates) => { await connectDB(); return await MoneyRequest.findByIdAndUpdate(id, updates, { new: true }); }
};

const PushSubscriptions = {
  upsert: async (userId, endpoint, p256dh, auth, userAgent) => {
    await connectDB();
    return await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId, endpoint, p256dh, auth, userAgent },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  },
  findByUserId: async (userId) => { await connectDB(); return await PushSubscription.find({ userId }); },
  deleteByEndpoint: async (endpoint) => { await connectDB(); return await PushSubscription.deleteOne({ endpoint }); }
};

const WebAuthnCredentials = {
  findByUserId: async (userId) => { await connectDB(); return await WebAuthnCredential.find({ userId }); },
  findByCredentialId: async (credentialID) => { await connectDB(); return await WebAuthnCredential.findOne({ credentialID }); },
  create: async (data) => { await connectDB(); return await new WebAuthnCredential(data).save(); },
  updateCounter: async (credentialID, counter) => {
    await connectDB();
    return await WebAuthnCredential.updateOne({ credentialID }, { counter, lastUsedAt: new Date() });
  },
  delete: async (id, userId) => { await connectDB(); return await WebAuthnCredential.deleteOne({ _id: id, userId }); }
};

module.exports = {
  // existing
  Users, Accounts, Transactions, Notifications, Beneficiaries, FixedDeposits, Cards, Loans,
  // phase-2
  RefreshTokens, Idempotencies, OneTimeCodes, Goals, Budgets, Rewards, MoneyRequests,
  PushSubscriptions, WebAuthnCredentials,
  // raw models
  User, Account, Transaction, Notification, Card, FixedDeposit, Loan,
  RefreshToken, Idempotency, OneTimeCode, Goal, Budget, Reward, MoneyRequest,
  PushSubscription, WebAuthnCredential,
  // utilities
  connectDB, generateTransactionId, mongoose, getLastError: () => lastError
};

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI && process.env.NODE_ENV === 'production') {
  console.error('CRITICAL: MONGODB_URI is not defined in environment variables!');
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
  profilePicture: String,
  role: { type: String, default: 'user' },
  lastLogin: Date
}, { timestamps: true });

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountType: { type: String, required: true }, // savings, current
  accountName: String,
  accountNumber: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  interestRate: { type: Number, default: 3.5 },
  minimumBalance: { type: Number, default: 500 },
  ifscCode: { type: String, default: 'NEXB0001234' },
  branch: { type: String, default: 'Main Branch' },
  nomineeName: String,
  status: { type: String, default: 'active' }
}, { timestamps: true });

const transactionSchema = new mongoose.Schema({
  fromAccountId: { type: String, required: true }, // Can be 'FD_ACCOUNT', 'LOAN_SYSTEM', or account ID
  toAccountId: { type: String, required: true },
  fromAccountNumber: String,
  toAccountNumber: String,
  amount: { type: Number, required: true },
  type: { type: String, required: true }, // transfer, fd_creation, fd_break, loan_disbursement, loan_repayment
  mode: { type: String, default: 'internal' }, // IMPS, NEFT, RTGS, UPI, internal
  category: { type: String, default: 'Other' },
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
  icon: String,
  transactionId: String
}, { timestamps: true });

const beneficiarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountNumber: { type: String, required: true },
  accountHolderName: String,
  ifscCode: String,
  bankName: String,
  nickname: String
}, { timestamps: true });

const fdSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  principalAmount: { type: Number, required: true },
  interestRate: { type: Number, required: true },
  tenureMonths: { type: Number, required: true },
  maturityAmount: { type: Number, required: true },
  maturityDate: { type: Date, required: true },
  status: { type: String, default: 'active' }, // active, closed, broken
  fdNumber: { type: String, required: true, unique: true }
}, { timestamps: true });

const cardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  cardType: { type: String, default: 'debit' },
  cardNetwork: { type: String, default: 'Visa' },
  cardNumber: { type: String, required: true, unique: true },
  cvv: { type: String, required: true },
  expiryDate: { type: String, required: true },
  cardHolderName: String,
  status: { type: String, default: 'active' },
  dailyLimit: { type: Number, default: 100000 },
  internationalUsage: { type: Boolean, default: false },
  contactlessEnabled: { type: Boolean, default: true }
}, { timestamps: true });

const loanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loanType: String,
  amount: Number,
  tenureMonths: Number,
  interestRate: Number,
  emi: Number,
  purpose: String,
  monthlyIncome: Number,
  status: { type: String, default: 'under_review' },
  applicationDate: { type: Date, default: Date.now }
}, { timestamps: true });

// ─── Models ──────────────────────────────────────────────────────────────────

const User = mongoose.model('User', userSchema);
const Account = mongoose.model('Account', accountSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);
const FixedDeposit = mongoose.model('FixedDeposit', fdSchema);
const Card = mongoose.model('Card', cardSchema);
const Loan = mongoose.model('Loan', loanSchema);

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

// ─── API Wrapper (to maintain compatibility as much as possible) ─────────────

const Users = {
  findByEmail: async (email) => await User.findOne({ email: email.toLowerCase() }),
  findById: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return await User.findById(id);
  },
  findByPhone: async (phone) => await User.findOne({ phone }),
  create: async (data) => {
    const userCount = await User.countDocuments();
    const isFirst = userCount === 0;
    const role = (data.email === 'admin@nexbank.com' || isFirst) ? 'admin' : (data.role || 'user');
    const user = new User({ ...data, role });
    return await user.save();
  },
  update: async (id, updates) => await User.findByIdAndUpdate(id, updates, { new: true }),
  getAll: async () => await User.find()
};

const Accounts = {
  findByUserId: async (userId) => await Account.find({ userId }),
  findByAccountNumber: async (num) => await Account.findOne({ accountNumber: num }),
  findById: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return await Account.findById(id);
  },
  create: async (data) => {
    const accountNumber = await generateAccountNumber();
    const account = new Account({ ...data, accountNumber });
    return await account.save();
  },
  updateBalance: async (id, amount) => {
    const account = await Account.findById(id);
    if (!account) return null;
    account.balance = parseFloat((account.balance + amount).toFixed(2));
    return await account.save();
  },
  update: async (id, updates) => await Account.findByIdAndUpdate(id, updates, { new: true }),
  getAll: async () => await Account.find()
};

const Transactions = {
  findByAccountId: async (accountId, limit = 50) => {
    return await Transaction.find({
      $or: [{ fromAccountId: accountId }, { toAccountId: accountId }]
    }).sort({ createdAt: -1 }).limit(limit);
  },
  findById: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return await Transaction.findById(id);
  },
  create: async (data) => {
    const transactionId = generateTransactionId();
    const txn = new Transaction({ ...data, transactionId });
    return await txn.save();
  },
  getAll: async () => await Transaction.find().sort({ createdAt: -1 })
};

const Notifications = {
  findByUserId: async (userId) => await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50),
  create: async (data) => {
    const notif = new Notification(data);
    return await notif.save();
  },
  markRead: async (id, userId) => await Notification.findOneAndUpdate({ _id: id, userId }, { read: true }, { new: true }),
  markAllRead: async (userId) => await Notification.updateMany({ userId }, { read: true })
};

const Beneficiaries = {
  findByUserId: async (userId) => await Beneficiary.find({ userId }),
  create: async (data) => {
    const ben = new Beneficiary(data);
    return await ben.save();
  },
  findById: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return await Beneficiary.findById(id);
  },
  delete: async (id, userId) => {
    const result = await Beneficiary.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }
};

const FixedDeposits = {
  findByUserId: async (userId) => await FixedDeposit.find({ userId }),
  create: async (data) => {
    const fd = new FixedDeposit(data);
    return await fd.save();
  },
  update: async (id, updates) => await FixedDeposit.findByIdAndUpdate(id, updates, { new: true })
};

const Cards = {
  findByUserId: async (userId) => await Card.find({ userId }),
  findByAccountId: async (accountId) => await Card.find({ accountId }),
  create: async (data) => {
    const card = new Card(data);
    return await card.save();
  },
  update: async (id, updates) => await Card.findByIdAndUpdate(id, updates, { new: true })
};

const Loans = {
  findByUserId: async (userId) => await Loan.find({ userId }),
  create: async (data) => {
    const loan = new Loan(data);
    return await loan.save();
  },
  getAll: async () => await Loan.find()
};

// ─── DB Connection ───────────────────────────────────────────────────────────

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    console.log('Using existing MongoDB connection');
    return;
  }
  
  if (!MONGODB_URI) {
    console.error('❌ CRITICAL: MONGODB_URI environment variable is MISSING!');
  }

  try {
    const uri = MONGODB_URI || 'mongodb://localhost:27017/nexbank';
    console.log(`Connecting to MongoDB... (URI length: ${uri ? uri.length : 0})`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000 // Fast fail so we can see error
    });
    console.log('✅ MongoDB Connected Successfully');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    // Don't crash on Vercel
  }
};

module.exports = { 
  Users, Accounts, Transactions, Notifications, Beneficiaries, FixedDeposits, Cards, Loans,
  generateTransactionId, connectDB, mongoose 
};

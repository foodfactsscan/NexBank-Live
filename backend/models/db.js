const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000, // Faster timeout
      heartbeatFrequencyMS: 2000,
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
        cached.promise = null; // Reset on failure
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
  role: { type: String, default: 'user' }, lastLogin: Date
}, { timestamps: true });

const accountSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, accountType: { type: String, default: 'savings' }, 
  accountName: String, accountNumber: { type: String, unique: true }, 
  balance: { type: Number, default: 1000 }, status: { type: String, default: 'active' },
  ifscCode: { type: String, default: 'NEXB0001234' }, branch: { type: String, default: 'Digital Branch, Mumbai' },
  currency: { type: String, default: 'INR' }, interestRate: { type: Number, default: 3.5 },
  minimumBalance: { type: Number, default: 500 }, nomineeName: String
}, { timestamps: true });

const transactionSchema = new mongoose.Schema({
  fromAccountId: String, toAccountId: String, fromAccountNumber: String, toAccountNumber: String,
  amount: Number, type: String, category: String, description: String, 
  status: { type: String, default: 'completed' }, transactionId: { type: String, unique: true },
  toAccountHolderName: String, fromAccountHolderName: String, mode: { type: String, default: 'IMPS' }
}, { timestamps: true });

const cardSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, accountId: mongoose.Schema.Types.ObjectId, 
  cardNumber: { type: String, unique: true }, cvv: String, expiryDate: String, 
  cardType: { type: String, default: 'debit' }, cardNetwork: { type: String, default: 'Visa' },
  cardHolderName: String, status: { type: String, default: 'active' },
  dailyLimit: { type: Number, default: 100000 }, internationalUsage: { type: Boolean, default: false },
  contactlessEnabled: { type: Boolean, default: true }
}, { timestamps: true });

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generateAccountNumber() {
  let num; let exists = true;
  while (exists) {
    num = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const check = await Account.findOne({ accountNumber: num });
    if (!check) exists = false;
  }
  return num;
}

function generateTransactionId() {
  return `NXB${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
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
  create: async (data) => {
    await connectDB();
    const accountNumber = await generateAccountNumber();
    return await new Account({ ...data, accountNumber }).save();
  },
  updateBalance: async (id, amount) => {
    await connectDB();
    const acc = await Account.findById(id);
    if (!acc) return null;
    acc.balance = parseFloat((acc.balance + amount).toFixed(2));
    return await acc.save();
  },
  update: async (id, updates) => { await connectDB(); return await Account.findByIdAndUpdate(id, updates, { new: true }); }
};

const Transactions = {
  findByAccountId: async (accountId, limit = 100) => { 
    await connectDB(); 
    return await Transaction.find({ $or: [{ fromAccountId: accountId }, { toAccountId: accountId }] }).sort({ createdAt: -1 }).limit(limit); 
  },
  create: async (data) => { await connectDB(); return await new Transaction({ ...data, transactionId: generateTransactionId() }).save(); },
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
  create: async (data) => { await connectDB(); return await new Card(data).save(); },
  update: async (id, updates) => { await connectDB(); return await Card.findByIdAndUpdate(id, updates, { new: true }); }
};

const Loans = {
  findByUserId: async (userId) => { await connectDB(); return await Loan.find({ userId }); },
  create: async (data) => { await connectDB(); return await new Loan(data).save(); },
  getAll: async () => { await connectDB(); return await Loan.find(); }
};

module.exports = { 
  Users, Accounts, Transactions, Notifications, Beneficiaries, FixedDeposits, Cards, Loans,
  connectDB, generateTransactionId, mongoose 
};

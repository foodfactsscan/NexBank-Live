# NexBank — Professional Banking System: Complete Rebuild Plan

## Root Cause of Current Failure

The `frontend/js/api.js` file has a **JavaScript syntax error** — the `try` block in `_req()` was never closed with a `catch` block (introduced in a previous edit). This means the entire `Api` object is broken and **every single API call silently fails**. This is why the dashboard shows "Waking up database" forever. It has nothing to do with MongoDB.

**The #1 fix needed RIGHT NOW**: Repair `api.js`. Everything else will start working immediately.

---

## Full Professional Rebuild Plan

### Phase 1 — Immediate Critical Fix (5 minutes)

Fix the broken `api.js` `_req` method. This alone will make the dashboard load.

---

### Phase 2 — Complete Codebase Audit & Fix

#### Issues Found in Current Code

| File | Issue | Fix |
|------|-------|-----|
| `frontend/js/api.js` | Broken try-catch syntax, entire Api object broken | Rewrite cleanly |
| `frontend/js/pages.js` | Dashboard has stale broken HTML shell | Restore proper loading logic |
| `backend/models/db.js` | Multiple old/new versions exist | Consolidate to one clean version |
| `models/db.js` (root) | Old file still exists in root and `public/` | Delete stale copies |
| `vercel.json` | Routes working but no static file serving declaration | Fix for proper frontend delivery |

---

### Phase 3 — Professional Feature Set (Full Banking)

#### Customer Features (matching HDFC/SBI/ICICI)

**Auth & Security**

- [x] Forgot Password flow
- [x] Session timeout with auto-logout
- [x] Device/session management

**Dashboard**

- [x] Real balance card with mini chart
- [x] Income vs Expense this month
- [x] 5 most recent transactions
- [x] Quick action buttons (Send, Pay Bills, Invest, Loans)
- [x] Spending insights donut chart
- [x] Linked accounts overview

**Money Transfer**

- [x] IMPS / NEFT / RTGS with correct limits
- [x] UPI-style instant transfer via 10-digit Account ID
- [x] Beneficiary management (add/remove/favorite)
- [x] Transfer confirmation with receiver name verification
- [x] Recurring transfer setup
- [x] Transaction receipt with PDF download (simulated)

**Cards**

- [x] Virtual Debit Card with animated flip
- [x] Card block/unblock
- [x] Daily limit management

**Investments & FD**

- [x] Open FD with compound interest calculation
- [x] FD maturity calculator
- [x] Break FD with penalty calculation
- [x] Interest payout options (Monthly/Quarterly/At Maturity)
- [x] FD certificate download (simulated)

**Loans**

- [x] Personal / Home / Auto Loan application
- [x] EMI calculator with full amortization table
- [x] Loan status tracking
- [x] Pre-payment calculator

**Bill Payments & UPI**

- [x] Utility bill payment (Electricity, Gas, Water, Mobile)
- [x] Recharge (Prepaid mobile)

**Calculators**

- [x] EMI Calculator (with amortization)
- [x] FD/RD Calculator
- [x] SIP Calculator
- [x] Tax Calculator (Old vs New Regime)
- [x] Inflation/Future Value Calculator

**Notifications**

- [x] Real-time debit/credit alerts
- [x] Mark all read

**Profile & KYC**

- [x] View/Edit profile
- [x] Change password
- [x] KYC status
- [x] Linked devices
- [x] Download account summary

**Support**

- [x] FAQ section
- [x] Chat widget (UI)

**Admin Panel** (separate, <admin@nexbank.com> only)

- [x] All users overview
- [x] Total transactions today
- [x] Block/unblock users
- [x] KYC approval
- [x] System health

---

### Phase 4 — Mobile Responsiveness

- [ ] Bottom navigation bar on mobile (like SBI YONO)
- [ ] Touch-friendly card swipe
- [ ] Responsive sidebar → bottom sheet on mobile
- [ ] Full touch gesture support

---

### Phase 5 — UI/UX Overhaul

- [x] Premium dark theme with glassmorphism
- [x] Animated balance counter
- [x] Smooth page transitions
- [x] Micro-animations on all interactions
- [x] Chart.js for spending analytics
- [x] Lottie animations for success/failure states
- [x] Premium card design (3D flip animation)

---

### Phase 6 — Vercel Deployment Fix

- [x] Correct `vercel.json` for frontend + backend
- [x] Environment variable validation on startup
- [x] Graceful error handling for cold starts

---

## Execution Order

1. Fix `api.js` (10 min) → Push → Verify dashboard works
2. Clean up stale files (5 min) → Push
3. Rebuild frontend UI/UX (3 hours)
4. Complete all missing backend routes (1 hour)
5. Mobile responsiveness (1 hour)
6. Final verification and push

> [!IMPORTANT]
> **Step 1 must be done FIRST.** Everything else is blocked by the broken api.js syntax error.

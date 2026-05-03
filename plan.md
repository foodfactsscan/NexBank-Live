# NexBank — End-to-End Build Plan

## ✅ Already Done (Backend)
- `package.json`, `server.js`, `models/db.js`
- `middleware/auth.js`
- `routes/auth.js`, `routes/accounts.js`, `routes/transactions.js`, `routes/users.js`, `routes/notifications.js`
- `public/index.html`

---

## 🔲 Remaining Steps (execute one per turn)

### Step 1 — `public/css/style.css` (Part A: base + auth)
Variables, reset, loading screen, auth page layout, auth card, form inputs, buttons.

### Step 2 — `public/css/style.css` (Part B: append sidebar + dashboard + cards)
Sidebar, topbar, dashboard cards, balance widget, transaction list, charts, modals, toast.

### Step 3 — `public/js/api.js`
API wrapper: all fetch calls, JWT header injection, WebSocket class.

### Step 4 — `public/js/pages.js` (Part A: dashboard + transfer)
Dashboard render (balance, recent txns, quick actions, chart).
Transfer page (form, account verify, confirmation modal).

### Step 5 — `public/js/pages.js` (Part B: transactions + accounts + cards)
Full transaction history with filters. Account details + statement download. Card management UI.

### Step 6 — `public/js/pages.js` (Part C: investments + loans + beneficiaries)
FD creation form + list. Loan apply form + EMI calc. Beneficiary add/delete.

### Step 7 — `public/js/pages.js` (Part D: calculators + profile + notifications + support)
EMI / FD / SIP calculators. Profile edit. Notification list. Support/FAQ page.

### Step 8 — `public/js/app.js`
App bootstrap, Auth class, routing, sidebar, toast, modal, WebSocket handler, real-time updates.

### Step 9 — Start server + smoke test
Run `node server.js`, open browser, test register → login → transfer.

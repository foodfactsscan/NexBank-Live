'use strict';
const API_BASE = '/api';

const Api = {
  _token: null,
  setToken(t){ this._token = t; localStorage.setItem('nexbank_token', t); },
  clearToken(){ this._token = null; localStorage.removeItem('nexbank_token'); },
  loadToken(){ this._token = localStorage.getItem('nexbank_token'); return this._token; },

  async _req(method, path, body){
    const headers = { 'Content-Type': 'application/json' };
    if(this._token) headers['Authorization'] = `Bearer ${this._token}`;
    const opts = { method, headers };
    if(body) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  get: (path) => Api._req('GET', path),
  post: (path, body) => Api._req('POST', path, body),
  put: (path, body) => Api._req('PUT', path, body),
  del: (path) => Api._req('DELETE', path),

  // Auth
  register: (d) => Api.post('/auth/register', d),
  login: (d) => Api.post('/auth/login', d),
  me: () => Api.get('/auth/me'),
  changePassword: (d) => Api.post('/auth/change-password', d),

  // Accounts
  getAccounts: () => Api.get('/accounts'),
  getAccount: (id) => Api.get(`/accounts/${id}`),
  getStatement: (id, limit=100) => Api.get(`/accounts/${id}/statement?limit=${limit}`),
  getSummary: (id) => Api.get(`/accounts/${id}/summary`),
  createFD: (d) => Api.post('/accounts/fd/create', d),
  getFDs: () => Api.get('/accounts/fd/list'),
  breakFD: (id) => Api.post(`/accounts/fd/${id}/break`),

  // Transactions
  transfer: (d) => Api.post('/transactions/transfer', d),
  getTransactions: (limit=50) => Api.get(`/transactions?limit=${limit}`),
  getTransaction: (id) => Api.get(`/transactions/${id}`),
  verifyAccount: (num) => Api.get(`/transactions/verify-account/${num}`),
  getBeneficiaries: () => Api.get('/transactions/beneficiaries/list'),
  addBeneficiary: (d) => Api.post('/transactions/beneficiaries/add', d),
  deleteBeneficiary: (id) => Api.del(`/transactions/beneficiaries/${id}`),

  // Users
  getProfile: () => Api.get('/users/profile'),
  updateProfile: (d) => Api.put('/users/profile', d),
  getCards: () => Api.get('/users/cards'),
  updateCard: (id, d) => Api.put(`/users/cards/${id}`, d),
  applyLoan: (d) => Api.post('/users/loans/apply', d),
  getLoans: () => Api.get('/users/loans'),
  lookupAccount: (num) => Api.get(`/users/lookup/${num}`),

  // Notifications
  getNotifications: () => Api.get('/notifications'),
  markRead: (id) => Api.put(`/notifications/${id}/read`),
  markAllRead: () => Api.put('/notifications/read-all/mark'),

  // Admin
  getAdminStats: () => Api.get('/admin/stats'),
  getAdminUsers: () => Api.get('/admin/users'),
  blockUser: (id) => Api.post(`/admin/users/${id}/block`)
};

// ── WebSocket Manager ─────────────────────────────────
const WS = {
  socket: null,
  accountId: null,
  reconnectTimer: null,
  handlers: {},

  connect(accountId){
    this.accountId = accountId;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      clearTimeout(this.reconnectTimer);
      this.socket.send(JSON.stringify({ type: 'authenticate', accountId }));
      document.getElementById('ws-badge')?.classList.remove('offline');
      console.log('[WS] Connected');
    };

    this.socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if(this.handlers[msg.type]) this.handlers[msg.type](msg);
      } catch {}
    };

    this.socket.onclose = () => {
      document.getElementById('ws-badge')?.classList.add('offline');
      this.reconnectTimer = setTimeout(() => this.connect(this.accountId), 3000);
    };

    this.socket.onerror = () => this.socket.close();
  },

  on(type, fn){ this.handlers[type] = fn; },

  disconnect(){
    clearTimeout(this.reconnectTimer);
    if(this.socket) this.socket.close();
  }
};

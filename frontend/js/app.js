const App = {
  currentPage: 'dashboard',
  user: null,
  accounts: [],

  init() {
    this.checkAuth();
    this.setupListeners();
  },

  checkAuth() {
    const token = Api.loadToken();
    if (!token) {
      this.showAuth();
    } else {
      Api.me().then(res => {
        this.user = res.user;
        this.accounts = res.accounts;
        this.showMain();
        WS.connect(this.accounts[0].id);
        this.setupWSHandlers();
      }).catch(err => {
        console.error('Auth error:', err);
        this.showAuth();
      });
    }
  },

  setupWSHandlers() {
    WS.on('balance_update', (data) => {
      if (document.getElementById('dash-bal')) {
        document.getElementById('dash-bal').textContent = data.balance.toLocaleString('en-IN', {minimumFractionDigits: 2});
      }
    });

    WS.on('transaction', (data) => {
      this.toast(data.message || 'New transaction received!', 'success');
      if (document.getElementById('dash-bal')) {
        document.getElementById('dash-bal').textContent = data.newBalance.toLocaleString('en-IN', {minimumFractionDigits: 2});
      }
      if (this.currentPage === 'dashboard') Pages.renderDashboard();
      if (this.currentPage === 'transactions') Pages.renderTransactions();
    });
  },

  showAuth() {
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('page-auth').classList.remove('hidden');
    document.getElementById('page-main').classList.add('hidden');
    this.showLogin();
  },

  showMain() {
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('page-auth').classList.add('hidden');
    document.getElementById('page-main').classList.remove('hidden');
    
    // Update sidebar / topbar UI
    const nameStr = `${this.user.firstName} ${this.user.lastName}`;
    const initials = nameStr.split(' ').map(n => n[0]).join('').substring(0, 2);
    
    document.getElementById('sidebar-name').textContent = nameStr;
    document.getElementById('sidebar-acc').textContent = `A/C: ${this.accounts[0]?.accountNumber || '—'}`;
    document.getElementById('sidebar-avatar').textContent = initials;
    document.getElementById('topbar-avatar').textContent = initials;
    
    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) {
      if (this.user.role === 'admin') {
        navAdmin.classList.remove('hidden');
      } else {
        navAdmin.classList.add('hidden');
      }
    }
    
    this.navigate('dashboard');
    this.fetchNotificationsCount();
  },

  showLogin() {
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('form-register').classList.add('hidden');
    document.getElementById('form-login').classList.remove('hidden');
  },

  showRegister() {
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-register').classList.remove('hidden');
  },

  togglePwd(id, btn) {
    const input = document.getElementById(id);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  },

  navigate(page) {
    this.currentPage = page;
    
    // Update Sidebar Active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if(navItem) navItem.classList.add('active');
    
    // Update Topbar Title
    const titles = {
      dashboard: 'Dashboard', transfer: 'Send Money', transactions: 'Transactions',
      accounts: 'My Accounts', cards: 'Manage Cards', investments: 'Investments & FDs',
      loans: 'Loans', beneficiaries: 'Beneficiaries', calculators: 'Calculators',
      profile: 'My Profile', support: 'Support', admin: 'Admin Control Panel'
    };
    document.getElementById('page-title').textContent = titles[page] || 'NexBank';

    // Toggle Views
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
    const view = document.getElementById(`view-${page}`);
    if (view) view.classList.remove('hidden');
    
    // Call render function
    const fnName = 'render' + page.charAt(0).toUpperCase() + page.slice(1);
    if (Pages[fnName]) Pages[fnName]();

    // Close sidebar on mobile
    this.closeSidebar();
  },

  openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('open');
  },
  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  },

  openModal(type) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    
    if (type === 'terms') {
      content.innerHTML = `
        <h2 class="modal-title"><i class="fa fa-file-contract text-accent"></i> Terms & Conditions</h2>
        <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.6; max-height:400px; overflow-y:auto; padding-right:8px;">
          <p class="mb-12"><strong>1. Acceptance of Terms:</strong> By opening an account with NexBank, you agree to abide by these terms and conditions. These terms govern the use of all NexBank digital and physical services.</p>
          <p class="mb-12"><strong>2. Real-Time Transfers:</strong> NexBank facilitates instant transfers (IMPS/UPI). By initiating a transfer, you confirm the destination account is correct. Transactions once processed cannot be reversed without the beneficiary's consent.</p>
          <p class="mb-12"><strong>3. Security and Authentication:</strong> You are responsible for keeping your login credentials, passwords, and OTPs confidential. NexBank will never ask for your password or OTP over phone calls or emails.</p>
          <p class="mb-12"><strong>4. Account Maintenance:</strong> Users must maintain the prescribed minimum balance depending on their account type. Failure to do so may result in penalties as outlined in our fee schedule.</p>
          <p><strong>5. Fraudulent Activities:</strong> Any attempt to compromise the integrity of the banking portal, including unauthorized access or exploitation of bugs, will result in immediate termination of the account and legal action.</p>
        </div>
        <button class="btn-primary mt-20" onclick="App.closeModal()">I Understand</button>
      `;
    } else if (type === 'privacy') {
      content.innerHTML = `
        <h2 class="modal-title"><i class="fa fa-user-shield text-accent"></i> Privacy Policy</h2>
        <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.6; max-height:400px; overflow-y:auto; padding-right:8px;">
          <p class="mb-12"><strong>1. Data Collection:</strong> NexBank collects personal and financial data (such as PAN, Aadhaar, DOB, and transaction history) to comply with RBI regulations and perform KYC requirements.</p>
          <p class="mb-12"><strong>2. Data Usage:</strong> Your data is used exclusively to facilitate banking services, improve our digital platforms, and provide customized financial insights.</p>
          <p class="mb-12"><strong>3. Information Security:</strong> We employ state-of-the-art 256-bit AES encryption to protect your data both in transit and at rest. Access to your personal data is strictly limited to authorized personnel.</p>
          <p><strong>4. Third-Party Sharing:</strong> NexBank does not sell your personal data. We may share necessary information with regulatory bodies or trusted infrastructure partners to process your transactions seamlessly.</p>
        </div>
        <button class="btn-primary mt-20" onclick="App.closeModal()">I Understand</button>
      `;
    }
    
    overlay.classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  toast(msg, type='info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
    const titles = { success: 'Success', error: 'Error', info: 'Information', warning: 'Warning' };
    
    toast.innerHTML = `
      <i class="fa fa-${icons[type]} toast-icon"></i>
      <div class="toast-body">
        <div class="toast-title">${titles[type]}</div>
        <div class="toast-msg">${msg}</div>
      </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  async fetchNotificationsCount() {
    try {
      const res = await Api.getNotifications();
      const count = res.unreadCount;
      const badge = document.getElementById('notif-badge');
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    } catch(err) {}
  },

  setupListeners() {
    window.addEventListener('load', () => {
      // Force hide loading screen after 3 seconds maximum
      setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if (loader) {
          loader.style.opacity = '0';
          loader.style.pointerEvents = 'none';
          setTimeout(() => loader.classList.add('hidden'), 500);
        }
      }, 3000);
    });
  }
};

const Auth = {
  async login() {
    const email = document.getElementById('login-email').value;
    const pwd = document.getElementById('login-password').value;
    
    if(!email || !pwd) return App.toast('Please enter email and password', 'error');
    
    const btn = document.getElementById('btn-login');
    btn.innerHTML = `<i class="fa fa-spinner spin"></i> Signing In...`;
    btn.disabled = true;
    
    try {
      const res = await Api.login({ email, password: pwd });
      Api.setToken(res.token);
      App.toast('Login successful', 'success');
      App.checkAuth();
    } catch(err) {
      App.toast(err.message, 'error');
      btn.innerHTML = `<span>Login Securely</span><i class="fa fa-arrow-right"></i>`;
      btn.disabled = false;
    }
  },

  async loginWithAccount() {
    const acc = document.getElementById('login-accnum').value;
    const pwd = document.getElementById('login-password').value; // Using same password field for simplicity
    
    if(!acc || !pwd) return App.toast('Please enter account number and password', 'error');
    if(acc.length !== 10) return App.toast('Account number must be 10 digits', 'error');

    try {
      const res = await Api.login({ accountNumber: acc, password: pwd });
      Api.setToken(res.token);
      App.toast('Login successful', 'success');
      App.checkAuth();
    } catch(err) {
      App.toast(err.message, 'error');
    }
  },

  async register() {
    const terms = document.getElementById('reg-terms').checked;
    if(!terms) return App.toast('Please accept Terms & Conditions', 'error');

    const data = {
      firstName: document.getElementById('reg-fname').value,
      lastName: document.getElementById('reg-lname').value,
      email: document.getElementById('reg-email').value,
      phone: document.getElementById('reg-phone').value,
      password: document.getElementById('reg-password').value,
      dateOfBirth: document.getElementById('reg-dob').value,
      address: document.getElementById('reg-address').value,
      gender: document.getElementById('reg-gender').value,
      panNumber: document.getElementById('reg-pan').value || undefined
    };

    const confirmPwd = document.getElementById('reg-cpassword').value;
    
    if(!data.firstName || !data.email || !data.phone || !data.password) {
      return App.toast('Please fill all required fields', 'error');
    }
    if(data.password !== confirmPwd) {
      return App.toast('Passwords do not match', 'error');
    }

    const btn = document.getElementById('btn-register');
    btn.innerHTML = `<i class="fa fa-spinner spin"></i> Creating Account...`;
    btn.disabled = true;

    try {
      const res = await Api.register(data);
      Api.setToken(res.token);
      App.toast('Account created successfully!', 'success');
      App.checkAuth();
    } catch(err) {
      App.toast(err.message, 'error');
      btn.innerHTML = `<span>Create Account</span><i class="fa fa-arrow-right"></i>`;
      btn.disabled = false;
    }
  },

  logout() {
    Api.clearToken();
    WS.disconnect();
    App.user = null;
    App.accounts = [];
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    App.showAuth();
  }
};

// Initialize app
App.init();

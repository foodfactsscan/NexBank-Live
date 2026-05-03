const App = {
  currentPage: 'dashboard',
  user: null,
  accounts: [],

  sessionTimeoutId: null,

  init() {
    this.setupListeners();
    this.checkAuth();
  },

  resetSessionTimeout() {
    if (this.sessionTimeoutId) clearTimeout(this.sessionTimeoutId);
    // 5 minutes timeout for security
    this.sessionTimeoutId = setTimeout(() => {
      if (this.user) {
        Auth.logout();
        this.toast('Session expired due to inactivity', 'warning');
      }
    }, 5 * 60 * 1000);
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
      }).catch(() => {
        Api.clearToken();
        this.showAuth();
      });
    }
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

    const nameStr = `${this.user.firstName} ${this.user.lastName}`;
    const initials = nameStr.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    document.getElementById('sidebar-name').textContent = nameStr;
    document.getElementById('sidebar-acc').textContent = `A/C: ${this.accounts[0]?.accountNumber || '—'}`;
    document.getElementById('sidebar-avatar').textContent = initials;
    document.getElementById('topbar-avatar').textContent = initials;

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
      icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  },

  navigate(page) {
    this.currentPage = page;

    // Sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');

    // Mobile bottom nav active state
    document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
    const mobMap = { dashboard: 'mob-btn-dashboard', transactions: 'mob-btn-transactions', cards: 'mob-btn-cards', profile: 'mob-btn-profile' };
    if (mobMap[page]) document.getElementById(mobMap[page])?.classList.add('active');

    // Page title
    const titles = {
      dashboard: 'Dashboard', transfer: 'Send Money', transactions: 'Transaction History',
      accounts: 'My Accounts', bills: 'Bill Payments', cards: 'Manage Cards',
      investments: 'Investments & FDs', loans: 'Loans', beneficiaries: 'Beneficiaries',
      calculators: 'Calculators', profile: 'My Profile', support: 'Support',
      notifications: 'Notifications', admin: 'Admin Control Panel'
    };
    document.getElementById('page-title').textContent = titles[page] || 'NexBank';

    // Show/hide views
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
    const view = document.getElementById(`view-${page}`);
    if (view) view.classList.remove('hidden');

    // Render page
    const fnName = 'render' + page.charAt(0).toUpperCase() + page.slice(1);
    if (Pages[fnName]) Pages[fnName]();

    this.closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const content = document.getElementById('modal-content');
    if (type === 'terms') {
      content.innerHTML = `
        <h2 class="modal-title"><i class="fa fa-file-contract text-accent"></i> Terms &amp; Conditions</h2>
        <div style="font-size:.85rem;color:var(--text-muted);line-height:1.7;max-height:420px;overflow-y:auto;padding-right:8px">
          <p class="mb-12"><strong>1. Acceptance:</strong> By opening an account with NexBank, you agree to these terms. These govern use of all NexBank digital and physical services.</p>
          <p class="mb-12"><strong>2. Real-Time Transfers:</strong> NexBank facilitates instant transfers (IMPS/UPI). By initiating a transfer, you confirm the destination account is correct. Transactions once processed cannot be reversed without beneficiary consent.</p>
          <p class="mb-12"><strong>3. Security:</strong> You are responsible for keeping login credentials, passwords, and OTPs confidential. NexBank will never ask for your password over calls or emails.</p>
          <p class="mb-12"><strong>4. Minimum Balance:</strong> Users must maintain the minimum balance per account type. Failure may result in penalties as per our fee schedule.</p>
          <p><strong>5. Fraudulent Activities:</strong> Any attempt to compromise the banking portal will result in immediate account termination and legal action.</p>
        </div>
        <button class="btn-primary mt-20" onclick="App.closeModal()">I Understand</button>`;
    } else if (type === 'privacy') {
      content.innerHTML = `
        <h2 class="modal-title"><i class="fa fa-user-shield text-accent"></i> Privacy Policy</h2>
        <div style="font-size:.85rem;color:var(--text-muted);line-height:1.7;max-height:420px;overflow-y:auto;padding-right:8px">
          <p class="mb-12"><strong>1. Data Collection:</strong> NexBank collects personal and financial data (PAN, Aadhaar, DOB, transaction history) to comply with RBI regulations and KYC requirements.</p>
          <p class="mb-12"><strong>2. Data Usage:</strong> Your data is used exclusively to facilitate banking services and provide customized financial insights.</p>
          <p class="mb-12"><strong>3. Security:</strong> We employ state-of-the-art 256-bit AES encryption to protect your data in transit and at rest.</p>
          <p><strong>4. Third-Party Sharing:</strong> NexBank does not sell your personal data. We may share necessary information with regulatory bodies to process your transactions.</p>
        </div>
        <button class="btn-primary mt-20" onclick="App.closeModal()">I Understand</button>`;
    } else if (type === 'custom') {
      // content already set by caller
    }
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  showCustomModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
    const titles = { success: 'Success', error: 'Error', info: 'Information', warning: 'Warning' };
    toast.innerHTML = `
      <i class="fa fa-${icons[type] || 'info-circle'} toast-icon"></i>
      <div class="toast-body">
        <div class="toast-title">${titles[type] || 'Info'}</div>
        <div class="toast-msg">${msg}</div>
      </div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  async fetchNotificationsCount() {
    try {
      const res = await Api.getNotifications();
      const count = (res.notifications || []).filter(n => !n.read).length;
      const badge = document.getElementById('notif-badge');
      if (badge) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.toggle('hidden', count === 0);
      }
    } catch (e) {}
  },

  setupListeners() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if (loader) {
          loader.style.opacity = '0';
          loader.style.pointerEvents = 'none';
          setTimeout(() => loader.classList.add('hidden'), 500);
        }
      }, 2500);
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });

    // Session activity tracking
    ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, () => {
        if (this.user) this.resetSessionTimeout();
      });
    });
  }
};

const Auth = {
  async login() {
    const email = document.getElementById('login-email').value.trim();
    const pwd   = document.getElementById('login-password').value;
    if (!email || !pwd) return App.toast('Please enter email and password', 'error');

    const btn = document.getElementById('btn-login');
    btn.innerHTML = `<i class="fa fa-spinner spin"></i> Signing In...`;
    btn.disabled = true;

    try {
      const res = await Api.login({ email, password: pwd });
      Api.setToken(res.token);
      App.user = res.user;
      App.accounts = res.accounts;
      App.toast('Welcome back, ' + res.user.firstName + '!', 'success');
      App.showMain();
    } catch (err) {
      App.toast(err.message || 'Login failed', 'error');
    } finally {
      btn.innerHTML = `<span>Login Securely</span><i class="fa fa-arrow-right"></i>`;
      btn.disabled = false;
    }
  },

  async loginWithAccount() {
    const acc = document.getElementById('login-accnum').value.trim();
    const pwd = document.getElementById('login-password').value;
    if (!acc || !pwd) return App.toast('Please enter account number and password', 'error');
    if (acc.length !== 10 || !/^\d+$/.test(acc)) return App.toast('Account number must be exactly 10 digits', 'error');

    const btn = document.getElementById('btn-login');
    btn.innerHTML = `<i class="fa fa-spinner spin"></i> Signing In...`;
    btn.disabled = true;

    try {
      const res = await Api.login({ accountNumber: acc, password: pwd });
      Api.setToken(res.token);
      App.user = res.user;
      App.accounts = res.accounts;
      App.toast('Welcome back, ' + res.user.firstName + '!', 'success');
      App.showMain();
    } catch (err) {
      App.toast(err.message || 'Login failed', 'error');
    } finally {
      btn.innerHTML = `<span>Login Securely</span><i class="fa fa-arrow-right"></i>`;
      btn.disabled = false;
    }
  },

  forgotPassword() {
    App.showCustomModal(`
      <h2 class="modal-title"><i class="fa fa-lock text-accent"></i> Reset Password</h2>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px;">
        Enter your registered email address or account number to receive a secure password reset link.
      </p>
      <div class="form-group">
        <label class="form-label">Email or Account Number</label>
        <input type="text" id="reset-id" class="input-full" placeholder="john@example.com">
      </div>
      <button class="btn-primary w-full mt-20" onclick="Auth.submitForgotPassword()">Send Reset Link</button>
    `);
  },

  submitForgotPassword() {
    const val = document.getElementById('reset-id').value;
    if (!val) return App.toast('Please enter your email or account number', 'error');
    App.toast('A password reset link has been sent to your registered email.', 'success');
    App.closeModal();
  },

  async register() {
    const terms = document.getElementById('reg-terms').checked;
    if (!terms) return App.toast('Please accept Terms & Conditions', 'error');

    const data = {
      firstName:   document.getElementById('reg-fname').value.trim(),
      lastName:    document.getElementById('reg-lname').value.trim(),
      email:       document.getElementById('reg-email').value.trim(),
      phone:       document.getElementById('reg-phone').value.trim(),
      password:    document.getElementById('reg-password').value,
      dateOfBirth: document.getElementById('reg-dob').value,
      address:     document.getElementById('reg-address').value.trim(),
      gender:      document.getElementById('reg-gender').value,
      panNumber:   document.getElementById('reg-pan').value.trim().toUpperCase() || undefined
    };
    const confirmPwd = document.getElementById('reg-cpassword').value;

    if (!data.firstName || !data.lastName || !data.email || !data.phone || !data.password)
      return App.toast('Please fill all required fields', 'error');
    if (!/^\d{10}$/.test(data.phone))
      return App.toast('Mobile number must be exactly 10 digits', 'error');
    if (data.password.length < 8)
      return App.toast('Password must be at least 8 characters', 'error');
    if (data.password !== confirmPwd)
      return App.toast('Passwords do not match', 'error');

    const btn = document.getElementById('btn-register');
    btn.innerHTML = `<i class="fa fa-spinner spin"></i> Creating Account...`;
    btn.disabled = true;

    try {
      const res = await Api.register(data);
      Api.setToken(res.token);
      App.user = res.user;
      App.accounts = [res.account];
      App.toast('🎉 Account created! Welcome to NexBank!', 'success');
      App.showMain();
    } catch (err) {
      App.toast(err.message || 'Registration failed', 'error');
    } finally {
      btn.innerHTML = `<span>Create Account</span><i class="fa fa-arrow-right"></i>`;
      btn.disabled = false;
    }
  },

  logout() {
    Api.clearToken();
    WS.disconnect();
    App.user = null;
    App.accounts = [];
    // Clear form fields
    ['login-email', 'login-password', 'login-accnum'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    App.showAuth();
    App.toast('You have been logged out securely', 'info');
  },

  updateActivity() {
    this.lastActivity = new Date().toISOString();
  },

  animateValue(obj, start, end, duration, isCurrency = true) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const val = progress * (end - start) + start;
      obj.innerHTML = isCurrency 
        ? val.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})
        : Math.floor(val);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }
};

// Initialize app
App.init();

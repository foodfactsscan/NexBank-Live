const Pages = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  renderDashboard: async () => {
    const main = document.getElementById('view-dashboard');
    main.innerHTML = `<div class="empty-state"><i class="fa fa-spinner spin"></i><p>Loading dashboard...</p></div>`;
    try {
      const res = await Api.me();
      const acc = res.accounts[0];
      
      let summary = { monthlyIncome: 0, monthlyExpense: 0 };
      try {
        const summaryRes = await Api.getSummary(acc.id);
        summary = summaryRes.summary;
      } catch(e) { console.error('Summary load failed', e); }

      let txns = [];
      try {
        const txnsRes = await Api.getTransactions(5);
        txns = txnsRes.transactions || [];
      } catch(e) { console.error('Transactions load failed', e); }

      let txnsHtml = txns.length === 0 
        ? `<div class="empty-state" style="padding:20px"><p>No recent transactions</p></div>` 
        : txns.map(t => {
            const isCredit = t.toAccountId === acc.id;
            const icon = isCredit ? 'arrow-down credit' : 'arrow-up debit';
            const sign = isCredit ? '+' : '-';
            const color = isCredit ? 'credit' : 'debit';
            return `
              <div class="txn-item">
                <div class="txn-icon ${color}"><i class="fa fa-${icon}"></i></div>
                <div class="txn-info">
                  <div class="txn-name">${t.description || t.category}</div>
                  <div class="txn-date">${new Date(t.createdAt).toLocaleString()}</div>
                </div>
                <div class="txn-amount">
                  <div class="amount ${color}">${sign}₹${t.amount.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
                  <div class="txn-mode-badge">${t.mode}</div>
                </div>
              </div>
            `;
          }).join('');

      main.innerHTML = `
        <div class="section-title"><i class="fa fa-th-large"></i> Dashboard Overview</div>
        
        <div class="grid-3 mb-20">
          <div class="balance-card">
            <div class="balance-label">Available Balance</div>
            <div class="balance-amount"><span class="balance-currency">₹</span><span id="dash-bal">${acc.balance.toLocaleString('en-IN', {minimumFractionDigits:2})}</span></div>
            <div class="balance-acc">A/C: ${acc.accountNumber} • ${acc.accountType.toUpperCase()}</div>
            <div class="balance-actions">
              <button class="bal-btn" onclick="App.navigate('transfer')"><i class="fa fa-paper-plane"></i> Send</button>
              <button class="bal-btn" onclick="App.navigate('transactions')"><i class="fa fa-list"></i> Statement</button>
            </div>
          </div>
          
          <div class="stat-widget">
            <div class="stat-icon green"><i class="fa fa-arrow-down"></i></div>
            <div class="stat-info">
              <div class="stat-lbl">Income This Month</div>
              <div class="stat-val">₹${summary.monthlyIncome.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
            </div>
          </div>
          
          <div class="stat-widget">
            <div class="stat-icon red"><i class="fa fa-arrow-up"></i></div>
            <div class="stat-info">
              <div class="stat-lbl">Spends This Month</div>
              <div class="stat-val">₹${summary.monthlyExpense.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="form-section-title"><i class="fa fa-bolt"></i> Quick Actions</div>
            <div class="quick-actions">
              <div class="quick-btn" onclick="App.navigate('transfer')">
                <i class="fa fa-exchange-alt"></i><span>Transfer</span>
              </div>
              <div class="quick-btn" onclick="App.navigate('investments')">
                <i class="fa fa-chart-pie"></i><span>Open FD</span>
              </div>
              <div class="quick-btn" onclick="App.navigate('cards')">
                <i class="fa fa-credit-card"></i><span>Cards</span>
              </div>
              <div class="quick-btn" onclick="App.navigate('loans')">
                <i class="fa fa-hand-holding-usd"></i><span>Loans</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="flex justify-between items-center mb-16">
              <div class="form-section-title mb-0"><i class="fa fa-history"></i> Recent Transactions</div>
              <a href="#" onclick="App.navigate('transactions')" class="link-sm">View All</a>
            </div>
            <div class="txn-list" id="dash-recent-txns">
              ${txnsHtml}
            </div>
          </div>
        </div>
      `;
    } catch(err) {
      main.innerHTML = `<div class="empty-state"><i class="fa fa-exclamation-circle text-red"></i><p>Error loading dashboard: ${err.message}</p></div>`;
    }
  },

  // ── Transfer ──────────────────────────────────────────────────────────────
  renderTransfer: async () => {
    const main = document.getElementById('view-transfer');
    main.innerHTML = `<div class="empty-state"><i class="fa fa-spinner spin"></i><p>Loading...</p></div>`;
    try {
      const res = await Api.me();
      const acc = res.accounts[0];
      const bensRes = await Api.getBeneficiaries();
      const bens = bensRes.beneficiaries || [];

      let bensOpts = bens.map(b => `<option value="${b.accountNumber}">${b.nickname} (${b.accountNumber.slice(-4)})</option>`).join('');

      main.innerHTML = `
        <div class="section-title"><i class="fa fa-paper-plane"></i> Send Money</div>
        
        <div class="transfer-container">
          <div class="step-indicator">
            <div class="step active" id="ts-1"><div class="step-num">1</div><div class="step-label">Details</div></div>
            <div class="step" id="ts-2"><div class="step-num">2</div><div class="step-label">Verify</div></div>
            <div class="step" id="ts-3"><div class="step-num"><i class="fa fa-check"></i></div><div class="step-label">Done</div></div>
          </div>

          <div class="card" id="transfer-step-1">
            <div class="form-group">
              <label class="form-label">From Account</label>
              <select id="tf-from" class="input-full">
                <option value="${acc.id}">${acc.accountNumber} - Bal: ₹${acc.balance.toLocaleString('en-IN')}</option>
              </select>
            </div>

            <div class="pill-tabs mt-20">
              <button class="pill-tab active" onclick="Pages.setTfMode('new', this)">New Transfer</button>
              <button class="pill-tab" onclick="Pages.setTfMode('saved', this)">Saved Beneficiary</button>
            </div>

            <div id="tf-new-sec">
              <div class="form-group">
                <label class="form-label">To Account Number</label>
                <input type="text" id="tf-to-acc" class="input-full" placeholder="Enter 10-digit account number" maxlength="10">
              </div>
            </div>

            <div id="tf-saved-sec" class="hidden">
              <div class="form-group">
                <label class="form-label">Select Beneficiary</label>
                <select id="tf-ben" class="input-full">
                  <option value="">-- Select --</option>
                  ${bensOpts}
                </select>
              </div>
            </div>

            <div class="grid-2 mt-16">
              <div class="form-group">
                <label class="form-label">Amount (₹)</label>
                <input type="number" id="tf-amount" class="input-full" placeholder="0.00" min="1">
              </div>
              <div class="form-group">
                <label class="form-label">Transfer Mode</label>
                <select id="tf-mode" class="input-full">
                  <option value="IMPS">IMPS (Instant)</option>
                  <option value="NEFT">NEFT (Batch)</option>
                  <option value="RTGS">RTGS (> 2L)</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Remarks / Description</label>
              <input type="text" id="tf-desc" class="input-full" placeholder="e.g. Rent, Bill">
            </div>

            <div class="form-group" id="tf-save-ben-grp">
              <label class="checkbox-label">
                <input type="checkbox" id="tf-save-ben"> Save as beneficiary for future
              </label>
            </div>

            <button class="btn-primary w-full mt-16" onclick="Pages.verifyTransfer()">Proceed to Verify</button>
          </div>

          <div class="card hidden" id="transfer-step-2">
            <h3 class="font-bold text-center mb-20 text-accent">Verify Transfer Details</h3>
            
            <div class="confirm-box">
              <div class="confirm-sub">Amount to send</div>
              <div class="confirm-amount">₹<span id="tv-amt">0</span></div>
            </div>

            <div class="info-row"><span class="lbl">To Account:</span><span class="val" id="tv-acc">--</span></div>
            <div class="info-row"><span class="lbl">Receiver Name:</span><span class="val text-accent" id="tv-name">--</span></div>
            <div class="info-row"><span class="lbl">Transfer Mode:</span><span class="val" id="tv-mode">--</span></div>
            <div class="info-row"><span class="lbl">Remarks:</span><span class="val" id="tv-desc">--</span></div>

            <div class="grid-2 mt-24">
              <button class="btn-outline" onclick="Pages.editTransfer()">Back to Edit</button>
              <button class="btn-primary" onclick="Pages.confirmTransfer()">Confirm & Send</button>
            </div>
          </div>

          <div class="card hidden" id="transfer-step-3">
            <div class="empty-state" style="padding:20px">
              <i class="fa fa-check-circle text-green" style="font-size:4rem; opacity:1"></i>
              <h2 class="mt-16 text-green">Transfer Successful!</h2>
              <p class="mt-8 mb-20 text-muted">Transaction Reference: <strong id="ts-ref">--</strong></p>
              
              <div class="info-row"><span class="lbl">Amount Sent:</span><span class="val">₹<span id="ts-amt"></span></span></div>
              <div class="info-row"><span class="lbl">To Account:</span><span class="val" id="ts-to"></span></div>
              
              <button class="btn-primary w-full mt-24" onclick="App.navigate('dashboard')">Back to Dashboard</button>
              <button class="btn-outline w-full mt-12" onclick="App.navigate('transfer')">Make Another Transfer</button>
            </div>
          </div>
        </div>
      `;
    } catch(err) {
      main.innerHTML = `<div class="empty-state"><i class="fa fa-exclamation-circle text-red"></i><p>Error: ${err.message}</p></div>`;
    }
  },

  setTfMode: (mode, btn) => {
    document.querySelectorAll('#view-transfer .pill-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(mode === 'new'){
      document.getElementById('tf-new-sec').classList.remove('hidden');
      document.getElementById('tf-saved-sec').classList.add('hidden');
      document.getElementById('tf-save-ben-grp').classList.remove('hidden');
    } else {
      document.getElementById('tf-new-sec').classList.add('hidden');
      document.getElementById('tf-saved-sec').classList.remove('hidden');
      document.getElementById('tf-save-ben-grp').classList.add('hidden');
    }
  },

  verifyTransfer: async () => {
    const isNew = !document.getElementById('tf-new-sec').classList.contains('hidden');
    const toAcc = isNew ? document.getElementById('tf-to-acc').value : document.getElementById('tf-ben').value;
    const amt = parseFloat(document.getElementById('tf-amount').value);
    
    if(!toAcc || toAcc.length !== 10) return App.toast('Enter valid 10-digit account number', 'error');
    if(!amt || amt <= 0) return App.toast('Enter valid amount', 'error');

    const btn = document.querySelector('#transfer-step-1 .btn-primary');
    btn.innerHTML = `<i class="fa fa-spinner spin"></i> Verifying...`;
    btn.disabled = true;

    try {
      const verify = await Api.verifyAccount(toAcc);
      if(!verify.verified) throw new Error('Account verification failed');

      // Populate verify screen
      document.getElementById('tv-amt').textContent = amt.toLocaleString('en-IN', {minimumFractionDigits:2});
      document.getElementById('tv-acc').textContent = toAcc;
      document.getElementById('tv-name').textContent = verify.accountHolderName;
      document.getElementById('tv-mode').textContent = document.getElementById('tf-mode').value;
      document.getElementById('tv-desc').textContent = document.getElementById('tf-desc').value || '-';

      // Store data for submission
      Pages._tfData = {
        fromAccountId: document.getElementById('tf-from').value,
        toAccountNumber: toAcc,
        amount: amt,
        mode: document.getElementById('tf-mode').value,
        description: document.getElementById('tf-desc').value,
        saveBeneficiary: document.getElementById('tf-save-ben')?.checked || false,
        beneficiaryName: verify.accountHolderName
      };

      document.getElementById('transfer-step-1').classList.add('hidden');
      document.getElementById('transfer-step-2').classList.remove('hidden');
      document.getElementById('ts-1').classList.add('done');
      document.getElementById('ts-2').classList.add('active');

    } catch(err) {
      App.toast(err.message, 'error');
    } finally {
      btn.innerHTML = `Proceed to Verify`;
      btn.disabled = false;
    }
  },

  editTransfer: () => {
    document.getElementById('transfer-step-2').classList.add('hidden');
    document.getElementById('transfer-step-1').classList.remove('hidden');
    document.getElementById('ts-2').classList.remove('active');
    document.getElementById('ts-1').classList.remove('done');
  },

  confirmTransfer: async () => {
    const btn = document.querySelector('#transfer-step-2 .btn-primary');
    btn.innerHTML = `<i class="fa fa-spinner spin"></i> Processing...`;
    btn.disabled = true;

    try {
      const res = await Api.transfer(Pages._tfData);
      
      document.getElementById('ts-ref').textContent = res.transactionId;
      document.getElementById('ts-amt').textContent = Pages._tfData.amount.toLocaleString('en-IN', {minimumFractionDigits:2});
      document.getElementById('ts-to').textContent = Pages._tfData.toAccountNumber;

      document.getElementById('transfer-step-2').classList.add('hidden');
      document.getElementById('transfer-step-3').classList.remove('hidden');
      document.getElementById('ts-2').classList.add('done');
      document.getElementById('ts-3').classList.add('active').classList.add('done');

    } catch(err) {
      App.toast(err.message, 'error');
      btn.innerHTML = `Confirm & Send`;
      btn.disabled = false;
    }
  },

  // ── Transactions ──────────────────────────────────────────────────────────
  renderTransactions: async () => {
    const main = document.getElementById('view-transactions');
    main.innerHTML = `<div class="empty-state"><i class="fa fa-spinner spin"></i><p>Loading transactions...</p></div>`;
    try {
      const me = await Api.me();
      const accId = me.accounts[0].id;
      const res = await Api.getTransactions(100);
      const txns = res.transactions || [];

      let txnsHtml = txns.length === 0 
        ? `<tr><td colspan="5" class="text-center">No transactions found</td></tr>` 
        : txns.map(t => {
            const isCredit = t.toAccountId === accId;
            const sign = isCredit ? '+' : '-';
            const color = isCredit ? 'text-green' : 'text-red';
            return `
              <tr>
                <td>${new Date(t.createdAt).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</td>
                <td>${t.transactionId}</td>
                <td class="font-bold">${t.description || t.category}</td>
                <td><span class="status-badge active">${t.mode}</span></td>
                <td class="font-bold ${color} text-right">${sign}₹${t.amount.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
              </tr>
            `;
          }).join('');

      main.innerHTML = `
        <div class="flex justify-between items-center mb-20">
          <div class="section-title mb-0"><i class="fa fa-list-alt"></i> Transaction History</div>
          <button class="btn-outline" style="width:auto; padding:8px 16px; margin:0"><i class="fa fa-download"></i> Export PDF</button>
        </div>
        
        <div class="card" style="padding:0; overflow:hidden">
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference ID</th>
                  <th>Description</th>
                  <th>Mode</th>
                  <th class="text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${txnsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch(err) {
      main.innerHTML = `<div class="empty-state"><i class="fa fa-exclamation-circle text-red"></i><p>Error: ${err.message}</p></div>`;
    }
  },

  // ── Accounts ──────────────────────────────────────────────────────────────
  renderAccounts: async () => {
    const main = document.getElementById('view-accounts');
    main.innerHTML = `<div class="empty-state"><i class="fa fa-spinner spin"></i><p>Loading accounts...</p></div>`;
    try {
      const res = await Api.me();
      const accs = res.accounts || [];

      let accsHtml = accs.map(a => `
        <div class="card mb-20">
          <div class="flex justify-between items-center mb-16">
            <div class="form-section-title mb-0"><i class="fa fa-university"></i> ${a.accountType.toUpperCase()} ACCOUNT</div>
            <span class="status-badge active">Active</span>
          </div>
          
          <div class="balance-amount text-accent mb-16">₹${a.balance.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
          
          <div class="grid-3">
            <div class="info-row flex-col" style="display:flex; flex-direction:column; gap:4px; border:none">
              <span class="lbl">Account Number</span>
              <span class="val">${a.accountNumber}</span>
            </div>
            <div class="info-row flex-col" style="display:flex; flex-direction:column; gap:4px; border:none">
              <span class="lbl">IFSC Code</span>
              <span class="val">${a.ifscCode}</span>
            </div>
            <div class="info-row flex-col" style="display:flex; flex-direction:column; gap:4px; border:none">
              <span class="lbl">Branch</span>
              <span class="val">${a.branch}</span>
            </div>
          </div>
          
          <div class="mt-20 pt-16" style="border-top:1px solid var(--border)">
            <button class="btn-outline" style="width:auto; padding:8px 16px; margin:0"><i class="fa fa-file-pdf"></i> Download Statement</button>
          </div>
        </div>
      `).join('');

      main.innerHTML = `
        <div class="section-title"><i class="fa fa-university"></i> My Accounts</div>
        ${accsHtml}
      `;
    } catch(err) {
      main.innerHTML = `<div class="empty-state"><i class="fa fa-exclamation-circle text-red"></i><p>Error: ${err.message}</p></div>`;
    }
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  renderCards: async () => {
    const main = document.getElementById('view-cards');
    main.innerHTML = `<div class="empty-state"><i class="fa fa-spinner spin"></i><p>Loading cards...</p></div>`;
    try {
      const res = await Api.getCards();
      const cards = res.cards || [];

      let cardsHtml = cards.map(c => `
        <div class="grid-2 mb-24">
          <div class="flex items-center justify-center">
            <div class="debit-card ${c.cardNetwork.toLowerCase() === 'visa' ? 'visa' : 'mastercard'}">
              <div class="card-chip"></div>
              <div class="card-number">${c.cardNumber}</div>
              <div class="card-bottom">
                <div>
                  <div class="card-holder">${c.cardHolderName}</div>
                  <div class="card-expiry-label">VALID THRU</div>
                  <div class="card-expiry">${c.expiryDate}</div>
                </div>
                <div class="card-network">${c.cardNetwork}</div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="form-section-title"><i class="fa fa-sliders-h"></i> Card Controls</div>
            
            <div class="info-row">
              <span class="lbl">Card Status</span>
              <span class="status-badge ${c.status === 'active' ? 'active' : 'blocked'}">${c.status.toUpperCase()}</span>
            </div>
            <div class="info-row">
              <span class="lbl">Daily Limit</span>
              <span class="val">₹${c.dailyLimit.toLocaleString('en-IN')}</span>
            </div>
            
            <div class="mt-24 grid-2">
              <button class="btn-outline w-full" onclick="App.toast('Feature locked in demo', 'info')"><i class="fa fa-edit"></i> Edit Limits</button>
              <button class="btn-primary w-full" style="background:var(--red); box-shadow:none" onclick="App.toast('Feature locked in demo', 'info')"><i class="fa fa-ban"></i> Block Card</button>
            </div>
          </div>
        </div>
      `).join('');

      main.innerHTML = `
        <div class="section-title"><i class="fa fa-credit-card"></i> Manage Cards</div>
        ${cards.length ? cardsHtml : '<div class="empty-state"><p>No cards issued</p></div>'}
      `;
    } catch(err) {
      main.innerHTML = `<div class="empty-state"><i class="fa fa-exclamation-circle text-red"></i><p>Error: ${err.message}</p></div>`;
    }
  },

  // ── Investments & FD ──────────────────────────────────────────────────────
  renderInvestments: async () => {
    const main = document.getElementById('view-investments');
    main.innerHTML = `<div class="empty-state"><i class="fa fa-spinner spin"></i><p>Loading...</p></div>`;
    try {
      const fdsRes = await Api.getFDs();
      const me = await Api.me();
      const acc = me.accounts[0];
      const fds = fdsRes.fixedDeposits || [];

      let fdsHtml = fds.length === 0 
        ? `<tr><td colspan="6" class="text-center">No active Fixed Deposits</td></tr>` 
        : fds.map(f => `
            <tr>
              <td>${f.fdNumber}</td>
              <td class="font-bold">₹${f.principalAmount.toLocaleString('en-IN')}</td>
              <td>${f.interestRate}%</td>
              <td>${f.tenureMonths} mo</td>
              <td class="text-green font-bold">₹${f.maturityAmount.toLocaleString('en-IN')}</td>
              <td><span class="status-badge ${f.status === 'active' ? 'active' : ''}">${f.status.toUpperCase()}</span></td>
              <td class="text-right">
                ${f.status === 'active' ? `<button class="btn-outline" style="width:auto; padding:6px 12px; margin:0; font-size:0.75rem; border-color:var(--red); color:var(--red)" onclick="Pages.breakFD('${f.id}')">Break FD</button>` : ''}
              </td>
            </tr>
          `).join('');

      main.innerHTML = `
        <div class="section-title"><i class="fa fa-chart-line"></i> Investments & FDs</div>
        
        <div class="grid-2 mb-20">
          <div class="card">
            <div class="form-section-title"><i class="fa fa-plus-circle"></i> Open New FD</div>
            <div class="form-group">
              <label class="form-label">Amount (₹) - Available: ₹${acc.balance.toLocaleString('en-IN')}</label>
              <input type="number" id="fd-amt" class="input-full" placeholder="Min ₹10,000">
            </div>
            <div class="form-group">
              <label class="form-label">Tenure (Months)</label>
              <select id="fd-tenure" class="input-full">
                <option value="6">6 Months @ 5.5%</option>
                <option value="12" selected>1 Year @ 6.5%</option>
                <option value="24">2 Years @ 7.0%</option>
                <option value="60">5 Years @ 7.5%</option>
              </select>
            </div>
            <button class="btn-primary w-full mt-16" onclick="Pages.createFD('${acc.id}')">Open Fixed Deposit</button>
          </div>
          
          <div class="card">
            <div class="form-section-title"><i class="fa fa-info-circle"></i> FD Benefits</div>
            <ul style="padding-left:20px; line-height:2; color:var(--text-muted); font-size:0.9rem">
              <li>High interest rates up to 7.5% p.a.</li>
              <li>Flexible tenure from 7 days to 10 years</li>
              <li>Premature withdrawal facility available</li>
              <li>Overdraft facility up to 90% of FD amount</li>
              <li>Additional 0.5% interest for Senior Citizens</li>
            </ul>
          </div>
        </div>

        <div class="card" style="padding:0; overflow:hidden">
          <div class="form-section-title" style="padding:24px 24px 0 24px">My Fixed Deposits</div>
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>FD Number</th>
                  <th>Principal</th>
                  <th>Int. Rate</th>
                  <th>Tenure</th>
                  <th>Maturity Amt</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${fdsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch(err) {
      main.innerHTML = `<div class="empty-state"><i class="fa fa-exclamation-circle text-red"></i><p>Error: ${err.message}</p></div>`;
    }
  },

  createFD: async (accId) => {
    const amt = parseFloat(document.getElementById('fd-amt').value);
    const tenure = parseInt(document.getElementById('fd-tenure').value);
    let rate = 6.5;
    if(tenure === 6) rate = 5.5;
    if(tenure === 24) rate = 7.0;
    if(tenure === 60) rate = 7.5;

    if(!amt || amt < 1000) return App.toast('Minimum amount is ₹1000', 'error');

    try {
      await Api.createFD({ accountId: accId, amount: amt, tenureMonths: tenure, interestRate: rate });
      App.toast('Fixed Deposit created successfully!', 'success');
      App.navigate('investments');
    } catch(err) {
      App.toast(err.message, 'error');
    }
  },

  breakFD: async (id) => {
    if(!confirm('Are you sure you want to break this Fixed Deposit early? A penalty may apply and interest will be recalculated.')) return;
    try {
      const res = await Api.breakFD(id);
      App.toast(res.message, 'success');
      App.navigate('investments');
    } catch(err) {
      App.toast(err.message, 'error');
    }
  },

  // ── Loans ─────────────────────────────────────────────────────────────────
  renderLoans: async () => {
    const main = document.getElementById('view-loans');
    main.innerHTML = `<div class="empty-state"><i class="fa fa-spinner spin"></i><p>Loading...</p></div>`;
    try {
      const res = await Api.getLoans();
      const loans = res.loans || [];

      let loansHtml = loans.length === 0
        ? `<tr><td colspan="5" class="text-center">No active loans</td></tr>`
        : loans.map(l => `
            <tr>
              <td style="text-transform:capitalize">${l.loanType}</td>
              <td class="font-bold">₹${l.amount.toLocaleString('en-IN')}</td>
              <td>${l.interestRate}%</td>
              <td class="text-accent font-bold">₹${l.emi.toLocaleString('en-IN')}/mo</td>
              <td><span class="status-badge ${l.status === 'approved' ? 'active' : 'pending'}">${l.status.replace('_',' ').toUpperCase()}</span></td>
            </tr>
          `).join('');

      main.innerHTML = `
        <div class="section-title"><i class="fa fa-hand-holding-usd"></i> Loans</div>
        
        <div class="grid-2 mb-20">
          <div class="card">
            <div class="form-section-title"><i class="fa fa-paper-plane"></i> Apply for Loan</div>
            <div class="form-group">
              <label class="form-label">Loan Type</label>
              <select id="loan-type" class="input-full" onchange="Pages.updateLoanRate()">
                <option value="personal">Personal Loan (12.5%)</option>
                <option value="home">Home Loan (8.5%)</option>
                <option value="auto">Auto Loan (9.5%)</option>
              </select>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Amount (₹)</label>
                <input type="number" id="loan-amt" class="input-full" placeholder="0.00" oninput="Pages.calcEMI()">
              </div>
              <div class="form-group">
                <label class="form-label">Tenure (Months)</label>
                <input type="number" id="loan-tenure" class="input-full" value="36" oninput="Pages.calcEMI()">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Monthly Income (₹)</label>
              <input type="number" id="loan-income" class="input-full" placeholder="0.00">
            </div>
            
            <div class="calc-result" style="padding:16px; margin:0 0 16px 0; background:rgba(0,198,255,0.05)">
              <div class="result-label">Estimated EMI</div>
              <div class="result-value" style="font-size:1.5rem">₹<span id="loan-emi-val">0</span></div>
            </div>
            
            <button class="btn-primary w-full" onclick="Pages.applyLoan()">Submit Application</button>
          </div>

          <div class="card" style="padding:0; overflow:hidden">
            <div class="form-section-title" style="padding:24px 24px 0 24px">My Loan Applications</div>
            <div style="overflow-x:auto">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Rate</th>
                    <th>EMI</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${loansHtml}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch(err) {
      main.innerHTML = `<div class="empty-state"><i class="fa fa-exclamation-circle text-red"></i><p>Error: ${err.message}</p></div>`;
    }
  },

  updateLoanRate: () => Pages.calcEMI(),
  
  calcEMI: () => {
    const amt = parseFloat(document.getElementById('loan-amt')?.value) || 0;
    const tenure = parseInt(document.getElementById('loan-tenure')?.value) || 0;
    const type = document.getElementById('loan-type')?.value || 'personal';
    
    if(!amt || !tenure) {
      document.getElementById('loan-emi-val').textContent = '0';
      return;
    }
    
    const rates = { personal: 12.5, home: 8.5, auto: 9.5 };
    const rate = rates[type];
    const monthlyRate = rate / 100 / 12;
    const emi = (amt * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1);
    
    document.getElementById('loan-emi-val').textContent = emi.toLocaleString('en-IN', {maximumFractionDigits:0});
  },

  applyLoan: async () => {
    const d = {
      loanType: document.getElementById('loan-type').value,
      amount: parseFloat(document.getElementById('loan-amt').value),
      tenureMonths: parseInt(document.getElementById('loan-tenure').value),
      monthlyIncome: parseFloat(document.getElementById('loan-income').value),
      purpose: 'General'
    };
    if(!d.amount || !d.tenureMonths || !d.monthlyIncome) return App.toast('Fill all fields', 'error');

    try {
      await Api.applyLoan(d);
      App.toast('Loan application submitted successfully!', 'success');
      App.navigate('loans');
    } catch(err) {
      App.toast(err.message, 'error');
    }
  },

  // ── Beneficiaries ─────────────────────────────────────────────────────────
  renderBeneficiaries: async () => {
    const main = document.getElementById('view-beneficiaries');
    main.innerHTML = `<div class="empty-state"><i class="fa fa-spinner spin"></i><p>Loading...</p></div>`;
    try {
      const res = await Api.getBeneficiaries();
      const bens = res.beneficiaries || [];

      let bensHtml = bens.length === 0
        ? `<tr><td colspan="5" class="text-center">No saved beneficiaries</td></tr>`
        : bens.map(b => `
            <tr>
              <td class="font-bold">${b.nickname}</td>
              <td>${b.accountNumber}</td>
              <td>${b.ifscCode}</td>
              <td>${b.bankName}</td>
              <td class="text-right">
                <button class="btn-outline" style="width:auto; padding:6px 12px; margin:0; border-color:var(--red); color:var(--red)" onclick="Pages.deleteBen('${b.id}')"><i class="fa fa-trash"></i></button>
              </td>
            </tr>
          `).join('');

      main.innerHTML = `
        <div class="section-title"><i class="fa fa-users"></i> Beneficiaries</div>
        <div class="card" style="padding:0; overflow:hidden">
          <div class="flex justify-between items-center" style="padding:24px">
            <div class="form-section-title mb-0">Saved Payees</div>
            <button class="btn-primary" style="width:auto; padding:8px 16px; margin:0" onclick="App.toast('Feature locked in demo', 'info')"><i class="fa fa-plus"></i> Add New</button>
          </div>
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Account Number</th>
                  <th>IFSC</th>
                  <th>Bank</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${bensHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch(err) {
      main.innerHTML = `<div class="empty-state"><i class="fa fa-exclamation-circle text-red"></i><p>Error: ${err.message}</p></div>`;
    }
  },

  deleteBen: async (id) => {
    if(!confirm('Delete this beneficiary?')) return;
    try {
      await Api.deleteBeneficiary(id);
      App.toast('Beneficiary deleted', 'success');
      App.navigate('beneficiaries');
    } catch(err) {
      App.toast(err.message, 'error');
    }
  },

  // ── Profile, Calculators, Support ─────────────────────────────────────────
  renderProfile: async () => {
    const main = document.getElementById('view-profile');
    try {
      const { user } = await Api.getProfile();
      main.innerHTML = `
        <div class="section-title"><i class="fa fa-user-circle"></i> My Profile</div>
        <div class="card max-w-lg">
          <div class="form-group"><label class="form-label">Name</label><input type="text" class="input-full" value="${user.firstName} ${user.lastName}" readonly></div>
          <div class="form-group"><label class="form-label">Email</label><input type="text" class="input-full" value="${user.email}" readonly></div>
          <div class="form-group"><label class="form-label">Phone</label><input type="text" class="input-full" value="${user.phone}" readonly></div>
          <div class="form-group"><label class="form-label">PAN Number</label><input type="text" class="input-full" value="${user.panNumber || 'Not provided'}" readonly></div>
        </div>
      `;
    } catch(err) {}
  },

  renderCalculators: () => {
    const main = document.getElementById('view-calculators');
    main.innerHTML = `
      <div class="section-title"><i class="fa fa-calculator"></i> Calculators</div>
      <div class="empty-state"><i class="fa fa-tools"></i><p>Calculators are under construction.</p></div>
    `;
  },

  renderSupport: () => {
    const main = document.getElementById('view-support');
    main.innerHTML = `
      <div class="section-title"><i class="fa fa-headset"></i> Support & FAQ</div>
      <div class="empty-state"><i class="fa fa-envelope-open-text"></i><p>Contact us at support@nexbank.com or call 1800-NEX-BANK.</p></div>
    `;
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  renderAdmin: async () => {
    const main = document.getElementById('view-admin');
    main.innerHTML = `<div class="empty-state"><i class="fa fa-spinner spin"></i><p>Loading Admin Panel...</p></div>`;
    try {
      if(App.user.role !== 'admin') throw new Error('Access Denied');
      
      const statsRes = await Api.getAdminStats();
      const usersRes = await Api.getAdminUsers();
      
      let usersHtml = usersRes.users.length === 0 ? `<tr><td colspan="6" class="text-center">No users found</td></tr>` : usersRes.users.map(u => `
        <tr>
          <td class="font-bold">${u.name}</td>
          <td>${u.email}</td>
          <td>${u.accountNumber}</td>
          <td class="font-bold text-accent">₹${u.balance.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td><span class="status-badge ${u.status === 'active' ? 'active' : 'blocked'}">${u.status.toUpperCase()}</span></td>
          <td class="text-right">
            <button class="btn-outline" style="width:auto; padding:6px 12px; margin:0; font-size:0.75rem; border-color:${u.status==='active'?'var(--red)':'var(--green)'}; color:${u.status==='active'?'var(--red)':'var(--green)'}" onclick="Pages.blockUser('${u.id}')">
              ${u.status === 'active' ? 'Block User' : 'Unblock'}
            </button>
          </td>
        </tr>
      `).join('');

      main.innerHTML = `
        <div class="section-title"><i class="fa fa-shield-alt text-gold"></i> Admin Control Panel</div>
        
        <div class="grid-4 mb-24">
          <div class="stat-widget" style="padding:16px">
            <div class="stat-info">
              <div class="stat-lbl">Total Bank Balance</div>
              <div class="stat-val text-accent" style="font-size:1.1rem">₹${statsRes.totalBalance.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <div class="stat-widget" style="padding:16px">
            <div class="stat-info">
              <div class="stat-lbl">Total Users</div>
              <div class="stat-val" style="font-size:1.1rem">${statsRes.totalUsers}</div>
            </div>
          </div>
          <div class="stat-widget" style="padding:16px">
            <div class="stat-info">
              <div class="stat-lbl">Active Loans</div>
              <div class="stat-val" style="font-size:1.1rem">${statsRes.activeLoans}</div>
            </div>
          </div>
          <div class="stat-widget" style="padding:16px">
            <div class="stat-info">
              <div class="stat-lbl">Total Transactions</div>
              <div class="stat-val" style="font-size:1.1rem">${statsRes.totalTransactions}</div>
            </div>
          </div>
        </div>

        <div class="card" style="padding:0; overflow:hidden">
          <div class="form-section-title" style="padding:24px 24px 0 24px"><i class="fa fa-users"></i> Manage Users</div>
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Account No</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${usersHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch(err) {
      main.innerHTML = `<div class="empty-state"><i class="fa fa-exclamation-circle text-red"></i><p>Error: ${err.message}</p></div>`;
    }
  },

  blockUser: async (id) => {
    if(!confirm("Are you sure you want to change this user's status?")) return;
    try {
      const res = await Api.blockUser(id);
      App.toast(res.message, 'success');
      Pages.renderAdmin();
    } catch(err) {
      App.toast(err.message, 'error');
    }
  }
};

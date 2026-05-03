const Pages = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  renderDashboard: async () => {
    const main = document.getElementById('view-dashboard');
    main.innerHTML = `<div class="empty-state"><i class="fa fa-spinner spin"></i><p>Loading dashboard...</p></div>`;
    try {
      const res = await Api.me();
      const accounts = res.accounts;
      const acc = accounts[0];
      
      let summary = { monthlyIncome: 0, monthlyExpense: 0, categoryBreakdown: {}, monthlyData: [] };
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
            const color = isCredit ? 'text-green' : 'text-red';
            return `
              <div class="txn-item">
                <div class="txn-icon ${isCredit?'credit':'debit'}"><i class="fa fa-${icon}"></i></div>
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
            <div class="balance-amount"><span class="balance-currency">₹</span><span id="dash-bal">0.00</span></div>
            <div class="balance-acc">A/C: ${acc.accountNumber} • ${acc.accountType.toUpperCase()}</div>
            <div style="height: 60px; margin-top: 10px; margin-bottom: -10px;">
              <canvas id="miniChart"></canvas>
            </div>
            <div class="balance-actions mt-16">
              <button class="bal-btn" onclick="App.navigate('transfer')"><i class="fa fa-paper-plane"></i> Send</button>
              <button class="bal-btn" onclick="App.navigate('transactions')"><i class="fa fa-list"></i> Statement</button>
            </div>
          </div>
          
          <div class="card" style="padding: 24px;">
            <div class="form-section-title mb-16"><i class="fa fa-chart-pie"></i> Spending Insights</div>
            <div style="height: 180px; display: flex; justify-content: center; align-items: center;">
              ${Object.keys(summary.categoryBreakdown).length > 0 
                ? '<canvas id="donutChart"></canvas>' 
                : '<div class="text-muted text-sm text-center">No spending data this month</div>'}
            </div>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <div class="stat-widget" style="flex: 1">
              <div class="stat-icon green"><i class="fa fa-arrow-down"></i></div>
              <div class="stat-info">
                <div class="stat-lbl">Income This Month</div>
                <div class="stat-val">₹${summary.monthlyIncome.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
              </div>
            </div>
            
            <div class="stat-widget" style="flex: 1">
              <div class="stat-icon red"><i class="fa fa-arrow-up"></i></div>
              <div class="stat-info">
                <div class="stat-lbl">Spends This Month</div>
                <div class="stat-val">₹${summary.monthlyExpense.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="form-section-title"><i class="fa fa-bolt"></i> Quick Actions</div>
            <div class="quick-actions">
              <div class="quick-btn" onclick="App.navigate('transfer')">
                <i class="fa fa-paper-plane"></i><span>Send</span>
              </div>
              <div class="quick-btn" onclick="App.navigate('bills')">
                <i class="fa fa-file-invoice-dollar"></i><span>Pay Bills</span>
              </div>
              <div class="quick-btn" onclick="App.navigate('investments')">
                <i class="fa fa-chart-line"></i><span>Invest</span>
              </div>
              <div class="quick-btn" onclick="App.navigate('loans')">
                <i class="fa fa-hand-holding-usd"></i><span>Loans</span>
              </div>
            </div>
            
            <div class="form-section-title mt-24 mb-16"><i class="fa fa-link"></i> Linked Accounts</div>
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${accounts.map(a => `
                <div style="padding:12px 16px; border:1px solid var(--border); border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-weight:600; font-size:0.9rem;">${a.accountType.toUpperCase()} A/C</div>
                    <div style="font-size:0.8rem; color:var(--text-muted)">${a.accountNumber}</div>
                  </div>
                  <div style="font-family:var(--font2); font-weight:700; color:var(--accent);">₹${a.balance.toLocaleString('en-IN')}</div>
                </div>
              `).join('')}
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
      
      // Render charts if Chart is available
      if (typeof Chart !== 'undefined') {
        Chart.defaults.color = '#8ba3c2';
        Chart.defaults.font.family = "'Inter', sans-serif";
        
        // Mini Chart (Balance/History trend)
        const ctxMini = document.getElementById('miniChart');
        if (ctxMini && summary.monthlyData && summary.monthlyData.length > 0) {
          const labels = summary.monthlyData.map(d => d.month).reverse();
          const dataPoints = summary.monthlyData.map(d => d.credit).reverse();
          new Chart(ctxMini, {
            type: 'line',
            data: {
              labels: labels,
              datasets: [{
                data: dataPoints,
                borderColor: 'rgba(255, 255, 255, 0.8)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: false
              }]
            },
            options: {
              plugins: { legend: { display: false }, tooltip: { enabled: false } },
              scales: { x: { display: false }, y: { display: false } },
              maintainAspectRatio: false
            }
          });
        }

        // Donut Chart (Spending Breakdown)
        const ctxDonut = document.getElementById('donutChart');
        if (ctxDonut && Object.keys(summary.categoryBreakdown).length > 0) {
          new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
              labels: Object.keys(summary.categoryBreakdown),
              datasets: [{
                data: Object.values(summary.categoryBreakdown),
                backgroundColor: [
                  '#00d4ff', '#0055ff', '#00fa9a', '#ff4d4d', '#ffdf00', '#7c3aed'
                ],
                borderWidth: 0,
                hoverOffset: 10
              }]
            },
            options: {
              plugins: { legend: { display: false } },
              cutout: '75%',
              maintainAspectRatio: false
            }
          });
        }
      }

      // Animate Balance
      App.animateValue(document.getElementById('dash-bal'), 0, acc.balance, 1200);
      }
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
              <label class="checkbox-label mb-8">
                <input type="checkbox" id="tf-save-ben"> Save as beneficiary for future
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="tf-recurring"> Setup as recurring transfer (Monthly)
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
              <lottie-player src="https://assets10.lottiefiles.com/packages/lf20_afwjh8re.json" background="transparent" speed="1" style="width: 120px; height: 120px; margin: 0 auto;" autoplay></lottie-player>
              <h2 class="mt-16 text-green">Transfer Successful!</h2>
              <p class="mt-8 mb-20 text-muted">Transaction Reference: <strong id="ts-ref">--</strong></p>
              
              <div class="info-row"><span class="lbl">Amount Sent:</span><span class="val">₹<span id="ts-amt"></span></span></div>
              <div class="info-row"><span class="lbl">To Account:</span><span class="val" id="ts-to"></span></div>
              
              <button class="btn-outline w-full mt-24 mb-12" onclick="Pages.downloadReceipt()"><i class="fa fa-file-pdf"></i> Download Receipt</button>
              <button class="btn-primary w-full" onclick="App.navigate('dashboard')">Back to Dashboard</button>
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

  downloadReceipt: () => {
    App.toast('Generating PDF receipt...', 'info');
    setTimeout(() => {
      App.toast('Transaction_Receipt.pdf downloaded successfully.', 'success');
    }, 1500);
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
        <div class="flex justify-between items-center mb-16">
          <div class="section-title mb-0"><i class="fa fa-list-alt"></i> Transaction History</div>
          <button class="btn-outline" style="width:auto; padding:8px 16px; margin:0" onclick="Pages.downloadStatement()"><i class="fa fa-download"></i> Export PDF</button>
        </div>
        
        <div class="card mb-20" style="padding:16px;">
          <div class="grid-3" style="align-items:end;">
            <div class="form-group mb-0">
              <label class="form-label" style="font-size:0.8rem">From Date</label>
              <input type="date" class="input-full" id="txn-from" value="${new Date(new Date().setMonth(new Date().getMonth()-1)).toISOString().split('T')[0]}">
            </div>
            <div class="form-group mb-0">
              <label class="form-label" style="font-size:0.8rem">To Date</label>
              <input type="date" class="input-full" id="txn-to" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <button class="btn-primary" onclick="App.toast('Filtering applied', 'success')" style="height:44px;">Filter</button>
          </div>
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
          
          <div class="grid-4 mt-16 pt-16" style="border-top:1px solid var(--border)">
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
            <div class="info-row flex-col" style="display:flex; flex-direction:column; gap:4px; border:none">
              <span class="lbl">Nominee</span>
              <span class="val">${a.nomineeName || '<a href="#" class="text-accent text-sm" onclick="Pages.addNominee(\''+a._id+'\');return false;">+ Add Nominee</a>'}</span>
            </div>
          </div>
          
          <div class="mt-20 pt-16" style="border-top:1px solid var(--border)">
            <button class="btn-outline" style="width:auto; padding:8px 16px; margin:0" onclick="Pages.downloadStatement()"><i class="fa fa-file-pdf"></i> Download Statement</button>
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

  addNominee: (accId) => {
    App.showCustomModal(`
      <h2 class="modal-title"><i class="fa fa-user-shield text-accent"></i> Add Nominee</h2>
      <div class="form-group mt-16">
        <label class="form-label">Nominee Name</label>
        <input type="text" id="nominee-name" class="input-full" placeholder="Full Name">
      </div>
      <button class="btn-primary w-full mt-20" onclick="Pages.saveNominee('${accId}')">Save Nominee</button>
    `);
  },

  saveNominee: async (accId) => {
    const name = document.getElementById('nominee-name').value;
    if (!name) return App.toast('Please enter nominee name', 'error');
    try {
      await Api.put(`/accounts/${accId}/update`, { nomineeName: name });
      App.toast('Nominee added successfully', 'success');
      App.closeModal();
      Pages.renderAccounts();
    } catch (e) {
      App.toast(e.message, 'error');
    }
  },

  downloadStatement: () => {
    App.toast('Generating PDF statement...', 'info');
    setTimeout(() => {
      App.toast('Statement_2026.pdf downloaded successfully.', 'success');
    }, 1500);
  },

  // ── Bills ─────────────────────────────────────────────────────────────────
  renderBills: () => {
    const main = document.getElementById('view-bills');
    main.innerHTML = `
      <div class="section-title"><i class="fa fa-receipt"></i> Bill Payments</div>
      
      <div class="grid-2 mb-20">
        <div class="card">
          <div class="form-section-title"><i class="fa fa-bolt"></i> Quick Pay</div>
          <div class="grid-3" style="gap:16px;">
            <div class="stat-widget" style="padding:16px; text-align:center; cursor:pointer;" onclick="Pages.showBillModal('Electricity')">
              <i class="fa fa-lightbulb text-accent" style="font-size:1.5rem; margin-bottom:8px;"></i>
              <div style="font-size:0.8rem; font-weight:600;">Electricity</div>
            </div>
            <div class="stat-widget" style="padding:16px; text-align:center; cursor:pointer;" onclick="Pages.showBillModal('Mobile Postpaid')">
              <i class="fa fa-mobile-alt text-accent" style="font-size:1.5rem; margin-bottom:8px;"></i>
              <div style="font-size:0.8rem; font-weight:600;">Mobile</div>
            </div>
            <div class="stat-widget" style="padding:16px; text-align:center; cursor:pointer;" onclick="Pages.showBillModal('DTH / TV')">
              <i class="fa fa-tv text-accent" style="font-size:1.5rem; margin-bottom:8px;"></i>
              <div style="font-size:0.8rem; font-weight:600;">DTH / TV</div>
            </div>
            <div class="stat-widget" style="padding:16px; text-align:center; cursor:pointer;" onclick="Pages.showBillModal('Water Bill')">
              <i class="fa fa-tint text-accent" style="font-size:1.5rem; margin-bottom:8px;"></i>
              <div style="font-size:0.8rem; font-weight:600;">Water</div>
            </div>
            <div class="stat-widget" style="padding:16px; text-align:center; cursor:pointer;" onclick="Pages.showBillModal('Broadband')">
              <i class="fa fa-wifi text-accent" style="font-size:1.5rem; margin-bottom:8px;"></i>
              <div style="font-size:0.8rem; font-weight:600;">Broadband</div>
            </div>
            <div class="stat-widget" style="padding:16px; text-align:center; cursor:pointer;" onclick="Pages.showBillModal('Credit Card')">
              <i class="fa fa-credit-card text-accent" style="font-size:1.5rem; margin-bottom:8px;"></i>
              <div style="font-size:0.8rem; font-weight:600;">Credit Card</div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="form-section-title"><i class="fa fa-clock"></i> Upcoming & Saved Bills</div>
          <div class="empty-state" style="padding:20px; text-align:center;">
            <i class="fa fa-calendar-check text-muted" style="font-size:2rem; margin-bottom:10px;"></i>
            <p style="font-size:0.9rem; color:var(--text-muted);">No pending bills for this month.</p>
          </div>
        </div>
      </div>
    `;
  },

  showBillModal: (type) => {
    App.showCustomModal(`
      <h2 class="modal-title"><i class="fa fa-file-invoice-dollar text-accent"></i> Pay ${type}</h2>
      <div class="form-group mt-16">
        <label class="form-label">Consumer Number / ID</label>
        <input type="text" id="bill-id" class="input-full" placeholder="Enter ID">
      </div>
      <div class="form-group">
        <label class="form-label">Amount (₹)</label>
        <input type="number" id="bill-amt" class="input-full" placeholder="0.00">
      </div>
      <button class="btn-primary w-full mt-20" onclick="Pages.payBill('${type}')">Pay Now</button>
    `);
  },

  payBill: async (type) => {
    const billId = document.getElementById('bill-id').value;
    const amt = parseFloat(document.getElementById('bill-amt').value);
    
    if (!billId || !amt) return App.toast('Please enter valid details', 'error');
    
    try {
      const data = {
        fromAccountId: App.accounts[0]._id,
        toAccountNumber: 'BILLER_' + type.replace(' ', '').toUpperCase(),
        amount: amt,
        mode: 'IMPS',
        description: `Bill Payment - ${type} (${billId})`,
        saveBeneficiary: false
      };
      
      const btn = document.querySelector('#modal-content .btn-primary');
      btn.innerHTML = `<i class="fa fa-spinner spin"></i> Processing...`;
      btn.disabled = true;
      
      await Api.transfer(data);
      App.toast(`${type} bill of ₹${amt} paid successfully!`, 'success');
      App.closeModal();
      Pages.renderDashboard(); // Refresh balance
      App.navigate('dashboard');
    } catch (e) {
      App.toast(e.message, 'error');
      const btn = document.querySelector('#modal-content .btn-primary');
      btn.innerHTML = `Pay Now`;
      btn.disabled = false;
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
            <div class="flip-card" onclick="this.classList.toggle('flipped')">
              <div class="flip-card-inner">
                <div class="flip-card-front ${c.cardNetwork.toLowerCase() === 'visa' ? 'visa' : 'mastercard'}">
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
                <div class="flip-card-back ${c.cardNetwork.toLowerCase() === 'visa' ? 'visa' : 'mastercard'}">
                  <div class="card-mag-strip"></div>
                  <div class="card-cvv-strip">CVV &nbsp;&nbsp; <span>***</span></div>
                  <div style="padding: 16px; font-size: 0.6rem; opacity: 0.7;">
                    This card is the property of NexBank. If found, please return to any NexBank branch.
                    <br><br>
                    Customer Service: 1800-NEX-BANK
                  </div>
                </div>
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
              <button class="btn-outline w-full" onclick="Pages.showEditLimitModal('${c._id}', ${c.dailyLimit})"><i class="fa fa-edit"></i> Edit Limits</button>
              <button class="btn-primary w-full" style="background:${c.status === 'active' ? 'var(--red)' : 'var(--green)'}; box-shadow:none" onclick="Pages.toggleCardStatus('${c._id}', '${c.status}')">
                <i class="fa ${c.status === 'active' ? 'fa-ban' : 'fa-check'}"></i> ${c.status === 'active' ? 'Block Card' : 'Unblock Card'}
              </button>
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

  showEditLimitModal: (id, currentLimit) => {
    App.showCustomModal(`
      <h2 class="modal-title"><i class="fa fa-sliders-h text-accent"></i> Edit Card Limit</h2>
      <div class="form-group mt-16">
        <label class="form-label">New Daily Limit (₹)</label>
        <input type="number" id="new-card-limit" class="input-full" value="${currentLimit}">
      </div>
      <button class="btn-primary w-full mt-20" onclick="Pages.updateCardLimit('${id}')">Save Changes</button>
    `);
  },

  updateCardLimit: async (id) => {
    const limit = parseInt(document.getElementById('new-card-limit').value);
    if (!limit || limit < 1000) return App.toast('Limit must be at least ₹1000', 'error');
    try {
      await Api.updateCard(id, { dailyLimit: limit });
      App.toast('Card limit updated successfully', 'success');
      App.closeModal();
      Pages.renderCards();
    } catch (e) {
      App.toast(e.message, 'error');
    }
  },

  toggleCardStatus: async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    if (!confirm(`Are you sure you want to ${newStatus === 'blocked' ? 'block' : 'unblock'} this card?`)) return;
    try {
      await Api.updateCard(id, { status: newStatus });
      App.toast(`Card ${newStatus} successfully`, 'success');
      Pages.renderCards();
    } catch (e) {
      App.toast(e.message, 'error');
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
            <div class="form-group">
              <label class="form-label">Interest Payout</label>
              <select class="input-full">
                <option>At Maturity (Cumulative)</option>
                <option>Monthly Payout</option>
                <option>Quarterly Payout</option>
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
                ${fdsHtml.replace(/Break FD<\/button>/g, `Break FD</button><button class="btn-outline" style="width:auto; padding:4px 8px; margin:0 0 0 8px; font-size:0.7rem;" onclick="App.toast('Downloading FD Certificate PDF...', 'success')"><i class="fa fa-download"></i></button>`)}
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
              <button class="btn-outline mt-12 w-full" style="padding:6px; font-size:0.8rem;" onclick="App.toast('Amortization Schedule Downloaded', 'info')"><i class="fa fa-table"></i> View Amortization Table</button>
            </div>
            
            <button class="btn-primary w-full" onclick="Pages.applyLoan()">Submit Application</button>
          </div>

          <div>
            <div class="card mb-20" style="padding:0; overflow:hidden">
              <div class="form-section-title" style="padding:24px 24px 0 24px"><i class="fa fa-chart-line"></i> Track Loan Status</div>
              <div style="padding:24px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.85rem">
                  <span class="text-green font-bold"><i class="fa fa-check-circle"></i> Application Received</span>
                  <span class="text-green font-bold"><i class="fa fa-check-circle"></i> Verification</span>
                  <span class="text-muted"><i class="fa fa-circle"></i> Approval</span>
                  <span class="text-muted"><i class="fa fa-circle"></i> Disbursal</span>
                </div>
                <div style="height:4px; background:var(--border); border-radius:2px; position:relative;">
                  <div style="position:absolute; left:0; top:0; bottom:0; width:50%; background:var(--green); border-radius:2px;"></div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="form-section-title"><i class="fa fa-fast-forward"></i> Pre-payment Calculator</div>
              <div class="form-group mb-12">
                <label class="form-label">Extra Payment Amount (₹)</label>
                <input type="number" class="input-full" placeholder="e.g. 50000" id="prepay-amt">
              </div>
              <button class="btn-outline w-full" onclick="App.toast('You can save ₹12,450 in interest and reduce tenure by 4 months!', 'success')">Calculate Savings</button>
            </div>
          </div>
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
            <button class="btn-primary" style="width:auto; padding:8px 16px; margin:0" onclick="Pages.showAddBenModal()"><i class="fa fa-plus"></i> Add New</button>
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

  showAddBenModal: () => {
    App.showCustomModal(`
      <h2 class="modal-title"><i class="fa fa-user-plus text-accent"></i> Add Beneficiary</h2>
      <div class="form-group">
        <label class="form-label">Nickname</label>
        <input type="text" id="ben-nick" class="input-full" placeholder="e.g. John Doe">
      </div>
      <div class="form-group">
        <label class="form-label">Account Number</label>
        <input type="text" id="ben-acc" class="input-full" placeholder="10-digit number" maxlength="10">
      </div>
      <div class="form-group">
        <label class="form-label">IFSC Code</label>
        <input type="text" id="ben-ifsc" class="input-full" placeholder="e.g. NEXB0000001">
      </div>
      <button class="btn-primary w-full mt-20" onclick="Pages.submitAddBen()">Save Beneficiary</button>
    `);
  },

  submitAddBen: async () => {
    const data = {
      nickname: document.getElementById('ben-nick').value,
      accountNumber: document.getElementById('ben-acc').value,
      ifscCode: document.getElementById('ben-ifsc').value,
      bankName: 'NexBank'
    };
    if (!data.nickname || !data.accountNumber || !data.ifscCode) return App.toast('Please fill all fields', 'error');
    try {
      await Api.addBeneficiary(data);
      App.toast('Beneficiary added successfully', 'success');
      App.closeModal();
      Pages.renderBeneficiaries();
    } catch (e) {
      App.toast(e.message, 'error');
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
          <div class="form-group"><label class="form-label">First Name</label><input type="text" id="prof-fname" class="input-full" value="${user.firstName}"></div>
          <div class="form-group"><label class="form-label">Last Name</label><input type="text" id="prof-lname" class="input-full" value="${user.lastName}"></div>
          <div class="form-group"><label class="form-label">Email</label><input type="text" class="input-full" value="${user.email}" readonly style="opacity:0.7"></div>
          <div class="form-group"><label class="form-label">Phone</label><input type="text" id="prof-phone" class="input-full" value="${user.phone}"></div>
          <div class="form-group"><label class="form-label">Address</label><input type="text" id="prof-addr" class="input-full" value="${user.address || ''}"></div>
          <div class="form-group"><label class="form-label">PAN Number</label><input type="text" class="input-full" value="${user.panNumber || 'Not provided'}" readonly style="opacity:0.7"></div>
          <button class="btn-primary mt-20 w-full mb-12" onclick="Pages.updateProfile()">Update Profile</button>
          
          <div class="form-section-title mt-20 pt-16" style="border-top:1px solid var(--border)"><i class="fa fa-key"></i> Security & KYC</div>
          <button class="btn-outline w-full mb-12" onclick="App.toast('A password reset link was sent to your email.', 'info')">Change Password</button>
          <div class="info-row" style="border:1px solid var(--border); border-radius:8px; padding:12px;">
            <div style="font-weight:600; font-size:0.9rem;">KYC Status</div>
            <span class="status-badge ${user.kycStatus === 'approved' ? 'active' : 'pending'}">${(user.kycStatus || 'Pending').toUpperCase()}</span>
          </div>
        </div>

        <div class="card max-w-lg mt-24">
          <div class="form-section-title"><i class="fa fa-laptop-house"></i> Device & Session Management</div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">
            Manage the devices currently logged into your NexBank account.
          </p>
          <div class="info-row" style="border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <i class="fa fa-desktop text-accent" style="font-size:1.5rem"></i>
              <div>
                <div style="font-weight:600; font-size:0.9rem;">Windows PC - Chrome</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">Current Session • IP: 192.168.1.5</div>
              </div>
            </div>
            <span class="status-badge active">Active</span>
          </div>
          <div class="info-row" style="border:1px solid var(--border); border-radius:8px; padding:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <i class="fa fa-mobile-alt text-muted" style="font-size:1.5rem"></i>
              <div>
                <div style="font-weight:600; font-size:0.9rem; color:var(--text-muted)">iPhone 13 - Safari</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">Last active: 2 hours ago</div>
              </div>
            </div>
            <button class="btn-outline" style="width:auto; padding:4px 10px; margin:0; font-size:0.7rem;" onclick="App.toast('Device logged out successfully', 'success')">Logout</button>
          </div>
          <button class="btn-outline w-full mt-16" style="border-color:var(--red); color:var(--red)" onclick="App.toast('All other sessions terminated', 'success')">Log out of all other devices</button>
        </div>
      `;
    } catch(err) {}
  },

  updateProfile: async () => {
    const data = {
      firstName: document.getElementById('prof-fname').value,
      lastName: document.getElementById('prof-lname').value,
      phone: document.getElementById('prof-phone').value,
      address: document.getElementById('prof-addr').value
    };
    try {
      const res = await Api.updateProfile(data);
      App.toast(res.message, 'success');
      App.user = res.user;
      const initials = (res.user.firstName[0] + res.user.lastName[0]).toUpperCase();
      document.getElementById('sidebar-name').textContent = res.user.firstName + ' ' + res.user.lastName;
      document.getElementById('sidebar-avatar').textContent = initials;
      document.getElementById('topbar-avatar').textContent = initials;
    } catch (e) {
      App.toast(e.message, 'error');
    }
  },

  renderCalculators: () => {
    const main = document.getElementById('view-calculators');
    main.innerHTML = `
      <div class="section-title"><i class="fa fa-calculator"></i> Financial Calculators</div>
      
      <div class="grid-2">
        <!-- EMI Calculator -->
        <div class="card">
          <div class="form-section-title"><i class="fa fa-car"></i> EMI Calculator</div>
          <div class="form-group">
            <label class="form-label">Loan Amount (₹)</label>
            <input type="number" id="calc-emi-amt" class="input-full" value="500000" oninput="Pages.runCalc('emi')">
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Interest Rate (%)</label>
              <input type="number" id="calc-emi-rate" class="input-full" value="9.5" step="0.1" oninput="Pages.runCalc('emi')">
            </div>
            <div class="form-group">
              <label class="form-label">Tenure (Years)</label>
              <input type="number" id="calc-emi-years" class="input-full" value="5" oninput="Pages.runCalc('emi')">
            </div>
          </div>
          <div class="calc-result" style="padding:16px; margin:0; background:rgba(0,198,255,0.05); border-radius:8px;">
            <div class="result-label">Monthly EMI</div>
            <div class="result-value text-accent" style="font-size:1.5rem; font-weight:700;">₹<span id="calc-emi-res">10,501</span></div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Total Interest: ₹<span id="calc-emi-int">130,058</span></div>
          </div>
        </div>

        <!-- FD Calculator -->
        <div class="card">
          <div class="form-section-title"><i class="fa fa-chart-line"></i> FD Maturity Calculator</div>
          <div class="form-group">
            <label class="form-label">Deposit Amount (₹)</label>
            <input type="number" id="calc-fd-amt" class="input-full" value="100000" oninput="Pages.runCalc('fd')">
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Interest Rate (%)</label>
              <input type="number" id="calc-fd-rate" class="input-full" value="7.1" step="0.1" oninput="Pages.runCalc('fd')">
            </div>
            <div class="form-group">
              <label class="form-label">Tenure (Years)</label>
              <input type="number" id="calc-fd-years" class="input-full" value="3" oninput="Pages.runCalc('fd')">
            </div>
          </div>
          <div class="calc-result" style="padding:16px; margin:0; background:rgba(0,230,118,0.05); border-radius:8px;">
            <div class="result-label">Maturity Amount</div>
            <div class="result-value text-green" style="font-size:1.5rem; font-weight:700;">₹<span id="calc-fd-res">123,507</span></div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Interest Earned: ₹<span id="calc-fd-int">23,507</span></div>
          </div>
        </div>
      </div>

      <div class="grid-2 mt-20">
        <!-- SIP Calculator -->
        <div class="card">
          <div class="form-section-title"><i class="fa fa-chart-pie"></i> SIP Calculator</div>
          <div class="form-group">
            <label class="form-label">Monthly Investment (₹)</label>
            <input type="number" id="calc-sip-amt" class="input-full" value="5000" oninput="Pages.runCalc('sip')">
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Expected Return (%)</label>
              <input type="number" id="calc-sip-rate" class="input-full" value="12" step="0.1" oninput="Pages.runCalc('sip')">
            </div>
            <div class="form-group">
              <label class="form-label">Time Period (Years)</label>
              <input type="number" id="calc-sip-years" class="input-full" value="10" oninput="Pages.runCalc('sip')">
            </div>
          </div>
          <div class="calc-result" style="padding:16px; margin:0; background:rgba(255,215,0,0.05); border-radius:8px;">
            <div class="result-label">Total Value</div>
            <div class="result-value text-gold" style="font-size:1.5rem; font-weight:700;">₹<span id="calc-sip-res">11,61,695</span></div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Amount Invested: ₹<span id="calc-sip-inv">6,00,000</span></div>
          </div>
        </div>

        <!-- Tax Calculator -->
        <div class="card">
          <div class="form-section-title"><i class="fa fa-file-invoice-dollar"></i> Income Tax Calculator</div>
          <div class="form-group">
            <label class="form-label">Annual Income (₹)</label>
            <input type="number" id="calc-tax-inc" class="input-full" value="1200000" oninput="Pages.runCalc('tax')">
          </div>
          <div class="form-group">
            <label class="form-label">Deductions (80C, etc) (₹)</label>
            <input type="number" id="calc-tax-ded" class="input-full" value="150000" oninput="Pages.runCalc('tax')">
          </div>
          <div class="calc-result" style="padding:16px; margin:0; background:rgba(255,82,82,0.05); border-radius:8px;">
            <div class="result-label">Estimated Tax (Old Regime)</div>
            <div class="result-value text-red" style="font-size:1.5rem; font-weight:700;">₹<span id="calc-tax-res">1,32,600</span></div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">New Regime Tax: ₹<span id="calc-tax-new">93,600</span></div>
          </div>
        </div>
      </div>
      
      <div class="grid-2 mt-20">
        <!-- Inflation Calculator -->
        <div class="card">
          <div class="form-section-title"><i class="fa fa-level-up-alt"></i> Inflation / Future Value</div>
          <div class="form-group">
            <label class="form-label">Current Cost (₹)</label>
            <input type="number" id="calc-inf-amt" class="input-full" value="100000" oninput="Pages.runCalc('inf')">
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Inflation Rate (%)</label>
              <input type="number" id="calc-inf-rate" class="input-full" value="6" step="0.1" oninput="Pages.runCalc('inf')">
            </div>
            <div class="form-group">
              <label class="form-label">Years from now</label>
              <input type="number" id="calc-inf-years" class="input-full" value="10" oninput="Pages.runCalc('inf')">
            </div>
          </div>
          <div class="calc-result" style="padding:16px; margin:0; background:rgba(0,198,255,0.05); border-radius:8px;">
            <div class="result-label">Future Cost</div>
            <div class="result-value text-accent" style="font-size:1.5rem; font-weight:700;">₹<span id="calc-inf-res">1,79,085</span></div>
          </div>
        </div>
      </div>
    `;
    Pages.runCalc('emi');
    Pages.runCalc('fd');
    Pages.runCalc('sip');
    Pages.runCalc('tax');
    Pages.runCalc('inf');
  },

  runCalc: (type) => {
    if (type === 'emi') {
      const p = parseFloat(document.getElementById('calc-emi-amt').value) || 0;
      const r = parseFloat(document.getElementById('calc-emi-rate').value) || 0;
      const n = (parseFloat(document.getElementById('calc-emi-years').value) || 0) * 12;
      if(p>0 && r>0 && n>0) {
        const monthlyRate = r / 100 / 12;
        const emi = (p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
        const totalPaid = emi * n;
        document.getElementById('calc-emi-res').textContent = emi.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('calc-emi-int').textContent = (totalPaid - p).toLocaleString('en-IN', {maximumFractionDigits:0});
      }
    } else if (type === 'fd') {
      const p = parseFloat(document.getElementById('calc-fd-amt').value) || 0;
      const r = parseFloat(document.getElementById('calc-fd-rate').value) || 0;
      const t = parseFloat(document.getElementById('calc-fd-years').value) || 0;
      if(p>0 && r>0 && t>0) {
        // Compound quarterly
        const maturity = p * Math.pow(1 + (r / 100) / 4, 4 * t);
        document.getElementById('calc-fd-res').textContent = maturity.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('calc-fd-int').textContent = (maturity - p).toLocaleString('en-IN', {maximumFractionDigits:0});
      }
    } else if (type === 'sip') {
      const p = parseFloat(document.getElementById('calc-sip-amt').value) || 0;
      const r = parseFloat(document.getElementById('calc-sip-rate').value) || 0;
      const t = parseFloat(document.getElementById('calc-sip-years').value) || 0;
      if(p>0 && r>0 && t>0) {
        const i = r / 100 / 12;
        const n = t * 12;
        const maturity = p * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        document.getElementById('calc-sip-res').textContent = maturity.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('calc-sip-inv').textContent = (p * n).toLocaleString('en-IN', {maximumFractionDigits:0});
      }
    } else if (type === 'tax') {
      const inc = parseFloat(document.getElementById('calc-tax-inc').value) || 0;
      const ded = parseFloat(document.getElementById('calc-tax-ded').value) || 0;
      
      // Simple mockup calculation
      let oldTax = 0;
      let taxableOld = Math.max(0, inc - ded - 50000); // 50k standard ded
      if (taxableOld > 1000000) oldTax = 112500 + (taxableOld - 1000000) * 0.3;
      else if (taxableOld > 500000) oldTax = 12500 + (taxableOld - 500000) * 0.2;
      else if (taxableOld > 250000) oldTax = (taxableOld - 250000) * 0.05;
      
      let newTax = 0;
      let taxableNew = Math.max(0, inc - 50000); // 50k standard ded
      if (taxableNew > 1500000) newTax = 150000 + (taxableNew - 1500000) * 0.3;
      else if (taxableNew > 1200000) newTax = 90000 + (taxableNew - 1200000) * 0.2;
      else if (taxableNew > 900000) newTax = 45000 + (taxableNew - 900000) * 0.15;
      else if (taxableNew > 600000) newTax = 15000 + (taxableNew - 600000) * 0.1;
      else if (taxableNew > 300000) newTax = (taxableNew - 300000) * 0.05;
      
      // Rebate 87A (Simplified)
      if(taxableOld <= 500000) oldTax = 0;
      if(taxableNew <= 700000) newTax = 0;
      
      // Cess
      oldTax = oldTax * 1.04;
      newTax = newTax * 1.04;

      document.getElementById('calc-tax-res').textContent = oldTax.toLocaleString('en-IN', {maximumFractionDigits:0});
      document.getElementById('calc-tax-new').textContent = newTax.toLocaleString('en-IN', {maximumFractionDigits:0});
    } else if (type === 'inf') {
      const p = parseFloat(document.getElementById('calc-inf-amt').value) || 0;
      const r = parseFloat(document.getElementById('calc-inf-rate').value) || 0;
      const t = parseFloat(document.getElementById('calc-inf-years').value) || 0;
      if(p>0 && r>0 && t>0) {
        const fv = p * Math.pow(1 + r/100, t);
        document.getElementById('calc-inf-res').textContent = fv.toLocaleString('en-IN', {maximumFractionDigits:0});
      }
    }
  },

  renderSupport: () => {
    const main = document.getElementById('view-support');
    main.innerHTML = `
      <div class="section-title"><i class="fa fa-headset"></i> Support & Services</div>
      <div class="grid-2">
        <div class="card">
          <div class="form-section-title"><i class="fa fa-question-circle"></i> FAQ</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">
            <p class="mb-12"><strong>How to reset my password?</strong><br>Click 'Forgot Password' on the login screen.</p>
            <p class="mb-12"><strong>What are NEFT timings?</strong><br>NEFT is available 24x7.</p>
            <p class="mb-12"><strong>How to block my card?</strong><br>Go to 'Manage Cards' and click 'Block Card'.</p>
          </div>
        </div>
        <div class="card">
          <div class="form-section-title"><i class="fa fa-ticket-alt"></i> Raise a Ticket</div>
          <div class="form-group">
            <select class="input-full"><option>Transaction Failed</option><option>Card Issue</option><option>Other</option></select>
          </div>
          <textarea class="input-full mb-12" rows="3" placeholder="Describe your issue..."></textarea>
          <button class="btn-primary w-full" onclick="App.toast('Ticket #TK' + Math.floor(Math.random()*1000) + ' created', 'success')">Submit Ticket</button>
        </div>
      </div>
      <div class="grid-2 mt-20">
        <div class="card">
          <div class="form-section-title"><i class="fa fa-map-marker-alt"></i> ATM & Branch Locator</div>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">Find nearest NexBank services.</p>
          <div class="form-group mb-12"><input type="text" class="input-full" placeholder="Enter Pincode or City"></div>
          <button class="btn-outline w-full" onclick="App.toast('Found 3 branches nearby', 'info')">Search Location</button>
        </div>
        <div class="card" style="background:var(--accent); color:#fff;">
          <div class="form-section-title text-white"><i class="fa fa-comments"></i> Live Chat Support</div>
          <p style="font-size:0.85rem; margin-bottom:16px;">Chat with our AI Assistant Nexa for instant help.</p>
          <button class="btn-primary w-full" style="background:#fff; color:var(--accent)" onclick="App.toast('Connecting to Live Agent...', 'info')"><i class="fa fa-comment-dots"></i> Start Chat</button>
        </div>
      </div>
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
            <button class="btn-primary" style="width:auto; padding:6px 12px; margin:0; font-size:0.75rem; background:var(--gold); border:none; margin-left:8px;" onclick="Pages.approveKYC('${u.id}')">
              Approve KYC
            </button>
          </td>
        </tr>
      `).join('');

      main.innerHTML = `
        <div class="section-title"><i class="fa fa-shield-alt text-gold"></i> Admin Control Panel</div>
        
        <div class="grid-4 mb-20">
          <div class="stat-widget" style="padding:16px; background:linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,85,255,0.1))">
            <div class="stat-info">
              <div class="stat-lbl">System Health</div>
              <div class="stat-val text-green" style="font-size:1.1rem"><i class="fa fa-check-circle"></i> 100% Online</div>
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
              <div class="stat-lbl">Txns Today</div>
              <div class="stat-val text-accent" style="font-size:1.1rem">${statsRes.totalTransactions}</div>
            </div>
          </div>
        </div>

        <div class="card" style="padding:0; overflow:hidden">
          <div class="form-section-title" style="padding:24px 24px 0 24px"><i class="fa fa-users"></i> All Users Overview</div>
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
  },

  approveKYC: async (id) => {
    if(!confirm("Are you sure you want to approve KYC for this user?")) return;
    try {
      App.toast("KYC Approved successfully", "success");
      // Simulate API call
      setTimeout(() => Pages.renderAdmin(), 500);
    } catch(err) {
      App.toast(err.message, "error");
    }
  },

  renderNotifications: () => {
    const main = document.getElementById('view-notifications');
    main.innerHTML = `
      <div class="flex justify-between items-center mb-20">
        <div class="section-title mb-0"><i class="fa fa-bell"></i> Notifications</div>
        <button class="btn-outline" style="width:auto; padding:6px 12px; margin:0;" onclick="Pages.markAllRead()"><i class="fa fa-check-double"></i> Mark All Read</button>
      </div>
      
      <div class="card mb-12" id="notif-1" style="border-left: 4px solid var(--accent)">
        <div class="flex justify-between items-center">
          <div style="font-weight:600; color:var(--text-main)"><i class="fa fa-arrow-down text-green"></i> ₹5,000 credited to A/C XX6423</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">Just now</div>
        </div>
        <div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">IMPS transfer received from Rahul Kumar.</div>
      </div>

      <div class="card mb-12" id="notif-2" style="border-left: 4px solid var(--accent)">
        <div class="flex justify-between items-center">
          <div style="font-weight:600; color:var(--text-main)"><i class="fa fa-arrow-up text-red"></i> ₹1,200 debited from A/C XX6423</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">2 hours ago</div>
        </div>
        <div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">Amazon Pay India Private Limited.</div>
      </div>

      <div class="card mb-12">
        <div class="flex justify-between items-center">
          <div style="font-weight:600; color:var(--text-main)"><i class="fa fa-shield-alt text-gold"></i> KYC Reminder</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">1 day ago</div>
        </div>
        <div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">Please update your PAN card details to enjoy uninterrupted services.</div>
      </div>

      <div class="card mb-12">
        <div class="flex justify-between items-center">
          <div style="font-weight:600; color:var(--text-main)"><i class="fa fa-gift text-accent"></i> Pre-approved Personal Loan</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">3 days ago</div>
        </div>
        <div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">You are eligible for an instant personal loan of up to ₹2,50,000. Apply now!</div>
      </div>
    `;
    
    // Reset badge
    const badge = document.getElementById('notif-badge');
    if(badge) badge.classList.add('hidden');
  },

  markAllRead: () => {
    const notifs = document.querySelectorAll('#view-notifications .card');
    notifs.forEach(n => n.style.borderLeft = 'none');
    App.toast('All notifications marked as read', 'success');
  }
};

window.AdminView = {
  async dashboard() {
    const [a, users, withdrawals, claims, consults] = await Promise.all([
      API.get('/admin/analytics?range=30d'),
      API.get('/admin/users?limit=10'),
      API.get('/admin/withdrawals?status=PENDING'),
      API.get('/admin/claims?status=FILED'),
      API.get('/admin/consultations?limit=10')
    ]);
    const s = a.stats;
    return `<h1 style="font-size:22px;font-weight:700;margin-bottom:16px">🛠 Admin Dashboard</h1>
    <div class="grid cols-4">
      <div class="stat"><div class="label">Revenue</div><div class="value green">${U.ksh(s.totalRevenue)}</div></div>
      <div class="stat"><div class="label">Commission</div><div class="value">${U.ksh(s.totalCommission)}</div></div>
      <div class="stat"><div class="label">Users</div><div class="value">${s.totalUsers}</div></div>
      <div class="stat"><div class="label">Experts</div><div class="value">${s.totalExperts}</div></div>
      <div class="stat"><div class="label">Consultations</div><div class="value">${s.totalConsultations}</div></div>
      <div class="stat"><div class="label">Active</div><div class="value">${s.activeConsultations}</div></div>
      <div class="stat"><div class="label">Pending W/D</div><div class="value">${s.pendingWithdrawals}</div></div>
      <div class="stat"><div class="label">Claims</div><div class="value">${s.activeClaims}</div></div>
    </div>
    <div class="card mt-4">
      <div class="card-title">Recent Users</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${users.users.map((u) => `<tr>
          <td>${U.esc(u.name)}</td><td>${U.esc(u.email)}</td><td>${U.esc(u.role)}</td><td>${U.statusBadge(u.status)}</td>
          <td>${u.status === 'PENDING' ? `<button class="btn btn-primary btn-sm" data-approve="${u.id}">Approve</button>` : ''}
              ${u.status === 'ACTIVE' ? `<button class="btn btn-danger btn-sm" data-suspend="${u.id}">Suspend</button>` : ''}
              ${u.status === 'SUSPENDED' ? `<button class="btn btn-secondary btn-sm" data-reactivate="${u.id}">Reactivate</button>` : ''}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
    <div class="card mt-4">
      <div class="card-title">Pending Withdrawals (${withdrawals.withdrawals.length})</div>
      ${withdrawals.withdrawals.length === 0 ? '<div class="empty">None.</div>' : `<div class="table-wrap"><table>
        <thead><tr><th>Expert</th><th>Amount</th><th>Requested</th><th>Actions</th></tr></thead>
        <tbody>${withdrawals.withdrawals.map((w) => `<tr>
          <td>${U.esc(w.expert?.name)}</td><td>${U.ksh(w.amount)}</td><td>${U.date(w.createdAt)}</td>
          <td><button class="btn btn-primary btn-sm" data-w-approve="${w.id}">Approve</button>
              <button class="btn btn-secondary btn-sm" data-w-process="${w.id}">Process</button>
              <button class="btn btn-danger btn-sm" data-w-reject="${w.id}">Reject</button></td>
        </tr>`).join('')}</tbody>
      </table></div>`}
    </div>
    <div class="card mt-4">
      <div class="card-title">Filed Claims (${claims.claims.length})</div>
      ${claims.claims.length === 0 ? '<div class="empty">No claims.</div>' : `<div class="table-wrap"><table>
        <thead><tr><th>Client</th><th>Title</th><th>Type</th><th>Amount</th><th></th></tr></thead>
        <tbody>${claims.claims.map((c) => `<tr>
          <td>${U.esc(c.client?.name)}</td><td>${U.esc(c.title)}</td>
          <td>${U.esc(c.claimType)}</td><td>${U.ksh(c.amount)}</td>
          <td><button class="btn btn-primary btn-sm" data-claim="${c.id}">Resolve</button></td>
        </tr>`).join('')}</tbody>
      </table></div>`}
    </div>
    <div class="card mt-4">
      <div class="card-title">Recent Consultations</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Title</th><th>Client</th><th>Expert</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${consults.consultations.map((c) => `<tr>
          <td>${U.esc(c.title)}</td><td>${U.esc(c.client?.name)}</td>
          <td>${U.esc(c.expert?.name || '—')}</td><td>${U.ksh(c.amount)}</td><td>${U.statusBadge(c.status)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
    <div class="grid cols-3 mt-4">
      <div class="card"><div class="card-title">Quick Actions</div>
        <button class="btn btn-primary btn-block mb-2" id="a-new-coupon">+ Create Coupon</button>
        <button class="btn btn-secondary btn-block mb-2" id="a-new-expert">+ Add Expert</button>
        <button class="btn btn-secondary btn-block" id="a-new-bootcamp">+ New Bootcamp</button>
      </div>
      <div class="card" style="grid-column:span 2">
        <div class="card-title">Revenue Trend (30d)</div>
        <canvas id="revenue-chart" height="120"></canvas>
      </div>
    </div>`;
  },
  async mountDashboard() {
    const bind = (sel, fn) => document.querySelectorAll(sel).forEach((b) => b.onclick = fn);
    bind('[data-approve]', async (e) => {
      try { await API.post(`/admin/users/${e.target.dataset.approve}/approve`); U.toast('Approved', 'success'); App.navigate('dashboard'); }
      catch (err) { U.toast(err.message, 'error'); }
    });
    bind('[data-suspend]', async (e) => {
      const reason = prompt('Reason?', 'Admin action') || 'Admin action';
      try { await API.post(`/admin/users/${e.target.dataset.suspend}/suspend`, { reason }); U.toast('Suspended', 'success'); App.navigate('dashboard'); }
      catch (err) { U.toast(err.message, 'error'); }
    });
    bind('[data-reactivate]', async (e) => {
      try { await API.post(`/admin/users/${e.target.dataset.reactivate}/reactivate`); U.toast('Reactivated', 'success'); App.navigate('dashboard'); }
      catch (err) { U.toast(err.message, 'error'); }
    });
    bind('[data-w-approve]', async (e) => {
      try { await API.post(`/admin/withdrawals/${e.target.dataset.wApprove}/approve`); U.toast('Approved', 'success'); App.navigate('dashboard'); }
      catch (err) { U.toast(err.message, 'error'); }
    });
    bind('[data-w-process]', async (e) => {
      try { await API.post(`/admin/withdrawals/${e.target.dataset.wProcess}/process`); U.toast('Processed', 'success'); App.navigate('dashboard'); }
      catch (err) { U.toast(err.message, 'error'); }
    });
    bind('[data-w-reject]', async (e) => {
      const reason = prompt('Reason?', 'Rejected') || 'Rejected';
      try { await API.post(`/admin/withdrawals/${e.target.dataset.wReject}/reject`, { reason }); U.toast('Rejected', 'success'); App.navigate('dashboard'); }
      catch (err) { U.toast(err.message, 'error'); }
    });
    bind('[data-claim]', (e) => {
      U.modal({
        title: 'Resolve Claim',
        body: `<form id="cl-form">
          <div class="form-row"><label>Status</label><select name="status">
            <option value="RESOLVED_CLIENT">Resolved (Client)</option>
            <option value="RESOLVED_EXPERT">Resolved (Expert)</option>
            <option value="REFUNDED">Refunded</option>
            <option value="DISMISSED">Dismissed</option>
          </select></div>
          <div class="form-row"><label>Notes</label><textarea name="resolution"></textarea></div>
          <div class="form-row"><label>Refund (KES)</label><input type="number" name="refundAmount" value="0"></div>
        </form>`,
        confirmText: 'Resolve',
        onConfirm: async (wrap) => {
          const fd = Object.fromEntries(new FormData(wrap.querySelector('#cl-form')));
          try { await API.post(`/admin/claims/${e.target.dataset.claim}/resolve`, fd); U.toast('Resolved', 'success'); App.navigate('dashboard'); }
          catch (err) { U.toast(err.message, 'error'); }
        }
      });
    });
    document.getElementById('a-new-coupon')?.addEventListener('click', () => {
      U.modal({
        title: 'Create Coupon',
        body: `<form id="cp-form">
          <div class="form-row"><label>Code</label><input name="code" required></div>
          <div class="form-row"><label>Description</label><input name="description"></div>
          <div class="form-row"><label>Type</label><select name="discountType"><option value="PERCENTAGE">%</option><option value="FIXED">KES</option></select></div>
          <div class="form-row"><label>Value</label><input type="number" name="discountValue" required></div>
          <div class="form-row"><label>Min order (KES)</label><input type="number" name="minOrderAmount" value="0"></div>
          <div class="form-row"><label>Max uses</label><input type="number" name="maxUses" value="100"></div>
          <div class="form-row"><label>Expires at</label><input type="date" name="expiresAt" required></div>
        </form>`,
        confirmText: 'Create',
        onConfirm: async (wrap) => {
          const fd = Object.fromEntries(new FormData(wrap.querySelector('#cp-form')));
          try { await API.post('/admin/coupons', fd); U.toast('Created', 'success'); App.navigate('dashboard'); }
          catch (err) { U.toast(err.message, 'error'); }
        }
      });
    });
    document.getElementById('a-new-expert')?.addEventListener('click', () => {
      U.modal({
        title: 'Add Expert',
        body: `<form id="ex-form">
          <div class="form-row"><label>Name</label><input name="name" required></div>
          <div class="form-row"><label>Email</label><input type="email" name="email" required></div>
          <div class="form-row"><label>Phone</label><input name="phone"></div>
          <div class="form-row"><label>Headline</label><input name="headline"></div>
          <div class="form-row"><label>Hourly (KES)</label><input type="number" name="hourlyRate" value="3000"></div>
          <div class="form-row"><label>Bio</label><textarea name="bio"></textarea></div>
        </form>`,
        confirmText: 'Create',
        onConfirm: async (wrap) => {
          const fd = Object.fromEntries(new FormData(wrap.querySelector('#ex-form')));
          try { await API.post('/admin/experts', fd); U.toast('Expert created', 'success'); App.navigate('dashboard'); }
          catch (err) { U.toast(err.message, 'error'); }
        }
      });
    });
    document.getElementById('a-new-bootcamp')?.addEventListener('click', () => {
      U.modal({
        title: 'New Bootcamp',
        body: `<form id="bc-form">
          <div class="form-row"><label>Title</label><input name="title" required></div>
          <div class="form-row"><label>Description</label><textarea name="description" required></textarea></div>
          <div class="form-row"><label>Category</label><input name="category" value="Technology"></div>
          <div class="form-row"><label>Duration (weeks)</label><input type="number" name="durationWeeks" value="12"></div>
          <div class="form-row"><label>Intensity</label><input name="intensity" value="full-time"></div>
          <div class="form-row"><label>Price (KES)</label><input type="number" name="price" required></div>
          <div class="form-row"><label>Start date</label><input type="date" name="startDate" required></div>
        </form>`,
        confirmText: 'Create',
        onConfirm: async (wrap) => {
          const fd = Object.fromEntries(new FormData(wrap.querySelector('#bc-form')));
          try { await API.post('/admin/bootcamps', fd); U.toast('Bootcamp created', 'success'); App.navigate('dashboard'); }
          catch (err) { U.toast(err.message, 'error'); }
        }
      });
    });
    try {
      const a = await API.get('/admin/analytics?range=30d');
      const canvas = document.getElementById('revenue-chart');
      if (canvas && window.Chart) {
        new Chart(canvas, {
          type: 'line',
          data: {
            labels: a.series.revenue.map((r) => r.day.slice(5)),
            datasets: [{ label: 'Revenue (KES)', data: a.series.revenue.map((r) => r.revenue),
              borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.1)', fill: true, tension: .3 }]
          },
          options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
      }
    } catch {}
  }
};

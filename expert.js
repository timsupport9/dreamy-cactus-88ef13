window.ExpertView = {
  async dashboard() {
    const [p, c, e, s] = await Promise.all([
      API.get('/expert/profile'),
      API.get('/expert/consultations'),
      API.get('/expert/earnings'),
      API.get('/expert/services')
    ]);
    const ep = p.user.expertProfile || {};
    return `<h1 style="font-size:22px;font-weight:700;margin-bottom:16px">🧑‍🏫 Expert Dashboard</h1>
    <div class="grid cols-4">
      <div class="stat"><div class="label">Available</div><div class="value green">${U.ksh(ep.availableBalance)}</div></div>
      <div class="stat"><div class="label">Pending</div><div class="value">${U.ksh(ep.pendingPayout)}</div></div>
      <div class="stat"><div class="label">Total Earned</div><div class="value">${U.ksh(ep.totalEarnings)}</div></div>
      <div class="stat"><div class="label">Rating</div><div class="value">⭐ ${(ep.averageRating || 0).toFixed(1)}</div></div>
    </div>
    <div class="card mt-4">
      <div class="card-title">Active Consultations <button class="btn btn-primary btn-sm" id="req-withdrawal">Request Withdrawal</button></div>
      ${c.consultations.length === 0 ? '<div class="empty">No consultations assigned yet.</div>' : `<div class="table-wrap"><table>
        <thead><tr><th>Title</th><th>Client</th><th>Payout</th><th>Status</th><th></th></tr></thead>
        <tbody>${c.consultations.map((x) => `<tr>
          <td>${U.esc(x.title)}</td><td>${U.esc(x.client?.name)}</td>
          <td>${U.ksh(x.expertPayout)}</td><td>${U.statusBadge(x.status)}</td>
          <td>${['ASSIGNED','IN_PROGRESS'].includes(x.status)
            ? `<button class="btn btn-primary btn-sm" data-complete="${x.id}">Complete</button>` : ''}
            <a href="#/chat?id=${x.id}" class="btn btn-ghost btn-sm">Chat</a></td>
        </tr>`).join('')}</tbody>
      </table></div>`}
    </div>
    <div class="card mt-4">
      <div class="card-title">My Services <button class="btn btn-primary btn-sm" id="new-service">+ New Service</button></div>
      ${s.services.length === 0 ? '<div class="empty">No services yet.</div>' : `<div class="table-wrap"><table>
        <thead><tr><th>Title</th><th>Price</th><th>Duration</th><th>Status</th><th></th></tr></thead>
        <tbody>${s.services.map((x) => `<tr>
          <td>${U.esc(x.title)}</td><td>${U.ksh(x.price)}</td><td>${x.durationMinutes} min</td>
          <td>${x.isActive ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
          <td><button class="btn btn-danger btn-sm" data-del-service="${x.id}">Delete</button></td>
        </tr>`).join('')}</tbody>
      </table></div>`}
    </div>
    <div class="card mt-4">
      <div class="card-title">Withdrawal History</div>
      ${e.payments.length === 0 ? '<div class="empty">No withdrawals yet.</div>' : `<div class="table-wrap"><table>
        <thead><tr><th>Amount</th><th>Method</th><th>Status</th><th>Requested</th></tr></thead>
        <tbody>${e.payments.map((w) => `<tr>
          <td>${U.ksh(w.amount)}</td><td>${U.esc(w.method)}</td>
          <td>${U.statusBadge(w.status)}</td><td>${U.date(w.createdAt)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`}
    </div>`;
  },
  async mountDashboard() {
    document.querySelectorAll('[data-complete]').forEach((b) => b.onclick = async () => {
      if (!confirm('Mark this consultation as completed?')) return;
      try { await API.patch(`/expert/consultations/${b.dataset.complete}/status`, { status: 'COMPLETED' });
        U.toast('Completed', 'success'); App.navigate('dashboard'); }
      catch (e) { U.toast(e.message, 'error'); }
    });
    document.querySelectorAll('[data-del-service]').forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this service?')) return;
      try { await API.del(`/expert/services/${b.dataset.delService}`);
        U.toast('Deleted', 'success'); App.navigate('dashboard'); }
      catch (e) { U.toast(e.message, 'error'); }
    });
    document.getElementById('new-service')?.addEventListener('click', () => {
      U.modal({
        title: 'Create Service',
        body: `<form id="s-form">
          <div class="form-row"><label>Title</label><input name="title" required></div>
          <div class="form-row"><label>Description</label><textarea name="description"></textarea></div>
          <div class="form-row"><label>Price (KES)</label><input type="number" name="price" required min="1"></div>
          <div class="form-row"><label>Duration (minutes)</label><input type="number" name="durationMinutes" value="60"></div>
          <div class="form-row"><label>Category</label><input name="category"></div>
        </form>`,
        confirmText: 'Create',
        onConfirm: async (wrap) => {
          const fd = Object.fromEntries(new FormData(wrap.querySelector('#s-form')));
          try { await API.post('/expert/services', fd); U.toast('Service created', 'success'); App.navigate('dashboard'); }
          catch (e) { U.toast(e.message, 'error'); }
        }
      });
    });
    document.getElementById('req-withdrawal')?.addEventListener('click', () => {
      U.modal({
        title: 'Request Withdrawal',
        body: `<form id="w-form">
          <div class="form-row"><label>Amount (KES)</label><input type="number" name="amount" min="200" required></div>
          <div class="form-row"><label>M-Pesa Phone</label><input name="phone" placeholder="0712345678" required></div>
          <p class="text-sm muted">Withdrawals processed after 7-day holding period. Minimum KES 200.</p>
        </form>`,
        confirmText: 'Request',
        onConfirm: async (wrap) => {
          const fd = Object.fromEntries(new FormData(wrap.querySelector('#w-form')));
          try {
            await API.post('/expert/withdrawals', {
              amount: fd.amount, withdrawalMethod: 'mpesa',
              accountDetails: { phone: fd.phone }
            });
            U.toast('Withdrawal requested', 'success'); App.navigate('dashboard');
          } catch (e) { U.toast(e.message, 'error'); }
        }
      });
    });
  }
};

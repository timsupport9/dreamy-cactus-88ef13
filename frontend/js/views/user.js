window.UserView = {
  async dashboard() {
    const [c, cl, tk] = await Promise.all([
      API.get('/user/consultations'),
      API.get('/user/claims'),
      API.get('/user/support-tickets')
    ]);
    return `<h1 style="font-size:22px;font-weight:700;margin-bottom:16px">👤 My Dashboard</h1>
    <div class="grid cols-4">
      <div class="stat"><div class="label">Consultations</div><div class="value">${c.consultations.length}</div></div>
      <div class="stat"><div class="label">Claims</div><div class="value">${cl.claims.length}</div></div>
      <div class="stat"><div class="label">Tickets</div><div class="value">${tk.tickets.length}</div></div>
      <div class="stat"><div class="label">Referral</div><div class="value" style="font-size:16px">${U.esc(State.user?.referralCode || '—')}</div></div>
    </div>
    <div class="card mt-4">
      <div class="card-title">Recent Consultations <button class="btn btn-primary btn-sm" id="new-consult">+ New Request</button></div>
      ${c.consultations.length === 0 ? '<div class="empty">No consultations yet.</div>' : `<div class="table-wrap"><table>
        <thead><tr><th>Title</th><th>Expert</th><th>Amount</th><th>Status</th><th>Payment</th><th></th></tr></thead>
        <tbody>${c.consultations.map((x) => `<tr>
          <td>${U.esc(x.title)}</td><td>${U.esc(x.expert?.name || '—')}</td>
          <td>${U.ksh(x.amount)}</td><td>${U.statusBadge(x.status)}</td><td>${U.statusBadge(x.paymentStatus)}</td>
          <td>${x.paymentStatus !== 'PAID' && x.amount > 0
            ? `<button class="btn btn-primary btn-sm" data-pay="${x.id}" data-amount="${x.amount}">Pay</button>`
            : `<a href="#/chat?id=${x.id}" class="btn btn-ghost btn-sm">Chat</a>`}</td>
        </tr>`).join('')}</tbody>
      </table></div>`}
    </div>
    <div class="card mt-4">
      <div class="card-title">My Claims <button class="btn btn-secondary btn-sm" id="new-claim">File Claim</button></div>
      ${cl.claims.length === 0 ? '<div class="empty">No claims.</div>' : `<div class="table-wrap"><table>
        <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Amount</th></tr></thead>
        <tbody>${cl.claims.map((x) => `<tr><td>${U.esc(x.title)}</td><td>${U.esc(x.claimType)}</td>
          <td>${U.statusBadge(x.status)}</td><td>${U.ksh(x.amount)}</td></tr>`).join('')}</tbody>
      </table></div>`}
    </div>
    <div class="card mt-4">
      <div class="card-title">Support Tickets <button class="btn btn-secondary btn-sm" id="new-ticket">New Ticket</button></div>
      ${tk.tickets.length === 0 ? '<div class="empty">No tickets.</div>' : tk.tickets.map((t) => `
        <div style="padding:12px;border-bottom:1px solid var(--border)">
          <div class="flex justify-between items-center"><strong>${U.esc(t.subject)}</strong><div>${U.statusBadge(t.status)}</div></div>
          <div class="text-sm muted mt-2">${U.esc(t.messages?.[0]?.body || '')}</div>
        </div>`).join('')}
    </div>`;
  },
  async mountDashboard() {
    document.getElementById('new-consult')?.addEventListener('click', async () => {
      const { experts } = await API.get('/common/experts?limit=50');
      const opts = experts.map((e) => `<option value="${e.id}">${U.esc(e.name)} — ${U.esc(e.expertProfile?.headline || 'Expert')}</option>`).join('');
      U.modal({
        title: 'New Consultation Request',
        body: `<form id="c-form">
          <div class="form-row"><label>Title</label><input name="title" required></div>
          <div class="form-row"><label>Description</label><textarea name="description" rows="3"></textarea></div>
          <div class="form-row"><label>Preferred Expert (optional)</label><select name="expertId"><option value="">Any</option>${opts}</select></div>
        </form>`,
        confirmText: 'Submit',
        onConfirm: async (wrap) => {
          const fd = Object.fromEntries(new FormData(wrap.querySelector('#c-form')));
          try { await API.post('/user/consultations', fd); U.toast('Request submitted', 'success'); App.navigate('dashboard'); }
          catch (e) { U.toast(e.message, 'error'); }
        }
      });
    });
    document.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => this.openPayModal(b.dataset.pay, b.dataset.amount));
    document.getElementById('new-claim')?.addEventListener('click', () => {
      U.modal({
        title: 'File a Claim',
        body: `<form id="claim-form">
          <div class="form-row"><label>Title</label><input name="title" required></div>
          <div class="form-row"><label>Type</label><select name="claimType">
            <option>POOR_QUALITY</option><option>NO_SHOW</option><option>DELAYED</option><option>RUDE</option><option>OTHER</option>
          </select></div>
          <div class="form-row"><label>Description</label><textarea name="description" required></textarea></div>
          <div class="form-row"><label>Claim Amount (KES)</label><input type="number" name="amount" value="0"></div>
        </form>`,
        confirmText: 'File Claim',
        onConfirm: async (wrap) => {
          const fd = Object.fromEntries(new FormData(wrap.querySelector('#claim-form')));
          try { await API.post('/user/claims', fd); U.toast('Claim filed', 'success'); App.navigate('dashboard'); }
          catch (e) { U.toast(e.message, 'error'); }
        }
      });
    });
    document.getElementById('new-ticket')?.addEventListener('click', () => {
      U.modal({
        title: 'New Support Ticket',
        body: `<form id="t-form">
          <div class="form-row"><label>Subject</label><input name="subject" required></div>
          <div class="form-row"><label>Category</label><input name="category" value="general"></div>
          <div class="form-row"><label>Message</label><textarea name="message" required></textarea></div>
        </form>`,
        confirmText: 'Submit',
        onConfirm: async (wrap) => {
          const fd = Object.fromEntries(new FormData(wrap.querySelector('#t-form')));
          try { await API.post('/user/support-tickets', fd); U.toast('Ticket created', 'success'); App.navigate('dashboard'); }
          catch (e) { U.toast(e.message, 'error'); }
        }
      });
    });
  },
  openPayModal(consultationId, amount) {
    U.modal({
      title: 'Pay with M-Pesa',
      body: `<form id="pay-form">
        <div class="form-row"><label>Amount</label><input type="text" value="${U.ksh(amount)}" disabled></div>
        <div class="form-row"><label>M-Pesa Phone</label><input type="tel" name="phone" placeholder="0712345678" value="${U.esc(State.user?.phone || '')}" required></div>
        <div class="form-row"><label>Coupon code (optional)</label><input type="text" name="couponCode" placeholder="e.g. KARIBU20"></div>
        <p class="text-sm muted">You'll receive an STK push. Enter your M-Pesa PIN to complete payment.</p>
      </form>`,
      confirmText: 'Send STK Push',
      onConfirm: async (wrap) => {
        const fd = Object.fromEntries(new FormData(wrap.querySelector('#pay-form')));
        try {
          const r = await API.post('/payments/mpesa/stkpush', {
            consultationId, phone: fd.phone, couponCode: fd.couponCode || undefined
          });
          U.toast(r.message, 'success');
          this.pollPayment(r.paymentId);
        } catch (e) { U.toast(e.message, 'error'); }
      }
    });
  },
  pollPayment(paymentId) {
    let tries = 0;
    const iv = setInterval(async () => {
      tries++;
      try {
        const r = await API.get(`/payments/mpesa/status/${paymentId}`);
        if (r.status === 'PAID') { clearInterval(iv); U.toast('Payment confirmed ✅', 'success'); App.navigate('dashboard'); }
      } catch {}
      if (tries > 30) clearInterval(iv);
    }, 4000);
  }
};

window.U = {
  el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; },
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },
  ksh(n) { return `KES ${(Number(n) || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; },
  date(d) { return d ? new Date(d).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; },
  time(d) { return d ? new Date(d).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : ''; },
  initials(name = '') { return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase(); },
  toast(msg, type = 'info', ms = 3200) {
    const root = document.getElementById('toast-root');
    const node = this.el(`<div class="toast ${type}">${this.esc(msg)}</div>`);
    root.appendChild(node);
    setTimeout(() => { node.style.opacity = '0'; setTimeout(() => node.remove(), 200); }, ms);
  },
  modal({ title, body, onConfirm, confirmText = 'Save', danger = false }) {
    const root = document.getElementById('modal-root');
    const wrap = this.el(`<div class="modal-backdrop">
      <div class="modal">
        <h2>${this.esc(title)}</h2>
        <div class="modal-body">${body}</div>
        <div class="flex justify-between mt-6 gap-2">
          <button class="btn btn-secondary" data-close>Cancel</button>
          ${onConfirm ? `<button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${this.esc(confirmText)}</button>` : ''}
        </div>
      </div>
    </div>`);
    root.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('[data-close]').onclick = close;
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
    const cb = wrap.querySelector('[data-confirm]');
    if (cb) cb.onclick = async () => { await onConfirm(wrap); close(); };
    return { close, el: wrap };
  },
  statusBadge(status) {
    const s = (status || '').toLowerCase();
    const map = {
      active:'green', approved:'green', completed:'green', paid:'green', published:'green', resolved:'green',
      pending:'amber', in_progress:'amber', assigned:'blue', processing:'amber', open:'blue',
      suspended:'red', failed:'red', rejected:'red', cancelled:'gray', disputed:'red',
      draft:'gray', archived:'gray', closed:'gray', dismissed:'gray'
    };
    return `<span class="badge badge-${map[s] || 'gray'}">${this.esc(status || '—')}</span>`;
  }
};

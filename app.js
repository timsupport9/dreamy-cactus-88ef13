window.App = {
  routes: {
    'login': { view: 'auth', mode: 'login', public: true },
    'register': { view: 'auth', mode: 'register', public: true },
    'forgot': { view: 'auth', mode: 'forgot', public: true },
    'reset': { view: 'auth', mode: 'reset', public: true },
    'dashboard': { view: 'dashboard', auth: true },
    'posts': { view: 'posts', public: true },
    'post': { view: 'post', public: true },
    'chat': { view: 'chat', auth: true },
    'home': { view: 'home', public: true }
  },

  parseHash() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [path, qs] = hash.split('?');
    return { path: path || 'home', query: Object.fromEntries(new URLSearchParams(qs || '')) };
  },

  navigate(name, params = {}) {
    const qs = new URLSearchParams(params).toString();
    location.hash = `#/${name}${qs ? '?' + qs : ''}`;
  },

  async router() {
    const { path, query } = this.parseHash();
    const route = this.routes[path] || this.routes['home'];

    const urlReset = new URLSearchParams(location.search).get('reset_token');
    if (urlReset && !State.isAuthed()) return LoginView.mount('reset', { token: urlReset });

    if (route.auth && !State.isAuthed()) { U.toast('Please sign in', 'info'); return this.navigate('login'); }
    if (route.public && State.isAuthed() && ['login','register'].includes(path)) return this.navigate('dashboard');

    if (route.view === 'auth') return LoginView.mount(route.mode, query);

    if (route.view === 'dashboard') {
      this.renderShell();
      const main = document.getElementById('main-slot');
      main.innerHTML = '<div class="boot-loader"><div class="spinner"></div></div>';
      try {
        if (State.user.role === 'ADMIN') { main.innerHTML = await AdminView.dashboard(); await AdminView.mountDashboard(); }
        else if (State.user.role === 'EXPERT') { main.innerHTML = await ExpertView.dashboard(); await ExpertView.mountDashboard(); }
        else { main.innerHTML = await UserView.dashboard(); await UserView.mountDashboard(); }
      } catch (e) { main.innerHTML = `<div class="empty">Error: ${U.esc(e.message)}</div>`; }
      return;
    }

    if (route.view === 'posts') {
      this.renderShell();
      const main = document.getElementById('main-slot');
      main.innerHTML = await PostsView.render();
      await PostsView.mount();
      return;
    }

    if (route.view === 'post') {
      this.renderShell();
      const main = document.getElementById('main-slot');
      main.innerHTML = await PostsView.renderDetail(query.slug);
      await PostsView.mountDetail(query.slug);
      return;
    }

    if (route.view === 'chat') {
      this.renderShell();
      return this.renderChat(query.id);
    }

    this.renderShell();
    document.getElementById('main-slot').innerHTML = `
      <div class="card text-center" style="padding:60px 20px">
        <h1 style="font-size:32px;margin-bottom:12px">🇰🇪 Karibu ExpertHub</h1>
        <p class="muted mb-4">Kenya's platform for verified expert consultations, bootcamps, and courses. Pay with M-Pesa.</p>
        <div class="flex gap-2 justify-between" style="justify-content:center">
          <a href="#/posts" class="btn btn-secondary">Read the Blog</a>
          <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
        </div>
      </div>`;
  },

  renderShell() {
    const u = State.user;
    const isAuthed = !!u;
    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <a class="brand" href="#/home"><span class="logo">🇰🇪</span> ExpertHub</a>
          <nav>
            <a href="#/posts">Blog</a>
            ${isAuthed ? `
              <a href="#/dashboard">Dashboard</a>
              <button id="btn-notifs" title="Notifications">🔔 <span id="notif-badge" class="badge badge-red" style="display:none">0</span></button>
              <div class="avatar" title="${U.esc(u.name)}">${U.initials(u.name)}</div>
              <button id="btn-logout">Logout</button>
            ` : `
              <a href="#/login">Sign in</a>
              <a href="#/register" class="btn btn-primary btn-sm">Join</a>
            `}
          </nav>
        </header>
        <main class="main" id="main-slot"></main>
      </div>`;

    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      await Auth.logout();
      U.toast('Signed out', 'info');
      this.navigate('login');
    });
    document.getElementById('btn-notifs')?.addEventListener('click', () => this.showNotifications());
    this.renderNotificationsBadge();
  },

  renderNotificationsBadge() {
    const b = document.getElementById('notif-badge');
    if (!b) return;
    if (State.unreadCount > 0) { b.style.display = 'inline-block'; b.textContent = State.unreadCount; }
    else b.style.display = 'none';
  },

  async showNotifications() {
    try {
      const { notifications } = await API.get('/common/notifications');
      const html = notifications.length === 0 ? '<div class="empty">No notifications</div>' :
        notifications.slice(0, 20).map((n) => `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
          <div><strong>${U.esc(n.title)}</strong></div>
          <div class="text-sm muted">${U.esc(n.message)}</div>
          <div class="text-sm muted">${U.date(n.createdAt)}</div>
        </div>`).join('');
      U.modal({
        title: 'Notifications', body: html, confirmText: 'Mark all read',
        onConfirm: async () => { await API.post('/common/notifications/read-all'); State.unreadCount = 0; this.renderNotificationsBadge(); }
      });
    } catch (e) { U.toast(e.message, 'error'); }
  },

  async renderChat(consultationId) {
    if (!consultationId) return this.navigate('dashboard');
    const main = document.getElementById('main-slot');
    main.innerHTML = '<div class="boot-loader"><div class="spinner"></div></div>';
    try {
      const { messages } = await API.get(`/common/consultations/${consultationId}/messages`);
      main.innerHTML = `<a href="#/dashboard" class="btn btn-ghost btn-sm mb-4">← Back</a>
        <div class="card">
          <div class="card-title">💬 Consultation Chat</div>
          <div class="chat">
            <div class="chat-messages" id="chat-msgs">${messages.map((m) => this.renderMsg(m)).join('')}</div>
            <form class="chat-input" id="chat-form">
              <input type="text" name="message" placeholder="Type a message…" autocomplete="off" required>
              <button class="btn btn-primary" type="submit">Send</button>
            </form>
          </div>
        </div>`;
      const chat = document.getElementById('chat-msgs');
      chat.scrollTop = chat.scrollHeight;

      document.getElementById('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input[name=message]');
        const body = input.value.trim();
        if (!body) return;
        input.value = '';
        try {
          const { message } = await API.post(`/common/consultations/${consultationId}/messages`, { message: body });
          chat.appendChild(U.el(this.renderMsg(message)));
          chat.scrollTop = chat.scrollHeight;
        } catch (err) { U.toast(err.message, 'error'); }
      });

      State.socket?.emit('join_consultation', consultationId);
      this._chatListener = (e) => {
        if (e.detail.consultationId !== consultationId) return;
        if (e.detail.senderId === State.user.id) return;
        chat.appendChild(U.el(this.renderMsg(e.detail)));
        chat.scrollTop = chat.scrollHeight;
      };
      window.addEventListener('eh:message', this._chatListener);
    } catch (e) { main.innerHTML = `<div class="empty">Error: ${U.esc(e.message)}</div>`; }
  },

  renderMsg(m) {
    const mine = m.senderId === State.user?.id || m.sender?.id === State.user?.id;
    return `<div class="chat-msg ${mine ? 'mine' : ''}">
      ${!mine ? `<div class="text-sm"><strong>${U.esc(m.sender?.name || 'User')}</strong></div>` : ''}
      <div>${U.esc(m.body)}</div>
      <div class="meta">${U.time(m.createdAt)}</div>
    </div>`;
  },

  async boot() {
    State.load();
  /* Probe backend capabilities (M-Pesa live or simulated) */
  try {
    const res = await fetch(`${CONFIG.API_BASE}/health`);
    if (res.ok) { const h = await res.json(); CONFIG.flags.mpesaLive = h.mpesa === 'live'; }
  } catch (_) {}

    const urlReset = new URLSearchParams(location.search).get('reset_token');
    if (urlReset) history.replaceState(null, '', location.pathname + location.hash);

    if (State.isAuthed()) {
      try { await Auth.me(); Socket.connect(); } catch { State.clear(); }
    }

    window.addEventListener('hashchange', () => this.router());
    await this.router();
  }
};

document.addEventListener('DOMContentLoaded', () => App.boot());

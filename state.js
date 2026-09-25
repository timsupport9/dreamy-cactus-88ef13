window.State = {
  user: null, token: null, refreshToken: null,
  notifications: [], unreadCount: 0, socket: null,

  load() {
    try {
      this.token = localStorage.getItem(CONFIG.STORAGE_TOKEN);
      this.refreshToken = localStorage.getItem(CONFIG.STORAGE_REFRESH);
      const u = localStorage.getItem(CONFIG.STORAGE_USER);
      this.user = u ? JSON.parse(u) : null;
    } catch { this.token = this.user = null; }
  },
  set({ token, refreshToken, user }) {
    if (token) { this.token = token; localStorage.setItem(CONFIG.STORAGE_TOKEN, token); }
    if (refreshToken) { this.refreshToken = refreshToken; localStorage.setItem(CONFIG.STORAGE_REFRESH, refreshToken); }
    if (user) { this.user = user; localStorage.setItem(CONFIG.STORAGE_USER, JSON.stringify(user)); }
  },
  clear() {
    this.user = this.token = this.refreshToken = null;
    this.notifications = []; this.unreadCount = 0;
    [CONFIG.STORAGE_TOKEN, CONFIG.STORAGE_REFRESH, CONFIG.STORAGE_USER].forEach((k) => localStorage.removeItem(k));
  },
  isAuthed() { return !!this.token && !!this.user; },
  hasRole(...r) { return this.user && r.includes(this.user.role); }
};

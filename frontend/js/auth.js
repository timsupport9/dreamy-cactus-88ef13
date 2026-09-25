window.Auth = {
  async login(email, password) {
    const d = await API.post('/auth/login', { email, password });
    State.set({ token: d.token, refreshToken: d.refreshToken, user: d.user });
    Socket.connect();
    return d.user;
  },
  async register(payload) {
    const d = await API.post('/auth/register', payload);
    State.set({ token: d.token, refreshToken: d.refreshToken, user: d.user });
    Socket.connect();
    return d.user;
  },
  async me() {
    const d = await API.get('/auth/me');
    State.set({ user: d.user });
    return d.user;
  },
  async logout() {
    try { await API.post('/auth/logout'); } catch {}
    Socket.disconnect();
    State.clear();
  },
  forgot(email) { return API.post('/auth/forgot-password', { email }); },
  reset(token, newPassword) { return API.post('/auth/reset-password', { token, newPassword }); }
};

window.API = {
  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const url = `${CONFIG.API_BASE}${path}`;
    const opts = { method, headers: { ...headers } };
    if (body !== undefined) {
      if (body instanceof FormData) opts.body = body;
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    if (State.token) opts.headers.Authorization = `Bearer ${State.token}`;

    let res = await fetch(url, opts);
    if (res.status === 401 && State.refreshToken && !path.startsWith('/auth/')) {
      if (await this.tryRefresh()) {
        opts.headers.Authorization = `Bearer ${State.token}`;
        res = await fetch(url, opts);
      }
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, data });
    return data;
  },
  async tryRefresh() {
    try {
      const r = await fetch(`${CONFIG.API_BASE}/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: State.refreshToken })
      });
      if (!r.ok) { State.clear(); return false; }
      const d = await r.json();
      State.set({ token: d.token });
      return true;
    } catch { State.clear(); return false; }
  },
  get(p) { return this.request(p); },
  post(p, b) { return this.request(p, { method: 'POST', body: b }); },
  patch(p, b) { return this.request(p, { method: 'PATCH', body: b }); },
  put(p, b) { return this.request(p, { method: 'PUT', body: b }); },
  del(p) { return this.request(p, { method: 'DELETE' }); }
};

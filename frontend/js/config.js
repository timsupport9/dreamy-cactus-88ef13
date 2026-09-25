(function () {
  const isSameOrigin = !window.__API_HOST__;
  const API_BASE = isSameOrigin ? '/api' : `${window.__API_HOST__.replace(/\/$/, '')}/api`;
  window.CONFIG = {
    API_BASE, SOCKET_URL: window.__SOCKET_HOST__ || undefined,
    SOCKET_PATH: '/socket.io', CURRENCY: 'KES',
    STORAGE: { TOKEN: 'eh_token', REFRESH: 'eh_refresh', USER: 'eh_user' },
    flags: { mpesaLive: false }
  };
})();

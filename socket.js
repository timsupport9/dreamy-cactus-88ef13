window.Socket = {
  connect() {
    if (!State.token || typeof io === 'undefined') return;
    if (State.socket?.connected) return;
    State.socket = io({ auth: { token: State.token }, transports: ['websocket', 'polling'] });

    State.socket.on('connect', () => console.log('🔌 socket connected'));
    State.socket.on('connect_error', (e) => console.warn('socket error:', e.message));

    State.socket.on('notification', (n) => {
      State.notifications.unshift(n);
      State.unreadCount++;
      U.toast(n.title, 'info');
      if (window.App) App.renderNotificationsBadge();
    });

    State.socket.on('new_message', (m) => {
      window.dispatchEvent(new CustomEvent('eh:message', { detail: m }));
    });

    State.socket.on('data-update', () => window.dispatchEvent(new CustomEvent('eh:data-update')));
  },
  disconnect() { State.socket?.disconnect(); State.socket = null; }
};

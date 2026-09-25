window.LoginView = {
  render(mode = 'login', extra = {}) {
    const isLogin = mode === 'login';
    const isForgot = mode === 'forgot';
    const isReset = mode === 'reset';
    return `<div class="auth-wrap"><div class="auth-card">
      <h1>${isLogin ? 'Karibu tena' : isForgot ? 'Forgot password' : isReset ? 'Reset password' : 'Karibu ExpertHub'}</h1>
      <p class="sub">${isLogin ? 'Sign in to your account' : isForgot ? "Enter your email — we'll send a reset link" : isReset ? 'Choose a new password' : 'Create your free account'}</p>
      ${isLogin ? this.loginForm() : isForgot ? this.forgotForm() : isReset ? this.resetForm(extra.token || '') : this.registerForm()}
      <div class="auth-switch">
        ${isLogin
          ? `New here? <button data-go="register">Create account</button> · <button data-go="forgot">Forgot password?</button>`
          : `Have an account? <button data-go="login">Sign in</button>`}
      </div>
    </div></div>`;
  },
  loginForm() {
    return `<form id="login-form">
      <div class="form-row"><label>Email</label><input type="email" name="email" required placeholder="you@example.com"></div>
      <div class="form-row"><label>Password</label><input type="password" name="password" required></div>
      <button class="btn btn-primary btn-block mt-4" type="submit">Sign In</button>
      <div class="text-center mt-3 text-sm muted">Demo: admin@platform.com / admin123</div>
    </form>`;
  },
  registerForm() {
    return `<form id="register-form">
      <div class="form-row"><label>Full name</label><input type="text" name="name" required></div>
      <div class="form-row"><label>Email</label><input type="email" name="email" required></div>
      <div class="form-row"><label>Phone (optional)</label><input type="tel" name="phone" placeholder="0712345678"></div>
      <div class="form-row"><label>Password (min 6)</label><input type="password" name="password" minlength="6" required></div>
      <div class="form-row"><label>Referral code (optional)</label><input type="text" name="referralCode"></div>
      <button class="btn btn-primary btn-block mt-4" type="submit">Create Account</button>
    </form>`;
  },
  forgotForm() {
    return `<form id="forgot-form">
      <div class="form-row"><label>Email</label><input type="email" name="email" required></div>
      <button class="btn btn-primary btn-block mt-4" type="submit">Send Reset Link</button>
    </form>`;
  },
  resetForm(token) {
    return `<form id="reset-form">
      <input type="hidden" name="token" value="${U.esc(token)}">
      <div class="form-row"><label>New password</label><input type="password" name="newPassword" minlength="6" required></div>
      <button class="btn btn-primary btn-block mt-4" type="submit">Reset Password</button>
    </form>`;
  },
  mount(mode, extra = {}) {
    const root = document.getElementById('app');
    root.innerHTML = this.render(mode, extra);
    root.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => App.navigate(b.dataset.go));

    root.querySelector('#login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        await Auth.login(fd.get('email'), fd.get('password'));
        U.toast('Karibu!', 'success');
        App.navigate('dashboard');
      } catch (err) { U.toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Sign In'; }
    });

    root.querySelector('#register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Creating…';
      try { await Auth.register(fd); U.toast('Account created 🎉', 'success'); App.navigate('dashboard'); }
      catch (err) { U.toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Create Account'; }
    });

    root.querySelector('#forgot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const r = await Auth.forgot(fd.get('email'));
        U.toast(r.message, 'success');
        if (r.resetUrl) {
          U.modal({ title: 'Dev reset link',
            body: `<p class="text-sm">In production this is emailed:</p><a href="${U.esc(r.resetUrl)}" class="btn btn-primary mt-4">Open reset page</a>` });
        }
        App.navigate('login');
      } catch (err) { U.toast(err.message, 'error'); }
    });

    root.querySelector('#reset-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      try {
        const r = await Auth.reset(fd.token, fd.newPassword);
        U.toast(r.message, 'success');
        App.navigate('login');
      } catch (err) { U.toast(err.message, 'error'); }
    });
  }
};

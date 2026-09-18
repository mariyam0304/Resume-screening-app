const Router = {
  routes: {
    'dashboard': () => Dashboard.render(),
    'create-jd': () => JD.createView(),
    'saved-jds': () => JD.savedView(),
    'upload': () => Upload.view(),
    'screening': (q) => Screening.view(q),
    'candidate': (q) => CandidateView.view(q),
    'compare': () => Compare.view(),
    'questions': (q) => Questions.view(q),
    'database': () => CandidateView.view({}),
  },

  parseHash() {
    const hash = location.hash.replace(/^#/, '') || 'dashboard';
    const parts = hash.split('?');
    const route = parts[0];
    const query = {};
    if (parts[1]) {
      parts[1].split('&').forEach(p => {
        const kv = p.split('=');
        query[kv[0]] = decodeURIComponent(kv[1] || '');
      });
    }
    return { route, query };
  },

  async go(route, query) {
    query = query || {};
    const qs = Object.keys(query).map(k => k + '=' + encodeURIComponent(query[k])).join('&');
    location.hash = '#' + route + (qs ? '?' + qs : '');
  },

  async handle() {
    const parsed = this.parseHash();
    if (!Auth.user && parsed.route !== 'login') {
      this.renderLogin();
      return;
    }
    document.querySelectorAll('.nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === parsed.route);
    });
    const fn = this.routes[parsed.route] || this.routes['dashboard'];
    try {
      await fn(parsed.query);
    } catch (e) {
      console.error(e);
    }
  },

  renderLogin() {
    const view = document.getElementById('view');
    view.innerHTML =
      '<div class="login-wrap">' +
        '<h1>SmartHire AI</h1>' +
        '<div class="tabs">' +
          '<div class="tab active" id="tab-login">Login</div>' +
          '<div class="tab" id="tab-register">Register</div>' +
        '</div>' +
        '<input id="l-username" placeholder="Username" />' +
        '<input id="l-email" placeholder="Email (register only)" style="margin-top:8px;" />' +
        '<input id="l-password" type="password" placeholder="Password" style="margin-top:8px;" />' +
        '<button class="btn" style="margin-top:12px;width:100%;" id="l-submit">Login</button>' +
        '<p class="muted" style="text-align:center;margin-top:10px;">Default: admin / admin123</p>' +
      '</div>';

    let mode = 'login';
    const setTab = (m) => {
      mode = m;
      document.getElementById('tab-login').classList.toggle('active', m === 'login');
      document.getElementById('tab-register').classList.toggle('active', m === 'register');
      document.getElementById('l-submit').textContent = m === 'login' ? 'Login' : 'Register';
    };
    document.getElementById('tab-login').onclick = () => setTab('login');
    document.getElementById('tab-register').onclick = () => setTab('register');
    document.getElementById('l-submit').onclick = async () => {
      const u = document.getElementById('l-username').value;
      const e = document.getElementById('l-email').value;
      const p = document.getElementById('l-password').value;
      try {
        if (mode === 'login') await Auth.login(u, p);
        else await Auth.register(u, e, p);
        Router.handle();
      } catch (err) { alert('Authentication failed'); }
    };
  },

  async init() {
    await Auth.refresh();
    window.addEventListener('hashchange', () => this.handle());
    if (!location.hash) location.hash = '#dashboard';
    this.handle();
  },
};

function statusClass(s) {
  if (s === 'Strong Match') return 'badge-strong';
  if (s === 'Potential Match') return 'badge-potential';
  if (s === 'Needs Review') return 'badge-review';
  return 'badge-low';
}

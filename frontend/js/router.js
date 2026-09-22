const Router = {
  routes: {
    // === Existing recruiter app routes ===
    'dashboard': () => Dashboard.render(),
    'create-jd': () => JD.createView(),
    'saved-jds': () => JD.savedView(),
    'upload': () => Upload.view(),
    'screening': (q) => Screening.view(q),
    'candidate': (q) => CandidateView.view(q),
    'compare': () => Compare.view(),
    'leaderboard': () => Leaderboard.view(),
    'jd-funnel': (q) => JDFunnel.view(q),
    'questions': (q) => Questions.view(q),
    'database': () => CandidateView.view({}),

    // === NEW: Home + portal pages ===
    'home': () => Portal.homePage(),
    'login-recruiter': () => Router.handleRecruiterLogin(),
    'recruiter-register': () => Portal.recruiterRegisterPage(),
    'candidate-register': () => Portal.registerPage(),
    'candidate-login': () => Portal.loginPage(),
    'candidate-dashboard': () => Portal.dashboardPage(),
    'candidate-profile': () => Portal.profilePage(),
    'candidate-applications': () => Portal.applicationsPage(),
    'browse-jobs': () => Portal.browseJobsPage(),
    'applications-inbox': (q) => ApplicationsInbox.view(q),
    'interview-questions': (q) => InterviewQuestions.view(q),
    'job-detail': (q) => Portal.jobDetailPage(q),
  },

  parseHash() {
    const hash = location.hash.replace(/^#/, '') || 'home';
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

    // If logged in as candidate and trying to visit a non-portal route
    if (typeof Portal !== 'undefined' && Portal.user && !parsed.route.startsWith('candidate-') && !parsed.route.startsWith('browse-') && parsed.route !== 'home' && parsed.route !== 'login-recruiter') {
      // Allow through — recruiter routes are separate; candidate portal handles its own nav
    }

    // If not logged in as recruiter AND not logged in as candidate AND not on public page → show homepage
    const publicRoutes = ['home', 'candidate-register', 'candidate-login', 'login-recruiter','recruiter-register', 'login'];
    const candidateRoutes = ['candidate-dashboard', 'candidate-profile', 'candidate-applications', 'browse-jobs'];
    const candidateLoggedIn = typeof Portal !== 'undefined' && Portal.user;

    if (!Auth.user && !candidateLoggedIn && publicRoutes.indexOf(parsed.route) === -1) {
      this.renderHomeOrLogin(parsed.route);
      return;
    }

    document.querySelectorAll('.nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === parsed.route);
    });

    const fn = this.routes[parsed.route] || this.routes['home'];
    try {
      await fn(parsed.query);
    } catch (e) {
      console.error(e);
      const view = document.getElementById('view');
      if (view) view.innerHTML = '<div class="card"><h3>Error</h3><p class="muted">' + (e.message || '') + '</p></div>';
    }
  },

  renderHomeOrLogin(route) {
    // If user tried to access recruiter route without login → show old login page
    if (route === 'login' || route === 'login-recruiter') {
      this.renderRecruiterLogin();
      return;
    }
    // Otherwise show the new homepage
    if (typeof Portal !== 'undefined') {
      Portal.homePage();
    }
  },

  handleRecruiterLogin() {
    this.renderRecruiterLogin();
  },

  renderRecruiterLogin() {
    const view = document.getElementById('view');
    view.innerHTML =
      '<div class="login-wrap">' +
        '<h1>Recruiter Login</h1>' +
        '<input id="l-username" placeholder="Username" />' +
        '<input id="l-password" type="password" placeholder="Password" style="margin-top:8px;" />' +
        '<button class="btn" style="margin-top:12px;width:100%;" id="l-submit">Login</button>' +
        '<p class="muted" style="text-align:center;margin-top:10px;">Default: admin / admin123</p>' +
        '<p class="muted" style="text-align:center;margin-top:6px;"><a href="#home">← Back to Home</a></p>' +
      '</div>';

    document.getElementById('l-submit').onclick = async () => {
      const u = document.getElementById('l-username').value;
      const p = document.getElementById('l-password').value;
      try {
        await Auth.login(u, p);
        Router.go('dashboard');
      } catch (err) { Toast.error('Login failed'); }
    };
  },

  async init() {
    await Auth.refresh();
    if (typeof Portal !== 'undefined') {
      await Portal.refresh();
    }
    window.addEventListener('hashchange', () => this.handle());
    if (!location.hash) location.hash = '#home';
    this.handle();
  },
};

function statusClass(s) {
  if (s === 'Strong Match') return 'badge-strong';
  if (s === 'Potential Match') return 'badge-potential';
  if (s === 'Needs Review') return 'badge-review';
  return 'badge-low';
}





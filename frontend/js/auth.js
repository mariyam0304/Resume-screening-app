const Auth = {
  user: null,
  async refresh() {
    try { this.user = await API.me(); } catch (e) { this.user = null; }
    AuthUI.render();
  },
  async login(username, password) {
    await API.login({ username, password });
    await this.refresh();
  },
  async register(username, email, password) {
    await API.register({ username, email, password });
    await this.login(username, password);
  },
  async logout() {
    if (!confirm('Log out?')) return;
    try { await API.logout(); } catch (e) {}
    this.user = null;
    AuthUI.render();
    location.hash = '#home';
    if (typeof Router !== 'undefined') Router.handle();
  },
};

const AuthUI = {
  render() {
    const label = document.getElementById('user-label');
    const btn = document.getElementById('logout-btn');
    const nav = document.getElementById('main-nav');

    if (Auth.user) {
      label.textContent = 'Recruiter: ' + Auth.user.username;
      btn.hidden = false;
      btn.onclick = () => Auth.logout();
      const links = [
        ['dashboard', 'Dashboard'],
        ['create-jd', 'Create JD'],
        ['saved-jds', 'Saved JDs'],
        ['upload', 'Upload'],
        ['screening', 'Screening'],
        ['database', 'Candidates'],
        ['compare', 'Compare'],
        ['leaderboard', '🏆 Leaderboard'],
        ['jd-funnel', '📈 JD Funnel'],
        ['questions', 'Questions'],
        ['applications-inbox', 'Inbox'],
      ];
      nav.innerHTML = links.map(([r, text]) =>
        '<a href="#' + r + '" data-route="' + r + '">' + text + '</a>'
      ).join('');
    } else if (typeof Portal !== 'undefined' && Portal.user) {
      // Candidate nav handled in PortalUI, but ensure a bell icon exists
      // PortalUI.render() will populate
    } else {
      label.textContent = '';
      btn.hidden = true;
      btn.onclick = null;
      nav.innerHTML = '';
    }
  },
};


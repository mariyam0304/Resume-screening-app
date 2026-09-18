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
    if (!confirm('Log out of SmartHire AI?')) return;
    try { await API.logout(); } catch (e) {}
    this.user = null;
    AuthUI.render();
    location.hash = '#dashboard';
    // Force re-render
    if (typeof Router !== 'undefined') Router.handle();
  },
};

const AuthUI = {
  render() {
    const label = document.getElementById('user-label');
    const btn = document.getElementById('logout-btn');
    const nav = document.getElementById('main-nav');

    if (Auth.user) {
      label.textContent = 'User: ' + Auth.user.username;
      btn.hidden = false;
      btn.onclick = () => Auth.logout();   // direct binding — reliable
      const links = [
        ['dashboard', 'Dashboard'],
        ['analytics', 'Analytics'],
        ['search', 'Search'],
        ['create-jd', 'Create JD'],
        ['templates', 'Templates'],
        ['saved-jds', 'Saved JDs'],
        ['upload', 'Upload'],
        ['screening', 'Screening'],
        ['database', 'Candidates'],
        ['compare', 'Compare'],
        ['questions', 'Questions'],
        ['interviews', 'Interviews'],
        ['email', 'Email'],
      ];
      nav.innerHTML = links.map(([r, label]) =>
        '<a href="#' + r + '" data-route="' + r + '">' + label + '</a>'
      ).join('');
    } else {
      label.textContent = '';
      btn.hidden = true;
      btn.onclick = null;
      nav.innerHTML = '';
    }
  },
};

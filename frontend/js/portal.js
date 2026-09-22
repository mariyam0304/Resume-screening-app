// ============================================================
// SmartHire AI - Candidate Portal (Phases 2, 3, 4 - No Bell)
// ============================================================

const Portal = {
  user: null,

  // ============================================================
  // AUTH HELPERS
  // ============================================================
  async refresh() {
    try {
      this.user = await PortalAPI.me();
    } catch (e) {
      this.user = null;
    }
    PortalUI.render();
  },

  async login(username, password) {
    await PortalAPI.login({ username: username, password: password });
    await this.refresh();
  },

  async register(data) {
    await PortalAPI.register(data);
    await this.refresh();
  },

  async logout() {
    if (!confirm('Log out?')) return;
    try { await PortalAPI.logout(); } catch (e) {}
    this.user = null;
    PortalUI.render();
    location.hash = '#home';
  },

  // ============================================================
  // HOME PAGE
  // ============================================================
  async homePage() {
    const view = document.getElementById('view');

    let openJobs = 0;
    try {
      const res = await fetch('/api/portal/jobs');
      if (res.ok) {
        const data = await res.json();
        openJobs = Array.isArray(data) ? data.length : 0;
      }
    } catch (e) {}

    view.innerHTML =
      '<div style="text-align:center;padding:60px 20px;">' +
        '<h1 style="font-size:42px;margin-bottom:10px;">🧠 SmartHire AI</h1>' +
        '<p class="muted" style="font-size:18px;margin-bottom:40px;">Find your dream job. Hire your dream team.</p>' +

        '<div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin-bottom:50px;">' +
          '<div class="card" style="max-width:300px;text-align:center;padding:30px;">' +
            '<div style="font-size:44px;margin-bottom:10px;">🧑‍💼</div>' +
            '<h2 style="margin-bottom:8px;">I\'m a Recruiter</h2>' +
            '<p class="muted" style="font-size:13px;margin-bottom:16px;">Post jobs, screen resumes, hire faster.</p>' +
            '<button class="btn" onclick="Router.go(\'login-recruiter\')">Login</button>' +
            '<button class="btn btn-outline" onclick="Router.go(\'recruiter-register\')" style="margin-left:6px;">Register</button>' +
          '</div>' +

          '<div class="card" style="max-width:300px;text-align:center;padding:30px;">' +
            '<div style="font-size:44px;margin-bottom:10px;">🎓</div>' +
            '<h2 style="margin-bottom:8px;">I\'m a Candidate</h2>' +
            '<p class="muted" style="font-size:13px;margin-bottom:16px;">Register, upload your resume, apply to jobs.</p>' +
            '<button class="btn" onclick="Router.go(\'candidate-login\')">Login</button>' +
            '<button class="btn btn-outline" onclick="Router.go(\'candidate-register\')" style="margin-left:6px;">Register</button>' +
          '</div>' +
        '</div>' +

        '<div class="card" style="max-width:700px;margin:0 auto;text-align:left;">' +
          '<h3 style="margin-top:0;">Open Positions</h3>' +
          (openJobs > 0
            ? '<p>' + openJobs + ' job(s) available. <a href="#candidate-login">Login as candidate</a> to view and apply.</p>'
            : '<p class="muted">No jobs posted yet. Check back soon.</p>') +
        '</div>' +
      '</div>';
  },

  // ============================================================
  // RECRUITER REGISTER
  // ============================================================
  async recruiterRegisterPage() {
    const view = document.getElementById('view');
    view.innerHTML =
      '<div class="login-wrap">' +
        '<h1>Recruiter Registration</h1>' +
        '<input id="rr-username" placeholder="Username" />' +
        '<input id="rr-email" type="email" placeholder="Email" style="margin-top:8px;" />' +
        '<input id="rr-password" type="password" placeholder="Password (min 6)" style="margin-top:8px;" />' +
        '<input id="rr-password2" type="password" placeholder="Confirm Password" style="margin-top:8px;" />' +
        '<button class="btn" style="margin-top:14px;width:100%;" onclick="Portal.doRecruiterRegister()">Register</button>' +
        '<p class="muted" style="text-align:center;margin-top:12px;">Already registered? <a href="#login-recruiter">Login</a></p>' +
        '<p class="muted" style="text-align:center;margin-top:6px;"><a href="#home">← Back to Home</a></p>' +
      '</div>';
  },

  async doRecruiterRegister() {
    const username = document.getElementById('rr-username').value.trim();
    const email = document.getElementById('rr-email').value.trim();
    const password = document.getElementById('rr-password').value;
    const password2 = document.getElementById('rr-password2').value;

    if (!username || !email || !password) { Toast.warn('All fields are required'); return; }
    if (password !== password2) { Toast.warn('Passwords do not match'); return; }
    if (password.length < 6) { Toast.warn('Password must be at least 6 characters'); return; }

    try {
      await Auth.register(username, email, password);
      Toast.success('Welcome! You are now logged in.');
      Router.go('dashboard');
    } catch (e) {
      const msg = (e.data && e.data.error) ? e.data.error : 'Registration failed';
      Toast.error(msg);
    }
  },

  // ============================================================
  // CANDIDATE REGISTER
  // ============================================================
  async registerPage() {
    const view = document.getElementById('view');
    view.innerHTML =
      '<div class="login-wrap">' +
        '<h1>Candidate Registration</h1>' +
        '<input id="reg-name" placeholder="Full Name" />' +
        '<input id="reg-username" placeholder="Username" style="margin-top:8px;" />' +
        '<input id="reg-email" type="email" placeholder="Email" style="margin-top:8px;" />' +
        '<input id="reg-password" type="password" placeholder="Password (min 6)" style="margin-top:8px;" />' +
        '<input id="reg-phone" placeholder="Phone (optional)" style="margin-top:8px;" />' +
        '<input id="reg-location" placeholder="Location (optional)" style="margin-top:8px;" />' +
        '<button class="btn" style="margin-top:14px;width:100%;" onclick="Portal.doRegister()">Register</button>' +
        '<p class="muted" style="text-align:center;margin-top:12px;">Already registered? <a href="#candidate-login">Login</a></p>' +
        '<p class="muted" style="text-align:center;margin-top:6px;"><a href="#home">← Back to Home</a></p>' +
      '</div>';
  },

  async doRegister() {
    const data = {
      full_name: document.getElementById('reg-name').value.trim(),
      username: document.getElementById('reg-username').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      phone: document.getElementById('reg-phone').value.trim(),
      location: document.getElementById('reg-location').value.trim()
    };
    if (!data.username || !data.email || !data.password) {
      Toast.warn('Username, email, and password required');
      return;
    }
    try {
      await this.register(data);
      Toast.success('Welcome!');
      Router.go('candidate-dashboard');
    } catch (e) {
      Toast.error((e.data && e.data.error) || 'Registration failed');
    }
  },

  // ============================================================
  // CANDIDATE LOGIN
  // ============================================================
  async loginPage() {
    const view = document.getElementById('view');
    view.innerHTML =
      '<div class="login-wrap">' +
        '<h1>Candidate Login</h1>' +
        '<input id="cli-username" placeholder="Username" />' +
        '<input id="cli-password" type="password" placeholder="Password" style="margin-top:8px;" />' +
        '<button class="btn" style="margin-top:14px;width:100%;" onclick="Portal.doLogin()">Login</button>' +
        '<p class="muted" style="text-align:center;margin-top:12px;">New here? <a href="#candidate-register">Register</a></p>' +
        '<p class="muted" style="text-align:center;margin-top:6px;"><a href="#home">← Back to Home</a></p>' +
      '</div>';
  },

  async doLogin() {
    const u = document.getElementById('cli-username').value.trim();
    const p = document.getElementById('cli-password').value;
    if (!u || !p) { Toast.warn('Enter username and password'); return; }
    try {
      await this.login(u, p);
      Toast.success('Welcome back!');
      Router.go('candidate-dashboard');
    } catch (e) {
      Toast.error('Invalid credentials');
    }
  },

  // ============================================================
  // CANDIDATE DASHBOARD
  // ============================================================
  async dashboardPage() {
    if (!this.user) { Router.go('candidate-login'); return; }
    const view = document.getElementById('view');

    let apps = [];
    try { apps = await PortalAPI.myApplications(); } catch (e) {}

    let recommended = [];
    try {
      const r = await fetch('/api/portal/recommended-jobs');
      if (r.ok) recommended = await r.json();
    } catch (e) {}

    let strength = 0;
    if (this.user.full_name) strength += 15;
    if (this.user.phone) strength += 10;
    if (this.user.location) strength += 10;
    if (this.user.education) strength += 15;
    if (this.user.experience_years > 0) strength += 20;
    if (this.user.skills_summary) strength += 15;
    if (this.user.has_resume) strength += 15;

    let recHTML = '<p class="muted">Add skills to your profile to get job recommendations.</p>';
    if (Array.isArray(recommended) && recommended.length > 0) {
      recHTML = recommended.map(function(j) {
        return '<div class="card" style="padding:14px;margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">' +
            '<div style="flex:1;">' +
              '<h3 style="margin:0;">' + j.title + '</h3>' +
              '<div class="muted" style="font-size:12px;margin-top:2px;">' + (j.location || '') +
                ' · ' + j.min_experience + '+ years</div>' +
            '</div>' +
            '<div style="text-align:right;">' +
              '<div style="font-size:20px;font-weight:800;color:var(--primary-dark);">' + j.match_percent + '%</div>' +
              '<div class="muted" style="font-size:11px;">match</div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:8px;">' +
            (j.matched_skills || []).map(function(s){ return '<span class="chip chip-green">✓ ' + s + '</span>'; }).join('') +
          '</div>' +
          '<a class="btn btn-outline" href="#job-detail?id=' + j.jd_id + '" style="margin-top:10px;">View & Apply</a>' +
        '</div>';
      }).join('');
    }

    view.innerHTML =
      '<h1>Welcome, ' + (this.user.full_name || this.user.username) + ' 👋</h1>' +
      '<div class="grid" style="margin-bottom:20px;">' +
        '<div class="stat"><div class="label">Profile Strength</div><div class="value">' + strength + '%</div>' +
          '<div class="progress" style="margin-top:10px;"><span style="width:' + strength + '%"></span></div>' +
        '</div>' +
        '<div class="stat"><div class="label">Applications</div><div class="value">' + apps.length + '</div></div>' +
        '<div class="stat"><div class="label">Resume</div><div class="value">' + (this.user.has_resume ? '✓' : '—') + '</div></div>' +
      '</div>' +

      '<div id="my-interviews-section"></div>' +

      '<div class="card">' +
        '<h2>Quick Actions</h2>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
          '<a class="btn" href="#candidate-profile">Update Profile</a>' +
          '<a class="btn btn-outline" href="#candidate-applications">My Applications</a>' +
          '<a class="btn btn-outline" href="#browse-jobs">Browse Jobs</a>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<h2>⭐ Recommended Jobs</h2>' + recHTML +
      '</div>' +

      '<div class="card">' +
        '<h2>Recent Applications</h2>' +
        (apps.length === 0
          ? '<p class="muted">No applications yet. Browse jobs and apply!</p>'
          : '<table><thead><tr><th>Job</th><th>Status</th><th>Applied</th></tr></thead><tbody>' +
            apps.slice(0, 5).map(function(a){
              return '<tr><td>' + a.jd_title + '</td><td>' + a.status + '</td><td class="muted">' + (a.applied_at || '').slice(0,10) + '</td></tr>';
            }).join('') + '</tbody></table>') +
      '</div>';

    // ===== Load upcoming interviews =====
    setTimeout(async () => {
      try {
        const r = await fetch('/api/portal/interview/my');
        const interviews = await r.json();
        const el = document.getElementById('my-interviews-section');
        if (!el) return;
        if (!interviews || interviews.length === 0) { el.innerHTML = ''; return; }
        el.innerHTML =
          '<div class="card">' +
            '<h2>📅 Upcoming Interviews</h2>' +
            interviews.map(function(i){
              return '<div class="card" style="padding:14px;margin-bottom:10px;border-left:4px solid var(--primary);">' +
                '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:flex-start;">' +
                  '<div style="flex:1;min-width:200px;">' +
                    '<strong style="font-size:15px;">' + i.jd_title + '</strong>' +
                    '<div class="muted" style="font-size:12px;margin-top:4px;">📅 ' + i.scheduled_at + '</div>' +
                    '<div class="muted" style="font-size:12px;">⏱ ' + i.duration_minutes + ' min · ' + i.mode + '</div>' +
                    (i.interviewer_name ? '<div class="muted" style="font-size:12px;">👤 ' + i.interviewer_name + '</div>' : '') +
                    (i.notes ? '<div class="muted" style="font-size:12px;margin-top:4px;">📝 ' + i.notes + '</div>' : '') +
                  '</div>' +
                  '<div>' +
                    (i.meeting_link ? '<a class="btn" href="' + i.meeting_link + '" target="_blank" rel="noopener">🔗 Join Meeting</a>' : '') +
                  '</div>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>';
      } catch (e) { console.warn('Interview load failed:', e); }
    }, 150);
  },

  // ============================================================
  // CANDIDATE PROFILE
  // ============================================================
  async profilePage() {
    if (!this.user) { Router.go('candidate-login'); return; }
    const view = document.getElementById('view');

    view.innerHTML =
      '<h1>My Profile</h1>' +
      '<div class="card">' +
        '<div class="row">' +
          '<div><label>Full Name</label><input id="p-name" value="' + (this.user.full_name || '') + '" /></div>' +
          '<div><label>Phone</label><input id="p-phone" value="' + (this.user.phone || '') + '" /></div>' +
        '</div>' +
        '<div class="row" style="margin-top:10px;">' +
          '<div><label>Location</label><input id="p-location" value="' + (this.user.location || '') + '" /></div>' +
          '<div><label>Experience (years)</label><input id="p-exp" type="number" step="0.5" value="' + (this.user.experience_years || 0) + '" /></div>' +
        '</div>' +
        '<div style="margin-top:10px;">' +
          '<label>Education</label>' +
          '<input id="p-edu" value="' + (this.user.education || '') + '" placeholder="e.g. B.Com from Osmania University" />' +
        '</div>' +
        '<div style="margin-top:10px;">' +
          '<label>Skills (comma separated)</label>' +
          '<textarea id="p-skills" style="min-height:80px;" placeholder="Java, Spring, SQL, Communication">' + (this.user.skills_summary || '') + '</textarea>' +
        '</div>' +
        '<button class="btn" style="margin-top:14px;" onclick="Portal.saveProfile()">Save Profile</button>' +
      '</div>' +

      '<div class="card">' +
        '<h2>Resume</h2>' +
        (this.user.has_resume
          ? '<p><strong>Current:</strong> ' + (this.user.resume_filename || 'resume') + '</p>' +
            '<button class="btn btn-outline" onclick="PortalAPI.downloadResume()">Download</button>' +
            '<p class="muted" style="margin-top:10px;">Uploading a new file will replace the current resume.</p>'
          : '<p class="muted">No resume uploaded yet.</p>') +
        '<div style="margin-top:14px;">' +
          '<label>Upload Resume (PDF, DOCX, DOC, TXT — max 10MB)</label>' +
          '<input type="file" id="p-resume" accept=".pdf,.docx,.doc,.txt" />' +
          '<button class="btn" style="margin-top:10px;" onclick="Portal.uploadResume()">Upload</button>' +
        '</div>' +
      '</div>' +

      '<div style="text-align:center;margin-top:20px;">' +
        '<a class="btn btn-outline" href="#candidate-dashboard">← Back to Dashboard</a>' +
      '</div>';
  },

  async saveProfile() {
    const data = {
      full_name: document.getElementById('p-name').value.trim(),
      phone: document.getElementById('p-phone').value.trim(),
      location: document.getElementById('p-location').value.trim(),
      experience_years: document.getElementById('p-exp').value,
      education: document.getElementById('p-edu').value.trim(),
      skills_summary: document.getElementById('p-skills').value.trim()
    };
    try {
      await PortalAPI.updateProfile(data);
      Toast.success('Profile saved');
      await this.refresh();
    } catch (e) {
      Toast.error('Failed to save');
    }
  },

  async uploadResume() {
    const input = document.getElementById('p-resume');
    if (!input.files[0]) { Toast.warn('Choose a file first'); return; }
    const fd = new FormData();
    fd.append('file', input.files[0]);
    try {
      await PortalAPI.uploadResume(fd);
      Toast.success('Resume uploaded');
      await this.refresh();
      this.profilePage();
    } catch (e) {
      Toast.error((e.data && e.data.error) || 'Upload failed');
    }
  },

  // ============================================================
  // MY APPLICATIONS
  // ============================================================
  async applicationsPage() {
    if (!this.user) { Router.go('candidate-login'); return; }
    const view = document.getElementById('view');

    let apps = [];
    try { apps = await PortalAPI.myApplications(); } catch (e) {}

    view.innerHTML =
      '<h1>My Applications</h1>' +
      '<div class="card">' +
        (apps.length === 0
          ? '<p class="muted">No applications yet. <a href="#browse-jobs">Browse open jobs →</a></p>'
          : '<table><thead><tr><th>Job Title</th><th>Status</th><th>Applied On</th></tr></thead><tbody>' +
            apps.map(function(a){
              return '<tr>' +
                '<td>' + a.jd_title + '</td>' +
                '<td><span class="badge badge-review">' + a.status + '</span></td>' +
                '<td class="muted">' + (a.applied_at || '').slice(0, 10) + '</td>' +
              '</tr>';
            }).join('') + '</tbody></table>') +
      '</div>' +
      '<a class="btn btn-outline" href="#candidate-dashboard">← Back</a>';
  },

  // ============================================================
  // BROWSE JOBS
  // ============================================================
  async browseJobsPage() {
    const view = document.getElementById('view');
    view.innerHTML = '<h1>Browse Jobs</h1><p class="muted">Loading...</p>';

    let jobs = [];
    try {
      const res = await fetch('/api/portal/jobs');
      if (res.ok) jobs = await res.json();
    } catch (e) {}

    let myApps = [];
    if (this.user) {
      try { myApps = await PortalAPI.myApplications(); } catch (e) {}
    }
    const appliedJdIds = new Set(myApps.map(function(a){ return a.jd_id; }));

    const listHTML = jobs.length === 0
      ? '<div class="card"><p class="muted">No jobs posted yet. Check back soon.</p></div>'
      : jobs.map((j) => this._jobCardHTML(j, appliedJdIds.has(j.id))).join('');

    view.innerHTML =
      '<h1>Browse Jobs (' + jobs.length + ')</h1>' +
      '<div class="card">' +
        '<div class="row">' +
          '<input id="job-search" placeholder="Search title, skill, or location..." />' +
          '<input id="job-min-exp" type="number" placeholder="Min experience" style="max-width:200px;" />' +
        '</div>' +
      '</div>' +
      '<div id="jobs-list">' + listHTML + '</div>' +
      '<a class="btn btn-outline" href="#candidate-dashboard">← Back to Dashboard</a>';

    const applyFilter = () => {
      const q = document.getElementById('job-search').value.toLowerCase().trim();
      const minExp = parseFloat(document.getElementById('job-min-exp').value) || 0;
      document.querySelectorAll('.job-card').forEach(card => {
        const text = card.dataset.search;
        const exp = parseFloat(card.dataset.exp) || 0;
        card.style.display = (!q || text.indexOf(q) !== -1) && exp >= minExp ? '' : 'none';
      });
    };
    document.getElementById('job-search').oninput = applyFilter;
    document.getElementById('job-min-exp').oninput = applyFilter;
  },

  _jobCardHTML(j, alreadyApplied) {
    const search = ((j.title || '') + ' ' + (j.location || '') + ' ' +
                     (j.required_skills || []).join(' ') + ' ' + (j.domain || '')).toLowerCase();
    const skillsHTML =
      (j.required_skills || []).map(function(s){ return '<span class="chip chip-green">' + s + '</span>'; }).join('') +
      (j.preferred_skills || []).map(function(s){ return '<span class="chip">' + s + '</span>'; }).join('');

    return '<div class="card job-card" data-search="' + search + '" data-exp="' + (j.min_experience || 0) + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">' +
        '<div style="flex:1;">' +
          '<h2 style="margin:0 0 6px;">' + j.title + '</h2>' +
          '<div class="muted" style="font-size:13px;">' +
            (j.location || 'Any location') + ' · ' + (j.work_mode || 'On-site') +
            ' · ' + (j.min_experience || 0) + '-' + (j.max_experience || '?') + ' yrs' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:12px;">' + skillsHTML + '</div>' +
      '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn btn-outline" onclick="Router.go(\'job-detail\', {id:' + j.id + '})">View Details</button>' +
        (alreadyApplied
          ? '<span class="badge badge-potential" style="padding:8px 14px;">✓ Applied</span>'
          : '<button class="btn" onclick="Portal.quickApply(' + j.id + ', \'' + (j.title || '').replace(/'/g, "\\'") + '\')">Apply Now</button>') +
      '</div>' +
    '</div>';
  },

  async jobDetailPage(query) {
    const jdId = parseInt(query && query.id);
    if (!jdId) { Router.go('browse-jobs'); return; }
    const view = document.getElementById('view');
    view.innerHTML = '<h1>Loading...</h1>';

    let jd = null;
    try {
      const res = await fetch('/api/portal/jobs/' + jdId);
      jd = await res.json();
    } catch (e) { view.innerHTML = '<div class="card">Failed to load job.</div>'; return; }

    let alreadyApplied = false;
    if (this.user) {
      try {
        const apps = await PortalAPI.myApplications();
        alreadyApplied = apps.some(a => a.jd_id === jdId);
      } catch (e) {}
    }

    const applyBlock = alreadyApplied
      ? '<p><strong>You have already applied to this job.</strong></p>' +
        '<a class="btn btn-outline" href="#candidate-applications">View My Applications</a>'
      : (this.user
          ? '<label>Cover Note (optional)</label>' +
            '<textarea id="cover-note" style="min-height:100px;" placeholder="Why are you a good fit?"></textarea>' +
            '<button class="btn" style="margin-top:12px;" onclick="Portal.applyToJob(' + jd.id + ', \'' + (jd.title || '').replace(/'/g, "\\'") + '\')">Apply Now</button>'
          : '<p class="muted">Please <a href="#candidate-login">log in</a> as a candidate to apply.</p>');

    view.innerHTML =
      '<h1>' + jd.title + '</h1>' +
      '<div class="card">' +
        '<p><strong>Location:</strong> ' + (jd.location || '-') +
          ' | <strong>Mode:</strong> ' + (jd.work_mode || '-') +
          ' | <strong>Domain:</strong> ' + (jd.domain || '-') + '</p>' +
        '<p><strong>Experience:</strong> ' + (jd.min_experience || 0) + '-' + (jd.max_experience || '?') + ' years' +
          ' | <strong>Notice:</strong> ' + (jd.notice_period || '-') + '</p>' +
        '<p><strong>Education:</strong> ' + (jd.education || '-') + ' | <strong>Salary:</strong> ' + (jd.salary || '-') + '</p>' +
      '</div>' +
      '<div class="card">' +
        '<h3>Required Skills</h3>' +
        '<div>' + (jd.required_skills || []).map(function(s){ return '<span class="chip chip-green">' + s + '</span>'; }).join('') + '</div>' +
        '<h3>Preferred Skills</h3>' +
        '<div>' + (jd.preferred_skills || []).map(function(s){ return '<span class="chip">' + s + '</span>'; }).join('') + '</div>' +
        '<h3>Responsibilities</h3>' +
        '<ul>' + (jd.responsibilities || []).map(function(r){ return '<li>' + r + '</li>'; }).join('') + '</ul>' +
      '</div>' +
      '<div class="card">' + applyBlock + '</div>' +
      '<a class="btn btn-outline" href="#browse-jobs">← Back to Jobs</a>';
  },

  async quickApply(jdId, jdTitle) {
    if (!this.user) { Router.go('candidate-login'); return; }
    if (!this.user.has_resume) {
      alert('Please upload a resume in your profile first.');
      Router.go('candidate-profile');
      return;
    }
    if (!confirm('Apply to "' + jdTitle + '"?')) return;
    try {
      const res = await fetch('/api/portal/apply/' + jdId, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_note: '' })
      });
      const data = await res.json();
      if (!res.ok) { Toast.error(data.error || 'Apply failed'); return; }
      Toast.success('Applied! Match score: ' + data.match_score + '%');
      this.browseJobsPage();
    } catch (e) { Toast.error('Apply failed'); }
  },

  async applyToJob(jdId, jdTitle) {
    const noteEl = document.getElementById('cover-note');
    const note = noteEl ? noteEl.value : '';
    if (!confirm('Apply to "' + jdTitle + '"?')) return;
    try {
      const res = await fetch('/api/portal/apply/' + jdId, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_note: note })
      });
      const data = await res.json();
      if (!res.ok) { Toast.error(data.error || 'Apply failed'); return; }
      Toast.success('Applied! Match score: ' + data.match_score + '%');
      Router.go('candidate-applications');
    } catch (e) { Toast.error('Apply failed'); }
  },
};

// ============================================================
// PORTAL UI (nav rendering for candidates - no notification bell)
// ============================================================
const PortalUI = {
  async render() {
    const nav = document.getElementById('main-nav');
    const label = document.getElementById('user-label');
    const logoutBtn = document.getElementById('logout-btn');

    if (Portal.user) {
      label.innerHTML = '🎓 ' + (Portal.user.full_name || Portal.user.username);

      logoutBtn.hidden = false;
      logoutBtn.onclick = () => Portal.logout();

      nav.innerHTML =
        '<a href="#candidate-dashboard" data-route="candidate-dashboard">Dashboard</a>' +
        '<a href="#candidate-profile" data-route="candidate-profile">Profile</a>' +
        '<a href="#browse-jobs" data-route="browse-jobs">Browse Jobs</a>' +
        '<a href="#candidate-applications" data-route="candidate-applications">Applications</a>';
    }
  }
};

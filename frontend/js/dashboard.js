const Dashboard = {
  charts: {},
  async render() {
    const view = document.getElementById('view');
    view.innerHTML = '<h1>Loading dashboard...</h1>';

    // Fetch counts
    let counts = { per_jd: [], total_applications: 0, total_shortlisted: 0 };
    try {
      const r = await fetch('/api/portal/recruiter/dashboard-counts');
      if (r.ok) counts = await r.json();
    } catch (e) {}

    try {
      const [jds, candidates] = await Promise.all([API.listJDs(), API.listCandidates()]);
      let allResults = [];
      for (const jd of jds) {
        try {
          const r = await API.getResults(jd.id);
          allResults = allResults.concat(r.map(x => Object.assign({}, x, { jd_id: jd.id, jd_title: jd.title })));
        } catch (e) {}
      }
      const strong = allResults.filter(r => r.status === 'Strong Match').length;
      const potential = allResults.filter(r => r.status === 'Potential Match').length;
      const review = allResults.filter(r => r.status === 'Needs Review').length;
      const low = allResults.filter(r => r.status === 'Low Match').length;
      const shortlisted = candidates.filter(c => c.is_shortlisted).length;

      view.innerHTML =
        '<h1>Recruiter Dashboard</h1>' +
        '<div class="grid">' +
          '<div class="stat"><div class="label">JDs Uploaded</div><div class="value">' + jds.length + '</div></div>' +
          '<div class="stat"><div class="label">Candidates</div><div class="value">' + candidates.length + '</div></div>' +
          '<div class="stat"><div class="label">Applications Received</div><div class="value">' + counts.total_applications + '</div></div>' +
          '<div class="stat"><div class="label">Shortlisted</div><div class="value">' + counts.total_shortlisted + '</div></div>' +
          '<div class="stat"><div class="label">Strong Match</div><div class="value">' + strong + '</div></div>' +
          '<div class="stat"><div class="label">Potential</div><div class="value">' + potential + '</div></div>' +
          '<div class="stat"><div class="label">Needs Review</div><div class="value">' + review + '</div></div>' +
          '<div class="stat"><div class="label">Low Match</div><div class="value">' + low + '</div></div>' +
        '</div>' +

        (counts.per_jd && counts.per_jd.length > 0
          ? '<div class="card" style="margin-top:20px;">' +
              '<h2>Applications by JD</h2>' +
              '<table><thead><tr>' +
                '<th>Job</th><th>Applications</th><th>Shortlisted</th><th>New Today</th><th></th>' +
              '</tr></thead><tbody>' +
              counts.per_jd.map(j =>
                '<tr>' +
                  '<td><strong>' + j.title + '</strong></td>' +
                  '<td>' + j.application_count + '</td>' +
                  '<td>' + j.shortlisted_count + '</td>' +
                  '<td>' + (j.new_today > 0 ? '<span class="badge badge-strong">+' + j.new_today + '</span>' : '—') + '</td>' +
                  '<td><a class="btn btn-outline" href="#applications-inbox?jd=' + j.jd_id + '">View Inbox</a></td>' +
                '</tr>'
              ).join('') + '</tbody></table>' +
            '</div>'
          : '') +

        '<div class="chart-grid" style="margin-top:20px;">' +
          '<div class="chart-card"><h3>Match Status Distribution</h3><canvas id="dashStatusChart" height="240"></canvas></div>' +
          '<div class="chart-card"><h3>Score Buckets</h3><canvas id="dashScoreChart" height="240"></canvas></div>' +
        '</div>' +

        '<div class="card" style="margin-top:20px;">' +
          '<h2>Recent Screening Results</h2>' +
          (allResults.length === 0
            ? '<p class="muted">No screening yet.</p>'
            : '<table><thead><tr><th>Candidate</th><th>JD</th><th>Match</th><th>Status</th></tr></thead><tbody>' +
              allResults.slice(0, 10).map(r =>
                '<tr>' +
                  '<td>' + (r.name || '-') + '</td>' +
                  '<td>' + (r.jd_title || '-') + '</td>' +
                  '<td><strong>' + r.overall_score + '%</strong></td>' +
                  '<td><span class="badge ' + statusClass(r.status) + '">' + r.status + '</span></td>' +
                '</tr>'
              ).join('') + '</tbody></table>') +
        '</div>';

      // Charts
      Object.values(this.charts).forEach(c => c && c.destroy && c.destroy());
      this.charts = {};

      const ctx1 = document.getElementById('dashStatusChart');
      if (ctx1 && typeof Chart !== 'undefined') {
        this.charts.status = new Chart(ctx1, {
          type: 'doughnut',
          data: {
            labels: ['Strong', 'Potential', 'Needs Review', 'Low Match'],
            datasets: [{ data: [strong, potential, review, low],
              backgroundColor: ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444'], borderWidth: 0 }]
          },
          options: { plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false }
        });
      }
      const ctx2 = document.getElementById('dashScoreChart');
      if (ctx2 && typeof Chart !== 'undefined') {
        const buckets = {'0-20':0,'21-40':0,'41-60':0,'61-80':0,'81-100':0};
        allResults.forEach(r => {
          const s = r.overall_score || 0;
          if (s <= 20) buckets['0-20']++;
          else if (s <= 40) buckets['21-40']++;
          else if (s <= 60) buckets['41-60']++;
          else if (s <= 80) buckets['61-80']++;
          else buckets['81-100']++;
        });
        this.charts.score = new Chart(ctx2, {
          type: 'bar',
          data: { labels: Object.keys(buckets),
            datasets: [{ label: 'Candidates', data: Object.values(buckets), backgroundColor: '#8b5cf6', borderRadius: 8 }] },
          options: { plugins: { legend: { display: false } }, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
      }
    } catch (e) {
      view.innerHTML = '<div class="card"><p>Login as recruiter to view dashboard.</p></div>';
    }
  }
};
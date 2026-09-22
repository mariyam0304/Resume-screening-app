// ============================================================
// JD Performance Funnel
// ============================================================
const JDFunnel = {
  async view(query) {
    const jdId = parseInt(query && query.jd);
    const view = document.getElementById('view');

    if (!jdId) {
      const jds = await API.listJDs();
      view.innerHTML =
        '<h1>📈 JD Performance</h1>' +
        '<div class="card">' +
          (jds.length === 0
            ? '<p class="muted">No JDs yet.</p>'
            : '<table><thead><tr><th>JD</th><th>Location</th><th></th></tr></thead><tbody>' +
              jds.map(j =>
                '<tr><td>' + j.title + '</td><td>' + (j.location || '-') + '</td>' +
                '<td><button class="btn" onclick="Router.go(\'jd-funnel\', {jd:' + j.id + '})">View</button></td></tr>'
              ).join('') + '</tbody></table>') +
        '</div>';
      return;
    }

    view.innerHTML = '<h1>Loading...</h1>';

    let data = null;
    try {
      const res = await fetch('/api/portal/recruiter/jd-funnel/' + jdId);
      data = await res.json();
    } catch (e) {}

    if (!data || data.error) {
      view.innerHTML = '<div class="card">Failed to load.</div>';
      return;
    }

    const s = data.stages || {};
    const total = data.total_applications || 0;
    const pct = (n) => total ? Math.round((n / total) * 100) : 0;

    view.innerHTML =
      '<h1>📈 ' + data.jd.title + '</h1>' +
      '<p class="muted">' + (data.jd.location || '') + ' · ' + total + ' application(s)</p>' +

      '<div class="grid">' +
        '<div class="stat"><div class="label">Total Applications</div><div class="value">' + total + '</div></div>' +
        '<div class="stat"><div class="label">Avg Match Score</div><div class="value">' + data.avg_score + '%</div></div>' +
        '<div class="stat"><div class="label">Top Score</div><div class="value">' + data.top_score + '%</div></div>' +
      '</div>' +

      '<div class="card">' +
        '<h2>Hiring Funnel</h2>' +
        ['Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Rejected'].map(stage => {
          const n = s[stage] || 0;
          const color = stage === 'Rejected' ? '#ef4444' :
                        stage === 'Shortlisted' ? '#10b981' :
                        stage === 'Interview Scheduled' ? '#8b5cf6' : '#4f6ef7';
          return '<div style="margin-bottom:14px;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
              '<span><strong>' + stage + '</strong></span>' +
              '<span>' + n + ' (' + pct(n) + '%)</span>' +
            '</div>' +
            '<div style="background:#e2e8f0;height:26px;border-radius:6px;overflow:hidden;">' +
              '<div style="background:' + color + ';height:100%;width:' + pct(n) + '%;transition:width 0.6s;"></div>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +

      '<div class="card">' +
        '<h2>Required Skills Coverage</h2>' +
        '<p class="muted">How many applicants list each required skill</p>' +
        '<table><thead><tr><th>Skill</th><th>Have</th><th>Coverage</th></tr></thead><tbody>' +
          (data.required_skills_heatmap || []).map(sk => {
            const cov = sk.total ? Math.round((sk.have / sk.total) * 100) : 0;
            return '<tr>' +
              '<td>' + sk.skill + '</td>' +
              '<td>' + sk.have + ' / ' + sk.total + '</td>' +
              '<td><div class="progress"><span style="width:' + cov + '%"></span></div>' + cov + '%</td>' +
            '</tr>';
          }).join('') +
        '</tbody></table>' +
      '</div>' +

      '<a class="btn btn-outline" href="#jd-funnel">← Back to JD list</a>';
  }
};

const Dashboard = {
  async render() {
    const view = document.getElementById('view');
    view.innerHTML = '<h1>Loading dashboard...</h1>';
    try {
      const jds = await API.listJDs();
      const candidates = await API.listCandidates();
      const totalCandidates = candidates.length;
      const totalJDs = jds.length;
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

      view.innerHTML =
        '<h1>Recruiter Dashboard</h1>' +
        '<div class="grid">' +
          '<div class="stat"><div class="label">JDs Uploaded</div><div class="value">' + totalJDs + '</div></div>' +
          '<div class="stat"><div class="label">Candidates</div><div class="value">' + totalCandidates + '</div></div>' +
          '<div class="stat"><div class="label">Screened</div><div class="value">' + allResults.length + '</div></div>' +
          '<div class="stat"><div class="label">Strong</div><div class="value">' + strong + '</div></div>' +
          '<div class="stat"><div class="label">Potential</div><div class="value">' + potential + '</div></div>' +
          '<div class="stat"><div class="label">Needs Review</div><div class="value">' + review + '</div></div>' +
          '<div class="stat"><div class="label">Low Match</div><div class="value">' + low + '</div></div>' +
        '</div>' +
        '<div class="card" style="margin-top:20px;">' +
          '<h2>Recent Screening Results</h2>' +
          (allResults.length === 0
            ? '<p class="muted">No screening yet. Create a JD and upload resumes to begin.</p>'
            : '<table><thead><tr><th>Candidate</th><th>JD</th><th>Match</th><th>Status</th><th>Location</th><th>Exp</th></tr></thead><tbody>' +
              allResults.slice(0, 15).map(r =>
                '<tr>' +
                  '<td>' + (r.name || '-') + '</td>' +
                  '<td>' + (r.jd_title || '-') + '</td>' +
                  '<td><strong>' + r.overall_score + '%</strong></td>' +
                  '<td><span class="badge ' + statusClass(r.status) + '">' + r.status + '</span></td>' +
                  '<td>' + (r.location || '-') + '</td>' +
                  '<td>' + (r.experience || 0) + 'y</td>' +
                '</tr>'
              ).join('') +
              '</tbody></table>') +
        '</div>';
    } catch (e) {
      view.innerHTML = '<div class="card"><p>Please log in to view the dashboard.</p></div>';
    }
  }
};

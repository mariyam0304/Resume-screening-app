const Screening = {
  currentJdId: null,
  results: [],

  async view(query) {
    const view = document.getElementById('view');
    const jds = await API.listJDs();
    const preselect = query && query.jd ? parseInt(query.jd) : (jds[0] ? jds[0].id : '');
    view.innerHTML =
      '<h1>Screening</h1>' +
      '<div class="card">' +
        '<label>Select JD</label>' +
        '<select id="jd-select">' +
          jds.map(j => '<option value="' + j.id + '"' + (j.id === preselect ? ' selected' : '') + '>' + j.title + '</option>').join('') +
        '</select>' +
        '<div class="row" style="margin-top:12px;">' +
          '<button class="btn" id="run-btn">Run Screening on All Candidates</button>' +
          '<button class="btn btn-outline" id="questions-btn">Generate Questions</button>' +
          '<button class="btn btn-outline" id="export-csv">CSV</button>' +
          '<button class="btn btn-outline" id="export-xlsx">Excel</button>' +
          '<button class="btn btn-outline" id="export-pdf">PDF</button>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h2>Filters</h2>' +
        '<div class="row">' +
          '<input type="number" id="f-min-score" placeholder="Min Score %" />' +
          '<input type="number" id="f-min-exp" placeholder="Min Experience (yrs)" />' +
          '<input type="text" id="f-skill" placeholder="Skill contains..." />' +
          '<select id="f-status">' +
            '<option value="">All Statuses</option>' +
            '<option>Strong Match</option>' +
            '<option>Potential Match</option>' +
            '<option>Needs Review</option>' +
            '<option>Low Match</option>' +
          '</select>' +
          '<button class="btn" id="apply-filter">Apply</button>' +
        '</div>' +
      '</div>' +
      '<div id="results-area"></div>';

    document.getElementById('run-btn').onclick = () => this.run();
    document.getElementById('apply-filter').onclick = () => this.applyFilter();
    document.getElementById('questions-btn').onclick = () => Router.go('questions', { jd: document.getElementById('jd-select').value });
    document.getElementById('export-csv').onclick = () => API.exportCSV(document.getElementById('jd-select').value);
    document.getElementById('export-xlsx').onclick = () => API.exportExcel(document.getElementById('jd-select').value);
    document.getElementById('export-pdf').onclick = () => API.exportPDF(document.getElementById('jd-select').value);

    if (preselect) {
      this.currentJdId = preselect;
      await this.loadResults(preselect);
    }
  },

  async run() {
    const jdId = parseInt(document.getElementById('jd-select').value);
    this.currentJdId = jdId;
    document.getElementById('results-area').innerHTML = '<div class="card">Running screening...</div>';
    try {
      await API.runScreening({ jd_id: jdId });
      await this.loadResults(jdId);
    } catch (e) {
      document.getElementById('results-area').innerHTML = '<div class="card">Screening failed.</div>';
    }
  },

  async loadResults(jdId) {
    const data = await API.getResults(jdId);
    this.results = data;
    this.renderResults(data);
  },

  async applyFilter() {
    const jdId = parseInt(document.getElementById('jd-select').value);
    const body = {
      min_score: document.getElementById('f-min-score').value || undefined,
      min_experience: document.getElementById('f-min-exp').value || undefined,
      skill: document.getElementById('f-skill').value || undefined,
      status: document.getElementById('f-status').value || undefined,
    };
    const data = await API.filterResults(jdId, body);
    this.renderResults(data);
  },

  renderResults(rows) {
    const el = document.getElementById('results-area');
    if (!rows.length) {
      el.innerHTML = '<div class="card"><p class="muted">No results. Run screening first.</p></div>';
      return;
    }
    el.innerHTML =
      '<div class="card">' +
        '<h2>Results (' + rows.length + ')</h2>' +
        '<div style="overflow-x:auto;">' +
        '<table>' +
          '<thead><tr>' +
            '<th>Candidate</th><th>Match</th><th>Exp</th><th>Location</th><th>Notice</th><th>Status</th><th></th>' +
          '</tr></thead>' +
          '<tbody>' +
            rows.map(r =>
              '<tr>' +
                '<td>' + (r.name || '-') + '</td>' +
                '<td><strong>' + r.overall_score + '%</strong><div class="progress"><span style="width:' + r.overall_score + '%"></span></div></td>' +
                '<td>' + (r.experience || 0) + 'y</td>' +
                '<td>' + (r.location || '-') + '</td>' +
                '<td>' + (r.notice || '-') + '</td>' +
                '<td><span class="badge ' + statusClass(r.status) + '">' + r.status + '</span></td>' +
                '<td>' +
                  '<button class="btn btn-outline" onclick="Screening.showExplain(' + r.candidate_id + ')">Explain</button> ' +
                  '<a class="btn btn-outline" href="#candidate?id=' + r.candidate_id + '">Profile</a>' +
                '</td>' +
              '</tr>'
            ).join('') +
          '</tbody>' +
        '</table>' +
        '</div>' +
      '</div>';
  },

  showExplain(candidateId) {
    const r = this.results.find(x => x.candidate_id === candidateId);
    if (!r) return;
    const ex = r.explanation || {};
    const html =
      '<div class="card">' +
        '<h2>' + r.name + ' - ' + r.overall_score + '% Match</h2>' +
        '<h3>Matched Skills</h3>' +
        '<div>' + ((ex.matched_skills || []).map(s => '<span class="chip chip-green">' + s + '</span>').join('') || '<span class="muted">None</span>') + '</div>' +
        '<h3>Related Skills</h3>' +
        '<div>' + ((ex.related_skills || []).map(s => '<span class="chip">' + s.required + ' (via ' + s.matched_via + ')</span>').join('') || '<span class="muted">None</span>') + '</div>' +
        '<h3>Missing Skills</h3>' +
        '<div>' + ((ex.missing_skills || []).map(s => '<span class="chip chip-red">' + s + '</span>').join('') || '<span class="muted">None</span>') + '</div>' +
        '<h3>Additional Skills</h3>' +
        '<div>' + ((ex.extra_skills || []).slice(0, 15).map(s => '<span class="chip chip-gray">' + s + '</span>').join('') || '<span class="muted">None</span>') + '</div>' +
        '<h3>Strengths</h3>' +
        '<ul>' + ((ex.strengths || []).map(s => '<li>' + s + '</li>').join('') || '<li class="muted">None</li>') + '</ul>' +
        '<h3>Gaps / Concerns</h3>' +
        '<ul>' + ((ex.gaps || []).map(s => '<li>' + s + '</li>').join('') || '<li class="muted">None</li>') + '</ul>' +
        '<h3>Score Breakdown</h3>' +
        '<table>' +
          '<tr><td>Skills</td><td>' + r.skills_score + '%</td></tr>' +
          '<tr><td>Experience</td><td>' + r.experience_score + '%</td></tr>' +
          '<tr><td>Education</td><td>' + r.education_score + '%</td></tr>' +
          '<tr><td>Location</td><td>' + r.location_score + '%</td></tr>' +
          '<tr><td>Notice Period</td><td>' + r.notice_score + '%</td></tr>' +
          '<tr><td>Responsibilities</td><td>' + r.responsibility_score + '%</td></tr>' +
          '<tr><td>Preferred Skills</td><td>' + r.preferred_skills_score + '%</td></tr>' +
        '</table>' +
        '<button class="btn btn-outline" onclick="Screening.closeExplain()">Close</button>' +
      '</div>';
    const el = document.getElementById('results-area');
    el.insertAdjacentHTML('afterbegin', '<div id="explain-box">' + html + '</div>');
  },

  closeExplain() {
    const b = document.getElementById('explain-box');
    if (b) b.remove();
  },
};

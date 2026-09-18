const Screening = {
  currentJdId: null,
  results: [],
  weights: null,

  async view(query) {
    const view = document.getElementById('view');
    const jds = await API.listJDs();
    const preselect = query && query.jd ? parseInt(query.jd) : (jds[0] ? jds[0].id : '');

    if (!this.weights) {
      try { this.weights = await API.getWeights(); } catch (e) { this.weights = null; }
    }

    view.innerHTML =
      '<h1>Screening</h1>' +
      '<div class="card">' +
        '<label>Select JD</label>' +
        '<select id="jd-select">' +
          jds.map(j => '<option value="' + j.id + '"' + (j.id === preselect ? ' selected' : '') + '>' + j.title + '</option>').join('') +
        '</select>' +
        '<div class="row" style="margin-top:12px;">' +
          '<button class="btn" id="run-btn">Run Screening on All</button>' +
          '<button class="btn btn-outline" id="weights-btn">Customize Weights</button>' +
          '<button class="btn btn-outline" id="export-csv">CSV</button>' +
          '<button class="btn btn-outline" id="export-xlsx">Excel</button>' +
          '<button class="btn btn-outline" id="export-pdf">PDF</button>' +
        '</div>' +
      '</div>' +

      '<div id="weights-panel" style="display:none;">' +
        '<div class="card">' +
          '<h2>Customize Scoring Weights</h2>' +
          '<p class="muted">Adjust sliders — they auto-normalize to 100%.</p>' +
          '<div id="weight-sliders"></div>' +
          '<button class="btn" style="margin-top:12px;" onclick="Screening.applyWeights()">Apply & Re-Score</button>' +
          '<button class="btn btn-outline" style="margin-top:12px;" onclick="Screening.resetWeights()">Reset Defaults</button>' +
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
    document.getElementById('weights-btn').onclick = () => this.toggleWeights();
    document.getElementById('export-csv').onclick = () => API.exportCSV(document.getElementById('jd-select').value);
    document.getElementById('export-xlsx').onclick = () => API.exportExcel(document.getElementById('jd-select').value);
    document.getElementById('export-pdf').onclick = () => API.exportPDF(document.getElementById('jd-select').value);

    if (preselect) {
      this.currentJdId = preselect;
      await this.loadResults(preselect);
    }
  },

  toggleWeights() {
    const panel = document.getElementById('weights-panel');
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (!visible) this.renderSliders();
  },

  renderSliders() {
    const w = this.weights || {
      skills: 0.30, experience: 0.20, responsibilities: 0.15,
      domain: 0.10, preferred_skills: 0.10, education: 0.05,
      location: 0.05, notice: 0.05
    };
    const el = document.getElementById('weight-sliders');
    el.innerHTML = Object.entries(w).map(([k, v]) =>
      '<div class="row" style="align-items:center;margin-bottom:8px;">' +
        '<label style="min-width:150px;text-transform:none;font-size:13px;">' + k.replace(/_/g, ' ') + '</label>' +
        '<input type="range" min="0" max="100" value="' + Math.round(v * 100) + '" data-key="' + k + '" class="weight-slider" style="flex:1;" />' +
        '<span class="weight-val" data-key="' + k + '" style="min-width:60px;text-align:right;font-weight:700;">' + Math.round(v * 100) + '%</span>' +
      '</div>'
    ).join('');
    el.querySelectorAll('.weight-slider').forEach(sl => {
      sl.oninput = () => {
        el.querySelector('.weight-val[data-key="' + sl.dataset.key + '"]').textContent = sl.value + '%';
      };
    });
  },

  async applyWeights() {
    const sliders = document.querySelectorAll('.weight-slider');
    const weights = {};
    sliders.forEach(sl => { weights[sl.dataset.key] = parseFloat(sl.value) / 100; });
    try {
      const res = await API.updateWeights({ weights: weights });
      this.weights = res.weights;
      Toast.success('Weights applied. Re-running screening...');
      await this.run();
    } catch (e) { Toast.error('Failed to apply'); }
  },

  resetWeights() {
    this.weights = {
      skills: 0.30, experience: 0.20, responsibilities: 0.15,
      domain: 0.10, preferred_skills: 0.10, education: 0.05,
      location: 0.05, notice: 0.05
    };
    this.renderSliders();
    Toast.info('Reset to defaults. Click Apply.');
  },

  async run() {
    const jdId = parseInt(document.getElementById('jd-select').value);
    this.currentJdId = jdId;
    document.getElementById('results-area').innerHTML = '<div class="card">Running screening...</div>';
    try {
      await API.runScreening({ jd_id: jdId, weights: this.weights || undefined });
      await this.loadResults(jdId);
      Toast.success('Screening complete');
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
      el.innerHTML = '<div class="card"><p class="muted">No results.</p></div>';
      return;
    }
    el.innerHTML =
      '<div class="card"><h2>Results (' + rows.length + ')</h2>' +
        '<div style="overflow-x:auto;">' +
        '<table><thead><tr><th>Candidate</th><th>Match</th><th>Exp</th><th>Location</th><th>Status</th><th></th></tr></thead><tbody>' +
          rows.map(r =>
            '<tr>' +
              '<td>' + (r.name || '-') + '</td>' +
              '<td><strong>' + r.overall_score + '%</strong><div class="progress"><span style="width:' + r.overall_score + '%"></span></div></td>' +
              '<td>' + (r.experience || 0) + 'y</td>' +
              '<td>' + (r.location || '-') + '</td>' +
              '<td><span class="badge ' + statusClass(r.status) + '">' + r.status + '</span></td>' +
              '<td>' +
                '<button class="btn btn-outline" onclick="Screening.showExplain(' + r.candidate_id + ')">Explain</button> ' +
                '<a class="btn btn-outline" href="#candidate?id=' + r.candidate_id + '">Profile</a>' +
              '</td>' +
            '</tr>'
          ).join('') +
        '</tbody></table></div>' +
      '</div>';
  },

  showExplain(candidateId) {
    const r = this.results.find(x => x.candidate_id === candidateId);
    if (!r) return;
    const ex = r.explanation || {};
    const html =
      '<div class="card"><h2>' + r.name + ' — ' + r.overall_score + '%</h2>' +
        '<h3>Matched</h3><div>' + ((ex.matched_skills || []).map(s => '<span class="chip chip-green">' + s + '</span>').join('') || 'None') + '</div>' +
        '<h3>Missing</h3><div>' + ((ex.missing_skills || []).map(s => '<span class="chip chip-red">' + s + '</span>').join('') || 'None') + '</div>' +
        '<h3>Strengths</h3><ul>' + ((ex.strengths || []).map(s => '<li>' + s + '</li>').join('') || '<li class="muted">None</li>') + '</ul>' +
        '<h3>Gaps</h3><ul>' + ((ex.gaps || []).map(s => '<li>' + s + '</li>').join('') || '<li class="muted">None</li>') + '</ul>' +
        '<button class="btn btn-outline" onclick="document.getElementById(\'explain-box\').remove()">Close</button>' +
      '</div>';
    const el = document.getElementById('results-area');
    const existing = document.getElementById('explain-box');
    if (existing) existing.remove();
    el.insertAdjacentHTML('afterbegin', '<div id="explain-box">' + html + '</div>');
  },
};

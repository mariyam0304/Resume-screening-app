const JD = {
  async createView() {
    const view = document.getElementById('view');
    view.innerHTML =
      '<h1>Create Job Description</h1>' +
      '<div class="card">' +
        '<textarea id="jd-text" placeholder="Paste the complete Job Description here..."></textarea>' +
        '<div style="margin-top:12px;">' +
          '<button class="btn" id="jd-submit">Analyze & Save JD</button>' +
        '</div>' +
      '</div>' +
      '<div id="jd-result"></div>';

    const prefill = sessionStorage.getItem('prefill_jd');
    if (prefill) {
      document.getElementById('jd-text').value = prefill;
      sessionStorage.removeItem('prefill_jd');
    }

    document.getElementById('jd-submit').onclick = async () => {
      const text = document.getElementById('jd-text').value.trim();
      if (!text) return alert('Please paste a JD first.');
      try {
        const res = await API.createJD({ raw_text: text });
        JD.renderParsed(res.parsed, res.id);
      } catch (e) { alert('Failed to create JD'); }
    };
  },

  renderParsed(p, id) {
    const el = document.getElementById('jd-result');
    el.innerHTML =
      '<div class="card">' +
        '<h2>JD Saved (ID: ' + id + ')</h2>' +
        '<p><strong>Title:</strong> ' + p.title + '</p>' +
        '<p><strong>Domain:</strong> ' + p.domain + ' | <strong>Location:</strong> ' + (p.location || '-') + ' | <strong>Work Mode:</strong> ' + p.work_mode + '</p>' +
        '<p><strong>Experience:</strong> ' + p.min_experience + '-' + p.max_experience + ' years | <strong>Notice:</strong> ' + (p.notice_period || '-') + '</p>' +
        '<p><strong>Salary:</strong> ' + (p.salary || '-') + ' | <strong>Education:</strong> ' + (p.education || '-') + '</p>' +
        '<h3>Required Skills</h3>' +
        '<div>' + (p.required_skills.map(s => '<span class="chip chip-green">' + s + '</span>').join('') || '<span class="muted">None detected</span>') + '</div>' +
        '<h3>Preferred Skills</h3>' +
        '<div>' + (p.preferred_skills.map(s => '<span class="chip">' + s + '</span>').join('') || '<span class="muted">None detected</span>') + '</div>' +
        '<h3>Responsibilities</h3>' +
        '<ul>' + (p.responsibilities.map(r => '<li>' + r + '</li>').join('') || '<li class="muted">None detected</li>') + '</ul>' +
        '<a class="btn" href="#saved-jds">Go to Saved JDs</a>' +
      '</div>';
  },

  async savedView() {
    const view = document.getElementById('view');
    const jds = await API.listJDs();
    view.innerHTML =
      '<h1>Saved Job Descriptions</h1>' +
      '<div class="card">' +
        (jds.length === 0
          ? '<p class="muted">No JDs yet. <a href="#create-jd">Create one</a>.</p>'
          : '<table><thead><tr><th>Title</th><th>Domain</th><th>Location</th><th>Min Exp</th><th>Actions</th></tr></thead><tbody>' +
            jds.map(j =>
              '<tr>' +
                '<td>' + j.title + '</td>' +
                '<td>' + j.domain + '</td>' +
                '<td>' + (j.location || '-') + '</td>' +
                '<td>' + (j.min_experience || 0) + 'y</td>' +
                '<td>' +
                  '<button class="btn btn-outline" onclick="JD.screen(' + j.id + ')">Screen</button> ' +
                  '<button class="btn btn-outline" onclick="JD.view(' + j.id + ')">View</button> ' +
                  '<button class="btn btn-danger" onclick="JD.remove(' + j.id + ', \'' + (j.title || '').replace(/'/g, "\\'") + '\')">Delete</button>' +
                '</td>' +
              '</tr>'
            ).join('') +
            '</tbody></table>') +
      '</div>';
  },

  async remove(id, title) {
    if (!confirm('Delete JD "' + (title || 'this JD') + '"?\n\nThis will also remove any screening results tied to this JD. This cannot be undone.')) return;
    try {
      const res = await API.deleteJD(id);
      if (typeof Toast !== 'undefined') Toast.success('JD deleted');
      this.savedView();
    } catch (e) {
      const msg = (e.data && e.data.details) ? e.data.details : (e.data && e.data.error) ? e.data.error : e.message;
      if (typeof Toast !== 'undefined') Toast.error('Delete failed: ' + msg);
      else alert('Delete failed: ' + msg);
    }
  },

  async view(id) {
    const jd = await API.getJD(id);
    const view = document.getElementById('view');
    view.innerHTML =
      '<h1>' + jd.title + '</h1>' +
      '<div class="card">' +
        '<p><strong>Domain:</strong> ' + jd.domain + ' | <strong>Location:</strong> ' + (jd.location || '-') + '</p>' +
        '<p><strong>Experience:</strong> ' + jd.min_experience + '-' + jd.max_experience + 'y | <strong>Notice:</strong> ' + (jd.notice_period || '-') + '</p>' +
        '<h3>Raw JD</h3>' +
        '<pre style="white-space:pre-wrap;background:var(--primary-soft);padding:12px;border-radius:8px;">' + jd.raw_text + '</pre>' +
        '<a class="btn btn-outline" href="#saved-jds">Back</a> ' +
        '<button class="btn btn-danger" onclick="JD.remove(' + jd.id + ', \'' + (jd.title || '').replace(/'/g, "\\'") + '\')">Delete This JD</button>' +
      '</div>';
  },

  screen(id) {
    location.hash = '#screening?jd=' + id;
  },
};

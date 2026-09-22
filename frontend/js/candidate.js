const CandidateView = {
  selected: new Set(),
  filter: 'all',

  async view(query) {
    const id = query && query.id;
    const view = document.getElementById('view');
    if (!id) return this.renderList(view);
    return this.renderProfile(id, view);
  },

  // ============================================================
  // CANDIDATE LIST
  // ============================================================
  async renderList(view) {
    const list = await API.listCandidates();
    this.selected.clear();
    const shortlisted = list.filter(c => c.is_shortlisted).length;

    view.innerHTML =
      '<h1>Candidate Database</h1>' +
      '<div class="card">' +
        '<div class="row" style="margin-bottom:14px;align-items:center;">' +
          '<button class="btn btn-danger" id="bulk-delete-btn" disabled>Delete Selected (0)</button>' +
          '<input type="text" id="search-input" placeholder="Search name, location, designation..." />' +
          '<select id="filter-select" style="max-width:220px;">' +
            '<option value="all">All (' + list.length + ')</option>' +
            '<option value="shortlisted">Shortlisted (' + shortlisted + ')</option>' +
            '<option value="not-shortlisted">Not Shortlisted (' + (list.length - shortlisted) + ')</option>' +
          '</select>' +
        '</div>' +
        '<div style="overflow-x:auto;">' +
        '<table><thead><tr>' +
          '<th style="width:36px;"><input type="checkbox" id="select-all" /></th>' +
          '<th style="width:36px;"></th>' +
          '<th>Name</th><th>Location</th><th>Experience</th><th>Designation</th><th>Status</th><th>Actions</th>' +
        '</tr></thead><tbody id="candidate-rows">' +
          (list.length === 0
            ? '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">No candidates yet. Upload resumes to get started.</td></tr>'
            : list.map(c =>
                '<tr data-id="' + c.id + '" data-shortlisted="' + (c.is_shortlisted ? '1' : '0') + '"' +
                ' data-name="' + (c.name || '').toLowerCase() + '"' +
                ' data-location="' + (c.location || '').toLowerCase() + '"' +
                ' data-designation="' + (c.designation || '').toLowerCase() + '">' +
                  '<td><input type="checkbox" class="row-check" value="' + c.id + '" /></td>' +
                  '<td style="cursor:pointer;font-size:20px;" class="star-cell" data-id="' + c.id + '" data-short="' + (c.is_shortlisted ? '1' : '0') + '">' +
                    (c.is_shortlisted ? '⭐' : '☆') +
                  '</td>' +
                  '<td>' + (c.name || '-') + '</td>' +
                  '<td>' + (c.location || '-') + '</td>' +
                  '<td>' + (c.experience || 0) + 'y</td>' +
                  '<td>' + (c.designation || '-') + '</td>' +
                  '<td>' + (c.status || 'New') + '</td>' +
                  '<td style="white-space:nowrap;">' +
                    '<a class="btn btn-outline" href="#candidate?id=' + c.id + '">Open</a> ' +
                    '<button class="btn btn-outline" onclick="Router.go(\'interview-questions\', {candidate:' + c.id + '})" title="Interview Questions">🎤</button> ' +
                    '<button class="btn btn-danger" onclick="CandidateView.deleteOne(' + c.id + ', \'' + (c.name || '').replace(/'/g, "\\'") + '\')">Delete</button>' +
                  '</td>' +
                '</tr>'
              ).join('')) +
        '</tbody></table></div>' +
      '</div>';

    document.getElementById('select-all').onchange = (e) => {
      document.querySelectorAll('.row-check').forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) this.selected.add(parseInt(cb.value));
        else this.selected.delete(parseInt(cb.value));
      });
      this.updateBulkButton();
    };

    document.querySelectorAll('.row-check').forEach(cb => {
      cb.onchange = () => {
        const cid = parseInt(cb.value);
        if (cb.checked) this.selected.add(cid);
        else this.selected.delete(cid);
        this.updateBulkButton();
      };
    });

    document.querySelectorAll('.star-cell').forEach(cell => {
      cell.onclick = async () => {
        const cid = parseInt(cell.dataset.id);
        try {
          const res = await API.toggleShortlist(cid);
          cell.textContent = res.is_shortlisted ? '⭐' : '☆';
          const row = cell.closest('tr');
          if (row) row.dataset.shortlisted = res.is_shortlisted ? '1' : '0';
          Toast.success(res.is_shortlisted ? 'Shortlisted' : 'Removed');
        } catch (e) { Toast.error('Failed'); }
      };
    });

    document.getElementById('bulk-delete-btn').onclick = () => this.bulkDelete();

    const applyFilter = () => {
      const q = document.getElementById('search-input').value.toLowerCase().trim();
      const f = document.getElementById('filter-select').value;
      document.querySelectorAll('#candidate-rows tr[data-id]').forEach(tr => {
        const text = (tr.dataset.name + ' ' + tr.dataset.location + ' ' + tr.dataset.designation);
        const okSearch = !q || text.indexOf(q) !== -1;
        let okFilter = true;
        if (f === 'shortlisted') okFilter = tr.dataset.shortlisted === '1';
        else if (f === 'not-shortlisted') okFilter = tr.dataset.shortlisted !== '1';
        tr.style.display = (okSearch && okFilter) ? '' : 'none';
      });
    };
    document.getElementById('search-input').oninput = applyFilter;
    document.getElementById('filter-select').onchange = applyFilter;
  },

  updateBulkButton() {
    const btn = document.getElementById('bulk-delete-btn');
    if (!btn) return;
    btn.textContent = 'Delete Selected (' + this.selected.size + ')';
    btn.disabled = this.selected.size === 0;
  },

  async deleteOne(id, name) {
    if (!confirm('Delete candidate "' + (name || 'this candidate') + '"?\n\nThis cannot be undone.')) return;
    try { await API.deleteCandidate(id); Toast.success('Deleted'); this.view({}); }
    catch (e) { Toast.error('Failed to delete'); }
  },

  async bulkDelete() {
    if (this.selected.size === 0) return;
    if (!confirm('Delete ' + this.selected.size + ' candidate(s)?')) return;
    try {
      const ids = Array.from(this.selected);
      const res = await API.bulkDeleteCandidates(ids);
      Toast.success('Deleted ' + (res.deleted || ids.length));
      this.view({});
    } catch (e) { Toast.error('Bulk delete failed'); }
  },

  // ============================================================
  // CANDIDATE PROFILE
  // ============================================================
  async renderProfile(id, view) {
    const c = await API.getCandidate(id);
    const notes = await API.getNotes(id);

    const isPdf = (c.file_path || '').toLowerCase().endsWith('.pdf');

    view.innerHTML =
      '<h1>' + (c.is_shortlisted ? '⭐ ' : '') + c.name + '</h1>' +
      '<div class="card">' +
        '<div class="row">' +
          '<div><strong>Email:</strong> ' + (c.email || '-') + '</div>' +
          '<div><strong>Phone:</strong> ' + (c.phone || '-') + '</div>' +
          '<div><strong>Location:</strong> ' + (c.location || '-') + '</div>' +
        '</div>' +
        '<div class="row" style="margin-top:8px;">' +
          '<div><strong>Experience:</strong> ' + c.experience + 'y</div>' +
          '<div><strong>Current:</strong> ' + (c.current_designation || '-') + ' @ ' + (c.current_company || '-') + '</div>' +
          '<div><strong>Notice:</strong> ' + (c.notice || '-') + '</div>' +
        '</div>' +
        '<div class="row" style="margin-top:8px;">' +
          '<div><strong>Expected CTC:</strong> ' + (c.expected_salary || '-') + '</div>' +
          '<div><strong>Education:</strong> ' + (c.education || '-') + '</div>' +
        '</div>' +
        '<h3>Skills</h3>' +
        '<div>' + ((c.skills || []).map(s => '<span class="chip">' + s + '</span>').join('') || '<span class="muted">None</span>') + '</div>' +
        '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">' +
          '<a class="btn btn-outline" href="#database">Back to List</a>' +
          '<button class="btn" onclick="CandidateView.toggleStar(' + c.id + ')">' + (c.is_shortlisted ? '⭐ Remove Shortlist' : '☆ Add to Shortlist') + '</button>' +
          '<button class="btn" onclick="CandidateView.openEditForm(' + c.id + ')">✏️ Edit Details</button>' +
          (isPdf ? '<button class="btn btn-outline" onclick="CandidateView.previewResume(' + c.id + ', \'' + (c.name || '').replace(/'/g, "\\'") + '\')">👁 Preview Resume</button>' : '') +
          '<button class="btn btn-outline" onclick="window.open(\'/api/resume/' + c.id + '/download\')">⬇ Download Resume</button>' +
          '<button class="btn btn-outline" onclick="Router.go(\'interview-questions\', {candidate:' + c.id + '})">🎤 Interview Questions</button>' +
          '<button class="btn btn-danger" onclick="CandidateView.deleteFromProfile(' + c.id + ', \'' + (c.name || '').replace(/'/g, "\\'") + '\')">Delete Candidate</button>' +
        '</div>' +
      '</div>' +

      '<div id="edit-form-container"></div>' +

      '<div class="card">' +
        '<h2>📊 Score Breakdown (Radar)</h2>' +
        '<p class="muted">Eight dimensions of match against the latest JD screening.</p>' +
        '<div id="radar-container" style="max-width:500px;margin:0 auto;min-height:280px;">' +
          '<canvas id="radarChart" height="280"></canvas>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<h2>🎥 Interview Recordings</h2>' +
        '<div style="margin-bottom:14px;">' +
          '<button class="btn" onclick="CandidateView.showUploadForm()">+ Upload Recording</button>' +
        '</div>' +
        '<div id="video-upload-form" style="display:none;margin-bottom:20px;">' +
          '<div class="card" style="background:var(--primary-soft);">' +
            '<h3 style="margin-top:0;">Upload New Recording</h3>' +
            '<label>Video File (MP4, WebM, MOV — max 500MB)</label>' +
            '<input type="file" id="video-file" accept="video/*" />' +
            '<label style="margin-top:10px;">Title</label>' +
            '<input type="text" id="video-title" placeholder="e.g. Technical Round with Raj" />' +
            '<label style="margin-top:10px;">Round</label>' +
            '<select id="video-round">' +
              '<option>Round 1 - Screening</option>' +
              '<option>Round 2 - Technical</option>' +
              '<option>Round 3 - Manager</option>' +
              '<option>HR Round</option>' +
              '<option>Final Round</option>' +
              '<option>Other</option>' +
            '</select>' +
            '<div style="margin-top:12px;">' +
              '<button class="btn" onclick="CandidateView.uploadVideo(' + c.id + ')">Upload</button> ' +
              '<button class="btn btn-outline" onclick="CandidateView.hideUploadForm()">Cancel</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="video-list"><p class="muted">Loading...</p></div>' +
      '</div>' +

      '<div class="card"><h3>Change Status</h3>' +
        '<div class="row">' +
          '<select id="status-select">' +
            ['New','Shortlisted','Interview Scheduled','Rejected'].map(s => '<option' + (s === c.status ? ' selected' : '') + '>' + s + '</option>').join('') +
          '</select>' +
          '<button class="btn" onclick="CandidateView.saveStatus(' + c.id + ')">Save</button>' +
        '</div>' +
      '</div>' +

      '<div class="card"><h3>Recruiter Notes</h3>' +
        '<textarea id="note-text" placeholder="Add a note..."></textarea>' +
        '<input type="text" id="follow-up" placeholder="Follow-up date (YYYY-MM-DD)" style="margin-top:8px;" />' +
        '<button class="btn" onclick="CandidateView.saveNote(' + c.id + ')" style="margin-top:8px;">Add Note</button>' +
        '<div style="margin-top:12px;">' +
          notes.map(n => '<div class="card" style="padding:10px;"><div class="muted">' + n.created_at + '</div>' + n.note + (n.follow_up_date ? '<div class="muted">Follow-up: ' + n.follow_up_date + '</div>' : '') + '</div>').join('') +
        '</div>' +
      '</div>';

    this.renderRadar(id);
    this.renderVideos(id);
  },

  // ============================================================
  // EDIT CANDIDATE FORM
  // ============================================================
  async openEditForm(id) {
    const c = await API.getCandidate(id);
    const container = document.getElementById('edit-form-container');
    if (!container) return;

    const skillsText = (c.skills || []).join(', ');

    container.innerHTML =
      '<div class="card" style="border-left:4px solid var(--primary);">' +
        '<h2 style="margin-top:0;">✏️ Edit Candidate Details</h2>' +
        '<p class="muted">Fix any parsing mistakes here. The original resume file is not affected.</p>' +

        '<div class="row" style="margin-top:14px;">' +
          '<div><label>Full Name</label><input id="e-name" value="' + (c.name || '').replace(/"/g, '&quot;') + '" /></div>' +
          '<div><label>Email</label><input id="e-email" value="' + (c.email || '').replace(/"/g, '&quot;') + '" /></div>' +
        '</div>' +

        '<div class="row" style="margin-top:10px;">' +
          '<div><label>Phone</label><input id="e-phone" value="' + (c.phone || '').replace(/"/g, '&quot;') + '" /></div>' +
          '<div><label>Location</label><input id="e-location" value="' + (c.location || '').replace(/"/g, '&quot;') + '" /></div>' +
        '</div>' +

        '<div class="row" style="margin-top:10px;">' +
          '<div><label>Total Experience (years)</label><input id="e-exp" type="number" step="0.5" value="' + (c.experience || 0) + '" /></div>' +
          '<div><label>Relevant Experience (years)</label><input id="e-relexp" type="number" step="0.5" value="' + (c.relevant_experience || 0) + '" /></div>' +
        '</div>' +

        '<div class="row" style="margin-top:10px;">' +
          '<div><label>Current Company</label><input id="e-company" value="' + (c.current_company || '').replace(/"/g, '&quot;') + '" /></div>' +
          '<div><label>Current Designation</label><input id="e-designation" value="' + (c.current_designation || '').replace(/"/g, '&quot;') + '" /></div>' +
        '</div>' +

        '<div style="margin-top:10px;">' +
          '<label>Education</label>' +
          '<input id="e-education" value="' + (c.education || '').replace(/"/g, '&quot;') + '" />' +
        '</div>' +

        '<div class="row" style="margin-top:10px;">' +
          '<div><label>Notice Period</label><input id="e-notice" value="' + (c.notice || '').replace(/"/g, '&quot;') + '" /></div>' +
          '<div><label>Expected CTC</label><input id="e-expected" value="' + (c.expected_salary || '').replace(/"/g, '&quot;') + '" /></div>' +
          '<div><label>Current CTC</label><input id="e-current" value="' + (c.current_salary || '').replace(/"/g, '&quot;') + '" /></div>' +
        '</div>' +

        '<div style="margin-top:10px;">' +
          '<label>Skills (comma-separated)</label>' +
          '<textarea id="e-skills" style="min-height:80px;">' + skillsText + '</textarea>' +
        '</div>' +

        '<div style="margin-top:14px;display:flex;gap:10px;">' +
          '<button class="btn" onclick="CandidateView.saveEdit(' + id + ')">💾 Save Changes</button>' +
          '<button class="btn btn-outline" onclick="CandidateView.closeEditForm()">Cancel</button>' +
        '</div>' +
      '</div>';

    // Scroll to form
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  closeEditForm() {
    const container = document.getElementById('edit-form-container');
    if (container) container.innerHTML = '';
  },

  async saveEdit(id) {
    const payload = {
      name: document.getElementById('e-name').value.trim(),
      email: document.getElementById('e-email').value.trim(),
      phone: document.getElementById('e-phone').value.trim(),
      location: document.getElementById('e-location').value.trim(),
      total_experience: document.getElementById('e-exp').value,
      relevant_experience: document.getElementById('e-relexp').value,
      current_company: document.getElementById('e-company').value.trim(),
      current_designation: document.getElementById('e-designation').value.trim(),
      education: document.getElementById('e-education').value.trim(),
      notice_period: document.getElementById('e-notice').value.trim(),
      expected_salary: document.getElementById('e-expected').value.trim(),
      current_salary: document.getElementById('e-current').value.trim(),
      skills: document.getElementById('e-skills').value
    };

    try {
      await API.updateCandidate(id, payload);
      Toast.success('Candidate updated');
      this.view({ id: id });
    } catch (e) {
      Toast.error('Failed to save');
    }
  },

  // ============================================================
  // RADAR CHART
  // ============================================================
  async renderRadar(candidateId) {
    try {
      const results = await API.candidateResults(candidateId);
      if (!results || results.length === 0) {
        const container = document.getElementById('radar-container');
        if (container) {
          container.innerHTML = '<p class="muted" style="text-align:center;padding:40px 0;">' +
            'No screening data yet. Run screening against a JD to see the radar chart.' +
            '</p>';
        }
        return;
      }
      const r = results[results.length - 1];
      const ctx = document.getElementById('radarChart');
      if (!ctx || typeof Chart === 'undefined') return;
      if (window._radarChartInstance) {
        try { window._radarChartInstance.destroy(); } catch (e) {}
      }
      window._radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: ['Skills', 'Experience', 'Education', 'Location', 'Notice', 'Responsibilities', 'Preferred Skills', 'Overall'],
          datasets: [{
            label: 'Score',
            data: [
              r.skills_score || 0, r.experience_score || 0, r.education_score || 0,
              r.location_score || 0, r.notice_score || 0, r.responsibility_score || 0,
              r.preferred_skills_score || 0, r.overall_score || 0
            ],
            backgroundColor: 'rgba(139, 92, 246, 0.25)',
            borderColor: '#8b5cf6', borderWidth: 2,
            pointBackgroundColor: '#8b5cf6', pointBorderColor: '#fff',
            pointRadius: 5, pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, display: false },
            pointLabels: { font: { size: 12, weight: '600' }, color: '#4a2616' },
            grid: { color: 'rgba(139, 92, 246, 0.15)' },
            angleLines: { color: 'rgba(139, 92, 246, 0.2)' } } },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return ctx.parsed.r + '%'; } } } }
        }
      });
    } catch (e) {}
  },

  // ============================================================
  // VIDEO INTERVIEWS
  // ============================================================
  async renderVideos(candidateId) {
    const el = document.getElementById('video-list');
    if (!el) return;
    try {
      const res = await fetch('/api/video/candidate/' + candidateId, { credentials: 'same-origin' });
      if (!res.ok) { el.innerHTML = '<p class="muted">Could not load recordings.</p>'; return; }
      const videos = await res.json();
      if (!videos || videos.length === 0) {
        el.innerHTML = '<p class="muted">No recordings yet. Click "+ Upload Recording" to add one.</p>';
        return;
      }
      el.innerHTML = videos.map(function(v) {
        const sizeMB = (v.file_size / (1024 * 1024)).toFixed(1);
        const stars = '⭐'.repeat(v.rating || 0) + '☆'.repeat(5 - (v.rating || 0));
        return '<div class="card" style="padding:14px;margin-bottom:12px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">' +
            '<div style="flex:1;">' +
              '<h3 style="margin:0;">' + (v.title || v.filename) + '</h3>' +
              '<div class="muted" style="font-size:12px;margin-top:2px;">' +
                (v.round_label || '') + ' · ' + sizeMB + ' MB · ' + (v.view_count || 0) + ' views · ' + (v.notes_count || 0) + ' notes' +
              '</div>' +
            '</div>' +
            '<div style="font-size:14px;white-space:nowrap;">' + stars + '</div>' +
          '</div>' +
          '<video id="vid-' + v.id + '" controls style="width:100%;max-height:400px;border-radius:8px;background:#000;margin-top:10px;" preload="metadata">' +
            '<source src="/api/video/' + v.id + '/stream" />' +
          '</video>' +
          '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
            '<button class="btn btn-outline" onclick="CandidateView.addVideoNote(' + v.id + ')">📝 Add Note at Current Time</button>' +
            '<button class="btn btn-outline" onclick="CandidateView.rateVideo(' + v.id + ', ' + candidateId + ')">Rate</button>' +
            '<button class="btn btn-outline" onclick="window.open(\'/api/video/' + v.id + '/download\')">⬇ Download</button>' +
            '<button class="btn btn-danger" onclick="CandidateView.deleteVideo(' + v.id + ', ' + candidateId + ')">Delete</button>' +
          '</div>' +
          '<div id="vnotes-' + v.id + '" style="margin-top:10px;font-size:13px;"></div>' +
        '</div>';
      }).join('');
      videos.forEach(function(v) { CandidateView.loadVideoNotes(v.id); });
    } catch (e) {
      el.innerHTML = '<p class="muted">Failed to load recordings.</p>';
    }
  },

  showUploadForm() { document.getElementById('video-upload-form').style.display = 'block'; },
  hideUploadForm() { document.getElementById('video-upload-form').style.display = 'none'; },

  async uploadVideo(cid) {
    const input = document.getElementById('video-file');
    if (!input.files[0]) { Toast.warn('Choose a file first'); return; }
    const fd = new FormData();
    fd.append('file', input.files[0]);
    fd.append('title', document.getElementById('video-title').value.trim() || input.files[0].name);
    fd.append('round_label', document.getElementById('video-round').value);
    Toast.info('Uploading...');
    try {
      const r = await fetch('/api/video/upload/' + cid, { method: 'POST', body: fd, credentials: 'same-origin' });
      const data = await r.json();
      if (!r.ok) { Toast.error(data.error || 'Upload failed'); return; }
      Toast.success('Uploaded');
      this.renderVideos(cid);
      this.hideUploadForm();
    } catch (e) { Toast.error('Upload failed'); }
  },

  async deleteVideo(vid, cid) {
    if (!confirm('Delete this recording?')) return;
    try {
      const r = await fetch('/api/video/' + vid, { method: 'DELETE', credentials: 'same-origin' });
      if (r.ok) { Toast.success('Deleted'); this.renderVideos(cid); }
    } catch (e) { Toast.error('Failed'); }
  },

  async rateVideo(vid, cid) {
    const r = prompt('Rate 0-5 stars:', '4');
    if (r === null) return;
    try {
      await fetch('/api/video/' + vid + '/rate', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: parseInt(r) })
      });
      this.renderVideos(cid);
    } catch (e) {}
  },

  async addVideoNote(vid) {
    const video = document.getElementById('vid-' + vid);
    if (!video) return;
    const t = Math.floor(video.currentTime || 0);
    const text = prompt('Note at ' + Math.floor(t/60) + ':' + String(t%60).padStart(2,'0') + ':', '');
    if (!text) return;
    try {
      await fetch('/api/video/' + vid + '/notes', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp_sec: t, text: text })
      });
      Toast.success('Note added');
      this.loadVideoNotes(vid);
    } catch (e) {}
  },

  async loadVideoNotes(vid) {
    try {
      const r = await fetch('/api/video/' + vid + '/notes', { credentials: 'same-origin' });
      const notes = await r.json();
      const el = document.getElementById('vnotes-' + vid);
      if (!el || !notes) return;
      if (notes.length === 0) { el.innerHTML = ''; return; }
      el.innerHTML = '<strong>Notes:</strong>' + notes.map(function(n) {
        const s = Math.floor(n.timestamp_sec);
        const ts = Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
        return '<div style="padding:6px 0;border-bottom:1px solid var(--border-soft);">' +
          '<a href="javascript:void(0)" onclick="document.getElementById(\'vid-' + vid + '\').currentTime=' + n.timestamp_sec + '" style="color:var(--primary);font-weight:700;">[' + ts + ']</a> ' +
          '<span>' + n.text + '</span> ' +
          '<button class="btn btn-outline" style="padding:2px 8px;font-size:11px;" onclick="CandidateView.deleteVideoNote(' + n.id + ',' + vid + ')">×</button>' +
        '</div>';
      }).join('');
    } catch (e) {}
  },

  async deleteVideoNote(nid, vid) {
    try {
      await fetch('/api/video/notes/' + nid, { method: 'DELETE', credentials: 'same-origin' });
      this.loadVideoNotes(vid);
    } catch (e) {}
  },

  // ============================================================
  // RESUME PREVIEW
  // ============================================================
  previewResume(cid, name) {
    const url = API.previewResumeUrl(cid);
    const modal = document.createElement('div');
    modal.id = 'resume-preview-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(30,27,58,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML =
      '<div style="background:#fff;border-radius:12px;width:100%;max-width:900px;height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4);">' +
        '<div style="padding:12px 18px;border-bottom:1px solid #e5dff5;display:flex;justify-content:space-between;align-items:center;">' +
          '<strong>' + name + ' — Resume</strong>' +
          '<div>' +
            '<a class="btn btn-outline" href="' + url + '" download style="margin-right:8px;">Download</a>' +
            '<button class="btn btn-outline" onclick="document.getElementById(\'resume-preview-modal\').remove()">Close</button>' +
          '</div>' +
        '</div>' +
        '<iframe src="' + url + '" style="flex:1;border:none;width:100%;"></iframe>' +
      '</div>';
    document.body.appendChild(modal);
  },

  // ============================================================
  // SHORTLIST / DELETE / STATUS / NOTES
  // ============================================================
  async toggleStar(id) {
    try {
      const res = await API.toggleShortlist(id);
      Toast.success(res.is_shortlisted ? 'Shortlisted' : 'Removed');
      this.view({ id: id });
    } catch (e) { Toast.error('Failed'); }
  },

  async deleteFromProfile(id, name) {
    if (!confirm('Delete candidate "' + (name || '') + '"?\n\nThis cannot be undone.')) return;
    try {
      await API.deleteCandidate(id);
      location.hash = '#database';
      this.view({});
    } catch (e) { Toast.error('Failed'); }
  },

  async saveStatus(id) {
    const status = document.getElementById('status-select').value;
    await API.setStatus(id, status);
    Toast.success('Status updated');
  },

  async saveNote(id) {
    const note = document.getElementById('note-text').value;
    const follow_up_date = document.getElementById('follow-up').value;
    if (!note) return;
    await API.addNote(id, { note: note, follow_up_date: follow_up_date });
    location.reload();
  },
};

const CandidateView = {
  selected: new Set(),

  async view(query) {
    const id = query && query.id;
    const view = document.getElementById('view');
    if (!id) {
      return this.renderList(view);
    }
    return this.renderProfile(id, view);
  },

  async renderList(view) {
    const list = await API.listCandidates();
    this.selected.clear();

    view.innerHTML =
      '<h1>Candidate Database</h1>' +
      '<div class="card">' +
        '<div class="row" style="margin-bottom:14px;">' +
          '<button class="btn btn-danger" id="bulk-delete-btn" disabled>Delete Selected (0)</button>' +
          '<input type="text" id="search-input" placeholder="Search by name, skill, or location..." />' +
        '</div>' +
        '<div style="overflow-x:auto;">' +
        '<table>' +
          '<thead><tr>' +
            '<th style="width:36px;"><input type="checkbox" id="select-all" /></th>' +
            '<th>Name</th><th>Location</th><th>Experience</th><th>Designation</th><th>Status</th><th>Actions</th>' +
          '</tr></thead>' +
          '<tbody id="candidate-rows">' +
            (list.length === 0
              ? '<tr><td colspan="7" class="muted" style="text-align:center;padding:20px;">No candidates yet. Upload resumes to get started.</td></tr>'
              : list.map(c =>
                  '<tr data-id="' + c.id + '" data-name="' + (c.name || '').toLowerCase() +
                  '" data-location="' + (c.location || '').toLowerCase() +
                  '" data-designation="' + (c.designation || '').toLowerCase() + '">' +
                    '<td><input type="checkbox" class="row-check" value="' + c.id + '" /></td>' +
                    '<td>' + (c.name || '-') + '</td>' +
                    '<td>' + (c.location || '-') + '</td>' +
                    '<td>' + (c.experience || 0) + 'y</td>' +
                    '<td>' + (c.designation || '-') + '</td>' +
                    '<td>' + (c.status || 'New') + '</td>' +
                    '<td style="white-space:nowrap;">' +
                      '<a class="btn btn-outline" href="#candidate?id=' + c.id + '">Open</a> ' +
                      '<button class="btn btn-danger" onclick="CandidateView.deleteOne(' + c.id + ', \'' + (c.name || '').replace(/'/g, "\\'") + '\')">Delete</button>' +
                    '</td>' +
                  '</tr>'
                ).join('')) +
          '</tbody>' +
        '</table>' +
        '</div>' +
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

    document.getElementById('bulk-delete-btn').onclick = () => this.bulkDelete();

    document.getElementById('search-input').oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('#candidate-rows tr[data-id]').forEach(tr => {
        const text = (tr.dataset.name + ' ' + tr.dataset.location + ' ' + tr.dataset.designation);
        tr.style.display = (!q || text.indexOf(q) !== -1) ? '' : 'none';
      });
    };
  },

  updateBulkButton() {
    const btn = document.getElementById('bulk-delete-btn');
    if (!btn) return;
    btn.textContent = 'Delete Selected (' + this.selected.size + ')';
    btn.disabled = this.selected.size === 0;
  },

  async deleteOne(id, name) {
    if (!confirm('Delete candidate "' + (name || 'this candidate') + '"?\n\nThis cannot be undone.')) return;
    try {
      await API.deleteCandidate(id);
      this.view({});
    } catch (e) {
      alert('Failed to delete. Please try again.');
    }
  },

  async bulkDelete() {
    if (this.selected.size === 0) return;
    if (!confirm('Delete ' + this.selected.size + ' selected candidate(s)?\n\nThis cannot be undone.')) return;
    try {
      const ids = Array.from(this.selected);
      const res = await API.bulkDeleteCandidates(ids);
      alert('Deleted ' + (res.deleted || ids.length) + ' candidate(s).');
      this.view({});
    } catch (e) {
      alert('Bulk delete failed.');
    }
  },

  async renderProfile(id, view) {
    const c = await API.getCandidate(id);
    const notes = await API.getNotes(id);
    view.innerHTML =
      '<h1>' + c.name + '</h1>' +
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
          '<button class="btn btn-outline" onclick="window.open(\'/api/resume/' + c.id + '/download\')">Download Resume</button>' +
          '<button class="btn btn-danger" onclick="CandidateView.deleteFromProfile(' + c.id + ', \'' + (c.name || '').replace(/'/g, "\\'") + '\')">Delete Candidate</button>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h3>Change Status</h3>' +
        '<div class="row">' +
          '<select id="status-select">' +
            ['New','Shortlisted','Interview Scheduled','Rejected'].map(s => '<option' + (s === c.status ? ' selected' : '') + '>' + s + '</option>').join('') +
          '</select>' +
          '<button class="btn" onclick="CandidateView.saveStatus(' + c.id + ')">Save</button>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h3>Recruiter Notes</h3>' +
        '<textarea id="note-text" placeholder="Add a note..."></textarea>' +
        '<input type="text" id="follow-up" placeholder="Follow-up date (YYYY-MM-DD)" style="margin-top:8px;" />' +
        '<button class="btn" onclick="CandidateView.saveNote(' + c.id + ')" style="margin-top:8px;">Add Note</button>' +
        '<div style="margin-top:12px;">' +
          notes.map(n => '<div class="card" style="padding:10px;"><div class="muted">' + n.created_at + '</div>' + n.note + (n.follow_up_date ? '<div class="muted">Follow-up: ' + n.follow_up_date + '</div>' : '') + '</div>').join('') +
        '</div>' +
      '</div>';
  },

  async deleteFromProfile(id, name) {
    if (!confirm('Delete candidate "' + (name || '') + '"?\n\nThis cannot be undone.')) return;
    try {
      await API.deleteCandidate(id);
      location.hash = '#database';
      this.view({});
    } catch (e) {
      alert('Delete failed.');
    }
  },

  async saveStatus(id) {
    const status = document.getElementById('status-select').value;
    await API.setStatus(id, status);
    alert('Status updated');
  },

  async saveNote(id) {
    const note = document.getElementById('note-text').value;
    const follow_up_date = document.getElementById('follow-up').value;
    if (!note) return;
    await API.addNote(id, { note: note, follow_up_date: follow_up_date });
    location.reload();
  },
};

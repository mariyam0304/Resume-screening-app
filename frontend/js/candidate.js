const CandidateView = {
  selected: new Set(),
  filter: 'all',
  videoPlayer: null,

  async view(query) {
    const id = query && query.id;
    const view = document.getElementById('view');
    if (!id) return this.renderList(view);
    return this.renderProfile(id, view);
  },

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
            ? '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">No candidates yet.</td></tr>'
            : list.map(c =>
                '<tr data-id="' + c.id + '" data-shortlisted="' + (c.is_shortlisted ? '1' : '0') + '"' +
                ' data-name="' + (c.name || '').toLowerCase() + '"' +
                ' data-location="' + (c.location || '').toLowerCase() + '"' +
                ' data-designation="' + (c.designation || '').toLowerCase() + '">' +
                  '<td><input type="checkbox" class="row-check" value="' + c.id + '" /></td>' +
                  '<td style="cursor:pointer;font-size:20px;" class="star-cell" data-id="' + c.id + '" data-short="' + (c.is_shortlisted ? '1' : '0') + '">' + (c.is_shortlisted ? '⭐' : '☆') + '</td>' +
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
        if (cb.checked) this.selected.add(cid); else this.selected.delete(cid);
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
    if (!confirm('Delete candidate "' + (name || '') + '"?')) return;
    try { await API.deleteCandidate(id); Toast.success('Deleted'); this.view({}); }
    catch (e) { Toast.error('Failed'); }
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

  async renderProfile(id, view) {
    const c = await API.getCandidate(id);
    const notes = await API.getNotes(id);
    let videos = [];
    try { videos = await API.listVideos(id); } catch (e) {}

    const ext = (c.file_path || '').toLowerCase();
    const isPdf = ext.endsWith('.pdf');
    const isDocx = ext.endsWith('.docx') || ext.endsWith('.doc');

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
          '<a class="btn btn-outline" href="#database">Back</a>' +
          '<button class="btn" onclick="CandidateView.toggleStar(' + c.id + ')">' + (c.is_shortlisted ? '⭐ Remove Shortlist' : '☆ Add to Shortlist') + '</button>' +
          (isPdf ? '<button class="btn btn-outline" onclick="CandidateView.previewResume(' + c.id + ', \'' + (c.name || '').replace(/'/g, "\\'") + '\')">👁 Preview Resume</button>' : '') +
          '<button class="btn btn-outline" onclick="window.open(\'/api/resume/' + c.id + '/download\')">⬇ Download Resume</button>' +
          '<button class="btn btn-danger" onclick="CandidateView.deleteFromProfile(' + c.id + ', \'' + (c.name || '').replace(/'/g, "\\'") + '\')">Delete</button>' +
        '</div>' +
      '</div>' +

      // === VIDEO INTERVIEW SECTION ===
      '<div class="card">' +
        '<h2>🎬 Video Interviews (' + videos.length + ')</h2>' +
        '<div class="row" style="margin-bottom:14px;">' +
          '<button class="btn" onclick="CandidateView.showUploadForm(' + c.id + ')">+ Upload Recording</button>' +
        '</div>' +
        '<div id="video-upload-form" style="display:none;margin-bottom:20px;">' +
          '<div class="card" style="background:var(--primary-soft);">' +
            '<h3 style="margin-top:0;">Upload New Recording</h3>' +
            '<label>Video File (MP4, WebM, MOV, MKV, AVI, M4V · max 500MB)</label>' +
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
              '<button class="btn btn-outline" onclick="document.getElementById(\'video-upload-form\').style.display=\'none\'">Cancel</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="video-list">' +
          (videos.length === 0
            ? '<p class="muted">No recordings yet. Click "+ Upload Recording" to add one.</p>'
            : videos.map(v => CandidateView.videoCardHTML(v)).join('')) +
        '</div>' +
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
          notes.map(n => '<div class="card" style="padding:10px;"><div class="muted">' + n.created_at + '</div>' + n.note + '</div>').join('') +
        '</div>' +
      '</div>';
  },

  videoCardHTML(v) {
    const sizeMB = (v.file_size / (1024 * 1024)).toFixed(1);
    const stars = '⭐'.repeat(v.rating || 0) + '☆'.repeat(5 - (v.rating || 0));
    return '<div class="card" style="padding:14px;margin-bottom:12px;" data-video-id="' + v.id + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">' +
        '<div style="flex:1;">' +
          '<h3 style="margin:0;">' + (v.title || v.filename) + '</h3>' +
          '<div class="muted" style="font-size:12px;margin-top:2px;">' +
            (v.round_label || '') + ' · ' + sizeMB + ' MB · ' +
            (v.view_count || 0) + ' views · ' + (v.notes_count || 0) + ' notes' +
          '</div>' +
        '</div>' +
        '<div style="font-size:14px;white-space:nowrap;">' + stars + '</div>' +
      '</div>' +
      '<div style="margin-top:10px;">' +
        '<video id="vid-' + v.id + '" controls style="width:100%;max-height:400px;border-radius:8px;background:#000;" preload="metadata">' +
          '<source src="' + API.videoStreamUrl(v.id) + '" />' +
        '</video>' +
      '</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
        '<button class="btn btn-outline" onclick="CandidateView.addNoteAtTime(' + v.id + ')">📝 Add Note at Current Time</button>' +
        '<button class="btn btn-outline" onclick="CandidateView.rateVideo(' + v.id + ')">Rate</button>' +
        '<button class="btn btn-outline" onclick="window.open(\'' + API.videoDownloadUrl(v.id) + '\')">⬇ Download</button>' +
        '<button class="btn btn-danger" onclick="CandidateView.deleteVideo(' + v.id + ')">Delete</button>' +
        '<span class="muted" style="margin-left:auto;">Position: <span id="pos-' + v.id + '">0:00</span></span>' +
      '</div>' +
      '<div id="notes-' + v.id + '" style="margin-top:10px;font-size:13px;"></div>' +
    '</div>';
  },

  showUploadForm(cid) {
    const f = document.getElementById('video-upload-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  },

  async uploadVideo(cid) {
    const input = document.getElementById('video-file');
    if (!input.files[0]) { Toast.warn('Choose a file'); return; }
    const title = document.getElementById('video-title').value.trim() || input.files[0].name;
    const roundLabel = document.getElementById('video-round').value;

    const fd = new FormData();
    fd.append('file', input.files[0]);
    fd.append('title', title);
    fd.append('round_label', roundLabel);
    fd.append('duration', 0);

    Toast.info('Uploading... this may take a moment');
    try {
      await API.uploadVideo(cid, fd);
      Toast.success('Uploaded!');
      this.view({ id: cid });
    } catch (e) { Toast.error('Upload failed: ' + (e.data && e.data.error ? e.data.error : e.message)); }
  },

  async deleteVideo(vid) {
    if (!confirm('Delete this recording?')) return;
    try { await API.deleteVideo(vid); Toast.success('Deleted'); location.reload(); }
    catch (e) { Toast.error('Failed'); }
  },

  async rateVideo(vid) {
    const r = prompt('Rate 0-5 stars:', '4');
    if (r === null) return;
    try { await API.rateVideo(vid, parseInt(r)); Toast.success('Rated'); location.reload(); }
    catch (e) { Toast.error('Failed'); }
  },

  async addNoteAtTime(vid) {
    const video = document.getElementById('vid-' + vid);
    if (!video) return;
    const t = Math.floor(video.currentTime || 0);
    const text = prompt('Note at ' + Math.floor(t/60) + ':' + String(t%60).padStart(2,'0') + ':', '');
    if (!text) return;
    try {
      await API.addVideoNote(vid, { timestamp_sec: t, text: text });
      Toast.success('Note added');
      this.loadVideoNotes(vid);
    } catch (e) { Toast.error('Failed'); }
  },

  async loadVideoNotes(vid) {
    try {
      const notes = await API.listVideoNotes(vid);
      const el = document.getElementById('notes-' + vid);
      if (!el) return;
      el.innerHTML = notes.length === 0 ? '<span class="muted">No timestamped notes yet.</span>' :
        '<strong>Notes:</strong>' +
        notes.map(n => {
          const s = Math.floor(n.timestamp_sec);
          const ts = Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
          return '<div style="padding:6px 0;border-bottom:1px solid var(--border-soft);">' +
            '<a href="javascript:void(0)" onclick="document.getElementById(\'vid-' + vid + '\').currentTime=' + n.timestamp_sec + '" style="color:var(--primary);font-weight:700;">[' + ts + ']</a> ' +
            '<span>' + n.text + '</span> ' +
            '<button class="btn btn-outline" style="padding:2px 8px;font-size:11px;" onclick="CandidateView.deleteNote(' + n.id + ',' + vid + ')">×</button>' +
          '</div>';
        }).join('');
    } catch (e) {}
  },

  async deleteNote(nid, vid) {
    try { await API.deleteVideoNote(nid); this.loadVideoNotes(vid); }
    catch (e) {}
  },

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

  async toggleStar(id) {
    try {
      const res = await API.toggleShortlist(id);
      Toast.success(res.is_shortlisted ? 'Shortlisted' : 'Removed');
      this.view({ id: id });
    } catch (e) { Toast.error('Failed'); }
  },

  async deleteFromProfile(id, name) {
    if (!confirm('Delete candidate "' + (name || '') + '"?')) return;
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

// Auto-load video notes and restore last position on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.querySelectorAll('video[id^="vid-"]').forEach(v => {
      const vid = v.id.replace('vid-', '');
      CandidateView.loadVideoNotes(parseInt(vid));
      // Save position periodically
      v.addEventListener('timeupdate', () => {
        const el = document.getElementById('pos-' + vid);
        if (el) {
          const t = Math.floor(v.currentTime);
          el.textContent = Math.floor(t/60) + ':' + String(t%60).padStart(2,'0');
        }
      });
      let lastSave = 0;
      v.addEventListener('timeupdate', () => {
        const now = Date.now();
        if (now - lastSave > 10000) {   // save every 10s
          lastSave = now;
          if (typeof API !== 'undefined' && API.savePosition) {
            API.savePosition(parseInt(vid), v.currentTime).catch(() => {});
          }
        }
      });
    });
  }, 500);
});

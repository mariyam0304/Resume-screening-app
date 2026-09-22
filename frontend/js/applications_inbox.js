// ============================================================
// Recruiter Applications Inbox
// Features included:
//   - View applications per JD
//   - Candidate detail page
//   - Shortlist / Reject
//   - 🎤 Interview Questions (Tier 1)
//   - 📅 Schedule Interview (Tier 1, Feature 5)
// ============================================================

const ApplicationsInbox = {
  async view(query) {
    const jdId = parseInt(query && query.jd);
    const view = document.getElementById('view');

    if (!jdId) {
      // JD picker
      const jds = await API.listJDs();
      view.innerHTML =
        '<h1>Applications Inbox</h1>' +
        '<div class="card">' +
          '<p class="muted">Select a JD to see applications from candidates.</p>' +
          (jds.length === 0
            ? '<p>No JDs yet.</p>'
            : '<table><thead><tr><th>JD Title</th><th>Location</th><th>Actions</th></tr></thead><tbody>' +
              jds.map(j =>
                '<tr>' +
                  '<td>' + j.title + '</td>' +
                  '<td>' + (j.location || '-') + '</td>' +
                  '<td><button class="btn" onclick="Router.go(\'applications-inbox\', {jd:' + j.id + '})">View Applications</button></td>' +
                '</tr>'
              ).join('') + '</tbody></table>') +
        '</div>';
      return;
    }

    view.innerHTML = '<h1>Loading applications...</h1>';

    let data = null;
    try {
      const res = await fetch('/api/portal/recruiter/applications/' + jdId);
      data = await res.json();
    } catch (e) { view.innerHTML = '<div class="card">Failed to load.</div>'; return; }

    const apps = data.applications || [];

    view.innerHTML =
      '<h1>📥 Applications for: ' + data.jd.title + '</h1>' +
      '<p class="muted">' + apps.length + ' application(s) · auto-screened</p>' +

      '<div class="card">' +
        (apps.length === 0
          ? '<p class="muted">No applications yet.</p>'
          : '<table><thead><tr>' +
            '<th>Candidate</th><th>Email</th><th>Exp</th><th>Location</th>' +
            '<th>Match</th><th>Status</th><th>Applied</th><th>Actions</th>' +
            '</tr></thead><tbody>' +
            apps.map(a =>
              '<tr>' +
                '<td><strong>' + a.name + '</strong></td>' +
                '<td class="muted">' + a.email + '</td>' +
                '<td>' + (a.experience_years || 0) + 'y</td>' +
                '<td>' + (a.location || '-') + '</td>' +
                '<td><strong>' + (a.match_score || 0) + '%</strong>' +
                  '<div class="progress"><span style="width:' + (a.match_score || 0) + '%"></span></div>' +
                '</td>' +
                '<td><span class="badge ' + statusBadge(a.status) + '">' + a.status + '</span></td>' +
                '<td class="muted">' + (a.applied_at || '').slice(0, 10) + '</td>' +
                '<td style="white-space:nowrap;">' +
                  '<button class="btn btn-outline" onclick="ApplicationsInbox.openDetail(' + a.application_id + ')">View</button> ' +
                  '<button class="btn btn-outline" onclick="ApplicationsInbox.setStatus(' + a.application_id + ', \'Shortlisted\')" title="Shortlist">⭐</button> ' +
                  '<button class="btn btn-outline" onclick="Router.go(\'interview-questions\', {app:' + a.application_id + '})" title="Interview Questions">🎤</button> ' +
                  '<button class="btn btn-outline" onclick="ApplicationsInbox.scheduleModal(' + a.application_id + ')" title="Schedule Interview">📅</button> ' +
                  '<button class="btn btn-outline" onclick="ApplicationsInbox.setStatus(' + a.application_id + ', \'Rejected\')" title="Reject">✗</button>' +
                '</td>' +
              '</tr>'
            ).join('') + '</tbody></table>') +
      '</div>' +
      '<a class="btn btn-outline" href="#applications-inbox">← Back to JD list</a>';
  },

  async openDetail(appId) {
    const view = document.getElementById('view');
    view.innerHTML = '<h1>Loading candidate...</h1>';

    let data = null;
    try {
      const res = await fetch('/api/portal/recruiter/application/' + appId);
      data = await res.json();
    } catch (e) { view.innerHTML = '<div class="card">Failed to load candidate.</div>'; return; }

    const c = data.candidate || {};

    view.innerHTML =
      '<h1>' + (c.name || c.username) + '</h1>' +

      '<div class="card">' +
        '<h3>Contact</h3>' +
        '<div class="row">' +
          '<div><strong>Email:</strong> ' + (c.email || '-') + '</div>' +
          '<div><strong>Phone:</strong> ' + (c.phone || '-') + '</div>' +
          '<div><strong>Location:</strong> ' + (c.location || '-') + '</div>' +
        '</div>' +
        '<div class="row" style="margin-top:8px;">' +
          '<div><strong>Education:</strong> ' + (c.education || '-') + '</div>' +
          '<div><strong>Experience:</strong> ' + (c.experience_years || 0) + ' years</div>' +
        '</div>' +
        '<h3>Skills</h3>' +
        '<p>' + (c.skills_summary || '<span class="muted">Not specified</span>') + '</p>' +
      '</div>' +

      '<div class="card">' +
        '<h3>Applied For</h3>' +
        '<p><strong>' + data.jd.title + '</strong> — ' + (data.jd.location || '') + '</p>' +
        '<p><strong>Match Score:</strong> ' + (data.match_score || 0) + '% ' +
          '<span class="badge ' + statusBadge(data.status) + '">' + data.status + '</span></p>' +
        '<p><strong>Applied on:</strong> ' + (data.applied_at || '').slice(0, 10) + '</p>' +
        (data.cover_note ? '<h3>Cover Note</h3><p>' + data.cover_note + '</p>' : '') +
        '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">' +
          '<a class="btn btn-outline" href="/api/portal/recruiter/application/' + appId + '/resume" target="_blank">⬇ Download Resume</a>' +
          '<button class="btn btn-outline" onclick="Router.go(\'interview-questions\', {app:' + appId + '})">🎤 Interview Questions</button>' +
          '<button class="btn btn-outline" onclick="ApplicationsInbox.scheduleModal(' + appId + ')">📅 Schedule Interview</button>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<h3>Update Status</h3>' +
        '<div class="row">' +
          '<select id="app-status">' +
            ['Applied','Under Review','Shortlisted','Interview Scheduled','Rejected'].map(s =>
              '<option' + (s === data.status ? ' selected' : '') + '>' + s + '</option>').join('') +
          '</select>' +
          '<button class="btn" onclick="ApplicationsInbox.saveStatus(' + appId + ')">Save</button>' +
        '</div>' +
      '</div>' +

      '<a class="btn btn-outline" href="#applications-inbox">← Back to Inbox</a>';
  },

  async setStatus(appId, newStatus) {
    try {
      const res = await fetch('/api/portal/recruiter/application/' + appId + '/status', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) { Toast.success('Status updated'); location.reload(); }
      else { Toast.error('Failed'); }
    } catch (e) { Toast.error('Failed'); }
  },

  async saveStatus(appId) {
    const status = document.getElementById('app-status').value;
    await this.setStatus(appId, status);
  },

  // ============================================================
  // 📅 Schedule Interview Modal (Feature 5)
  // ============================================================
  async scheduleModal(appId) {
    // Default: tomorrow at 10:00 AM
    const d = new Date(Date.now() + 86400000);
    d.setHours(10, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    const defaultTime =
      d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());

    // Build modal
    const modal = document.createElement('div');
    modal.id = 'schedule-interview-modal';
    modal.style.cssText =
      'position:fixed;inset:0;background:rgba(30,27,58,0.75);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;padding:20px;';

    modal.innerHTML =
      '<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;padding:26px;box-shadow:0 20px 60px rgba(0,0,0,0.4);">' +
        '<h2 style="margin-top:0;">📅 Schedule Interview</h2>' +

        '<label style="margin-top:14px;">Date & Time</label>' +
        '<input id="iv-when" type="datetime-local" value="' + defaultTime + '" style="width:100%;padding:10px;border:1px solid #e5dff5;border-radius:8px;" />' +

        '<label style="margin-top:12px;">Duration (minutes)</label>' +
        '<input id="iv-duration" type="number" value="30" min="5" max="240" style="width:100%;padding:10px;border:1px solid #e5dff5;border-radius:8px;" />' +

        '<label style="margin-top:12px;">Mode</label>' +
        '<select id="iv-mode" style="width:100%;padding:10px;border:1px solid #e5dff5;border-radius:8px;">' +
          '<option>Video</option><option>Phone</option><option>In-Person</option>' +
        '</select>' +

        '<label style="margin-top:12px;">Interviewer Name (optional)</label>' +
        '<input id="iv-interviewer" type="text" placeholder="e.g. Rajesh Kumar" style="width:100%;padding:10px;border:1px solid #e5dff5;border-radius:8px;" />' +

        '<label style="margin-top:12px;">Meeting Link (optional)</label>' +
        '<input id="iv-link" type="text" placeholder="https://meet.google.com/..." style="width:100%;padding:10px;border:1px solid #e5dff5;border-radius:8px;" />' +

        '<label style="margin-top:12px;">Notes (optional)</label>' +
        '<textarea id="iv-notes" style="width:100%;padding:10px;border:1px solid #e5dff5;border-radius:8px;min-height:60px;" placeholder="Any special instructions..."></textarea>' +

        '<div style="margin-top:18px;display:flex;gap:10px;justify-content:flex-end;">' +
          '<button class="btn btn-outline" onclick="document.getElementById(\'schedule-interview-modal\').remove()">Cancel</button>' +
          '<button class="btn" onclick="ApplicationsInbox.submitSchedule(' + appId + ')">Schedule</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
  },

  async submitSchedule(appId) {
    const when = document.getElementById('iv-when').value;
    const duration = parseInt(document.getElementById('iv-duration').value) || 30;
    const mode = document.getElementById('iv-mode').value;
    const interviewer = document.getElementById('iv-interviewer').value.trim();
    const link = document.getElementById('iv-link').value.trim();
    const notes = document.getElementById('iv-notes').value.trim();

    if (!when) { Toast.warn('Please pick a date and time'); return; }

    try {
      const res = await fetch('/api/portal/recruiter/schedule-interview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: appId,
          scheduled_at: when.replace('T', ' '),
          duration_minutes: duration,
          mode: mode,
          interviewer_name: interviewer,
          meeting_link: link,
          notes: notes
        })
      });
      const data = await res.json();
      if (!res.ok) {
        Toast.error(data.error || 'Failed to schedule');
        return;
      }
      document.getElementById('schedule-interview-modal').remove();
      Toast.success('Interview scheduled!');
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      Toast.error('Failed to schedule interview');
    }
  },
};

function statusBadge(s) {
  if (s === 'Shortlisted') return 'badge-strong';
  if (s === 'Rejected') return 'badge-low';
  if (s === 'Interview Scheduled') return 'badge-potential';
  if (s === 'Under Review') return 'badge-review';
  return 'badge-review';
}
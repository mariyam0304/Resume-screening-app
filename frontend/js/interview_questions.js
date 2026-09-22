// ============================================================
// Personalized Interview Questions
// Supports: ?app=<application_id>   (portal applicants)
//           ?candidate=<candidate_id>&jd=<jd_id>  (recruiter-uploaded)
// ============================================================
const InterviewQuestions = {
  async view(query) {
    const appId = parseInt(query && query.app);
    const candidateId = parseInt(query && query.candidate);
    const jdId = query && query.jd ? parseInt(query.jd) : null;

    const view = document.getElementById('view');
    if (!appId && !candidateId) {
      view.innerHTML = '<div class="card"><h2>Missing application or candidate ID</h2></div>';
      return;
    }
    view.innerHTML = '<h1>Generating questions...</h1>';

    let url = '';
    if (appId) {
      url = '/api/portal/recruiter/candidate-questions/' + appId;
    } else {
      url = '/api/portal/recruiter/candidate-questions-by-id/' + candidateId;
      if (jdId) url += '?jd_id=' + jdId;
    }

    let data = null;
    try {
      const res = await fetch(url);
      data = await res.json();
    } catch (e) {}

    if (!data || data.error) {
      const msg = (data && data.error) || 'Failed to generate questions';
      view.innerHTML =
        '<div class="card">' +
          '<h2>Could not generate questions</h2>' +
          '<p class="muted">' + msg + '</p>' +
          '<a class="btn btn-outline" href="#database">← Back to Candidates</a>' +
        '</div>';
      return;
    }

    const groups = {};
    (data.questions || []).forEach(function(q) {
      if (!groups[q.category]) groups[q.category] = [];
      groups[q.category].push(q);
    });

    let html = '';
    Object.keys(groups).forEach(function(cat) {
      html +=
        '<div class="card" style="margin-bottom:14px;">' +
          '<h3 style="margin-top:0;color:var(--primary-dark);">' + cat + '</h3>' +
          '<ol style="margin:8px 0 0 20px;padding:0;">' +
            groups[cat].map(function(q){
              return '<li style="padding:6px 0;">' + q.question +
                (q.severity === 'high' ? ' <span class="chip chip-red">critical</span>' : '') +
              '</li>';
            }).join('') +
          '</ol>' +
        '</div>';
    });

    if (html === '') html = '<div class="card"><p class="muted">No questions generated.</p></div>';

    view.innerHTML =
      '<h1>🎤 Interview Questions: ' + data.candidate_name + '</h1>' +
      '<p class="muted">Tailored to their resume and the <strong>' + data.jd_title + '</strong> role — ' + data.total + ' questions</p>' +
      '<div style="margin:12px 0;">' +
        '<button class="btn" onclick="window.print()">🖨 Print</button> ' +
        '<a class="btn btn-outline" href="#database">← Back to Candidates</a> ' +
        '<a class="btn btn-outline" href="#applications-inbox">← Back to Inbox</a>' +
      '</div>' +
      html;
  }
};

// ============================================================
// Leaderboard - Top candidates ranked by score
// ============================================================
const Leaderboard = {
  async view() {
    const view = document.getElementById('view');
    view.innerHTML = '<h1>Loading leaderboard...</h1>';

    let rows = [];
    try {
      const jds = await API.listJDs();
      for (const jd of jds) {
        try {
          const r = await API.getResults(jd.id);
          r.forEach(x => rows.push(Object.assign({}, x, { jd_title: jd.title })));
        } catch (e) {}
      }
    } catch (e) {}

    rows.sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
    const top = rows.slice(0, 20);

    const medal = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';

    view.innerHTML =
      '<h1>🏆 Candidate Leaderboard</h1>' +
      '<p class="muted">Top 20 candidates across all JDs, ranked by match score</p>' +
      '<div class="card">' +
        (top.length === 0
          ? '<p class="muted">No screening results yet. Run screening on a JD first.</p>'
          : '<table><thead><tr>' +
              '<th style="width:60px;">Rank</th><th>Candidate</th><th>JD</th><th>Match</th><th>Location</th><th>Status</th><th></th>' +
            '</tr></thead><tbody>' +
            top.map((r, i) =>
              '<tr>' +
                '<td style="font-size:18px;font-weight:800;">' + medal(i) + (i > 2 ? (i + 1) : '') + '</td>' +
                '<td><strong>' + (r.name || '-') + '</strong></td>' +
                '<td>' + (r.jd_title || '-') + '</td>' +
                '<td>' +
                  '<strong>' + r.overall_score + '%</strong>' +
                  '<div class="progress" style="margin-top:4px;"><span style="width:' + r.overall_score + '%"></span></div>' +
                '</td>' +
                '<td>' + (r.location || '-') + '</td>' +
                '<td><span class="badge ' + statusClass(r.status) + '">' + r.status + '</span></td>' +
                '<td><a class="btn btn-outline" href="#candidate?id=' + r.candidate_id + '">View</a></td>' +
              '</tr>'
            ).join('') + '</tbody></table>') +
      '</div>';
  }
};

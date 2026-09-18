const Compare = {
  selected: [],
  async view() {
    const view = document.getElementById('view');
    const candidates = await API.listCandidates();
    view.innerHTML =
      '<h1>Compare Candidates</h1>' +
      '<div class="card">' +
        '<h3>Select candidates to compare</h3>' +
        '<div class="grid">' +
          candidates.map(c =>
            '<label style="display:block;background:#fff;border:1px solid var(--border);padding:10px;border-radius:8px;">' +
              '<input type="checkbox" value="' + c.id + '" onchange="Compare.toggle(' + c.id + ', this.checked)" /> ' +
              c.name + ' - ' + c.experience + 'y - ' + (c.location || '-') +
            '</label>'
          ).join('') +
        '</div>' +
        '<button class="btn" style="margin-top:12px;" onclick="Compare.render()">Compare</button>' +
      '</div>' +
      '<div id="compare-result"></div>';
  },

  toggle(id, checked) {
    if (checked) this.selected.push(id);
    else this.selected = this.selected.filter(x => x !== id);
  },

  async render() {
    const el = document.getElementById('compare-result');
    if (this.selected.length < 2) { el.innerHTML = '<div class="card">Select at least 2 candidates.</div>'; return; }
    const data = await Promise.all(this.selected.map(id => API.getCandidate(id)));
    const rows = [
      ['Location', c => c.location],
      ['Experience', c => c.experience + 'y'],
      ['Designation', c => c.current_designation],
      ['Company', c => c.current_company],
      ['Notice', c => c.notice],
      ['Expected CTC', c => c.expected_salary],
      ['Skills', c => (c.skills || []).slice(0, 8).join(', ')],
    ];
    el.innerHTML =
      '<div class="card">' +
        '<table>' +
          '<thead><tr><th>Field</th>' + data.map(c => '<th>' + c.name + '</th>').join('') + '</tr></thead>' +
          '<tbody>' +
            rows.map(row =>
              '<tr><td><strong>' + row[0] + '</strong></td>' + data.map(c => '<td>' + (row[1](c) || '-') + '</td>').join('') + '</tr>'
            ).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';
  },
};

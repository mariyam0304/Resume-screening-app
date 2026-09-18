const Questions = {
  async view(query) {
    const jds = await API.listJDs();
    const view = document.getElementById('view');
    const preselect = (query && query.jd) || (jds[0] ? jds[0].id : '');
    view.innerHTML =
      '<h1>Screening Questions</h1>' +
      '<div class="card">' +
        '<label>Select JD</label>' +
        '<select id="jd-select">' +
          jds.map(j => '<option value="' + j.id + '"' + (String(j.id) === String(preselect) ? ' selected' : '') + '>' + j.title + '</option>').join('') +
        '</select>' +
        '<button class="btn" style="margin-top:12px;" onclick="Questions.generate()">Generate Questions</button>' +
      '</div>' +
      '<div id="questions-result"></div>';
    if (preselect) this.generate();
  },

  async generate() {
    const jdId = document.getElementById('jd-select').value;
    const qs = await API.generateQuestions(jdId);
    const el = document.getElementById('questions-result');
    el.innerHTML =
      '<div class="card">' +
        '<h2>Generated Questions (' + qs.length + ')</h2>' +
        '<ol>' +
          qs.map(q => '<li><strong>[' + q.category + ']</strong> ' + q.question + '</li>').join('') +
        '</ol>' +
      '</div>';
  },
};

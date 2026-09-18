const Upload = {
  async view() {
    const view = document.getElementById('view');
    view.innerHTML =
      '<h1>Upload Resumes</h1>' +
      '<div class="card">' +
        '<input type="file" id="files" multiple accept=".pdf,.docx,.doc,.txt" />' +
        '<p class="muted">Supported: PDF, DOCX, DOC, TXT (max 10MB each)</p>' +
        '<button class="btn" id="upload-btn" style="margin-top:12px;">Upload & Parse</button>' +
      '</div>' +
      '<div id="upload-result"></div>';
    document.getElementById('upload-btn').onclick = async () => {
      const files = document.getElementById('files').files;
      if (!files.length) return alert('Select at least one file');
      const fd = new FormData();
      for (let i = 0; i < files.length; i++) fd.append('files', files[i]);
      try {
        const res = await API.uploadResumes(fd);
        Upload.showResult(res);
      } catch (e) { alert('Upload failed'); }
    };
  },

  showResult(res) {
    const el = document.getElementById('upload-result');
    el.innerHTML =
      '<div class="card">' +
        '<h2>Uploaded: ' + res.uploaded.length + '</h2>' +
        '<ul>' + res.uploaded.map(u => '<li>' + u.name + ' (ID ' + u.id + ')</li>').join('') + '</ul>' +
        (res.duplicates.length
          ? '<h3>Possible duplicates</h3><ul>' + res.duplicates.map(d => '<li>' + d.file + ' - ' + d.warning + '</li>').join('') + '</ul>'
          : '') +
        (res.errors.length
          ? '<h3>Errors</h3><ul>' + res.errors.map(e => '<li>' + e.file + ' - ' + e.error + '</li>').join('') + '</ul>'
          : '') +
      '</div>';
  }
};

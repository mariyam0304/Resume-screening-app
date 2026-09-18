const API_BASE = '/api';

async function api(path, options = {}) {
  const opts = {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
  }
  if (opts.body instanceof FormData) {
    delete opts.headers['Content-Type'];
  }
  const res = await fetch(API_BASE + path, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw Object.assign(new Error('API error'), { status: res.status, data });
  return data;
}

const API = {
  register: (b) => api('/auth/register', { method: 'POST', body: b }),
  login: (b) => api('/auth/login', { method: 'POST', body: b }),
  logout: () => api('/auth/logout', { method: 'POST' }),
  me: () => api('/auth/me'),

  createJD: (b) => api('/jd/', { method: 'POST', body: b }),
  listJDs: () => api('/jd/'),
  getJD: (id) => api('/jd/' + id),
  updateJD: (id, b) => api('/jd/' + id, { method: 'PUT', body: b }),
  deleteJD: (id) => api('/jd/' + id, { method: 'DELETE' }),

  uploadResumes: (formData) => api('/resume/upload', { method: 'POST', body: formData }),

  runScreening: (b) => api('/screening/run', { method: 'POST', body: b }),
  getResults: (jdId) => api('/screening/results/' + jdId),
  filterResults: (jdId, b) => api('/screening/filter/' + jdId, { method: 'POST', body: b }),

  listCandidates: () => api('/candidate/'),
  getCandidate: (id) => api('/candidate/' + id),
  setStatus: (id, status) => api('/candidate/' + id + '/status', { method: 'POST', body: { status } }),
  addNote: (id, b) => api('/candidate/' + id + '/notes', { method: 'POST', body: b }),
  getNotes: (id) => api('/candidate/' + id + '/notes'),
  candidateResults: (id) => api('/candidate/' + id + '/results'),
  deleteCandidate: (id) => api('/candidate/' + id, { method: 'DELETE' }),
  bulkDeleteCandidates: (ids) => api('/candidate/bulk-delete', { method: 'POST', body: { ids: ids } }),

  generateQuestions: (jdId) => api('/questions/generate', { method: 'POST', body: { jd_id: jdId } }),
  saveInterview: (b) => api('/questions/interview', { method: 'POST', body: b }),
  interviewSummary: (b) => api('/questions/interview/summary', { method: 'POST', body: b }),

  exportCSV: (id) => window.open(API_BASE + '/export/csv/' + id),
  exportExcel: (id) => window.open(API_BASE + '/export/excel/' + id),
  exportPDF: (id) => window.open(API_BASE + '/export/pdf/' + id),
};


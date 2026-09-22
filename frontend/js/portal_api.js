// Phase 2: Candidate Portal API wrapper
const PortalAPI_BASE = '/api/portal';

async function portalApi(path, options = {}) {
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
  const res = await fetch(PortalAPI_BASE + path, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw Object.assign(new Error('Portal API error'), { status: res.status, data });
  return data;
}

const PortalAPI = {
  register: (b) => portalApi('/register', { method: 'POST', body: b }),
  login: (b) => portalApi('/login', { method: 'POST', body: b }),
  logout: () => portalApi('/logout', { method: 'POST' }),
  me: () => portalApi('/me'),
  updateProfile: (b) => portalApi('/profile', { method: 'POST', body: b }),
  uploadResume: (formData) => portalApi('/resume', { method: 'POST', body: formData }),
  downloadResume: () => window.open(PortalAPI_BASE + '/resume/download'),
  myApplications: () => portalApi('/applications'),
};

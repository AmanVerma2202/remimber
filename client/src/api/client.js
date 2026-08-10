import axios from 'axios';

/**
 * Shared axios instance. The dev server proxies /api and /auth to Express,
 * and the JWT travels in an httpOnly cookie automatically (withCredentials).
 */
const client = axios.create({ withCredentials: true });

/** Layer on top of axios so callers get data directly (or a thrown error). */
export const api = {
  get: (...args) => client.get(...args).then((r) => r.data),
  post: (...args) => client.post(...args).then((r) => r.data),
  patch: (...args) => client.patch(...args).then((r) => r.data),
  delete: (...args) => client.delete(...args).then((r) => r.data),
};

// ---- auth ----
export const auth = {
  me: () => api.get('/auth/me'),
  signup: (body) => api.post('/auth/signup', body),
  login: (body) => api.post('/auth/login', body),
  logout: () => api.post('/auth/logout'),
  saveTheme: (theme) => api.patch('/auth/me/theme', { theme }),
};

// ---- notes ----
export const notes = {
  list: (params) => api.get('/api/notes', { params }),
  get: (id) => api.get(`/api/notes/${id}`),
  create: (title) => api.post('/api/notes', { title }),
  update: (id, body) => api.patch(`/api/notes/${id}`, body),
  remove: (id) => api.delete(`/api/notes/${id}`),
  importPdf: (formData) => api.post('/api/notes/import-pdf', formData),
  // invite-link sharing
  share: (id, body) => api.post(`/api/notes/${id}/share`, body),
  unshare: (id) => api.delete(`/api/notes/${id}/share`),
  shared: (code) => api.get(`/api/notes/share/${code}`),
  shareUpdate: (code, body) => api.patch(`/api/notes/share/${code}`, body),
};

// ---- uploads ----
export const upload = {
  image: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/api/upload/image', fd);
  },
};
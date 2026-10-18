import { api } from './client.js';

const unwrap = (res) => res.data;

export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then(unwrap),
  me: () => api.get('/auth/me').then(unwrap),
  updateMe: (payload) => api.patch('/auth/me', payload).then(unwrap),
  changePassword: (payload) => api.post('/auth/change-password', payload).then(unwrap),
  listUsers: () => api.get('/auth/users').then(unwrap),
  register: (payload) => api.post('/auth/register', payload).then(unwrap),
  updateUser: (id, payload) => api.patch(`/auth/users/${id}`, payload).then(unwrap),
  deleteUser: (id) => api.delete(`/auth/users/${id}`).then(unwrap),
};

export const leadsApi = {
  list: (params) => api.get('/leads', { params }).then(unwrap),
  get: (id) => api.get(`/leads/${id}`).then(unwrap),
  create: (payload) => api.post('/leads', payload).then(unwrap),
  update: (id, payload) => api.patch(`/leads/${id}`, payload).then(unwrap),
  changeStage: (id, payload) => api.patch(`/leads/${id}/stage`, payload).then(unwrap),
  convert: (id, payload) => api.post(`/leads/${id}/convert`, payload).then(unwrap),
  bulk: (payload) => api.patch('/leads/bulk', payload).then(unwrap),
  remove: (id) => api.delete(`/leads/${id}`).then(unwrap),
};

export const trialsApi = {
  list: (params) => api.get('/trials', { params }).then(unwrap),
  get: (id) => api.get(`/trials/${id}`).then(unwrap),
  create: (payload) => api.post('/trials', payload).then(unwrap),
  update: (id, payload) => api.patch(`/trials/${id}`, payload).then(unwrap),
  review: (id, payload) => api.post(`/trials/${id}/review`, payload).then(unwrap),
  remove: (id) => api.delete(`/trials/${id}`).then(unwrap),
};

export const followupsApi = {
  list: (params) => api.get('/followups', { params }).then(unwrap),
  create: (payload) => api.post('/followups', payload).then(unwrap),
  update: (id, payload) => api.patch(`/followups/${id}`, payload).then(unwrap),
  attempt: (id, payload) => api.post(`/followups/${id}/attempt`, payload).then(unwrap),
  complete: (id, payload) => api.post(`/followups/${id}/complete`, payload).then(unwrap),
  remove: (id) => api.delete(`/followups/${id}`).then(unwrap),
};

export const studentsApi = {
  list: (params) => api.get('/students', { params }).then(unwrap),
  get: (id) => api.get(`/students/${id}`).then(unwrap),
  create: (payload, { force } = {}) =>
    api.post('/students', payload, { params: force ? { force: 1 } : {} }).then(unwrap),
  update: (id, payload) => api.patch(`/students/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/students/${id}`).then(unwrap),
  merge: (id, sourceId) => api.post(`/students/${id}/merge`, { sourceId }).then(unwrap),

  // One subject a student studies: its own tutor, package and sessions.
  addEnrollment: (id, payload) => api.post(`/students/${id}/enrollments`, payload).then(unwrap),
  updateEnrollment: (id, enrollmentId, payload) =>
    api.patch(`/students/${id}/enrollments/${enrollmentId}`, payload).then(unwrap),
  removeEnrollment: (id, enrollmentId) =>
    api.delete(`/students/${id}/enrollments/${enrollmentId}`).then(unwrap),
  logSession: (id, enrollmentId, payload = {}) =>
    api.post(`/students/${id}/enrollments/${enrollmentId}/log-session`, payload).then(unwrap),
  renew: (id, enrollmentId, payload) =>
    api.post(`/students/${id}/enrollments/${enrollmentId}/renew`, payload).then(unwrap),
};

export const dashboardApi = {
  summary: (params) => api.get('/dashboard', { params }).then(unwrap),
  today: (params) => api.get('/dashboard/today', { params }).then(unwrap),
};

export const reportsApi = {
  weekly: (params) => api.get('/reports/weekly', { params }).then(unwrap),
  history: () => api.get('/reports/weekly/history').then(unwrap),
  save: (weekKey, payload) => api.put(`/reports/weekly/${weekKey}`, payload).then(unwrap),
};

export const listsApi = {
  all: () => api.get('/lists').then(unwrap),
};

export const activityApi = {
  list: (params) => api.get('/activity', { params }).then(unwrap),
};

import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// The auth token lives in an HttpOnly cookie, so requests just send credentials.
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
})

let onUnauthorized = null
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''
    if (status === 401 && onUnauthorized && !url.startsWith('/auth/')) onUnauthorized()
    return Promise.reject(error)
  }
)

/** Human-readable message from any API error. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond.'
  if (error?.message === 'Network Error') return 'Cannot reach the server. Is the backend running?'
  return fallback
}

/** Field errors from a validation response, keyed by field name. */
export function fieldErrors(error) {
  const list = error?.response?.data?.errors
  if (!Array.isArray(list)) return {}
  return list.reduce((acc, e) => ({ ...acc, [e.field]: acc[e.field] || e.message }), {})
}

/** Absolute URL for an attachment served by the API. */
export function fileUrl(path) {
  if (!path) return ''
  if (/^https?:/.test(path)) return path
  return API_BASE_URL.replace(/\/api\/?$/, '') + path
}

const data = (p) => p.then((r) => r.data)

export const authApi = {
  login: (body) => data(api.post('/auth/login', body)),
  register: (body) => data(api.post('/auth/register', body)),
  me: () => data(api.get('/auth/me')),
  logout: () => data(api.post('/auth/logout')),
  updateProfile: (body) => data(api.patch('/auth/me', body)),
  changePassword: (body) => data(api.patch('/auth/password', body)),
}

export const complaintApi = {
  create: (formData) => data(api.post('/complaints', formData)),
  mine: (params) => data(api.get('/complaints/my', { params })),
  myStats: () => data(api.get('/complaints/my/stats')),
  track: (code) => data(api.get(`/complaints/track/${encodeURIComponent(code)}`)),
  get: (id) => data(api.get(`/complaints/${id}`)),
  update: (id, body) => data(api.patch(`/complaints/${id}`, body)),
  upload: (id, formData) => data(api.post(`/complaints/${id}/attachments`, formData)),
  addNote: (id, body) => data(api.post(`/complaints/${id}/notes`, body)),
  close: (id, body = {}) => data(api.post(`/complaints/${id}/close`, body)),
  requestReopen: (id, body) => data(api.post(`/complaints/${id}/reopen-request`, body)),
  feedback: (id, body) => data(api.post(`/complaints/${id}/feedback`, body)),
}

export const adminApi = {
  complaints: (params) => data(api.get('/admin/complaints', { params })),
  setStatus: (id, body) => data(api.patch(`/admin/complaints/${id}/status`, body)),
  assign: (id, body) => data(api.patch(`/admin/complaints/${id}/assign`, body)),
  setPriority: (id, body) => data(api.patch(`/admin/complaints/${id}/priority`, body)),
  users: (params) => data(api.get('/admin/users', { params })),
  createUser: (body) => data(api.post('/admin/users', body)),
  updateUser: (id, body) => data(api.patch(`/admin/users/${id}`, body)),
  staff: () => data(api.get('/admin/staff')),
  createCategory: (body) => data(api.post('/admin/categories', body)),
  updateCategory: (id, body) => data(api.patch(`/admin/categories/${id}`, body)),
  reports: (params) => data(api.get('/admin/reports', { params })),
}

export const staffApi = {
  complaints: (params) => data(api.get('/staff/complaints', { params })),
  stats: () => data(api.get('/staff/stats')),
  setStatus: (id, body) => data(api.patch(`/staff/complaints/${id}/status`, body)),
}

export const commonApi = {
  meta: () => data(api.get('/meta')),
  categories: (params) => data(api.get('/categories', { params })),
  notifications: (params) => data(api.get('/notifications', { params })),
  markRead: (id) => data(api.patch(`/notifications/${id}/read`)),
  markAllRead: () => data(api.patch('/notifications/read-all')),
}

export default api

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

// Requests where a 401 means "wrong credentials", not "access token expired".
const NO_REFRESH = ['/auth/login', '/auth/2fa/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email']

// One refresh at a time; parallel requests wait for the same promise.
let refreshing = null
export function refreshSession() {
  refreshing ??= api.post('/auth/refresh').finally(() => {
    refreshing = null
  })
  return refreshing
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status
    const config = error.config || {}
    const url = config.url || ''
    if (status === 401 && !config._retried && !NO_REFRESH.some((p) => url.startsWith(p))) {
      config._retried = true
      try {
        await refreshSession()
        return api(config) // retry once with the new access token
      } catch {
        onUnauthorized?.()
      }
    }
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
  loginTwoFactor: (body) => data(api.post('/auth/2fa/login', body)),
  verifyEmail: (token) => data(api.post('/auth/verify-email', { token })),
  resendVerification: () => data(api.post('/auth/resend-verification')),
  forgotPassword: (email) => data(api.post('/auth/forgot-password', { email })),
  resetPassword: (body) => data(api.post('/auth/reset-password', body)),
  setupTwoFactor: () => data(api.post('/auth/2fa/setup')),
  enableTwoFactor: (code) => data(api.post('/auth/2fa/enable', { code })),
  disableTwoFactor: (body) => data(api.post('/auth/2fa/disable', body)),
  sessions: () => data(api.get('/auth/sessions')),
  revokeSession: (id) => data(api.delete(`/auth/sessions/${id}`)),
  revokeOtherSessions: () => data(api.post('/auth/sessions/revoke-others')),
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
  messages: (id) => data(api.get(`/complaints/${id}/messages`)),
  sendMessage: (id, text) => data(api.post(`/complaints/${id}/messages`, { text })),
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
  auditLogs: (params) => data(api.get('/admin/audit-logs', { params })),
  online: () => data(api.get('/admin/online')),
  slaPolicies: () => data(api.get('/admin/sla-policies')),
  saveSlaPolicy: (body) => data(api.put('/admin/sla-policies', body)),
  deleteSlaPolicy: (id) => data(api.delete(`/admin/sla-policies/${id}`)),
  slaReport: (params) => data(api.get('/admin/reports/sla', { params })),
  jobs: () => data(api.get('/admin/jobs')),
  runJob: (name) => data(api.post(`/admin/jobs/${name}/run`)),
  createLocation: (body) => data(api.post('/admin/locations', body)),
  suggestStaff: (id) => data(api.get(`/admin/complaints/${id}/suggest-staff`)),
  updateStaffProfile: (id, body) => data(api.put(`/admin/staff/${id}/profile`, body)),
  permissions: () => data(api.get('/permissions')),
  createAsset: (body) => data(api.post('/admin/assets', body)),
  updateAsset: (id, body) => data(api.patch(`/admin/assets/${id}`, body)),
  createPart: (body) => data(api.post('/admin/parts', body)),
  updatePart: (id, body) => data(api.patch(`/admin/parts/${id}`, body)),
  addStock: (id, body) => data(api.post(`/admin/parts/${id}/stock`, body)),
  partMovements: (id) => data(api.get(`/admin/parts/${id}/movements`)),
  setWorkOrderLimits: (body) => data(api.put('/admin/work-orders/limits', body)),
  updateLocation: (id, body) => data(api.patch(`/admin/locations/${id}`, body)),
}

export const staffApi = {
  complaints: (params) => data(api.get('/staff/complaints', { params })),
  stats: () => data(api.get('/staff/stats')),
  setStatus: (id, body) => data(api.patch(`/staff/complaints/${id}/status`, body)),
}

export const opsApi = {
  assets: (params) => data(api.get('/assets', { params })),
  asset: (id) => data(api.get(`/assets/${id}`)),
  assetByCode: (code) => data(api.get(`/assets/code/${encodeURIComponent(code)}`)),
  parts: (params) => data(api.get('/parts', { params })),
  partsUsed: (id) => data(api.get(`/complaints/${id}/parts`)),
  useParts: (id, body) => data(api.post(`/complaints/${id}/parts`, body)),
  workOrders: (id) => data(api.get(`/complaints/${id}/work-orders`)),
  raiseWorkOrder: (id, body) => data(api.post(`/complaints/${id}/work-orders`, body)),
  approvals: (params) => data(api.get('/work-orders', { params })),
  decide: (id, body) => data(api.post(`/work-orders/${id}/decision`, body)),
  completeWorkOrder: (id) => data(api.post(`/work-orders/${id}/complete`)),
  limits: () => data(api.get('/work-orders/limits')),
  deptComplaints: (params) => data(api.get('/dept/complaints', { params })),
  deptStats: () => data(api.get('/dept/stats')),
}

export const locationApi = {
  tree: (params) => data(api.get('/locations', { params })),
  stats: () => data(api.get('/locations/stats')),
  byCode: (code) => data(api.get(`/locations/code/${encodeURIComponent(code)}`)),
}

export const commonApi = {
  meta: () => data(api.get('/meta')),
  categories: (params) => data(api.get('/categories', { params })),
  notifications: (params) => data(api.get('/notifications', { params })),
  markRead: (id) => data(api.patch(`/notifications/${id}/read`)),
  markAllRead: () => data(api.patch('/notifications/read-all')),
}

export default api

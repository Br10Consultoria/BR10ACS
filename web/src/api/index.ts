import api from './client'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
}

// ── Devices ───────────────────────────────────────────────────────────────────
export const devicesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/devices', { params }),
  get: (id: string) => api.get(`/devices/${id}`),
  rawParams: (id: string) => api.get(`/devices/${id}/raw-params`),
  reboot: (id: string) => api.post(`/devices/${id}/reboot`),
  factoryReset: (id: string) => api.post(`/devices/${id}/factory-reset`),
  connectionRequest: (id: string) => api.post(`/devices/${id}/connection-request`),
  setParam: (id: string, name: string, value: string) =>
    api.post(`/devices/${id}/set-param`, { name, value }),
  timeseries: (id: string, metric: string, hours = 24) =>
    api.get(`/devices/${id}/timeseries`, { params: { metric, hours } }),
  diagnostics: (id: string, type: string, params?: Record<string, unknown>) =>
    api.post(`/devices/${id}/diagnostics/${type}`, params),
  diagnosticsResult: (id: string, type: 'ping' | 'traceroute' | 'speedtest') =>
    api.get(`/devices/${id}/diagnostics/${type}/result`),
  diagnosticsHistory: (id: string, type?: string, limit = 20) =>
    api.get(`/devices/${id}/diagnostics/history`, { params: { type, limit } }),
  stats: () => api.get('/devices/stats'),
}

// ── Logs ──────────────────────────────────────────────────────────────────────
export const logsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/logs', { params }),
  clear: (before?: string) => api.delete('/logs', { params: { before } }),
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsApi = {
  getAll: () => api.get('/settings'),
  update: (key: string, value: unknown) =>
    api.put(`/settings/${key}`, { value }),
  updateMany: (settings: Record<string, unknown>) =>
    api.put('/settings', {
      settings: Object.entries(settings).map(([key, value]) => ({ key, value })),
    }),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users'),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: Record<string, unknown>) => api.post('/users', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  changePassword: (id: string, password: string) =>
    api.patch(`/users/${id}/password`, { password }),
}

// ── Mass Ops ──────────────────────────────────────────────────────────────────
export const massOpsApi = {
  list: (params?: Record<string, unknown>) => api.get('/mass-ops', { params }),
  create: (data: Record<string, unknown>) => api.post('/mass-ops', data),
  get: (id: string) => api.get(`/mass-ops/${id}`),
  cancel: (id: string) => api.post(`/mass-ops/${id}/cancel`),
}

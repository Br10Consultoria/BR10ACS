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
  aiAnalysis: (id: string) =>
    api.post(`/devices/${id}/diagnostics/ai-analysis`),
  stats: () => api.get('/devices/stats'),
  refresh: (id: string) => api.post(`/devices/${id}/refresh`),
  delete: (id: string) => api.delete(`/devices/${id}`),
  addTag: (id: string, tag: string) => api.post(`/devices/${id}/tags/${encodeURIComponent(tag)}`),
  removeTag: (id: string, tag: string) => api.delete(`/devices/${id}/tags/${encodeURIComponent(tag)}`),
  getTimeSeries: (id: string, from?: string, to?: string, limit = 200) =>
    api.get(`/devices/${id}/timeseries`, { params: { from, to, limit } }),
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

// ── Presets & Provisions ──────────────────────────────────────────────────────
export const presetsApi = {
  listPresets: () => api.get('/presets'),
  putPreset: (name: string, body: object) =>
    api.put(`/presets/${encodeURIComponent(name)}`, body),
  deletePreset: (name: string) =>
    api.delete(`/presets/${encodeURIComponent(name)}`),
  listProvisions: () => api.get('/presets/provisions'),
  putProvision: (name: string, script: string) =>
    api.put(`/presets/provisions/${encodeURIComponent(name)}`, { script }),
  deleteProvision: (name: string) =>
    api.delete(`/presets/provisions/${encodeURIComponent(name)}`),
  applyTemplate: (oui: string, productClass?: string) =>
    api.post('/presets/apply-template', { oui, productClass }),
}

// ── Alerts ───────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: (params?: Record<string, unknown>) => api.get('/alerts', { params }),
  countUnacknowledged: () => api.get('/alerts/count/unacknowledged'),
  acknowledge: (id: string) => api.post(`/alerts/${id}/acknowledge`),
  acknowledgeAll: (deviceId?: string) => api.post('/alerts/acknowledge-all', { deviceId }),
}

// ── Files ─────────────────────────────────────────────────────────────────────
export const filesApi = {
  listFiles: () => api.get('/files'),
  uploadFile: (formData: FormData, fileType: string) =>
    api.post(`/files/upload?fileType=${encodeURIComponent(fileType)}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteFile: (fileName: string) =>
    api.delete(`/files/${encodeURIComponent(fileName)}`),
}

// ── Export ────────────────────────────────────────────────────────────────────
const downloadBlob = async (url: string, filename: string) => {
  const token = localStorage.getItem('token')
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const blob = await r.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(blobUrl)
}

// ── AutoConfig ───────────────────────────────────────────────────────────────────
export const autoconfigApi = {
  list: () => api.get('/autoconfig'),
  stats: () => api.get('/autoconfig/stats'),
  get: (id: string) => api.get(`/autoconfig/${id}`),
  create: (data: Record<string, unknown>) => api.post('/autoconfig', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/autoconfig/${id}`, data),
  delete: (id: string) => api.delete(`/autoconfig/${id}`),
  applyToDevice: (deviceId: string) => api.post(`/autoconfig/apply/${deviceId}`),
  applyAll: () => api.post('/autoconfig/apply-all'),
  dryRun: (deviceId: string) => api.get(`/autoconfig/dry-run/${deviceId}`),
}

// ── Integrations / ERP ───────────────────────────────────────────────────────
export const integrationsApi = {
  list: () => api.get('/integrations'),
  get: (id: string) => api.get(`/integrations/${id}`),
  create: (data: Record<string, unknown>) => api.post('/integrations', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/integrations/${id}`, data),
  delete: (id: string) => api.delete(`/integrations/${id}`),
  getAdapters: () => api.get('/integrations/adapters'),
  getAdapterDefaults: (type: string) => api.get(`/integrations/adapters/${type}`),
  testConnection: (id: string) => api.post(`/integrations/${id}/test-connection`),
  lookupCustomer: (id: string, params: { pppoe?: string; serial?: string; cpf?: string }) =>
    api.get(`/integrations/${id}/lookup`, { params }),
}

export const exportApi = {
  downloadExcel: (params?: Record<string, string>) => {
    const base = String(api.defaults.baseURL || '')
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return downloadBlob(`${base}/devices/export/excel${qs}`, `dispositivos_${new Date().toISOString().slice(0, 10)}.xlsx`)
  },
  downloadPdf: (params?: Record<string, string>) => {
    const base = String(api.defaults.baseURL || '')
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return downloadBlob(`${base}/devices/export/pdf${qs}`, `dispositivos_${new Date().toISOString().slice(0, 10)}.pdf`)
  },
}

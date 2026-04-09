import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (!refresh) throw new Error('No refresh token')
        const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refresh })
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:   (email, password) => api.post('/auth/login', { email, password }),
  me:      ()                => api.get('/auth/me'),
  refresh: (refresh_token)   => api.post('/auth/refresh', { refresh_token }),
}

// ── Patients ──────────────────────────────────────────────────────────────────
export const patientsApi = {
  list:       (params) => api.get('/patients',      { params }),
  get:        (id)     => api.get(`/patients/${id}`),
  create:     (data)   => api.post('/patients',     data),
  update:     (id, data) => api.patch(`/patients/${id}`, data),
  deactivate: (id)     => api.delete(`/patients/${id}`),
}

// ── Medical History Versions ──────────────────────────────────────────────────
export const medicalHistoryApi = {
  list: (patientId) => api.get(`/patients/${patientId}/medical-history`),
}

// ── Clinical Records ──────────────────────────────────────────────────────────
export const clinicalApi = {
  // CR-001 Dental Chart
  getChart:   (patientId)         => api.get(`/patients/${patientId}/dental-chart`),
  patchChart: (patientId, data)   => api.patch(`/patients/${patientId}/dental-chart`, data),

  // CR-002 Clinical Notes
  listNotes:   (patientId)         => api.get(`/patients/${patientId}/clinical-notes`),
  createNote:  (patientId, data)   => api.post(`/patients/${patientId}/clinical-notes`, data),
  updateNote:  (patientId, noteId, data) => api.patch(`/patients/${patientId}/clinical-notes/${noteId}`, data),

  // CR-003 Perio Exams
  listPerio:   (patientId)         => api.get(`/patients/${patientId}/perio-exams`),
  createPerio: (patientId, data)   => api.post(`/patients/${patientId}/perio-exams`, data),
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsApi = {
  list:   (patientId)          => api.get(`/patients/${patientId}/documents`),
  upload: (patientId, formData) => api.post(`/patients/${patientId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (patientId, docId)   => api.delete(`/patients/${patientId}/documents/${docId}`),
}

// ── Appointments / Schedule ───────────────────────────────────────────────────
export const appointmentsApi = {
  list:         (params)   => api.get('/appointments',                        { params }),
  get:          (id)       => api.get(`/appointments/${id}`),
  create:       (data)     => api.post('/appointments',                       data),
  update:       (id, data) => api.patch(`/appointments/${id}`,                data),
  updateStatus: (id, data) => api.patch(`/appointments/${id}/status`,         data),
  reschedule:   (id, data) => api.patch(`/appointments/${id}/reschedule`,     data),
  availability: (params)   => api.get('/appointments/availability',           { params }),
  doctors:      ()         => api.get('/appointments/doctors'),
}

// ── Treatments (records per patient) ─────────────────────────────────────────
export const treatmentsApi = {
  list:   (params)   => api.get('/treatments',          { params }),
  get:    (id)       => api.get(`/treatments/${id}`),
  create: (data)     => api.post('/treatments',         data),
  update: (id, data) => api.patch(`/treatments/${id}`,  data),
  delete: (id)       => api.delete(`/treatments/${id}`),
  catalog: {
    list:   (params) => api.get('/treatment-catalog',         { params }),
    create: (data)   => api.post('/treatment-catalog',        data),
    update: (id, d)  => api.patch(`/treatment-catalog/${id}`, d),
    delete: (id)     => api.delete(`/treatment-catalog/${id}`),
  },
}

// ── Treatment Plans (TP-001 / TP-002) ────────────────────────────────────────
export const treatmentPlansApi = {
  // Plan CRUD
  list:          (params)        => api.get('/treatment-plans',                        { params }),
  get:           (id)            => api.get(`/treatment-plans/${id}`),
  create:        (data)          => api.post('/treatment-plans',                       data),
  update:        (id, data)      => api.patch(`/treatment-plans/${id}`,                data),
  delete:        (id)            => api.delete(`/treatment-plans/${id}`),

  // Versioning
  versions:      (id)            => api.get(`/treatment-plans/${id}/versions`),

  // Phases within a plan
  addPhase:      (id, data)      => api.post(`/treatment-plans/${id}/phases`,          data),
  updatePhase:   (id, phId, d)   => api.patch(`/treatment-plans/${id}/phases/${phId}`, d),
  deletePhase:   (id, phId)      => api.delete(`/treatment-plans/${id}/phases/${phId}`),

  // Procedures within a phase
  addProcedure:  (id, phId, d)   => api.post(`/treatment-plans/${id}/phases/${phId}/procedures`,          d),
  updateProcedure:(id,phId,prId,d)=> api.patch(`/treatment-plans/${id}/phases/${phId}/procedures/${prId}`,d),
  deleteProcedure:(id,phId,prId) => api.delete(`/treatment-plans/${id}/phases/${phId}/procedures/${prId}`),

  // Consent
  sendConsent:   (id, data)      => api.post(`/treatment-plans/${id}/consent`,         data),
  signConsent:   (id, data)      => api.patch(`/treatment-plans/${id}/consent`,        data),

  // PDF / print
  pdfUrl:        (id)            => `/api/v1/treatment-plans/${id}/pdf`,
}

// ── Billing ───────────────────────────────────────────────────────────────────
export const billingApi = {
  list:          (params)        => api.get('/billing',                        { params }),
  get:           (id)            => api.get(`/billing/${id}`),
  create:        (data)          => api.post('/billing',                       data),
  update:        (id, data)      => api.patch(`/billing/${id}`,                data),
  recordPayment: (id, data)      => api.patch(`/billing/${id}/payment`,        data),
  delete:        (id)            => api.delete(`/billing/${id}`),
  pdfUrl:        (id, fmt='a4')  => `/api/v1/billing/${id}/pdf?format=${fmt}`,
  send:          (id, data)      => api.post(`/billing/${id}/send`,            data),
}

// ── Inventory ─────────────────────────────────────────────────────────────────
export const inventoryApi = {
  list:   (params)   => api.get('/inventory',          { params }),
  get:    (id)       => api.get(`/inventory/${id}`),
  create: (data)     => api.post('/inventory',         data),
  update: (id, data) => api.patch(`/inventory/${id}`,  data),
  delete: (id)       => api.delete(`/inventory/${id}`),
}

// ── Users / Staff ─────────────────────────────────────────────────────────────
export const usersApi = {
  list:   (params)   => api.get('/users',          { params }),
  get:    (id)       => api.get(`/users/${id}`),
  create: (data)     => api.post('/users',         data),
  update: (id, data) => api.patch(`/users/${id}`,  data),
}

// ── Doctors ───────────────────────────────────────────────────────────────────
export const doctorsApi = {
  list: (params) => api.get('/doctors', { params }),
  get:  (id)     => api.get(`/doctors/${id}`),
}

// ── Prescriptions ─────────────────────────────────────────────────────────────
export const prescriptionsApi = {
  list:   (params)      => api.get('/prescriptions',          { params }),
  get:    (id)          => api.get(`/prescriptions/${id}`),
  create: (data)        => api.post('/prescriptions',          data),
  update: (id, data)    => api.patch(`/prescriptions/${id}`,   data),
  delete: (id)          => api.delete(`/prescriptions/${id}`),
}

// ── Admin Accounts ────────────────────────────────────────────────────────────
export const adminApi = {
  listAccounts:      (params)      => api.get('/admin/accounts',                     { params }),
  getAccount:        (id)          => api.get(`/admin/accounts/${id}`),
  createAccount:     (data)        => api.post('/admin/accounts',                    data),
  updateAccount:     (id, data)    => api.patch(`/admin/accounts/${id}`,             data),
  updatePermissions: (id, toggles) => api.patch(`/admin/accounts/${id}/permissions`, toggles),
  deleteAccount:     (id)          => api.delete(`/admin/accounts/${id}`),
  getAuditLog:       (id)          => api.get(`/admin/accounts/${id}/audit`),
}
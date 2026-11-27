// Cliente HTTP del backend de Vendex (backend/). En desarrollo Vite redirige /api → http://localhost:4000.
// En producción se puede apuntar a otra URL con VITE_API_URL.
import { clearSession, getSession, getToken, updateUser } from './session'

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

// Modo demo del backend (REQUIRE_AUTH=false, sin sesión): el vendedor va en la cabecera X-Seller-Id
export const SELLER_ID = import.meta.env.VITE_SELLER_ID || 'andres'

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

/**
 * `auth: false` → no envía el token (login, recuperación, invitación).
 * Si una petición con token responde 401, la sesión venció o se cerró: se borra y la app vuelve al login.
 */
export async function request(method, path, body, { keepalive = false, auth = true } = {}) {
  const token = auth ? getToken() : null
  // FormData (subida de archivos): el navegador pone el Content-Type con su boundary
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const headers = isForm ? {} : { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  else if (auth) headers['X-Seller-Id'] = SELLER_ID

  let res
  try {
    res = await fetch(BASE + path, {
      method,
      keepalive,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor de Vendex')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token) clearSession()
    // Cuenta con clave temporal: ProtectedRoute lleva a /cambiar-clave al ver la bandera
    if (res.status === 403 && token && data?.details?.code === 'password_change_required') {
      const user = getSession()?.user
      if (user && !user.mustChangePassword) updateUser({ ...user, mustChangePassword: true })
    }
    throw new ApiError(res.status, data?.error || `Error ${res.status}`, data?.details)
  }
  return data
}

export const http = {
  get: (p, o) => request('GET', p, undefined, o),
  post: (p, b, o) => request('POST', p, b ?? {}, o),
  put: (p, b, o) => request('PUT', p, b ?? {}, o),
  patch: (p, b, o) => request('PATCH', p, b ?? {}, o),
  del: (p, o) => request('DELETE', p, undefined, o),
}

const enc = encodeURIComponent
const PUBLIC = { auth: false }

/** Sesión, recuperación de clave e invitaciones */
export const authApi = {
  login: (email, password) => http.post('/auth/login', { email, password }, PUBLIC),
  me: () => http.get('/auth/me'),
  forgotPassword: (email) => http.post('/auth/forgot-password', { email }, PUBLIC),
  checkReset: (token) => http.get(`/auth/reset-password/${enc(token)}`, PUBLIC),
  resetPassword: (token, password) => http.post('/auth/reset-password', { token, password }, PUBLIC),
  getInvitation: (token) => http.get(`/invitations/${enc(token)}`, PUBLIC),
  acceptInvitation: (token, name, password) => http.post(`/invitations/${enc(token)}/accept`, { name, password }, PUBLIC),
  /** Con sesión: { currentPassword, newPassword } → { token, expiresAt, user } (sesión nueva) */
  changePassword: (currentPassword, newPassword) => http.post('/auth/change-password', { currentPassword, newPassword }),
}

/** Equipo de la empresa (solo gerente) */
export const teamApi = {
  members: () => http.get('/team/members'),
  /** Alta directa con clave temporal (sin correo): { email, name, role, password, country?, sellerId? } → { member } */
  createMember: (b) => http.post('/team/members', b),
  setMemberStatus: (id, status) => http.patch(`/team/members/${enc(id)}`, { status }),
  invitations: () => http.get('/team/invitations'),
  invite: (b) => http.post('/team/invitations', b),
  resend: (id) => http.post(`/team/invitations/${enc(id)}/resend`),
  revoke: (id) => http.del(`/team/invitations/${enc(id)}`),
}

/** Panel de plataforma (solo super admin) */
export const platformApi = {
  companies: () => http.get('/platform/companies'),
  create: (b) => http.post('/platform/companies', b),
  update: (id, patch) => http.patch(`/platform/companies/${enc(id)}`, patch),
  invitations: (id) => http.get(`/platform/companies/${enc(id)}/invitations`),
  inviteManager: (id, b) => http.post(`/platform/companies/${enc(id)}/invitations`, b),
  resendInvitation: (id, invId) => http.post(`/platform/companies/${enc(id)}/invitations/${enc(invId)}/resend`),
  revokeInvitation: (id, invId) => http.del(`/platform/companies/${enc(id)}/invitations/${enc(invId)}`),
}

/** Importación del Excel de clientes (gerente y vendedor) */
const xlsxForm = (file, options) => {
  const fd = new FormData()
  fd.append('file', file)
  if (options) fd.append('options', JSON.stringify(options))
  return fd
}
export const importsApi = {
  /** Lee el archivo y devuelve qué se importaría, sin guardar nada */
  preview: (file) => http.post('/imports/preview', xlsxForm(file)),
  /** options: { exclude: key[], sold: key[] } → { id, contacts, deals, activities } */
  commit: (file, options) => http.post('/imports', xlsxForm(file, options)),
  /** Excel de deudas por cobrar (Cobranza) */
  previewDebts: (file) => http.post('/imports/debts/preview', xlsxForm(file)),
  /** options: { exclude: key[] } → { id, contacts, deals, payments, activities } */
  commitDebts: (file, options) => http.post('/imports/debts', xlsxForm(file, options)),
  list: () => http.get('/imports'),
  undo: (id) => http.post(`/imports/${enc(id)}/undo`),
}

/** Cotizaciones (PDF) de la ficha del cliente */
export const filesApi = {
  list: (contactId) => http.get(`/contacts/${enc(contactId)}/files`),
  /** { file, dealId?, note? } → { file, activity } */
  upload: (contactId, { file, dealId, note }) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', 'cotizacion')
    if (dealId) fd.append('dealId', dealId)
    if (note) fd.append('note', note)
    return http.post(`/contacts/${enc(contactId)}/files`, fd)
  },
  /** → { url, fileName, expiresIn }: enlace firmado que vence en 5 minutos */
  url: (contactId, fileId) => http.get(`/contacts/${enc(contactId)}/files/${enc(fileId)}/url`),
  remove: (contactId, fileId) => http.del(`/contacts/${enc(contactId)}/files/${enc(fileId)}`),
}

// En la base el tipo de actividad es 'email'; la interfaz lo llama 'correo'
const ACTIVITY_TYPE = { correo: 'email' }

/** Endpoints usados por el store (ver backend/README.md) */
export const endpoints = {
  /** vendedorId (solo gerente): limita los datos a ese vendedor */
  bootstrap: (vendedorId) => http.get(`/bootstrap${vendedorId ? `?vendedor_id=${enc(vendedorId)}` : ''}`),
  reset: () => http.post('/admin/reset'),

  logActivity: (contactId, type, text, at) =>
    http.post(`/contacts/${enc(contactId)}/activities`, { type: ACTIVITY_TYPE[type] || type, text, at }),
  setTemp: (contactId, temp) => http.put(`/contacts/${enc(contactId)}/temp`, { temp }),
  /** Solo los campos enviados: { name?, company?, country?, city?, region?, phone?, doc?, email?, channel? } */
  updateContact: (contactId, patch) => http.patch(`/contacts/${enc(contactId)}`, patch),
  /** 409 si el cliente tiene ventas cerradas o cuotas */
  removeContact: (contactId) => http.del(`/contacts/${enc(contactId)}`),

  addDeal: (f) => http.post('/deals', f),
  moveDeal: (dealId, stage) => http.post(`/deals/${enc(dealId)}/move`, { stage }),
  snoozeDeal: (dealId, days) => http.post(`/deals/${enc(dealId)}/snooze`, { days }),
  createPlan: (dealId, items, firstPaid) => http.post(`/deals/${enc(dealId)}/payment-plan`, { items, firstPaid }),

  registerPayment: (paymentId, b) => http.post(`/payments/${enc(paymentId)}/register`, b),

  addTask: (t) => http.post('/tasks', t),
  toggleTask: (id) => http.post(`/tasks/${enc(id)}/toggle`),

  dismissAlert: (id) => http.del(`/alerts/${enc(id)}`),
  snooze: (itemId, until) => http.put(`/snoozes/${enc(itemId)}`, { until }),

  saveStrategy: (s) => http.put(`/strategy/${enc(s.id)}`, { kind: s.kind, title: s.title, body: s.body, position: s.position }),
  removeStrategy: (id) => http.del(`/strategy/${enc(id)}`),

  setGoal: (goalUSD) => http.put('/settings/goal', { goalUSD }),
  setPlan: (patch) => http.patch('/settings/plan', patch),
  setRates: (rates) => http.patch('/settings/rates', rates),

  /** Plantillas de WhatsApp del vendedor de la sesión */
  listTemplates: () => http.get('/templates'),
  saveTemplate: (key, t) => http.put(`/templates/${enc(key)}`, { kind: t.kind, label: t.label, body: t.body }),
  removeTemplate: (key) => http.del(`/templates/${enc(key)}`),
}

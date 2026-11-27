// Sesión guardada en localStorage: { token, expiresAt, user }.
// Se comparte entre pestañas (evento "storage") y se borra sola al vencer o si la API responde 401.

const KEY = 'vendex-session-v1'
const subs = new Set()

function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!s?.token || !s?.user || Date.parse(s.expiresAt) <= Date.now()) return null
    return s
  } catch {
    return null
  }
}

let current = read()

const emit = () => subs.forEach((f) => f(current))

export const getSession = () => current
export const getToken = () => current?.token ?? null

export function setSession(s) {
  current = s
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* sin almacenamiento: la sesión dura lo que la pestaña */
  }
  emit()
}

/** Actualiza los datos del usuario (p. ej. tras /auth/me) sin tocar el token */
export function updateUser(user) {
  if (!current) return
  setSession({ ...current, user })
}

export function clearSession() {
  if (!current) return
  current = null
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem('vx-cobro-aviso')
  } catch {
    /* nada que borrar */
  }
  emit()
}

export function onSessionChange(f) {
  subs.add(f)
  return () => subs.delete(f)
}

// Iniciar o cerrar sesión en otra pestaña se refleja aquí
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  current = read()
  emit()
})

/** Pantalla de inicio según el rol */
export const homeFor = (role) => (role === 'super_admin' ? '/admin' : '/hoy')

/** Destino tras el login: la página que se pidió (solo rutas internas) o el inicio del rol */
export const afterLogin = (from, role) =>
  typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') ? from : homeFor(role)

export const ROLE_NAMES = { super_admin: 'Super administrador', gerente: 'Gerente', vendedor: 'Vendedor' }

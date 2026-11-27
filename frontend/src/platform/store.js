import { useSyncExternalStore } from 'react'
import { at } from '../lib/dates'
import { seedPlatform } from './seed'

/*
 * Estado de la plataforma (multiempresa): empresas, usuarios, invitaciones y bitácora.
 * Solo frontend: vive en localStorage y se comparte entre el panel de super
 * administrador, la vista "Equipo" del gerente y la página de invitación.
 */

const KEY = 'vendex-platform-v1'

export const PLANS = {
  basico: { id: 'basico', name: 'Básico', seats: 5, price: 29, desc: 'Equipos pequeños que empiezan a ordenar su venta' },
  pro: { id: 'pro', name: 'Profesional', seats: 15, price: 79, desc: 'Cobranza, planeación y varios países' },
  empresa: { id: 'empresa', name: 'Empresa', seats: 50, price: 199, desc: 'Equipos grandes con supervisores por zona' },
}

export const ROLES = {
  gerente: { id: 'gerente', name: 'Gerente', desc: 'Administra el equipo e invita usuarios' },
  supervisor: { id: 'supervisor', name: 'Supervisor', desc: 'Ve y reasigna los tratos de su equipo' },
  vendedor: { id: 'vendedor', name: 'Vendedor', desc: 'Gestiona sus propios clientes y cobros' },
}

export const INDUSTRIES = ['Maquinaria agrícola', 'Ferretería y construcción', 'Agroinsumos', 'Distribución y consumo masivo', 'Tecnología', 'Servicios', 'Otro']

export const INVITE_DAYS = 7
export const CURRENT_COMPANY = 'co1' // empresa con la que trabaja la app de ventas de la demo
export const CURRENT_USER = 'u-andres' // gerente que usa la app de ventas

function read() {
  try {
    const s = localStorage.getItem(KEY)
    return s ? JSON.parse(s) : seedPlatform()
  } catch {
    return seedPlatform()
  }
}

let state = read()
const subs = new Set()

function set(fn) {
  state = fn(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* sin almacenamiento: sigue en memoria */
  }
  subs.forEach((f) => f())
}

const subscribe = (f) => {
  subs.add(f)
  const onStorage = (e) => {
    if (e.key === KEY) {
      state = read()
      f()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    subs.delete(f)
    window.removeEventListener('storage', onStorage)
  }
}

export const usePlatform = () => useSyncExternalStore(subscribe, () => state)

/* ---------------- Utilidades ---------------- */

let n = 0
const newId = (p) => `${p}${Date.now().toString(36)}${(n++).toString(36)}`
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('')
const now = () => new Date().toISOString()

export const normEmail = (e) => (e || '').trim().toLowerCase()
export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((e || '').trim())
export const inviteLink = (t) => `${window.location.origin}${window.location.pathname}#invitacion/${t}`

/** Estado mostrado de un usuario (una invitación pasada de fecha se ve como "vencida") */
export const memberStatus = (m) => (m.status === 'invitado' && m.expiresAt < now() ? 'vencida' : m.status)

export const companyMembers = (s, companyId) => s.members.filter((m) => m.companyId === companyId)
export const managerOf = (s, c) => s.members.find((m) => m.id === c.managerId)

/** Cupos ocupados: activos + invitaciones vigentes */
export const seatsUsed = (s, companyId) =>
  companyMembers(s, companyId).filter((m) => m.status === 'activo' || memberStatus(m) === 'invitado').length

/** Estado mostrado de la empresa */
export function companyStatus(s, c) {
  if (c.status === 'suspendida') return 'suspendida'
  const mg = managerOf(s, c)
  if (!mg || mg.status !== 'activo') return 'pendiente'
  if (c.status === 'prueba') return c.trialEndsAt < now() ? 'prueba-vencida' : 'prueba'
  return 'activa'
}

export const emailTaken = (s, email, exceptId) =>
  s.members.some((m) => m.id !== exceptId && m.status !== 'inactivo' && normEmail(m.email) === normEmail(email))

const log = (s, companyId, text, actor = 'Super admin', kind = 'info') => [
  { id: newId('l'), at: now(), companyId, actor, text, kind },
  ...s.log,
].slice(0, 300)

const invite = (companyId, f, by) => ({
  id: newId('u'),
  companyId,
  name: f.name.trim(),
  email: normEmail(f.email),
  phone: (f.phone || '').trim(),
  country: f.country,
  role: f.role,
  status: 'invitado',
  invitedAt: now(),
  invitedBy: by,
  expiresAt: at(INVITE_DAYS, 23, 59),
  token: token(),
})

/* ---------------- Acciones ---------------- */

export const platform = {
  /** Crea la empresa y la invitación de su gerente. Devuelve { company, manager } */
  createCompany(f) {
    const companyId = newId('co')
    const manager = invite(companyId, { ...f.manager, role: 'gerente' }, 'Super admin')
    const company = {
      id: companyId,
      name: f.name.trim(),
      legalName: f.legalName.trim(),
      taxId: f.taxId.trim(),
      country: f.country,
      countries: f.countries,
      industry: f.industry,
      plan: f.plan,
      seats: Number(f.seats) || PLANS[f.plan].seats,
      status: f.trial ? 'prueba' : 'activa',
      trialEndsAt: f.trial ? at(Number(f.trialDays) || 14, 23, 59) : null,
      managerId: manager.id,
      createdAt: now(),
      notes: (f.notes || '').trim(),
    }
    set((s) => ({
      ...s,
      companies: [company, ...s.companies],
      members: [...s.members, manager],
      log: log(log(s, companyId, `Empresa creada con plan ${PLANS[f.plan].name}${f.trial ? ` (prueba de ${f.trialDays} días)` : ''}`, 'Super admin', 'success'), companyId, `Invitación de gerente enviada a ${manager.email}`),
    }))
    return { company, manager }
  },

  updateCompany(id, patch) {
    set((s) => ({
      ...s,
      companies: s.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      log: log(s, id, 'Datos de la empresa actualizados'),
    }))
  },

  setCompanyStatus(id, status, reason) {
    const text = { suspendida: `Acceso suspendido${reason ? `: ${reason}` : ''}`, activa: 'Acceso reactivado', prueba: 'Acceso reactivado (en prueba)' }[status]
    set((s) => ({
      ...s,
      companies: s.companies.map((c) => (c.id === id ? { ...c, status, suspendedReason: status === 'suspendida' ? reason : undefined } : c)),
      log: log(s, id, text, 'Super admin', status === 'suspendida' ? 'danger' : 'success'),
    }))
  },

  extendTrial(id, days) {
    set((s) => ({
      ...s,
      companies: s.companies.map((c) => (c.id === id ? { ...c, status: 'prueba', trialEndsAt: at(days, 23, 59) } : c)),
      log: log(s, id, `Prueba extendida ${days} días`),
    }))
  },

  /** Reemplaza al gerente: invita a uno nuevo; el anterior pasa a supervisor (o se revoca si no había aceptado) */
  replaceManager(companyId, f) {
    const mgr = invite(companyId, { ...f, role: 'gerente' }, 'Super admin')
    set((s) => {
      const c = s.companies.find((x) => x.id === companyId)
      const old = managerOf(s, c)
      const members = s.members
        .filter((m) => !(old && m.id === old.id && m.status === 'invitado'))
        .map((m) => (old && m.id === old.id ? { ...m, role: 'supervisor' } : m))
      return {
        ...s,
        companies: s.companies.map((x) => (x.id === companyId ? { ...x, managerId: mgr.id } : x)),
        members: [...members, mgr],
        log: log(s, companyId, `Nuevo gerente invitado: ${mgr.name} (${mgr.email})`),
      }
    })
    return mgr
  },

  /** Invitación hecha por el gerente (o super admin) a un usuario */
  inviteMember(companyId, f, by) {
    const m = invite(companyId, f, by)
    set((s) => ({ ...s, members: [...s.members, m], log: log(s, companyId, `${by} invitó a ${m.name} como ${ROLES[m.role].name.toLowerCase()}`, by) }))
    return m
  },

  resendInvite(id, by = 'Super admin') {
    const t = token()
    set((s) => {
      const m = s.members.find((x) => x.id === id)
      return {
        ...s,
        members: s.members.map((x) => (x.id === id ? { ...x, token: t, invitedAt: now(), expiresAt: at(INVITE_DAYS, 23, 59) } : x)),
        log: log(s, m.companyId, `Invitación reenviada a ${m.email}`, by),
      }
    })
    return t
  },

  revokeInvite(id, by = 'Super admin') {
    set((s) => {
      const m = s.members.find((x) => x.id === id)
      return { ...s, members: s.members.filter((x) => x.id !== id), log: log(s, m.companyId, `Invitación a ${m.email} cancelada`, by, 'danger') }
    })
  },

  setMemberStatus(id, status, by) {
    set((s) => {
      const m = s.members.find((x) => x.id === id)
      return {
        ...s,
        members: s.members.map((x) => (x.id === id ? { ...x, status } : x)),
        log: log(s, m.companyId, `${m.name} ${status === 'inactivo' ? 'fue desactivado' : 'fue reactivado'}`, by, status === 'inactivo' ? 'danger' : 'info'),
      }
    })
  },

  updateMember(id, patch, by) {
    set((s) => {
      const m = s.members.find((x) => x.id === id)
      return {
        ...s,
        members: s.members.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        log: patch.role && patch.role !== m.role ? log(s, m.companyId, `${m.name} ahora es ${ROLES[patch.role].name.toLowerCase()}`, by) : s.log,
      }
    })
  },

  acceptInvite(tok, { name, phone }) {
    set((s) => {
      const m = s.members.find((x) => x.token === tok)
      if (!m) return s
      return {
        ...s,
        members: s.members.map((x) => (x.id === m.id ? { ...x, name: name.trim(), phone: phone || x.phone, status: 'activo', joinedAt: now(), lastSeenAt: now(), token: undefined, expiresAt: undefined } : x)),
        log: log(s, m.companyId, `${name.trim()} aceptó la invitación y activó su cuenta`, name.trim(), 'success'),
      }
    })
  },

  reset() {
    set(() => seedPlatform())
  },
}

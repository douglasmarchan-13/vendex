import { Crown } from 'lucide-react'
import { COUNTRIES } from '../data/mock'
import { Field, cx, inputCls } from './ui'

const ROLE = {
  gerente: { label: 'Gerente', cls: 'bg-amber-50 text-amber-800' },
  vendedor: { label: 'Vendedor', cls: 'bg-slate-100 text-slate-600' },
}
export function RoleBadge({ role }) {
  const r = ROLE[role] || ROLE.vendedor
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium', r.cls)}>
      {role === 'gerente' && <Crown size={11} />} {r.label}
    </span>
  )
}

const STATUS = {
  activo: { label: 'Activo', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  inactivo: { label: 'Desactivado', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  pendiente: { label: 'Pendiente', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  vencida: { label: 'Vencida', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  aceptada: { label: 'Aceptada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  anulada: { label: 'Anulada', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
  prueba: { label: 'En prueba', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  activa: { label: 'Activa', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  suspendida: { label: 'Suspendida', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
}
export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-600 ring-slate-200' }
  return <span className={cx('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', s.cls)}>{s.label}</span>
}

export function SeatsBar({ used, total, className }) {
  const pct = total ? Math.round((used / total) * 100) : 0
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-slate-600">Cupos usados</span>
        <span className="font-semibold tabular-nums text-slate-900">{used} <span className="font-normal text-slate-400">/ {total}</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cx('h-full rounded-full', pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500')} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">Las invitaciones pendientes también ocupan cupo.</p>
    </div>
  )
}

/** Correo, nombre y país de una persona a invitar. `f` = { email, name, country } */
export function PersonFields({ f, set, lockName, nameRequired }) {
  return (
    <>
      <Field label="Correo">
        <input type="email" required autoFocus className={inputCls} value={f.email} onChange={(e) => set({ ...f, email: e.target.value })} placeholder="nombre@empresa.com" />
      </Field>
      <Field label={nameRequired ? 'Nombre completo' : 'Nombre (opcional)'} hint={nameRequired ? undefined : 'Lo podrá corregir al activar su cuenta.'}>
        <input className={inputCls} value={f.name} readOnly={lockName} onChange={(e) => set({ ...f, name: e.target.value })} />
      </Field>
      <Field label="País">
        <select className={inputCls} value={f.country} onChange={(e) => set({ ...f, country: e.target.value })}>
          {Object.values(COUNTRIES).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </Field>
    </>
  )
}

export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((e || '').trim())

/** Mensaje tras invitar: el correo pudo fallar (Resend sin configurar, dominio no verificado...) */
export const mailNotice = (r, email) =>
  r.mail === 'sent' ? `Invitación enviada a ${email}` : `Invitación creada, pero el correo a ${email} no salió. Revisa la configuración de correo y usa "Reenviar".`

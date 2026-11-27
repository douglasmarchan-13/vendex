import { useState } from 'react'
import { Check, Copy, Mail, MoreHorizontal, RotateCw, UserX, UserCheck, Trash2, Link2, Clock, Crown } from 'lucide-react'
import { COUNTRIES } from '../data/mock'
import { Avatar, Button, Field, Flag, Modal, cx, inputCls } from '../components/ui'
import { useApp } from '../store'
import { ROLES, emailTaken, inviteLink, isEmail, memberStatus, platform, usePlatform, INVITE_DAYS } from './store'
import { fmtDate, rel } from '../lib/dates'

/* ---------- Insignias ---------- */
const CO_STATUS = {
  activa: { label: 'Activa', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  prueba: { label: 'En prueba', cls: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  'prueba-vencida': { label: 'Prueba vencida', cls: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  pendiente: { label: 'Esperando gerente', cls: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  suspendida: { label: 'Suspendida', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
}
export const CO_STATUS_LIST = Object.entries(CO_STATUS).map(([id, v]) => ({ id, ...v }))

export function CompanyStatus({ status, className }) {
  const s = CO_STATUS[status]
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', s.cls, className)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', s.dot)} /> {s.label}
    </span>
  )
}

const M_STATUS = {
  activo: { label: 'Activo', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  invitado: { label: 'Invitación enviada', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  vencida: { label: 'Invitación vencida', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  inactivo: { label: 'Desactivado', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
}
export function MemberStatus({ member }) {
  const s = M_STATUS[memberStatus(member)]
  return <span className={cx('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', s.cls)}>{s.label}</span>
}

export function RoleBadge({ role }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium', role === 'gerente' ? 'bg-amber-50 text-amber-800' : role === 'supervisor' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600')}>
      {role === 'gerente' && <Crown size={11} />} {ROLES[role].name}
    </span>
  )
}

/* ---------- Barra de cupos ---------- */
export function SeatsBar({ used, total, className }) {
  const pct = Math.round((used / total) * 100)
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-slate-600">Usuarios</span>
        <span className="font-semibold tabular-nums text-slate-900">{used} <span className="font-normal text-slate-400">/ {total}</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cx('h-full rounded-full', pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500')} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

/* ---------- Enlace de invitación copiable ---------- */
export function InviteLinkBox({ token, email }) {
  const [copied, setCopied] = useState(false)
  const link = inviteLink(token)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      /* sin portapapeles: el enlace queda visible para copiarlo a mano */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      {email && (
        <p className="mb-2 flex items-center gap-1.5 text-sm text-slate-600">
          <Mail size={14} className="text-slate-400" /> Se envió un correo a <span className="font-medium text-slate-800">{email}</span>
        </p>
      )}
      <div className="flex items-center gap-2">
        <span className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg bg-white px-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
          <Link2 size={14} className="shrink-0 text-slate-400" />
          <span className="truncate">{link}</span>
        </span>
        <Button variant={copied ? 'success' : 'secondary'} onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">El enlace vence en {INVITE_DAYS} días. También puedes enviarlo por WhatsApp.</p>
    </div>
  )
}

/* ---------- Formulario de invitación ---------- */
export function InviteModal({ open, onClose, companyId, countries, by, roles = ['vendedor', 'supervisor'], title = 'Invitar usuario', canInvite = true }) {
  const s = usePlatform()
  const { toast } = useApp()
  const blank = { name: '', email: '', phone: '', role: roles[0], country: countries[0] }
  const [f, setF] = useState(blank)
  const [tried, setTried] = useState(false)
  const [sent, setSent] = useState(null)
  const up = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const errs = {
    name: !f.name.trim() && 'Escribe el nombre',
    email: !isEmail(f.email) ? 'Escribe un correo válido' : emailTaken(s, f.email) && 'Este correo ya tiene una cuenta o invitación',
  }
  const ok = !errs.name && !errs.email

  const close = () => {
    setF(blank)
    setTried(false)
    setSent(null)
    onClose()
  }
  const submit = (e) => {
    e?.preventDefault()
    setTried(true)
    if (!ok || !canInvite) return
    const m = platform.inviteMember(companyId, f, by)
    setSent(m)
    toast(`Invitación enviada a ${m.name.split(' ')[0]}`, { tone: 'success' })
  }

  if (sent) {
    return (
      <Modal
        open={open}
        onClose={close}
        title="¡Invitación enviada!"
        subtitle={`${sent.name} recibirá un correo para crear su contraseña y entrar como ${ROLES[sent.role].name.toLowerCase()}.`}
        footer={
          <>
            <Button onClick={() => { setF({ ...blank, role: sent.role, country: sent.country }); setTried(false); setSent(null) }}>Invitar a otra persona</Button>
            <Button variant="primary" onClick={close}>Listo</Button>
          </>
        }
      >
        <InviteLinkBox token={sent.token} email={sent.email} />
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      subtitle="Le llegará un correo con un enlace para unirse a tu equipo."
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button variant="primary" onClick={submit} disabled={!canInvite}><Mail size={16} /> Enviar invitación</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {!canInvite && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-2">No quedan cupos en el plan. Desactiva a alguien o pide más cupos al administrador.</p>}
        <Field label="Nombre completo" className="sm:col-span-2">
          <input autoFocus className={inputCls} value={f.name} onChange={up('name')} placeholder="Ej. María López" />
          {tried && errs.name && <Err>{errs.name}</Err>}
        </Field>
        <Field label="Correo electrónico" className="sm:col-span-2">
          <input type="email" className={inputCls} value={f.email} onChange={up('email')} placeholder="nombre@empresa.com" />
          {tried && errs.email && <Err>{errs.email}</Err>}
        </Field>
        <Field label="WhatsApp (opcional)">
          <input className={inputCls} value={f.phone} onChange={up('phone')} placeholder={COUNTRIES[f.country]?.prefix} />
        </Field>
        <Field label="País">
          <select className={inputCls} value={f.country} onChange={up('country')}>
            {countries.map((c) => <option key={c} value={c}>{COUNTRIES[c].name}</option>)}
          </select>
        </Field>
        {roles.length > 1 && (
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Rol</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((r) => (
                <RoleOption key={r} role={r} on={f.role === r} onClick={() => setF((x) => ({ ...x, role: r }))} />
              ))}
            </div>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

export function RoleOption({ role, on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('rounded-xl border p-3 text-left transition', on ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300')}
    >
      <span className="block text-sm font-semibold text-slate-900">{ROLES[role].name}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{ROLES[role].desc}</span>
    </button>
  )
}

export const Err = ({ children }) => <span className="mt-1 block text-xs font-medium text-rose-600">{children}</span>

/* ---------- Lista de usuarios de una empresa ---------- */
export function MemberList({ members, by, selfId, canManage, onShowLink }) {
  const { toast } = useApp()
  if (!members.length) return <p className="px-5 py-8 text-center text-sm text-slate-500">No hay usuarios en esta vista.</p>
  return (
    <ul className="divide-y divide-slate-100">
      {members.map((m) => {
        const st = memberStatus(m)
        const pendingInvite = st === 'invitado' || st === 'vencida'
        const actions = canManage && m.id !== selfId
          ? [
              pendingInvite && { label: 'Ver enlace de invitación', icon: Link2, run: () => onShowLink?.(m) },
              pendingInvite && { label: 'Reenviar invitación', icon: RotateCw, run: () => { platform.resendInvite(m.id, by); toast(`Invitación reenviada a ${m.email}`, { tone: 'success' }) } },
              pendingInvite && m.role !== 'gerente' && { label: 'Cancelar invitación', icon: Trash2, danger: true, run: () => { platform.revokeInvite(m.id, by); toast('Invitación cancelada') } },
              st === 'activo' && m.role !== 'gerente' && m.role === 'vendedor' && { label: 'Hacer supervisor', icon: UserCheck, run: () => platform.updateMember(m.id, { role: 'supervisor' }, by) },
              st === 'activo' && m.role === 'supervisor' && { label: 'Hacer vendedor', icon: UserCheck, run: () => platform.updateMember(m.id, { role: 'vendedor' }, by) },
              st === 'activo' && m.role !== 'gerente' && { label: 'Desactivar acceso', icon: UserX, danger: true, run: () => { platform.setMemberStatus(m.id, 'inactivo', by); toast(`${m.name.split(' ')[0]} ya no puede entrar a Vendex`) } },
              st === 'inactivo' && { label: 'Reactivar acceso', icon: UserCheck, run: () => { platform.setMemberStatus(m.id, 'activo', by); toast(`${m.name.split(' ')[0]} puede volver a entrar`, { tone: 'success' }) } },
            ].filter(Boolean)
          : []
        return (
          <li key={m.id} className={cx('flex items-center gap-3 px-4 py-3 sm:px-5', st === 'inactivo' && 'opacity-60')}>
            <Avatar name={m.name} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-900">
                <span className="truncate">{m.name}{m.id === selfId && <span className="font-normal text-slate-400"> (tú)</span>}</span>
                <RoleBadge role={m.role} />
              </p>
              <p className="truncate text-xs text-slate-500">{m.email}</p>
            </div>
            <div className="hidden items-center gap-1.5 text-xs text-slate-500 md:flex md:w-28"><Flag code={m.country} /> {COUNTRIES[m.country]?.name}</div>
            <div className="hidden w-40 text-xs text-slate-500 lg:block">
              {st === 'activo' && <>Última vez: {rel(m.lastSeenAt)}</>}
              {st === 'invitado' && <span className="inline-flex items-center gap-1"><Clock size={12} /> Vence {fmtDate(m.expiresAt)}</span>}
              {st === 'vencida' && <>Enviada {fmtDate(m.invitedAt)}</>}
              {st === 'inactivo' && <>Desde {fmtDate(m.lastSeenAt)}</>}
            </div>
            <div className="hidden sm:block"><MemberStatus member={m} /></div>
            {actions.length > 0 ? <RowMenu items={actions} label={`Acciones para ${m.name}`} /> : <span className="w-9" />}
          </li>
        )
      })}
    </ul>
  )
}

export function RowMenu({ items, label }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button variant="ghost" size="icon" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal size={18} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="menu" className="anim-up absolute right-0 z-40 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {items.map((it) => (
              <button
                key={it.label}
                role="menuitem"
                onClick={() => { setOpen(false); it.run() }}
                className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm', it.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50')}
              >
                <it.icon size={15} /> {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Modal que muestra el enlace de una invitación pendiente */
export function LinkModal({ member, onClose }) {
  return (
    <Modal open={!!member} onClose={onClose} title={`Invitación de ${member?.name || ''}`} subtitle="Compártelo si el correo no llegó." footer={<Button variant="primary" onClick={onClose}>Listo</Button>}>
      {member && (memberStatus(member) === 'vencida'
        ? <p className="text-sm text-slate-600">Esta invitación venció. Usa “Reenviar invitación” para generar un enlace nuevo.</p>
        : <InviteLinkBox token={member.token} />)}
    </Modal>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Building2, ChevronDown, LogOut, Pencil, Plus, RotateCw, Search, UserPlus, XCircle, Ban, CircleCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { platformApi } from '../lib/api'
import { fmtDate, rel } from '../lib/dates'
import { COUNTRIES } from '../data/mock'
import { Avatar, Button, Card, Chip, Empty, Field, Flag, Logo, Modal, cx, inputCls } from '../components/ui'
import { PersonFields, RoleBadge, StatusBadge, isEmail, mailNotice } from '../components/people'
import { CredentialsCard, OnboardingBadge, OnboardingSwitch, TempPasswordField } from '../components/onboarding'
import { passwordProblem } from '../auth/passwords'

const PLANS = {
  basico: { name: 'Básico', seats: 5 },
  pro: { name: 'Profesional', seats: 15 },
  empresa: { name: 'Empresa', seats: 50 },
}
const INDUSTRIES = ['Maquinaria agrícola', 'Ferretería y construcción', 'Agroinsumos', 'Distribución y consumo masivo', 'Tecnología', 'Servicios', 'Otro']

/** Estado visible: una empresa sin gerente activo todavía espera que acepte su invitación */
const shownStatus = (c) => (c.status !== 'suspendida' && c.managers.length === 0 ? 'esperando' : c.status)

/**
 * Panel del super administrador, separado de la operación de ventas:
 * alta de empresas con invitación al gerente, plan / cupos / estado y seguimiento de invitaciones.
 */
export default function Admin() {
  const { user, logout } = useAuth()
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('todas')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [inviting, setInviting] = useState(null)
  const [open, setOpen] = useState(null) // empresa con invitaciones desplegadas
  const [credentials, setCredentials] = useState(null) // { title, email, password } tras un alta directa

  const load = useCallback(() => platformApi.companies().then(setCompanies, (e) => setError(e.message)), [])
  useEffect(() => {
    document.title = 'Panel de plataforma · Vendex'
    load()
  }, [load])

  const say = useCallback((text, tone = 'success') => {
    setNotice({ text, tone })
    setTimeout(() => setNotice(null), 5000)
  }, [])

  const counts = companies && {
    todas: companies.length,
    activa: companies.filter((c) => shownStatus(c) === 'activa').length,
    prueba: companies.filter((c) => shownStatus(c) === 'prueba').length,
    esperando: companies.filter((c) => shownStatus(c) === 'esperando').length,
    suspendida: companies.filter((c) => c.status === 'suspendida').length,
  }
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const list = (companies || [])
    .filter((c) => filter === 'todas' || shownStatus(c) === filter)
    .filter((c) => !q || norm(`${c.name} ${c.legalName} ${c.taxId} ${c.managers.map((m) => m.email).join(' ')}`).includes(norm(q)))

  async function setStatus(c, status) {
    try {
      await platformApi.update(c.id, { status })
      say(status === 'suspendida' ? `${c.name} quedó suspendida: sus usuarios ya no pueden entrar` : `${c.name} está activa`)
      load()
    } catch (e) {
      say(e.message, 'error')
    }
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo size={30} />
          <div className="leading-tight">
            <p className="font-bold tracking-tight">Vendex</p>
            <p className="text-[11px] text-slate-500">Panel de plataforma</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Avatar name={user.name} size="sm" />
            <span className="hidden text-sm font-medium text-slate-700 sm:inline">{user.name}</span>
            <button onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Empresas</h1>
            <p className="mt-1 text-sm text-slate-500">Crea empresas y su gerente, por invitación o con contraseña directa. El gerente arma su equipo desde Vendex.</p>
          </div>
          <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> Nueva empresa</Button>
        </div>

        {notice && (
          <p className={cx('rounded-lg px-3 py-2 text-sm ring-1 ring-inset', notice.tone === 'error' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-800 ring-emerald-200')}>
            {notice.text}
          </p>
        )}

        {counts && (
          <div className="flex flex-wrap items-center gap-2">
            {[['todas', 'Todas'], ['activa', 'Activas'], ['prueba', 'En prueba'], ['esperando', 'Esperando gerente'], ['suspendida', 'Suspendidas']].map(([id, label]) => (
              <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{label} <span className="opacity-60">{counts[id]}</span></Chip>
            ))}
            <label className="relative ml-auto w-full sm:w-64">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={cx(inputCls, 'h-9 pl-9')} placeholder="Buscar empresa, RUC o correo" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        )}

        <Card className="overflow-hidden">
          {error && <p className="p-5 text-sm text-rose-700">{error}</p>}
          {!error && !companies && <p className="p-5 text-sm text-slate-500">Cargando…</p>}
          {companies && list.length === 0 && <Empty icon={Building2} title={companies.length ? 'Ninguna empresa coincide' : 'Aún no hay empresas'} text={companies.length ? undefined : 'Crea la primera con “Nueva empresa”.'} />}
          {list.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {list.map((c) => (
                <li key={c.id}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><Building2 size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                        <span className="truncate">{c.name}</span> {c.country && <Flag code={c.country} />} <OnboardingBadge value={c.onboarding} />
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {c.managers.length ? `Gerente: ${c.managers.map((m) => m.name).join(', ')}` : 'Sin gerente activo'} · Plan {PLANS[c.plan]?.name || c.plan}
                        {c.status === 'prueba' && c.trialEndsAt && ` · prueba hasta el ${fmtDate(c.trialEndsAt)}`}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-slate-600" title="Usuarios activos + invitaciones pendientes / cupos">
                      {c.activeUsers + c.pendingInvitations} / {c.seats} cupos
                    </span>
                    {shownStatus(c) === 'esperando' ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">Esperando gerente</span> : <StatusBadge status={c.status} />}
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setOpen(open === c.id ? null : c.id)}>
                        Invitaciones <ChevronDown size={14} className={cx('transition', open === c.id && 'rotate-180')} />
                      </Button>
                      <Button size="sm" variant="ghost" title="Editar plan y datos" onClick={() => setEditing(c)}><Pencil size={14} /></Button>
                      {c.status === 'suspendida' ? (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(c, 'activa')}><CircleCheck size={14} /> Reactivar</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => confirm(`¿Suspender ${c.name}? Sus usuarios no podrán entrar hasta reactivarla.`) && setStatus(c, 'suspendida')}>
                          <Ban size={14} /> Suspender
                        </Button>
                      )}
                    </div>
                  </div>
                  {open === c.id && <CompanyInvitations company={c} onInvite={() => setInviting(c)} say={say} onChange={load} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>

      {creating && (
        <CompanyModal
          onClose={() => setCreating(false)}
          onSaved={(r, email, password) => {
            setCreating(false)
            if (r.member) {
              say(`Empresa creada. ${r.member.name} ya puede entrar con su contraseña temporal.`)
              setCredentials({ title: `Gerente de ${r.company.name}`, email, password })
            } else {
              say(`Empresa creada. ${mailNotice(r, email)}`, r.mail === 'sent' ? 'success' : 'error')
            }
            load()
          }}
        />
      )}
      {editing && (
        <CompanyModal
          company={editing}
          onClose={() => setEditing(null)}
          onSaved={(r, email, password) => {
            setEditing(null)
            if (r?.member) {
              say(`Cambios guardados. ${r.member.name} ya puede entrar con su contraseña temporal.`)
              setCredentials({ title: `Gerente de ${editing.name}`, email, password })
            } else {
              say('Cambios guardados')
            }
            load()
          }}
        />
      )}
      {inviting && (
        <ManagerInviteModal
          company={inviting}
          onClose={() => setInviting(null)}
          onDone={(r, email, password) => {
            setInviting(null)
            if (r.member) {
              say(`${r.member.name} ya puede entrar a ${inviting.name} con su contraseña temporal.`)
              setCredentials({ title: `Nuevo gerente de ${inviting.name}`, email, password })
            } else {
              say(mailNotice(r, email), r.mail === 'sent' ? 'success' : 'error')
              setOpen(inviting.id)
            }
            load()
          }}
        />
      )}
      {credentials && <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />}
    </div>
  )
}

function CompanyInvitations({ company, onInvite, say, onChange }) {
  const [list, setList] = useState(null)
  const load = useCallback(() => platformApi.invitations(company.id).then(setList, (e) => say(e.message, 'error')), [company.id, say])
  useEffect(() => {
    load()
  }, [load])

  const act = async (fn, ok) => {
    try {
      const r = await fn()
      say(typeof ok === 'function' ? ok(r) : ok)
    } catch (e) {
      say(e.message, 'error')
    }
    load()
    onChange()
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">Invitaciones de {company.name}</p>
        <Button size="sm" variant="secondary" onClick={onInvite} disabled={company.status === 'suspendida'}><UserPlus size={14} /> {company.onboarding === 'directa' ? 'Agregar gerente' : 'Invitar gerente'}</Button>
      </div>
      {!list ? <p className="text-sm text-slate-500">Cargando…</p> : list.length === 0 ? <p className="text-sm text-slate-500">Sin invitaciones.</p> : (
        <ul className="space-y-2">
          {list.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-inset ring-slate-200">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{i.email}</span>
              <RoleBadge role={i.role} />
              <span className="text-xs text-slate-500">{rel(i.createdAt)}</span>
              <StatusBadge status={i.status} />
              {['pendiente', 'vencida'].includes(i.status) && (
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => act(() => platformApi.resendInvitation(company.id, i.id), (r) => mailNotice(r, i.email))}><RotateCw size={13} /> Reenviar</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(() => platformApi.revokeInvitation(company.id, i.id), 'Invitación anulada')}><XCircle size={13} /> Anular</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Alta (con invitación al gerente) o edición de una empresa */
function CompanyModal({ company, onClose, onSaved }) {
  const editing = !!company
  const [f, setF] = useState(() =>
    company
      ? { name: company.name, legalName: company.legalName, taxId: company.taxId, country: company.country || 'PE', industry: company.industry, plan: company.plan, seats: company.seats, status: company.status, notes: company.notes, onboarding: company.onboarding || 'invitacion' }
      : { name: '', legalName: '', taxId: '', country: 'PE', industry: INDUSTRIES[0], plan: 'basico', seats: PLANS.basico.seats, status: 'prueba', trialDays: 14, notes: '', onboarding: 'invitacion' }
  )
  const [mgr, setMgr] = useState({ email: '', name: '', country: company?.country || 'PE' })
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const direct = f.onboarding === 'directa'
  // Editar con alta directa: se puede crear el gerente aquí mismo (abierto si la empresa no tiene gerente activo)
  const noManager = editing && company.managers.length === 0
  const [addManager, setAddManager] = useState(noManager)
  const managerHere = !editing || (direct && addManager)
  const createManager = !editing || (managerHere && mgr.email.trim() !== '')

  async function submit() {
    if (f.name.trim().length < 2) return setError('Escribe el nombre comercial.')
    if (createManager) {
      if (!isEmail(mgr.email)) return setError('Escribe el correo del gerente.')
      if (direct) {
        if (mgr.name.trim().length < 2) return setError('Escribe el nombre del gerente.')
        const problem = passwordProblem(password)
        if (problem) return setError(problem)
      }
    }
    setBusy(true)
    setError(null)
    try {
      if (editing) {
        const { trialDays: _t, ...patch } = f
        await platformApi.update(company.id, { ...patch, seats: Number(patch.seats) })
        if (!createManager) return onSaved()
        // La empresa ya está en alta directa: el gerente se crea activo con la contraseña temporal
        const email = mgr.email.trim()
        const r = await platformApi.inviteManager(company.id, { email, name: mgr.name.trim(), country: mgr.country, password })
        onSaved(r, email, password)
      } else {
        const manager = { email: mgr.email.trim(), name: mgr.name.trim(), country: mgr.country, ...(direct ? { password } : {}) }
        const r = await platformApi.create({ ...f, seats: Number(f.seats), trialDays: Number(f.trialDays), manager })
        onSaved(r, manager.email, direct ? password : null)
      }
    } catch (e) {
      setError(e.details?.[0] ? `${e.details[0].field}: ${e.details[0].message}` : e.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={editing ? `Editar ${company.name}` : 'Nueva empresa'}
      subtitle={editing ? 'Plan, cupos, estado, alta de usuarios y datos de facturación.' : direct ? 'Al guardar, el gerente queda activo con la contraseña temporal.' : 'Al guardar se envía la invitación al gerente.'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={busy} onClick={submit}>{busy ? 'Guardando…' : editing ? 'Guardar' : direct ? 'Crear empresa y gerente' : 'Crear e invitar'}</Button></>}
    >
      <div className="space-y-5">
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre comercial"><input className={inputCls} autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Razón social"><input className={inputCls} value={f.legalName} onChange={(e) => set({ legalName: e.target.value })} /></Field>
          <Field label="RUC / NIT / RIF"><input className={inputCls} value={f.taxId} onChange={(e) => set({ taxId: e.target.value })} /></Field>
          <Field label="País">
            <select className={inputCls} value={f.country} onChange={(e) => set({ country: e.target.value })}>
              {Object.values(COUNTRIES).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Rubro">
            <select className={inputCls} value={f.industry} onChange={(e) => set({ industry: e.target.value })}>
              {[...new Set([...INDUSTRIES, f.industry].filter(Boolean))].map((i) => <option key={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Plan">
            <select className={inputCls} value={f.plan} onChange={(e) => set({ plan: e.target.value, seats: PLANS[e.target.value].seats })}>
              {Object.entries(PLANS).map(([id, p]) => <option key={id} value={id}>{p.name} · {p.seats} usuarios</option>)}
            </select>
          </Field>
          <Field label="Cupos (usuarios)"><input type="number" min={1} className={inputCls} value={f.seats} onChange={(e) => set({ seats: e.target.value })} /></Field>
          <Field label="Estado">
            <select className={inputCls} value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="prueba">En prueba</option>
              <option value="activa">Activa</option>
              {editing && <option value="suspendida">Suspendida</option>}
            </select>
          </Field>
          {!editing && f.status === 'prueba' && (
            <Field label="Días de prueba"><input type="number" min={1} max={365} className={inputCls} value={f.trialDays} onChange={(e) => set({ trialDays: e.target.value })} /></Field>
          )}
          <Field label="Notas internas" className="sm:col-span-2">
            <textarea rows={2} className={cx(inputCls, 'h-auto py-2')} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>

        <OnboardingSwitch
          value={f.onboarding}
          onChange={(onboarding) => set({ onboarding })}
          hint={
            editing
              ? 'Vale para los próximos usuarios del gerente y para los gerentes que agregues. Las invitaciones ya enviadas siguen sirviendo.'
              : 'Se usa para crear al gerente y es el único método que el gerente podrá usar para armar su equipo.'
          }
        />

        {editing && direct && !addManager && (
          <Button variant="secondary" onClick={() => setAddManager(true)}>
            <UserPlus size={16} /> Agregar un gerente con contraseña
          </Button>
        )}

        {managerHere && (
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{editing ? (noManager ? 'Gerente de la empresa' : 'Nuevo gerente') : 'Gerente de la empresa'}</p>
                {editing && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {noManager ? 'Esta empresa aún no tiene gerente activo. ' : ''}Opcional: déjalo vacío para solo guardar los cambios. Al guardar queda activo con la contraseña temporal.
                  </p>
                )}
              </div>
              {editing && !noManager && (
                <button type="button" onClick={() => setAddManager(false)} className="text-xs font-medium text-slate-500 hover:text-slate-700">Quitar</button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3"><PersonFields f={mgr} set={setMgr} nameRequired={direct} /></div>
            {direct && <TempPasswordField className="mt-4" value={password} onChange={setPassword} />}
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Otro gerente para una empresa existente, con el método de alta de la empresa */
function ManagerInviteModal({ company, onClose, onDone }) {
  const direct = company.onboarding === 'directa'
  const [f, setF] = useState({ email: '', name: '', country: company.country || 'PE' })
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!isEmail(f.email)) return setError('Escribe un correo válido.')
    if (direct) {
      if (f.name.trim().length < 2) return setError('Escribe el nombre del gerente.')
      const problem = passwordProblem(password)
      if (problem) return setError(problem)
    }
    setBusy(true)
    setError(null)
    try {
      const r = await platformApi.inviteManager(company.id, { email: f.email.trim(), name: f.name.trim(), country: f.country, ...(direct ? { password } : {}) })
      onDone(r, f.email.trim(), direct ? password : null)
    } catch (e) {
      setError(e.details?.[0]?.message || e.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${direct ? 'Agregar' : 'Invitar'} gerente a ${company.name}`}
      subtitle={direct ? 'Queda activo con una contraseña temporal que deberá cambiar al entrar. No se envía correo.' : 'Recibirá un correo para crear su contraseña.'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={busy} onClick={submit}>{busy ? (direct ? 'Creando…' : 'Enviando…') : direct ? 'Crear gerente' : 'Enviar invitación'}</Button></>}
    >
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          Método de la empresa: <OnboardingBadge value={company.onboarding} /> <span>(cámbialo en “Editar”)</span>
        </p>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p>}
        <PersonFields f={f} set={setF} nameRequired={direct} />
        {direct && <TempPasswordField value={password} onChange={setPassword} />}
      </div>
    </Modal>
  )
}

/** Datos de acceso del gerente creado por alta directa (se muestran una sola vez) */
function CredentialsModal({ credentials, onClose }) {
  return (
    <Modal open onClose={onClose} title={credentials.title} subtitle="El gerente ya puede entrar con estos datos." footer={<Button variant="primary" onClick={onClose}>Listo</Button>}>
      <CredentialsCard email={credentials.email} password={credentials.password} />
    </Modal>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Link2, MailCheck, RotateCw, UserCheck, UserPlus, UserX, Users, XCircle } from 'lucide-react'
import { useApp } from '../store'
import { useAuth } from '../auth/AuthContext'
import { teamApi } from '../lib/api'
import { rel, fmtDate } from '../lib/dates'
import { Avatar, Button, Card, Chip, Empty, Field, Flag, Modal, inputCls } from '../components/ui'
import { passwordProblem } from '../auth/passwords'
import { CredentialsCard, OnboardingBadge, TempPasswordField } from '../components/onboarding'
import { PersonFields, RoleBadge, SeatsBar, StatusBadge, isEmail, mailNotice } from '../components/people'

/** Equipo de la empresa (solo gerente): usuarios, cupos e invitaciones, todo desde la API */
export default function Team() {
  const { toast } = useApp()
  const { user } = useAuth()
  const [team, setTeam] = useState(null) // { seats, members, unlinkedSellers }
  const [invites, setInvites] = useState([])
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('usuarios')
  const [inviting, setInviting] = useState(null) // null | {} | { seller }

  const load = useCallback(async () => {
    try {
      const [t, i] = await Promise.all([teamApi.members(), teamApi.invitations()])
      setTeam(t)
      setInvites(i)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const run = async (fn, ok) => {
    try {
      const r = await fn()
      if (ok) toast(typeof ok === 'function' ? ok(r) : ok, { tone: 'success' })
    } catch (e) {
      toast(e.message)
    }
    load()
  }

  if (error) return <Card className="p-6 text-sm text-rose-700">{error}</Card>
  if (!team) return <Card className="p-6 text-sm text-slate-500">Cargando equipo…</Card>

  const active = team.members.filter((m) => m.status === 'activo').length
  const pending = invites.filter((i) => i.status === 'pendiente')
  const free = team.seats.total - team.seats.used
  const visibleInvites = invites.filter((i) => i.status !== 'aceptada')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Tu equipo</h2>
          <p className="mt-1 text-sm text-slate-500">Invita a gerentes y vendedores de {user.companyName}. Cada vendedor ve solo sus clientes y cobros.</p>
        </div>
        <Button variant="primary" disabled={free <= 0} onClick={() => setInviting({})} title={free <= 0 ? 'No quedan cupos' : undefined}>
          <UserPlus size={16} /> Agregar usuario
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><SeatsBar used={team.seats.used} total={team.seats.total} /></Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Users size={20} /></span>
          <div><p className="text-2xl font-bold tabular-nums">{active}</p><p className="text-sm text-slate-500">usuarios activos</p></div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><MailCheck size={20} /></span>
          <div><p className="text-2xl font-bold tabular-nums">{pending.length}</p><p className="text-sm text-slate-500">invitaciones pendientes</p></div>
        </Card>
      </div>

      {team.unlinkedSellers.length > 0 && (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700"><Link2 size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">Vendedores sin cuenta</p>
              <p className="text-sm text-slate-500">Tienen clientes en Vendex pero aún no pueden entrar. Al invitarlos, su cuenta queda unida a sus clientes y cobros.</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {team.unlinkedSellers.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => setInviting({ seller: s })} disabled={free <= 0} className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
                      <Avatar name={s.name} size="xs" /> {s.name} <Flag code={s.country} /> <UserPlus size={14} className="text-indigo-600" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Chip active={tab === 'usuarios'} onClick={() => setTab('usuarios')}>Usuarios <span className="opacity-60">{team.members.length}</span></Chip>
        <Chip active={tab === 'invitaciones'} onClick={() => setTab('invitaciones')}>Invitaciones <span className="opacity-60">{visibleInvites.length}</span></Chip>
      </div>

      {tab === 'usuarios' ? (
        <Card className="overflow-hidden">
          {team.members.length === 0 ? <Empty icon={Users} title="Aún no hay usuarios" /> : (
            <ul className="divide-y divide-slate-100">
              {team.members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-800">
                      <span className="truncate">{m.name}</span>{m.id === user.id && <span className="text-xs text-slate-400">(tú)</span>} <RoleBadge role={m.role} />
                      {m.mustChangePassword && (
                        <span title="Se creó con una contraseña temporal: al entrar deberá elegir la suya" className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                          <KeyRound size={11} className="shrink-0" /> <span className="truncate">Debe cambiar su contraseña</span>
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500">{m.email} · {m.lastLoginAt ? `entró ${rel(m.lastLoginAt)}` : 'aún no entra'}</p>
                  </div>
                  <StatusBadge status={m.status} />
                  {m.id !== user.id && (m.status === 'activo' ? (
                    <Button size="sm" variant="ghost" onClick={() => confirm(`¿Desactivar a ${m.name}? No podrá entrar; sus clientes y su historial se conservan.`) && run(() => teamApi.setMemberStatus(m.id, 'inactivo'), `${m.name} fue desactivado`)}>
                      <UserX size={14} /> Desactivar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={free <= 0} onClick={() => run(() => teamApi.setMemberStatus(m.id, 'activo'), `${m.name} fue reactivado`)}>
                      <UserCheck size={14} /> Reactivar
                    </Button>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {visibleInvites.length === 0 ? <Empty icon={MailCheck} title="No hay invitaciones" text="Las invitaciones aceptadas pasan a la lista de usuarios." /> : (
            <ul className="divide-y divide-slate-100">
              {visibleInvites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-800"><span className="truncate">{i.email}</span> <RoleBadge role={i.role} /></p>
                    <p className="text-xs text-slate-500">
                      Enviada {rel(i.createdAt)}{i.status === 'pendiente' && ` · vence el ${fmtDate(i.expiresAt)}`}{i.sellerId && ' · unida a un vendedor existente'}
                    </p>
                  </div>
                  <StatusBadge status={i.status} />
                  {['pendiente', 'vencida'].includes(i.status) && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => run(() => teamApi.resend(i.id), (r) => mailNotice(r, i.email))}><RotateCw size={14} /> Reenviar</Button>
                      <Button size="sm" variant="ghost" onClick={() => run(() => teamApi.revoke(i.id), 'Invitación anulada')}><XCircle size={14} /> Anular</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {inviting && (
        <InviteModal
          method={team.onboarding}
          seller={inviting.seller}
          defaultCountry={inviting.seller?.country || "PE"}
          onClose={() => setInviting(null)}
          onDone={(r, email) => {
            setInviting(null)
            setTab('invitaciones')
            toast(mailNotice(r, email), { tone: r.mail === 'sent' ? 'success' : undefined })
            load()
          }}
          onCreated={() => {
            setTab('usuarios')
            load()
          }}
        />
      )}
    </div>
  )
}

/**
 * Alta de un usuario con el método que fijó el super admin para la empresa (team.onboarding):
 * · invitacion: invitación por correo (POST /team/invitations); elige su contraseña con el enlace.
 * · directa: el gerente define una clave temporal (POST /team/members); la cuenta queda activa sin
 *   correo y el usuario debe cambiarla en su primer inicio de sesión.
 */
function InviteModal({ method, seller, defaultCountry, onClose, onDone, onCreated }) {
  const direct = method === 'directa'
  const [f, setF] = useState({ email: seller?.email || '', name: seller?.name || '', country: defaultCountry, role: 'vendedor' })
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null) // { member, password } tras el alta directa

  async function submit() {
    if (!isEmail(f.email)) return setError('Escribe un correo válido.')
    if (direct) {
      if (f.name.trim().length < 2) return setError('Escribe el nombre completo.')
      const problem = passwordProblem(password)
      if (problem) return setError(problem)
    }
    setBusy(true)
    setError(null)
    const body = { email: f.email.trim(), name: f.name.trim(), role: f.role, country: f.country, ...(seller ? { sellerId: seller.id } : {}) }
    try {
      if (direct) {
        const r = await teamApi.createMember({ ...body, password })
        setCreated({ member: r.member, password })
        onCreated()
      } else {
        onDone(await teamApi.invite(body), body.email)
      }
    } catch (e) {
      setError(e.details?.[0]?.message || e.message)
    }
    setBusy(false)
  }

  if (created) {
    return (
      <Modal open onClose={onClose} title="Usuario creado" subtitle={`${created.member.name} ya puede entrar con estos datos.`} footer={<Button variant="primary" onClick={onClose}>Listo</Button>}>
        <CredentialsCard email={created.member.email} password={created.password} />
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={seller ? `Dar acceso a ${seller.name}` : 'Agregar a tu equipo'}
      subtitle={direct ? 'Defines una contraseña temporal y se la entregas tú. No se envía ningún correo.' : 'Le llegará un correo para crear su contraseña. El enlace vence en 7 días.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={busy} onClick={submit}>
            {busy ? (direct ? 'Creando…' : 'Enviando…') : direct ? 'Crear usuario' : 'Enviar invitación'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          Método de tu empresa: <OnboardingBadge value={method} /> <span>(lo define el administrador de Vendex)</span>
        </p>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p>}
        <PersonFields f={f} set={setF} lockName={!!seller} nameRequired={direct} />
        <Field label="Rol">
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="vendedor">Vendedor · ve y gestiona solo sus clientes</option>
            <option value="gerente">Gerente · ve a todo el equipo e invita usuarios</option>
          </select>
        </Field>
        {direct && <TempPasswordField value={password} onChange={setPassword} />}
      </div>
    </Modal>
  )
}

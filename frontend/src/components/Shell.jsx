import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Sparkles, SquareKanban, Users, Target, Plus, ChevronDown, Check, Coins, RotateCcw, Globe, HandCoins, Bell, BellRing, UsersRound, LogOut } from 'lucide-react'
import { useCobros } from '../views/Collections'
import { dueText } from '../lib/cobranza'
import { diffDays, fmtTime, rel } from '../lib/dates'
import { useApp } from '../store'
import { useAuth } from '../auth/AuthContext'
import { ROLE_NAMES } from '../lib/session'
import { COUNTRIES } from '../data/mock'
import { CURRENCIES } from '../lib/money'
import { Avatar, Button, Flag, Logo, cx } from './ui'
import { HelpButton } from './Help'

export const NAV = [
  { id: 'hoy', label: 'Hoy', long: 'Hoy · Mi Copiloto', icon: Sparkles },
  { id: 'embudo', label: 'Embudo', long: 'Embudo de ventas', icon: SquareKanban },
  { id: 'clientes', label: 'Clientes', long: 'Clientes y prospectos', icon: Users },
  { id: 'cobranza', label: 'Cobros', long: 'Cobranza', icon: HandCoins },
  { id: 'planeacion', label: 'Plan', long: 'Planeación y estrategia', icon: Target },
  { id: 'equipo', label: 'Equipo', long: 'Equipo y accesos', icon: UsersRound, managerOnly: true },
]

/** Secciones visibles para el rol (Equipo es solo del gerente) */
export const navFor = (role) => NAV.filter((n) => !n.managerOnly || role === 'gerente')

export function Sidebar({ view }) {
  const { data, reset, sellers, canManage, sellerFilter, setSellerFilter } = useApp()
  const { user, logout } = useAuth()
  const hot = data.deals.filter((d) => d.temp === 'caliente' && !['cerrado', 'pausa'].includes(d.stage)).length
  const cob = useCobros()
  const due = cob.overdue.length + cob.today.length
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white lg:flex">
      <div className="flex items-center gap-3 px-5 pb-6 pt-5">
        <Logo />
        <div className="leading-tight">
          <p className="text-[17px] font-bold tracking-tight text-slate-900">Vendex</p>
          <p className="text-[11px] text-slate-500">Tu copiloto para vender más</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {navFor(user?.role).map((n) => {
          const I = n.icon
          const on = view === n.id
          return (
            <Link
              key={n.id}
              to={`/${n.id}`}
              className={cx(
                'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition',
                on ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <I size={18} strokeWidth={on ? 2.4 : 2} />
              <span className="flex-1">{n.long}</span>
              {n.id === 'embudo' && hot > 0 && <span className="rounded-full bg-rose-100 px-1.5 text-[11px] font-semibold text-rose-700">{hot}</span>}
              {n.id === 'cobranza' && due > 0 && <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white">{due}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Gerente: su equipo; un clic filtra todo el tablero por ese vendedor */}
      {canManage && (
        <div className="mt-8 px-3">
          <p className="mb-2 px-2 text-xs font-medium text-slate-400">Equipo comercial</p>
          <ul className="space-y-0.5">
            {Object.values(sellers).filter((s) => s.active).map((s) => {
              const on = sellerFilter === s.id
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setSellerFilter(on ? 'ALL' : s.id)}
                    title={on ? 'Ver todo el equipo' : `Ver solo a ${s.name}`}
                    className={cx('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition', on ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50')}
                  >
                    <Avatar name={s.name} size="sm" />
                    <span className="flex-1 truncate">{s.short}{s.id === user?.sellerId && <span className="text-slate-400"> (tú)</span>}</span>
                    <Flag code={s.country} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-auto border-t border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name || '?'} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{ROLE_NAMES[user?.role]}{user?.companyName ? ` · ${user.companyName}` : ''}</p>
          </div>
          <button onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <LogOut size={16} />
          </button>
        </div>
        {/* Recarga la semilla de demostración: solo el gerente de la empresa demo (lo decide el backend) y solo en desarrollo */}
        {import.meta.env.DEV && user?.canResetDemo && (
          <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
            <RotateCcw size={12} /> Restablecer demo
          </button>
        )}
      </div>
    </aside>
  )
}

export function CountrySwitch({ compact }) {
  const { country, setCountry, data } = useApp()
  const count = (c) => data.contacts.filter((k) => c === 'ALL' || k.country === c).length
  const opts = ['ALL', 'PE', 'BO', 'VE']
  return (
    <div className={cx('flex items-center gap-1 rounded-xl bg-slate-100 p-1', compact && 'w-full min-w-0')}>
      {opts.map((c) => (
        <button
          key={c}
          onClick={() => setCountry(c)}
          className={cx(
            'inline-flex h-8 items-center justify-center rounded-lg font-medium transition',
            compact ? 'min-w-0 flex-auto gap-1 px-1 text-[12px]' : 'gap-1.5 px-2.5 text-[13px]',
            country === c ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {c === 'ALL' ? <Globe size={14} className="shrink-0" /> : <Flag code={c} />}
          <span className={cx(compact && 'truncate')}>{c === 'ALL' ? 'Todos' : COUNTRIES[c].name}</span>
          {!compact && <span className="text-[11px] text-slate-400">{count(c)}</span>}
        </button>
      ))}
    </div>
  )
}

export function CurrencyMenu() {
  const { currency, setCurrency, data, openModal, canManage } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [])
  const c = CURRENCIES[currency]
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Coins size={16} className="text-indigo-600" />
        <span>{c.symbol}</span>
        <span className="hidden font-medium text-slate-400 sm:inline">{c.code}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <div className="anim-up absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl" role="menu">
          <p className="px-2.5 pb-1 pt-1.5 text-xs text-slate-500">Ver montos en</p>
          {Object.values(CURRENCIES).map((k) => (
            <button
              key={k.code}
              onClick={() => { setCurrency(k.code); setOpen(false) }}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="w-8 font-semibold text-slate-800">{k.symbol}</span>
              <span className="flex-1 text-slate-600">{k.name}</span>
              <span className="text-xs tabular-nums text-slate-400">{k.code === 'USD' ? 'base' : `${data.rates[k.code]} × US$`}</span>
              {currency === k.code && <Check size={16} className="text-indigo-600" />}
            </button>
          ))}
          {canManage && <div className="mt-1 border-t border-slate-100 pt-1">
            <button onClick={() => { setOpen(false); openModal('rates') }} className="w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50">
              Editar tipo de cambio del día
            </button>
          </div>}
        </div>
      )}
    </div>
  )
}

/** Gerente: "Todos los vendedores" o uno solo (recarga los datos con ?vendedor_id=) */
export function SellerSwitch({ className }) {
  const { sellers, canManage, sellerFilter, setSellerFilter } = useApp()
  if (!canManage) return null
  return (
    <select
      value={sellerFilter}
      onChange={(e) => setSellerFilter(e.target.value)}
      aria-label="Vendedor"
      className={cx('h-10 rounded-lg bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50', sellerFilter !== 'ALL' && 'bg-indigo-50 text-indigo-700 ring-indigo-200', className)}
    >
      <option value="ALL">Todos los vendedores</option>
      {Object.values(sellers).filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  )
}

export function TopBar({ view }) {
  const { openModal } = useApp()
  const { logout, user } = useAuth()
  const nav = NAV.find((n) => n.id === view)
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#F8FAFC]/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <Logo size={30} />
          {/* En teléfonos muy angostos queda solo el logo para que entren los botones */}
          <span className="hidden text-base font-bold tracking-tight text-slate-900 min-[360px]:inline">Vendex</span>
        </div>
        <h1 className="hidden truncate text-[15px] font-semibold text-slate-800 lg:block">{nav?.long}</h1>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Filtros en línea solo con ancho de sobra (xl); debajo van en la segunda fila */}
          <SellerSwitch className="hidden xl:block" />
          <div className="hidden xl:block"><CountrySwitch /></div>
          <CurrencyMenu />
          <CobroBell />
          <HelpButton module={view} role={user?.role} modules={navFor(user?.role).map((n) => n.id)} />
          <button onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión" className="grid h-10 w-10 place-items-center rounded-lg bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 lg:hidden">
            <LogOut size={18} />
          </button>
          <div className="hidden whitespace-nowrap sm:block"><Button variant="primary" onClick={() => openModal('deal')}>
            <Plus size={16} strokeWidth={2.5} /> Nuevo trato
          </Button></div>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-center sm:px-6 lg:px-8 xl:hidden">
        <SellerSwitch className="w-full sm:w-56 sm:shrink-0" />
        <div className="min-w-0 flex-1"><CountrySwitch compact /></div>
      </div>
    </header>
  )
}

export function MobileNav({ view }) {
  const { openModal } = useApp()
  const { user } = useAuth()
  const items = navFor(user?.role)
  const cob = useCobros()
  const due = cob.overdue.length + cob.today.length
  return (
    <>
      <button
        onClick={() => openModal('deal')}
        aria-label="Nuevo trato"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-900 text-white shadow-lg shadow-indigo-600/30 active:scale-95 sm:hidden"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((n) => (
            <Link key={n.id} to={`/${n.id}`} className={cx('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium', view === n.id ? 'text-indigo-600' : 'text-slate-500')}>
              <n.icon size={21} strokeWidth={view === n.id ? 2.4 : 2} />
              {n.label}
              {n.id === 'cobranza' && due > 0 && (
                <span className="absolute left-1/2 top-1.5 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{due}</span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}

/** Tareas pendientes atrasadas, de hoy y de mañana (las de mañana avisan que se acerca la fecha) */
// eslint-disable-next-line react-refresh/only-export-components
export function useTaskAlerts() {
  const { data, contactById, inCountry } = useApp()
  const pending = data.tasks
    .filter((t) => !t.done && contactById[t.contactId] && inCountry(contactById[t.contactId].country))
    .filter((t) => diffDays(t.at) <= 1)
    .sort((a, b) => (a.at < b.at ? -1 : 1))
  return { pending, urgent: pending.filter((t) => diffDays(t.at) <= 0) }
}

const REMIND_BEFORE_MS = 15 * 60000

/**
 * Aviso a la hora de cada tarea de hoy (y 15 minutos antes) mientras Vendex está abierto:
 * un toast en la app y, si el navegador lo permite, una notificación del sistema.
 */
function useTaskReminders() {
  const { data, contactById, toast } = useApp()
  const fired = useRef(new Set())
  useEffect(() => {
    const now = Date.now()
    const timers = []
    for (const t of data.tasks) {
      if (t.done) continue
      const c = contactById[t.contactId]
      const when = new Date(t.at).getTime()
      for (const [offset, label] of [[REMIND_BEFORE_MS, 'En 15 minutos'], [0, 'Es la hora']]) {
        const key = `${t.id}:${offset}`
        const delay = when - offset - now
        // Solo lo que cae en las próximas 24 h (setTimeout no admite plazos muy largos)
        if (delay < 0 || delay > 86400000 || fired.current.has(key)) continue
        timers.push(
          setTimeout(() => {
            fired.current.add(key)
            const text = `${label}: ${t.title}${c ? ` · ${c.name}` : ''}`
            toast(text, { tone: 'success' })
            if ('Notification' in window && Notification.permission === 'granted') {
              try { new Notification('Vendex · Seguimiento', { body: text, tag: key }) } catch { /* navegador sin soporte */ }
            }
          }, delay)
        )
      }
    }
    return () => timers.forEach(clearTimeout)
  }, [data.tasks, contactById, toast])
}

/* Campana: cobros (vencidos, de hoy y próximos 2 días) y seguimientos (atrasados, de hoy y de mañana) */
export function CobroBell() {
  const { contactById, data, money, openModal, isSnoozed, openContact, toggleTask } = useApp()
  const cob = useCobros()
  const tasks = useTaskAlerts()
  useTaskReminders()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [])
  const soon = cob.week.filter((p) => new Date(p.dueAt) - new Date() < 3 * 86400000)
  const items = [...cob.overdue, ...cob.today, ...soon].sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))
  const urgent = cob.overdue.length + cob.today.length + tasks.urgent.length
  const fresh = items.filter((p) => !isSnoozed(`cobro-${p.id}`)).length + tasks.urgent.length
  const I = urgent ? BellRing : Bell
  const product = (p) => data.deals.find((d) => d.id === p.dealId)?.product
  const taskWhen = (t) => {
    const dd = diffDays(t.at)
    return dd < 0 ? `Atrasada · ${rel(t.at)}` : `${dd === 0 ? 'Hoy' : 'Mañana'} a las ${fmtTime(t.at)}`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Avisos: ${urgent}`}
        className="relative grid h-10 w-10 place-items-center rounded-lg bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
      >
        <I size={18} className={urgent ? 'text-rose-600' : ''} />
        {urgent > 0 && (
          <span className={cx('absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white ring-2 ring-[#F8FAFC]', fresh > 0 && 'animate-pulse')}>{urgent}</span>
        )}
      </button>
      {open && (
        <div className="anim-up absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold text-slate-900">Seguimientos</p>
            <Link to="/hoy" onClick={() => setOpen(false)} className="text-xs font-medium text-indigo-600">Ver agenda</Link>
          </div>
          {tasks.pending.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-slate-500">No tienes contactos pendientes para hoy ni mañana.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.pending.map((t) => {
                const k = contactById[t.contactId]
                const dd = diffDays(t.at)
                return (
                  <li key={t.id} className="flex items-start gap-2 px-4 py-3 hover:bg-slate-50">
                    <button onClick={() => { setOpen(false); openContact(k.id) }} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                      <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', dd < 0 ? 'bg-rose-500' : dd === 0 ? 'bg-amber-500' : 'bg-indigo-400')} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><Flag code={k.country} className="h-2.5 w-[15px]" /> <span className="truncate">{k.name}</span></span>
                        <span className="block truncate text-xs text-slate-500">{t.title}</span>
                        <span className={cx('text-xs font-medium', dd < 0 ? 'text-rose-600' : dd === 0 ? 'text-amber-700' : 'text-indigo-600')}>{taskWhen(t)}</span>
                      </span>
                    </button>
                    <button onClick={() => toggleTask(t.id)} title="Marcar como hecha" aria-label="Marcar como hecha" className="grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500">
                      <Check size={14} strokeWidth={3} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex items-center justify-between border-y border-slate-100 px-4 py-3">
            <p className="font-semibold text-slate-900">Cobranza</p>
            <Link to="/cobranza" onClick={() => setOpen(false)} className="text-xs font-medium text-indigo-600">Ver todo</Link>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-slate-500">No hay cobros pendientes para los próximos días.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((p) => {
                const k = contactById[p.contactId]
                return (
                  <li key={p.id}>
                    <button onClick={() => { setOpen(false); openModal('pay', { paymentId: p.id }) }} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50">
                      <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', p.status === 'vencido' ? 'bg-rose-500' : p.status === 'hoy' ? 'bg-amber-500' : 'bg-indigo-400')} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><Flag code={k.country} className="h-2.5 w-[15px]" /> <span className="truncate">{k.name}</span></span>
                        <span className="block truncate text-xs text-slate-500">{p.label} · {product(p)}</span>
                        <span className={cx('text-xs font-medium', p.status === 'vencido' ? 'text-rose-600' : p.status === 'hoy' ? 'text-amber-700' : 'text-indigo-600')}>{dueText(p)}</span>
                      </span>
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">{money(p.amount, p.currency)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          </div>
        </div>
      )}
    </div>
  )
}

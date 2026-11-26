import { useEffect, useRef, useState } from 'react'
import { Sparkles, SquareKanban, Users, Target, Plus, ChevronDown, Check, Coins, RotateCcw, Globe, HandCoins, Bell, BellRing } from 'lucide-react'
import { useCobros } from '../views/Collections'
import { dueText } from '../lib/cobranza'
import { useApp } from '../store'
import { COUNTRIES, SELLERS } from '../data/mock'
import { CURRENCIES } from '../lib/money'
import { Avatar, Button, Flag, Logo, cx } from './ui'

export const NAV = [
  { id: 'hoy', label: 'Hoy', long: 'Hoy · Mi Copiloto', icon: Sparkles },
  { id: 'embudo', label: 'Embudo', long: 'Embudo de ventas', icon: SquareKanban },
  { id: 'clientes', label: 'Clientes', long: 'Clientes y prospectos', icon: Users },
  { id: 'cobranza', label: 'Cobros', long: 'Cobranza', icon: HandCoins },
  { id: 'planeacion', label: 'Plan', long: 'Planeación y estrategia', icon: Target },
]

export function Sidebar({ view }) {
  const { data, reset } = useApp()
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
        {NAV.map((n) => {
          const I = n.icon
          const on = view === n.id
          return (
            <a
              key={n.id}
              href={`#${n.id}`}
              className={cx(
                'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition',
                on ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <I size={18} strokeWidth={on ? 2.4 : 2} />
              <span className="flex-1">{n.long}</span>
              {n.id === 'embudo' && hot > 0 && <span className="rounded-full bg-rose-100 px-1.5 text-[11px] font-semibold text-rose-700">{hot}</span>}
              {n.id === 'cobranza' && due > 0 && <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white">{due}</span>}
            </a>
          )
        })}
      </nav>

      <div className="mt-8 px-5">
        <p className="mb-2 text-xs font-medium text-slate-400">Equipo comercial</p>
        <ul className="space-y-2">
          {Object.values(SELLERS).map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 text-sm text-slate-600">
              <Avatar name={s.name} size="sm" />
              <span className="flex-1 truncate">{s.short}{s.id === 'andres' && <span className="text-slate-400"> (tú)</span>}</span>
              <Flag code={s.country} />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <Avatar name="Andrés Ramírez" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-slate-800">Andrés Ramírez</p>
            <p className="text-xs text-slate-500">Jefe comercial · Perú</p>
          </div>
        </div>
        <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
          <RotateCcw size={12} /> Restablecer datos de demo
        </button>
      </div>
    </aside>
  )
}

export function CountrySwitch({ compact }) {
  const { country, setCountry, data } = useApp()
  const count = (c) => data.contacts.filter((k) => c === 'ALL' || k.country === c).length
  const opts = ['ALL', 'PE', 'BO', 'VE']
  return (
    <div className={cx('flex items-center gap-1 rounded-xl bg-slate-100 p-1', compact && 'w-full')}>
      {opts.map((c) => (
        <button
          key={c}
          onClick={() => setCountry(c)}
          className={cx(
            'inline-flex h-8 items-center justify-center rounded-lg font-medium transition',
            compact ? 'flex-auto gap-1 px-1.5 text-[12px]' : 'gap-1.5 px-2.5 text-[13px]',
            country === c ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {c === 'ALL' ? <Globe size={14} /> : <Flag code={c} />}
          <span>{c === 'ALL' ? 'Todos' : COUNTRIES[c].name}</span>
          {!compact && <span className="text-[11px] text-slate-400">{count(c)}</span>}
        </button>
      ))}
    </div>
  )
}

export function CurrencyMenu() {
  const { currency, setCurrency, data, openModal } = useApp()
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
          <div className="mt-1 border-t border-slate-100 pt-1">
            <button onClick={() => { setOpen(false); openModal('rates') }} className="w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50">
              Editar tipo de cambio del día
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function TopBar({ view }) {
  const { openModal } = useApp()
  const nav = NAV.find((n) => n.id === view)
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#F8FAFC]/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5 lg:hidden">
          <Logo size={30} />
          <span className="text-base font-bold tracking-tight text-slate-900">Vendex</span>
        </div>
        <h1 className="hidden text-[15px] font-semibold text-slate-800 lg:block">{nav?.long}</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block"><CountrySwitch /></div>
          <CurrencyMenu />
          <CobroBell />
          <div className="hidden sm:block"><Button variant="primary" onClick={() => openModal('deal')}>
            <Plus size={16} strokeWidth={2.5} /> Nuevo trato
          </Button></div>
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden"><CountrySwitch compact /></div>
    </header>
  )
}

export function MobileNav({ view }) {
  const { openModal } = useApp()
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
        <div className="grid h-16 grid-cols-5">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className={cx('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium', view === n.id ? 'text-indigo-600' : 'text-slate-500')}>
              <n.icon size={21} strokeWidth={view === n.id ? 2.4 : 2} />
              {n.label}
              {n.id === 'cobranza' && due > 0 && (
                <span className="absolute left-1/2 top-1.5 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{due}</span>
              )}
            </a>
          ))}
        </div>
      </nav>
    </>
  )
}

/* Campana: avisos de cobros vencidos, de hoy y próximos 2 días */
export function CobroBell() {
  const { contactById, data, money, openModal, isSnoozed } = useApp()
  const cob = useCobros()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [])
  const soon = cob.week.filter((p) => new Date(p.dueAt) - new Date() < 3 * 86400000)
  const items = [...cob.overdue, ...cob.today, ...soon].sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))
  const urgent = cob.overdue.length + cob.today.length
  const fresh = items.filter((p) => !isSnoozed(`cobro-${p.id}`)).length
  const I = urgent ? BellRing : Bell
  const product = (p) => data.deals.find((d) => d.id === p.dealId)?.product

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Avisos de cobranza: ${urgent}`}
        className="relative grid h-10 w-10 place-items-center rounded-lg bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
      >
        <I size={18} className={urgent ? 'text-rose-600' : ''} />
        {urgent > 0 && (
          <span className={cx('absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white ring-2 ring-[#F8FAFC]', fresh > 0 && 'animate-pulse')}>{urgent}</span>
        )}
      </button>
      {open && (
        <div className="anim-up absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold text-slate-900">Avisos de cobranza</p>
            <a href="#cobranza" onClick={() => setOpen(false)} className="text-xs font-medium text-indigo-600">Ver todo</a>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No hay cobros pendientes para los próximos días.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
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
      )}
    </div>
  )
}

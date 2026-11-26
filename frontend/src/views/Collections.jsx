import { useState } from 'react'
import { Search, MessageCircle, Banknote, CircleAlert, CalendarClock, CalendarDays, CircleCheck, Receipt, Plus } from 'lucide-react'
import { useApp } from '../store'
import { COUNTRIES } from '../data/mock'
import { Avatar, Button, Card, Chip, Empty, Flag, cx } from '../components/ui'
import { AGING, PAY_UI, dueText, payStatus } from '../lib/cobranza'
import { diffDays, fmtDate, startOfMonth } from '../lib/dates'

/** Cuotas visibles según el país elegido, con su estado calculado */
// eslint-disable-next-line react-refresh/only-export-components
export function useCobros() {
  const { data, contactById, inCountry, usd } = useApp()
  const all = data.payments
    .filter((p) => inCountry(contactById[p.contactId]?.country))
    .map((p) => ({ ...p, status: payStatus(p), usd: usd(p.amount, p.currency) }))
  const pending = all.filter((p) => p.status !== 'pagado')
  const sum = (arr) => arr.reduce((s, p) => s + p.usd, 0)
  const by = (st) => pending.filter((p) => p.status === st)
  const som = startOfMonth().toISOString()
  return {
    all,
    pending,
    overdue: by('vencido'),
    today: by('hoy'),
    week: by('semana'),
    paidMonth: all.filter((p) => p.status === 'pagado' && p.paidAt >= som),
    sum,
  }
}

const FILTERS = [
  { id: 'pendientes', label: 'Por cobrar' },
  { id: 'vencido', label: 'Vencidas' },
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'pagado', label: 'Pagadas' },
]

export default function Collections() {
  const { data, contactById, inCountry, fromUSD, usd, openModal } = useApp()
  const c = useCobros()
  const [f, setF] = useState('pendientes')
  const [q, setQ] = useState('')
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const dealById = Object.fromEntries(data.deals.map((d) => [d.id, d]))

  const counts = { pendientes: c.pending.length, vencido: c.overdue.length, hoy: c.today.length, semana: c.week.length, pagado: c.all.length - c.pending.length }
  const list = (f === 'pendientes' ? c.pending : c.all.filter((p) => p.status === f))
    .filter((p) => {
      if (!q) return true
      const k = contactById[p.contactId]
      return norm(`${k.name} ${k.company} ${dealById[p.dealId]?.product} ${k.city}`).includes(norm(q))
    })
    .sort((a, b) => (f === 'pagado' ? (a.paidAt < b.paidAt ? 1 : -1) : a.dueAt < b.dueAt ? -1 : 1))

  const aging = AGING.map((a) => {
    const items = c.overdue.filter((p) => a.test(-diffDays(p.dueAt)))
    return { ...a, total: c.sum(items), count: items.length }
  })
  const agingMax = Math.max(1, ...aging.map((a) => a.total))
  const byCountry = Object.keys(COUNTRIES)
    .filter((k) => inCountry(k))
    .map((k) => {
      const items = c.pending.filter((p) => contactById[p.contactId].country === k)
      return { k, total: c.sum(items), late: c.sum(items.filter((p) => p.status === 'vencido')) }
    })
  const countryMax = Math.max(1, ...byCountry.map((r) => r.total))
  const noPlan = data.deals.filter((d) => d.stage === 'cerrado' && inCountry(contactById[d.contactId]?.country) && !data.payments.some((p) => p.dealId === d.id))

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi icon={CircleAlert} tone="rose" label="Vencido" value={fromUSD(c.sum(c.overdue), { compact: true })} sub={`${c.overdue.length} cuota${c.overdue.length === 1 ? '' : 's'} atrasada${c.overdue.length === 1 ? '' : 's'}`} onClick={() => setF('vencido')} />
        <Kpi icon={CalendarClock} tone="amber" label="Vence hoy" value={fromUSD(c.sum(c.today), { compact: true })} sub={`${c.today.length} cobro${c.today.length === 1 ? '' : 's'} para hoy`} onClick={() => setF('hoy')} />
        <Kpi icon={CalendarDays} tone="indigo" label="Próximos 7 días" value={fromUSD(c.sum(c.week), { compact: true })} sub={`${c.week.length} cuota${c.week.length === 1 ? '' : 's'}`} onClick={() => setF('semana')} />
        <Kpi icon={CircleCheck} tone="emerald" label="Cobrado este mes" value={fromUSD(c.sum(c.paidMonth), { compact: true })} sub={`Total por cobrar: ${fromUSD(c.sum(c.pending), { compact: true })}`} onClick={() => setF('pagado')} />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente o producto" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-base outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 sm:text-sm" />
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {FILTERS.map((x) => (
                <Chip key={x.id} active={f === x.id} onClick={() => setF(x.id)}>
                  {x.id !== 'pendientes' && x.id !== 'pagado' && <span className={cx('h-1.5 w-1.5 rounded-full', PAY_UI[x.id].dot)} />}
                  {x.label} <span className={cx('text-[11px]', f === x.id ? 'text-slate-300' : 'text-slate-400')}>{counts[x.id]}</span>
                </Chip>
              ))}
            </div>
          </div>

          {list.length === 0 ? (
            <Card><Empty icon={Receipt} title={f === 'vencido' ? 'Sin cuotas vencidas' : 'Nada por aquí'} text="Cuando una cuota esté por vencer, Vendex te avisará en “Hoy”." /></Card>
          ) : (
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {list.map((p) => <Row key={p.id} p={p} deal={dealById[p.dealId]} />)}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold text-slate-900">Antigüedad de la deuda vencida</h2>
            <p className="text-xs text-slate-500">Mientras más días pasan, más difícil es cobrar</p>
            <ul className="mt-4 space-y-3">
              {aging.map((a) => (
                <li key={a.id}>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">{a.label}</span><b className="font-semibold tabular-nums text-slate-900">{fromUSD(a.total)}</b></div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full transition-all', a.cls)} style={{ width: `${(a.total / agingMax) * 100}%` }} /></div>
                  <p className="mt-1 text-xs text-slate-400">{a.count} cuota{a.count === 1 ? '' : 's'}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-slate-900">Por cobrar por país</h2>
            <ul className="mt-4 space-y-4">
              {byCountry.map((r) => (
                <li key={r.k}>
                  <div className="flex items-center gap-2 text-sm">
                    <Flag code={r.k} /> <span className="font-medium text-slate-800">{COUNTRIES[r.k].name}</span>
                    <b className="ml-auto font-semibold tabular-nums text-slate-900">{fromUSD(r.total, { compact: true })}</b>
                  </div>
                  <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-200" style={{ width: `${(r.total / countryMax) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-rose-500" style={{ width: `${(r.late / countryMax) * 100}%` }} />
                  </div>
                  {r.late > 0 && <p className="mt-1 text-xs text-rose-600">{fromUSD(r.late, { compact: true })} vencido</p>}
                </li>
              ))}
            </ul>
          </Card>

          {noPlan.length > 0 && (
            <Card className="border-amber-200 p-5">
              <h2 className="font-semibold text-slate-900">Ventas sin plan de cobro</h2>
              <p className="text-xs text-slate-500">Define cómo te pagarán para recibir avisos</p>
              <ul className="mt-3 space-y-2">
                {noPlan.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-xl bg-amber-50/60 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{contactById[d.contactId].name}</p>
                      <p className="truncate text-xs text-slate-500">{d.product} · {fromUSD(usd(d.amount, d.currency))}</p>
                    </div>
                    <Button size="sm" variant="primary" onClick={() => openModal('plan', { dealId: d.id })}><Plus size={14} /> Plan</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon: I, label, value, sub, tone, onClick }) {
  const t = { rose: 'text-rose-600', amber: 'text-amber-600', indigo: 'text-indigo-600', emerald: 'text-emerald-600' }[tone]
  return (
    <button onClick={onClick} className="text-left">
      <Card className="h-full p-4 transition hover:border-indigo-200 hover:shadow-md sm:p-5">
        <div className="flex items-center gap-2 text-sm text-slate-500"><I size={16} className={t} /> {label}</div>
        <p className={cx('mt-2 text-2xl font-bold tracking-tight', tone === 'rose' || tone === 'emerald' ? t : 'text-slate-900')}>{value}</p>
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      </Card>
    </button>
  )
}

export function Row({ p, deal, compact }) {
  const { contactById, money, original, currency, openModal, openContact } = useApp()
  const k = contactById[p.contactId]
  const ui = PAY_UI[p.status]
  const paid = p.status === 'pagado'
  return (
    <div className={cx('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', p.status === 'vencido' && 'bg-rose-50/30')}>
      <button onClick={() => openContact(k.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar name={k.name} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium text-slate-900">{k.name} <Flag code={k.country} className="h-2.5 w-[15px]" /></p>
          <p className="truncate text-xs text-slate-500">{deal?.product} · {p.label}</p>
          <span className={cx('mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', ui.cls)}>
            {paid ? `Pagado el ${fmtDate(p.paidAt)} · ${p.method}` : `${dueText(p)} · ${fmtDate(p.dueAt)}`}
          </span>
        </div>
      </button>
      <div className="flex items-center gap-3 sm:justify-end">
        <div className="mr-auto text-left sm:mr-0 sm:text-right">
          <p className={cx('whitespace-nowrap font-bold tabular-nums', paid ? 'text-emerald-600' : p.status === 'vencido' ? 'text-rose-600' : 'text-slate-900')}>{money(p.amount, p.currency)}</p>
          {p.currency !== currency && <p className="whitespace-nowrap text-[11px] tabular-nums text-slate-400">{original(p.amount, p.currency)}</p>}
        </div>
        {!paid && (
          <>
            <Button size={compact ? 'icon' : 'sm'} variant="wa" className={compact ? '!h-8 !w-8 justify-center' : ''} title="Recordar por WhatsApp" onClick={() => openModal('wa', { contactId: k.id, paymentId: p.id, template: 'cobro' })}>
              <MessageCircle size={14} />{!compact && <span className="hidden lg:inline">Recordar</span>}
            </Button>
            <Button size="sm" variant="success" onClick={() => openModal('pay', { paymentId: p.id })}>
              <Banknote size={14} /> Registrar pago
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

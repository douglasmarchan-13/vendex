import { useState } from 'react'
import {
  Sparkles, Flame, TriangleAlert, PhoneMissed, CalendarClock, Landmark, ArrowLeftRight, Phone, MessageCircle,
  Clock, Video, MapPin, Plus, Target, Wallet, ListChecks, CalendarX2, ChevronRight, Check, Banknote, HandCoins, CalendarClock as CalClock,
} from 'lucide-react'
import { useApp } from '../store'
import { useCobros } from './Collections'
import { COUNTRIES, GOAL_SHARE } from '../data/mock'
import { Avatar, Button, Card, Empty, Field, Flag, Progress, cx, inputCls } from '../components/ui'
import { diffDays, fmtTime, startOfMonth, todayLong, at } from '../lib/dates'

const ALERT_UI = {
  hot: { icon: Flame, cls: 'bg-rose-50 text-rose-600', tag: 'Oportunidad' },
  stale: { icon: TriangleAlert, cls: 'bg-amber-50 text-amber-600', tag: 'Riesgo' },
  noanswer: { icon: PhoneMissed, cls: 'bg-slate-100 text-slate-600', tag: 'Cambia de canal' },
  promise: { icon: CalendarClock, cls: 'bg-indigo-50 text-indigo-600', tag: 'Lo prometiste' },
  credit: { icon: Landmark, cls: 'bg-emerald-50 text-emerald-600', tag: 'Momento de cierre' },
  fx: { icon: ArrowLeftRight, cls: 'bg-sky-50 text-sky-600', tag: 'Multimoneda' },
  cobro: { icon: HandCoins, cls: 'bg-rose-100 text-rose-700', tag: 'Cobro vencido' },
  cobroHoy: { icon: Banknote, cls: 'bg-amber-100 text-amber-700', tag: 'Toca cobrar' },
  cobroPronto: { icon: CalClock, cls: 'bg-indigo-50 text-indigo-600', tag: 'Cobro próximo' },
}

export const TASK_ICONS = { llamada: Phone, whatsapp: MessageCircle, reunion: Video, visita: MapPin }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export default function Today() {
  const app = useApp()
  const { data, contactById, inCountry, usd, fromUSD, money, country } = app
  const visibleDeals = data.deals.filter((d) => inCountry(contactById[d.contactId]?.country))
  const som = startOfMonth().toISOString()
  const closed = visibleDeals.filter((d) => d.stage === 'cerrado' && d.closedAt >= som)
  const soldMonth = closed.reduce((s, d) => s + usd(d.amount, d.currency), 0)
  const soldToday = closed.filter((d) => diffDays(d.closedAt) === 0).reduce((s, d) => s + usd(d.amount, d.currency), 0)
  const goal = data.goalUSD * (country === 'ALL' ? 1 : GOAL_SHARE[country])
  const pct = Math.round((soldMonth / goal) * 100)
  const open = visibleDeals.filter((d) => ['cotizacion', 'negociacion'].includes(d.stage))
  const openUSD = open.reduce((s, d) => s + usd(d.amount, d.currency), 0)
  const hotCount = open.filter((d) => d.temp === 'caliente').length
  const late = visibleDeals.filter((d) => !['cerrado', 'pausa'].includes(d.stage) && diffDays(d.nextAt) < 0)

  const tasks = data.tasks
    .filter((t) => inCountry(contactById[t.contactId]?.country))
    .filter((t) => diffDays(t.at) === 0 || (diffDays(t.at) < 0 && !t.done))
    .sort((a, b) => (a.at < b.at ? -1 : 1))
  const todays = tasks.filter((t) => diffDays(t.at) === 0)
  const doneCount = todays.filter((t) => t.done).length
  // Avisos de cobranza: vencidos, de hoy y de los próximos 2 días (se generan solos desde el plan de cobro)
  const cob = useCobros()
  const dealById = Object.fromEntries(data.deals.map((d) => [d.id, d]))
  const cobroAlerts = [...cob.overdue, ...cob.today, ...cob.week.filter((p) => diffDays(p.dueAt) <= 2)]
    .filter((p) => !app.isSnoozed(`cobro-${p.id}`))
    .sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))
    .map((p) => {
      const k = contactById[p.contactId]
      const dd = diffDays(p.dueAt)
      const first = k.company || k.name
      return {
        id: `cobro-${p.id}`,
        derived: true,
        paymentId: p.id,
        contactId: p.contactId,
        kind: dd < 0 ? 'cobro' : dd === 0 ? 'cobroHoy' : 'cobroPronto',
        title: dd < 0 ? `${first} lleva ${-dd} día${dd === -1 ? '' : 's'} de atraso en su pago` : dd === 0 ? `Hoy toca cobrar a ${first}` : `En ${dd} día${dd === 1 ? '' : 's'} vence el pago de ${first}`,
        body: `${p.label} · ${dealById[p.dealId]?.product} · ${money(p.amount, p.currency)}`,
        actions: ['pay', 'remind', 'snooze'],
      }
    })
  const alerts = [...cobroAlerts, ...data.alerts.filter((a) => inCountry(contactById[a.contactId]?.country))]

  return (
    <div className="space-y-6">
      {/* Saludo */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-900 px-5 py-6 text-white sm:px-8 sm:py-8">
        <svg className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 opacity-20" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="90" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="100" cy="100" r="60" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="100" cy="100" r="30" fill="none" stroke="#fff" strokeWidth="1" />
          <path d="M100 100 L170 40" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />
          <circle cx="170" cy="40" r="6" fill="#34D399" />
        </svg>
        <p className="text-sm text-indigo-200">{todayLong().replace(/^./, (ch) => ch.toUpperCase())}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">¡{greeting()}, Andrés!</h2>
        <p className="mt-1 max-w-xl text-indigo-100">Aquí tienes tu plan de vuelo para hoy.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1">{todays.length - doneCount} tareas pendientes</span>
          <span className="rounded-full bg-white/15 px-3 py-1">{hotCount} tratos calientes</span>
          <span className="rounded-full bg-emerald-400/25 px-3 py-1 text-emerald-50">{fromUSD(openUSD, { compact: true })} por cerrar</span>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Card className="col-span-2 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Target size={16} className="text-indigo-600" /> Meta del mes {country !== 'ALL' && <>· <Flag code={country} /> {COUNTRIES[country].name}</>}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{fromUSD(soldMonth)}</span>
            <span className="text-sm text-slate-500">de {fromUSD(goal)}</span>
          </div>
          <Progress value={pct} className="mt-3 h-2.5" />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-600">{pct}% alcanzado</span>
            <span className={cx('rounded-full px-2 py-0.5 font-medium', soldToday > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
              Vendido hoy: {fromUSD(soldToday)}
            </span>
          </div>
        </Card>
        <Kpi icon={Wallet} label="Por cerrar" value={fromUSD(openUSD, { compact: true })} sub={`${open.length} tratos · ${hotCount} calientes`} href="#embudo" />
        <Kpi
          icon={ListChecks}
          label="Tareas de hoy"
          value={`${doneCount}/${todays.length}`}
          sub={<Progress value={todays.length ? (doneCount / todays.length) * 100 : 0} className="mt-1 h-1.5" color="bg-indigo-500" />}
        />
        <Kpi
          icon={CalendarX2}
          label="Seguimientos vencidos"
          value={late.length}
          tone={late.length ? 'warn' : undefined}
          sub={late.length ? 'Atiéndelos primero' : '¡Al día!'}
          href="#embudo"
          className="col-span-2 sm:col-span-1 xl:hidden"
        />
      </section>

      {/* Resumen de cobranza */}
      {cob.pending.length > 0 && (
        <a href="#cobranza" className="block">
          <Card className={cx('flex flex-col gap-3 p-4 transition hover:shadow-md sm:flex-row sm:items-center sm:p-5', cob.overdue.length ? 'border-rose-200 bg-rose-50/40' : '')}>
            <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl', cob.overdue.length ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-700')}><HandCoins size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">Cobranza</p>
              <p className="text-sm text-slate-600">
                {cob.overdue.length > 0 && <b className="font-semibold text-rose-700">{fromUSD(cob.sum(cob.overdue))} vencido ({cob.overdue.length}) · </b>}
                {cob.today.length > 0 && <b className="font-semibold text-amber-700">{fromUSD(cob.sum(cob.today))} vence hoy · </b>}
                {fromUSD(cob.sum(cob.week))} en los próximos 7 días
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600">Gestionar cobros <ChevronRight size={16} /></span>
          </Card>
        </a>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Alertas del Copiloto */}
        <Card className="overflow-hidden lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-white px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white"><Sparkles size={18} /></span>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Alertas del Copiloto</h3>
              <p className="text-xs text-slate-500">Recomendaciones según tu historial de seguimiento</p>
            </div>
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <Empty icon={Check} title="Todo en orden" text="No hay alertas pendientes para este país. ¡Buen trabajo!" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {alerts.map((a) => <AlertRow key={a.id} a={a} />)}
            </ul>
          )}
        </Card>

        {/* Agenda */}
        <Agenda tasks={tasks} late={late} money={money} className="lg:col-span-2" />
      </div>
    </div>
  )
}

function Kpi({ icon: I, label, value, sub, href, tone, className }) {
  const Tag = href ? 'a' : 'div'
  return (
    <Tag href={href} className={cx('block', className)}>
      <Card className={cx('h-full p-4 sm:p-5', href && 'transition hover:border-indigo-200 hover:shadow-md')}>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <I size={16} className={tone === 'warn' ? 'text-amber-500' : 'text-indigo-600'} /> {label}
        </div>
        <p className={cx('mt-2 text-2xl font-bold tracking-tight', tone === 'warn' ? 'text-amber-600' : 'text-slate-900')}>{value}</p>
        <div className="mt-1 text-xs text-slate-500">{sub}</div>
      </Card>
    </Tag>
  )
}

function AlertRow({ a }) {
  const { contactById, openModal, dismissAlert, openContact, snooze } = useApp()
  const c = contactById[a.contactId]
  const ui = ALERT_UI[a.kind]
  const I = ui.icon
  const act = {
    pay: <Button key="pay" size="sm" variant="success" onClick={() => openModal('pay', { paymentId: a.paymentId })}><Banknote size={14} /> Registrar pago</Button>,
    remind: <Button key="rem" size="sm" variant="wa" onClick={() => openModal('wa', { contactId: c.id, paymentId: a.paymentId, template: 'cobro' })}><MessageCircle size={14} /> Recordar por WhatsApp</Button>,
    call: <Button key="call" size="sm" variant="primary" onClick={() => openModal('call', { contactId: c.id, alertId: a.id })}><Phone size={14} /> Llamar ahora</Button>,
    whatsapp: <Button key="wa" size="sm" variant="wa" onClick={() => openModal('wa', { contactId: c.id, alertId: a.id, template: a.kind === 'noanswer' ? 'video' : a.kind === 'credit' ? 'separar' : 'seguimiento' })}><MessageCircle size={14} /> Enviar WhatsApp</Button>,
    split: <Button key="split" size="sm" variant="primary" onClick={() => openModal('split', { contactId: c.id, alertId: a.id })}><ArrowLeftRight size={14} /> Calcular pago mixto</Button>,
    snooze: <Button key="sn" size="sm" variant="ghost" onClick={() => (a.derived ? snooze(a.id) : dismissAlert(a.id))}><Clock size={14} /> Posponer</Button>,
  }
  return (
    <li className="anim-fade flex gap-3 px-5 py-4">
      <span className={cx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', ui.cls)}><I size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] font-semibold text-slate-400">{ui.tag}</span>
          <button onClick={() => openContact(c.id)} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600">
            <Flag code={c.country} className="h-2.5 w-[15px]" /> {c.city}
          </button>
        </div>
        <p className="mt-0.5 font-medium leading-snug text-slate-900">{a.title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{a.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">{a.actions.map((k) => act[k])}</div>
      </div>
    </li>
  )
}

function Agenda({ tasks, late, className }) {
  const { data, contactById, toggleTask, openContact, addTask, inCountry } = useApp()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ time: '12:00', contactId: '', title: '', type: 'llamada' })
  const contacts = data.contacts.filter((c) => inCountry(c.country))

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.contactId) return
    const [h, m] = form.time.split(':').map(Number)
    addTask({ at: at(0, h, m), type: form.type, contactId: form.contactId, title: form.title.trim() })
    setForm({ ...form, title: '' })
    setAdding(false)
  }

  return (
    <Card className={cx('flex flex-col', className)}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-slate-900">Agenda del día</h3>
          <p className="text-xs text-slate-500">Llamadas, visitas y reuniones</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}><Plus size={14} /> Tarea</Button>
      </div>

      {adding && (
        <form onSubmit={submit} className="anim-fade space-y-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <Field label="Hora"><input type="time" className={inputCls} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
            <Field label="Tipo">
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="llamada">Llamada</option><option value="whatsapp">WhatsApp</option><option value="reunion">Reunión</option><option value="visita">Visita de campo</option>
              </select>
            </Field>
          </div>
          <Field label="Cliente">
            <select className={inputCls} value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })} required>
              <option value="">Elegir cliente…</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
            </select>
          </Field>
          <Field label="¿Qué vas a hacer?"><input className={inputCls} placeholder="Ej. Confirmar fecha de entrega" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" variant="primary" type="submit">Agregar</Button>
          </div>
        </form>
      )}

      {late.length > 0 && (
        <a href="#embudo" className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          <CalendarX2 size={16} /> <span className="flex-1">{late.length} seguimiento{late.length > 1 ? 's' : ''} vencido{late.length > 1 ? 's' : ''} en el embudo</span> <ChevronRight size={16} />
        </a>
      )}

      {tasks.length === 0 ? (
        <Empty icon={ListChecks} title="Agenda libre" text="Agrega una tarea para no olvidar a ningún cliente." />
      ) : (
        <ul className="px-2 py-2">
          {tasks.map((t) => {
            const c = contactById[t.contactId]
            const I = TASK_ICONS[t.type] || Phone
            const overdue = diffDays(t.at) < 0
            return (
              <li key={t.id} className="group flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                <button
                  onClick={() => toggleTask(t.id)}
                  aria-label={t.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
                  className={cx(
                    'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition',
                    t.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-500'
                  )}
                >
                  {t.done && <Check size={14} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cx('font-semibold tabular-nums', overdue ? 'text-amber-600' : 'text-slate-500')}>{overdue ? 'Atrasada' : fmtTime(t.at)}</span>
                    <I size={13} className="text-slate-400" />
                  </div>
                  <p className={cx('text-sm leading-snug', t.done ? 'text-slate-400 line-through' : 'text-slate-800')}>{t.title}</p>
                  <button onClick={() => openContact(c.id)} className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600">
                    <Avatar name={c.name} size="xs" /> <span className="truncate">{c.name}</span> <Flag code={c.country} className="h-2.5 w-[15px]" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

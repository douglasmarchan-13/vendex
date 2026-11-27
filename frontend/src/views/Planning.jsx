import { useState } from 'react'
import { Calculator, Users, PhoneCall, FileText, Trophy, Crosshair, Tag, ScrollText, Pencil, Trash2, Copy, Plus, Check, SlidersHorizontal } from 'lucide-react'
import { useApp } from '../store'
import { COUNTRIES, GOAL_SHARE } from '../data/mock'
import { Button, Card, Flag, cx, inputCls } from '../components/ui'
import { startOfMonth } from '../lib/dates'

const KIND = {
  enfoque: { icon: Crosshair, cls: 'bg-indigo-50 text-indigo-600', label: 'Enfoque' },
  promo: { icon: Tag, cls: 'bg-emerald-50 text-emerald-600', label: 'Promoción' },
  guion: { icon: ScrollText, cls: 'bg-amber-50 text-amber-700', label: 'Guion de venta' },
}

export default function Planning() {
  const { data, setGoal, setPlan, fromUSD, usd, contactById, canManage } = useApp()
  const { plan, goalUSD } = data
  const [adv, setAdv] = useState(false)

  const sales = Math.max(1, Math.ceil(goalUSD / plan.ticketUSD))
  const quotes = Math.ceil(sales / (plan.closeRate / 100))
  const leads = Math.ceil(quotes / (plan.quoteRate / 100))
  const leadsWeek = Math.ceil(leads / 4.3)
  const quotesWeek = Math.ceil(quotes / 4.3)
  const callsDay = Math.ceil((leads * plan.callsPerLead) / plan.workDays)

  const som = startOfMonth().toISOString()
  const byCountry = Object.keys(COUNTRIES).map((k) => {
    const ds = data.deals.filter((d) => contactById[d.contactId]?.country === k)
    const sold = ds.filter((d) => d.stage === 'cerrado' && d.closedAt >= som).reduce((s, d) => s + usd(d.amount, d.currency), 0)
    const pipe = ds.filter((d) => ['cotizacion', 'negociacion'].includes(d.stage)).reduce((s, d) => s + usd(d.amount, d.currency), 0)
    return { k, sold, pipe, goal: goalUSD * GOAL_SHARE[k] }
  })

  const funnel = [
    { label: 'Prospectos nuevos al mes', v: leads, icon: Users },
    { label: 'Cotizaciones a enviar', v: quotes, icon: FileText },
    { label: 'Ventas a cerrar', v: sales, icon: Trophy },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-5">
        {/* Simulador */}
        <Card className="p-5 sm:p-6 xl:col-span-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white"><Calculator size={18} /></span>
            <div>
              <h2 className="font-semibold text-slate-900">Simulador de meta mensual</h2>
              <p className="text-xs text-slate-500">Mueve la meta y Vendex calcula tu ritmo de trabajo</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label htmlFor="goal" className="text-sm text-slate-500">Meta de ventas del mes (equipo)</label>
              <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-4xl">{fromUSD(goalUSD)}</span>
            </div>
            <input id="goal" type="range" min={50000} max={500000} step={5000} value={goalUSD} disabled={!canManage} title={canManage ? undefined : 'La meta la define el gerente'} onChange={(e) => setGoal(Number(e.target.value))} className="range mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60" style={{ '--p': `${((goalUSD - 50000) / 450000) * 100}%` }} />
            <div className="mt-1 flex justify-between text-xs text-slate-400 tabular-nums"><span>{fromUSD(50000, { compact: true })}</span><span>{fromUSD(500000, { compact: true })}</span></div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Big icon={Users} value={leadsWeek} label="prospectos nuevos por semana" tone="indigo" />
            <Big icon={PhoneCall} value={callsDay} label="llamadas por día hábil" tone="emerald" />
            <Big icon={FileText} value={quotesWeek} label="cotizaciones por semana" tone="slate" />
          </div>

          <div className="mt-6 space-y-2">
            {funnel.map((f, i) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  {/* En el teléfono la etiqueta va arriba de la barra: dentro de una barra corta no se leería */}
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700 sm:hidden">
                    <f.icon size={14} className="shrink-0 text-slate-400" /> <span className="truncate">{f.label}</span>
                  </p>
                  <div
                    className={cx('flex h-2.5 min-w-0 items-center gap-2 rounded-full text-sm font-medium text-white transition-all duration-500 sm:h-9 sm:rounded-lg sm:px-3', ['bg-indigo-600', 'bg-indigo-500', 'bg-emerald-500'][i])}
                    style={{ width: `${Math.max(28, (f.v / leads) * 100)}%` }}
                  >
                    <f.icon size={15} className="hidden shrink-0 sm:block" /> <span className="hidden truncate sm:inline">{f.label}</span>
                  </div>
                </div>
                <span className="w-12 shrink-0 text-right text-lg font-bold tabular-nums text-slate-900">{f.v}</span>
              </div>
            ))}
          </div>

          {canManage && <button onClick={() => setAdv((v) => !v)} className="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-left text-sm font-medium text-indigo-600">
            <SlidersHorizontal size={15} className="shrink-0" /> <span className="whitespace-nowrap">{adv ? 'Ocultar supuestos' : 'Ajustar supuestos'}</span> <span className="font-normal text-slate-400">· ticket {fromUSD(plan.ticketUSD, { compact: true })}, cierre {plan.closeRate}%</span>
          </button>}
          {canManage && adv && (
            <div className="anim-fade mt-4 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <Param label="Ticket promedio" value={fromUSD(plan.ticketUSD)} min={5000} max={150000} step={1000} v={plan.ticketUSD} on={(v) => setPlan({ ticketUSD: v })} />
              <Param label="Cotizaciones que se cierran" value={`${plan.closeRate}%`} min={5} max={60} v={plan.closeRate} on={(v) => setPlan({ closeRate: v })} />
              <Param label="Prospectos que piden cotización" value={`${plan.quoteRate}%`} min={10} max={80} v={plan.quoteRate} on={(v) => setPlan({ quoteRate: v })} />
              <Param label="Llamadas por prospecto" value={plan.callsPerLead} min={1} max={10} v={plan.callsPerLead} on={(v) => setPlan({ callsPerLead: v })} hint="Incluye los “no contesta”" />
            </div>
          )}
        </Card>

        {/* Meta por país */}
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <h2 className="font-semibold text-slate-900">Meta por país</h2>
          <p className="text-xs text-slate-500">Vendido este mes y lo que está en cotización o negociación</p>
          <ul className="mt-5 space-y-5">
            {byCountry.map((r) => {
              const pct = Math.round((r.sold / r.goal) * 100)
              return (
                <li key={r.k}>
                  <div className="flex items-center gap-2 text-sm">
                    <Flag code={r.k} />
                    <span className="font-medium text-slate-800">{COUNTRIES[r.k].name}</span>
                    <span className="text-xs text-slate-400">{Math.round(GOAL_SHARE[r.k] * 100)}% de la meta</span>
                    <span className="ml-auto font-semibold tabular-nums text-emerald-600">{pct}%</span>
                  </div>
                  <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-200" style={{ width: `${Math.min(100, ((r.sold + r.pipe) / r.goal) * 100)}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs tabular-nums text-slate-500">
                    <span><b className="font-semibold text-slate-700">{fromUSD(r.sold, { compact: true })}</b> de {fromUSD(r.goal, { compact: true })}</span>
                    <span>{fromUSD(r.pipe, { compact: true })} en juego</span>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="mt-5 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Vendido</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-200" /> En juego</span>
          </div>
        </Card>
      </div>

      <StrategyBoard />
    </div>
  )
}

function Big({ icon: I, value, label, tone }) {
  const t = { indigo: 'bg-indigo-50 text-indigo-700', emerald: 'bg-emerald-50 text-emerald-700', slate: 'bg-slate-50 text-slate-700' }[tone]
  return (
    <div className={cx('rounded-xl p-4', t)}>
      <I size={18} />
      <p key={value} className="anim-pop mt-2 text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  )
}

function Param({ label, value, v, min, max, step = 1, on, hint }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><b className="font-semibold tabular-nums text-slate-900">{value}</b></span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(Number(e.target.value))} className="range mt-2 w-full" style={{ '--p': `${((v - min) / (max - min)) * 100}%` }} />
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

function StrategyBoard() {
  const { data, saveStrategy, removeStrategy, newId, canManage } = useApp()
  const [editing, setEditing] = useState(null)
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Tablero de estrategia semanal</h2>
          <p className="text-xs text-slate-500">Lo que todo el equipo debe tener presente esta semana</p>
        </div>
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => { const id = newId('s'); setEditing({ id, kind: 'guion', title: '', body: '', isNew: true }) }}>
            <Plus size={14} /> Tarjeta
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {editing?.isNew && <StrategyCard s={editing} editing onDone={(item) => { if (item) saveStrategy(item); setEditing(null) }} />}
        {data.strategy.map((s) => (
          <StrategyCard
            key={s.id}
            s={editing?.id === s.id ? editing : s}
            editing={editing?.id === s.id}
            onEdit={canManage ? () => setEditing(s) : undefined}
            onRemove={canManage ? () => removeStrategy(s.id) : undefined}
            onDone={(item) => { if (item) saveStrategy(item); setEditing(null) }}
          />
        ))}
      </div>
    </section>
  )
}

function StrategyCard({ s, editing, onEdit, onRemove, onDone }) {
  const { toast } = useApp()
  const [draft, setDraft] = useState(s)
  const [copied, setCopied] = useState(false)
  const K = KIND[draft.kind] || KIND.enfoque

  if (editing) {
    return (
      <Card className="anim-fade flex flex-col gap-3 p-4 ring-2 ring-indigo-200">
        <div className="flex gap-1">
          {Object.entries(KIND).map(([k, v]) => (
            <button key={k} onClick={() => setDraft({ ...draft, kind: k })} className={cx('flex-1 rounded-lg px-2 py-1.5 text-xs font-medium', draft.kind === k ? v.cls : 'text-slate-500 hover:bg-slate-50')}>{v.label}</button>
          ))}
        </div>
        <input autoFocus className={inputCls} placeholder="Título" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <textarea rows={6} className={cx(inputCls, 'h-auto py-2 leading-relaxed')} placeholder="Escribe aquí…" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => onDone(null)}>Cancelar</Button>
          <Button size="sm" variant="primary" disabled={!draft.title.trim()} onClick={() => { const { isNew, ...item } = draft; void isNew; onDone(item); toast('Tarjeta guardada', { tone: 'success' }) }}>Guardar</Button>
        </div>
      </Card>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast('Tu navegador no permitió copiar')
    }
  }

  return (
    <Card className="group flex flex-col p-4">
      <div className="flex items-center gap-2">
        <span className={cx('grid h-8 w-8 place-items-center rounded-lg', K.cls)}><K.icon size={16} /></span>
        <span className="text-xs font-medium text-slate-400">{K.label}</span>
        <div className="ml-auto flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          {s.kind === 'guion' && <Button size="icon" variant="ghost" className="!h-8 !w-8" title="Copiar guion" onClick={copy}>{copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}</Button>}
          {onEdit && <Button size="icon" variant="ghost" className="!h-8 !w-8" title="Editar" onClick={() => { setDraft(s); onEdit() }}><Pencil size={15} /></Button>}
          {onRemove && <Button size="icon" variant="ghost" className="!h-8 !w-8" title="Eliminar" onClick={onRemove}><Trash2 size={15} /></Button>}
        </div>
      </div>
      <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">{s.body}</p>
    </Card>
  )
}

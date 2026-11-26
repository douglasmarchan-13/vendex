import { useState } from 'react'
import { Banknote, CalendarClock, ReceiptText } from 'lucide-react'
import { useApp } from '../store'
import { COUNTRIES, PAY_METHODS } from '../data/mock'
import { CURRENCIES, convert, fmtMoney } from '../lib/money'
import { buildPlan, dueText } from '../lib/cobranza'
import { at, fmtDate } from '../lib/dates'
import { Button, Field, Flag, Modal, cx, inputCls } from './ui'

const round2 = (x) => Math.round(x * 100) / 100

/* ================= Registrar pago ================= */
export function PayModal({ onClose, paymentId }) {
  const { data, contactById, registerPayment } = useApp()
  const p = data.payments.find((x) => x.id === paymentId)
  const deal = p && data.deals.find((x) => x.id === p.dealId)
  const c = p && contactById[p.contactId]
  const methods = PAY_METHODS[c?.country] || PAY_METHODS.PE
  const [amount, setAmount] = useState(p ? String(p.amount) : '')
  const [cur, setCur] = useState(p?.currency || 'USD')
  const [method, setMethod] = useState(methods[0])
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [ref, setRef] = useState('')
  if (!p) return null
  const value = Number(amount) || 0
  const inDealCur = round2(convert(value, cur, p.currency, data.rates))
  const full = inDealCur >= p.amount - 0.009
  const local = COUNTRIES[c.country].local
  const curOpts = [...new Set([p.currency, 'USD', local])]
  const setIn = (amt) => setAmount(String(round2(convert(amt, p.currency, cur, data.rates))))

  const save = (e) => {
    e.preventDefault()
    if (value <= 0) return
    registerPayment(p.id, { amount: Math.min(inDealCur, p.amount), method, date: new Date(`${date}T12:00`).toISOString(), ref: ref.trim() })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar pago"
      subtitle={`${c.name} · ${deal?.product}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="success" type="submit" form="pay-form" disabled={value <= 0}>
            <Banknote size={16} /> {full ? 'Registrar pago completo' : 'Registrar abono parcial'}
          </Button>
        </>
      }
    >
      <form id="pay-form" onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-600 ring-1 ring-slate-200"><ReceiptText size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">{p.label}</p>
            <p className="text-xs text-slate-500">{dueText(p)} · {fmtDate(p.dueAt)}</p>
          </div>
          <p className="whitespace-nowrap text-lg font-bold tabular-nums text-slate-900">{fmtMoney(p.amount, p.currency)}</p>
        </div>

        <Field label="Monto recibido">
          <div className="flex">
            <select
              className="h-11 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-2 text-sm font-medium text-slate-700"
              value={cur}
              aria-label="Moneda"
              onChange={(e) => {
                const n = e.target.value
                setAmount(String(round2(convert(value, cur, n, data.rates))))
                setCur(n)
              }}
            >
              {curOpts.map((k) => <option key={k} value={k}>{CURRENCIES[k].symbol}</option>)}
            </select>
            <input className={cx(inputCls, 'rounded-l-none tabular-nums')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </Field>
        <div className="-mt-2 flex flex-wrap items-center gap-2 text-xs">
          <button type="button" className="rounded-full px-2.5 py-1 font-medium text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50" onClick={() => setIn(p.amount)}>Total</button>
          <button type="button" className="rounded-full px-2.5 py-1 font-medium text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50" onClick={() => setIn(p.amount / 2)}>50%</button>
          {cur !== p.currency && <span className="text-slate-500">Equivale a <b className="font-semibold text-slate-700">{fmtMoney(inDealCur, p.currency)}</b> (TC del día)</span>}
          {!full && value > 0 && <span className="text-amber-700">Quedará un saldo de {fmtMoney(p.amount - inDealCur, p.currency)}</span>}
        </div>

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-slate-700">Medio de pago <Flag code={c.country} className="h-2.5 w-[15px]" /></span>
          <div className="flex flex-wrap gap-2">
            {methods.map((m) => (
              <button type="button" key={m} onClick={() => setMethod(m)} className={cx('h-9 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset', method === m ? 'bg-emerald-50 text-emerald-700 ring-emerald-300' : 'text-slate-600 ring-slate-200')}>{m}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha del pago"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="N.º de operación"><input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Opcional" /></Field>
        </div>
      </form>
    </Modal>
  )
}

/* ================= Plan de cobro ================= */
const KINDS = [
  ['contado', 'Al contado', 'Un solo pago'],
  ['mitad', '50% + 50%', 'Adelanto y saldo contra entrega'],
  ['cuotas', 'Financiado', 'Inicial + cuotas mensuales'],
]

export function PlanModal({ onClose, dealId }) {
  const { data, contactById, createPlan } = useApp()
  const deal = data.deals.find((x) => x.id === dealId)
  const c = deal && contactById[deal.contactId]
  const methods = PAY_METHODS[c?.country] || PAY_METHODS.PE
  const [kind, setKind] = useState('mitad')
  const [days, setDays] = useState(7)
  const [initialPct, setInitialPct] = useState(30)
  const [n, setN] = useState(6)
  const [firstPaid, setFirstPaid] = useState(false)
  const [method, setMethod] = useState(methods[0])
  if (!deal) return null
  const items = buildPlan(deal.amount, kind, { days, initialPct, n })
  const canMarkFirst = items[0]?.dueDays === 0

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="¿Cómo te va a pagar?"
      subtitle={`${c.name} · ${deal.product} · ${fmtMoney(deal.amount, deal.currency)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Ahora no</Button>
          <Button variant="primary" onClick={() => { createPlan(deal.id, items, canMarkFirst && firstPaid ? method : null); onClose() }}>
            <CalendarClock size={16} /> Crear plan y avisarme
          </Button>
        </>
      }
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {KINDS.map(([k, t, s]) => (
          <button key={k} onClick={() => setKind(k)} className={cx('rounded-xl p-3 text-left ring-inset transition', kind === k ? 'bg-indigo-50 ring-2 ring-indigo-400' : 'ring-1 ring-slate-200 hover:bg-slate-50')}>
            <p className="font-semibold text-slate-900">{t}</p>
            <p className="text-xs text-slate-500">{s}</p>
          </button>
        ))}
      </div>

      {kind !== 'mitad' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {kind === 'contado' && (
            <Field label="Plazo para pagar">
              <select className={inputCls} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[0, 7, 15, 30].map((d) => <option key={d} value={d}>{d === 0 ? 'Hoy' : `${d} días`}</option>)}
              </select>
            </Field>
          )}
          {kind === 'cuotas' && (
            <>
              <label className="block">
                <span className="flex justify-between text-[13px] font-medium text-slate-700"><span>Inicial</span><b className="tabular-nums">{initialPct}%</b></span>
                <input type="range" min={0} max={60} step={5} value={initialPct} onChange={(e) => setInitialPct(Number(e.target.value))} className="range mt-3 w-full" style={{ '--p': `${(initialPct / 60) * 100}%` }} />
              </label>
              <Field label="Cuotas mensuales">
                <select className={inputCls} value={n} onChange={(e) => setN(Number(e.target.value))}>
                  {[3, 6, 9, 12].map((x) => <option key={x} value={x}>{x} cuotas</option>)}
                </select>
              </Field>
            </>
          )}
        </div>
      )}

      <ul className="mt-4 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-slate-200">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <span className={cx('h-2 w-2 shrink-0 rounded-full', canMarkFirst && firstPaid && i === 0 ? 'bg-emerald-500' : 'bg-indigo-400')} />
            <span className="flex-1 text-slate-700">{it.label}</span>
            <span className="text-xs text-slate-500">{it.dueDays === 0 ? 'Hoy' : fmtDate(at(it.dueDays))}</span>
            <span className="w-28 text-right font-semibold tabular-nums text-slate-900">{fmtMoney(it.amount, deal.currency)}</span>
          </li>
        ))}
      </ul>

      {canMarkFirst && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={firstPaid} onChange={(e) => setFirstPaid(e.target.checked)} />
            Ya recibí el {kind === 'contado' ? 'pago' : 'primer pago'}
          </label>
          {firstPaid && (
            <div className="mt-2 flex flex-wrap gap-2">
              {methods.map((m) => (
                <button key={m} onClick={() => setMethod(m)} className={cx('h-8 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset', method === m ? 'bg-emerald-50 text-emerald-700 ring-emerald-300' : 'bg-white text-slate-600 ring-slate-200')}>{m}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Vendex te avisará en “Hoy” y en la campana dos días antes de cada vencimiento y cuando un pago se atrase.</p>
    </Modal>
  )
}

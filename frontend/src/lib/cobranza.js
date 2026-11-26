import { diffDays } from './dates'

/** Estado de una cuota según su fecha de vencimiento */
export function payStatus(p) {
  if (p.paidAt) return 'pagado'
  const d = diffDays(p.dueAt)
  if (d < 0) return 'vencido'
  if (d === 0) return 'hoy'
  if (d <= 7) return 'semana'
  return 'proximo'
}

export const PAY_UI = {
  vencido: { label: 'Vencido', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
  hoy: { label: 'Vence hoy', cls: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  semana: { label: 'Esta semana', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' },
  proximo: { label: 'Próximo', cls: 'bg-slate-50 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
  pagado: { label: 'Pagado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
}

export function dueText(p) {
  if (p.paidAt) return 'Pagado'
  const d = diffDays(p.dueAt)
  if (d < 0) return `${-d} día${d === -1 ? '' : 's'} de atraso`
  if (d === 0) return 'Vence hoy'
  if (d === 1) return 'Vence mañana'
  return `Vence en ${d} días`
}

/** Tramos de antigüedad para la deuda vencida */
export const AGING = [
  { id: 'a1', label: '1 a 15 días', test: (d) => d >= 1 && d <= 15, cls: 'bg-amber-400' },
  { id: 'a2', label: '16 a 30 días', test: (d) => d >= 16 && d <= 30, cls: 'bg-orange-500' },
  { id: 'a3', label: 'Más de 30 días', test: (d) => d > 30, cls: 'bg-rose-600' },
]

/** Divide un total en cuotas; la última absorbe el redondeo */
export function buildPlan(total, kind, { days = 7, initialPct = 30, n = 6 } = {}) {
  const r = (x) => Math.round(x * 100) / 100
  if (kind === 'contado') return [{ n: 1, of: 1, label: 'Pago al contado', amount: total, dueDays: days }]
  if (kind === 'mitad') {
    const a = r(total / 2)
    return [
      { n: 1, of: 2, label: 'Adelanto 50%', amount: a, dueDays: 0 },
      { n: 2, of: 2, label: 'Saldo contra entrega', amount: r(total - a), dueDays: 30 },
    ]
  }
  const ini = r((total * initialPct) / 100)
  const each = r((total - ini) / n)
  const out = ini > 0 ? [{ n: 0, of: n, label: `Inicial ${initialPct}%`, amount: ini, dueDays: 0 }] : []
  for (let i = 1; i <= n; i++) {
    out.push({ n: i, of: n, label: `Cuota ${i} de ${n}`, amount: i === n ? r(total - ini - each * (n - 1)) : each, dueDays: 30 * i })
  }
  return out
}

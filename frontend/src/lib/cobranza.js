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

const r2 = (x) => Math.round(x * 100) / 100

/** Fecha local YYYY-MM-DD (hoy + n días) */
export const ymd = (n = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA')
}

/** YYYY-MM-DD + k meses conservando el día (31 ene + 1 → 28/29 feb) */
export function addMonths(date, k) {
  const [y, m, d] = date.split('-').map(Number)
  const last = new Date(y, m - 1 + k + 1, 0).getDate()
  return new Date(y, m - 1 + k, Math.min(d, last)).toLocaleDateString('en-CA')
}

/** YYYY-MM-DD → ISO a las 9:00 hora local (para enviar a la API) */
export const dueIso = (date) => new Date(`${date}T09:00`).toISOString()

/**
 * Propone un plan; cada pago lleva su fecha exacta (`date`, YYYY-MM-DD) y luego se puede editar.
 * La última cuota absorbe el redondeo. `firstDate` = fecha de la 1.ª cuota mensual.
 */
export function buildPlan(total, kind, { days = 7, initialPct = 30, n = 6, firstDate } = {}) {
  if (kind === 'contado') return [{ n: 1, of: 1, label: 'Pago al contado', amount: total, date: ymd(days) }]
  if (kind === 'mitad') {
    const a = r2(total / 2)
    return [
      { n: 1, of: 2, label: 'Adelanto 50%', amount: a, date: ymd(0) },
      { n: 2, of: 2, label: 'Saldo contra entrega', amount: r2(total - a), date: ymd(30) },
    ]
  }
  if (kind === 'personalizado') {
    const a = r2(total / 2)
    return [
      { n: 1, of: 2, label: 'Pago 1 de 2', amount: a, date: ymd(0) },
      { n: 2, of: 2, label: 'Pago 2 de 2', amount: r2(total - a), date: addMonths(ymd(0), 1) },
    ]
  }
  const first = firstDate || addMonths(ymd(0), 1)
  const ini = r2((total * initialPct) / 100)
  const each = r2((total - ini) / n)
  const out = ini > 0 ? [{ n: 0, of: n, label: `Inicial ${initialPct}%`, amount: ini, date: ymd(0) }] : []
  for (let i = 1; i <= n; i++) {
    out.push({ n: i, of: n, label: `Cuota ${i} de ${n}`, amount: i === n ? r2(total - ini - each * (n - 1)) : each, date: addMonths(first, i - 1) })
  }
  return out
}

const AUTO_LABEL = /^(Cuota|Pago) \d+ de \d+$/

/**
 * Deja el plan listo para guardar: ordena por fecha, numera (la inicial queda n = 0)
 * y renumera las etiquetas automáticas ("Cuota 2 de 5") si se agregaron o quitaron pagos.
 */
export function finalizePlan(items) {
  const rows = [...items].sort((a, b) => a.date.localeCompare(b.date))
  const of = rows.filter((x) => x.n !== 0).length || rows.length
  let k = 0
  return rows.map((x) => {
    if (x.n === 0 && of !== rows.length) return { ...x, of }
    k += 1
    const word = x.label.startsWith('Pago') ? 'Pago' : 'Cuota'
    return { ...x, n: k, of, label: AUTO_LABEL.test(x.label.trim()) ? `${word} ${k} de ${of}` : x.label.trim() }
  })
}

/** Problemas que impiden guardar el plan (vacío = ok) */
export function planProblems(items, total) {
  const out = []
  if (!items.length) out.push('Agrega al menos un pago')
  if (items.some((x) => !x.date)) out.push('Todos los pagos necesitan fecha')
  if (items.some((x) => !(Number(x.amount) > 0))) out.push('Todos los montos deben ser mayores a 0')
  if (items.some((x) => !x.label.trim())) out.push('Todos los pagos necesitan un nombre')
  const diff = r2(total - items.reduce((s, x) => s + (Number(x.amount) || 0), 0))
  if (Math.abs(diff) >= 0.01) out.push(diff > 0 ? 'Faltan montos para llegar al total' : 'Los pagos suman más que el total')
  return out
}

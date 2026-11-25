const DAY = 86400000

export const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** ISO de hoy + n días a la hora indicada */
export const at = (n = 0, h = 9, m = 0) => {
  const d = startOfDay(new Date())
  d.setDate(d.getDate() + n)
  d.setHours(h, m)
  return d.toISOString()
}

export const diffDays = (iso) => Math.round((startOfDay(iso) - startOfDay(new Date())) / DAY)

export const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })

export function rel(iso) {
  const d = diffDays(iso)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  if (d === -1) return 'Ayer'
  if (d < 0 && d > -15) return `Hace ${-d} días`
  if (d > 0 && d < 7) return `En ${d} días`
  return fmtDate(iso)
}

export const todayLong = () =>
  new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })

export const startOfMonth = () => {
  const d = startOfDay(new Date())
  d.setDate(1)
  return d
}

/** Días transcurridos del mes (para que los cierres "de este mes" siempre caigan en el mes actual) */
export const monthOffset = (n) => -Math.min(n, new Date().getDate() - 1)

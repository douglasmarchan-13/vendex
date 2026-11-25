// Monedas manejadas por Vendex. Las tasas son "unidades por 1 USD" y son editables en la app.
export const CURRENCIES = {
  USD: { code: 'USD', symbol: 'US$', name: 'Dólar americano', locale: 'en-US' },
  PEN: { code: 'PEN', symbol: 'S/', name: 'Sol peruano', locale: 'es-PE' },
  BOB: { code: 'BOB', symbol: 'Bs', name: 'Boliviano', locale: 'es-BO' },
  VES: { code: 'VES', symbol: 'Bs.', name: 'Bolívar digital', locale: 'es-VE' },
}

export const DEFAULT_RATES = { USD: 1, PEN: 3.72, BOB: 6.96, VES: 245 }

export const toUSD = (amount, cur, rates) => amount / (rates[cur] || 1)
export const convert = (amount, from, to, rates) => toUSD(amount, from, rates) * (rates[to] || 1)

function num(n, locale, digits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n)
}

export function fmtMoney(amount, cur, { compact = false } = {}) {
  const c = CURRENCIES[cur] || CURRENCIES.USD
  const a = Math.abs(amount)
  let body
  if (compact && a >= 1e6) body = `${num(amount / 1e6, c.locale, 1)} M`
  else if (compact && a >= 1e4) body = `${num(amount / 1e3, c.locale, 0)} k`
  else body = num(amount, c.locale, a < 100 ? 2 : 0)
  return `${c.symbol} ${body}`
}

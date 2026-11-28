/**
 * Fuentes oficiales del tipo de cambio (unidades de moneda local por 1 USD), una por país:
 *  · VES — Banco Central de Venezuela (BCV): tasa oficial publicada en su portada.
 *  · PEN — Banco Central de Reserva del Perú (BCRP): API de series estadísticas,
 *          "TC Sistema bancario SBS – Venta" (serie PD04640PD), el que usa SUNAT.
 *  · BOB — Banco Central de Bolivia (BCB): "Tipo de cambio oficial" de su portada.
 *
 * Los parsers son funciones puras (texto → resultado) para poder probarlas sin red.
 * Si un banco cambia el formato de su página, el parser lanza un error y esa moneda
 * conserva el último valor guardado.
 */
import { SECTIGO_OV_R36 } from './certs.js'

export interface OfficialRate {
  code: string
  /** Unidades de la moneda por 1 USD */
  rate: number
  /** Fecha valor publicada por el banco (YYYY-MM-DD) */
  date: string
  /** Nombre corto de la fuente (BCV, BCRP, BCB) */
  source: string
  url: string
}

export interface RateSource {
  code: string
  source: string
  name: string
  url: (today: Date) => string
  /** Certificados intermedios extra (el sitio no envía la cadena completa) */
  extraCa?: string[]
  /** Rango razonable: un valor fuera de él indica que se leyó mal la página */
  range: [number, number]
  parse: (body: string) => { rate: number; date: string }
}

/** "928,54540000" / "1.234,56" / "11,90" → número */
export function parseLocaleNumber(s: string): number {
  const clean = s.replace(/\s|&nbsp;/g, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(clean)) return NaN
  return Number(clean.replace(/\./g, '').replace(',', '.'))
}

/** BCV: <div id="dolar"> … <strong> 928,54540000 </strong> … y "Fecha Valor: <span content="2026-11-30T…">" */
export function parseBcv(html: string): { rate: number; date: string } {
  const block = html.match(/id=["']dolar["'][\s\S]*?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i)
  if (!block) throw new Error('no se encontró el bloque del dólar')
  const rate = parseLocaleNumber(block[1]!)
  const date = html.match(/Fecha\s+Valor:[\s\S]{0,200}?content=["'](\d{4}-\d{2}-\d{2})/i)?.[1]
  if (!date) throw new Error('no se encontró la fecha valor')
  return { rate, date }
}

/** BCB: tarjeta "is-tc-oficial" con <time datetime="2026-11-28"> y <span class="bcb-tco-num">11,90</span> */
export function parseBcb(html: string): { rate: number; date: string } {
  const start = html.search(/class=["'][^"']*\bis-tc-oficial\b/i)
  if (start < 0) throw new Error('no se encontró la tarjeta del tipo de cambio oficial')
  const card = html.slice(start, start + 4000)
  const num = card.match(/class=["']bcb-tco-num["'][^>]*>\s*([\d.,]+)\s*</i)?.[1]
  if (!num) throw new Error('no se encontró el valor del tipo de cambio oficial')
  const date = card.match(/<time[^>]*datetime=["'](\d{4}-\d{2}-\d{2})/i)?.[1]
  if (!date) throw new Error('no se encontró la fecha de vigencia')
  return { rate: parseLocaleNumber(num), date }
}

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12,
}

/** BCRP: { periods: [{ name: "26.Nov.26", values: ["3.484"] }, …, { values: ["n.d."] }] } → último día con dato */
export function parseBcrp(json: string): { rate: number; date: string } {
  let data: { periods?: { name?: string; values?: unknown[] }[] }
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('la respuesta no es JSON')
  }
  const periods = data.periods ?? []
  for (let i = periods.length - 1; i >= 0; i--) {
    const p = periods[i]!
    const rate = Number(p.values?.[0])
    const m = p.name?.match(/^(\d{1,2})\.([A-Za-z]{3})\.(\d{2})$/)
    if (!Number.isFinite(rate) || rate <= 0 || !m) continue
    const month = MONTHS[m[2]!.toLowerCase()]
    if (!month) continue
    const date = `20${m[3]}-${String(month).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
    return { rate, date }
  }
  throw new Error('no hay datos en el período consultado')
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export const SOURCES: RateSource[] = [
  {
    code: 'VES',
    source: 'BCV',
    name: 'Banco Central de Venezuela',
    url: () => 'https://www.bcv.org.ve/',
    extraCa: [SECTIGO_OV_R36],
    range: [1, 1e7],
    parse: parseBcv,
  },
  {
    code: 'PEN',
    source: 'BCRP',
    name: 'Banco Central de Reserva del Perú',
    // Últimas 3 semanas: los fines de semana y feriados no hay dato ("n.d.")
    url: (today) => {
      const from = new Date(today.getTime() - 21 * 86_400_000)
      return `https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04640PD/json/${isoDay(from)}/${isoDay(today)}`
    },
    range: [1, 20],
    parse: parseBcrp,
  },
  {
    code: 'BOB',
    source: 'BCB',
    name: 'Banco Central de Bolivia',
    url: () => 'https://www.bcb.gob.bo/',
    range: [1, 1000],
    parse: parseBcb,
  },
]

/** Aplica el parser de la fuente y valida que el valor sea razonable */
export function readSource(src: RateSource, body: string, url: string): OfficialRate {
  const { rate, date } = src.parse(body)
  if (!Number.isFinite(rate) || rate < src.range[0] || rate > src.range[1]) {
    throw new Error(`valor fuera de rango (${rate})`)
  }
  return { code: src.code, rate, date, source: src.source, url }
}

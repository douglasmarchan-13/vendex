// Normalización de celdas del Excel de clientes que usan hoy los vendedores.
// Funciones puras (sin base de datos), probadas en test/unit/imports.normalize.spec.ts.

export type CountryCode = 'PE' | 'BO'
export type StageId = 'nuevo' | 'contactado' | 'cotizacion' | 'negociacion' | 'pausa'

/** Mayúsculas, sin tildes y con espacios simples: para comparar textos escritos a mano */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Texto limpio de una celda: sin saltos de línea dobles ni espacios sobrantes */
export function clean(s: string): string {
  return s
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join(' / ')
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  ENE: 1, ENERO: 1, FEB: 2, FEBRERO: 2, MAR: 3, MARZO: 3, ABR: 4, ABRIL: 4, MAY: 5, MAYO: 5,
  JUN: 6, JUNIO: 6, JUL: 7, JULIO: 7, AGO: 8, AGOSTO: 8, SET: 9, SEP: 9, SEPT: 9, SETIEMBRE: 9, SEPTIEMBRE: 9,
  OCT: 10, OCTUBRE: 10, NOV: 11, NOVIEMBRE: 11, DIC: 12, DICIEMBRE: 12,
}

const pad = (n: number) => String(n).padStart(2, '0')

function ymd(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

export interface DateResult {
  /** YYYY-MM-DD, o null si la celda no trae una fecha usable */
  date: string | null
  /** Motivo por el que se descartó o ajustó la fecha */
  warning?: string
}

/**
 * Fecha de la columna FECHA. Acepta fechas reales de Excel y textos como "27 Enero de 2026",
 * "26 de febrero de 2026", "06/06/2024" o "06-mar." (sin año: se asume `currentYear`).
 * Las fechas anteriores a 2000 (celdas en 0 que Excel muestra como 00/01/1900) y las futuras se descartan.
 */
export function parseDateCell(value: unknown, today: string, currentYear: number): DateResult {
  if (value == null || value === '') return { date: null }
  let date: string | null = null
  let warning: string | undefined
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { date: null, warning: 'Fecha inválida' }
    date = value.toISOString().slice(0, 10)
  } else if (typeof value === 'number') {
    return { date: null, warning: `"${value}" no es una fecha` }
  } else {
    const r = parseDateText(String(value), currentYear)
    if (!r) return { date: null, warning: `No se entiende la fecha "${clean(String(value))}"` }
    date = r.date
    if (r.yearAssumed) warning = `Fecha sin año: se usó ${currentYear}`
  }
  if (date < '2000-01-01') return { date: null, warning: 'Fecha vacía o inválida en el Excel (00/01/1900)' }
  if (date > today) return { date: null, warning: `Fecha futura (${date}): se usará la fecha de importación` }
  return { date, warning }
}

/** Busca una fecha completa dentro de un texto libre */
export function parseDateText(raw: string, currentYear: number): { date: string; yearAssumed: boolean } | null {
  const s = fold(raw)
  // 27 ENERO DE 2026 · 26 DE FEBRERO DE 2026 · 06-MAR. · 6 MAR 2025
  let m = s.match(/\b(\d{1,2})[\s\-/.]*(?:DE\s+)?([A-Z]{3,10})\.?(?:[\s\-/.]*(?:DE(?:L)?\s+)?(\d{2,4}))?\b/)
  if (m && MONTHS[m[2]] !== undefined) {
    const year = m[3] ? Number(m[3]) : currentYear
    const date = ymd(year, MONTHS[m[2]], Number(m[1]))
    if (date) return { date, yearAssumed: !m[3] }
  }
  // 06/06/2024 · 06-06-24 · 2024-06-06
  m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (m) {
    const date = ymd(Number(m[1]), Number(m[2]), Number(m[3]))
    if (date) return { date, yearAssumed: false }
  }
  m = s.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (m) {
    const date = ymd(m[3] ? Number(m[3]) : currentYear, Number(m[2]), Number(m[1]))
    if (date) return { date, yearAssumed: !m[3] }
  }
  return null
}

/**
 * Fecha mencionada en una nota de seguimiento ("SE LLAMO 02-04-2025", "LLAMAR EL LUNES 19-05").
 * Solo formatos numéricos dd-mm o dd-mm-aaaa: "15 DE JULIO" en una nota suele ser un plan, no la fecha de la nota.
 * Sin año, se toma el año de `refDate` (la fecha de la fila).
 */
export function dateInNote(text: string, refDate: string | null, currentYear: number): string | null {
  const m = text.match(/(?<![\d/-])(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?![\d/-])/)
  if (!m) return null
  const year = m[3] ? Number(m[3]) : refDate ? Number(refDate.slice(0, 4)) : currentYear
  return ymd(year, Number(m[2]), Number(m[1]))
}

// ---------------------------------------------------------------------------
// Teléfonos
// ---------------------------------------------------------------------------

export interface PhoneResult {
  /** Teléfonos con prefijo internacional, el primero es el principal */
  phones: string[]
  /** País que indica el prefijo, si lo trae */
  country?: CountryCode
  warning?: string
}

function formatPhone(digits: string, country: CountryCode): { phone: string; country: CountryCode } | null {
  let d = digits
  let c = country
  if (d.startsWith('591') && d.length === 11) { c = 'BO'; d = d.slice(3) }
  else if (d.startsWith('51') && d.length === 11) { c = 'PE'; d = d.slice(2) }
  if (c === 'PE' && d.length === 9) return { phone: `+51 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`, country: c }
  if (c === 'BO' && d.length === 8) return { phone: `+591 ${d}`, country: c }
  // Fijos de Perú (7-8 dígitos) u otros formatos: se guardan tal cual, con el prefijo del país
  if (d.length >= 6 && d.length <= 12) return { phone: `${c === 'BO' ? '+591' : '+51'} ${d}`, country: c }
  return null
}

/** "935 036 148", "+591 67210469", "59176054535", "926282207⏎953647105" */
export function parsePhones(value: unknown, sheetCountry: CountryCode): PhoneResult {
  if (value == null || value === '') return { phones: [] }
  const raw = String(value)
  // Varios números en la celda: separados por salto de línea, "/", "," o ";"
  const parts = raw.split(/[\n/,;]|\s{2,}|\bY\b/i).map((p) => p.replace(/\D/g, '')).filter(Boolean)
  // Un número con espacios ("935 036 148") quedó en una sola parte; si se partió de más, se reintenta junto
  const chunks = parts.every((p) => p.length >= 6) ? parts : [raw.replace(/\D/g, '')]
  const phones: string[] = []
  let country: CountryCode | undefined
  let invalid = false
  for (const ch of chunks) {
    const f = formatPhone(ch, sheetCountry)
    if (!f) { invalid = true; continue }
    if (!phones.includes(f.phone)) phones.push(f.phone)
    country ??= f.country !== sheetCountry ? f.country : undefined
  }
  return { phones, country, warning: invalid ? `Teléfono no reconocido: "${clean(raw)}"` : undefined }
}

/** Solo dígitos (sin prefijo de país), para detectar duplicados */
export function phoneKey(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('591') && d.length === 11) return d.slice(3)
  if (d.startsWith('51') && d.length === 11) return d.slice(2)
  return d
}

// ---------------------------------------------------------------------------
// Montos
// ---------------------------------------------------------------------------

export interface AmountResult {
  amount: number | null
  currency: string
  warning?: string
}

/**
 * MONTO: número de Excel o texto con formatos mezclados:
 * "US$ 60,036.00" → 60036 · "USD 160.000,00" → 160000 · "US$ 151.350.00" → 151350 · "S/ 2,300" → 2300 PEN
 * El separador decimal es el último "." o "," seguido de exactamente 1-2 dígitos al final.
 */
export function parseAmount(value: unknown, defaultCurrency = 'USD'): AmountResult {
  if (value == null || value === '') return { amount: null, currency: defaultCurrency }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? { amount: round2(value), currency: defaultCurrency } : { amount: null, currency: defaultCurrency, warning: `Monto inválido: ${value}` }
  }
  const raw = String(value)
  const f = fold(raw)
  const currency = /\bS\/|\bPEN\b|\bSOLES?\b/.test(f) ? 'PEN' : /\bBS\b|\bBOB\b|\bBOLIVIANOS?\b/.test(f) ? 'BOB' : /US\$|USD|\$|DOLAR/.test(f) ? 'USD' : defaultCurrency
  const num = f.replace(/[^\d.,]/g, '')
  if (!/\d/.test(num)) return { amount: null, currency, warning: `Monto no reconocido: "${clean(raw)}"` }
  const m = num.match(/^(.*)[.,](\d{1,2})$/)
  const intPart = (m ? m[1] : num).replace(/[.,]/g, '')
  const amount = Number(`${intPart || '0'}.${m ? m[2] : '0'}`)
  if (!Number.isFinite(amount)) return { amount: null, currency, warning: `Monto no reconocido: "${clean(raw)}"` }
  return { amount: round2(amount), currency }
}

const round2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// Origen (columna CONTACTO)
// ---------------------------------------------------------------------------

export interface SourceResult {
  /** Canal de Vendex (tabla channels), o null si llegó solo */
  channel: string | null
  /** Nombre de la persona que lo refirió, cuando la columna trae un nombre y no un canal */
  referredBy?: string
  /** Nota para el historial cuando el origen no es un canal ni una persona ("Llegó por la tienda") */
  note?: string
  /** El valor tal como venía en el Excel */
  raw: string
}

const CHANNELS: [RegExp, string][] = [
  [/^FACEBOOK|^FB$/, 'Facebook'],
  [/^TIK ?TOK/, 'TikTok'],
  [/^WHATSAPP|^WSP|^WTP/, 'WhatsApp'],
  [/^VISITA/, 'Visita de campo'],
  [/^FERIA/, 'Feria agrícola'],
  [/^LLAMADA/, 'Llamada entrante'],
  [/^RECOMEND|^REFERID|^AMIGO/, 'Referido'],
]

/** El texto es el nombre de un canal conocido (sirve para detectar columnas cruzadas) */
export function isChannelName(value: string): boolean {
  const f = fold(value)
  return !!f && CHANNELS.some(([re]) => re.test(f))
}

/**
 * "SOLO" = el cliente llegó solo, sin canal. Un canal conocido se mapea a la tabla channels.
 * Cualquier otro valor es una persona (DANY, WERNER, SR DEMETRIO…): se trata como referido.
 * El usuario puede corregir cada valor en la vista previa.
 */
export function parseSource(value: unknown): SourceResult {
  const raw = clean(value == null ? '' : String(value))
  const f = fold(raw)
  if (!f || f === 'SOLO') return { channel: null, raw }
  if (/^TIENDA/.test(f)) return { channel: null, note: 'Llegó por la tienda', raw }
  for (const [re, channel] of CHANNELS) {
    if (re.test(f)) return { channel, raw, referredBy: channel === 'Referido' && /^AMIGO/.test(f) ? raw : undefined }
  }
  return { channel: 'Referido', referredBy: raw, raw }
}

// ---------------------------------------------------------------------------
// Notas de seguimiento (STATUS 1, STATUS 2 y columnas sin nombre)
// ---------------------------------------------------------------------------

/** Nombre del archivo de un enlace local (file:///C:\...\COT MOLINO 2T.pdf → "COT MOLINO 2T.pdf") */
export function fileNameFromLink(link: string): string | null {
  if (!/^file:/i.test(link)) return null
  try {
    const name = decodeURIComponent(link).split(/[\\/]/).pop()
    return name || null
  } catch {
    return link.split(/[\\/]/).pop() || null
  }
}

/** Una nota tiene contenido si trae al menos 3 letras (descarta "}", "+", "7" sueltos en el Excel) */
export function isMeaningfulNote(text: string): boolean {
  return (text.match(/\p{L}/gu) ?? []).length >= 3
}

// ---------------------------------------------------------------------------
// Etapa del trato y próxima acción
// ---------------------------------------------------------------------------

const RE_BOUGHT = /\b(SI |YA )?COMPR(O|ARON)\b/
const RE_LOST = /POR AHORA NO|NO (ESTA|ESTAN) INTERESAD|NO CUENTA CON (EL |LA )?(CAPITAL|PRESUPUESTO|LIQUIDE[SZ])|LE GANARON|SE DESANIMO|NO LE INTERESA|PRECIO (DE LA MAQUINA )?MUY ELEVADO/
const RE_NEGOTIATION = /NEGOCIA|ABONA|CREDITO|BANCO|FINANCIA|AFINANDO DETALLES|VIENEN POR LA MAQUINA/
const RE_QUOTE_SENT = /(SE (LE )?(ENVIO|PASO)|LE ENVIE|ACTUALIZAR|REVISAR LA|ANALIZANDO LA) (LA )?(COTIZACION|PROFORMA)|COTIZACION ENVIADA|W\.?PASO PROFORMA/
const RE_QUOTE_NOT_SENT = /NO SE (LE )?ENVIO (LA )?COTIZACION/
const RE_CONTACTED = /INTERES|LLAM[OE]|CONVERS|VISIT|NO CONTESTA|CONTESA|APAGADO|ESPERA|INFORMACION|BROCHURE|ENVIAR|DESEA|QUIERE|SOLICIT/

const RANK: Record<Exclude<StageId, 'pausa'>, number> = { nuevo: 0, contactado: 1, cotizacion: 2, negociacion: 3 }

export interface StageResult {
  stage: StageId
  /** Una nota dice que compró: puede ser una venta nuestra o de la competencia, lo decide el usuario */
  mentionsPurchase: boolean
}

/**
 * Etapa del trato a partir de las notas, en orden cronológico.
 * La etapa avanza con la nota más avanzada; si la última nota es negativa ("POR AHORA NO"), queda en pausa.
 */
export function inferStage(notes: string[]): StageResult {
  let best: Exclude<StageId, 'pausa'> = 'nuevo'
  let mentionsPurchase = false
  const folded = notes.map(fold).filter(Boolean)
  for (const f of folded) {
    if (RE_BOUGHT.test(f)) mentionsPurchase = true
    let s: Exclude<StageId, 'pausa'> = 'nuevo'
    if (RE_NEGOTIATION.test(f)) s = 'negociacion'
    else if (RE_QUOTE_SENT.test(f) && !RE_QUOTE_NOT_SENT.test(f)) s = 'cotizacion'
    else if (RE_CONTACTED.test(f) || isMeaningfulNote(f)) s = 'contactado'
    // "LLAMAR" / "POR LLAMAR" solos: todavía no hubo contacto
    if (/^(POR )?LLAMAR\.?$/.test(f)) s = 'nuevo'
    if (RANK[s] > RANK[best]) best = s
  }
  const last = folded.at(-1)
  if (last && (RE_LOST.test(last) || RE_BOUGHT.test(last))) return { stage: 'pausa', mentionsPurchase }
  return { stage: best, mentionsPurchase }
}

/**
 * Próxima acción del trato: la última nota, si pide hacer algo ("LLAMAR EL LUNES 19-05", "VISITAR UN VIERNES").
 * La fecha solo se usa si es futura respecto de `today`.
 */
export function nextAction(notes: string[], refDate: string | null, today: string, currentYear: number): { text: string; at: string | null } | null {
  const last = notes.at(-1)
  if (!last) return null
  const f = fold(last)
  if (!/\b(LLAMAR|VISITAR|VOLVER A CONTACTAR|CONTACTAR|ENVIAR|ACTUALIZAR|INSISTIR)\b|NOS VISITA/.test(f)) return null
  const at = dateInNote(last, refDate, currentYear)
  return { text: last, at: at && at >= today ? at : null }
}

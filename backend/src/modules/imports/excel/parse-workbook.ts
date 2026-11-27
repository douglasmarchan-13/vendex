// Lee el libro de Excel de clientes (hojas "BASE DE DATOS CLIENTES", "BOLIVIA", "CLIENTES POTENCIALES" u otras
// con el mismo formato) y devuelve una fila normalizada por cada fila con datos.
// Las columnas se encuentran por el nombre del encabezado, no por su posición.

import type ExcelJS from 'exceljs'
import {
  clean,
  type CountryCode,
  fileNameFromLink,
  fold,
  isChannelName,
  isMeaningfulNote,
  parseAmount,
  parseDateCell,
  parsePhones,
  parseSource,
  type SourceResult,
} from './normalize.js'

export type Field =
  | 'date' | 'phone' | 'name' | 'company' | 'doc' | 'product' | 'amount' | 'source' | 'place' | 'location' | 'status1' | 'status2' | 'email'

/** Nombres de encabezado aceptados por campo (comparados con fold()) */
const HEADERS: Record<Field, string[]> = {
  date: ['FECHA'],
  phone: ['TELEFONO', 'TELEFONOS', 'CELULAR', 'CEL', 'TEL'],
  name: ['CONTACTO/CLIENTE', 'CLIENTE', 'NOMBRE', 'CONTACTO / CLIENTE', 'NOMBRES'],
  company: ['EMPRESA', 'RAZON SOCIAL'],
  doc: ['RUC/DNI', 'RUC / DNI', 'RUC', 'DNI', 'CEDULA', 'CI', 'NIT', 'NIT/CI', 'DOCUMENTO'],
  product: ['PRODUCTO', 'PRODUCTOS', 'EQUIPO', 'MAQUINA'],
  amount: ['MONTO', 'PRECIO', 'IMPORTE'],
  source: ['CONTACTO', 'CANAL', 'ORIGEN', 'FUENTE'],
  place: ['LUGAR', 'CIUDAD', 'DISTRITO'],
  location: ['UBICACION', 'REGION', 'DEPARTAMENTO', 'PROVINCIA'],
  status1: ['STATUS 1', 'STATUS1', 'ESTADO 1', 'ESTADO', 'STATUS'],
  status2: ['STATUS 2', 'STATUS2', 'ESTADO 2'],
  email: ['CORREO', 'EMAIL', 'E-MAIL'],
}

export interface RowIssue {
  level: 'warning' | 'error'
  field?: Field
  message: string
}

export interface NoteRef {
  text: string
  /** Columna de origen (STATUS 1, STATUS 2, L, M…) */
  column: string
}

export interface ParsedRow {
  sheet: string
  /** Número de fila en Excel (1 = primera fila) */
  row: number
  country: CountryCode
  date: string | null
  name: string
  company: string
  phones: string[]
  doc: string
  email: string
  product: string
  amount: number | null
  currency: string
  source: SourceResult
  city: string
  region: string
  notes: NoteRef[]
  issues: RowIssue[]
  /** Sin nombre, empresa ni teléfono usables: la fila no se puede importar como contacto */
  incomplete: boolean
}

export interface SheetSummary {
  name: string
  country: CountryCode
  headerRow: number | null
  columns: Partial<Record<Field, string>>
  extraColumns: string[]
  rows: number
  skipped: { row: number; reason: string }[]
}

export interface ParseOptions {
  /** Hoy en la zona horaria del negocio, YYYY-MM-DD */
  today: string
  /** Año que se asume en fechas sin año ("06-mar.") */
  currentYear: number
  /** Hojas a leer (por nombre); todas si se omite */
  sheets?: string[]
}

export interface ParsedWorkbook {
  sheets: SheetSummary[]
  rows: ParsedRow[]
}

// ---------------------------------------------------------------------------
// Celdas
// ---------------------------------------------------------------------------

interface CellData {
  /** Valor primitivo: string, number, Date o null */
  value: unknown
  text: string
  link?: string
}

function readCell(cell: ExcelJS.Cell): CellData {
  const v = cell.value as unknown
  if (v == null) return { value: null, text: '' }
  if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return { value: v, text: v instanceof Date ? v.toISOString().slice(0, 10) : String(v) }
  if (typeof v === 'string') return { value: v, text: v }
  const o = v as Record<string, unknown>
  if (Array.isArray(o.richText)) {
    const t = (o.richText as { text: string }[]).map((r) => r.text).join('')
    return { value: t, text: t }
  }
  if ('hyperlink' in o) {
    const inner = o.text as unknown
    const t = typeof inner === 'string' ? inner : inner && typeof inner === 'object' && Array.isArray((inner as { richText?: unknown }).richText) ? ((inner as { richText: { text: string }[] }).richText).map((r) => r.text).join('') : String(inner ?? '')
    return { value: t, text: t, link: String(o.hyperlink) }
  }
  if ('result' in o) return readCell({ value: o.result } as ExcelJS.Cell)
  if ('error' in o) return { value: null, text: '' }
  return { value: null, text: '' }
}

const colLetter = (n: number) => {
  let s = ''
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

// ---------------------------------------------------------------------------
// Encabezado
// ---------------------------------------------------------------------------

function matchHeader(text: string): Field | null {
  const f = fold(text)
  if (!f) return null
  for (const [field, names] of Object.entries(HEADERS) as [Field, string[]][]) {
    if (names.includes(f)) return field
  }
  return null
}

function findHeader(ws: ExcelJS.Worksheet): { row: number; map: Map<number, Field>; extra: number[] } | null {
  const last = Math.min(ws.rowCount, 15)
  for (let r = 1; r <= last; r++) {
    const map = new Map<number, Field>()
    const row = ws.getRow(r)
    let lastCol = 0
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const field = matchHeader(readCell(cell).text)
      if (field && ![...map.values()].includes(field)) map.set(c, field)
      lastCol = Math.max(lastCol, c)
    })
    const fields = new Set(map.values())
    if (fields.has('name') && (fields.has('phone') || fields.has('date')) && fields.size >= 3) {
      // Las columnas sin encabezado a la derecha del último STATUS traen seguimientos (L, M, N…)
      const statusCols = [...map.entries()].filter(([, f]) => f === 'status1' || f === 'status2').map(([c]) => c)
      const from = (statusCols.length ? Math.max(...statusCols) : Math.max(...map.keys())) + 1
      const extra: number[] = []
      for (let c = from; c <= Math.max(ws.columnCount, from + 5); c++) if (!map.has(c)) extra.push(c)
      return { row: r, map, extra }
    }
  }
  return null
}

function sheetCountry(name: string): CountryCode {
  return /BOLIVIA/.test(fold(name)) ? 'BO' : 'PE'
}

// ---------------------------------------------------------------------------
// Libro
// ---------------------------------------------------------------------------

export function parseWorkbook(wb: ExcelJS.Workbook, opts: ParseOptions): ParsedWorkbook {
  const sheets: SheetSummary[] = []
  const rows: ParsedRow[] = []
  const wanted = opts.sheets?.map(fold)
  for (const ws of wb.worksheets) {
    if (wanted && !wanted.includes(fold(ws.name))) continue
    const country = sheetCountry(ws.name)
    const header = findHeader(ws)
    const summary: SheetSummary = { name: ws.name, country, headerRow: header?.row ?? null, columns: {}, extraColumns: [], rows: 0, skipped: [] }
    sheets.push(summary)
    if (!header) continue
    for (const [c, f] of header.map) summary.columns[f] = colLetter(c)
    const colOf = new Map<Field, number>([...header.map].map(([c, f]) => [f, c]))

    for (let r = header.row + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const get = (f: Field): CellData => {
        const c = colOf.get(f)
        return c ? readCell(row.getCell(c)) : { value: null, text: '' }
      }
      const texts: string[] = []
      row.eachCell({ includeEmpty: false }, (cell) => {
        const t = clean(readCell(cell).text)
        if (t) texts.push(t)
      })
      if (!texts.length) continue
      // Fila separadora: la misma marca repetida en todas las celdas (p. ej. "2026" en toda la fila)
      if (texts.length >= 3 && texts.every((t) => t === texts[0])) {
        summary.skipped.push({ row: r, reason: `Fila separadora "${texts[0]}"` })
        continue
      }
      const parsed = parseRow(ws.name, r, country, get, header.extra.map((c) => ({ col: colLetter(c), cell: readCell(row.getCell(c)) })), opts)
      if (parsed.extraColsUsed.length) for (const l of parsed.extraColsUsed) if (!summary.extraColumns.includes(l)) summary.extraColumns.push(l)
      summary.rows++
      rows.push(parsed.row)
    }
    summary.extraColumns.sort((a, b) => a.length - b.length || a.localeCompare(b))
  }
  return { sheets, rows }
}

function parseRow(
  sheet: string,
  r: number,
  country: CountryCode,
  get: (f: Field) => CellData,
  extras: { col: string; cell: CellData }[],
  opts: ParseOptions,
): { row: ParsedRow; extraColsUsed: string[] } {
  const issues: RowIssue[] = []
  const warn = (field: Field | undefined, message: string) => issues.push({ level: 'warning', field, message })

  const d = parseDateCell(get('date').value, opts.today, opts.currentYear)
  if (d.warning) warn('date', d.warning)

  const ph = parsePhones(get('phone').text, country)
  if (ph.warning) warn('phone', ph.warning)
  const rowCountry = ph.country ?? country

  // El correo a veces está en la columna de RUC/DNI como enlace mailto:
  const docCell = get('doc')
  let email = clean(get('email').text)
  let doc = clean(docCell.text)
  if (/@/.test(doc) || docCell.link?.startsWith('mailto:')) {
    email ||= doc.replace(/^mailto:/i, '')
    doc = ''
  }
  doc = doc.replace(/\s+/g, '')

  const amt = parseAmount(get('amount').value)
  if (amt.warning) warn('amount', amt.warning)

  let name = clean(get('name').text)
  const company = clean(get('company').text)
  // Un número en la columna de nombre no es un nombre
  if (/^\d+$/.test(name)) name = ''

  // Lugar + Ubicación (Bolivia): ciudad y región. Solo Ubicación (Perú): es la ciudad.
  const place = clean(get('place').text)
  let location = clean(get('location').text)
  let sourceText = get('source').text
  // Columnas cruzadas: el canal escrito en UBICACIÓN y CONTACTO vacío ("FACEBOOK" como ciudad)
  if (isChannelName(location) && parseSource(sourceText).channel === null && !fold(sourceText).startsWith('TIENDA')) {
    warn('location', `"${location}" es un canal, no una ubicación: se tomó como canal`)
    sourceText = location
    location = ''
  }
  const city = place || location
  const region = place ? location : ''

  // Notas en orden: STATUS 1, STATUS 2 y luego las columnas sin encabezado
  const notes: ParsedRow['notes'] = []
  const extraColsUsed: string[] = []
  const pushNote = (cell: CellData, column: string) => {
    let text = clean(cell.text)
    if (!isMeaningfulNote(text)) return false
    const file = cell.link ? fileNameFromLink(cell.link) : null
    if (file) text += ` (archivo: ${file})`
    else if (cell.link && /^https?:/i.test(cell.link)) text += ` (${cell.link})`
    if (!notes.some((n) => fold(n.text) === fold(text))) notes.push({ text, column })
    return true
  }
  pushNote(get('status1'), 'STATUS 1')
  pushNote(get('status2'), 'STATUS 2')
  for (const { col, cell } of extras) if (pushNote(cell, col)) extraColsUsed.push(col)

  const source = parseSource(sourceText)

  const incomplete = !name && !company
  if (incomplete) issues.push({ level: 'error', field: 'name', message: ph.phones.length ? 'Fila sin nombre ni empresa' : 'Fila sin nombre, empresa ni teléfono' })
  else if (!name) warn('name', 'Sin nombre de contacto: se usará la empresa')
  if (!ph.phones.length && !incomplete) warn('phone', 'Sin teléfono')

  return {
    row: {
      sheet,
      row: r,
      country: rowCountry,
      date: d.date,
      name: name || company,
      company,
      phones: ph.phones,
      doc,
      email,
      product: clean(get('product').text),
      amount: amt.amount,
      currency: amt.currency,
      source,
      city,
      region,
      notes,
      issues,
      incomplete,
    },
    extraColsUsed,
  }
}

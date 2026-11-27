// Lee el Excel de deudas por cobrar ("DEUDAS HASTA DICIEMBRE 2026"): una fila por venta con sus cuotas
// escritas como texto en una celda, p. ej.
//   (10,000) 27/JUL/2026 - ATRASADO
//   (20,000) 21/DIC/2026
//   (70,000) 26/JUL/2027
// y una columna "PAGOS A DICIEMBRE 2026" con lo que falta cobrar hasta esa fecha. Si las cuotas suman más
// que esa columna, la diferencia ya se abonó: se registra como abono parcial en las cuotas más antiguas.

import type ExcelJS from 'exceljs'
import { clean, type CountryCode, fold, parseAmount, parseDateText, parsePhones } from './normalize.js'

export interface DebtInstallment {
  n: number
  of: number
  label: string
  /** Saldo pendiente de la cuota */
  amount: number
  /** YYYY-MM-DD */
  dueDate: string
  /** El Excel la marcaba como ATRASADO */
  markedLate: boolean
}

export interface DebtAbono {
  /** Cuota a la que se aplicó (n) */
  n: number
  label: string
  amount: number
  dueDate: string
}

export interface DebtIssue {
  level: 'warning' | 'error'
  message: string
}

export interface DebtRow {
  key: string
  sheet: string
  row: number
  year: number | null
  name: string
  doc: string
  phone: string
  voucher: string
  product: string
  currency: string
  country: CountryCode
  installments: DebtInstallment[]
  abonos: DebtAbono[]
  /** Total de las cuotas tal como están escritas (antes de descontar abonos) */
  total: number
  /** Valor de la columna de pagos hasta la fecha de corte, si existe */
  dueByCutoff: number | null
  issues: DebtIssue[]
  /** No se puede importar (sin cliente o sin cuotas legibles) */
  invalid: boolean
}

export interface DebtSheet {
  name: string
  headerRow: number | null
  /** Fecha de corte de la columna de pagos ("PAGOS A DICIEMBRE 2026" → 2026-12-31) */
  cutoff: string | null
  title: string
  rows: number
}

export interface ParsedDebts {
  sheets: DebtSheet[]
  rows: DebtRow[]
}

type Field = 'year' | 'name' | 'voucher' | 'due' | 'amount' | 'doc' | 'phone' | 'product'

const HEADERS: [Field, RegExp][] = [
  ['year', /^(ANO|AÑO|PERIODO)$/],
  ['name', /^(CLIENTE|CLIENTES|NOMBRE|RAZON SOCIAL|CONTACTO\/CLIENTE)$/],
  ['voucher', /^(COMPROBANTE|FACTURA|BOLETA|DOCUMENTO DE VENTA|N[°º]? ?COMPROBANTE)$/],
  ['due', /^(VENCIMIENTOS?|CUOTAS|FECHAS? DE PAGO|CRONOGRAMA)$/],
  ['amount', /^(PAGOS?\b.*|SALDO\b.*|DEUDA\b.*|POR COBRAR\b.*|MONTO\b.*|TOTAL\b.*)$/],
  ['doc', /^(RUC|DNI|RUC\/DNI|RUC \/ DNI|CEDULA|NIT|CI|DOCUMENTO)$/],
  ['phone', /^(TELEFONO|CELULAR|TEL)$/],
  ['product', /^(PRODUCTO|EQUIPO|MAQUINA)$/],
]

const MONTHS: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SETIEMBRE: 9, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
}

const round2 = (n: number) => Math.round(n * 100) / 100

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v !== 'object') return String(v)
  const o = v as Record<string, unknown>
  if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join('')
  if ('result' in o) return o.result instanceof Date ? o.result.toISOString().slice(0, 10) : String(o.result ?? '')
  if ('text' in o) return String(o.text ?? '')
  return ''
}

function cellNumber(cell: ExcelJS.Cell): number | null {
  const v = cell.value as unknown
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && typeof (v as { result?: unknown }).result === 'number') return (v as { result: number }).result
  if (typeof v === 'string') return parseAmount(v).amount
  return null
}

/** Moneda según el formato de la celda ("S/ " #,##0.00) o el texto del encabezado */
function currencyOf(numFmt: string | undefined, text: string): string | null {
  const s = fold(`${numFmt ?? ''} ${text}`)
  if (/S\/|PEN|SOLES/.test(s)) return 'PEN'
  if (/\bBS\b|BOB|BOLIVIANO/.test(s)) return 'BOB'
  if (/US\$|USD|\$|DOLAR/.test(s)) return 'USD'
  return null
}

/** "PAGOS A DICIEMBRE 2026" → 2026-12-31 */
export function cutoffFromHeader(header: string): string | null {
  const m = fold(header).match(/\b([A-Z]+)\s+(?:DEL?\s+)?(\d{4})\b/)
  if (!m || !MONTHS[m[1]]) return null
  const y = Number(m[2])
  const mo = MONTHS[m[1]]
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return `${y}-${String(mo).padStart(2, '0')}-${last}`
}

export interface InstallmentLine {
  amount: number | null
  dueDate: string
  markedLate: boolean
}

/** Una línea de la celda VENCIMIENTOS: "(20,000) 21/DIC/2026 - ATRASADO" · "25/06/2026 - ATRASADO" */
export function parseInstallmentLine(line: string, currentYear: number): InstallmentLine | null {
  const s = clean(line)
  if (!s) return null
  const m = s.match(/^\(?\s*(?:S\/|US\$|USD|BS\.?|\$)?\s*([\d.,]+)\s*\)?\s*[-:]?\s*(.+)$/i)
  // Con monto entre paréntesis o seguido de una fecha; si no, la línea es solo la fecha
  let amount: number | null = null
  let rest = s
  if (m && /^\(|\)/.test(s) && /\d/.test(m[2])) {
    amount = parseAmount(m[1]).amount
    rest = m[2]
  }
  const d = parseDateText(rest, currentYear)
  if (!d) return null
  return { amount, dueDate: d.date, markedLate: /ATRASAD|VENCID/.test(fold(rest)) }
}

export interface DebtParseOptions {
  today: string
  currentYear: number
}

export function parseDebtsWorkbook(wb: ExcelJS.Workbook, opts: DebtParseOptions): ParsedDebts {
  const sheets: DebtSheet[] = []
  const rows: DebtRow[] = []
  for (const ws of wb.worksheets) {
    const sheet: DebtSheet = { name: ws.name, headerRow: null, cutoff: null, title: '', rows: 0 }
    sheets.push(sheet)
    // Encabezado: la primera fila con CLIENTE y VENCIMIENTOS
    let cols = new Map<Field, number>()
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const found = new Map<Field, number>()
      ws.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
        const f = fold(cellText(cell))
        const hit = HEADERS.find(([field, re]) => !found.has(field) && re.test(f))
        if (hit) found.set(hit[0], c)
      })
      if (found.has('name') && found.has('due')) {
        sheet.headerRow = r
        cols = found
        break
      }
    }
    if (!sheet.headerRow) continue
    // Título sobre el encabezado (p. ej. "BERNANDO ANDRES MIERES - MAQ. AGRÍCOLA")
    for (let r = 1; r < sheet.headerRow && !sheet.title; r++) sheet.title = clean(cellText(ws.getRow(r).getCell(1)))
    const amountHeader = cols.has('amount') ? cellText(ws.getRow(sheet.headerRow).getCell(cols.get('amount')!)) : ''
    sheet.cutoff = cutoffFromHeader(amountHeader)

    for (let r = sheet.headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const get = (f: Field) => (cols.has(f) ? row.getCell(cols.get(f)!) : null)
      const name = clean(get('name') ? cellText(get('name')!) : '')
      const dueText = get('due') ? cellText(get('due')!) : ''
      // Fila de totales (solo la suma) o vacía
      if (!name && !dueText.trim()) continue
      sheet.rows++
      const amountCell = get('amount')
      rows.push(
        buildRow({
          sheet: ws.name,
          row: r,
          name,
          dueText,
          year: get('year') ? cellNumber(get('year')!) : null,
          voucher: clean(get('voucher') ? cellText(get('voucher')!) : ''),
          doc: clean(get('doc') ? cellText(get('doc')!) : '').replace(/\s+/g, ''),
          phoneRaw: get('phone') ? cellText(get('phone')!) : '',
          product: clean(get('product') ? cellText(get('product')!) : ''),
          dueByCutoff: amountCell ? cellNumber(amountCell) : null,
          currency: currencyOf(amountCell?.numFmt, amountHeader) ?? currencyOf(undefined, dueText),
          cutoff: sheet.cutoff,
          opts,
        }),
      )
    }
  }
  return { sheets, rows }
}

interface RowInput {
  sheet: string
  row: number
  name: string
  dueText: string
  year: number | null
  voucher: string
  doc: string
  phoneRaw: string
  product: string
  dueByCutoff: number | null
  currency: string | null
  cutoff: string | null
  opts: DebtParseOptions
}

function buildRow(i: RowInput): DebtRow {
  const issues: DebtIssue[] = []
  const currency = i.currency ?? 'USD'
  if (!i.currency) issues.push({ level: 'warning', message: 'No se reconoce la moneda: se usará USD' })
  const country: CountryCode = currency === 'BOB' ? 'BO' : 'PE'

  // Cuotas
  const lines: InstallmentLine[] = []
  for (const raw of i.dueText.split(/\n|;/)) {
    if (!raw.trim()) continue
    const l = parseInstallmentLine(raw, i.opts.currentYear)
    if (l) lines.push(l)
    else issues.push({ level: 'warning', message: `No se entiende la cuota "${clean(raw)}"` })
  }
  lines.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  // Una sola cuota sin monto: el monto es la columna de pagos
  const missing = lines.filter((l) => l.amount == null)
  if (missing.length === 1 && i.dueByCutoff != null) {
    const others = lines.filter((l) => l.amount != null && (!i.cutoff || l.dueDate <= i.cutoff)).reduce((s, l) => s + l.amount!, 0)
    missing[0].amount = round2(i.dueByCutoff - others)
  }
  if (lines.some((l) => l.amount == null || l.amount <= 0)) {
    issues.push({ level: 'error', message: 'Hay cuotas sin monto: escribe el monto entre paréntesis, p. ej. (20,000) 21/DIC/2026' })
  }

  const of = lines.length
  const installments: DebtInstallment[] = lines.map((l, k) => ({
    n: k + 1,
    of,
    label: of === 1 ? 'Saldo pendiente' : `Cuota ${k + 1} de ${of}`,
    amount: round2(l.amount ?? 0),
    dueDate: l.dueDate,
    markedLate: l.markedLate,
  }))
  for (const q of installments) {
    if (q.markedLate && q.dueDate > i.opts.today) issues.push({ level: 'warning', message: `${q.label} dice ATRASADO pero vence el ${q.dueDate}` })
  }
  const total = round2(installments.reduce((s, q) => s + q.amount, 0))

  // Abono parcial: las cuotas hasta la fecha de corte suman más que la columna de pagos
  const abonos: DebtAbono[] = []
  if (i.dueByCutoff != null && i.cutoff && !issues.some((x) => x.level === 'error')) {
    const byCutoff = round2(installments.filter((q) => q.dueDate <= i.cutoff!).reduce((s, q) => s + q.amount, 0))
    let paid = round2(byCutoff - i.dueByCutoff)
    if (paid < 0) {
      issues.push({ level: 'warning', message: `Las cuotas hasta el corte suman ${byCutoff} pero la columna dice ${i.dueByCutoff}: se importan las cuotas tal como están` })
    } else if (paid > 0) {
      issues.push({ level: 'warning', message: `Las cuotas hasta el corte suman ${byCutoff} y la columna dice ${i.dueByCutoff}: se registra un abono de ${paid}` })
      for (const q of installments) {
        if (paid <= 0) break
        const part = round2(Math.min(paid, q.amount))
        if (part >= q.amount) {
          // Cuota pagada completa: queda como abono por todo su monto
          abonos.push({ n: q.n, label: q.label, amount: q.amount, dueDate: q.dueDate })
          q.amount = 0
        } else {
          abonos.push({ n: q.n, label: q.label, amount: part, dueDate: q.dueDate })
          q.amount = round2(q.amount - part)
        }
        paid = round2(paid - part)
      }
    }
  }

  const phone = parsePhones(i.phoneRaw, country).phones[0] ?? ''
  if (!i.name) issues.push({ level: 'error', message: 'Fila sin nombre de cliente' })
  if (!installments.length) issues.push({ level: 'error', message: 'Sin cuotas en VENCIMIENTOS' })
  const year = i.year && i.year >= 2000 && i.year <= 2100 ? Math.trunc(i.year) : null

  return {
    key: `${i.sheet}!${i.row}`,
    sheet: i.sheet,
    row: i.row,
    year,
    name: i.name,
    doc: i.doc,
    phone,
    voucher: i.voucher,
    product: i.product || (i.voucher ? `Venta ${i.voucher}` : 'Venta a crédito'),
    currency,
    country,
    installments: installments.filter((q) => q.amount > 0),
    abonos,
    total,
    dueByCutoff: i.dueByCutoff,
    issues,
    invalid: issues.some((x) => x.level === 'error'),
  }
}

// Agrupa las filas del Excel en contactos: el mismo cliente puede aparecer varias veces
// (en "BASE DE DATOS CLIENTES" y otra vez en "CLIENTES POTENCIALES" con más seguimiento).

import { type CountryCode, dateInNote, fold, inferStage, nextAction, phoneKey, type SourceResult, type StageId } from './normalize.js'
import type { ParsedRow, RowIssue } from './parse-workbook.js'

export interface ImportActivity {
  /** YYYY-MM-DD, o null si no se conoce (se usará la fecha de importación) */
  date: string | null
  text: string
  /** Hoja y fila de origen, para mostrar en la vista previa */
  from: string
}

export interface ImportDeal {
  product: string
  amount: number
  currency: string
  stage: StageId
  /** Alguna nota dice "COMPRÓ": el usuario decide si fue una venta nuestra */
  mentionsPurchase: boolean
  createdAt: string | null
  nextAction: string
  nextAt: string | null
}

export interface ImportContact {
  /** Identificador estable dentro de la importación (p. ej. "BASE DE DATOS CLIENTES!12") */
  key: string
  name: string
  company: string
  country: CountryCode
  phone: string
  otherPhones: string[]
  doc: string
  email: string
  city: string
  region: string
  source: SourceResult
  createdAt: string | null
  deals: ImportDeal[]
  activities: ImportActivity[]
  /** Filas del Excel que forman este contacto */
  rows: { sheet: string; row: number }[]
  issues: (RowIssue & { from: string })[]
  incomplete: boolean
}

export interface GroupOptions {
  today: string
  currentYear: number
}

const nameKey = (s: string) => fold(s).replace(/[^A-Z ]/g, '').replace(/\b(SR|SRA|SRTA|DON|DONA|ING)\b/g, '').replace(/\s+/g, ' ').trim()

/** Mismo nombre, o uno contiene al otro ("JOSE CARDENAS" y "JOSE CARDENAS RUIZ") */
function sameName(a: string, b: string): boolean {
  const x = nameKey(a)
  const y = nameKey(b)
  if (!x || !y) return true
  if (x === y) return true
  const tx = new Set(x.split(' '))
  const ty = y.split(' ')
  const common = ty.filter((t) => tx.has(t)).length
  return common >= Math.min(2, tx.size, ty.length)
}

export function groupRows(rows: ParsedRow[], opts: GroupOptions): ImportContact[] {
  const groups: ParsedRow[][] = []
  const byPhone = new Map<string, ParsedRow[][]>()
  const byDoc = new Map<string, ParsedRow[]>()

  for (const r of rows) {
    let group: ParsedRow[] | undefined
    // 1) mismo teléfono y nombre compatible · 2) mismo RUC/DNI
    for (const p of r.phones) {
      group = byPhone.get(phoneKey(p))?.find((g) => sameName(g[0].name, r.name))
      if (group) break
    }
    if (!group && r.doc.length >= 7) group = byDoc.get(r.doc)
    if (!group) {
      group = []
      groups.push(group)
    }
    group.push(r)
    for (const p of r.phones) {
      const k = phoneKey(p)
      const list = byPhone.get(k) ?? []
      if (!list.includes(group)) list.push(group)
      byPhone.set(k, list)
    }
    if (r.doc.length >= 7 && !byDoc.has(r.doc)) byDoc.set(r.doc, group)
  }

  // Teléfonos compartidos por contactos distintos: se avisa (p. ej. dos hermanos con el mismo celular)
  const shared = new Set<ParsedRow[]>()
  for (const list of byPhone.values()) if (list.length > 1) list.forEach((g) => shared.add(g))

  return groups.map((g) => buildContact(g, shared.has(g), opts))
}

const firstOf = (rows: ParsedRow[], pick: (r: ParsedRow) => string) => rows.map(pick).find(Boolean) ?? ''
const minDate = (dates: (string | null)[]) => dates.filter((d): d is string => !!d).sort()[0] ?? null

function buildContact(rows: ParsedRow[], sharesPhone: boolean, opts: GroupOptions): ImportContact {
  const from = (r: ParsedRow) => `${r.sheet}!${r.row}`
  const phones = [...new Set(rows.flatMap((r) => r.phones))]
  const createdAt = minDate(rows.map((r) => r.date))

  // Historial: notas de todas las filas, sin repetir el mismo texto
  const activities: ImportActivity[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    for (const n of r.notes) {
      const k = fold(n.text)
      if (seen.has(k)) continue
      seen.add(k)
      const inText = dateInNote(n.text, r.date, opts.currentYear)
      activities.push({ date: inText && inText <= opts.today && (!r.date || inText >= r.date) ? inText : r.date, text: n.text, from: `${from(r)} · ${n.column}` })
    }
  }
  // Las fechas no retroceden: el historial respeta el orden en que el vendedor escribió las notas
  let prev: string | null = null
  for (const a of activities) {
    if (prev && (!a.date || a.date < prev)) a.date = prev
    prev = a.date ?? prev
  }
  const noteTexts = activities.map((a) => a.text)

  // Tratos: uno por producto distinto
  const deals: ImportDeal[] = []
  const byProduct = new Map<string, ParsedRow[]>()
  for (const r of rows) {
    if (!r.product) continue
    const k = fold(r.product)
    byProduct.set(k, [...(byProduct.get(k) ?? []), r])
  }
  const st = inferStage(noteTexts)
  const next = nextAction(noteTexts, createdAt, opts.today, opts.currentYear)
  for (const rs of byProduct.values()) {
    const priced = rs.find((r) => r.amount != null)
    deals.push({
      product: rs[0].product,
      amount: priced?.amount ?? 0,
      currency: priced?.currency ?? 'USD',
      stage: st.stage,
      mentionsPurchase: st.mentionsPurchase,
      createdAt: minDate(rs.map((r) => r.date)),
      nextAction: next?.text ?? '',
      nextAt: next?.at ?? null,
    })
  }

  // Origen: el primero que no sea "llegó solo"
  const source = rows.find((r) => r.source.channel)?.source ?? rows[0].source
  const sourceNote = source.referredBy ? `Referido por: ${source.referredBy}` : source.note
  if (sourceNote) activities.unshift({ date: createdAt, text: sourceNote, from: 'CONTACTO' })

  const issues = rows.flatMap((r) => r.issues.map((i) => ({ ...i, from: from(r) })))
  if (sharesPhone) issues.push({ level: 'warning', field: 'phone', message: 'Otro contacto del Excel tiene el mismo teléfono', from: from(rows[0]) })
  if (st.mentionsPurchase) issues.push({ level: 'warning', message: 'Una nota dice que compró: indica si la venta fue con ustedes', from: from(rows[0]) })
  const names = [...new Set(rows.map((r) => r.name).filter(Boolean))]

  return {
    key: from(rows[0]),
    name: names.sort((a, b) => b.length - a.length)[0] ?? '',
    company: firstOf(rows, (r) => r.company),
    country: rows[0].country,
    phone: phones[0] ?? '',
    otherPhones: phones.slice(1),
    doc: firstOf(rows, (r) => r.doc),
    email: firstOf(rows, (r) => r.email),
    city: firstOf(rows, (r) => r.city),
    region: firstOf(rows, (r) => r.region),
    source,
    createdAt,
    deals,
    activities,
    rows: rows.map((r) => ({ sheet: r.sheet, row: r.row })),
    issues,
    incomplete: rows.every((r) => r.incomplete),
  }
}

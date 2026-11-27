import { Injectable } from '@nestjs/common'
import ExcelJS from 'exceljs'
import type { Tenant } from '../../common/auth/tenant.js'
import { ApiError } from '../../common/errors/api-error.js'
import { ClockService } from '../../core/clock.service.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { Json } from '../../database/database.types.js'
import { groupRows, type ImportContact, type ImportDeal } from './excel/group.js'
import { fold, phoneKey } from './excel/normalize.js'
import { parseWorkbook, type SheetSummary } from './excel/parse-workbook.js'
import type { CommitOptions } from './imports.schemas.js'

export interface UploadedXlsx {
  buffer: Buffer
  originalname: string
  size: number
}

/**
 * nuevo         → se crea el contacto
 * existente     → ya está en Vendex (mismo teléfono o RUC/DNI): se le agregan los tratos y notas que falten
 * sin_cambios   → ya está en Vendex con todo lo que trae el Excel
 * otro_vendedor → el contacto ya es de otro vendedor de la empresa: no se importa
 * incompleto    → la fila no tiene nombre ni empresa
 */
export type RowStatus = 'nuevo' | 'existente' | 'sin_cambios' | 'otro_vendedor' | 'incompleto'

interface Analyzed extends ImportContact {
  status: RowStatus
  existingId: string | null
  /** Tratos y notas que se agregarían (en existentes, solo lo que falta) */
  newDeals: ImportDeal[]
  newActivities: ImportContact['activities']
}

interface ExistingContact {
  id: string
  name: string
  phone: string
  doc: string
  owner_id: string | null
}

const MAX_FILE = 10 * 1024 * 1024

@Injectable()
export class ImportsService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly clock: ClockService,
  ) {}

  /** Vista previa: qué se crearía, sin guardar nada */
  async preview(t: Tenant, file: UploadedXlsx | undefined) {
    const { sheets, contacts } = await this.analyze(t, file)
    return {
      fileName: file!.originalname,
      sheets: sheets.map((s) => ({ name: s.name, country: s.country, found: s.headerRow !== null, rows: s.rows, skipped: s.skipped.length })),
      summary: summarize(contacts),
      contacts: contacts.map((c) => ({
        key: c.key,
        status: c.status,
        name: c.name,
        company: c.company,
        phone: c.phone,
        otherPhones: c.otherPhones,
        doc: c.doc,
        country: c.country,
        city: c.city,
        region: c.region,
        channel: c.source.channel,
        source: c.source.raw,
        createdAt: c.createdAt,
        deals: c.newDeals.map((d) => ({ product: d.product, amount: d.amount, currency: d.currency, stage: d.stage, mentionsPurchase: d.mentionsPurchase })),
        activities: c.newActivities.map((a) => ({ date: a.date, text: a.text })),
        issues: c.issues.map((i) => ({ level: i.level, message: i.message, from: i.from })),
        rows: c.rows,
      })),
    }
  }

  /** Importa el archivo: crea contactos, tratos y notas en una sola transacción */
  async commit(t: Tenant, file: UploadedXlsx | undefined, opts: CommitOptions) {
    const { contacts } = await this.analyze(t, file)
    const exclude = new Set(opts.exclude)
    const sold = new Set(opts.sold)
    const chosen = contacts.filter((c) => (c.status === 'nuevo' || c.status === 'existente') && !exclude.has(c.key))
    if (!chosen.length) throw new ApiError(400, 'No hay contactos para importar')
    const items = chosen.map((c) => this.toItem(c, sold.has(c.key)))
    const res = (await this.sb.rpc('import_contacts', {
      p_company: t.companyId,
      p_seller: t.actorId,
      p_file: file!.originalname.slice(0, 200),
      p_summary: { ...summarize(contacts), excluded: exclude.size, sold: sold.size } as Json,
      p_items: items as unknown as Json,
    })) as { batch_id: string; contacts: number; deals: number; activities: number }
    return { id: res.batch_id, contacts: res.contacts, deals: res.deals, activities: res.activities }
  }

  /** Historial de importaciones (el vendedor ve solo las suyas) */
  async list(t: Tenant) {
    const { db, q } = this.sb
    let query = db.from('import_batches').select('*').eq('company_id', t.companyId).order('created_at', { ascending: false }).limit(50)
    if (t.role === 'vendedor') query = query.eq('seller_id', t.actorId)
    const rows = await q(query)
    return rows.map((r) => ({ id: r.id, fileName: r.file_name, sellerId: r.seller_id, summary: r.summary, createdAt: r.created_at, undoneAt: r.undone_at }))
  }

  /** Deshace una importación */
  async undo(t: Tenant, id: string) {
    const { db, one } = this.sb
    const batch = await one(db.from('import_batches').select('id, seller_id, undone_at').eq('id', id).eq('company_id', t.companyId).maybeSingle(), 'Importación')
    if (t.role === 'vendedor' && batch.seller_id !== t.actorId) throw new ApiError(403, 'Solo puedes deshacer tus importaciones')
    if (batch.undone_at) throw new ApiError(409, 'Esta importación ya se deshizo')
    return this.sb.rpc('import_undo', { p_company: t.companyId, p_batch: id })
  }

  // ---------------------------------------------------------------------------

  private async analyze(t: Tenant, file: UploadedXlsx | undefined): Promise<{ sheets: SheetSummary[]; contacts: Analyzed[] }> {
    if (!file?.buffer?.length) throw new ApiError(400, 'Adjunta el archivo de Excel (.xlsx)')
    if (file.size > MAX_FILE) throw new ApiError(400, 'El archivo pesa más de 10 MB')
    if (!/\.xlsx$/i.test(file.originalname)) throw new ApiError(400, 'El archivo debe ser .xlsx (en Excel: Guardar como → Libro de Excel)')
    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(file.buffer as never)
    } catch {
      throw new ApiError(400, 'No se pudo leer el archivo. ¿Es un Excel (.xlsx) válido?')
    }
    const today = this.clock.today()
    const opts = { today, currentYear: Number(today.slice(0, 4)) }
    const parsed = parseWorkbook(wb, opts)
    if (!parsed.sheets.some((s) => s.headerRow !== null)) {
      throw new ApiError(400, 'No se encontró el encabezado (FECHA, TELEFONO, CONTACTO/CLIENTE…) en ninguna hoja')
    }
    const grouped = groupRows(parsed.rows, opts)
    return { sheets: parsed.sheets, contacts: await this.matchExisting(t, grouped) }
  }

  /** Busca cada contacto del Excel entre los que ya existen en la empresa (por teléfono o RUC/DNI) */
  private async matchExisting(t: Tenant, contacts: ImportContact[]): Promise<Analyzed[]> {
    const existing = await this.companyContacts(t.companyId)
    const byPhone = new Map<string, ExistingContact>()
    const byDoc = new Map<string, ExistingContact>()
    for (const e of existing) {
      for (const p of e.phone.split(/[/,;]/)) {
        const k = phoneKey(p)
        if (k.length >= 6 && !byPhone.has(k)) byPhone.set(k, e)
      }
      const doc = e.doc.replace(/\s/g, '')
      if (doc.length >= 7 && !byDoc.has(doc)) byDoc.set(doc, e)
    }

    const matches = contacts.map((c) => {
      if (c.incomplete) return null
      for (const p of [c.phone, ...c.otherPhones]) {
        const e = p && byPhone.get(phoneKey(p))
        if (e) return e
      }
      return c.doc.length >= 7 ? (byDoc.get(c.doc) ?? null) : null
    })

    // Lo que ya tienen los contactos existentes, para no duplicar tratos ni notas
    const ids = [...new Set(matches.filter((m): m is ExistingContact => !!m).map((m) => m.id))]
    const { products, notes } = await this.existingDetail(ids)

    return contacts.map((c, i) => {
      const e = matches[i]
      if (c.incomplete) return { ...c, status: 'incompleto', existingId: null, newDeals: [], newActivities: [] }
      if (!e) return { ...c, status: 'nuevo', existingId: null, newDeals: c.deals, newActivities: c.activities }
      if (t.role === 'vendedor' && e.owner_id !== t.actorId) {
        return { ...c, status: 'otro_vendedor', existingId: e.id, newDeals: [], newActivities: [] }
      }
      const haveP = products.get(e.id) ?? new Set<string>()
      const haveN = notes.get(e.id) ?? new Set<string>()
      const newDeals = c.deals.filter((d) => !haveP.has(fold(d.product)))
      const newActivities = c.activities.filter((a) => !haveN.has(fold(a.text)))
      const status: RowStatus = newDeals.length || newActivities.length ? 'existente' : 'sin_cambios'
      return { ...c, status, existingId: e.id, newDeals, newActivities }
    })
  }

  private async companyContacts(companyId: string): Promise<ExistingContact[]> {
    const { db, q } = this.sb
    const out: ExistingContact[] = []
    // PostgREST devuelve como máximo 1000 filas por consulta
    for (let from = 0; ; from += 1000) {
      const page = await q(db.from('contacts').select('id, name, phone, doc, owner_id').eq('company_id', companyId).order('id').range(from, from + 999))
      out.push(...page)
      if (page.length < 1000) return out
    }
  }

  private async existingDetail(ids: string[]) {
    const { db, q } = this.sb
    const products = new Map<string, Set<string>>()
    const notes = new Map<string, Set<string>>()
    const add = (m: Map<string, Set<string>>, k: string, v: string) => m.set(k, (m.get(k) ?? new Set()).add(fold(v)))
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const [deals, acts] = await Promise.all([
        q(db.from('deals').select('contact_id, product').in('contact_id', chunk)),
        q(db.from('activities').select('contact_id, text').in('contact_id', chunk)),
      ])
      for (const d of deals) add(products, d.contact_id, d.product)
      for (const a of acts) add(notes, a.contact_id, a.text)
    }
    return { products, notes }
  }

  /** Contacto analizado → elemento para import_contacts() */
  private toItem(c: Analyzed, isSale: boolean) {
    const today = this.clock.today()
    // Las notas de un mismo día se separan por minutos para que el historial conserve su orden
    const activities = c.newActivities.map((a, i) => ({ at: this.clock.localIso(a.date ?? today, 9, i), type: activityType(a.text), text: a.text }))
    const lastDate = c.newActivities.at(-1)?.date ?? c.createdAt ?? today
    const deals = c.newDeals.map((d) => {
      const stage = isSale && d.mentionsPurchase ? 'cerrado' : d.stage
      return {
        product: d.product,
        amount: d.amount,
        currency: d.currency,
        stage,
        temp: dealTemp(stage),
        next_at: stage === 'cerrado' || stage === 'pausa' || !d.nextAt ? null : this.clock.localIso(d.nextAt, 9),
        next_action: stage === 'cerrado' || stage === 'pausa' ? '' : d.nextAction,
        created_at: this.clock.localIso(d.createdAt ?? today, 8),
        closed_at: stage === 'cerrado' ? this.clock.localIso(lastDate, 18) : null,
      }
    })
    if (deals.some((d) => d.stage === 'cerrado')) {
      activities.push({ at: this.clock.localIso(lastDate, 18, 1), type: 'venta', text: 'Venta registrada al importar el Excel' })
    }
    const temps = deals.map((d) => d.temp)
    return {
      existing_id: c.status === 'existente' ? c.existingId : null,
      contact: {
        name: c.name.slice(0, 200),
        company: c.company.slice(0, 200),
        country_code: c.country,
        city: c.city.slice(0, 120),
        region: c.region.slice(0, 120),
        phone: [c.phone, ...c.otherPhones].filter(Boolean).join(' / ').slice(0, 120),
        doc: c.doc.slice(0, 40),
        email: c.email.slice(0, 200),
        channel: c.source.channel,
        temp: temps.includes('caliente') ? 'caliente' : temps.length && temps.every((x) => x === 'frio') ? 'frio' : 'tibio',
        created_at: c.createdAt ? this.clock.localIso(c.createdAt, 8) : null,
      },
      deals,
      activities,
    }
  }
}

function dealTemp(stage: string): 'caliente' | 'tibio' | 'frio' {
  if (stage === 'negociacion' || stage === 'cerrado') return 'caliente'
  if (stage === 'pausa') return 'frio'
  return 'tibio'
}

/** Tipo de actividad del historial según el texto de la nota */
export function activityType(text: string): string {
  const f = fold(text)
  if (/COTIZACION|PROFORMA/.test(f) && /ENVI|PASO/.test(f) && !/NO SE (LE )?ENVIO/.test(f)) return 'cotizacion'
  if (/VISIT/.test(f)) return 'visita'
  if (/WTP|WSP|WHATSAPP/.test(f)) return 'whatsapp'
  if (/CORREO|EMAIL/.test(f)) return 'email'
  if (/LLAM|CONTEST|CONTESA|TELF|TELEFON|APAGADO|CONVERS/.test(f)) return 'llamada'
  return 'nota'
}

function summarize(contacts: Analyzed[]) {
  const count = (s: RowStatus) => contacts.filter((c) => c.status === s).length
  const importable = contacts.filter((c) => c.status === 'nuevo' || c.status === 'existente')
  return {
    total: contacts.length,
    nuevo: count('nuevo'),
    existente: count('existente'),
    sinCambios: count('sin_cambios'),
    otroVendedor: count('otro_vendedor'),
    incompleto: count('incompleto'),
    deals: importable.reduce((n, c) => n + c.newDeals.length, 0),
    activities: importable.reduce((n, c) => n + c.newActivities.length, 0),
    purchases: importable.filter((c) => c.newDeals.some((d) => d.mentionsPurchase)).length,
    warnings: importable.filter((c) => c.issues.length).length,
  }
}

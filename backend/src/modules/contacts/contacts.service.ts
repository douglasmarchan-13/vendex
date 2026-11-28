import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import { ApiError } from '../../common/errors/api-error.js'
import * as M from '../../common/utils/mappers.js'
import type { Temp } from '../../common/validation/schemas.js'
import { AccessService } from '../../core/access.service.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { TablesInsert, TablesUpdate } from '../../database/database.types.js'
import { docKey, nameKey } from '../../common/utils/contact-keys.js'
import { ContactFilesService } from './contact-files.service.js'
import type { ActivityBody, ContactCheckBody, ContactListQuery, ContactPatch, CreateContactBody } from './contacts.schemas.js'

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

@Injectable()
export class ContactsService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly access: AccessService,
    private readonly files: ContactFilesService,
  ) {}

  async list(t: Tenant, f: ContactListQuery) {
    const { db, q } = this.sb
    let query = db
      .from('contacts')
      .select(f.timeline === 'true' ? '*, activities(*)' : '*')
      .eq('company_id', t.companyId)
      .order('created_at', { ascending: false })
    if (t.sellerId) query = query.eq('owner_id', t.sellerId)
    if (f.country) query = query.eq('country_code', f.country)
    if (f.owner) query = query.eq('owner_id', f.owner)
    if (f.temp) query = query.eq('temp', f.temp)
    if (f.q) {
      // Se quitan los caracteres con significado en el filtro de PostgREST
      const term = f.q.replace(/[%,()*]/g, ' ')
      query = query.or(`name.ilike.%${term}%,company.ilike.%${term}%,phone.ilike.%${term}%,doc.ilike.%${term}%,city.ilike.%${term}%`)
    }
    const rows = (await q(query)) as unknown as (M.ContactRow & { activities?: M.ActivityRow[] })[]
    return rows.map(M.contact)
  }

  /** Contacto + timeline + tratos + cuotas */
  async get(t: Tenant, cid: string) {
    await this.access.contact(t, cid)
    const { db, q, one } = this.sb
    const [c, deals, payments] = await Promise.all([
      one(db.from('contacts').select('*, activities(*)').eq('id', cid).maybeSingle(), 'Contacto'),
      q(db.from('deals').select('*').eq('contact_id', cid).order('created_at', { ascending: false })),
      q(db.from('payments').select('*').eq('contact_id', cid).order('due_at')),
    ])
    return { ...M.contact(c), deals: deals.map(M.deal), payments: payments.map(M.payment) }
  }

  /**
   * Crea el contacto y su primera nota (también lo usa el alta de tratos).
   * El vendedor siempre queda como dueño; el gerente puede asignarlo a otro vendedor de su empresa.
   */
  async create(t: Tenant, b: CreateContactBody) {
    const { db, q } = this.sb
    const { note, ...fields } = b
    const owner = t.role === 'vendedor' ? t.actorId : (fields.owner ?? t.actorId)
    if (owner !== t.actorId) await this.access.seller(t, owner)
    await this.assertUniqueDoc(t, fields.country, fields.doc)
    const row = await q(
      db
        .from('contacts')
        .insert({ ...(M.toRow({ ...fields, owner }, M.CONTACT_COLS) as TablesInsert<'contacts'>), company_id: t.companyId })
        .select()
        .single(),
    )
    const act = await q(
      db
        .from('activities')
        .insert({ company_id: t.companyId, contact_id: row.id, type: 'nota', text: note || 'Prospecto registrado en Vendex.', author_id: t.actorId })
        .select()
        .single(),
    )
    return M.contact({ ...row, activities: [act] })
  }

  /**
   * Validación previa al guardar (la usa el frontend):
   * - mismo nombre → solo advertencia, el usuario puede continuar;
   * - mismo documento oficial en el país (DNI, RUC, cédula…) → no se permite.
   */
  async check(t: Tenant, b: ContactCheckBody) {
    const [sameName, doc] = await Promise.all([
      b.name ? this.findSameName(t, b.name, b.exceptId) : Promise.resolve([]),
      b.doc && b.country ? this.findSameDoc(t, b.country, b.doc, b.exceptId) : Promise.resolve(null),
    ])
    const sellers = await this.sellerNames(t, [...sameName.map((r) => r.owner_id), doc?.owner_id ?? null])
    // mine: es del vendedor que consulta; seller: nombre del vendedor dueño del cliente
    const mine = (r: { owner_id: string | null }) => r.owner_id === t.actorId
    const seller = (r: { owner_id: string | null }) => (r.owner_id ? (sellers.get(r.owner_id) ?? null) : null)
    return {
      sameName: sameName.map((r) => ({ name: r.name, mine: mine(r), seller: seller(r) })),
      docTaken: doc ? { name: doc.name, doc: doc.doc, mine: mine(doc), seller: seller(doc) } : null,
    }
  }

  /** id del vendedor → nombre, solo de la empresa de la sesión */
  private async sellerNames(t: Tenant, ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))]
    if (!unique.length) return new Map<string, string>()
    const rows = await this.sb.q(this.sb.db.from('sellers').select('id, name').eq('company_id', t.companyId).in('id', unique))
    return new Map(rows.map((r) => [r.id, r.name]))
  }

  /** Clientes de la empresa con el mismo nombre (sin distinguir mayúsculas ni espacios sobrantes) */
  private async findSameName(t: Tenant, name: string, exceptId?: string) {
    const key = nameKey(name)
    if (!key) return []
    // Regex sin distinguir mayúsculas (~*), los espacios aceptan cualquier secuencia; después se confirma con nameKey()
    const pattern = `^\\s*${key.split(' ').map(escapeRegex).join('\\s+')}\\s*$`
    let query = this.sb.db.from('contacts').select('id, name, owner_id').eq('company_id', t.companyId).filter('name', 'imatch', pattern)
    if (exceptId) query = query.neq('id', exceptId)
    const rows = await this.sb.q(query)
    return rows.filter((r) => nameKey(r.name) === key)
  }

  /** Cliente de la empresa con el mismo documento oficial en ese país (ignora espacios, puntos y guiones) */
  private async findSameDoc(t: Tenant, country: string, doc: string, exceptId?: string) {
    const key = docKey(doc)
    if (!key) return null
    let query = this.sb.db
      .from('contacts')
      .select('id, name, doc, owner_id')
      .eq('company_id', t.companyId)
      .eq('country_code', country)
      .neq('doc', '')
    if (exceptId) query = query.neq('id', exceptId)
    const rows = await this.sb.q(query)
    return rows.find((r) => docKey(r.doc) === key) ?? null
  }

  /** El documento oficial (DNI, RUC, cédula…) no se puede repetir dentro de un mismo país */
  private async assertUniqueDoc(t: Tenant, country: string, doc: string, exceptId?: string) {
    const dup = await this.findSameDoc(t, country, doc, exceptId)
    if (!dup) return
    const seller = dup.owner_id ? (await this.sellerNames(t, [dup.owner_id])).get(dup.owner_id) : undefined
    const whose = dup.owner_id === t.actorId ? 'tu cliente' : seller ? `el cliente de ${seller}` : 'el cliente'
    throw new ApiError(409, `El documento ${dup.doc} ya está registrado para ${whose} "${dup.name}"`, {
      code: 'duplicate_doc',
      seller: seller ?? null,
    })
  }

  async update(t: Tenant, cid: string, sent: ContactPatch) {
    await this.access.contact(t, cid)
    const { db, q, one } = this.sb
    const { temp, ...rest } = sent
    // Reasignar el contacto es cosa del gerente
    if (t.role === 'vendedor') delete rest.owner
    else if (rest.owner) await this.access.seller(t, rest.owner)
    if (rest.doc !== undefined || rest.country !== undefined) {
      // Si cambia solo uno de los dos, el otro se toma de lo guardado
      const cur = await one(db.from('contacts').select('doc, country_code').eq('id', cid).maybeSingle(), 'Contacto')
      await this.assertUniqueDoc(t, rest.country ?? cur.country_code, rest.doc ?? cur.doc, cid)
    }
    // La temperatura también se propaga a los tratos abiertos
    if (temp) await this.sb.rpc('set_contact_temp', { p_contact_id: cid, p_temp: temp })
    const patch = M.toRow(rest, M.CONTACT_COLS) as TablesUpdate<'contacts'>
    const row = Object.keys(patch).length
      ? await q(db.from('contacts').update(patch).eq('id', cid).select().single())
      : await one(db.from('contacts').select('*').eq('id', cid).maybeSingle(), 'Contacto')
    return M.contact(row)
  }

  /** setTemp(): contacto + sus tratos abiertos, en una sola transacción */
  async setTemp(t: Tenant, cid: string, temp: Temp) {
    await this.access.contact(t, cid)
    return M.contact(await this.sb.rpc('set_contact_temp', { p_contact_id: cid, p_temp: temp }))
  }

  /** Borra en cascada tratos, cuotas, actividades, tareas y alertas */
  /**
   * Borrar un contacto arrastra (on delete cascade) sus tratos, cuotas, pagos e historial.
   * Por eso solo se permite si no tiene ventas cerradas ni cuotas: así no cambian los cobros ni las ventas del mes.
   */
  async remove(t: Tenant, cid: string) {
    await this.access.contact(t, cid)
    const { db, q } = this.sb
    const [payments, sold] = await Promise.all([
      q(db.from('payments').select('id').eq('contact_id', cid).limit(1)),
      q(db.from('deals').select('id').eq('contact_id', cid).eq('stage', 'cerrado').limit(1)),
    ])
    if (payments.length || sold.length) {
      throw new ApiError(409, 'Este cliente tiene ventas o cobros registrados y no se puede eliminar. Pasa sus tratos abiertos a "Por ahora no".')
    }
    // Las filas de contact_files se borran en cascada; los PDF del bucket, aquí
    const paths = await this.files.pathsOf(cid)
    await q(db.from('contacts').delete().eq('id', cid))
    await this.files.removeObjects(paths)
  }

  // --- Línea de tiempo ---
  async activities(t: Tenant, cid: string) {
    await this.access.contact(t, cid)
    const rows = await this.sb.q(this.sb.db.from('activities').select('*').eq('contact_id', cid).order('at', { ascending: false }))
    return rows.map(M.activity)
  }

  /** logActivity() */
  async addActivity(t: Tenant, cid: string, b: ActivityBody) {
    await this.access.contact(t, cid)
    const row = await this.sb.q(
      this.sb.db
        .from('activities')
        .insert({ company_id: t.companyId, contact_id: cid, type: b.type, text: b.text, at: b.at, author_id: t.actorId })
        .select()
        .single(),
    )
    return M.activity(row)
  }

  async removeActivity(t: Tenant, cid: string, activityId: string) {
    await this.access.contact(t, cid)
    await this.sb.one(
      this.sb.db.from('activities').delete().eq('id', activityId).eq('contact_id', cid).select('id').maybeSingle(),
      'Actividad',
    )
  }
}

import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import * as M from '../../common/utils/mappers.js'
import type { Temp } from '../../common/validation/schemas.js'
import { AccessService } from '../../core/access.service.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { TablesInsert, TablesUpdate } from '../../database/database.types.js'
import type { ActivityBody, ContactListQuery, ContactPatch, CreateContactBody } from './contacts.schemas.js'

@Injectable()
export class ContactsService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly access: AccessService,
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

  async update(t: Tenant, cid: string, sent: ContactPatch) {
    await this.access.contact(t, cid)
    const { db, q, one } = this.sb
    const { temp, ...rest } = sent
    // Reasignar el contacto es cosa del gerente
    if (t.role === 'vendedor') delete rest.owner
    else if (rest.owner) await this.access.seller(t, rest.owner)
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
  async remove(t: Tenant, cid: string) {
    await this.access.contact(t, cid)
    await this.sb.q(this.sb.db.from('contacts').delete().eq('id', cid))
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

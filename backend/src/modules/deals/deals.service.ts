import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import { ApiError } from '../../common/errors/api-error.js'
import { fromDbError } from '../../common/errors/db-errors.js'
import * as M from '../../common/utils/mappers.js'
import { AccessService } from '../../core/access.service.js'
import { ClockService } from '../../core/clock.service.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { TablesUpdate } from '../../database/database.types.js'
import { ContactsService } from '../contacts/contacts.service.js'
import type { CreateDealBody, DealListQuery, DealPatch, PaymentPlanBody } from './deals.schemas.js'

@Injectable()
export class DealsService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly clock: ClockService,
    private readonly contacts: ContactsService,
    private readonly access: AccessService,
  ) {}

  /** Embudo: ?stage=negociacion&contactId=c1&country=PE&open=true */
  async list(t: Tenant, f: DealListQuery) {
    // El dueño del trato es el dueño del contacto
    const join = f.country || t.sellerId ? ', contacts!inner(country_code, owner_id)' : ''
    let query = this.sb.db
      .from('deals')
      .select(`*${join}`)
      .eq('company_id', t.companyId)
      .order('created_at', { ascending: false })
    if (t.sellerId) query = query.eq('contacts.owner_id', t.sellerId)
    if (f.stage) query = query.eq('stage', f.stage)
    if (f.contactId) query = query.eq('contact_id', f.contactId)
    if (f.country) query = query.eq('contacts.country_code', f.country)
    if (f.open === 'true') query = query.not('stage', 'in', '(cerrado,pausa)')
    const rows = (await this.sb.q(query)) as unknown as M.DealRow[]
    return rows.map(M.deal)
  }

  async get(t: Tenant, did: string) {
    await this.access.deal(t, did)
    const { db, q, one } = this.sb
    const [d, payments] = await Promise.all([
      one(db.from('deals').select('*').eq('id', did).maybeSingle(), 'Trato'),
      q(db.from('payments').select('*').eq('deal_id', did).order('due_at')),
    ])
    return { ...M.deal(d), payments: payments.map(M.payment) }
  }

  /** addDeal() → { deal, contact } (contact es null si se usó uno existente) */
  async create(t: Tenant, b: CreateDealBody) {
    if (!b.contactId && !b.contact) throw new ApiError(400, 'Indica contactId o los datos del nuevo contacto')

    let contact: M.Contact | null = null
    let contactId = b.contactId
    if (contactId) {
      await this.access.contact(t, contactId)
    } else {
      const c = b.contact!
      contact = await this.contacts.create(t, { ...c, city: c.city || '—', temp: b.temp })
      contactId = contact.id
    }

    const { data, error } = await this.sb.db
      .from('deals')
      .insert({
        company_id: t.companyId,
        contact_id: contactId!,
        product: b.product,
        amount: b.amount,
        currency: b.currency,
        stage: b.stage === 'cerrado' ? 'nuevo' : b.stage, // el cierre pasa por move_deal para registrar la venta
        temp: b.temp,
        next_at: b.nextAt ?? this.clock.at(b.nextDays ?? 0, 9, 0),
        next_action: b.nextAction,
      })
      .select()
      .single()
    if (error) {
      // No dejar un contacto huérfano si el trato falla
      if (contact) await this.sb.db.from('contacts').delete().eq('id', contactId!)
      throw fromDbError(error)
    }

    const deal = b.stage === 'cerrado' ? await this.moveRaw(t, data.id, 'cerrado') : data
    return { deal: M.deal(deal), contact }
  }

  async update(t: Tenant, did: string, sent: DealPatch) {
    await this.access.deal(t, did)
    const { nextDays, ...rest } = sent
    const fields = nextDays !== undefined ? { ...rest, nextAt: this.clock.at(nextDays, 9, 0) } : rest
    const row = await this.sb.q(
      this.sb.db.from('deals').update(M.toRow(fields, M.DEAL_COLS) as TablesUpdate<'deals'>).eq('id', did).select().single(),
    )
    return M.deal(row)
  }

  private moveRaw(t: Tenant, did: string, stage: string) {
    return this.sb.rpc('move_deal', { p_deal_id: did, p_stage: stage, p_author: t.actorId })
  }

  /**
   * moveDeal(): al pasar a 'cerrado' registra la venta en la línea de tiempo.
   * `needsPlan: true` indica que la venta aún no tiene plan de cobro (el frontend abre el modal de cobranza).
   */
  async move(t: Tenant, did: string, stage: string) {
    await this.access.deal(t, did)
    const deal = M.deal(await this.moveRaw(t, did, stage))
    let needsPlan = false
    if (deal.stage === 'cerrado') {
      const { count, error } = await this.sb.db.from('payments').select('id', { count: 'exact', head: true }).eq('deal_id', did)
      if (error) throw fromDbError(error)
      needsPlan = !count
    }
    return { deal, needsPlan }
  }

  /** pauseDeal(): "Por ahora no" */
  async pause(t: Tenant, did: string) {
    await this.access.deal(t, did)
    return M.deal(await this.moveRaw(t, did, 'pausa'))
  }

  /** snoozeDeal(): mueve el próximo seguimiento N días */
  async snooze(t: Tenant, did: string, days: number) {
    await this.access.deal(t, did)
    const row = await this.sb.q(this.sb.db.from('deals').update({ next_at: this.clock.at(days, 9, 0) }).eq('id', did).select().single())
    return M.deal(row)
  }

  async remove(t: Tenant, did: string) {
    await this.access.deal(t, did)
    await this.sb.q(this.sb.db.from('deals').delete().eq('id', did))
  }

  // --- Cobranza del trato ---
  async payments(t: Tenant, did: string) {
    await this.access.deal(t, did)
    const rows = await this.sb.q(this.sb.db.from('payments').select('*').eq('deal_id', did).order('due_at'))
    return rows.map(M.payment)
  }

  /** createPlan(): reemplaza las cuotas pendientes y conserva las ya pagadas */
  async createPlan(t: Tenant, did: string, b: PaymentPlanBody) {
    await this.access.deal(t, did)
    // dueDays se resuelve aquí con la zona horaria del negocio (igual que at() del frontend)
    const items = b.items.map(({ dueDays, ...it }) => ({ ...it, dueAt: it.dueAt ?? this.clock.at(dueDays ?? 0, 9, 0) }))
    const rows = await this.sb.rpc('create_payment_plan', {
      p_deal_id: did,
      p_items: items,
      p_first_paid_method: b.firstPaid ?? undefined,
    })
    return rows.map(M.payment)
  }
}

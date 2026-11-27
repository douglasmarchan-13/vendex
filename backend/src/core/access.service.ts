import { Injectable } from '@nestjs/common'
import type { Tenant } from '../common/auth/tenant.js'
import { ApiError } from '../common/errors/api-error.js'
import { SupabaseService } from './supabase.service.js'

/**
 * Verifica que un registro sea de la empresa de la sesión y, para un vendedor, suyo.
 * Se llama antes de editar o borrar por id. Si no corresponde responde 404 (no revela que existe).
 * Los tratos, cuotas y actividades pertenecen al vendedor dueño de su contacto.
 */
@Injectable()
export class AccessService {
  constructor(private readonly sb: SupabaseService) {}

  async contact(t: Tenant, contactId: string) {
    let query = this.sb.db.from('contacts').select('id, owner_id').eq('id', contactId).eq('company_id', t.companyId)
    if (t.sellerId) query = query.eq('owner_id', t.sellerId)
    const row = await this.sb.q(query.maybeSingle())
    if (!row) throw new ApiError(404, 'Contacto no encontrado')
    return row
  }

  async deal(t: Tenant, dealId: string) {
    let query = this.sb.db.from('deals').select('id, contact_id, contacts!inner(owner_id)').eq('id', dealId).eq('company_id', t.companyId)
    if (t.sellerId) query = query.eq('contacts.owner_id', t.sellerId)
    const row = await this.sb.q(query.maybeSingle())
    if (!row) throw new ApiError(404, 'Trato no encontrado')
    return row
  }

  async payment(t: Tenant, paymentId: string) {
    let query = this.sb.db.from('payments').select('id, paid_at, contacts!inner(owner_id)').eq('id', paymentId).eq('company_id', t.companyId)
    if (t.sellerId) query = query.eq('contacts.owner_id', t.sellerId)
    const row = await this.sb.q(query.maybeSingle())
    if (!row) throw new ApiError(404, 'Cuota no encontrada')
    return row
  }

  /** Tareas: el vendedor solo las que tiene asignadas */
  async task(t: Tenant, taskId: string) {
    let query = this.sb.db.from('tasks').select('*').eq('id', taskId).eq('company_id', t.companyId)
    if (t.sellerId) query = query.eq('seller_id', t.sellerId)
    const row = await this.sb.q(query.maybeSingle())
    if (!row) throw new ApiError(404, 'Tarea no encontrada')
    return row
  }

  /** Avisos: el gerente, todos los de la empresa; el vendedor, solo los de sus contactos */
  async alert(t: Tenant, alertId: string) {
    const row = t.sellerId
      ? await this.sb.q(
          this.sb.db.from('alerts').select('id, contacts!inner(owner_id)').eq('id', alertId).eq('company_id', t.companyId)
            .eq('contacts.owner_id', t.sellerId).maybeSingle(),
        )
      : await this.sb.q(this.sb.db.from('alerts').select('id').eq('id', alertId).eq('company_id', t.companyId).maybeSingle())
    if (!row) throw new ApiError(404, 'Alerta no encontrada')
    return row
  }

  /** Vendedor (dueño o asignado) de la misma empresa */
  async seller(t: Tenant, sellerId: string) {
    const row = await this.sb.q(
      this.sb.db.from('sellers').select('id').eq('id', sellerId).eq('company_id', t.companyId).maybeSingle(),
    )
    if (!row) throw new ApiError(400, 'Ese vendedor no pertenece a tu empresa')
    return row
  }
}

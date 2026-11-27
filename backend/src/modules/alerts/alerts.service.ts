import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import { ApiError } from '../../common/errors/api-error.js'
import * as M from '../../common/utils/mappers.js'
import { AccessService } from '../../core/access.service.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { TablesInsert } from '../../database/database.types.js'
import type { AlertBody, AlertQuery } from './alerts.schemas.js'

@Injectable()
export class AlertsService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly access: AccessService,
  ) {}

  /** El vendedor solo ve los avisos de sus contactos; el gerente, todos los de la empresa */
  async list(t: Tenant, f: AlertQuery) {
    let query = this.sb.db
      .from('alerts')
      .select(t.sellerId ? '*, contacts!inner(owner_id)' : '*')
      .eq('company_id', t.companyId)
      .order('created_at')
    if (t.sellerId) query = query.eq('contacts.owner_id', t.sellerId)
    if (f.contactId) query = query.eq('contact_id', f.contactId)
    return ((await this.sb.q(query)) as unknown as M.AlertRow[]).map(M.alert)
  }

  async create(t: Tenant, b: AlertBody) {
    if (b.contactId) await this.access.contact(t, b.contactId)
    else if (t.role === 'vendedor') throw new ApiError(403, 'Solo el gerente crea avisos generales')
    const row = await this.sb.q(
      this.sb.db
        .from('alerts')
        .insert({ ...(M.toRow(b, M.ALERT_COLS) as TablesInsert<'alerts'>), company_id: t.companyId })
        .select()
        .single(),
    )
    return M.alert(row)
  }

  /** dismissAlert() */
  async remove(t: Tenant, aid: string) {
    await this.access.alert(t, aid)
    await this.sb.q(this.sb.db.from('alerts').delete().eq('id', aid))
  }
}

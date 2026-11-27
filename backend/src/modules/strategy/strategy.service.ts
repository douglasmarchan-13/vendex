import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import { ApiError } from '../../common/errors/api-error.js'
import * as M from '../../common/utils/mappers.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { TablesInsert, TablesUpdate } from '../../database/database.types.js'
import type { CardBody } from './strategy.schemas.js'

/** Tarjetas de estrategia de la empresa: todos las leen, el gerente las edita */
@Injectable()
export class StrategyService {
  constructor(private readonly sb: SupabaseService) {}

  async list(t: Tenant) {
    return (await this.sb.q(this.sb.db.from('strategy_cards').select('*').eq('company_id', t.companyId).order('position'))).map(M.strategy)
  }

  /** Sin `position`, la tarjeta va al final */
  async create(t: Tenant, b: CardBody, id?: string) {
    const { db, q } = this.sb
    let position = b.position
    if (position === undefined) {
      const last = await q(
        db.from('strategy_cards').select('position').eq('company_id', t.companyId).order('position', { ascending: false }).limit(1),
      )
      position = (last[0]?.position ?? 0) + 1
    }
    const row = await q(
      db
        .from('strategy_cards')
        .insert({ ...(M.toRow({ ...b, position }, M.STRATEGY_COLS) as TablesInsert<'strategy_cards'>), ...(id ? { id } : {}), company_id: t.companyId })
        .select()
        .single(),
    )
    return M.strategy(row)
  }

  /** saveStrategy(): reemplaza la tarjeta de la empresa, o la crea con ese id */
  async save(t: Tenant, sid: string, b: CardBody) {
    const { db, q } = this.sb
    const row = await q(
      db
        .from('strategy_cards')
        .update(M.toRow(b, M.STRATEGY_COLS) as TablesUpdate<'strategy_cards'>)
        .eq('id', sid)
        .eq('company_id', t.companyId)
        .select()
        .maybeSingle(),
    )
    if (row) return M.strategy(row)
    // Un id que ya usa otra empresa da 409 por la llave primaria: no se puede tomar su tarjeta
    return this.create(t, b, sid)
  }

  /** removeStrategy() */
  async remove(t: Tenant, sid: string) {
    const row = await this.sb.q(
      this.sb.db.from('strategy_cards').delete().eq('id', sid).eq('company_id', t.companyId).select('id').maybeSingle(),
    )
    if (!row) throw new ApiError(404, 'Tarjeta no encontrada')
  }
}

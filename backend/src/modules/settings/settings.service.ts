import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import * as M from '../../common/utils/mappers.js'
import { ClockService } from '../../core/clock.service.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { TablesUpdate } from '../../database/database.types.js'
import type { PlanBody, RatesBody, SnoozeBody } from './settings.schemas.js'

export type SettingsView = Partial<M.Settings> & { rates: M.Rates }

/** Meta, planificador y tipo de cambio de la empresa (company_settings / company_currency_rates) */
@Injectable()
export class SettingsService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly clock: ClockService,
  ) {}

  /** { goalUSD, plan, timezone, rates } */
  async get(t: Tenant): Promise<SettingsView> {
    const { db, q } = this.sb
    const [s, rates] = await Promise.all([
      q(db.from('company_settings').select('*').eq('company_id', t.companyId).maybeSingle()),
      q(db.from('company_currency_rates').select('code, rate_per_usd').eq('company_id', t.companyId)),
    ])
    return { ...(s ? M.settings(s) : {}), rates: M.rates(rates) }
  }

  private async save(t: Tenant, patch: TablesUpdate<'company_settings'>) {
    await this.sb.q(this.sb.db.from('company_settings').upsert({ ...patch, company_id: t.companyId }, { onConflict: 'company_id' }))
    return this.get(t)
  }

  setGoal(t: Tenant, goalUSD: number) {
    return this.save(t, { goal_usd: goalUSD })
  }

  setPlan(t: Tenant, b: PlanBody) {
    return this.save(t, M.toRow(b, M.PLAN_COLS) as TablesUpdate<'company_settings'>)
  }

  /** Ignora valores <= 0, el USD (siempre 1) y monedas que no existen */
  async setRates(t: Tenant, b: RatesBody) {
    const { db, q } = this.sb
    const known = new Set((await q(db.from('currencies').select('code'))).map((c) => c.code))
    const rows = Object.entries(b)
      .filter(([code, v]) => v > 0 && code !== 'USD' && known.has(code))
      .map(([code, v]) => ({ company_id: t.companyId, code, rate_per_usd: v }))
    if (rows.length) await q(db.from('company_currency_rates').upsert(rows, { onConflict: 'company_id,code' }))
    return this.get(t)
  }

  // --- Pospuestos (snoozed): avisos o cuotas ocultos hasta una fecha ---
  async activeSnoozes(t: Tenant) {
    const rows = await this.sb.q(
      this.sb.db.from('snoozes').select('*').eq('company_id', t.companyId).gt('until', new Date().toISOString()),
    )
    return M.snoozes(rows)
  }

  async snooze(t: Tenant, itemId: string, b: SnoozeBody) {
    const until = b.until ?? this.clock.at(b.days ?? 1, 0, 0)
    await this.sb.q(this.sb.db.from('snoozes').upsert({ company_id: t.companyId, item_id: itemId, until }, { onConflict: 'company_id,item_id' }))
    return { [itemId]: until }
  }

  async unsnooze(t: Tenant, itemId: string) {
    await this.sb.q(this.sb.db.from('snoozes').delete().eq('company_id', t.companyId).eq('item_id', itemId))
  }
}

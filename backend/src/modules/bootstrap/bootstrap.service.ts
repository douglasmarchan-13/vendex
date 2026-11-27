import { Injectable } from '@nestjs/common'
import { LEGACY_COMPANY_ID } from '../../common/auth/auth.types.js'
import type { Tenant } from '../../common/auth/tenant.js'
import { ApiError } from '../../common/errors/api-error.js'
import * as M from '../../common/utils/mappers.js'
import { AppConfig } from '../../core/app-config.js'
import { SupabaseService } from '../../core/supabase.service.js'
import { type Catalogs, CatalogsService } from '../catalogs/catalogs.service.js'

/** Misma forma que seed() en frontend/src/data/mock.js */
export interface AppState {
  contacts: M.Contact[]
  deals: M.Deal[]
  payments: M.Payment[]
  snoozed: Record<string, string>
  tasks: M.Task[]
  alerts: M.Alert[]
  strategy: M.Strategy[]
  goalUSD: number
  rates: M.Rates
  plan: Partial<M.Plan>
  /** Vendedor al que se limitó la vista (el propio para un vendedor; el de ?vendedor_id para el gerente) */
  sellerFilter: string | null
}

@Injectable()
export class BootstrapService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly config: AppConfig,
    private readonly catalogs: CatalogsService,
  ) {}

  /**
   * Estado de la app para la empresa de la sesión. Con `t.sellerId` (vendedor, o gerente que filtra)
   * solo trae los contactos de ese vendedor y lo que cuelga de ellos: tratos, cuotas, tareas y avisos.
   * Meta, estrategia y tipo de cambio son de la empresa.
   */
  async loadState(t: Tenant): Promise<AppState> {
    const { db, q } = this.sb
    const cid = t.companyId
    const sid = t.sellerId
    const nowIso = new Date().toISOString()

    let contacts = db.from('contacts').select('*, activities(*)').eq('company_id', cid).order('created_at', { ascending: false })
    let deals = db.from('deals').select(sid ? '*, contacts!inner(owner_id)' : '*').eq('company_id', cid).order('created_at', { ascending: false })
    let payments = db.from('payments').select(sid ? '*, contacts!inner(owner_id)' : '*').eq('company_id', cid).order('due_at')
    let tasks = db.from('tasks').select('*').eq('company_id', cid).order('at')
    let alerts = db.from('alerts').select(sid ? '*, contacts!inner(owner_id)' : '*').eq('company_id', cid).order('created_at')
    if (sid) {
      contacts = contacts.eq('owner_id', sid)
      deals = deals.eq('contacts.owner_id', sid)
      payments = payments.eq('contacts.owner_id', sid)
      tasks = tasks.eq('seller_id', sid)
      alerts = alerts.eq('contacts.owner_id', sid)
    }

    const [contactRows, dealRows, paymentRows, taskRows, alertRows, strategy, snoozes, settings, rates] = await Promise.all([
      q(contacts),
      q(deals),
      q(payments),
      q(tasks),
      q(alerts),
      q(db.from('strategy_cards').select('*').eq('company_id', cid).order('position')),
      q(db.from('snoozes').select('*').eq('company_id', cid).gt('until', nowIso)),
      q(db.from('company_settings').select('*').eq('company_id', cid).maybeSingle()),
      q(db.from('company_currency_rates').select('code, rate_per_usd').eq('company_id', cid)),
    ])
    const s = settings ? M.settings(settings) : { goalUSD: 0, plan: {} }

    return {
      contacts: contactRows.map(M.contact),
      deals: (dealRows as unknown as M.DealRow[]).map(M.deal),
      payments: (paymentRows as unknown as M.PaymentRow[]).map(M.payment),
      snoozed: M.snoozes(snoozes),
      tasks: taskRows.map(M.task),
      alerts: (alertRows as unknown as M.AlertRow[]).map(M.alert),
      strategy: strategy.map(M.strategy),
      goalUSD: s.goalUSD,
      rates: M.rates(rates),
      plan: s.plan,
      sellerFilter: sid,
    }
  }

  async bootstrap(t: Tenant): Promise<AppState & { catalogs: Catalogs }> {
    const [state, catalogs] = await Promise.all([this.loadState(t), this.catalogs.load(t)])
    return { ...state, catalogs }
  }

  /** Recarga la semilla de demostración. Solo la empresa demo (legado) y solo si ALLOW_DEMO_RESET=true */
  async reset(t: Tenant): Promise<AppState> {
    if (!this.config.allowDemoReset) throw new ApiError(403, 'El reinicio de datos está deshabilitado (ALLOW_DEMO_RESET=false)')
    if (t.companyId !== LEGACY_COMPANY_ID) throw new ApiError(403, 'Solo la empresa de demostración se puede reiniciar')
    await this.sb.rpc('seed_demo_data', {})
    return this.loadState(t)
  }
}

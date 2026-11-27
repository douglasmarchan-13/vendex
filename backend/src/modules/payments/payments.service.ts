import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import { ApiError } from '../../common/errors/api-error.js'
import * as M from '../../common/utils/mappers.js'
import { AccessService } from '../../core/access.service.js'
import { ClockService } from '../../core/clock.service.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { PaymentListQuery, PaymentPatch, PayStatus, RegisterBody, SummaryQuery } from './payments.schemas.js'

export interface PortfolioSummary {
  pendingUSD: number
  overdueUSD: number
  dueThisWeekUSD: number
  collectedUSD: number
  /** Deuda vencida por antigüedad: a1 ≤ 15 días, a2 ≤ 30, a3 > 30 */
  aging: { a1: number; a2: number; a3: number }
  counts: Partial<Record<PayStatus, number>>
}

const round2 = (x: number) => Math.round(x * 100) / 100

@Injectable()
export class PaymentsService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly clock: ClockService,
    private readonly access: AccessService,
  ) {}

  /** Mismo criterio que payStatus() de frontend/src/lib/cobranza.js */
  status(p: Pick<M.PaymentRow, 'paid_at' | 'due_at'>): PayStatus {
    if (p.paid_at) return 'pagado'
    const d = this.clock.diffDays(p.due_at)
    if (d < 0) return 'vencido'
    if (d === 0) return 'hoy'
    if (d <= 7) return 'semana'
    return 'proximo'
  }

  private async rows(t: Tenant, f: PaymentListQuery): Promise<M.PaymentRow[]> {
    // La cuota es del vendedor dueño del contacto
    const join = f.country || t.sellerId ? ', contacts!inner(country_code, owner_id)' : ''
    let query = this.sb.db
      .from('payments')
      .select(`*${join}`)
      .eq('company_id', t.companyId)
      .order('due_at')
    if (t.sellerId) query = query.eq('contacts.owner_id', t.sellerId)
    if (f.dealId) query = query.eq('deal_id', f.dealId)
    if (f.contactId) query = query.eq('contact_id', f.contactId)
    if (f.country) query = query.eq('contacts.country_code', f.country)
    if (f.status === 'pagado') query = query.not('paid_at', 'is', null)
    else if (f.status) query = query.is('paid_at', null)
    let rows = (await this.sb.q(query)) as unknown as M.PaymentRow[]
    if (f.status && f.status !== 'pendiente' && f.status !== 'pagado') rows = rows.filter((p) => this.status(p) === f.status)
    return rows
  }

  /** Cuotas con su estado calculado */
  async list(t: Tenant, f: PaymentListQuery) {
    return (await this.rows(t, f)).map((p) => ({ ...M.payment(p), status: this.status(p) }))
  }

  /** Cartera por cobrar en USD */
  async summary(t: Tenant, f: SummaryQuery): Promise<PortfolioSummary> {
    const [rows, currencies] = await Promise.all([
      this.rows(t, f),
      this.sb.q(this.sb.db.from('company_currency_rates').select('code, rate_per_usd').eq('company_id', t.companyId)),
    ])
    const rates = M.rates(currencies)
    const usd = (p: M.PaymentRow) => Number(p.amount) / (rates[p.currency] || 1)
    const out: PortfolioSummary = { pendingUSD: 0, overdueUSD: 0, dueThisWeekUSD: 0, collectedUSD: 0, aging: { a1: 0, a2: 0, a3: 0 }, counts: {} }
    for (const p of rows) {
      const s = this.status(p)
      out.counts[s] = (out.counts[s] ?? 0) + 1
      if (s === 'pagado') {
        out.collectedUSD += usd(p)
        continue
      }
      out.pendingUSD += usd(p)
      if (s === 'hoy' || s === 'semana') out.dueThisWeekUSD += usd(p)
      if (s === 'vencido') {
        out.overdueUSD += usd(p)
        const late = -this.clock.diffDays(p.due_at)
        out.aging[late <= 15 ? 'a1' : late <= 30 ? 'a2' : 'a3'] += usd(p)
      }
    }
    out.pendingUSD = round2(out.pendingUSD)
    out.overdueUSD = round2(out.overdueUSD)
    out.dueThisWeekUSD = round2(out.dueThisWeekUSD)
    out.collectedUSD = round2(out.collectedUSD)
    out.aging = { a1: round2(out.aging.a1), a2: round2(out.aging.a2), a3: round2(out.aging.a3) }
    return out
  }

  /**
   * registerPayment(): pago total → la cuota queda pagada. Pago menor → abono parcial: la cuota baja su
   * saldo y se crea una fila "Abono · ..." pagada. Siempre deja constancia en la línea de tiempo.
   */
  async register(t: Tenant, pid: string, b: RegisterBody) {
    await this.access.payment(t, pid)
    const result = (await this.sb.rpc('register_payment', {
      p_payment_id: pid,
      p_amount: b.amount,
      p_method: b.method,
      p_paid_at: b.date,
      p_ref: b.ref,
      p_author: t.actorId,
    })) as { payment: M.PaymentRow; abono: M.PaymentRow | null }
    return {
      payment: M.payment(result.payment),
      abono: result.abono ? M.payment(result.abono) : null,
      full: !result.abono,
    }
  }

  /** Solo cuotas pendientes */
  async update(t: Tenant, pid: string, b: PaymentPatch) {
    const { db, q } = this.sb
    const cur = await this.access.payment(t, pid)
    if (cur.paid_at) throw new ApiError(409, 'No se puede editar una cuota ya pagada')
    const row = await q(db.from('payments').update({ label: b.label, amount: b.amount, due_at: b.dueAt }).eq('id', pid).select().single())
    return M.payment(row)
  }

  /** Revierte un pago registrado por error */
  async unpay(t: Tenant, pid: string) {
    await this.access.payment(t, pid)
    const row = await this.sb.q(this.sb.db.from('payments').update({ paid_at: null, method: null, ref: '' }).eq('id', pid).select().single())
    return M.payment(row)
  }

  async remove(t: Tenant, pid: string) {
    await this.access.payment(t, pid)
    await this.sb.q(this.sb.db.from('payments').delete().eq('id', pid))
  }
}

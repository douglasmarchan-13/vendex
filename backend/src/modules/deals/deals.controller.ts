import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentTenant, type Tenant, wholeCompany } from '../../common/auth/tenant.js'
import { id } from '../../common/validation/schemas.js'
import { ZBody, ZParam, ZQuery } from '../../common/validation/zod.js'
import {
  type CreateDealBody, createDealBody, type DealListQuery, dealListQuery, type DealPatch, dealPatch, type MoveBody, moveBody,
  type PaymentPlanBody, paymentPlanBody, type SnoozeDealBody, snoozeDealBody,
} from './deals.schemas.js'
import { DealsService } from './deals.service.js'

@ApiTags('deals')
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  /** Embudo */
  @Get()
  list(@CurrentTenant() t: Tenant, @ZQuery(dealListQuery) f: DealListQuery) {
    return this.deals.list(t, f)
  }

  /** Trato + sus cuotas */
  @Get(':id')
  get(@CurrentTenant() t: Tenant, @ZParam('id', id) did: string) {
    return this.deals.get(wholeCompany(t), did)
  }

  /** addDeal() → { deal, contact } */
  @Post()
  create(@CurrentTenant() t: Tenant, @ZBody(createDealBody) b: CreateDealBody) {
    return this.deals.create(wholeCompany(t), b)
  }

  /** Solo se actualizan los campos enviados. `nextDays` → próximo seguimiento a las 9:00 */
  @Patch(':id')
  update(@CurrentTenant() t: Tenant, @ZParam('id', id) did: string, @ZBody(dealPatch, { onlySent: true }) b: DealPatch) {
    return this.deals.update(wholeCompany(t), did, b)
  }

  /** moveDeal() → { deal, needsPlan } */
  @Post(':id/move')
  @HttpCode(200)
  move(@CurrentTenant() t: Tenant, @ZParam('id', id) did: string, @ZBody(moveBody) b: MoveBody) {
    return this.deals.move(wholeCompany(t), did, b.stage)
  }

  /** pauseDeal() */
  @Post(':id/pause')
  @HttpCode(200)
  pause(@CurrentTenant() t: Tenant, @ZParam('id', id) did: string) {
    return this.deals.pause(wholeCompany(t), did)
  }

  /** snoozeDeal() */
  @Post(':id/snooze')
  @HttpCode(200)
  snooze(@CurrentTenant() t: Tenant, @ZParam('id', id) did: string, @ZBody(snoozeDealBody) b: SnoozeDealBody) {
    return this.deals.snooze(wholeCompany(t), did, b.days)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentTenant() t: Tenant, @ZParam('id', id) did: string) {
    await this.deals.remove(wholeCompany(t), did)
  }

  @Get(':id/payments')
  payments(@CurrentTenant() t: Tenant, @ZParam('id', id) did: string) {
    return this.deals.payments(wholeCompany(t), did)
  }

  /** createPlan() */
  @Post(':id/payment-plan')
  createPlan(@CurrentTenant() t: Tenant, @ZParam('id', id) did: string, @ZBody(paymentPlanBody) b: PaymentPlanBody) {
    return this.deals.createPlan(wholeCompany(t), did, b)
  }
}

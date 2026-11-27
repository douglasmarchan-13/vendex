import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentTenant, type Tenant, wholeCompany } from '../../common/auth/tenant.js'
import { id } from '../../common/validation/schemas.js'
import { ZBody, ZParam, ZQuery } from '../../common/validation/zod.js'
import {
  type PaymentListQuery, paymentListQuery, type PaymentPatch, paymentPatch, type RegisterBody, registerBody,
  type SummaryQuery, summaryQuery,
} from './payments.schemas.js'
import { PaymentsService } from './payments.service.js'

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Cuotas con `status`: vencido, hoy, semana, proximo, pagado */
  @Get()
  list(@CurrentTenant() t: Tenant, @ZQuery(paymentListQuery) f: PaymentListQuery) {
    return this.payments.list(t, f)
  }

  /** Cartera: pendiente, vencido, por vencer, cobrado y antigüedad (USD) */
  @Get('summary')
  summary(@CurrentTenant() t: Tenant, @ZQuery(summaryQuery) f: SummaryQuery) {
    return this.payments.summary(t, f)
  }

  /** registerPayment() → { payment, abono, full } */
  @Post(':id/register')
  @HttpCode(200)
  register(@CurrentTenant() t: Tenant, @ZParam('id', id) pid: string, @ZBody(registerBody) b: RegisterBody) {
    return this.payments.register(wholeCompany(t), pid, b)
  }

  /** Editar una cuota pendiente */
  @Patch(':id')
  update(@CurrentTenant() t: Tenant, @ZParam('id', id) pid: string, @ZBody(paymentPatch) b: PaymentPatch) {
    return this.payments.update(wholeCompany(t), pid, b)
  }

  /** Revertir un pago */
  @Post(':id/unpay')
  @HttpCode(200)
  unpay(@CurrentTenant() t: Tenant, @ZParam('id', id) pid: string) {
    return this.payments.unpay(wholeCompany(t), pid)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentTenant() t: Tenant, @ZParam('id', id) pid: string) {
    await this.payments.remove(wholeCompany(t), pid)
  }
}

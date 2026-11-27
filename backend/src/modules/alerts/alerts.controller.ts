import { Controller, Delete, Get, HttpCode, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentTenant, type Tenant, wholeCompany } from '../../common/auth/tenant.js'
import { id } from '../../common/validation/schemas.js'
import { ZBody, ZParam, ZQuery } from '../../common/validation/zod.js'
import { type AlertBody, alertBody, type AlertQuery, alertQuery } from './alerts.schemas.js'
import { AlertsService } from './alerts.service.js'

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentTenant() t: Tenant, @ZQuery(alertQuery) f: AlertQuery) {
    return this.alerts.list(t, f)
  }

  @Post()
  create(@CurrentTenant() t: Tenant, @ZBody(alertBody) b: AlertBody) {
    return this.alerts.create(wholeCompany(t), b)
  }

  /** dismissAlert() */
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentTenant() t: Tenant, @ZParam('id', id) aid: string) {
    await this.alerts.remove(wholeCompany(t), aid)
  }
}

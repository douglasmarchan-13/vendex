import { Controller, Delete, Get, HttpCode, Patch, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/auth/auth.decorators.js'
import { CurrentTenant, type Tenant } from '../../common/auth/tenant.js'
import { id } from '../../common/validation/schemas.js'
import { ZBody, ZParam } from '../../common/validation/zod.js'
import {
  type GoalBody, goalBody, type PlanBody, planBody, type RatesBody, ratesBody, type SnoozeBody, snoozeBody,
} from './settings.schemas.js'
import { SettingsService } from './settings.service.js'

/** Todos leen la configuración de su empresa; solo el gerente la cambia */
@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Meta, planificador, zona horaria y tipo de cambio */
  @Get()
  get(@CurrentTenant() t: Tenant) {
    return this.settings.get(t)
  }

  /** setGoal() */
  @Roles('gerente')
  @Put('goal')
  setGoal(@CurrentTenant() t: Tenant, @ZBody(goalBody) b: GoalBody) {
    return this.settings.setGoal(t, b.goalUSD)
  }

  /** setPlan() */
  @Roles('gerente')
  @Patch('plan')
  setPlan(@CurrentTenant() t: Tenant, @ZBody(planBody) b: PlanBody) {
    return this.settings.setPlan(t, b)
  }

  /** setRates(): unidades por 1 USD */
  @Roles('gerente')
  @Patch('rates')
  setRates(@CurrentTenant() t: Tenant, @ZBody(ratesBody) b: RatesBody) {
    return this.settings.setRates(t, b)
  }
}

@ApiTags('settings')
@Controller('snoozes')
export class SnoozesController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list(@CurrentTenant() t: Tenant) {
    return this.settings.activeSnoozes(t)
  }

  /** snooze(): { days } o { until } */
  @Put(':itemId')
  snooze(@CurrentTenant() t: Tenant, @ZParam('itemId', id) itemId: string, @ZBody(snoozeBody) b: SnoozeBody) {
    return this.settings.snooze(t, itemId, b)
  }

  @Delete(':itemId')
  @HttpCode(204)
  async unsnooze(@CurrentTenant() t: Tenant, @ZParam('itemId', id) itemId: string) {
    await this.settings.unsnooze(t, itemId)
  }
}

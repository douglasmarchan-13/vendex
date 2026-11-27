import { Controller, Delete, Get, HttpCode, Post, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/auth/auth.decorators.js'
import { CurrentTenant, type Tenant } from '../../common/auth/tenant.js'
import { id } from '../../common/validation/schemas.js'
import { ZBody, ZParam } from '../../common/validation/zod.js'
import { type CardBody, cardBody } from './strategy.schemas.js'
import { StrategyService } from './strategy.service.js'

@ApiTags('strategy')
@Controller('strategy')
export class StrategyController {
  constructor(private readonly strategy: StrategyService) {}

  @Get()
  list(@CurrentTenant() t: Tenant) {
    return this.strategy.list(t)
  }

  @Roles('gerente')
  @Post()
  create(@CurrentTenant() t: Tenant, @ZBody(cardBody) b: CardBody) {
    return this.strategy.create(t, b)
  }

  /** saveStrategy() */
  @Roles('gerente')
  @Put(':id')
  save(@CurrentTenant() t: Tenant, @ZParam('id', id) sid: string, @ZBody(cardBody) b: CardBody) {
    return this.strategy.save(t, sid, b)
  }

  /** removeStrategy() */
  @Roles('gerente')
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentTenant() t: Tenant, @ZParam('id', id) sid: string) {
    await this.strategy.remove(t, sid)
  }
}

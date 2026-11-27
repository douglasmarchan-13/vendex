import { Controller, Get, HttpCode, Post } from '@nestjs/common'
import { ApiQuery, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/auth/auth.decorators.js'
import { CurrentTenant, type Tenant, wholeCompany } from '../../common/auth/tenant.js'
import { BootstrapService } from './bootstrap.service.js'

@ApiTags('bootstrap')
@Controller()
export class BootstrapController {
  constructor(private readonly service: BootstrapService) {}

  /**
   * Estado completo con la forma de seed() + `catalogs`.
   * Gerente: toda la empresa, o un vendedor con `?vendedor_id=`. Vendedor: siempre solo lo suyo.
   */
  @Get('bootstrap')
  @ApiQuery({ name: 'vendedor_id', required: false, description: 'Gerente: limita los datos a un vendedor de su empresa' })
  bootstrap(@CurrentTenant() t: Tenant) {
    return this.service.bootstrap(t)
  }

  /** reset(): vuelve a los datos de demostración (solo empresa demo). Deshabilitado con ALLOW_DEMO_RESET=false */
  @Roles('gerente')
  @Post('admin/reset')
  @HttpCode(200)
  reset(@CurrentTenant() t: Tenant) {
    return this.service.reset(wholeCompany(t))
  }
}

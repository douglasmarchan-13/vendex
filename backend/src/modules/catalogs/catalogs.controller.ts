import { Controller, Delete, Get, HttpCode, Patch, Post, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/auth/auth.decorators.js'
import { CurrentTenant, type Tenant } from '../../common/auth/tenant.js'
import { country, id } from '../../common/validation/schemas.js'
import { ZBody, ZParam } from '../../common/validation/zod.js'
import { CatalogsService } from './catalogs.service.js'
import { type PayMethodsBody, payMethodsBody, type ProductBody, productBody, type ProductPatch, productPatch } from './catalogs.schemas.js'

/** Todos leen los catálogos de su empresa; solo el gerente edita productos y medios de pago */
@ApiTags('catalogs')
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogs: CatalogsService) {}

  /** Países, vendedores, canales, etapas, productos, medios de pago, monedas y reparto de meta */
  @Get()
  load(@CurrentTenant() t: Tenant) {
    return this.catalogs.load(t)
  }

  @Roles('gerente')
  @Post('products')
  createProduct(@CurrentTenant() t: Tenant, @ZBody(productBody) b: ProductBody) {
    return this.catalogs.createProduct(t, b)
  }

  @Roles('gerente')
  @Patch('products/:id')
  updateProduct(@CurrentTenant() t: Tenant, @ZParam('id', id) pid: string, @ZBody(productPatch) b: ProductPatch) {
    return this.catalogs.updateProduct(t, pid, b)
  }

  @Roles('gerente')
  @Delete('products/:id')
  @HttpCode(204)
  async deleteProduct(@CurrentTenant() t: Tenant, @ZParam('id', id) pid: string) {
    await this.catalogs.deactivateProduct(t, pid)
  }

  /** Reemplaza los medios de pago de un país */
  @Roles('gerente')
  @Put('pay-methods/:country')
  setPayMethods(@CurrentTenant() t: Tenant, @ZParam('country', country) code: string, @ZBody(payMethodsBody) b: PayMethodsBody) {
    return this.catalogs.setPayMethods(t, code, b)
  }
}

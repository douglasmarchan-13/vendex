import { Controller, Delete, Get, HttpCode, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentTenant, type Tenant } from '../../common/auth/tenant.js'
import { ZBody, ZParam } from '../../common/validation/zod.js'
import { type TemplateBody, templateBody, templateKey } from './templates.schemas.js'
import { TemplatesService } from './templates.service.js'

/** Plantillas de WhatsApp del vendedor de la sesión */
@ApiTags('templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(@CurrentTenant() t: Tenant) {
    return this.templates.list(t)
  }

  @Put(':key')
  save(@CurrentTenant() t: Tenant, @ZParam('key', templateKey) key: string, @ZBody(templateBody) b: TemplateBody) {
    return this.templates.save(t, key, b)
  }

  @Delete(':key')
  @HttpCode(204)
  async remove(@CurrentTenant() t: Tenant, @ZParam('key', templateKey) key: string) {
    await this.templates.remove(t, key)
  }
}

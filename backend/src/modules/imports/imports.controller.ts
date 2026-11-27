import { Body, Controller, Get, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { CurrentTenant, type Tenant, wholeCompany } from '../../common/auth/tenant.js'
import { ZParam } from '../../common/validation/zod.js'
import { z } from 'zod'
import { parseCommitOptions } from './imports.schemas.js'
import { ImportsService, type UploadedXlsx } from './imports.service.js'

const upload = FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } })
const fileBody = {
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
      options: { type: 'string', description: 'JSON { exclude: string[], sold: string[] } (solo al importar)' },
    },
  },
}

/** Importación del Excel de clientes. Gerentes y vendedores; lo importado queda a nombre de quien importa. */
@ApiTags('imports')
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get()
  list(@CurrentTenant() t: Tenant) {
    return this.imports.list(wholeCompany(t))
  }

  /** Lee el Excel y devuelve qué se importaría, sin guardar nada */
  @Post('preview')
  @HttpCode(200)
  @UseInterceptors(upload)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  preview(@CurrentTenant() t: Tenant, @UploadedFile() file: UploadedXlsx | undefined) {
    return this.imports.preview(wholeCompany(t), file)
  }

  /** Importa el Excel (mismo archivo de la vista previa + decisiones en "options") */
  @Post()
  @UseInterceptors(upload)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  commit(@CurrentTenant() t: Tenant, @UploadedFile() file: UploadedXlsx | undefined, @Body('options') options: unknown) {
    return this.imports.commit(wholeCompany(t), file, parseCommitOptions(options))
  }

  /** Excel de deudas por cobrar: devuelve las ventas y cuotas que se crearían, sin guardar nada */
  @Post('debts/preview')
  @HttpCode(200)
  @UseInterceptors(upload)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  previewDebts(@CurrentTenant() t: Tenant, @UploadedFile() file: UploadedXlsx | undefined) {
    return this.imports.previewDebts(wholeCompany(t), file)
  }

  /** Importa las deudas: una venta cerrada por fila con sus cuotas en Cobranza ("options": { exclude }) */
  @Post('debts')
  @UseInterceptors(upload)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  commitDebts(@CurrentTenant() t: Tenant, @UploadedFile() file: UploadedXlsx | undefined, @Body('options') options: unknown) {
    return this.imports.commitDebts(wholeCompany(t), file, parseCommitOptions(options))
  }

  /** Deshace una importación: borra los contactos, tratos, cuotas y notas que creó */
  @Post(':id/undo')
  @HttpCode(200)
  undo(@CurrentTenant() t: Tenant, @ZParam('id', z.uuid()) id: string) {
    return this.imports.undo(wholeCompany(t), id)
  }
}

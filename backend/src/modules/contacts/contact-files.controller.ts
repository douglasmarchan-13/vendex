import { Body, Controller, Delete, Get, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CurrentTenant, type Tenant, wholeCompany } from '../../common/auth/tenant.js'
import { id } from '../../common/validation/schemas.js'
import { parse, ZParam } from '../../common/validation/zod.js'
import { ContactFilesService, MAX_PDF_BYTES, type UploadedPdf } from './contact-files.service.js'
import { contactFileBody } from './contacts.schemas.js'

const upload = FileInterceptor('file', { limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 5 } })

/** Cotizaciones (PDF) de la ficha del cliente. El vendedor solo las de sus contactos. */
@ApiTags('contacts')
@Controller('contacts/:id/files')
export class ContactFilesController {
  constructor(private readonly files: ContactFilesService) {}

  @Get()
  list(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string) {
    return this.files.list(wholeCompany(t), cid)
  }

  /** Sube un PDF → { file, activity } (la actividad "Cotización enviada" queda en el historial) */
  @Post()
  @UseInterceptors(upload)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        dealId: { type: 'string', description: 'Trato al que corresponde (opcional)' },
        kind: { type: 'string', enum: ['cotizacion', 'otro'] },
        note: { type: 'string' },
      },
    },
  })
  create(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string, @UploadedFile() file: UploadedPdf | undefined, @Body() body: unknown) {
    return this.files.upload(wholeCompany(t), cid, file, parse(contactFileBody, body))
  }

  /** Enlace firmado (vence en 5 minutos) para ver el PDF */
  @Get(':fileId/url')
  url(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string, @ZParam('fileId', z.uuid()) fileId: string) {
    return this.files.url(wholeCompany(t), cid, fileId)
  }

  @Delete(':fileId')
  @HttpCode(204)
  async remove(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string, @ZParam('fileId', z.uuid()) fileId: string) {
    await this.files.remove(wholeCompany(t), cid, fileId)
  }
}

import { Controller, Delete, Get, HttpCode, Patch, Post, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentTenant, type Tenant, wholeCompany } from '../../common/auth/tenant.js'
import { id } from '../../common/validation/schemas.js'
import { ZBody, ZParam, ZQuery } from '../../common/validation/zod.js'
import {
  type ActivityBody, activityBody, type ContactListQuery, contactListQuery, type ContactPatch, contactPatch,
  type CreateContactBody, createContactBody, type TempBody, tempBody,
} from './contacts.schemas.js'
import { ContactsService } from './contacts.service.js'

/** Siempre dentro de la empresa de la sesión; el vendedor solo ve y edita sus contactos */
@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  /** Lista / búsqueda: ?country=PE&owner=andres&temp=caliente&q=molino&timeline=true (&vendedor_id= para el gerente) */
  @Get()
  list(@CurrentTenant() t: Tenant, @ZQuery(contactListQuery) f: ContactListQuery) {
    return this.contacts.list(t, f)
  }

  /** Contacto + timeline + tratos + cuotas */
  @Get(':id')
  get(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string) {
    return this.contacts.get(wholeCompany(t), cid)
  }

  @Post()
  create(@CurrentTenant() t: Tenant, @ZBody(createContactBody) b: CreateContactBody) {
    return this.contacts.create(wholeCompany(t), b)
  }

  /** Solo se actualizan los campos enviados */
  @Patch(':id')
  update(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string, @ZBody(contactPatch, { onlySent: true }) b: ContactPatch) {
    return this.contacts.update(wholeCompany(t), cid, b)
  }

  /** setTemp(): también actualiza los tratos abiertos */
  @Put(':id/temp')
  setTemp(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string, @ZBody(tempBody) b: TempBody) {
    return this.contacts.setTemp(wholeCompany(t), cid, b.temp)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string) {
    await this.contacts.remove(wholeCompany(t), cid)
  }

  // --- Línea de tiempo ---
  @Get(':id/activities')
  activities(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string) {
    return this.contacts.activities(wholeCompany(t), cid)
  }

  /** logActivity() */
  @Post(':id/activities')
  addActivity(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string, @ZBody(activityBody) b: ActivityBody) {
    return this.contacts.addActivity(wholeCompany(t), cid, b)
  }

  @Delete(':id/activities/:activityId')
  @HttpCode(204)
  async removeActivity(@CurrentTenant() t: Tenant, @ZParam('id', id) cid: string, @ZParam('activityId', id) activityId: string) {
    await this.contacts.removeActivity(wholeCompany(t), cid, activityId)
  }
}

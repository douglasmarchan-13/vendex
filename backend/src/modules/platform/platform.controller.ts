import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Auth, Roles } from '../../common/auth/auth.decorators.js'
import type { AuthContext } from '../../common/auth/auth.types.js'
import { ZBody, ZParam } from '../../common/validation/zod.js'
import {
  type CompanyPatch,
  companyPatch,
  type CreateCompanyBody,
  createCompanyBody,
  type ManagerInviteBody,
  managerInviteBody,
} from './platform.schemas.js'
import { PlatformService } from './platform.service.js'

const uuid = z.uuid({ error: 'Id no válido' })

/** Solo super_admin: alta y administración de empresas (separado de la operación de ventas) */
@ApiTags('platform')
@Roles('super_admin')
@Controller('platform/companies')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  /** Empresas con usuarios activos, invitaciones pendientes y gerentes */
  @Get()
  list() {
    return this.platform.list()
  }

  /** Crea la empresa y su gerente: por invitación → { company, invitation, mail } · alta directa → { company, member } */
  @Post()
  @HttpCode(201)
  create(@ZBody(createCompanyBody) b: CreateCompanyBody, @Auth() auth: AuthContext) {
    return this.platform.create(b, auth)
  }

  /** Plan, cupos, estado (suspender / reactivar) y datos de la empresa */
  @Patch(':id')
  update(@ZParam('id', uuid) id: string, @ZBody(companyPatch, { onlySent: true }) b: CompanyPatch) {
    return this.platform.update(id, b)
  }

  @Get(':id/invitations')
  invitations(@ZParam('id', uuid) id: string) {
    return this.platform.listInvitations(id)
  }

  /** Agrega un gerente a una empresa existente, por invitación o alta directa según el método de la empresa */
  @Post(':id/invitations')
  @HttpCode(201)
  inviteManager(@ZParam('id', uuid) id: string, @ZBody(managerInviteBody) b: ManagerInviteBody, @Auth() auth: AuthContext) {
    return this.platform.inviteManager(id, b, auth)
  }

  /** Nuevo enlace para una invitación pendiente o vencida */
  @Post(':id/invitations/:invitationId/resend')
  @HttpCode(200)
  resend(@ZParam('id', uuid) id: string, @ZParam('invitationId', uuid) inv: string, @Auth() auth: AuthContext) {
    return this.platform.resendInvitation(id, inv, auth)
  }

  @Delete(':id/invitations/:invitationId')
  revoke(@ZParam('id', uuid) id: string, @ZParam('invitationId', uuid) inv: string) {
    return this.platform.revokeInvitation(id, inv)
  }
}

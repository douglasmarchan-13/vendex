import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Auth, Roles } from '../../common/auth/auth.decorators.js'
import type { AuthContext } from '../../common/auth/auth.types.js'
import { ApiError } from '../../common/errors/api-error.js'
import { ZBody, ZParam } from '../../common/validation/zod.js'
import { SupabaseService } from '../../core/supabase.service.js'
import { type DirectMemberBody, directMemberBody, type InviteBody, inviteBody } from './invitations.schemas.js'
import { InvitationsService } from './invitations.service.js'

const uuid = z.uuid({ error: 'Id no válido' })
const memberPatch = z.object({ status: z.enum(['activo', 'inactivo']) })

/** Equipo de la empresa del gerente: usuarios e invitaciones (siempre de SU company_id) */
@ApiTags('team')
@Roles('gerente')
@Controller('team')
export class TeamController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly sb: SupabaseService,
  ) {}

  private company(auth: AuthContext) {
    if (!auth.companyId) throw new ApiError(403, 'No perteneces a una empresa')
    return auth.companyId
  }

  /**
   * Usuarios de la empresa + vendedores que aún no tienen usuario (se les puede invitar con
   * `sellerId` para que su cuenta quede enlazada a sus clientes actuales) + cupos.
   */
  @Get('members')
  async members(@Auth() auth: AuthContext) {
    const cid = this.company(auth)
    const { db, q, one } = this.sb
    const [users, unlinked, company, used] = await Promise.all([
      q(
        db
          .from('users')
          .select('id, email, name, role, status, must_change_password, last_login_at, created_at, sellers(id, country_code)')
          .eq('company_id', cid)
          .order('name'),
      ),
      q(db.from('sellers').select('id, name, country_code, email').eq('company_id', cid).is('user_id', null).order('name')),
      one(db.from('companies').select('seats, user_onboarding').eq('id', cid).maybeSingle(), 'Empresa'),
      this.invitations.seatsUsed(cid),
    ])
    return {
      seats: { total: company.seats, used },
      /** Método de alta que fijó el super admin: 'invitacion' (POST /team/invitations) o 'directa' (POST /team/members) */
      onboarding: company.user_onboarding,
      members: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        sellerId: u.sellers?.id ?? null,
        country: u.sellers?.country_code ?? null,
        mustChangePassword: u.must_change_password,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
      })),
      unlinkedSellers: unlinked.map((s) => ({ id: s.id, name: s.name, country: s.country_code, email: s.email })),
    }
  }

  /**
   * Desactivar libera el cupo y corta su acceso de inmediato (sus clientes y su historial se conservan).
   * Reactivar vuelve a ocupar un cupo.
   */
  @Patch('members/:id')
  async setMemberStatus(@Auth() auth: AuthContext, @ZParam('id', uuid) uid: string, @ZBody(memberPatch) b: z.output<typeof memberPatch>) {
    const cid = this.company(auth)
    if (uid === auth.userId) throw new ApiError(400, 'No puedes desactivar tu propio usuario')
    const { db, q, one } = this.sb
    const user = await one(db.from('users').select('id, status').eq('id', uid).eq('company_id', cid).maybeSingle(), 'Usuario')
    if (b.status === 'activo' && user.status !== 'activo') {
      const company = await one(db.from('companies').select('seats').eq('id', cid).maybeSingle(), 'Empresa')
      if ((await this.invitations.seatsUsed(cid)) >= company.seats) throw new ApiError(409, 'No quedan cupos para reactivarlo')
    }
    const row = await q(db.from('users').update({ status: b.status }).eq('id', uid).eq('company_id', cid).select('id, status').single())
    return { id: row.id, status: row.status }
  }

  /**
   * Alta directa con clave temporal (sin correo) → { member }. El usuario queda activo y debe
   * cambiar la clave en su primer inicio de sesión. La clave no se devuelve.
   */
  @Post('members')
  @HttpCode(201)
  async createMember(@Auth() auth: AuthContext, @ZBody(directMemberBody) b: DirectMemberBody) {
    return { member: await this.invitations.createDirect(this.company(auth), b, auth) }
  }

  @Get('invitations')
  list(@Auth() auth: AuthContext) {
    return this.invitations.list(this.company(auth))
  }

  /** Invita a un gerente o vendedor a la misma empresa → { invitation, mail: 'sent' | 'failed' } */
  @Post('invitations')
  @HttpCode(201)
  invite(@Auth() auth: AuthContext, @ZBody(inviteBody) b: InviteBody) {
    return this.invitations.create(this.company(auth), b, auth)
  }

  @Post('invitations/:id/resend')
  @HttpCode(200)
  resend(@Auth() auth: AuthContext, @ZParam('id', uuid) id: string) {
    return this.invitations.resend(this.company(auth), id, auth)
  }

  @Delete('invitations/:id')
  revoke(@Auth() auth: AuthContext, @ZParam('id', uuid) id: string) {
    return this.invitations.revoke(this.company(auth), id)
  }
}

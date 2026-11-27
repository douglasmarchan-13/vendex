import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { Public } from '../../common/auth/auth.decorators.js'
import { RateLimiter } from '../../common/auth/rate-limiter.js'
import { ZBody, ZParam } from '../../common/validation/zod.js'
import { linkToken } from '../auth/auth.schemas.js'
import { type AcceptBody, acceptBody } from './invitations.schemas.js'
import { InvitationsService } from './invitations.service.js'

/** Rutas públicas del enlace /registro?token=... */
@ApiTags('invitations')
@Public()
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly limiter: RateLimiter,
  ) {}

  /** Valida el token → { email, role, name, companyName, expiresAt } (404 / 410 si no sirve) */
  @Get(':token')
  get(@ZParam('token', linkToken) token: string, @Req() req: Request) {
    this.limiter.hit(`invite:${req.ip}`, 30, 15 * 60_000)
    return this.invitations.getByToken(token)
  }

  /** Crea la cuenta con nombre y contraseña → { token, expiresAt, user } (sesión iniciada) */
  @Post(':token/accept')
  @HttpCode(201)
  accept(@ZParam('token', linkToken) token: string, @ZBody(acceptBody) b: AcceptBody, @Req() req: Request) {
    this.limiter.hit(`invite:${req.ip}`, 30, 15 * 60_000)
    return this.invitations.accept(token, b.name, b.password)
  }
}

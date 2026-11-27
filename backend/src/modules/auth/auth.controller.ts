import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { AllowPendingPassword, AnyRole, Auth, Public } from '../../common/auth/auth.decorators.js'
import type { AuthContext } from '../../common/auth/auth.types.js'
import { RateLimiter } from '../../common/auth/rate-limiter.js'
import { SessionService } from '../../common/auth/session.service.js'
import { ApiError } from '../../common/errors/api-error.js'
import { ZBody, ZParam } from '../../common/validation/zod.js'
import {
  type ChangePasswordBody,
  changePasswordBody,
  type ForgotBody,
  forgotBody,
  linkToken,
  type LoginBody,
  loginBody,
  type ResetBody,
  resetBody,
} from './auth.schemas.js'
import { AuthService } from './auth.service.js'

const MINUTE = 60_000

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly session: SessionService,
    private readonly limiter: RateLimiter,
  ) {}

  /** Correo + contraseña → { token, expiresAt, user }. El frontend redirige según user.role. */
  @Public()
  @Post('login')
  @HttpCode(200)
  login(@ZBody(loginBody) b: LoginBody, @Req() req: Request) {
    this.limiter.hit(`login:${req.ip}`, 20, 5 * MINUTE)
    return this.auth.login(b.email, b.password)
  }

  /** Usuario de la sesión actual */
  @AnyRole()
  @AllowPendingPassword()
  @Get('me')
  me(@Auth() auth: AuthContext) {
    if (auth.demo) throw new ApiError(401, 'Inicia sesión para continuar')
    return this.session.publicUser(auth)
  }

  /**
   * Cambia la clave con la sesión iniciada → { token, expiresAt, user } (sesión nueva: la anterior deja de valer).
   * Es la única ruta, además de /auth/me, que puede usar una cuenta con clave temporal.
   */
  @AnyRole()
  @AllowPendingPassword()
  @Post('change-password')
  @HttpCode(200)
  changePassword(@Auth() auth: AuthContext, @ZBody(changePasswordBody) b: ChangePasswordBody) {
    if (auth.demo || !auth.userId) throw new ApiError(401, 'Inicia sesión para continuar')
    this.limiter.hit(`change-password:${auth.userId}`, 10, 15 * MINUTE)
    return this.auth.changePassword(auth.userId, b.currentPassword, b.newPassword)
  }

  /** Envía el enlace de recuperación (vence en 1 hora). Siempre responde { ok: true }. */
  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  forgot(@ZBody(forgotBody) b: ForgotBody, @Req() req: Request) {
    this.limiter.hit(`forgot:${req.ip}`, 5, 15 * MINUTE)
    return this.auth.forgot(b.email, req.ip)
  }

  /** ¿El enlace de recuperación sigue vigente? → { email, expiresAt } */
  @Public()
  @Get('reset-password/:token')
  checkReset(@ZParam('token', linkToken) token: string, @Req() req: Request) {
    this.limiter.hit(`reset:${req.ip}`, 30, 15 * MINUTE)
    return this.auth.checkReset(token)
  }

  /** Nueva contraseña con el token del correo */
  @Public()
  @Post('reset-password')
  @HttpCode(200)
  reset(@ZBody(resetBody) b: ResetBody, @Req() req: Request) {
    this.limiter.hit(`reset:${req.ip}`, 30, 15 * MINUTE)
    return this.auth.reset(b.token, b.password)
  }
}

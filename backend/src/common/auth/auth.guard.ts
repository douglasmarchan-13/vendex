import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AppConfig } from '../../core/app-config.js'
import { ApiError } from '../errors/api-error.js'
import { ALLOW_PENDING_PASSWORD, IS_PUBLIC, ROLES_KEY } from './auth.decorators.js'
import { type AuthContext, type AuthedRequest, LEGACY_COMPANY_ID, type Role, SALES_ROLES } from './auth.types.js'
import { SessionService } from './session.service.js'

export type { AuthedRequest } from './auth.types.js'

/**
 * Autenticación + control de acceso por rol (guard global).
 *
 * · Con `Authorization: Bearer <jwt>` → valida el JWT y carga el usuario desde la base
 *   (activo, empresa no suspendida, clave no cambiada después de emitir el token).
 * · Sin token:
 *     REQUIRE_AUTH=true  → 401.
 *     REQUIRE_AUTH=false → modo demo: gerente de la empresa legado; vendedor de `X-Seller-Id`
 *                          o DEFAULT_SELLER_ID. Las rutas de super_admin siempre exigen sesión.
 * · Roles: los de @Roles() o, por defecto, gerente y vendedor.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfig,
    private readonly session: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true
    const req = ctx.switchToHttp().getRequest<AuthedRequest>()

    const header = req.get('authorization') || ''
    const token = /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : ''

    let auth: AuthContext
    if (token) auth = await this.session.verify(token)
    else if (!this.config.requireAuth) auth = this.demo(req)
    else throw new ApiError(401, 'Inicia sesión para continuar')

    const allowed = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets) ?? SALES_ROLES
    if (!allowed.includes(auth.role)) {
      if (auth.demo) throw new ApiError(401, 'Inicia sesión para usar esta función')
      throw new ApiError(403, 'No tienes permiso para esta acción')
    }

    if (auth.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD, targets)) {
      throw new ApiError(403, 'Debes cambiar tu contraseña temporal antes de continuar', { code: 'password_change_required' })
    }

    req.auth = auth
    req.sellerId = auth.sellerId ?? ''
    return true
  }

  private demo(req: AuthedRequest): AuthContext {
    return {
      userId: null,
      email: null,
      name: 'Demo',
      role: 'gerente',
      companyId: LEGACY_COMPANY_ID,
      companyName: null,
      sellerId: req.get('x-seller-id') || this.config.defaultSellerId,
      demo: true,
      passwordVersion: 0,
      mustChangePassword: false,
    }
  }
}

import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common'
import type { AuthContext, AuthedRequest, Role } from './auth.types.js'
import { ROLES } from './auth.types.js'

export const IS_PUBLIC = 'vx:isPublic'
export const ROLES_KEY = 'vx:roles'

/** Ruta sin autenticación (p. ej. /api/health, login, aceptar invitación) */
export const Public = () => SetMetadata(IS_PUBLIC, true)

/**
 * Roles que pueden usar la ruta. Sin este decorador: gerente y vendedor (operación de ventas).
 * El super_admin solo entra a las rutas que lo nombran.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

/** Cualquier usuario con sesión (p. ej. /auth/me) */
export const AnyRole = () => Roles(...ROLES)

export const ALLOW_PENDING_PASSWORD = 'vx:allowPendingPassword'

/**
 * Ruta que puede usar quien todavía tiene la clave temporal (must_change_password).
 * Sin este decorador, esos usuarios reciben 403 { code: 'password_change_required' }.
 */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD, true)

/** Id del vendedor que hace la petición (lo fija AuthGuard) */
export const SellerId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().sellerId,
)

/** Contexto completo de la sesión: usuario, rol, empresa y vendedor */
export const Auth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => ctx.switchToHttp().getRequest<AuthedRequest>().auth,
)

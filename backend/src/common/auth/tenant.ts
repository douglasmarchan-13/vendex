import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import { ApiError } from '../errors/api-error.js'
import type { AuthContext, AuthedRequest, Role } from './auth.types.js'

/**
 * A qué datos llega la petición. Toda consulta de la operación de ventas filtra por `companyId`;
 * si `sellerId` no es null, además solo ve y edita lo de ese vendedor.
 */
export interface Tenant {
  companyId: string
  /** Vendedor que hace la petición: autor de actividades y dueño por defecto de lo que crea */
  actorId: string
  /** null = toda la empresa (gerente sin filtro) */
  sellerId: string | null
  role: Role
}

/**
 * vendedor → siempre restringido a sí mismo.
 * gerente  → toda la empresa, o un vendedor si se pide `?vendedor_id=` (filtro del dashboard).
 */
export function tenantOf(auth: AuthContext, vendedorId?: string): Tenant {
  if (!auth.companyId || !auth.sellerId) throw new ApiError(403, 'Tu usuario no pertenece a una empresa')
  const sellerId = auth.role === 'vendedor' ? auth.sellerId : vendedorId?.trim() || null
  return { companyId: auth.companyId, actorId: auth.sellerId, sellerId, role: auth.role }
}

/** `@CurrentTenant()` → Tenant de la sesión (lee `?vendedor_id=` si viene) */
export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): Tenant => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>()
  const v = req.query?.vendedor_id
  return tenantOf(req.auth, typeof v === 'string' && v.length <= 100 ? v : undefined)
})

/** Mismo Tenant pero sin el filtro opcional del gerente (para escrituras sobre un registro concreto) */
export const wholeCompany = (t: Tenant): Tenant => (t.role === 'vendedor' ? t : { ...t, sellerId: null })

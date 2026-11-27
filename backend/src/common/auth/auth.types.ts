import type { Request } from 'express'

export const ROLES = ['super_admin', 'gerente', 'vendedor'] as const
export type Role = (typeof ROLES)[number]

/** Roles de la operación de ventas: es el permiso por defecto de toda ruta sin @Roles() */
export const SALES_ROLES: Role[] = ['gerente', 'vendedor']

/** Empresa que recibió los datos existentes en la migración 001 (también la del modo demo) */
export const LEGACY_COMPANY_ID = '00000000-0000-4000-8000-000000000001'

/** Quién hace la petición. Lo fija AuthGuard. */
export interface AuthContext {
  /** null solo en modo demo (REQUIRE_AUTH=false sin token) */
  userId: string | null
  email: string | null
  name: string
  role: Role
  /** null solo para super_admin */
  companyId: string | null
  companyName: string | null
  /** Fila de sellers del usuario (gerentes y vendedores). null para super_admin */
  sellerId: string | null
  demo: boolean
  /** Versión de la contraseña (password_changed_at en ms): va en el JWT y debe coincidir */
  passwordVersion: number
  /** Cuenta creada con clave temporal: solo puede usar /auth/me y /auth/change-password */
  mustChangePassword: boolean
}

export interface AuthedRequest extends Request {
  auth: AuthContext
  /** Autor de las actividades que se registren (compatibilidad con los controladores actuales) */
  sellerId: string
}

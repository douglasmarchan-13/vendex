import { Injectable } from '@nestjs/common'
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose'
import { AppConfig } from '../../core/app-config.js'
import { SupabaseService } from '../../core/supabase.service.js'
import { ApiError } from '../errors/api-error.js'
import { type AuthContext, LEGACY_COMPANY_ID, type Role } from './auth.types.js'

const ISSUER = 'vendex'
const AUDIENCE = 'vendex-app'

/** Lo que el frontend recibe al iniciar sesión y en /auth/me */
export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  companyId: string | null
  companyName: string | null
  sellerId: string | null
  /** true → el frontend lleva a /cambiar-clave y la API solo acepta /auth/me y /auth/change-password */
  mustChangePassword: boolean
  /** true → muestra "Restablecer demo": gerente de la empresa de demostración con ALLOW_DEMO_RESET activo */
  canResetDemo: boolean
}

export interface LoginResult {
  token: string
  expiresAt: string
  user: SessionUser
}

/** Emite y valida los JWT, y arma el contexto de sesión a partir del usuario en la base. */
@Injectable()
export class SessionService {
  private readonly key: Uint8Array

  constructor(
    private readonly config: AppConfig,
    private readonly sb: SupabaseService,
  ) {
    this.key = new TextEncoder().encode(config.jwtSecret)
  }

  /**
   * Carga el usuario y valida que pueda operar: activo, empresa no suspendida y, para gerente/vendedor,
   * con su fila activa en sellers. Si `passwordVersion` viene (del JWT), debe coincidir con la clave actual:
   * así, cambiar o recuperar la contraseña invalida todas las sesiones anteriores.
   */
  async load(userId: string, passwordVersion?: number): Promise<AuthContext> {
    const { db, q } = this.sb
    const u = await q(
      db
        .from('users')
        .select('id, email, name, role, status, company_id, password_changed_at, must_change_password, companies(name, status), sellers(id, active)')
        .eq('id', userId)
        .maybeSingle(),
    )
    if (!u || u.status !== 'activo') throw new ApiError(401, 'Sesión no válida o expirada')
    const pv = Date.parse(u.password_changed_at)
    if (passwordVersion !== undefined && passwordVersion !== pv) {
      throw new ApiError(401, 'Tu contraseña cambió. Vuelve a iniciar sesión.')
    }

    const role = u.role as Role
    let sellerId: string | null = null
    if (role !== 'super_admin') {
      if (u.companies?.status === 'suspendida') throw new ApiError(403, 'La cuenta de tu empresa está suspendida')
      if (!u.sellers?.active) throw new ApiError(403, 'Tu usuario no está asociado a un vendedor activo')
      sellerId = u.sellers.id
    }

    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      role,
      companyId: u.company_id,
      companyName: u.companies?.name ?? null,
      sellerId,
      demo: false,
      passwordVersion: pv,
      mustChangePassword: u.must_change_password,
    }
  }

  /** Valida firma, emisor, audiencia y vencimiento; devuelve el contexto actualizado desde la base */
  async verify(token: string): Promise<AuthContext> {
    let sub: string | undefined
    let pv: unknown
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] })
      sub = payload.sub
      pv = payload.pv
    } catch (e) {
      if (e instanceof joseErrors.JWTExpired) throw new ApiError(401, 'Tu sesión expiró. Vuelve a iniciar sesión.')
      throw new ApiError(401, 'Sesión no válida o expirada')
    }
    if (!sub || typeof pv !== 'number') throw new ApiError(401, 'Sesión no válida o expirada')
    return this.load(sub, pv)
  }

  async issue(ctx: AuthContext): Promise<LoginResult> {
    if (!ctx.userId || !ctx.email) throw new ApiError(500, 'No se puede emitir sesión sin usuario')
    const token = await new SignJWT({ role: ctx.role, cid: ctx.companyId, sid: ctx.sellerId, pv: ctx.passwordVersion })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(ctx.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(this.config.jwtTtl)
      .sign(this.key)
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { exp: number }
    return { token, expiresAt: new Date(exp * 1000).toISOString(), user: this.publicUser(ctx) }
  }

  publicUser(ctx: AuthContext): SessionUser {
    return {
      id: ctx.userId ?? '',
      email: ctx.email ?? '',
      name: ctx.name,
      role: ctx.role,
      companyId: ctx.companyId,
      companyName: ctx.companyName,
      sellerId: ctx.sellerId,
      mustChangePassword: ctx.mustChangePassword,
      canResetDemo: this.config.allowDemoReset && ctx.role === 'gerente' && ctx.companyId === LEGACY_COMPANY_ID,
    }
  }
}

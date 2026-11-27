import { Injectable } from '@nestjs/common'
import { burnPasswordCheck, hashLinkToken, hashPassword, newLinkToken, verifyPassword } from '../../common/auth/crypto.js'
import { type LoginResult, SessionService } from '../../common/auth/session.service.js'
import { ApiError } from '../../common/errors/api-error.js'
import { AppConfig } from '../../core/app-config.js'
import { passwordResetMail } from '../../core/mail-templates.js'
import { MailService } from '../../core/mail.service.js'
import { SupabaseService } from '../../core/supabase.service.js'

const MAX_FAILED = 5
const LOCK_MINUTES = 15
/** No se envía más de un correo de recuperación por usuario en este lapso */
const RESET_COOLDOWN_MS = 60_000

const BAD_CREDENTIALS = 'Correo o contraseña incorrectos'

@Injectable()
export class AuthService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly session: SessionService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
  ) {}

  /** Login con bloqueo temporal tras 5 intentos fallidos */
  async login(email: string, password: string): Promise<LoginResult> {
    const { db, q } = this.sb
    const u = await q(
      db.from('users').select('id, password_hash, status, failed_login_attempts, locked_until').eq('email', email).maybeSingle(),
    )
    if (!u) {
      await burnPasswordCheck(password)
      throw new ApiError(401, BAD_CREDENTIALS)
    }
    if (u.locked_until && Date.parse(u.locked_until) > Date.now()) {
      throw new ApiError(429, `Demasiados intentos fallidos. Inténtalo de nuevo en ${LOCK_MINUTES} minutos.`)
    }

    if (!(await verifyPassword(password, u.password_hash))) {
      const n = u.failed_login_attempts + 1
      const lock = n >= MAX_FAILED
      await q(
        db
          .from('users')
          .update({
            failed_login_attempts: lock ? 0 : n,
            locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
          })
          .eq('id', u.id),
      )
      throw new ApiError(401, BAD_CREDENTIALS)
    }

    if (u.status !== 'activo') throw new ApiError(403, 'Tu usuario está desactivado. Habla con el gerente de tu empresa.')
    const ctx = await this.session.load(u.id)
    await q(db.from('users').update({ failed_login_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() }).eq('id', u.id))
    return this.session.issue(ctx)
  }

  /**
   * Pide el enlace de recuperación. Responde lo mismo exista o no el correo (no revela qué correos
   * están registrados) y envía el correo sin esperar.
   */
  async forgot(email: string, ip: string | undefined): Promise<{ ok: true }> {
    const { db, q } = this.sb
    const u = await q(db.from('users').select('id, name, email, status').eq('email', email).maybeSingle())
    if (!u || u.status !== 'activo') return { ok: true }

    const recent = await q(
      db
        .from('password_resets')
        .select('id')
        .eq('user_id', u.id)
        .gte('created_at', new Date(Date.now() - RESET_COOLDOWN_MS).toISOString())
        .limit(1),
    )
    if (recent.length) return { ok: true }

    // Solo el último enlace sirve
    await q(db.from('password_resets').update({ used_at: new Date().toISOString() }).eq('user_id', u.id).is('used_at', null))
    const token = newLinkToken()
    await q(db.from('password_resets').insert({ user_id: u.id, token_hash: hashLinkToken(token), requested_ip: ip ?? null }))
    this.mail.sendInBackground(passwordResetMail({ to: u.email, appUrl: this.config.appUrl, token, name: u.name }))
    return { ok: true }
  }

  /** Para la pantalla "Nueva contraseña": confirma que el enlace sirve antes de mostrar el formulario */
  async checkReset(token: string): Promise<{ email: string; expiresAt: string }> {
    const { db, q } = this.sb
    const r = await q(
      db.from('password_resets').select('expires_at, used_at, users(email, status)').eq('token_hash', hashLinkToken(token)).maybeSingle(),
    )
    if (!r || r.used_at || Date.parse(r.expires_at) < Date.now() || r.users?.status !== 'activo') {
      throw new ApiError(400, 'El enlace no es válido o ya venció. Solicita uno nuevo.')
    }
    return { email: r.users.email, expiresAt: r.expires_at }
  }

  /**
   * Cambio de clave con sesión iniciada (obligatorio si la cuenta tiene clave temporal).
   * Apaga must_change_password y cambia password_changed_at: los JWT anteriores dejan de valer,
   * así que devuelve una sesión nueva.
   */
  async changePassword(userId: string, current: string, next: string): Promise<LoginResult> {
    const { db, q } = this.sb
    const u = await q(db.from('users').select('id, password_hash, status').eq('id', userId).maybeSingle())
    if (!u || u.status !== 'activo') throw new ApiError(401, 'Sesión no válida o expirada')
    if (!(await verifyPassword(current, u.password_hash))) throw new ApiError(400, 'La contraseña actual no es correcta')
    if (await verifyPassword(next, u.password_hash)) throw new ApiError(400, 'La nueva contraseña debe ser distinta de la actual')

    await q(
      db
        .from('users')
        .update({
          password_hash: await hashPassword(next),
          password_changed_at: new Date().toISOString(),
          must_change_password: false,
          failed_login_attempts: 0,
          locked_until: null,
        })
        .eq('id', u.id),
    )
    return this.session.issue(await this.session.load(u.id))
  }

  /** Cambia la clave (un solo uso). Las sesiones abiertas con la clave anterior dejan de valer. */
  async reset(token: string, password: string): Promise<{ ok: true }> {
    await this.sb.rpc('complete_password_reset', { p_token_hash: hashLinkToken(token), p_password_hash: await hashPassword(password) })
    return { ok: true }
  }
}

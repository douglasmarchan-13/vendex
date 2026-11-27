import { Injectable, Logger } from '@nestjs/common'
import type { PostgrestError } from '@supabase/supabase-js'
import type { AuthContext } from '../../common/auth/auth.types.js'
import { hashLinkToken, hashPassword, newLinkToken } from '../../common/auth/crypto.js'
import { type LoginResult, SessionService } from '../../common/auth/session.service.js'
import { ApiError } from '../../common/errors/api-error.js'
import { fromDbError } from '../../common/errors/db-errors.js'
import { AppConfig } from '../../core/app-config.js'
import { invitationMail } from '../../core/mail-templates.js'
import { MailService } from '../../core/mail.service.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { Tables } from '../../database/database.types.js'
import type { DirectMemberBody, InviteBody } from './invitations.schemas.js'

export const INVITE_DAYS = 7

/** El método de alta lo fija el super admin por empresa (companies.user_onboarding) */
const METHOD_ERROR = {
  directa: 'Esta empresa crea las cuentas con contraseña temporal, no por invitación. El administrador de Vendex puede cambiarlo.',
  invitacion: 'Esta empresa crea las cuentas por invitación por correo, no con contraseña temporal. El administrador de Vendex puede cambiarlo.',
} as const

type InvitationRow = Tables<'invitations'>
export type InvitationStatus = 'pendiente' | 'vencida' | 'aceptada' | 'anulada'

export interface Invitation {
  id: string
  companyId: string
  email: string
  name: string
  role: string
  country: string | null
  sellerId: string | null
  status: InvitationStatus
  invitedBy: string | null
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

const statusOf = (r: Pick<InvitationRow, 'accepted_at' | 'revoked_at' | 'expires_at'>): InvitationStatus =>
  r.accepted_at ? 'aceptada' : r.revoked_at ? 'anulada' : Date.parse(r.expires_at) < Date.now() ? 'vencida' : 'pendiente'

const toInvitation = (r: InvitationRow): Invitation => ({
  id: r.id,
  companyId: r.company_id,
  email: r.email,
  name: r.name,
  role: r.role,
  country: r.country_code,
  sellerId: r.seller_id,
  status: statusOf(r),
  invitedBy: r.invited_by,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  acceptedAt: r.accepted_at,
})

/** Resultado de crear o reenviar: `mail` dice si el correo salió (si falla, se puede reenviar) */
export interface InvitationSent {
  invitation: Invitation
  mail: 'sent' | 'failed'
}

/** Usuario creado por alta directa (sin la clave) */
export interface DirectMember {
  id: string
  email: string
  name: string
  role: string
  status: string
  sellerId: string
  mustChangePassword: boolean
  createdAt: string
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger('Invitations')

  constructor(
    private readonly sb: SupabaseService,
    private readonly mail: MailService,
    private readonly session: SessionService,
    private readonly config: AppConfig,
  ) {}

  private async count(builder: PromiseLike<{ count: number | null; error: PostgrestError | null }>) {
    const { count, error } = await builder
    if (error) throw fromDbError(error)
    return count ?? 0
  }

  /** Cupos usados = usuarios activos + invitaciones pendientes y vigentes */
  async seatsUsed(companyId: string) {
    const { db } = this.sb
    const [users, pending] = await Promise.all([
      this.count(db.from('users').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'activo')),
      this.count(
        db
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString()),
      ),
    ])
    return users + pending
  }

  /** Crea la invitación y envía el correo. `by` es quien invita (null = sistema / modo demo). */
  async create(companyId: string, b: InviteBody, by: AuthContext | null): Promise<InvitationSent> {
    const { db, q, one } = this.sb
    const company = await one(db.from('companies').select('id, name, seats, status, user_onboarding').eq('id', companyId).maybeSingle(), 'Empresa')
    if (company.status === 'suspendida') throw new ApiError(409, 'La empresa está suspendida')
    if (company.user_onboarding !== 'invitacion') throw new ApiError(409, METHOD_ERROR.directa)

    const [taken, pending] = await Promise.all([
      q(db.from('users').select('id').eq('email', b.email).maybeSingle()),
      q(
        db
          .from('invitations')
          .select('id, expires_at')
          .eq('company_id', companyId)
          .eq('email', b.email)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .maybeSingle(),
      ),
    ])
    if (taken) throw new ApiError(409, 'Ese correo ya tiene una cuenta en Vendex')
    if (pending && Date.parse(pending.expires_at) > Date.now()) {
      throw new ApiError(409, 'Ya hay una invitación pendiente para ese correo. Puedes reenviarla.')
    }
    // Una invitación vencida se reemplaza por la nueva
    if (pending) await q(db.from('invitations').update({ revoked_at: new Date().toISOString() }).eq('id', pending.id))

    if ((await this.seatsUsed(companyId)) >= company.seats) {
      throw new ApiError(409, `La empresa usa sus ${company.seats} cupos. Libera uno o amplía el plan.`)
    }

    if (b.sellerId) {
      const s = await q(db.from('sellers').select('id, user_id').eq('id', b.sellerId).eq('company_id', companyId).maybeSingle())
      if (!s) throw new ApiError(400, 'Ese vendedor no existe en la empresa')
      if (s.user_id) throw new ApiError(409, 'Ese vendedor ya tiene un usuario')
    }

    const token = newLinkToken()
    const row = await q(
      db
        .from('invitations')
        .insert({
          company_id: companyId,
          email: b.email,
          name: b.name,
          role: b.role,
          country_code: b.country ?? null,
          seller_id: b.sellerId ?? null,
          token_hash: hashLinkToken(token),
          invited_by: by?.userId ?? null,
          expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
        })
        .select()
        .single(),
    )
    return { invitation: toInvitation(row), mail: await this.sendMail(row, token, company.name, by) }
  }

  /**
   * Alta directa con clave temporal: la cuenta queda activa sin enviar correo y con
   * must_change_password = true. La clave solo se guarda como hash bcrypt y no se devuelve.
   * Cupos, correo repetido y vendedor se validan otra vez dentro de la función SQL (con bloqueo).
   */
  async createDirect(companyId: string, b: DirectMemberBody, by: AuthContext | null): Promise<DirectMember> {
    const { db, q, one } = this.sb
    const company = await one(db.from('companies').select('id, seats, status, user_onboarding').eq('id', companyId).maybeSingle(), 'Empresa')
    if (company.status === 'suspendida') throw new ApiError(409, 'La empresa está suspendida')
    if (company.user_onboarding !== 'directa') throw new ApiError(409, METHOD_ERROR.invitacion)

    const taken = await q(db.from('users').select('id').eq('email', b.email).maybeSingle())
    if (taken) throw new ApiError(409, 'Ese correo ya tiene una cuenta en Vendex')

    if (b.sellerId) {
      const s = await q(db.from('sellers').select('id, user_id').eq('id', b.sellerId).eq('company_id', companyId).maybeSingle())
      if (!s) throw new ApiError(400, 'Ese vendedor no existe en la empresa')
      if (s.user_id) throw new ApiError(409, 'Ese vendedor ya tiene un usuario')
    }

    const res = (await this.sb.rpc('create_member_direct', {
      p_company_id: companyId,
      p_email: b.email,
      p_name: b.name,
      p_role: b.role,
      p_country_code: b.country ?? null,
      p_seller_id: b.sellerId ?? null,
      p_password_hash: await hashPassword(b.password),
    })) as { user_id: string; seller_id: string }

    this.logger.log(`Alta directa de ${b.email} (${b.role}) en ${companyId} por ${by?.email ?? 'sistema'}`)
    const u = await one(
      db.from('users').select('id, email, name, role, status, must_change_password, created_at').eq('id', res.user_id).maybeSingle(),
      'Usuario',
    )
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      sellerId: res.seller_id,
      mustChangePassword: u.must_change_password,
      createdAt: u.created_at,
    }
  }

  /** Nuevo enlace (el anterior deja de servir) y nuevo vencimiento */
  async resend(companyId: string, invitationId: string, by: AuthContext | null): Promise<InvitationSent> {
    const { db, q, one } = this.sb
    const token = newLinkToken()
    const row = await q(
      db
        .from('invitations')
        .update({
          token_hash: hashLinkToken(token),
          expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
          invited_by: by?.userId ?? null,
        })
        .eq('id', invitationId)
        .eq('company_id', companyId)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .select()
        .maybeSingle(),
    )
    if (!row) throw new ApiError(404, 'Invitación pendiente no encontrada')
    const company = await one(db.from('companies').select('name').eq('id', companyId).maybeSingle(), 'Empresa')
    return { invitation: toInvitation(row), mail: await this.sendMail(row, token, company.name, by) }
  }

  async revoke(companyId: string, invitationId: string) {
    const row = await this.sb.q(
      this.sb.db
        .from('invitations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', invitationId)
        .eq('company_id', companyId)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .select()
        .maybeSingle(),
    )
    if (!row) throw new ApiError(404, 'Invitación pendiente no encontrada')
    return toInvitation(row)
  }

  async list(companyId: string) {
    const rows = await this.sb.q(this.sb.db.from('invitations').select('*').eq('company_id', companyId).order('created_at', { ascending: false }))
    return rows.map(toInvitation)
  }

  /** Página de registro: datos de la invitación (correo y rol se muestran bloqueados) */
  async getByToken(token: string) {
    const { db, q } = this.sb
    const r = await q(db.from('invitations').select('*, companies(name, status)').eq('token_hash', hashLinkToken(token)).maybeSingle())
    if (!r) throw new ApiError(404, 'Invitación no encontrada')
    const status = statusOf(r)
    if (status === 'aceptada') throw new ApiError(410, 'Esta invitación ya fue usada. Inicia sesión.')
    if (status === 'anulada') throw new ApiError(410, 'Esta invitación fue anulada. Pide una nueva.')
    if (status === 'vencida') throw new ApiError(410, 'La invitación venció. Pide que te la reenvíen.')
    if (r.companies?.status === 'suspendida') throw new ApiError(403, 'La cuenta de la empresa está suspendida')
    return { email: r.email, role: r.role, name: r.name, companyName: r.companies?.name ?? '', expiresAt: r.expires_at }
  }

  /** Activa la cuenta y deja la sesión iniciada */
  async accept(token: string, name: string, password: string): Promise<LoginResult> {
    const res = (await this.sb.rpc('accept_invitation', {
      p_token_hash: hashLinkToken(token),
      p_name: name,
      p_password_hash: await hashPassword(password),
    })) as { user_id: string }
    return this.session.issue(await this.session.load(res.user_id))
  }

  private async sendMail(row: InvitationRow, token: string, companyName: string, by: AuthContext | null): Promise<'sent' | 'failed'> {
    try {
      await this.mail.send(
        invitationMail({
          to: row.email,
          appUrl: this.config.appUrl,
          token,
          companyName,
          role: row.role,
          invitedBy: by && !by.demo ? by.name : null,
          expiresAt: row.expires_at,
        }),
      )
      return 'sent'
    } catch (e) {
      this.logger.error(`No se pudo enviar la invitación a ${row.email}: ${(e as Error).message}`)
      return 'failed'
    }
  }
}

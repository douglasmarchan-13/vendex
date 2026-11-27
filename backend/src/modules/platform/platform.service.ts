import { Injectable } from '@nestjs/common'
import type { AuthContext } from '../../common/auth/auth.types.js'
import { ApiError } from '../../common/errors/api-error.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { Tables, TablesUpdate } from '../../database/database.types.js'
import { InvitationsService } from '../invitations/invitations.service.js'
import { type CompanyPatch, type CreateCompanyBody, defaultSeats, type ManagerInviteBody } from './platform.schemas.js'

type CompanyRow = Tables<'companies'>
interface CompanyListRow extends CompanyRow {
  users: { name: string; email: string; role: string; status: string }[]
  invitations: { accepted_at: string | null; revoked_at: string | null; expires_at: string }[]
}

const toCompany = (c: CompanyRow) => ({
  id: c.id,
  name: c.name,
  legalName: c.legal_name,
  taxId: c.tax_id,
  country: c.country_code,
  industry: c.industry,
  plan: c.plan,
  seats: c.seats,
  status: c.status,
  trialEndsAt: c.trial_ends_at,
  notes: c.notes,
  onboarding: c.user_onboarding,
  createdAt: c.created_at,
})

/** Panel del super administrador: empresas y su gerente inicial */
@Injectable()
export class PlatformService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly invitations: InvitationsService,
  ) {}

  async list() {
    const rows = (await this.sb.q(
      this.sb.db
        .from('companies')
        .select('*, users(name, email, role, status), invitations(accepted_at, revoked_at, expires_at)')
        .order('created_at', { ascending: false }),
    )) as unknown as CompanyListRow[]
    const now = Date.now()
    return rows.map((c) => {
      const managers = c.users.filter((u) => u.role === 'gerente' && u.status === 'activo')
      return {
        ...toCompany(c),
        activeUsers: c.users.filter((u) => u.status === 'activo').length,
        pendingInvitations: c.invitations.filter((i) => !i.accepted_at && !i.revoked_at && Date.parse(i.expires_at) > now).length,
        managers: managers.map((m) => ({ name: m.name, email: m.email })),
      }
    })
  }

  /** Crea la empresa e invita a su gerente. Si la invitación falla, la empresa no queda creada. */
  async create(b: CreateCompanyBody, by: AuthContext) {
    const { db, q } = this.sb
    if (await q(db.from('users').select('id').eq('email', b.manager.email).maybeSingle())) {
      throw new ApiError(409, 'El correo del gerente ya tiene una cuenta en Vendex')
    }

    const company = await q(
      db
        .from('companies')
        .insert({
          name: b.name,
          legal_name: b.legalName,
          tax_id: b.taxId,
          country_code: b.country,
          industry: b.industry,
          plan: b.plan,
          seats: b.seats ?? defaultSeats(b.plan),
          status: b.status,
          trial_ends_at: b.status === 'prueba' ? new Date(Date.now() + b.trialDays * 86_400_000).toISOString() : null,
          notes: b.notes,
          user_onboarding: b.onboarding,
        })
        .select()
        .single(),
    )

    try {
      const mgr = { ...b.manager, role: 'gerente' as const, country: b.manager.country ?? b.country }
      // Alta directa → { company, member } · invitación → { company, invitation, mail }
      if (b.onboarding === 'directa') {
        return { company: toCompany(company), member: await this.invitations.createDirect(company.id, { ...mgr, password: b.manager.password! }, by) }
      }
      return { company: toCompany(company), ...(await this.invitations.create(company.id, mgr, by)) }
    } catch (e) {
      // Compensación: borra la empresa recién creada (su configuración se borra en cascada)
      await db.from('companies').delete().eq('id', company.id)
      throw e
    }
  }

  async update(id: string, p: CompanyPatch) {
    const patch: TablesUpdate<'companies'> = {
      name: p.name,
      legal_name: p.legalName,
      tax_id: p.taxId,
      country_code: p.country,
      industry: p.industry,
      plan: p.plan,
      seats: p.seats,
      status: p.status,
      trial_ends_at: p.trialEndsAt,
      notes: p.notes,
      user_onboarding: p.onboarding,
    }
    const row = await this.sb.q(this.sb.db.from('companies').update(patch).eq('id', id).select().maybeSingle())
    if (!row) throw new ApiError(404, 'Empresa no encontrada')
    return toCompany(row)
  }

  /**
   * Agrega (otro) gerente a una empresa existente, p. ej. si el inicial no aceptó o se fue.
   * Según el método de la empresa: invitación → { invitation, mail } · directa → { member }
   */
  async inviteManager(companyId: string, b: ManagerInviteBody, by: AuthContext) {
    const { db, one } = this.sb
    const company = await one(db.from('companies').select('user_onboarding').eq('id', companyId).maybeSingle(), 'Empresa')
    const { password, ...mgr } = b
    if (company.user_onboarding !== 'directa') return this.invitations.create(companyId, { ...mgr, role: 'gerente' }, by)

    if (mgr.name.length < 2) throw new ApiError(400, 'Indica el nombre del gerente')
    if (!password) throw new ApiError(400, 'Indica la contraseña temporal del gerente')
    return { member: await this.invitations.createDirect(companyId, { ...mgr, role: 'gerente', password }, by) }
  }

  listInvitations(companyId: string) {
    return this.invitations.list(companyId)
  }

  resendInvitation(companyId: string, invitationId: string, by: AuthContext) {
    return this.invitations.resend(companyId, invitationId, by)
  }

  revokeInvitation(companyId: string, invitationId: string) {
    return this.invitations.revoke(companyId, invitationId)
  }
}

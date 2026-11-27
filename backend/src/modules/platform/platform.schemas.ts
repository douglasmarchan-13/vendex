import { z } from 'zod'
import { country, id } from '../../common/validation/schemas.js'
import { email, newPassword } from '../auth/auth.schemas.js'

const PLAN_SEATS = { basico: 5, pro: 15, empresa: 50 } as const
export const plan = z.enum(['basico', 'pro', 'empresa'])
export const companyStatus = z.enum(['prueba', 'activa', 'suspendida'])
export const defaultSeats = (p: keyof typeof PLAN_SEATS) => PLAN_SEATS[p]

/**
 * Cómo se crean las cuentas de la empresa (gerente y equipo):
 * invitacion = enlace por correo · directa = contraseña temporal que se cambia al entrar
 */
export const onboarding = z.enum(['invitacion', 'directa'])
export type Onboarding = z.output<typeof onboarding>

const companyFields = {
  name: z.string().trim().min(2, 'Indica el nombre comercial').max(160),
  legalName: z.string().trim().max(200).default(''),
  taxId: z.string().trim().max(40).default(''),
  country,
  industry: z.string().trim().max(80).default(''),
  plan: plan.default('basico'),
  /** Por defecto, los del plan */
  seats: z.number().int().min(1).max(10_000).optional(),
  status: z.enum(['prueba', 'activa']).default('prueba'),
  /** Días de prueba si status = prueba */
  trialDays: z.number().int().min(1).max(365).default(14),
  notes: z.string().trim().max(2000).default(''),
  onboarding: onboarding.default('invitacion'),
}

const manager = z.object({
  email,
  name: z.string().trim().max(120).default(''),
  country: country.optional(),
  /** Enlaza la cuenta a un vendedor existente de la empresa (p. ej. en la empresa legado) */
  sellerId: id.optional(),
  /** Solo si la empresa usa alta directa: contraseña temporal del gerente */
  password: newPassword.optional(),
})

/** Con alta directa el gerente necesita nombre y contraseña temporal */
export function directManagerIssues(m: { name: string; password?: string | undefined }, path: (string | number)[], ctx: z.RefinementCtx) {
  if (m.name.length < 2) ctx.addIssue({ code: 'custom', path: [...path, 'name'], message: 'Indica el nombre del gerente' })
  if (!m.password) ctx.addIssue({ code: 'custom', path: [...path, 'password'], message: 'Indica la contraseña temporal del gerente' })
}

export const createCompanyBody = z.object({ ...companyFields, manager }).superRefine((b, ctx) => {
  if (b.onboarding === 'directa') directManagerIssues(b.manager, ['manager'], ctx)
})

export const companyPatch = z.object({
  name: companyFields.name.optional(),
  legalName: z.string().trim().max(200).optional(),
  taxId: z.string().trim().max(40).optional(),
  country: country.optional(),
  industry: z.string().trim().max(80).optional(),
  plan: plan.optional(),
  seats: z.number().int().min(1).max(10_000).optional(),
  status: companyStatus.optional(),
  trialEndsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
  onboarding: onboarding.optional(),
})

/** Gerente para una empresa existente: invitación o alta directa según el método de la empresa */
export const managerInviteBody = manager

export type CreateCompanyBody = z.output<typeof createCompanyBody>
export type CompanyPatch = z.output<typeof companyPatch>
export type ManagerInviteBody = z.output<typeof managerInviteBody>

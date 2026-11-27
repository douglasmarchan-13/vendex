import { z } from 'zod'
import { country, id } from '../../common/validation/schemas.js'
import { email, newPassword } from '../auth/auth.schemas.js'

export const personName = z.string().trim().min(2, 'Indica el nombre').max(120)

export const inviteBody = z.object({
  email,
  role: z.enum(['gerente', 'vendedor']),
  name: z.string().trim().max(120).default(''),
  /** País del vendedor (para su fila en sellers). Por defecto, el de la empresa. */
  country: country.optional(),
  /** Vincula la cuenta a un vendedor que ya existe y aún no tiene usuario (ver /team/members) */
  sellerId: id.optional(),
})

export const acceptBody = z.object({ name: personName, password: newPassword })

export type InviteBody = z.output<typeof inviteBody>
export type AcceptBody = z.output<typeof acceptBody>

/**
 * Alta directa: el gerente define la clave inicial (temporal) y la cuenta queda activa sin correo.
 * El usuario deberá cambiarla en su primer inicio de sesión.
 */
export const directMemberBody = inviteBody.extend({ name: personName, password: newPassword })
export type DirectMemberBody = z.output<typeof directMemberBody>

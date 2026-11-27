import { z } from 'zod'

export const email = z
  .string({ error: 'Indica tu correo' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Correo no válido' }).max(254))

/** bcrypt solo usa los primeros 72 bytes: más largo se rechaza en vez de recortarse en silencio */
export const newPassword = z
  .string({ error: 'Indica una contraseña' })
  .min(10, 'Mínimo 10 caracteres')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Máximo 72 caracteres')
  .refine((p) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p) && /\d/.test(p), 'Usa al menos una letra y un número')

export const linkToken = z.string().trim().min(20).max(200)

export const loginBody = z.object({ email, password: z.string().min(1, 'Indica tu contraseña').max(200) })
export const forgotBody = z.object({ email })
export const resetBody = z.object({ token: linkToken, password: newPassword })

export type LoginBody = z.output<typeof loginBody>
export type ForgotBody = z.output<typeof forgotBody>
export type ResetBody = z.output<typeof resetBody>

export const changePasswordBody = z.object({
  currentPassword: z.string({ error: 'Indica tu contraseña actual' }).min(1, 'Indica tu contraseña actual').max(200),
  newPassword,
})
export type ChangePasswordBody = z.output<typeof changePasswordBody>

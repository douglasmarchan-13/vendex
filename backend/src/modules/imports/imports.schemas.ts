import { z } from 'zod'
import { ApiError } from '../../common/errors/api-error.js'

const key = z.string().max(300)

/** Decisiones del usuario en la vista previa (campo "options" del formulario, en JSON) */
export const commitOptions = z.object({
  /** Contactos (key) que no se importan */
  exclude: z.array(key).max(20_000).default([]),
  /** Contactos (key) cuya nota "COMPRÓ" fue una venta propia: el trato entra como venta cerrada */
  sold: z.array(key).max(20_000).default([]),
})
export type CommitOptions = z.infer<typeof commitOptions>

export function parseCommitOptions(raw: unknown): CommitOptions {
  let json: unknown = {}
  if (typeof raw === 'string' && raw.trim()) {
    try {
      json = JSON.parse(raw)
    } catch {
      throw new ApiError(400, 'El campo "options" no es JSON válido')
    }
  }
  const r = commitOptions.safeParse(json)
  if (!r.success) throw new ApiError(400, 'Opciones de importación inválidas', r.error.issues)
  return r.data
}

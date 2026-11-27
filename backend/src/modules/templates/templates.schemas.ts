import { z } from 'zod'

/** Clave de la plantilla: una por defecto ('seguimiento', 'cobro'…) o propia ('custom-…') */
export const templateKey = z.string().trim().regex(/^[a-z0-9-]{1,60}$/, 'Clave no válida')

export const templateBody = z.object({
  kind: z.enum(['venta', 'cobranza']).default('venta'),
  label: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(2000),
})

export type TemplateBody = z.output<typeof templateBody>

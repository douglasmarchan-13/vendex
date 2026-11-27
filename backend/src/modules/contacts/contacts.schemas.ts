import { z } from 'zod'
import { ACTIVITY_TYPES, boolFlag, country, id, isoDate, temp } from '../../common/validation/schemas.js'

export const contactBody = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).default(''),
  country,
  city: z.string().trim().max(120).default(''),
  region: z.string().trim().max(120).default(''),
  phone: z.string().trim().max(40).default(''),
  doc: z.string().trim().max(40).default(''),
  email: z.union([z.email(), z.literal('')]).default(''),
  channel: z.string().trim().min(1).nullable().optional(),
  owner: id.optional(),
  temp: temp.default('tibio'),
})
/** Alta: opcionalmente con una primera nota en la línea de tiempo */
export const createContactBody = contactBody.extend({ note: z.string().trim().max(2000).optional() })
/** Edición: se usa con `onlySent`, así los valores por defecto no pisan campos no enviados */
export const contactPatch = contactBody.partial()

export const contactListQuery = z.object({
  country: country.optional(),
  owner: id.optional(),
  temp: temp.optional(),
  q: z.string().trim().max(100).optional(),
  timeline: boolFlag.optional(),
})

export const tempBody = z.object({ temp })
export const activityBody = z.object({
  type: z.enum(ACTIVITY_TYPES),
  text: z.string().trim().min(1).max(4000),
  at: isoDate.optional(),
})

/** Campos de texto que acompañan al PDF (multipart/form-data: todo llega como string) */
export const contactFileBody = z.object({
  dealId: z.preprocess((v) => (v === '' ? undefined : v), id.optional()),
  kind: z.enum(['cotizacion', 'otro']).default('cotizacion'),
  note: z.string().trim().max(500).default(''),
})

export type ContactFileBody = z.output<typeof contactFileBody>
export type ContactBody =z.output<typeof contactBody>
export type CreateContactBody = z.output<typeof createContactBody>
export type ContactPatch = z.output<typeof contactPatch>
export type ContactListQuery = z.output<typeof contactListQuery>
export type TempBody = z.output<typeof tempBody>
export type ActivityBody = z.output<typeof activityBody>

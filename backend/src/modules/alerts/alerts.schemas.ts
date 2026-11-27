import { z } from 'zod'
import { id } from '../../common/validation/schemas.js'

export const alertBody = z.object({
  kind: z.string().trim().min(1).max(40),
  contactId: id.nullable().optional(),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().max(2000).default(''),
  actions: z.array(z.enum(['call', 'whatsapp', 'snooze', 'split'])).default([]),
})
export const alertQuery = z.object({ contactId: id.optional() })

export type AlertBody = z.output<typeof alertBody>
export type AlertQuery = z.output<typeof alertQuery>

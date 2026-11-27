import { z } from 'zod'
import { country, id, isoDate } from '../../common/validation/schemas.js'

export const PAY_STATUSES = ['pagado', 'vencido', 'hoy', 'semana', 'proximo'] as const
export type PayStatus = (typeof PAY_STATUSES)[number]

export const paymentListQuery = z.object({
  status: z.enum(['pendiente', ...PAY_STATUSES]).optional(),
  dealId: id.optional(),
  contactId: id.optional(),
  country: country.optional(),
})
export const summaryQuery = paymentListQuery.pick({ country: true })

export const registerBody = z.object({
  amount: z.coerce.number().positive(),
  method: z.string().trim().min(1).max(60),
  date: isoDate.optional(),
  ref: z.string().trim().max(120).default(''),
})

export const paymentPatch = z
  .object({ label: z.string().trim().min(1).max(120), amount: z.coerce.number().positive(), dueAt: isoDate })
  .partial()

export type PaymentListQuery = z.output<typeof paymentListQuery>
export type SummaryQuery = z.output<typeof summaryQuery>
export type RegisterBody = z.output<typeof registerBody>
export type PaymentPatch = z.output<typeof paymentPatch>

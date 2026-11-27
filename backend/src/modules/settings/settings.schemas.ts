import { z } from 'zod'
import { days, isoDate } from '../../common/validation/schemas.js'

export const goalBody = z.object({ goalUSD: z.coerce.number().nonnegative() })
export const planBody = z
  .object({
    ticketUSD: z.coerce.number().nonnegative(),
    closeRate: z.coerce.number().min(0).max(100),
    quoteRate: z.coerce.number().min(0).max(100),
    callsPerLead: z.coerce.number().int().min(0),
    workDays: z.coerce.number().int().min(1).max(31),
  })
  .partial()
/** { PEN: 3.75, VES: 250 } */
export const ratesBody = z.record(z.string().toUpperCase().length(3), z.coerce.number())
export const snoozeBody = z.object({ days: days.optional(), until: isoDate.optional() })

export type GoalBody = z.output<typeof goalBody>
export type PlanBody = z.output<typeof planBody>
export type RatesBody = z.output<typeof ratesBody>
export type SnoozeBody = z.output<typeof snoozeBody>

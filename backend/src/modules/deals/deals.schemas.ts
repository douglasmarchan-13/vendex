import { z } from 'zod'
import { boolFlag, country, currency, days, id, isoDate, money, temp } from '../../common/validation/schemas.js'
import { createContactBody } from '../contacts/contacts.schemas.js'

export const stage = z.string().trim().min(1).max(40)

const dealFields = z.object({
  product: z.string().trim().min(1).max(300),
  amount: money.default(0),
  currency,
  stage: stage.default('nuevo'),
  temp: temp.default('tibio'),
  nextAt: isoDate.optional(),
  nextDays: days.optional(),
  nextAction: z.string().trim().max(300).default('Primer contacto'),
})

/**
 * addDeal(): con `contactId` usa un contacto existente; si no, crea uno nuevo.
 * Los datos del contacto pueden venir anidados en `contact` o "planos" (como el formulario del frontend).
 */
export const createDealBody = z.preprocess(
  (v) => {
    if (!v || typeof v !== 'object') return v
    const o = v as Record<string, unknown>
    return o.contactId || o.contact ? o : { ...o, contact: o }
  },
  dealFields.extend({
    contactId: id.optional(),
    contact: createContactBody.optional(),
  }),
)

/** Edición (con `onlySent`). El cambio de etapa va por /move */
export const dealPatch = dealFields.omit({ stage: true }).partial()

export const dealListQuery = z.object({
  stage: stage.optional(),
  contactId: id.optional(),
  country: country.optional(),
  open: boolFlag.optional(),
})

export const moveBody = z.object({ stage })
export const snoozeDealBody = z.object({ days: days.default(1) })

export const paymentPlanBody = z.object({
  items: z
    .array(
      z.object({
        n: z.number().int().min(0),
        of: z.number().int().min(1),
        label: z.string().trim().min(1).max(120),
        amount: z.coerce.number().positive(),
        dueDays: days.optional(),
        dueAt: isoDate.optional(),
      }),
    )
    .min(1)
    .max(120),
  /** Si viene, la primera cuota queda pagada hoy con este medio */
  firstPaid: z.string().trim().min(1).max(60).nullable().optional(),
})

export type CreateDealBody = z.output<typeof createDealBody>
export type DealPatch = z.output<typeof dealPatch>
export type DealListQuery = z.output<typeof dealListQuery>
export type MoveBody = z.output<typeof moveBody>
export type SnoozeDealBody = z.output<typeof snoozeDealBody>
export type PaymentPlanBody = z.output<typeof paymentPlanBody>

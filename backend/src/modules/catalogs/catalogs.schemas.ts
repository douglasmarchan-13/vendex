import { z } from 'zod'
import { money } from '../../common/validation/schemas.js'

export const productBody = z.object({ name: z.string().trim().min(1).max(200), price: money, position: z.number().int().optional() })
export const productPatch = productBody.partial().extend({ active: z.boolean().optional() })
export const payMethodsBody = z.object({ methods: z.array(z.string().trim().min(1)).max(30) })

export type ProductBody = z.output<typeof productBody>
export type ProductPatch = z.output<typeof productPatch>
export type PayMethodsBody = z.output<typeof payMethodsBody>

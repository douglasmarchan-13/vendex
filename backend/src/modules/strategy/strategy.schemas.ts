import { z } from 'zod'

export const cardBody = z.object({
  kind: z.string().trim().min(1).max(40).default('enfoque'),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(8000).default(''),
  position: z.number().int().optional(),
})

export type CardBody = z.output<typeof cardBody>

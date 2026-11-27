import { z } from 'zod'
import { boolFlag, days, id, isoDate, TASK_TYPES, ymd } from '../../common/validation/schemas.js'

export const taskBody = z.object({
  title: z.string().trim().min(1).max(300),
  type: z.enum(TASK_TYPES).default('llamada'),
  contactId: id.nullable().optional(),
  sellerId: id.optional(),
  at: isoDate.optional(),
  // Alternativa a `at`: dentro de N días a la hora h:m (zona del negocio)
  day: days.optional(),
  hour: z.number().int().min(0).max(23).optional(),
  minute: z.number().int().min(0).max(59).optional(),
  done: z.boolean().default(false),
})
export const taskPatch = taskBody.partial()

/** ?date=YYYY-MM-DD | from=&to= &done=false &sellerId= &contactId= &overdue=true */
export const taskQuery = z.object({
  date: ymd.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  done: boolFlag.optional(),
  sellerId: id.optional(),
  contactId: id.optional(),
  overdue: boolFlag.optional(),
})

export type TaskBody = z.output<typeof taskBody>
export type TaskPatch = z.output<typeof taskPatch>
export type TaskQuery = z.output<typeof taskQuery>

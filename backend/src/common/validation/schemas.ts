import { z } from 'zod'

// Piezas de validación compartidas por los módulos
export const id = z.string().trim().min(1).max(100)
export const temp = z.enum(['caliente', 'tibio', 'frio'])
export const currency = z.string().trim().toUpperCase().length(3)
export const country = z.string().trim().toUpperCase().length(2)
export const isoDate = z.iso.datetime({ offset: true })
export const money = z.coerce.number().finite().nonnegative()
export const days = z.coerce.number().int().min(-3650).max(3650)
export const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD')
export const boolFlag = z.enum(['true', 'false'])

export const ACTIVITY_TYPES = ['vista', 'llamada', 'cotizacion', 'visita', 'whatsapp', 'venta', 'nota', 'pago', 'reunion', 'email'] as const
export const TASK_TYPES = ['llamada', 'whatsapp', 'visita', 'reunion', 'email', 'nota'] as const

export type Temp = z.infer<typeof temp>

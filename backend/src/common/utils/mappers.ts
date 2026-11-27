// Convierte filas de la base (snake_case) al formato del frontend (camelCase, mismas claves que
// frontend/src/data/mock.js) y viceversa.
import type { Tables } from '../../database/database.types.js'

export type ActivityRow = Tables<'activities'>
export type ContactRow = Tables<'contacts'>
export type DealRow = Tables<'deals'>
export type PaymentRow = Tables<'payments'>
export type TaskRow = Tables<'tasks'>
export type AlertRow = Tables<'alerts'>
export type StrategyRow = Tables<'strategy_cards'>
export type SettingsRow = Tables<'company_settings'>

const opt = <T>(v: T | null) => (v === null ? undefined : v)

/** Copia solo las claves definidas de `obj`, renombrándolas según `map` ({ camel: 'snake' }) */
export function toRow<M extends Record<string, string>>(obj: Partial<Record<keyof M, unknown>>, map: M): Record<M[keyof M], unknown> {
  const row: Record<string, unknown> = {}
  for (const [k, col] of Object.entries(map)) if (obj[k] !== undefined) row[col] = obj[k]
  return row as Record<M[keyof M], unknown>
}

// ---------- Actividades ----------
export interface Activity { id: string; at: string; type: string; text: string; by: string }
export const activity = (r: ActivityRow): Activity => ({ id: r.id, at: r.at, type: r.type, text: r.text, by: r.author_id ?? 'sistema' })

// ---------- Contactos ----------
export interface Contact {
  id: string; name: string; company: string; country: string; city: string; region: string; phone: string
  doc: string; email: string; channel: string | null; owner: string | null; temp: string; createdAt: string
  timeline?: Activity[]
}
export const contact = (r: ContactRow & { activities?: ActivityRow[] }): Contact => ({
  id: r.id,
  name: r.name,
  company: r.company,
  country: r.country_code,
  city: r.city,
  region: r.region,
  phone: r.phone,
  doc: r.doc,
  email: r.email,
  channel: r.channel,
  owner: r.owner_id,
  temp: r.temp,
  createdAt: r.created_at,
  ...(r.activities ? { timeline: [...r.activities].sort((a, b) => (a.at < b.at ? 1 : -1)).map(activity) } : {}),
})
export const CONTACT_COLS = {
  name: 'name', company: 'company', country: 'country_code', city: 'city', region: 'region', phone: 'phone',
  doc: 'doc', email: 'email', channel: 'channel', owner: 'owner_id', temp: 'temp',
} as const

// ---------- Tratos ----------
export interface Deal {
  id: string; contactId: string; product: string; amount: number; currency: string; stage: string; temp: string
  nextAt: string | null; nextAction: string; createdAt: string; closedAt?: string
}
export const deal = (r: DealRow): Deal => ({
  id: r.id,
  contactId: r.contact_id,
  product: r.product,
  amount: Number(r.amount),
  currency: r.currency,
  stage: r.stage,
  temp: r.temp,
  nextAt: r.next_at,
  nextAction: r.next_action,
  createdAt: r.created_at,
  closedAt: opt(r.closed_at),
})
export const DEAL_COLS = {
  contactId: 'contact_id', product: 'product', amount: 'amount', currency: 'currency', stage: 'stage',
  temp: 'temp', nextAt: 'next_at', nextAction: 'next_action',
} as const

// ---------- Cuotas ----------
export interface Payment {
  id: string; dealId: string; contactId: string; currency: string; n: number; of: number; label: string
  amount: number; dueAt: string; paidAt?: string; method?: string | null; ref?: string
}
export const payment = (r: PaymentRow): Payment => ({
  id: r.id,
  dealId: r.deal_id,
  contactId: r.contact_id,
  currency: r.currency,
  n: r.n,
  of: r.of_total,
  label: r.label,
  amount: Number(r.amount),
  dueAt: r.due_at,
  ...(r.paid_at ? { paidAt: r.paid_at, method: r.method, ref: r.ref ?? '' } : {}),
})

// ---------- Tareas ----------
export interface Task { id: string; at: string; type: string; contactId: string | null; sellerId: string | null; title: string; done: boolean }
export const task = (r: TaskRow): Task => ({
  id: r.id, at: r.at, type: r.type, contactId: r.contact_id, sellerId: r.seller_id, title: r.title, done: r.done,
})
export const TASK_COLS = { at: 'at', type: 'type', contactId: 'contact_id', sellerId: 'seller_id', title: 'title', done: 'done' } as const

// ---------- Alertas ----------
export interface Alert { id: string; kind: string; contactId: string | null; title: string; body: string; actions: string[] }
export const alert = (r: AlertRow): Alert => ({ id: r.id, kind: r.kind, contactId: r.contact_id, title: r.title, body: r.body, actions: r.actions })
export const ALERT_COLS = { kind: 'kind', contactId: 'contact_id', title: 'title', body: 'body', actions: 'actions' } as const

// ---------- Estrategia ----------
export interface Strategy { id: string; kind: string; title: string; body: string; position: number }
export const strategy = (r: StrategyRow): Strategy => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, position: r.position })
export const STRATEGY_COLS = { kind: 'kind', title: 'title', body: 'body', position: 'position' } as const

// ---------- Ajustes ----------
export interface Plan { ticketUSD: number; closeRate: number; quoteRate: number; callsPerLead: number; workDays: number }
export interface Settings { goalUSD: number; plan: Plan; timezone: string }
export const settings = (r: SettingsRow): Settings => ({
  goalUSD: Number(r.goal_usd),
  plan: {
    ticketUSD: Number(r.ticket_usd),
    closeRate: Number(r.close_rate),
    quoteRate: Number(r.quote_rate),
    callsPerLead: r.calls_per_lead,
    workDays: r.work_days,
  },
  timezone: r.timezone,
})
export const PLAN_COLS = {
  ticketUSD: 'ticket_usd', closeRate: 'close_rate', quoteRate: 'quote_rate', callsPerLead: 'calls_per_lead', workDays: 'work_days',
} as const

export type Rates = Record<string, number>
export const rates = (currencies: { code: string; rate_per_usd: number }[]): Rates =>
  Object.fromEntries(currencies.map((c) => [c.code, Number(c.rate_per_usd)]))

export const snoozes = (rows: { item_id: string; until: string }[]): Record<string, string> =>
  Object.fromEntries(rows.map((r) => [r.item_id, r.until]))

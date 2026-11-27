import { Injectable } from '@nestjs/common'
import type { Tenant } from '../../common/auth/tenant.js'
import * as M from '../../common/utils/mappers.js'
import { TASK_TYPES } from '../../common/validation/schemas.js'
import { AccessService } from '../../core/access.service.js'
import { ClockService } from '../../core/clock.service.js'
import { SupabaseService } from '../../core/supabase.service.js'
import type { TablesUpdate } from '../../database/database.types.js'
import type { TaskBody, TaskPatch, TaskQuery } from './tasks.schemas.js'

@Injectable()
export class TasksService {
  constructor(
    private readonly sb: SupabaseService,
    private readonly clock: ClockService,
    private readonly access: AccessService,
  ) {}

  /** `at` explícito, o bien day/hour/minute relativos a hoy */
  private resolveAt(b: Pick<TaskPatch, 'at' | 'day' | 'hour' | 'minute'>): string | undefined {
    if (b.at) return b.at
    if (b.day !== undefined || b.hour !== undefined) return this.clock.at(b.day ?? 0, b.hour ?? 9, b.minute ?? 0)
    return undefined
  }

  /** El vendedor solo ve su agenda; el gerente, la de la empresa (o la de ?sellerId / ?vendedor_id) */
  async list(t: Tenant, f: TaskQuery) {
    let query = this.sb.db.from('tasks').select('*').eq('company_id', t.companyId).order('at')
    const seller = t.sellerId ?? f.sellerId
    if (seller) query = query.eq('seller_id', seller)
    if (f.date) {
      const { from, to } = this.clock.dayRange(f.date)
      query = query.gte('at', from).lt('at', to)
    }
    if (f.from) query = query.gte('at', f.from)
    if (f.to) query = query.lt('at', f.to)
    if (f.overdue === 'true') query = query.lt('at', this.clock.dayRange().from).eq('done', false)
    if (f.done) query = query.eq('done', f.done === 'true')
    if (f.contactId) query = query.eq('contact_id', f.contactId)
    return (await this.sb.q(query)).map(M.task)
  }

  /** Vendedor asignado: el vendedor se asigna a sí mismo; el gerente puede asignar a otro de su empresa */
  private async assignee(t: Tenant, requested: string | undefined) {
    if (t.role === 'vendedor' || !requested || requested === t.actorId) return t.actorId
    await this.access.seller(t, requested)
    return requested
  }

  /** addTask() */
  async create(t: Tenant, b: TaskBody) {
    if (b.contactId) await this.access.contact(t, b.contactId)
    const row = await this.sb.q(
      this.sb.db
        .from('tasks')
        .insert({
          company_id: t.companyId,
          title: b.title,
          type: b.type,
          contact_id: b.contactId ?? null,
          seller_id: await this.assignee(t, b.sellerId),
          at: this.resolveAt(b) ?? this.clock.at(0, 9, 0),
          done: b.done,
        })
        .select()
        .single(),
    )
    return M.task(row)
  }

  async update(t: Tenant, tid: string, sent: TaskPatch) {
    await this.access.task(t, tid)
    if (sent.contactId) await this.access.contact(t, sent.contactId)
    const fields = { ...sent, at: this.resolveAt(sent) }
    if (sent.sellerId !== undefined) fields.sellerId = await this.assignee(t, sent.sellerId)
    const patch = M.toRow(fields, M.TASK_COLS) as TablesUpdate<'tasks'>
    const row = await this.sb.q(this.sb.db.from('tasks').update(patch).eq('id', tid).select().single())
    return M.task(row)
  }

  /** toggleTask(): al completarla deja constancia en la línea de tiempo del contacto */
  async toggle(t: Tenant, tid: string) {
    const { db, q } = this.sb
    const task = await this.access.task(t, tid)
    const row = await q(db.from('tasks').update({ done: !task.done }).eq('id', tid).select().single())
    let activity: M.Activity | null = null
    if (!task.done && task.contact_id) {
      const type = (TASK_TYPES as readonly string[]).includes(task.type) ? task.type : 'nota'
      activity = M.activity(
        await q(
          db
            .from('activities')
            .insert({ company_id: t.companyId, contact_id: task.contact_id, type, text: `Tarea completada: ${task.title}`, author_id: t.actorId })
            .select()
            .single(),
        ),
      )
    }
    return { task: M.task(row), activity }
  }

  async remove(t: Tenant, tid: string) {
    await this.access.task(t, tid)
    await this.sb.q(this.sb.db.from('tasks').delete().eq('id', tid))
  }
}

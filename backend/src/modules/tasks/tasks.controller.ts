import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentTenant, type Tenant, wholeCompany } from '../../common/auth/tenant.js'
import { id } from '../../common/validation/schemas.js'
import { ZBody, ZParam, ZQuery } from '../../common/validation/zod.js'
import { type TaskBody, taskBody, type TaskPatch, taskPatch, type TaskQuery, taskQuery } from './tasks.schemas.js'
import { TasksService } from './tasks.service.js'

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  /** Agenda */
  @Get()
  list(@CurrentTenant() t: Tenant, @ZQuery(taskQuery) f: TaskQuery) {
    return this.tasks.list(t, f)
  }

  /** addTask() */
  @Post()
  create(@CurrentTenant() t: Tenant, @ZBody(taskBody) b: TaskBody) {
    return this.tasks.create(wholeCompany(t), b)
  }

  @Patch(':id')
  update(@CurrentTenant() t: Tenant, @ZParam('id', id) tid: string, @ZBody(taskPatch, { onlySent: true }) b: TaskPatch) {
    return this.tasks.update(wholeCompany(t), tid, b)
  }

  /** toggleTask() → { task, activity } */
  @Post(':id/toggle')
  @HttpCode(200)
  toggle(@CurrentTenant() t: Tenant, @ZParam('id', id) tid: string) {
    return this.tasks.toggle(wholeCompany(t), tid)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentTenant() t: Tenant, @ZParam('id', id) tid: string) {
    await this.tasks.remove(wholeCompany(t), tid)
  }
}

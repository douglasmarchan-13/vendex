import { Controller, Get, Query, Res } from '@nestjs/common'
import { ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Public } from '../../common/auth/auth.decorators.js'
import { AppConfig } from '../../core/app-config.js'
import { SupabaseService } from '../../core/supabase.service.js'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: AppConfig,
    private readonly supabase: SupabaseService,
  ) {}

  /** Salud del servidor (sin autenticación). `?db=1` también verifica la conexión con Supabase. */
  @Public()
  @Get()
  @ApiQuery({ name: 'db', required: false, description: 'Si viene, comprueba la base de datos' })
  async health(@Query('db') db: string | undefined, @Res({ passthrough: true }) res: Response) {
    const out: { ok: boolean; time: string; timezone: string; db?: string } = {
      ok: true,
      time: new Date().toISOString(),
      timezone: this.config.timezone,
    }
    if (db) {
      const { error } = await this.supabase.db.from('app_settings').select('id').limit(1)
      out.db = error ? `error: ${error.message}` : 'ok'
      out.ok = !error
    }
    res.status(out.ok ? 200 : 503)
    return out
  }
}

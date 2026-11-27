import { Injectable } from '@nestjs/common'
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database/database.types.js'
import { ApiError } from '../common/errors/api-error.js'
import { fromDbError } from '../common/errors/db-errors.js'
import { AppConfig } from './app-config.js'

type Functions = Database['public']['Functions']
type DbResult = { data: unknown; error: PostgrestError | null }
/** Tipo de `data` cuando la consulta no falló */
type DataOf<R> = Extract<R, { error: null }> extends { data: infer D } ? D : never

/** Cliente con service_role (omite RLS) + helpers que convierten errores de la base en respuestas HTTP. */
@Injectable()
export class SupabaseService {
  readonly db: SupabaseClient<Database>

  constructor(config: AppConfig) {
    this.db = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  // Los helpers son funciones flecha para poder desestructurarlos: `const { db, q, one } = this.sb`

  /** Ejecuta una consulta y devuelve `data`, o lanza el error HTTP correspondiente */
  readonly q = async <R extends DbResult>(builder: PromiseLike<R>): Promise<DataOf<R>> => {
    const { data, error } = await builder
    if (error) throw fromDbError(error)
    return data as DataOf<R>
  }

  /** Como q(), pero 404 si no hay fila. Pensado para consultas que terminan en .maybeSingle() */
  readonly one = async <R extends DbResult>(builder: PromiseLike<R>, what = 'Registro'): Promise<NonNullable<DataOf<R>>> => {
    const data = await this.q(builder)
    if (data === null || data === undefined) throw new ApiError(404, `${what} no encontrado`)
    return data as NonNullable<DataOf<R>>
  }

  /** Llama una función RPC de Postgres, tipada con database.types.ts */
  readonly rpc = async <F extends keyof Functions>(fn: F, args: Functions[F]['Args']): Promise<Functions[F]['Returns']> => {
    const { data, error } = await this.db.rpc(fn as never, args as never)
    if (error) throw fromDbError(error)
    return data as Functions[F]['Returns']
  }
}

import { Body, Param, type PipeTransform, Query } from '@nestjs/common'
import { ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger'
import { z } from 'zod'
import { ApiError } from '../errors/api-error.js'

interface ZodPipeOptions {
  /**
   * Solo conserva las claves que venían en la petición. Útil en PATCH: los `.default()` del esquema
   * no deben pisar campos que el cliente no envió.
   */
  onlySent?: boolean
}

/** Valida y transforma con un esquema Zod; 400 `{ error, details: [{ field, message }] }` si falla. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform {
  constructor(
    private readonly schema: S,
    private readonly opts: ZodPipeOptions = {},
  ) {}

  transform(value: unknown): z.output<S> {
    return parse(this.schema, value, this.opts)
  }
}

export function parse<S extends z.ZodType>(schema: S, value: unknown, opts: ZodPipeOptions = {}): z.output<S> {
  // Sin body (undefined) se valida como objeto vacío, igual que el backend anterior
  const r = schema.safeParse(value ?? {})
  if (!r.success) {
    throw new ApiError(
      400,
      'Datos no válidos',
      r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    )
  }
  if (opts.onlySent && r.data && typeof r.data === 'object' && value && typeof value === 'object') {
    const sent = value as Record<string, unknown>
    return Object.fromEntries(Object.entries(r.data).filter(([k]) => k in sent)) as z.output<S>
  }
  return r.data
}

/** JSON Schema (OpenAPI 3.0) de la ENTRADA del esquema, para Swagger */
function openApi(schema: z.ZodType): Record<string, unknown> {
  try {
    const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { io: 'input', target: 'openapi-3.0', unrepresentable: 'any' })
    return json
  } catch {
    return {}
  }
}

/** Aplica un decorador de método (Swagger) desde un decorador de parámetro */
function asMethodDecorator(target: object, key: string | symbol | undefined, decorator: MethodDecorator) {
  if (!key) return
  const descriptor = Object.getOwnPropertyDescriptor(target, key)
  if (descriptor) decorator(target, key, descriptor)
}

/** `@ZBody(schema)` → body validado con Zod y documentado en Swagger */
export function ZBody<S extends z.ZodType>(schema: S, opts?: ZodPipeOptions): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodPipe(schema, opts))(target, key, index)
    asMethodDecorator(target, key, ApiBody({ schema: openApi(schema) }))
  }
}

/** `@ZQuery(z.object({...}))` → query string validada y cada parámetro documentado en Swagger */
export function ZQuery<S extends z.ZodObject>(schema: S): ParameterDecorator {
  return (target, key, index) => {
    Query(new ZodPipe(schema))(target, key, index)
    for (const [name, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
      asMethodDecorator(target, key, ApiQuery({ name, required: !field.safeParse(undefined).success, schema: openApi(field) }))
    }
  }
}

/** `@ZParam('id', schema)` → parámetro de ruta validado */
export function ZParam<S extends z.ZodType>(name: string, schema: S): ParameterDecorator {
  return (target, key, index) => {
    Param(name, new ZodPipe(schema))(target, key, index)
    asMethodDecorator(target, key, ApiParam({ name, schema: openApi(schema) }))
  }
}

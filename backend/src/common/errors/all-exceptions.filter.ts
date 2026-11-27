import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ApiError } from './api-error.js'

/**
 * Todas las respuestas de error tienen la forma `{ error, details? }`.
 * En producción no se exponen detalles de errores 5xx.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('API')

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const req = ctx.getRequest<Request>()
    const res = ctx.getResponse<Response>()
    const { status, error, details, known } = this.normalize(exception, req)

    if (status >= 500) this.logger.error((exception as Error)?.cause ?? exception)
    const showDetails = details !== undefined && (status < 500 || !this.isProduction)
    res.status(status).json({
      error: status >= 500 && !known ? 'Error interno del servidor' : error,
      ...(showDetails ? { details } : {}),
    })
  }

  private normalize(e: unknown, req: Request): { status: number; error: string; details?: unknown; known: boolean } {
    if (e instanceof ApiError) {
      const body = e.getResponse() as { error: string; details?: unknown }
      return { status: e.getStatus(), error: body.error, details: body.details, known: true }
    }
    // Errores de body-parser: Nest los envuelve en una HttpException con el original en `cause`
    const bodyError = ((e as Error)?.cause ?? e) as { type?: string }
    if (bodyError?.type === 'entity.parse.failed') return { status: 400, error: 'JSON mal formado', known: true }
    if (bodyError?.type === 'entity.too.large') return { status: 413, error: 'El cuerpo de la petición es demasiado grande', known: true }

    if (e instanceof HttpException) {
      const status = e.getStatus()
      if (status === 404) return { status, error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`, known: true }
      const body = e.getResponse()
      const message = typeof body === 'string' ? body : ((body as { message?: unknown }).message ?? e.message)
      return { status, error: Array.isArray(message) ? message.join(', ') : String(message), known: true }
    }
    return { status: 500, error: 'Error interno del servidor', details: (e as Error)?.message, known: false }
  }
}

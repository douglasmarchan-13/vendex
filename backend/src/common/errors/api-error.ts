import { HttpException } from '@nestjs/common'

/** Error de la API. Se responde como `{ error: message, details? }` (mismo formato que el backend anterior). */
export class ApiError extends HttpException {
  constructor(
    status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super({ error: message, ...(details !== undefined ? { details } : {}) }, status)
  }
}

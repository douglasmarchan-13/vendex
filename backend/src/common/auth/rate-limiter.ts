import { Injectable } from '@nestjs/common'
import { ApiError } from '../errors/api-error.js'

/**
 * Límite de intentos en memoria (ventana fija) para login, recuperación e invitaciones.
 * Basta para una sola instancia; con varias réplicas, mover a Redis o a la base.
 */
@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, { n: number; resetAt: number }>()

  /** Lanza 429 si `key` superó `max` intentos en la ventana de `windowMs` */
  hit(key: string, max: number, windowMs: number) {
    const now = Date.now()
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k)
    const h = this.hits.get(key)
    if (!h || h.resetAt <= now) {
      this.hits.set(key, { n: 1, resetAt: now + windowMs })
      return
    }
    if (++h.n > max) throw new ApiError(429, 'Demasiados intentos. Espera un momento e inténtalo de nuevo.')
  }

  reset() {
    this.hits.clear()
  }
}

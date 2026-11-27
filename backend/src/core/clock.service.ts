import { Injectable } from '@nestjs/common'
import { AppConfig } from './app-config.js'

interface Parts { y: number; mo: number; d: number; h: number; mi: number; s: number }

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function partsIn(date: Date, tz: string): Parts {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    fmtCache.set(tz, f)
  }
  const p: Record<string, string> = {}
  for (const x of f.formatToParts(date)) p[x.type] = x.value
  return { y: +p.year!, mo: +p.month!, d: +p.day!, h: +p.hour!, mi: +p.minute!, s: +p.second! }
}

/** Desfase (ms) de la zona horaria respecto a UTC en un instante dado */
function offsetAt(ts: number, tz: string): number {
  const p = partsIn(new Date(ts), tz)
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - ts
}

/** Fecha/hora local de la zona `tz` → ISO UTC */
function zonedToIso(y: number, mo: number, d: number, h: number, mi: number, tz: string): string {
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  let ts = guess - offsetAt(guess, tz)
  ts = guess - offsetAt(ts, tz) // segunda pasada por cambios de horario
  return new Date(ts).toISOString()
}

/** Fechas en la zona horaria del negocio (BUSINESS_TZ). Mismo criterio que el frontend y que vx_at() en SQL. */
@Injectable()
export class ClockService {
  readonly tz: string

  constructor(config: AppConfig) {
    this.tz = config.timezone
  }

  /** Equivalente a at(n, h, m) del frontend: hoy + n días a la hora h:m local */
  at(days = 0, hour = 9, minute = 0): string {
    const t = partsIn(new Date(), this.tz)
    const base = new Date(Date.UTC(t.y, t.mo - 1, t.d + days))
    return zonedToIso(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, minute, this.tz)
  }

  /** Días de calendario entre hoy e `iso`; negativo = en el pasado (igual que diffDays del frontend) */
  diffDays(iso: string): number {
    const a = partsIn(new Date(iso), this.tz)
    const b = partsIn(new Date(), this.tz)
    return Math.round((Date.UTC(a.y, a.mo - 1, a.d) - Date.UTC(b.y, b.mo - 1, b.d)) / 86_400_000)
  }

  /** Hoy en la zona del negocio, YYYY-MM-DD */
  today(): string {
    const t = partsIn(new Date(), this.tz)
    return `${t.y}-${String(t.mo).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`
  }

  /** Día local `YYYY-MM-DD` a la hora h:m → ISO UTC (los minutos pueden pasar de 59) */
  localIso(ymd: string, hour = 9, minute = 0): string {
    const [y, mo, d] = ymd.split('-').map(Number) as [number, number, number]
    return zonedToIso(y, mo, d, hour, minute, this.tz)
  }

  /** Rango [inicio, fin) del día local `YYYY-MM-DD` (o de hoy) en ISO UTC */
  dayRange(ymd?: string): { from: string; to: string } {
    let y: number, mo: number, d: number
    if (ymd) [y, mo, d] = ymd.split('-').map(Number) as [number, number, number]
    else ({ y, mo, d } = partsIn(new Date(), this.tz))
    const next = new Date(Date.UTC(y, mo - 1, d + 1))
    return {
      from: zonedToIso(y, mo, d, 0, 0, this.tz),
      to: zonedToIso(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, this.tz),
    }
  }
}

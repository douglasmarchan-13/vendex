import { request } from 'node:https'
import { rootCertificates } from 'node:tls'
import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common'
import { AppConfig } from '../../../core/app-config.js'
import { SupabaseService } from '../../../core/supabase.service.js'
import { type OfficialRate, type RateSource, readSource, SOURCES } from './sources.js'

export interface SourceResult {
  code: string
  source: string
  ok: boolean
  rate?: number
  date?: string
  url?: string
  error?: string
}

const TIMEOUT_MS = 20_000
const MAX_BYTES = 5 * 1024 * 1024
// Reutiliza la última lectura durante unos minutos (varios gerentes pulsando "actualizar" a la vez)
const CACHE_MS = 10 * 60_000

/** GET con verificación TLS; `extraCa` agrega intermedios a las raíces de confianza de Node */
function httpGet(url: string, extraCa?: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        headers: { 'User-Agent': 'Vendex/1.0 (tipo de cambio)', Accept: 'text/html,application/json' },
        ...(extraCa ? { ca: [...rootCertificates, ...extraCa] } : {}),
        timeout: TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (c: Buffer) => {
          size += c.length
          if (size > MAX_BYTES) req.destroy(new Error('respuesta demasiado grande'))
          else chunks.push(c)
        })
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('tiempo de espera agotado')))
    req.on('error', reject)
    req.end()
  })
}

/**
 * Tipo de cambio oficial desde el banco central de cada país (ver sources.ts).
 *  · Manual: el gerente pulsa "Traer tasas oficiales" → syncCompany() (siempre aplica).
 *  · Automático: al arrancar y cada RATES_SYNC_HOURS horas → syncAll(). Solo escribe cuando
 *    el banco publica un valor distinto del último leído, así un ajuste manual del gerente se
 *    respeta hasta la siguiente publicación oficial.
 */
@Injectable()
export class OfficialRatesService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('TipoDeCambio')
  private timer?: NodeJS.Timeout
  private interval?: NodeJS.Timeout
  private cache?: { at: number; results: SourceResult[] }
  private inflight?: Promise<SourceResult[]>
  /** Último valor oficial aplicado por la sincronización automática, por moneda */
  private readonly lastApplied = new Map<string, number>()

  constructor(
    private readonly sb: SupabaseService,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.ratesAutoSync) return
    const every = this.config.ratesSyncHours * 3_600_000
    const run = () => void this.syncAll().catch((e) => this.log.error(`Sincronización fallida: ${(e as Error).message}`))
    // Primera lectura poco después de arrancar, sin demorar el inicio del servidor
    this.timer = setTimeout(run, 5_000).unref()
    this.interval = setInterval(run, every).unref()
  }

  onModuleDestroy() {
    clearTimeout(this.timer)
    clearInterval(this.interval)
  }

  /** Lee todas las fuentes (en paralelo); una que falle no impide las demás */
  fetchAll(force = false): Promise<SourceResult[]> {
    if (!force && this.cache && Date.now() - this.cache.at < CACHE_MS) return Promise.resolve(this.cache.results)
    this.inflight ??= Promise.all(SOURCES.map((s) => this.fetchOne(s)))
      .then((results) => {
        this.cache = { at: Date.now(), results }
        return results
      })
      .finally(() => {
        this.inflight = undefined
      })
    return this.inflight
  }

  private async fetchOne(src: RateSource): Promise<SourceResult> {
    const url = src.url(new Date())
    try {
      const r: OfficialRate = readSource(src, await httpGet(url, src.extraCa), url)
      return { ok: true, ...r }
    } catch (e) {
      const error = (e as Error).message
      this.log.warn(`${src.source} (${src.code}): ${error}`)
      return { code: src.code, source: src.source, ok: false, error }
    }
  }

  /** Lecturas correctas de monedas que existen en el catálogo */
  private async usable(results: SourceResult[]) {
    const known = new Set((await this.sb.q(this.sb.db.from('currencies').select('code'))).map((c) => c.code))
    return results.filter((r) => r.ok && known.has(r.code))
  }

  /** Guarda las tasas oficiales en una empresa (botón del gerente) */
  async syncCompany(companyId: string): Promise<SourceResult[]> {
    const results = await this.fetchAll()
    const ok = await this.usable(results)
    if (ok.length) {
      await this.sb.q(
        this.sb.db
          .from('company_currency_rates')
          .upsert(ok.map((r) => ({ company_id: companyId, code: r.code, rate_per_usd: r.rate! })), { onConflict: 'company_id,code' }),
      )
    }
    return results
  }

  /** Actualiza todas las empresas y el valor inicial de las nuevas (currencies) */
  async syncAll(): Promise<SourceResult[]> {
    const results = await this.fetchAll(true)
    const changed = (await this.usable(results)).filter((r) => this.lastApplied.get(r.code) !== r.rate)
    if (!changed.length) return results

    const { db, q } = this.sb
    const companies = await q(db.from('companies').select('id'))
    for (const r of changed) {
      await q(db.from('currencies').update({ rate_per_usd: r.rate! }).eq('code', r.code))
      if (companies.length) {
        await q(
          db
            .from('company_currency_rates')
            .upsert(companies.map((c) => ({ company_id: c.id, code: r.code, rate_per_usd: r.rate! })), { onConflict: 'company_id,code' }),
        )
      }
      this.lastApplied.set(r.code, r.rate!)
      this.log.log(`${r.code} = ${r.rate} (${r.source}, fecha valor ${r.date}) → ${companies.length} empresa(s)`)
    }
    return results
  }
}

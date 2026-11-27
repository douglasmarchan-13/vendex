import { randomBytes } from 'node:crypto'
import { z } from 'zod'

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())))

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const envSchema = (isProd: boolean) =>
  z
    .object({
      PORT: z.coerce.number().int().positive().default(4000),
      SUPABASE_URL: z.url({ error: 'debe ser la URL del proyecto (Settings → API)' }),
      SUPABASE_SERVICE_ROLE_KEY: z.string({ error: 'falta la clave service_role' }).min(1, 'falta la clave service_role'),
      CORS_ORIGIN: z.string().default('http://localhost:5173'),
      BUSINESS_TZ: z.string().default('America/Lima').refine(isTimeZone, 'no es una zona horaria IANA válida'),
      REQUIRE_AUTH: bool(false),
      DEFAULT_SELLER_ID: z.string().min(1).default('andres'),
      ALLOW_DEMO_RESET: bool(!isProd),
      // Sesiones (JWT HS256)
      JWT_SECRET: z.string().optional(),
      JWT_TTL: z
        .string()
        .regex(/^\d+[mhd]$/, 'usa un número seguido de m, h o d (p. ej. 8h)')
        .default('8h'),
      // Enlaces de los correos (invitación / recuperación de clave)
      APP_URL: z.url({ error: 'debe ser la URL pública del frontend' }).default('http://localhost:5173'),
      // Correo: console = solo se imprime en el log (desarrollo) · resend = API de Resend
      MAIL_DRIVER: z.enum(['console', 'resend']).default('console'),
      RESEND_API_KEY: z.string().optional(),
      MAIL_FROM: z.string().default('Vendex <no-reply@localhost>'),
    })
    .superRefine((e, ctx) => {
      if ((e.REQUIRE_AUTH || isProd) && (e.JWT_SECRET ?? '').length < 32) {
        ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'obligatorio (mínimo 32 caracteres) con REQUIRE_AUTH=true o en producción' })
      }
      if (e.MAIL_DRIVER === 'resend' && !e.RESEND_API_KEY) {
        ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'obligatorio con MAIL_DRIVER=resend' })
      }
      if (isProd && e.MAIL_DRIVER === 'console') {
        // console imprime los enlaces de acceso en el log: no se permite en producción
        ctx.addIssue({ code: 'custom', path: ['MAIL_DRIVER'], message: 'en producción usa resend' })
      }
    })

type Env = z.output<ReturnType<typeof envSchema>>

/** Configuración tipada y validada al arrancar: si falta algo, el servidor no inicia. */
export class AppConfig {
  readonly isProduction: boolean
  readonly port: number
  readonly supabaseUrl: string
  readonly supabaseServiceKey: string
  readonly corsOrigin: string[]
  readonly timezone: string
  readonly requireAuth: boolean
  readonly defaultSellerId: string
  readonly allowDemoReset: boolean
  readonly jwtSecret: string
  /** true si no se configuró JWT_SECRET (solo en desarrollo): las sesiones se pierden al reiniciar */
  readonly jwtSecretEphemeral: boolean
  readonly jwtTtl: string
  readonly appUrl: string
  readonly mailDriver: 'console' | 'resend'
  readonly resendApiKey: string
  readonly mailFrom: string

  private constructor(env: Env, isProduction: boolean) {
    this.isProduction = isProduction
    this.port = env.PORT
    this.supabaseUrl = env.SUPABASE_URL
    this.supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY
    this.corsOrigin = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    this.timezone = env.BUSINESS_TZ
    this.requireAuth = env.REQUIRE_AUTH
    this.defaultSellerId = env.DEFAULT_SELLER_ID
    this.allowDemoReset = env.ALLOW_DEMO_RESET
    this.jwtSecretEphemeral = !env.JWT_SECRET
    this.jwtSecret = env.JWT_SECRET || randomBytes(48).toString('base64url')
    this.jwtTtl = env.JWT_TTL
    this.appUrl = env.APP_URL.replace(/\/+$/, '')
    this.mailDriver = env.MAIL_DRIVER
    this.resendApiKey = env.RESEND_API_KEY ?? ''
    this.mailFrom = env.MAIL_FROM
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const isProd = env.NODE_ENV === 'production'
    const r = envSchema(isProd).safeParse(env)
    if (!r.success) {
      const lines = r.error.issues.map((i) => `  · ${i.path.join('.')}: ${i.message}`).join('\n')
      throw new Error(`Configuración no válida. Copia .env.example a .env y complétalo:\n${lines}`)
    }
    return new AppConfig(r.data, isProd)
  }
}

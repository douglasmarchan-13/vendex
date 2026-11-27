import { Global, Module } from '@nestjs/common'
import { RateLimiter } from '../common/auth/rate-limiter.js'
import { SessionService } from '../common/auth/session.service.js'
import { AccessService } from './access.service.js'
import { AppConfig } from './app-config.js'
import { ClockService } from './clock.service.js'
import { MailService } from './mail.service.js'
import { SupabaseService } from './supabase.service.js'

/** Servicios compartidos por todos los módulos: configuración, base de datos, reloj, sesión y correo. */
@Global()
@Module({
  providers: [
    { provide: AppConfig, useFactory: () => AppConfig.fromEnv() },
    SupabaseService,
    ClockService,
    SessionService,
    MailService,
    RateLimiter,
    AccessService,
  ],
  exports: [AppConfig, SupabaseService, ClockService, SessionService, MailService, RateLimiter, AccessService],
})
export class CoreModule {}

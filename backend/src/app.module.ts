import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthGuard } from './common/auth/auth.guard.js'
import { CoreModule } from './core/core.module.js'
import { AlertsModule } from './modules/alerts/alerts.module.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { BootstrapModule } from './modules/bootstrap/bootstrap.module.js'
import { CatalogsModule } from './modules/catalogs/catalogs.module.js'
import { ContactsModule } from './modules/contacts/contacts.module.js'
import { DealsModule } from './modules/deals/deals.module.js'
import { HealthController } from './modules/health/health.controller.js'
import { ImportsModule } from './modules/imports/imports.module.js'
import { InvitationsModule } from './modules/invitations/invitations.module.js'
import { PaymentsModule } from './modules/payments/payments.module.js'
import { PlatformModule } from './modules/platform/platform.module.js'
import { SettingsModule } from './modules/settings/settings.module.js'
import { StrategyModule } from './modules/strategy/strategy.module.js'
import { TasksModule } from './modules/tasks/tasks.module.js'

@Module({
  imports: [
    CoreModule,
    AuthModule,
    InvitationsModule,
    PlatformModule,
    BootstrapModule,
    CatalogsModule,
    ContactsModule,
    DealsModule,
    PaymentsModule,
    TasksModule,
    ImportsModule,
    AlertsModule,
    StrategyModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  // Todas las rutas pasan por AuthGuard (sesión + rol) salvo las marcadas con @Public()
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}

import { Module } from '@nestjs/common'
import { OfficialRatesService } from './official-rates/official-rates.service.js'
import { SettingsController, SnoozesController } from './settings.controller.js'
import { SettingsService } from './settings.service.js'

@Module({
  controllers: [SettingsController, SnoozesController],
  providers: [SettingsService, OfficialRatesService],
})
export class SettingsModule {}

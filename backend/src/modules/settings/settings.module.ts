import { Module } from '@nestjs/common'
import { SettingsController, SnoozesController } from './settings.controller.js'
import { SettingsService } from './settings.service.js'

@Module({
  controllers: [SettingsController, SnoozesController],
  providers: [SettingsService],
})
export class SettingsModule {}

import { Module } from '@nestjs/common'
import { CatalogsModule } from '../catalogs/catalogs.module.js'
import { BootstrapController } from './bootstrap.controller.js'
import { BootstrapService } from './bootstrap.service.js'

@Module({
  imports: [CatalogsModule],
  controllers: [BootstrapController],
  providers: [BootstrapService],
})
export class BootstrapModule {}

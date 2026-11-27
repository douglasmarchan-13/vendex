import { Module } from '@nestjs/common'
import { ContactsModule } from '../contacts/contacts.module.js'
import { DealsController } from './deals.controller.js'
import { DealsService } from './deals.service.js'

@Module({
  imports: [ContactsModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}

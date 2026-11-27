import { Module } from '@nestjs/common'
import { ContactFilesController } from './contact-files.controller.js'
import { ContactFilesService } from './contact-files.service.js'
import { ContactsController } from './contacts.controller.js'
import { ContactsService } from './contacts.service.js'

@Module({
  controllers: [ContactsController, ContactFilesController],
  providers: [ContactsService, ContactFilesService],
  exports: [ContactsService],
})
export class ContactsModule {}

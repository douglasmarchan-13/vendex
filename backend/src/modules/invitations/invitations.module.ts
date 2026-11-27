import { Module } from '@nestjs/common'
import { InvitationsController } from './invitations.controller.js'
import { InvitationsService } from './invitations.service.js'
import { TeamController } from './team.controller.js'

@Module({
  controllers: [InvitationsController, TeamController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}

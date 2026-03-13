import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AgentModule } from '../agent/agent.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AgentModule, UserModule, NotificationModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}

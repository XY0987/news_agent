import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AgentModule } from '../agent/agent.module';
import { CollectorModule } from '../collector/collector.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [AgentModule, CollectorModule, UserModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}

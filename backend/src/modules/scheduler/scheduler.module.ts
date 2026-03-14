import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AgentModule } from '../agent/agent.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { CollectorModule } from '../collector/collector.module';
import { SummaryModule } from '../summary/summary.module';
import { SourceModule } from '../source/source.module';
import { FilterModule } from '../filter/filter.module';

@Module({
  imports: [
    AgentModule,
    UserModule,
    NotificationModule,
    CollectorModule,
    SummaryModule,
    SourceModule,
    FilterModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}

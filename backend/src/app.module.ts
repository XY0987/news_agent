import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './common/config/configuration';
import { UserModule } from './modules/user/user.module';
import { SourceModule } from './modules/source/source.module';
import { ContentModule } from './modules/content/content.module';
import { CollectorModule } from './modules/collector/collector.module';
import { FilterModule } from './modules/filter/filter.module';
import { ScorerModule } from './modules/scorer/scorer.module';
import { SummaryModule } from './modules/summary/summary.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AgentModule } from './modules/agent/agent.module';
import { MemoryModule } from './modules/memory/memory.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { DigestModule } from './modules/digest/digest.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    // 配置模块 - 加载 .env 文件和 configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../.env'],
    }),

    // 业务模块
    UserModule,
    SourceModule,
    ContentModule,
    CollectorModule,
    FilterModule,
    ScorerModule,
    SummaryModule,
    NotificationModule,
    AgentModule,
    MemoryModule,
    FeedbackModule,
    DigestModule,
    SchedulerModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
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
import { RedisModule } from './common/redis/redis.module';
import { LlmRateLimiterModule } from './common/llm-rate-limiter/llm-rate-limiter.module';

@Module({
  imports: [
    // 配置模块 - 加载 .env 文件和 configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../.env'],
    }),

    // 定时任务调度
    ScheduleModule.forRoot(),

    // MySQL 数据库连接
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        autoLoadEntities: true,
        timezone: '+08:00',
        synchronize: process.env.NODE_ENV !== 'production',
        logging:
          process.env.TYPEORM_LOGGING === 'true'
            ? true
            : process.env.TYPEORM_LOGGING === 'false'
              ? false
              : process.env.TYPEORM_LOGGING
                ? (process.env.TYPEORM_LOGGING.split(',') as any)
                : ['error', 'warn'],
      }),
    }),

    // Redis
    RedisModule,

    // LLM 请求限流（全局模块）
    LlmRateLimiterModule,

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

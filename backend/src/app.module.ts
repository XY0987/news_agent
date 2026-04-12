import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './common/config/configuration';
import { AuthModule } from './modules/auth/auth.module';
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
import { SkillModule } from './modules/skill/skill.module';
import { RedisModule } from './common/redis/redis.module';
import { LlmRateLimiterModule } from './common/llm-rate-limiter/llm-rate-limiter.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

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

    // 接口限频：同一 IP 60 秒内最多 60 次请求
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 60,
      },
      {
        name: 'long',
        ttl: 600000,
        limit: 300,
      },
    ]),

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

    // 认证模块
    AuthModule,

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
    SkillModule,
  ],
  providers: [
    // 全局 JWT 认证守卫
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 全局限频守卫
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

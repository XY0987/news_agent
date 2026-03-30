import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentToolRegistry } from './agent-tool-registry';
import { AgentLogEntity } from '../../common/database/entities/agent-log.entity';
import { CollectorModule } from '../collector/collector.module';
import { FilterModule } from '../filter/filter.module';
import { ScorerModule } from '../scorer/scorer.module';
import { SummaryModule } from '../summary/summary.module';
import { NotificationModule } from '../notification/notification.module';
import { MemoryModule } from '../memory/memory.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { UserModule } from '../user/user.module';
import { ContentModule } from '../content/content.module';
import { SourceModule } from '../source/source.module';
import { DigestModule } from '../digest/digest.module';
import { SkillModule } from '../skill/skill.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentLogEntity]),
    CollectorModule,
    FilterModule,
    ScorerModule,
    SummaryModule,
    NotificationModule,
    MemoryModule,
    FeedbackModule,
    UserModule,
    ContentModule,
    SourceModule,
    DigestModule,
    forwardRef(() => SkillModule),
  ],
  controllers: [AgentController],
  providers: [AgentService, AgentToolRegistry],
  exports: [AgentService, AgentToolRegistry],
})
export class AgentModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentToolRegistry } from './agent-tool-registry';
import { AgentLogEntity } from '../../common/database/entities/agent-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AgentLogEntity])],
  controllers: [AgentController],
  providers: [AgentService, AgentToolRegistry],
  exports: [AgentService],
})
export class AgentModule {}

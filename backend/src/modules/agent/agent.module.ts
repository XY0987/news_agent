import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentToolRegistry } from './agent-tool-registry';

@Module({
  controllers: [AgentController],
  providers: [AgentService, AgentToolRegistry],
  exports: [AgentService],
})
export class AgentModule {}

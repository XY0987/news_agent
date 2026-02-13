import { Controller } from '@nestjs/common';
import { AgentService } from './agent.service';

/**
 * Agent 交互接口
 * - POST /api/agent/chat       与 Agent 对话
 * - GET  /api/agent/suggestions 获取 Agent 建议
 * - POST /api/agent/feedback    提交对 Agent 建议的反馈
 */
@Controller('api/agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  // TODO: 实现 Agent 对话、建议获取、反馈等接口
}

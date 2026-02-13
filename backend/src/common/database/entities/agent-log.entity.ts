/**
 * Agent 决策日志实体 - 对应 agent_logs 表
 */
export class AgentLogEntity {
  id: string;
  userId: string;
  sessionId: string;
  action: string;
  input: Record<string, any>;
  output: Record<string, any>;
  reasoning: string;
  durationMs: number;
  createdAt: Date;
}

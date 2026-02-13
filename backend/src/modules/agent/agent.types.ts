/**
 * Agent 相关类型定义
 */

export interface AgentStep {
  step: number;
  thinking: string;
  toolCalls: { name: string; args: any }[];
  durationMs: number;
}

export interface AgentResult {
  report: string;
  stepsUsed: number;
}

export interface AgentExecutionLog {
  userId: string;
  sessionId: string;
  steps: AgentStep[];
  startTime: Date;
  endTime: Date;
  isSuccess: boolean;
  isFallback: boolean;
}

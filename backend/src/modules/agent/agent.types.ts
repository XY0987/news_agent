/**
 * Agent 相关类型定义
 */

export interface AgentStep {
  step: number;
  thinking: string;
  toolCalls: AgentToolCall[];
  toolResults: AgentToolResult[];
  durationMs: number;
}

export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface AgentToolResult {
  toolUseId: string;
  toolName: string;
  result: any;
  isError: boolean;
  durationMs: number;
}

export interface AgentResult {
  sessionId: string;
  report: string;
  stepsUsed: number;
  totalDurationMs: number;
  isSuccess: boolean;
  isFallback: boolean;
  digestSent: boolean;
  contentCount: number;
}

export interface AgentExecutionLog {
  userId: string;
  sessionId: string;
  steps: AgentStep[];
  startTime: Date;
  endTime: Date;
  isSuccess: boolean;
  isFallback: boolean;
  totalDurationMs: number;
}

/**
 * OpenAI Function Calling Tool 定义格式
 */
export interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Tool 执行函数类型
 */
export type ToolExecutor = (args: Record<string, any>) => Promise<any>;

/**
 * 内部 Tool 注册项
 */
export interface ToolRegistryEntry {
  definition: OpenAIToolDefinition;
  execute: ToolExecutor;
}

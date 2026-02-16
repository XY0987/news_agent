import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { AgentToolRegistry } from './agent-tool-registry';
import { AgentLogEntity } from '../../common/database/entities/agent-log.entity';
import { CollectorService } from '../collector/collector.service';
import { FilterService } from '../filter/filter.service';
import { ScorerService } from '../scorer/scorer.service';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import { SourceService } from '../source/source.service';
import type {
  AgentResult,
  AgentStep,
  AgentToolCall,
  AgentToolResult,
} from './agent.types';

/**
 * Agent 核心服务 - 智能信息管家的"大脑"
 *
 * 自建 Agent Loop（使用 OpenAI 兼容接口，手写循环）
 *   - 手动解析 tool_calls 协议
 *   - 手写循环控制（maxSteps）
 *   - 手动处理并行 Tool Call
 *   - 手动管理上下文/Token
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly openai: OpenAI;
  private readonly model: string;
  private readonly maxSteps = 15;
  private readonly maxMessageRounds = 20;

  constructor(
    @InjectRepository(AgentLogEntity)
    private readonly agentLogRepo: Repository<AgentLogEntity>,
    private readonly toolRegistry: AgentToolRegistry,
    private readonly collectorService: CollectorService,
    private readonly filterService: FilterService,
    private readonly scorerService: ScorerService,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly sourceService: SourceService,
    private readonly configService: ConfigService,
  ) {
    const baseURL = this.configService.get<string>('LLM_URL') || 'https://api.openai.com/v1';
    const apiKey = this.configService.get<string>('LLM_API_KEY') || '';
    this.model = this.configService.get<string>('LLM_MODEL') || 'gpt-4o';
    this.openai = new OpenAI({ baseURL, apiKey });
    this.logger.log(`Agent LLM 初始化: baseURL=${baseURL}, model=${this.model}`);
  }

  /**
   * 执行每日推送任务 - Agent 核心入口
   */
  async runDailyDigest(userId: string): Promise<AgentResult> {
    const sessionId = uuidv4();
    const startTime = Date.now();
    this.logger.log(`[${sessionId}] Agent 开始执行每日推送任务, userId=${userId}`);

    try {
      // 获取用户画像
      const user = await this.userService.findById(userId);
      const tools = this.toolRegistry.getToolDefinitions();

      // 构建初始消息
      const systemPrompt = this.buildAgentSystemPrompt(user);
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `执行今日信息采集和推送任务。
当前时间: ${new Date().toISOString()}
用户 ID: ${userId}
用户名: ${user.name}
你的目标是为用户产出一份高质量的每日精选推送。
请自主决定执行步骤，合理使用可用工具。
完成后输出最终的执行报告。`,
        },
      ];

      const steps: AgentStep[] = [];
      let digestSent = false;
      let contentCount = 0;

      // ========== Agent Loop 核心 ==========
      for (let step = 0; step < this.maxSteps; step++) {
        const stepStart = Date.now();

        // 1. 调用 LLM —— 让 Agent "思考"
        this.logger.log(`[${sessionId}] Step ${step + 1}: 调用 LLM...`);

        let response: OpenAI.ChatCompletion;
        try {
          response = await this.openai.chat.completions.create({
            model: this.model,
            max_tokens: 4096,
            messages,
            tools: tools as OpenAI.ChatCompletionTool[],
            tool_choice: 'auto',
          });
        } catch (error) {
          this.logger.error(
            `[${sessionId}] LLM 调用失败: ${(error as Error).message}`,
          );
          break;
        }

        const choice = response.choices[0];
        if (!choice) {
          this.logger.error(`[${sessionId}] LLM 返回空响应`);
          break;
        }

        const assistantMessage = choice.message;
        const thinking = assistantMessage.content || '';
        const toolCallsRaw = assistantMessage.tool_calls || [];

        const toolCalls: AgentToolCall[] = toolCallsRaw
          .filter((tc): tc is OpenAI.ChatCompletionMessageToolCall & { type: 'function' } => tc.type === 'function')
          .map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || '{}'),
          }));

        this.logger.log(
          `[${sessionId}] Step ${step + 1}: 思考="${thinking.slice(0, 100)}...", Tool 调用=${toolCalls.length}个 [${toolCalls.map((t) => t.name).join(', ')}]`,
        );

        // 2. 如果 LLM 没有调用任何 Tool 或 finish_reason=stop —— 任务完成
        if (toolCallsRaw.length === 0 || choice.finish_reason === 'stop') {
          steps.push({
            step: step + 1,
            thinking,
            toolCalls: [],
            toolResults: [],
            durationMs: Date.now() - stepStart,
          });

          // 记录日志并返回结果
          const totalDuration = Date.now() - startTime;
          await this.logAgentExecution(userId, sessionId, steps);

          this.logger.log(
            `[${sessionId}] Agent 完成: ${steps.length} 步, ${totalDuration}ms`,
          );

          return {
            sessionId,
            report: thinking || '任务已完成',
            stepsUsed: steps.length,
            totalDurationMs: totalDuration,
            isSuccess: true,
            isFallback: false,
            digestSent,
            contentCount,
          };
        }

        // 3. 把 LLM 的完整响应加入消息历史
        messages.push(assistantMessage);

        // 4. 执行 LLM 选择的所有 Tool（支持并行）
        const toolResults: AgentToolResult[] = [];
        const toolResultMessages: OpenAI.ChatCompletionToolMessageParam[] =
          await Promise.all(
            toolCalls.map(async (tc) => {
              const toolStart = Date.now();
              try {
                const result = await this.toolRegistry.executeTool(
                  tc.name,
                  tc.args,
                );

                // 跟踪推送状态
                if (tc.name === 'send_daily_digest' && result?.success) {
                  digestSent = true;
                  contentCount = tc.args?.contentIds?.length || 0;
                }

                const resultStr = JSON.stringify(result);
                // 截断过长的结果以避免 token 超限
                const truncatedResult =
                  resultStr.length > 8000
                    ? resultStr.slice(0, 8000) + '...(结果已截断)'
                    : resultStr;

                toolResults.push({
                  toolUseId: tc.id,
                  toolName: tc.name,
                  result: truncatedResult,
                  isError: false,
                  durationMs: Date.now() - toolStart,
                });

                return {
                  role: 'tool' as const,
                  tool_call_id: tc.id,
                  content: truncatedResult,
                };
              } catch (error) {
                const errorMsg = `Tool 执行失败: ${(error as Error).message}`;
                this.logger.error(
                  `[${sessionId}] ${tc.name} 执行失败: ${(error as Error).message}`,
                );

                toolResults.push({
                  toolUseId: tc.id,
                  toolName: tc.name,
                  result: errorMsg,
                  isError: true,
                  durationMs: Date.now() - toolStart,
                });

                // Tool 执行失败 —— 告诉 LLM，让它自己决定怎么处理
                return {
                  role: 'tool' as const,
                  tool_call_id: tc.id,
                  content: errorMsg,
                };
              }
            }),
          );

        // 5. 记录这一步
        steps.push({
          step: step + 1,
          thinking,
          toolCalls,
          toolResults,
          durationMs: Date.now() - stepStart,
        });

        // 6. 把 Tool 执行结果加入消息历史，回到步骤 1
        messages.push(...toolResultMessages);

        // 7. Token 管理（当消息过长时截断早期消息）
        this.pruneMessagesIfNeeded(messages);
      }

      // 达到 maxSteps 上限
      const totalDuration = Date.now() - startTime;
      await this.logAgentExecution(userId, sessionId, steps);

      this.logger.warn(
        `[${sessionId}] Agent 达到最大步数限制 (${this.maxSteps})`,
      );

      // 如果没有发送推送，触发兜底
      if (!digestSent) {
        this.logger.warn(`[${sessionId}] Agent 未完成推送，触发兜底安全网`);
        const fallbackResult = await this.runFallback(userId, sessionId);
        return {
          sessionId,
          report: `Agent 达到最大步数限制，触发兜底推送。${fallbackResult.message}`,
          stepsUsed: steps.length,
          totalDurationMs: Date.now() - startTime,
          isSuccess: false,
          isFallback: true,
          digestSent: fallbackResult.success,
          contentCount: fallbackResult.contentCount,
        };
      }

      return {
        sessionId,
        report: `Agent 在 ${this.maxSteps} 步内完成，已发送推送`,
        stepsUsed: steps.length,
        totalDurationMs: totalDuration,
        isSuccess: true,
        isFallback: false,
        digestSent,
        contentCount,
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(
        `[${sessionId}] Agent 执行异常: ${(error as Error).message}`,
      );

      // 兜底安全网
      this.logger.warn(`[${sessionId}] 触发兜底安全网`);
      const fallbackResult = await this.runFallback(userId, sessionId);

      return {
        sessionId,
        report: `Agent 执行异常: ${(error as Error).message}。${fallbackResult.message}`,
        stepsUsed: 0,
        totalDurationMs: totalDuration,
        isSuccess: false,
        isFallback: true,
        digestSent: fallbackResult.success,
        contentCount: fallbackResult.contentCount,
      };
    }
  }

  /**
   * 兜底安全网 - Agent 失败时的最小保底流程
   * 采集全部源 → 规则过滤 → 按时效性排序 → 推送 Top 5
   */
  private async runFallback(
    userId: string,
    sessionId: string,
  ): Promise<{ success: boolean; message: string; contentCount: number }> {
    this.logger.log(`[${sessionId}] 执行兜底安全网`);

    try {
      // 1. 采集
      const collectResults = await this.collectorService.collectByUser(userId);
      const totalCollected = collectResults.reduce(
        (sum, r) => sum + r.totalCollected,
        0,
      );
      this.logger.log(`[${sessionId}] 兜底采集: ${totalCollected} 条`);

      // 2. 过滤
      const filterResult = await this.filterService.filterAndDedup({
        userId,
        minLength: 100,
        daysWindow: 7,
      });

      if (filterResult.passedIds.length === 0) {
        return {
          success: false,
          message: '兜底执行: 过滤后无可用内容',
          contentCount: 0,
        };
      }

      // 3. 评分
      const scoreResult = await this.scorerService.scoreAll({
        contentIds: filterResult.passedIds.slice(0, 50),
        userId,
      });

      // 4. 取 Top 5
      const topIds = scoreResult.scores
        .slice(0, 5)
        .map((s) => s.contentId);

      if (topIds.length === 0) {
        return {
          success: false,
          message: '兜底执行: 评分后无内容可推送',
          contentCount: 0,
        };
      }

      // 5. 推送
      const pushResult = await this.notificationService.sendDigest({
        userId,
        contentIds: topIds,
        agentNote: '（兜底推送）Agent 异常，本次为规则推送',
      });

      // 6. 记录兜底日志
      await this.agentLogRepo.save(
        this.agentLogRepo.create({
          userId,
          sessionId,
          action: 'fallback_executed',
          input: { reason: 'agent_failed_or_no_digest' },
          output: {
            collected: totalCollected,
            filtered: filterResult.passedIds.length,
            pushed: topIds.length,
          },
          reasoning: '兜底安全网触发: Agent 未产出有效推送',
          durationMs: 0,
        }),
      );

      return {
        success: pushResult.success,
        message: `兜底推送完成: ${topIds.length} 篇内容`,
        contentCount: topIds.length,
      };
    } catch (error) {
      this.logger.error(
        `[${sessionId}] 兜底执行也失败了: ${(error as Error).message}`,
      );
      return {
        success: false,
        message: `兜底执行失败: ${(error as Error).message}`,
        contentCount: 0,
      };
    }
  }

  /**
   * Agent System Prompt
   */
  private buildAgentSystemPrompt(user: any): string {
    return `你是一个智能信息管家 Agent。你的任务是为用户采集、筛选、总结高质量信息并推送。

## 你的能力（Tools）
你拥有多个工具，可以自主决定调用顺序和次数：

### 感知类工具
- read_user_profile: 读取用户画像和偏好设置
- read_feedback_history: 读取用户最近的反馈记录
- query_memory: 查询历史决策经验和记忆
- get_user_sources: 获取用户的数据源列表

### 行动类工具
- collect_wechat: 从微信公众号采集最新文章
- filter_and_dedup: 对内容进行去重和过滤
- score_contents: 对内容进行多维度评分
- generate_summary: 为单篇内容生成摘要（LLM 调用，高成本）
- batch_generate_summaries: 批量生成摘要（建议不超过 10 条）
- get_recent_contents: 获取最近采集的内容列表

### 推送类工具
- send_daily_digest: 发送每日精选推送

### 记忆类工具
- store_memory: 存储决策经验和观察
- analyze_source_quality: 分析来源质量
- suggest_source_change: 生成来源管理建议

## 你的行为准则
1. **先了解用户**：每次任务开始时，先查询用户画像和最近的反馈，了解用户当前的关注重点
2. **智能采集**：根据用户画像决定优先采集哪些来源，而不是盲目全量采集
3. **质量优先**：宁可少推也不推垃圾。如果高质量内容不够 5 条，就推 3 条
4. **自我审视**：生成摘要后，审视质量。如果不够好，可以重新生成
5. **记录经验**：每次任务完成后，总结本次的决策经验存入记忆
6. **主动建议**：如果发现来源质量下降或用户兴趣变化，主动提出建议

## 标准工作流程（参考，你可以根据实际情况调整）
1. 读取用户画像和最近反馈
2. 查询历史决策经验
3. 获取用户数据源列表
4. 采集内容
5. 过滤去重
6. 评分排序
7. 为 Top K 生成摘要
8. 发送推送
9. 分析来源质量（可选）
10. 记录本次决策经验

## 用户画像
${JSON.stringify(user.profile || {}, null, 2)}

## 用户偏好
${JSON.stringify(user.preferences || {}, null, 2)}

## 决策约束
- 最终推送内容数量: 3-7 条（质量优先，不凑数）
- 只推送与用户相关的内容（相关性评分 > 60）
- 如果某个来源连续 3 天无相关内容，在报告中建议移除
- 摘要生成只对 Top 10 以内的内容调用（控制 LLM 成本）
- 每次任务执行结束前，务必调用 send_daily_digest 发送推送

## 重要提醒
- 用户 ID 为: ${user.id}
- 所有需要 userId 参数的 Tool 调用，请使用上面的用户 ID
- 任务完成后请输出执行报告，包括采集数量、过滤数量、推送数量等关键信息`;
  }

  /**
   * Token 管理：当消息列表过长时，裁剪早期消息
   * 保留 system prompt + 第一条 user 消息 + 最近 N 轮对话
   */
  private pruneMessagesIfNeeded(messages: OpenAI.ChatCompletionMessageParam[]): void {
    const maxRounds = this.maxMessageRounds;
    if (messages.length > maxRounds * 2) {
      // 保留前两条（system + 初始 user 消息）+ 最近 N 轮
      const head = messages.slice(0, 2);
      const recent = messages.slice(-(maxRounds * 2));
      messages.length = 0;
      messages.push(...head, ...recent);
      this.logger.log(
        `消息裁剪: 保留 system + 初始消息 + 最近 ${maxRounds} 轮对话`,
      );
    }
  }

  /**
   * 记录 Agent 执行日志到数据库
   */
  async logAgentExecution(
    userId: string,
    sessionId: string,
    steps: AgentStep[],
  ): Promise<void> {
    try {
      for (const step of steps) {
        const logEntry = this.agentLogRepo.create({
          userId,
          sessionId,
          action: `step_${step.step}`,
          input: {
            toolCalls: step.toolCalls.map((tc) => ({
              name: tc.name,
              args: tc.args,
            })),
          },
          output: {
            toolResults: step.toolResults.map((tr) => ({
              toolName: tr.toolName,
              isError: tr.isError,
              durationMs: tr.durationMs,
              result:
                typeof tr.result === 'string' && tr.result.length > 2000
                  ? tr.result.slice(0, 2000) + '...'
                  : tr.result,
            })),
          },
          reasoning: step.thinking,
          durationMs: step.durationMs,
        });

        await this.agentLogRepo.save(logEntry);
      }

      this.logger.log(
        `Agent 日志已记录: sessionId=${sessionId}, ${steps.length} 步`,
      );
    } catch (error) {
      this.logger.error(
        `记录 Agent 日志失败: ${(error as Error).message}`,
      );
    }
  }

  /**
   * 获取 Agent 执行日志
   */
  async getExecutionLogs(
    userId: string,
    limit = 20,
  ): Promise<AgentLogEntity[]> {
    return this.agentLogRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 获取单次执行的完整步骤
   */
  async getSessionLogs(sessionId: string): Promise<AgentLogEntity[]> {
    return this.agentLogRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 获取最近的 session 列表（按 sessionId 分组）
   */
  async getRecentSessions(
    userId: string,
    limit = 10,
  ): Promise<
    {
      sessionId: string;
      startTime: Date;
      stepCount: number;
      actions: string[];
    }[]
  > {
    const logs = await this.agentLogRepo
      .createQueryBuilder('log')
      .select('log.session_id', 'sessionId')
      .addSelect('MIN(log.created_at)', 'startTime')
      .addSelect('COUNT(*)', 'stepCount')
      .addSelect("GROUP_CONCAT(log.action ORDER BY log.created_at SEPARATOR ',')", 'actions')
      .where('log.user_id = :userId', { userId })
      .groupBy('log.session_id')
      .orderBy('startTime', 'DESC')
      .limit(limit)
      .getRawMany();

    return logs.map((l) => ({
      sessionId: l.sessionId,
      startTime: l.startTime,
      stepCount: parseInt(l.stepCount, 10),
      actions: l.actions ? l.actions.split(',') : [],
    }));
  }
}

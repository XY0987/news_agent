import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { AgentToolRegistry } from './agent-tool-registry';
import { AgentLogEntity } from '../../common/database/entities/agent-log.entity';
import { EmailChannel } from '../notification/channels/email.channel';
import { UserService } from '../user/user.service';
import { SourceService } from '../source/source.service';
import { LlmRateLimiterService } from '../../common/llm-rate-limiter/llm-rate-limiter.service.js';
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
  private readonly fallbackModel: string;
  private readonly alertEmail: string;
  private readonly maxSteps = 25;
  private readonly maxMessageRounds = 20;
  /** 当前是否处于降级状态（限频切换了备用模型） */
  private usingFallback = false;
  /** 限频告警邮件冷却（同一小时内不重复发送） */
  private lastAlertTime = 0;

  constructor(
    @InjectRepository(AgentLogEntity)
    private readonly agentLogRepo: Repository<AgentLogEntity>,
    private readonly toolRegistry: AgentToolRegistry,
    private readonly emailChannel: EmailChannel,
    private readonly userService: UserService,
    private readonly sourceService: SourceService,
    private readonly configService: ConfigService,
    private readonly rateLimiter: LlmRateLimiterService,
  ) {
    const baseURL =
      this.configService.get<string>('LLM_URL') || 'https://api.openai.com/v1';
    const apiKey = this.configService.get<string>('LLM_API_KEY') || '';
    this.model = this.configService.get<string>('LLM_MODEL') || 'gpt-4o';
    this.fallbackModel =
      this.configService.get<string>('LLM_FALLBACK_MODEL') || '';
    this.alertEmail = this.configService.get<string>('ALERT_EMAIL') || '';
    this.openai = new OpenAI({ baseURL, apiKey });
    this.logger.log(
      `Agent LLM 初始化: baseURL=${baseURL}, model=${this.model}, fallback=${this.fallbackModel || '无'}`,
    );
  }

  /**
   * 判断是否为限频错误（429 / 400 业务限频 / rate limit）
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isRateLimitError(error: any): boolean {
    if (!error) return false;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const status = error.status || error.statusCode || error?.response?.status;
    if (status === 429) return true;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const msg: string = String(error.message || error.toString()).toLowerCase();
    // 标准限频关键词
    if (
      msg.includes('rate limit') ||
      msg.includes('rate_limit') ||
      msg.includes('too many requests') ||
      msg.includes('quota exceeded') ||
      msg.includes('限频')
    ) {
      return true;
    }
    // 业务层限频：HTTP 400 + 错误码 1620867020 / 消息含"频率超出"或"请求频率"
    if (status === 400) {
      if (
        msg.includes('1620867020') ||
        msg.includes('频率超出') ||
        msg.includes('请求频率') ||
        msg.includes('error_type=2')
      ) {
        return true;
      }
    }
    // 兜底：不限状态码，只要消息含业务限频特征也判定
    return (
      msg.includes('频率超出限制') ||
      msg.includes('请求频率超出') ||
      msg.includes('1620867020')
    );
  }

  /**
   * 限频时发送告警邮件（1小时内不重复发送）
   */
  private async sendRateLimitAlert(
    context: string,
    errorMsg: string,
    switchedModel?: string,
  ): Promise<void> {
    const now = Date.now();
    if (now - this.lastAlertTime < 60 * 60 * 1000) return; // 1小时冷却
    if (!this.alertEmail || !this.emailChannel.isAvailable()) {
      this.logger.warn('限频告警：告警邮箱未配置或 SMTP 不可用，跳过告警邮件');
      return;
    }
    this.lastAlertTime = now;

    const time = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
    });
    const subject = `⚠️ News Agent LLM 限频告警`;
    const html = `
      <div style="max-width:560px;margin:0 auto;padding:24px;font-family:sans-serif;">
        <h2 style="color:#dc2626;">⚠️ LLM 接口限频告警</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px;font-weight:600;color:#374151;">告警时间</td><td style="padding:8px;">${time}</td></tr>
          <tr><td style="padding:8px;font-weight:600;color:#374151;">触发位置</td><td style="padding:8px;">${context}</td></tr>
          <tr><td style="padding:8px;font-weight:600;color:#374151;">原始模型</td><td style="padding:8px;">${this.model}</td></tr>
          <tr><td style="padding:8px;font-weight:600;color:#374151;">错误信息</td><td style="padding:8px;color:#dc2626;">${errorMsg}</td></tr>
          ${switchedModel ? `<tr><td style="padding:8px;font-weight:600;color:#374151;">已切换到</td><td style="padding:8px;color:#059669;">${switchedModel}</td></tr>` : ''}
        </table>
        <p style="margin-top:16px;font-size:13px;color:#6b7280;">此邮件由 News Agent 自动发送，同一小时内不会重复告警。</p>
      </div>`;
    const text = `LLM 限频告警 - ${time}\n触发: ${context}\n错误: ${errorMsg}\n${switchedModel ? `已切换模型: ${switchedModel}` : ''}`;

    try {
      await this.emailChannel.send({
        to: this.alertEmail,
        subject,
        html,
        text,
      });
      this.logger.log(`限频告警邮件已发送至 ${this.alertEmail}`);
    } catch (e) {
      this.logger.error(`限频告警邮件发送失败: ${(e as Error).message}`);
    }
  }

  /**
   * 获取当前应使用的模型名称
   */
  private getCurrentModel(): string {
    return this.usingFallback && this.fallbackModel
      ? this.fallbackModel
      : this.model;
  }

  /**
   * 带重试的 LLM 调用（统一限频处理）
   *
   * 重试策略：
   *  1. 首次调用当前模型
   *  2. 如果限频 → 等待 30s 后用同一模型重试
   *  3. 再次限频 → 切换到备用模型
   *  4. 备用模型也限频 → 等待 60s 后最后重试
   *  5. 全部失败 → 抛出错误
   *
   * 非限频错误直接抛出，不重试
   */
  private async callLLMWithRetry(
    sessionId: string,
    messages: OpenAI.ChatCompletionMessageParam[],
    tools: OpenAI.ChatCompletionTool[],
  ): Promise<OpenAI.ChatCompletion> {
    const callLLM = async (model: string) => {
      await this.rateLimiter.acquire(`Agent[${sessionId}]`);
      return this.openai.chat.completions.create({
        model,
        max_tokens: 4096,
        messages,
        tools,
        tool_choice: 'auto',
      });
    };

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    // 第 1 次：当前模型
    try {
      return await callLLM(this.getCurrentModel());
    } catch (error) {
      if (!this.isRateLimitError(error)) throw error;

      this.logger.warn(
        `[${sessionId}] LLM 限频（第 1 次），等待 30s 后重试...`,
      );

      // 第 2 次：等待 30s，同一模型重试
      await sleep(30_000);
      try {
        return await callLLM(this.getCurrentModel());
      } catch (retryError) {
        if (!this.isRateLimitError(retryError)) throw retryError;

        // 如果有备用模型且还没切换过
        if (this.fallbackModel && !this.usingFallback) {
          this.logger.warn(
            `[${sessionId}] LLM 限频（第 2 次），切换到备用模型 ${this.fallbackModel}`,
          );
          this.usingFallback = true;
          void this.sendRateLimitAlert(
            'AgentService.callLLMWithRetry',
            (retryError as Error).message,
            this.fallbackModel,
          );

          // 第 3 次：备用模型
          try {
            return await callLLM(this.fallbackModel);
          } catch (fallbackError) {
            if (!this.isRateLimitError(fallbackError)) throw fallbackError;

            // 第 4 次：等待 60s，备用模型最后一次重试
            this.logger.warn(
              `[${sessionId}] 备用模型也限频，等待 60s 后最后重试...`,
            );
            await sleep(60_000);
            try {
              return await callLLM(this.fallbackModel);
            } catch (finalError) {
              void this.sendRateLimitAlert(
                'AgentService.callLLMWithRetry（全部失败）',
                (finalError as Error).message,
              );
              throw finalError;
            }
          }
        } else {
          // 没有备用模型，等待 60s 后最后重试
          this.logger.warn(
            `[${sessionId}] LLM 限频（第 2 次），无备用模型，等待 60s 后最后重试...`,
          );
          void this.sendRateLimitAlert(
            'AgentService.callLLMWithRetry',
            (retryError as Error).message,
          );
          await sleep(60_000);
          return await callLLM(this.getCurrentModel());
        }
      }
    }
  }

  /**
   * 执行每日推送任务 - Agent 核心入口
   */
  async runDailyDigest(userId: string): Promise<AgentResult> {
    const sessionId = uuidv4();
    const startTime = Date.now();
    this.logger.log(
      `[${sessionId}] Agent 开始执行每日推送任务, userId=${userId}`,
    );

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
          response = await this.callLLMWithRetry(
            sessionId,
            messages,
            tools as OpenAI.ChatCompletionTool[],
          );
        } catch (error) {
          this.logger.error(
            `[${sessionId}] LLM 调用最终失败: ${(error as Error).message}`,
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
          .filter(
            (
              tc,
            ): tc is OpenAI.ChatCompletionMessageToolCall & {
              type: 'function';
            } => tc.type === 'function',
          )
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

          // 记录日志
          await this.logAgentExecution(userId, sessionId, steps);

          this.logger.log(
            `[${sessionId}] Agent 完成: ${steps.length} 步, ${Date.now() - startTime}ms`,
          );

          // 如果 Agent 自行结束但未发送推送，触发兜底安全网
          if (!digestSent) {
            this.logger.warn(
              `[${sessionId}] Agent 自行结束但未完成推送，触发兜底安全网`,
            );
            const fallbackResult = await this.runFallback(userId, sessionId);
            return {
              sessionId,
              report: `Agent 结束但未发送推送，已触发兜底。${fallbackResult.message}`,
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
            report: thinking || '任务已完成',
            stepsUsed: steps.length,
            totalDurationMs: Date.now() - startTime,
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
                // 使用智能截断：保留完整 JSON 结构摘要而非粗暴截断
                const truncatedResult =
                  resultStr.length > 8000
                    ? this.smartTruncateToolResult(result, 8000)
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
   * 兜底安全网 - Agent 失败时发送告警邮件通知用户
   *
   * 不再发送低质量的无摘要推送，改为发告警邮件让用户感知到异常
   */
  private async runFallback(
    userId: string,
    sessionId: string,
  ): Promise<{ success: boolean; message: string; contentCount: number }> {
    this.logger.log(`[${sessionId}] 执行兜底安全网（发送告警邮件）`);

    try {
      // 发送告警邮件
      if (this.alertEmail && this.emailChannel.isAvailable()) {
        const time = new Date().toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
        });
        const subject = `🚨 News Agent 推送失败告警`;
        const html = `
          <div style="max-width:560px;margin:0 auto;padding:24px;font-family:sans-serif;">
            <h2 style="color:#dc2626;">🚨 Agent 推送失败</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px;font-weight:600;color:#374151;">告警时间</td><td style="padding:8px;">${time}</td></tr>
              <tr><td style="padding:8px;font-weight:600;color:#374151;">Session ID</td><td style="padding:8px;font-family:monospace;font-size:12px;">${sessionId}</td></tr>
              <tr><td style="padding:8px;font-weight:600;color:#374151;">用户 ID</td><td style="padding:8px;">${userId}</td></tr>
              <tr><td style="padding:8px;font-weight:600;color:#374151;">失败原因</td><td style="padding:8px;color:#dc2626;">Agent 未能在规定步数内完成推送任务（可能是 LLM 限频、决策异常或 Tool 执行失败）</td></tr>
            </table>
            <p style="margin-top:16px;font-size:13px;color:#6b7280;">
              请查看日志排查原因。可通过手动触发 Agent 重新执行推送。
            </p>
          </div>`;
        const text = `News Agent 推送失败告警\n时间: ${time}\nSession: ${sessionId}\n用户: ${userId}\n\nAgent 未能完成推送任务，请查看日志排查。`;

        try {
          await this.emailChannel.send({
            to: this.alertEmail,
            subject,
            html,
            text,
          });
          this.logger.log(
            `[${sessionId}] 兜底告警邮件已发送至 ${this.alertEmail}`,
          );
        } catch (e) {
          this.logger.error(
            `[${sessionId}] 兜底告警邮件发送失败: ${(e as Error).message}`,
          );
        }
      } else {
        this.logger.warn(
          `[${sessionId}] 兜底：告警邮箱未配置或 SMTP 不可用，跳过告警邮件`,
        );
      }

      // 记录兜底日志
      await this.agentLogRepo.save(
        this.agentLogRepo.create({
          userId,
          sessionId,
          action: 'fallback_alert_sent',
          input: { reason: 'agent_failed_or_no_digest' },
          output: { alertEmail: this.alertEmail || 'not_configured' },
          reasoning: '兜底安全网触发: Agent 未产出有效推送，已发送告警邮件',
          durationMs: 0,
        }),
      );

      return {
        success: false,
        message: '已发送告警邮件通知（未发送低质量兜底推送）',
        contentCount: 0,
      };
    } catch (error) {
      this.logger.error(
        `[${sessionId}] 兜底告警也失败了: ${(error as Error).message}`,
      );
      return {
        success: false,
        message: `兜底告警失败: ${(error as Error).message}`,
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
- collect_wechat: 从微信公众号采集最新文章。**返回 savedContentIds（新保存到数据库的内容 ID 列表）**
- collect_github: 从 GitHub 热点数据源采集热门仓库（支持 Trending、Topics/frontend）。**返回 savedContentIds**
- filter_and_dedup: 对内容进行去重和过滤。**必须传入采集步骤返回的 savedContentIds 作为 contentIds 参数**
- score_contents: 对内容进行初步规则评分（快速预筛，非最终评分）
- generate_summary: 为单篇内容生成 AI 摘要+精准 AI 评分（会覆盖规则评分）
- batch_generate_summaries: 批量生成 AI 摘要+评分（建议不超过 10 条）
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
4. 采集内容（collect_wechat/collect_github），**记录每个采集工具返回的 savedContentIds**
5. 过滤去重（filter_and_dedup），**必须将采集步骤返回的 savedContentIds 传入 contentIds 参数**。如果有多个采集步骤，合并所有 savedContentIds 后传入
6. 对过滤后的**所有文章**分批生成 AI 摘要+评分（batch_generate_summaries，每批最多 10 条）
   - AI 摘要会同时产出精准的多维度评分，不需要提前调用 score_contents
7. 发送推送（传入所有 successIds）
8. 分析来源质量（可选）
9. 记录本次决策经验

## ⚠️ 数据流转规则（重要）
采集 → savedContentIds → filter_and_dedup(contentIds=savedContentIds) → passedIds → batch_generate_summaries → successIds → send_daily_digest
**不要**调用 filter_and_dedup 时不传 contentIds，否则会从数据库获取所有内容，可能包含过期或非目标内容。

## 用户画像
${JSON.stringify(user.profile || {}, null, 2)}

## 用户偏好
${JSON.stringify(user.preferences || {}, null, 2)}

## 决策约束
- **必须推送所有已生成摘要的文章**（不限数量），邮件会自动按 AI 评分分区展示：高分（>=60）完整展开，低分折叠
- 评分和摘要需要分批处理：每次评分不超过 50 篇，摘要每批不超过 10 篇
- 如果文章总数超过 50 篇，请分多次调用 score_contents 和 batch_generate_summaries
- **关键**：每次 batch_generate_summaries 返回的 successIds 都要记录下来，最后传给 send_daily_digest 时要传入**全部 successIds 的合集**
- 如果某个来源连续 3 天无相关内容，在报告中建议移除
- 每次任务执行结束前，务必调用 send_daily_digest 发送推送

## 重要提醒
- 用户 ID 为: ${user.id}
- 所有需要 userId 参数的 Tool 调用，请使用上面的用户 ID
- 任务完成后请输出执行报告，包括采集数量、过滤数量、推送数量等关键信息`;
  }

  /**
   * GitHub 热点 Agent — 专注 GitHub 数据源的完整 Agent Loop
   *
   * LLM 自主决策：采集 GitHub 热点 → 过滤去重 → AI 分析 → 发送 GitHub 专属邮件
   * 只提供 GitHub 相关工具，避免 LLM 分心去处理公众号等其他来源
   */
  async runGithubTrending(userId: string): Promise<AgentResult> {
    const sessionId = uuidv4();
    const startTime = Date.now();
    this.logger.log(
      `[${sessionId}] GitHub Agent 开始执行, userId=${userId}`,
    );

    try {
      const user = await this.userService.findById(userId);
      const tools = this.toolRegistry.getToolDefinitions();

      // 只保留 GitHub 相关工具
      const githubToolNames = new Set([
        'read_user_profile',
        'get_user_sources',
        'query_memory',
        'collect_github',
        'filter_and_dedup',
        'score_contents',
        'generate_summary',
        'batch_generate_summaries',
        'get_recent_contents',
        'send_github_trending',
        'store_memory',
        'analyze_source_quality',
      ]);
      const githubTools = tools.filter((t) =>
        githubToolNames.has(t.function?.name || ''),
      );

      const systemPrompt = this.buildGithubAgentSystemPrompt(user);
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `执行 GitHub 热点采集与推送任务。
当前时间: ${new Date().toISOString()}
用户 ID: ${userId}
用户名: ${user.name}
你的目标是采集 GitHub 热门仓库，进行 AI 分析，并发送 GitHub 专属邮件推送。
请自主决定执行步骤，合理使用可用工具。
完成后输出最终的执行报告。`,
        },
      ];

      const steps: AgentStep[] = [];
      let digestSent = false;
      let contentCount = 0;

      // ========== Agent Loop ==========
      for (let step = 0; step < this.maxSteps; step++) {
        const stepStart = Date.now();

        this.logger.log(`[${sessionId}] GitHub Step ${step + 1}: 调用 LLM...`);

        let response: OpenAI.ChatCompletion;
        try {
          response = await this.callLLMWithRetry(
            sessionId,
            messages,
            githubTools as OpenAI.ChatCompletionTool[],
          );
        } catch (error) {
          this.logger.error(
            `[${sessionId}] LLM 调用最终失败: ${(error as Error).message}`,
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
          .filter(
            (
              tc,
            ): tc is OpenAI.ChatCompletionMessageToolCall & {
              type: 'function';
            } => tc.type === 'function',
          )
          .map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || '{}'),
          }));

        this.logger.log(
          `[${sessionId}] GitHub Step ${step + 1}: 思考="${thinking.slice(0, 100)}...", Tool 调用=${toolCalls.length}个 [${toolCalls.map((t) => t.name).join(', ')}]`,
        );

        // 如果没有工具调用或 stop — 任务完成
        if (toolCallsRaw.length === 0 || choice.finish_reason === 'stop') {
          steps.push({
            step: step + 1,
            thinking,
            toolCalls: [],
            toolResults: [],
            durationMs: Date.now() - stepStart,
          });

          await this.logAgentExecution(userId, sessionId, steps);

          this.logger.log(
            `[${sessionId}] GitHub Agent 完成: ${steps.length} 步, ${Date.now() - startTime}ms`,
          );

          return {
            sessionId,
            report: thinking || 'GitHub 热点任务已完成',
            stepsUsed: steps.length,
            totalDurationMs: Date.now() - startTime,
            isSuccess: digestSent,
            isFallback: false,
            digestSent,
            contentCount,
          };
        }

        // 把 LLM 响应加入消息历史
        messages.push(assistantMessage);

        // 执行工具
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
                if (tc.name === 'send_github_trending' && result?.success) {
                  digestSent = true;
                  contentCount = tc.args?.contentIds?.length || 0;
                }

                const resultStr = JSON.stringify(result);
                const truncatedResult =
                  resultStr.length > 8000
                    ? this.smartTruncateToolResult(result, 8000)
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

                return {
                  role: 'tool' as const,
                  tool_call_id: tc.id,
                  content: errorMsg,
                };
              }
            }),
          );

        steps.push({
          step: step + 1,
          thinking,
          toolCalls,
          toolResults,
          durationMs: Date.now() - stepStart,
        });

        messages.push(...toolResultMessages);
        this.pruneMessagesIfNeeded(messages);
      }

      // 达到 maxSteps 上限
      const totalDuration = Date.now() - startTime;
      await this.logAgentExecution(userId, sessionId, steps);

      this.logger.warn(
        `[${sessionId}] GitHub Agent 达到最大步数限制 (${this.maxSteps})`,
      );

      return {
        sessionId,
        report: `GitHub Agent 达到最大步数限制 (${this.maxSteps})，${digestSent ? '已发送推送' : '未能完成推送'}`,
        stepsUsed: steps.length,
        totalDurationMs: totalDuration,
        isSuccess: digestSent,
        isFallback: false,
        digestSent,
        contentCount,
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(
        `[${sessionId}] GitHub Agent 执行异常: ${(error as Error).message}`,
      );

      return {
        sessionId,
        report: `GitHub Agent 执行异常: ${(error as Error).message}`,
        stepsUsed: 0,
        totalDurationMs: totalDuration,
        isSuccess: false,
        isFallback: false,
        digestSent: false,
        contentCount: 0,
      };
    }
  }

  /**
   * GitHub Agent 专用 System Prompt
   */
  private buildGithubAgentSystemPrompt(user: any): string {
    return `你是一个专注于 GitHub 技术趋势的智能 Agent。你的任务是为用户采集 GitHub 热门仓库、进行 AI 分析，并通过 GitHub 专属邮件推送。

## 你的能力（Tools）

### 感知类工具
- read_user_profile: 读取用户画像和偏好设置
- get_user_sources: 获取用户的数据源列表（筛选 type=github）
- query_memory: 查询历史决策经验

### 行动类工具
- collect_github: 从 GitHub 热点数据源采集最新热门仓库（Trending、Topics）。**返回值包含 savedContentIds（新保存到数据库的内容 ID 列表）**
- filter_and_dedup: 对采集到的内容进行去重和基础过滤。**必须传入 contentIds 参数**
- score_contents: 规则预评分（可选，AI 摘要会产出更精准的评分）
- generate_summary: 为单个仓库生成 AI 摘要+评分
- batch_generate_summaries: 批量生成 AI 摘要+评分（建议每批不超过 10 条）
- get_recent_contents: 获取最近采集的内容

### 推送类工具
- send_github_trending: 发送 GitHub 热点趋势专属邮件（使用 GitHub 模板，展示 Star 数、新增 Star 等）

### 记忆类工具
- store_memory: 存储决策经验
- analyze_source_quality: 分析来源质量

## 推荐工作流程（严格按此执行）
1. 读取用户画像（了解技术兴趣偏好）
2. 获取用户的 GitHub 数据源列表
3. 采集 GitHub 热点仓库（collect_github），**记录返回的 savedContentIds**
4. 过滤去重（filter_and_dedup），**必须将上一步的 savedContentIds 传入 contentIds 参数**
5. 对过滤后的仓库分批生成 AI 摘要+评分（batch_generate_summaries，每批最多 10 条）
6. 发送 GitHub 热点邮件（send_github_trending，传入所有 successIds）
7. 记录本次决策经验（可选）

## ⚠️ 数据流转规则（极其重要，必须遵守）

整个流程的数据通过 ID 列表流转：

\`\`\`
collect_github → savedContentIds → filter_and_dedup(contentIds=savedContentIds) → passedIds → batch_generate_summaries(contentIds=passedIds) → successIds → send_github_trending(contentIds=successIds)
\`\`\`

**关键约束**：
- collect_github 返回的 savedContentIds 必须直接传给 filter_and_dedup 的 contentIds 参数
- **绝对不要**调用 filter_and_dedup 时不传 contentIds，否则会从数据库获取所有来源的内容（包括公众号），导致混入非 GitHub 内容
- 如果 collect_github 返回的 savedContentIds 为空（全部是去重跳过的旧数据），可以额外调用 filter_and_dedup 并设置 sourceType='github' 来获取近期 GitHub 内容

## 用户画像
${JSON.stringify(user.profile || {}, null, 2)}

## 用户偏好
${JSON.stringify(user.preferences || {}, null, 2)}

## 决策约束
- **只关注 GitHub 数据源**，不要采集或处理微信公众号等其他来源
- 必须推送所有已生成摘要的仓库（邮件会自动按 AI 评分分区展示）
- 摘要需分批处理：每批不超过 10 条
- **关键**：每次 batch_generate_summaries 返回的 successIds 都要记录下来，最后传给 send_github_trending 时要传入**全部 successIds 的合集**
- 每次任务执行结束前，务必调用 send_github_trending 发送推送
- 如果没有 GitHub 数据源或采集无结果，直接报告并结束

## 重要提醒
- 用户 ID 为: ${user.id}
- 所有需要 userId 参数的 Tool 调用，请使用上面的用户 ID
- 任务完成后请输出执行报告，包括采集数量、过滤数量、推送数量等关键信息`;
  }

  /**
   * 分析模式专用 System Prompt — 跳过采集，直接分析已有文章
   */
  private buildAnalysisSystemPrompt(user: any): string {
    return `你是一个智能信息管家 Agent。当前处于**分析模式**：数据库中已有采集好的文章，你需要对它们进行高质量的 AI 分析和推送。

## 重要：本次任务不需要采集
数据库中已有文章，不要调用 collect_wechat。直接从过滤开始工作。

## 你的能力（Tools）

### 感知类工具
- read_user_profile: 读取用户画像和偏好设置
- read_feedback_history: 读取用户最近的反馈记录
- query_memory: 查询历史决策经验和记忆
- get_user_sources: 获取用户的数据源列表

### 行动类工具
- filter_and_dedup: 对内容进行去重和过滤（从数据库获取指定时间窗口内的文章）
- collect_github: 从 GitHub 热点数据源采集热门仓库（即使在分析模式，也可按需采集 GitHub 最新热点）
- score_contents: 对内容进行初步规则评分（快速预筛，非最终评分）
- generate_summary: 为单篇内容生成 AI 摘要和精准评分（LLM 调用，会产出最终的 AI 评分并覆盖规则评分）
- batch_generate_summaries: 批量生成 AI 摘要和评分（建议每批不超过 10 条，内部并发控制为 3）
- get_recent_contents: 获取最近采集的内容列表

### 推送类工具
- send_daily_digest: 发送每日精选推送

### 记忆类工具
- store_memory: 存储决策经验和观察
- analyze_source_quality: 分析来源质量
- suggest_source_change: 生成来源管理建议

## 评分机制说明
- score_contents 是基于规则的快速预评分（关键词匹配、时间衰减等），**不够准确**
- batch_generate_summaries / generate_summary 在生成摘要时会**同时让 AI 产出精准的多维度评分**，并自动覆盖规则评分
- 因此最终评分以 AI 摘要生成后的评分为准

## 推荐工作流程
1. 读取用户画像（了解兴趣偏好，以便 AI 生成个性化摘要和评分）
2. 过滤去重（filter_and_dedup，设置合适的 daysWindow）
3. 对过滤后的文章分批生成 AI 摘要+评分（batch_generate_summaries，每批最多 10 条）
   - batch_generate_summaries 返回 successIds（成功的文章ID列表），你需要**收集所有批次的 successIds**
4. 发送推送（send_daily_digest，传入**所有批次汇总的 successIds**，即所有成功生成摘要的文章 ID）
5. 记录本次决策经验（可选）

## 用户画像
${JSON.stringify(user.profile || {}, null, 2)}

## 用户偏好
${JSON.stringify(user.preferences || {}, null, 2)}

## 决策约束
- **必须推送所有已生成摘要的文章**（不限数量），邮件会自动按 AI 评分分区展示：高分（>=60）完整展开，低分折叠
- 摘要需分批处理：每批不超过 10 条（内部会做 3 并发控制）
- 如果文章总数超过 10 篇，请分多次调用 batch_generate_summaries
- **关键**：每次 batch_generate_summaries 返回的 successIds 都要记录下来，最后传给 send_daily_digest 时要传入**全部 successIds 的合集**
- 每次任务执行结束前，务必调用 send_daily_digest 发送推送
- **不需要调用 score_contents 进行规则预评分**，因为 AI 摘要会直接产出最终评分。除非你想先快速筛选一批再精细分析

## 重要提醒
- 用户 ID 为: ${user.id}
- 所有需要 userId 参数的 Tool 调用，请使用上面的用户 ID
- 任务完成后请输出执行报告，包括过滤数量、AI 分析数量、推送数量等关键信息`;
  }

  /**
   * 智能截断 Tool 结果，保留有意义的摘要而非半截 JSON
   * 关键原则：ID 列表（successIds, contentIds, passedIds 等）必须完整保留，不能截断
   */
  private smartTruncateToolResult(result: any, maxLen: number): string {
    try {
      if (Array.isArray(result)) {
        const summary = {
          _truncated: true,
          totalItems: result.length,
          firstItems: result.slice(0, 5),
          message: `共 ${result.length} 项，仅展示前 5 项`,
        };
        const str = JSON.stringify(summary);
        return str.length > maxLen ? str.slice(0, maxLen - 50) + '..."}' : str;
      }

      if (result && typeof result === 'object') {
        // 优先保留 ID 列表字段（这些是 Agent 后续决策的关键数据）
        const idFields = [
          'successIds',
          'failedIds',
          'contentIds',
          'passedIds',
          'filteredIds',
        ];
        const summarized: Record<string, any> = { _truncated: true };

        // 第一轮：保留所有 ID 列表和数值/布尔字段
        for (const [key, value] of Object.entries(result)) {
          if (idFields.includes(key) && Array.isArray(value)) {
            // ID 列表完整保留，不截断
            summarized[key] = value;
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            summarized[key] = value;
          } else if (typeof value === 'string') {
            summarized[key] =
              value.length > 300 ? value.slice(0, 300) + '...' : value;
          }
        }

        // 检查当前大小，如果还有余量再加入 details 等字段
        const currentStr = JSON.stringify(summarized);
        if (currentStr.length < maxLen * 0.8) {
          for (const [key, value] of Object.entries(result)) {
            if (key in summarized || idFields.includes(key)) continue;
            if (Array.isArray(value)) {
              // 非 ID 数组只保留前 5 项 + 总数
              summarized[key] = {
                count: value.length,
                first5: value.slice(0, 5),
              };
            } else if (value && typeof value === 'object') {
              const valStr = JSON.stringify(value);
              summarized[key] =
                valStr.length > 300 ? valStr.slice(0, 300) + '...' : value;
            }
            // 检查是否接近上限
            const newStr = JSON.stringify(summarized);
            if (newStr.length > maxLen * 0.9) break;
          }
        }

        const str = JSON.stringify(summarized);
        return str.length > maxLen
          ? str.slice(0, maxLen - 20) + '...(截断)'
          : str;
      }
    } catch {
      // fallback
    }
    const str = JSON.stringify(result);
    return str.slice(0, maxLen) + '...(结果已截断)';
  }

  /**
   * AI 分析模式 — Agent Loop 决策（跳过采集）
   * 与 runDailyDigest 相同的 Agent Loop，但 system prompt 指示跳过采集环节，
   * 直接从数据库读取已有文章进行分析。
   */
  async runAnalysisOnly(
    userId: string,
    options?: { daysWindow?: number },
  ): Promise<AgentResult> {
    const sessionId = uuidv4();
    const startTime = Date.now();
    const daysWindow = options?.daysWindow ?? 1;

    this.logger.log(
      `[${sessionId}] Agent 分析模式启动, userId=${userId}, daysWindow=${daysWindow}`,
    );

    try {
      const user = await this.userService.findById(userId);
      const tools = this.toolRegistry.getToolDefinitions();

      // 构建分析模式专用的消息
      const systemPrompt = this.buildAnalysisSystemPrompt(user);
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `执行 AI 分析任务（跳过采集，仅分析数据库中已有的文章）。
当前时间: ${new Date().toISOString()}
用户 ID: ${userId}
用户名: ${user.name}
分析时间范围: 最近 ${daysWindow} 天
你的目标是对数据库中已有的文章进行高质量的 AI 分析、评分和推送。
请自主决定执行步骤，合理使用可用工具。
完成后输出最终的执行报告。`,
        },
      ];

      const steps: AgentStep[] = [];
      let digestSent = false;
      let contentCount = 0;

      // ========== Agent Loop ==========
      for (let step = 0; step < this.maxSteps; step++) {
        const stepStart = Date.now();

        this.logger.log(`[${sessionId}] Step ${step + 1}: 调用 LLM...`);

        let response: OpenAI.ChatCompletion;
        try {
          response = await this.callLLMWithRetry(
            sessionId,
            messages,
            tools as OpenAI.ChatCompletionTool[],
          );
        } catch (error) {
          this.logger.error(
            `[${sessionId}] LLM 调用最终失败: ${(error as Error).message}`,
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
          .filter(
            (
              tc,
            ): tc is OpenAI.ChatCompletionMessageToolCall & {
              type: 'function';
            } => tc.type === 'function',
          )
          .map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || '{}'),
          }));

        this.logger.log(
          `[${sessionId}] Step ${step + 1}: 思考="${thinking.slice(0, 100)}...", Tool 调用=${toolCalls.length}个 [${toolCalls.map((t) => t.name).join(', ')}]`,
        );

        // 如果没有工具调用或 stop — 任务完成
        if (toolCallsRaw.length === 0 || choice.finish_reason === 'stop') {
          steps.push({
            step: step + 1,
            thinking,
            toolCalls: [],
            toolResults: [],
            durationMs: Date.now() - stepStart,
          });

          const totalDuration = Date.now() - startTime;
          await this.logAgentExecution(userId, sessionId, steps);

          this.logger.log(
            `[${sessionId}] Agent 分析完成: ${steps.length} 步, ${totalDuration}ms`,
          );

          return {
            sessionId,
            report: thinking || '分析任务已完成',
            stepsUsed: steps.length,
            totalDurationMs: totalDuration,
            isSuccess: true,
            isFallback: false,
            digestSent,
            contentCount,
          };
        }

        // 把 LLM 响应加入消息历史
        messages.push(assistantMessage);

        // 执行工具
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

                if (tc.name === 'send_daily_digest' && result?.success) {
                  digestSent = true;
                  contentCount = tc.args?.contentIds?.length || 0;
                }

                const resultStr = JSON.stringify(result);
                const truncatedResult =
                  resultStr.length > 8000
                    ? this.smartTruncateToolResult(result, 8000)
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

                return {
                  role: 'tool' as const,
                  tool_call_id: tc.id,
                  content: errorMsg,
                };
              }
            }),
          );

        steps.push({
          step: step + 1,
          thinking,
          toolCalls,
          toolResults,
          durationMs: Date.now() - stepStart,
        });

        messages.push(...toolResultMessages);
        this.pruneMessagesIfNeeded(messages);
      }

      // 达到上限
      const totalDuration = Date.now() - startTime;
      await this.logAgentExecution(userId, sessionId, steps);

      this.logger.warn(
        `[${sessionId}] Agent 分析模式达到最大步数限制 (${this.maxSteps})`,
      );

      // 如果步数耗尽但未发送推送，触发兜底
      if (!digestSent) {
        this.logger.warn(
          `[${sessionId}] Agent 分析模式未完成推送，触发兜底安全网`,
        );
        const fallbackResult = await this.runFallback(userId, sessionId);
        return {
          sessionId,
          report: `Agent 分析达到最大步数限制，触发兜底推送。${fallbackResult.message}`,
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
        report: `Agent 分析在 ${this.maxSteps} 步内完成，已发送推送`,
        stepsUsed: steps.length,
        totalDurationMs: totalDuration,
        isSuccess: true,
        isFallback: false,
        digestSent,
        contentCount,
      };
    } catch (error) {
      this.logger.error(
        `[${sessionId}] Agent 分析异常: ${(error as Error).message}`,
      );
      return {
        sessionId,
        report: `Agent 分析失败: ${(error as Error).message}`,
        stepsUsed: 0,
        totalDurationMs: Date.now() - startTime,
        isSuccess: false,
        isFallback: false,
        digestSent: false,
        contentCount: 0,
      };
    }
  }

  /**
   * Token 管理：当消息列表过长时，裁剪早期消息
   * 保留 system prompt + 第一条 user 消息 + 最近 N 轮对话
   */
  private pruneMessagesIfNeeded(
    messages: OpenAI.ChatCompletionMessageParam[],
  ): void {
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
      this.logger.error(`记录 Agent 日志失败: ${(error as Error).message}`);
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
    if (!userId) return [];

    const logs = await this.agentLogRepo
      .createQueryBuilder('log')
      .select('log.session_id', 'sessionId')
      .addSelect('MIN(log.created_at)', 'startTime')
      .addSelect('COUNT(*)', 'stepCount')
      .addSelect(
        "GROUP_CONCAT(log.action ORDER BY log.created_at SEPARATOR ',')",
        'actions',
      )
      .where('log.user_id = :userId', { userId })
      .groupBy('log.session_id')
      .orderBy('MIN(log.created_at)', 'DESC')
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

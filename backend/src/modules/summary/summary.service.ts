import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { UserEntity } from '../../common/database/entities/user.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { EmailChannel } from '../notification/channels/email.channel';

export interface SummaryResult {
  contentId: string;
  summary: string;
  relevanceScore: number;
  scoreBreakdown: {
    relevance: number;
    quality: number;
    timeliness: number;
    novelty: number;
    actionability: number;
  };
  keyPoints: string[];
  actionSuggestions: { type: string; suggestion: string }[];
  contentType: string;
  tags: string[];
}

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);
  private openai: OpenAI;
  private model: string;
  private readonly fallbackModel: string;
  private readonly alertEmail: string;
  /** 当前是否处于降级状态 */
  private usingFallback = false;
  /** 限频告警邮件冷却（同一小时内不重复发送） */
  private lastAlertTime = 0;

  constructor(
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserContentInteractionEntity)
    private readonly interactionRepo: Repository<UserContentInteractionEntity>,
    @InjectRepository(ContentScoreEntity)
    private readonly scoreRepo: Repository<ContentScoreEntity>,
    private readonly emailChannel: EmailChannel,
    private readonly configService: ConfigService,
  ) {
    const baseURL =
      this.configService.get<string>('LLM_URL') || 'https://api.openai.com/v1';
    const apiKey = this.configService.get<string>('LLM_API_KEY') || '';
    this.model = this.configService.get<string>('LLM_MODEL') || 'gpt-4o';
    this.fallbackModel =
      this.configService.get<string>('LLM_FALLBACK_MODEL') || '';
    this.alertEmail = this.configService.get<string>('ALERT_EMAIL') || '';
    this.openai = new OpenAI({ baseURL, apiKey });
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
    if (now - this.lastAlertTime < 60 * 60 * 1000) return;
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
   * 生成单篇摘要
   */
  async generateSummary(
    contentId: string,
    userId: string,
  ): Promise<SummaryResult> {
    const content = await this.contentRepo.findOneBy({ id: contentId });
    if (!content) throw new Error(`内容 ${contentId} 不存在`);

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error(`用户 ${userId} 不存在`);

    // 检查是否已有缓存的摘要
    const existing = await this.interactionRepo.findOneBy({
      contentId,
      userId,
    });
    if (existing && existing.summary) {
      // 读取已有的 AI 评分
      const existingScore = await this.scoreRepo.findOneBy({
        contentId,
        userId,
      });
      return {
        contentId,
        summary: existing.summary,
        relevanceScore: existing.score || 0,
        scoreBreakdown: (existingScore?.scoreBreakdown as any) || {
          relevance: 0,
          quality: 0,
          timeliness: 0,
          novelty: 0,
          actionability: 0,
        },
        keyPoints: [],
        actionSuggestions: (existing.suggestions as any) || [],
        contentType: 'cached',
        tags: [],
      };
    }

    try {
      const result = await this.callLLMForSummary(content, user);

      // 缓存到 interaction 表
      const interaction =
        existing || this.interactionRepo.create({ contentId, userId });
      interaction.summary = result.summary;
      interaction.suggestions = result.actionSuggestions as any;
      interaction.score = result.relevanceScore;
      await this.interactionRepo.save(interaction);

      // 回写 AI 评分到 content_scores 表
      await this.updateContentScore(contentId, userId, result);

      return result;
    } catch (error) {
      this.logger.error(`LLM 摘要生成失败: ${(error as Error).message}`);
      return this.fallbackSummary(content);
    }
  }

  /**
   * 批量生成摘要
   * 返回精简结果给 Agent（完整数据已持久化到 DB），避免大量文本导致 Agent 消息截断
   */
  async batchGenerateSummaries(
    contentIds: string[],
    userId: string,
  ): Promise<{
    successIds: string[];
    failedIds: string[];
    totalRequested: number;
    totalSuccess: number;
    totalFailed: number;
    details: {
      contentId: string;
      relevanceScore: number;
      finalScore: number;
    }[];
    summary: string;
  }> {
    const successIds: string[] = [];
    const failedIds: string[] = [];
    const details: {
      contentId: string;
      relevanceScore: number;
      finalScore: number;
    }[] = [];

    // 控制并发，每次最多 3 个并行
    const batchSize = 3;
    for (let i = 0; i < contentIds.length; i += batchSize) {
      const batch = contentIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          try {
            const result = await this.generateSummary(id, userId);
            return { id, result };
          } catch (err) {
            this.logger.error(`摘要生成失败 ${id}: ${(err as Error).message}`);
            return { id, result: null };
          }
        }),
      );

      for (const { id, result } of batchResults) {
        if (result) {
          successIds.push(id);
          // 计算 finalScore（与 updateContentScore 相同的权重）
          const bd = result.scoreBreakdown;
          const finalScore =
            Math.round(
              (bd.relevance * 0.45 +
                bd.quality * 0.2 +
                bd.timeliness * 0.2 +
                bd.novelty * 0.1 +
                bd.actionability * 0.05) *
                100,
            ) / 100;
          details.push({
            contentId: id,
            relevanceScore: result.relevanceScore,
            finalScore,
          });
        } else {
          failedIds.push(id);
        }
      }
    }

    return {
      successIds,
      failedIds,
      totalRequested: contentIds.length,
      totalSuccess: successIds.length,
      totalFailed: failedIds.length,
      details,
      summary: `成功生成 ${successIds.length}/${contentIds.length} 篇 AI 摘要+评分${failedIds.length > 0 ? `，${failedIds.length} 篇失败` : ''}`,
    };
  }

  /**
   * 调用 LLM 生成摘要（OpenAI 兼容接口）
   */
  private async callLLMForSummary(
    content: ContentEntity,
    user: UserEntity,
  ): Promise<SummaryResult> {
    const profile = user.profile || {};
    const textContent = (content.content || '').slice(0, 6000);

    const systemPrompt =
      '你是一个专业的技术内容分析助手。你只能输出合法的 JSON 对象，不要输出任何其他内容，不要使用 markdown 代码块包裹。';

    const userPrompt = `请根据用户画像分析以下内容：

## 用户画像
${JSON.stringify(profile, null, 2)}

## 原文标题
${content.title}

## 原文内容（发布时间: ${content.publishedAt ? new Date(content.publishedAt).toISOString() : '未知'}）
${textContent}

## 任务
1. 生成适合该用户的内容摘要（200-300字）
2. 多维度评分（每项 0-100 分）：
   - relevance: 与用户兴趣/职业的语义相关度（核心指标，严格评估）
   - quality: 内容质量（深度、准确性、结构性、是否有干货）
   - timeliness: 时效性（是否为近期热点、前沿动态）
   - novelty: 新颖性（是否提供新视角、新知识，非老生常谈）
   - actionability: 可操作性（是否能直接指导实践、学习）
3. 提取关键技术点/知识点（3-5个）
4. 给出 2-3 个具体的行动建议
5. 判断内容类型
6. 提取标签

直接输出以下格式的 JSON，不要有任何多余文字：
{"summary":"...","relevance_score":80,"score_breakdown":{"relevance":80,"quality":75,"timeliness":60,"novelty":70,"actionability":65},"key_points":["...","..."],"action_suggestions":[{"type":"learn","suggestion":"..."},{"type":"practice","suggestion":"..."}],"content_type":"new_technology","tags":["AI","LLM"]}`;

    let response: OpenAI.ChatCompletion;
    try {
      response = await this.openai.chat.completions.create({
        model: this.getCurrentModel(),
        max_tokens: 8192,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
    } catch (error) {
      // 限频检测：切换备用模型重试
      if (
        this.isRateLimitError(error) &&
        this.fallbackModel &&
        !this.usingFallback
      ) {
        this.logger.warn(`LLM 限频，切换到备用模型 ${this.fallbackModel}`);
        this.usingFallback = true;
        void this.sendRateLimitAlert(
          'SummaryService.callLLMForSummary',
          (error as Error).message,
          this.fallbackModel,
        );
        response = await this.openai.chat.completions.create({
          model: this.fallbackModel,
          max_tokens: 8192,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
      } else {
        if (this.isRateLimitError(error)) {
          void this.sendRateLimitAlert(
            'SummaryService.callLLMForSummary',
            (error as Error).message,
          );
        }
        throw error;
      }
    }

    const message = response.choices[0]?.message;
    // 兼容推理模型（如 glm-5）：content 可能为 null，实际内容在 reasoning_content 中
    const text =
      message?.content?.trim() ||
      (message as any)?.reasoning_content?.trim() ||
      '';

    // 尝试多种方式提取 JSON
    const parsed = this.extractJson(text);

    const defaultBreakdown = {
      relevance: 50,
      quality: 50,
      timeliness: 50,
      novelty: 50,
      actionability: 50,
    };
    const breakdown = parsed.score_breakdown || defaultBreakdown;

    return {
      contentId: content.id,
      summary: parsed.summary || '',
      relevanceScore: parsed.relevance_score || 50,
      scoreBreakdown: {
        relevance: breakdown.relevance ?? 50,
        quality: breakdown.quality ?? 50,
        timeliness: breakdown.timeliness ?? 50,
        novelty: breakdown.novelty ?? 50,
        actionability: breakdown.actionability ?? 50,
      },
      keyPoints: parsed.key_points || [],
      actionSuggestions: parsed.action_suggestions || [],
      contentType: parsed.content_type || 'unknown',
      tags: parsed.tags || [],
    };
  }

  /**
   * 从 LLM 响应文本中提取 JSON 对象
   * 兼容：纯 JSON、markdown 代码块包裹、前后有多余文字等情况
   */
  private extractJson(text: string): Record<string, any> {
    // 1. 直接尝试解析（最理想情况）
    try {
      return JSON.parse(text);
    } catch {
      // 继续尝试其他方式
    }

    // 2. 尝试提取 markdown 代码块中的 JSON（```json ... ``` 或 ``` ... ```）
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // 继续尝试
      }
    }

    // 3. 贪婪匹配最外层 { ... }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // 继续尝试
      }
    }

    // 4. 全部失败
    this.logger.warn(`LLM 原始响应: ${text.slice(0, 500)}`);
    throw new Error('LLM 响应中未找到有效 JSON');
  }

  /**
   * 将 AI 评分回写到 content_scores 表
   * 使用加权公式计算 finalScore，与原 ScorerService 的权重保持一致
   */
  private async updateContentScore(
    contentId: string,
    userId: string,
    result: SummaryResult,
  ): Promise<void> {
    try {
      const weights = {
        relevance: 0.45,
        quality: 0.2,
        timeliness: 0.2,
        novelty: 0.1,
        actionability: 0.05,
      };

      const bd = result.scoreBreakdown;
      const finalScore =
        Math.round(
          (bd.relevance * weights.relevance +
            bd.quality * weights.quality +
            bd.timeliness * weights.timeliness +
            bd.novelty * weights.novelty +
            bd.actionability * weights.actionability) *
            100,
        ) / 100;

      let scoreEntity = await this.scoreRepo.findOneBy({ contentId, userId });

      if (scoreEntity) {
        scoreEntity.finalScore = finalScore;
        scoreEntity.scoreBreakdown = { ...bd, source: 'ai' };
      } else {
        scoreEntity = this.scoreRepo.create({
          contentId,
          userId,
          finalScore,
          scoreBreakdown: { ...bd, source: 'ai' },
          isSelected: false,
        });
      }

      await this.scoreRepo.save(scoreEntity);
      this.logger.log(
        `AI 评分回写: contentId=${contentId}, finalScore=${finalScore}`,
      );
    } catch (error) {
      this.logger.warn(`AI 评分回写失败: ${(error as Error).message}`);
    }
  }

  /**
   * 降级摘要：LLM 失败时使用规则生成
   */
  private fallbackSummary(content: ContentEntity): SummaryResult {
    const text = content.content || '';
    const summary =
      text.length > 200 ? text.slice(0, 200) + '...' : text || content.title;

    return {
      contentId: content.id,
      summary: `【规则摘要】${content.title}\n${summary}`,
      relevanceScore: 50,
      scoreBreakdown: {
        relevance: 50,
        quality: 50,
        timeliness: 50,
        novelty: 50,
        actionability: 50,
      },
      keyPoints: [],
      actionSuggestions: [],
      contentType: 'unknown',
      tags: [],
    };
  }
}

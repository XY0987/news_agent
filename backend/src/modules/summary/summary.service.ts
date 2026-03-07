import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { UserEntity } from '../../common/database/entities/user.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';

export interface SummaryResult {
  contentId: string;
  summary: string;
  relevanceScore: number;
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

  constructor(
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserContentInteractionEntity)
    private readonly interactionRepo: Repository<UserContentInteractionEntity>,
    private readonly configService: ConfigService,
  ) {
    const baseURL = this.configService.get<string>('LLM_URL') || 'https://api.openai.com/v1';
    const apiKey = this.configService.get<string>('LLM_API_KEY') || '';
    this.model = this.configService.get<string>('LLM_MODEL') || 'gpt-4o';
    this.openai = new OpenAI({ baseURL, apiKey });
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
    const existing = await this.interactionRepo.findOneBy({ contentId, userId });
    if (existing && existing.summary) {
      return {
        contentId,
        summary: existing.summary,
        relevanceScore: existing.score || 0,
        keyPoints: [],
        actionSuggestions: (existing.suggestions as any) || [],
        contentType: 'cached',
        tags: [],
      };
    }

    try {
      const result = await this.callLLMForSummary(content, user);

      // 缓存到 interaction 表
      const interaction = existing || this.interactionRepo.create({ contentId, userId });
      interaction.summary = result.summary;
      interaction.suggestions = result.actionSuggestions as any;
      interaction.score = result.relevanceScore;
      await this.interactionRepo.save(interaction);

      return result;
    } catch (error) {
      this.logger.error(`LLM 摘要生成失败: ${(error as Error).message}`);
      return this.fallbackSummary(content);
    }
  }

  /**
   * 批量生成摘要
   */
  async batchGenerateSummaries(
    contentIds: string[],
    userId: string,
  ): Promise<{ results: SummaryResult[]; summary: string }> {
    const results: SummaryResult[] = [];

    // 控制并发，每次最多 3 个并行
    const batchSize = 3;
    for (let i = 0; i < contentIds.length; i += batchSize) {
      const batch = contentIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((id) =>
          this.generateSummary(id, userId).catch((err) => {
            this.logger.error(`摘要生成失败 ${id}: ${err.message}`);
            return null;
          }),
        ),
      );
      results.push(...batchResults.filter((r): r is SummaryResult => r !== null));
    }

    return {
      results,
      summary: `成功生成 ${results.length}/${contentIds.length} 篇摘要`,
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

## 原文内容
${textContent}

## 任务
1. 生成适合该用户的内容摘要（200-300字）
2. 评估内容与用户的相关度(0-100分)
3. 提取关键技术点/知识点（3-5个）
4. 给出 2-3 个具体的行动建议
5. 判断内容类型
6. 提取标签

直接输出以下格式的 JSON，不要有任何多余文字：
{"summary":"...","relevance_score":80,"key_points":["...","..."],"action_suggestions":[{"type":"learn","suggestion":"..."},{"type":"practice","suggestion":"..."}],"content_type":"new_technology","tags":["AI","LLM"]}`;

    const response = await this.openai.chat.completions.create({
      model: this.model,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const message = response.choices[0]?.message;
    // 兼容推理模型（如 glm-5）：content 可能为 null，实际内容在 reasoning_content 中
    const text =
      message?.content?.trim() ||
      (message as any)?.reasoning_content?.trim() ||
      '';

    // 尝试多种方式提取 JSON
    const parsed = this.extractJson(text);

    return {
      contentId: content.id,
      summary: parsed.summary || '',
      relevanceScore: parsed.relevance_score || 50,
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
      keyPoints: [],
      actionSuggestions: [],
      contentType: 'unknown',
      tags: [],
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { CollectorService } from '../collector/collector.service';
import { FilterService } from '../filter/filter.service';
import { ScorerService } from '../scorer/scorer.service';
import { SummaryService } from '../summary/summary.service';
import { NotificationService } from '../notification/notification.service';
import { MemoryService } from '../memory/memory.service';
import { FeedbackService } from '../feedback/feedback.service';
import { UserService } from '../user/user.service';
import { ContentService } from '../content/content.service';
import { SourceService } from '../source/source.service';
import { DigestService } from '../digest/digest.service';
import type {
  OpenAIToolDefinition,
  ToolExecutor,
  ToolRegistryEntry,
} from './agent.types';

/**
 * Agent Tool 注册表
 * 将 NestJS Service 封装为 OpenAI Tools 格式（type: 'function', function: { name, description, parameters }）
 * 提供 Tool 定义获取和 Tool 执行引擎
 */
@Injectable()
export class AgentToolRegistry {
  private readonly logger = new Logger(AgentToolRegistry.name);
  private tools: Map<string, ToolRegistryEntry> = new Map();

  constructor(
    private readonly collectorService: CollectorService,
    private readonly filterService: FilterService,
    private readonly scorerService: ScorerService,
    private readonly summaryService: SummaryService,
    private readonly notificationService: NotificationService,
    private readonly memoryService: MemoryService,
    private readonly feedbackService: FeedbackService,
    private readonly userService: UserService,
    private readonly contentService: ContentService,
    private readonly sourceService: SourceService,
    private readonly digestService: DigestService,
  ) {
    this.registerAllTools();
  }

  /**
   * 获取 OpenAI Tools 格式的定义列表
   */
  getToolDefinitions(): OpenAIToolDefinition[] {
    return Array.from(this.tools.values()).map((entry) => entry.definition);
  }

  /**
   * 获取 NotificationService（供 AgentService 自动推送兜底使用）
   */
  getNotificationService(): NotificationService {
    return this.notificationService;
  }

  /**
   * 执行指定 Tool
   */
  async executeTool(name: string, args: Record<string, any>): Promise<any> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new Error(`未知的 Tool: ${name}`);
    }

    // 校验 required 参数，防止 undefined 值流入 TypeORM 查询
    const params = entry.definition.function?.parameters;
    if (params?.required) {
      for (const req of params.required) {
        if (args[req] === undefined || args[req] === null) {
          throw new Error(`Tool ${name} 缺少必填参数: ${req}`);
        }
      }
    }

    this.logger.log(
      `执行 Tool: ${name}, 参数: ${JSON.stringify(args).slice(0, 200)}`,
    );
    return entry.execute(args);
  }

  /**
   * 获取已注册的 Tool 名称列表
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  // ==================== 动态工具注册（供 Skill 脚本工具使用） ====================

  /** 动态注册的工具名集合（用于后续批量清理） */
  private dynamicToolNames = new Set<string>();

  /**
   * 动态注册工具（Skill 执行期间临时注册，执行完毕后清理）
   *
   * 与 registerAllTools() 中的静态注册不同，动态工具是 Skill 运行时按需注入的。
   * 主要用于 Skill scripts/ 目录下的脚本，让 LLM 在推理过程中可以主动调用。
   */
  registerDynamic(entry: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
    execute: ToolExecutor;
  }): void {
    this.register(entry);
    this.dynamicToolNames.add(entry.name);
    this.logger.log(`动态注册 Tool: ${entry.name}`);
  }

  /**
   * 取消注册动态工具（Skill 执行完毕后调用）
   */
  unregisterDynamic(name: string): void {
    if (this.dynamicToolNames.has(name)) {
      this.tools.delete(name);
      this.dynamicToolNames.delete(name);
      this.logger.log(`动态取消注册 Tool: ${name}`);
    }
  }

  /**
   * 取消注册所有动态工具（批量清理）
   */
  unregisterAllDynamic(): void {
    for (const name of this.dynamicToolNames) {
      this.tools.delete(name);
    }
    const count = this.dynamicToolNames.size;
    this.dynamicToolNames.clear();
    if (count > 0) {
      this.logger.log(`批量清理 ${count} 个动态 Tool`);
    }
  }

  // ==================== 注册所有 Tools ====================

  private registerAllTools(): void {
    this.registerPerceptionTools();
    this.registerActionTools();
    this.registerPushTools();
    this.registerMemoryTools();
    this.logger.log(
      `已注册 ${this.tools.size} 个 Agent Tools: ${this.getToolNames().join(', ')}`,
    );
  }

  /**
   * 注册辅助方法：接收简化参数，自动包装为 OpenAI Tools 格式
   */
  private register(entry: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
    execute: ToolExecutor;
  }): void {
    this.tools.set(entry.name, {
      definition: {
        type: 'function',
        function: {
          name: entry.name,
          description: entry.description,
          parameters: entry.parameters,
        },
      },
      execute: entry.execute,
    });
  }

  // ========== 感知类工具 ==========

  private registerPerceptionTools(): void {
    this.register({
      name: 'read_user_profile',
      description:
        '读取用户画像，了解用户的职业、兴趣标签、偏好设置、评分权重等。每次任务开始时应先调用此工具了解用户。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
        },
        required: ['userId'],
      },
      execute: async ({ userId }) => {
        const user = await this.userService.findById(userId);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          profile: user.profile,
          preferences: user.preferences,
          notificationSettings: user.notificationSettings,
        };
      },
    });

    this.register({
      name: 'read_feedback_history',
      description:
        '读取用户最近的反馈记录（useful/useless/save/ignore），了解用户近期偏好变化。返回反馈列表和统计摘要。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
          days: {
            type: 'number',
            description: '查看最近几天的反馈，默认 7 天',
          },
        },
        required: ['userId'],
      },
      execute: async ({ userId, days = 7 }) => {
        const feedbacks = await this.feedbackService.findByUser(userId, days);
        const stats = await this.feedbackService.getStats(userId, days);
        return {
          feedbacks: feedbacks.map((f) => ({
            contentId: f.contentId,
            type: f.feedbackType,
            reason: f.feedbackReason,
            createdAt: f.createdAt,
          })),
          stats,
          summary: `最近 ${days} 天共 ${stats.total} 条反馈: ${stats.useful} 有用, ${stats.useless} 无用, ${stats.save} 收藏, ${stats.ignore} 忽略`,
        };
      },
    });

    this.register({
      name: 'query_memory',
      description:
        '查询 Agent 的长期记忆，包括历史决策经验、用户偏好变化趋势、来源质量记录等。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
          query: {
            type: 'string',
            description:
              '要查询的记忆内容，如"用户最近的兴趣变化"、"上次推送经验"等',
          },
          type: {
            type: 'string',
            description:
              '记忆类型筛选: decision_experience / preference_change / source_quality / insight',
          },
        },
        required: ['userId', 'query'],
      },
      execute: async ({ userId, query, type }) => {
        return this.memoryService.query(userId, query, type);
      },
    });

    this.register({
      name: 'get_user_sources',
      description:
        '获取用户的数据源列表，了解用户订阅了哪些来源。可按类型筛选。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
          type: {
            type: 'string',
            description: '按类型筛选，如 wechat / rss / github',
          },
        },
        required: ['userId'],
      },
      execute: async ({ userId, type }) => {
        const sources = type
          ? await this.sourceService.findByUserAndType(userId, type)
          : await this.sourceService.findActiveByUser(userId);
        return {
          total: sources.length,
          sources: sources.map((s) => ({
            id: s.id,
            type: s.type,
            name: s.name,
            identifier: s.identifier,
            status: s.status,
            qualityScore: s.qualityScore,
            lastCollectedAt: s.lastCollectedAt,
            stats: s.stats,
          })),
        };
      },
    });
  }

  // ========== 行动类工具 ==========

  private registerActionTools(): void {
    this.register({
      name: 'collect_wechat',
      description:
        '从微信公众号采集最新文章。根据用户配置的公众号数据源进行采集。返回采集结果统计和 savedContentIds（新保存到数据库的内容 ID 列表）。请将 savedContentIds 传递给 filter_and_dedup 的 contentIds 参数。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
          sourceIds: {
            type: 'array',
            items: { type: 'string' },
            description:
              '指定采集哪些数据源ID，不传则采集该用户全部微信公众号源',
          },
        },
        required: ['userId'],
      },
      execute: async ({ userId, sourceIds }) => {
        const results = sourceIds && sourceIds.length > 0
          ? await this.collectorService.collectBySources(sourceIds)
          : await this.collectorService.collectByUser(userId);

        const allSavedIds = results.flatMap((r) => r.savedContentIds || []);

        return {
          results,
          savedContentIds: allSavedIds,
          totalNewSaved: allSavedIds.length,
          hint: '请将 savedContentIds 传给 filter_and_dedup 的 contentIds 参数',
        };
      },
    });

    this.register({
      name: 'collect_github',
      description:
        '从 GitHub 热点数据源采集最新的热门仓库。支持 GitHub Trending、GitHub Topics/frontend 等来源。返回采集结果统计和 savedContentIds（新保存到数据库的内容 ID 列表）。重要：请将返回的 savedContentIds 传递给 filter_and_dedup 的 contentIds 参数，以确保只处理本次采集的 GitHub 内容。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
          sourceIds: {
            type: 'array',
            items: { type: 'string' },
            description:
              '指定采集哪些 GitHub 数据源 ID，不传则采集该用户全部 GitHub 源',
          },
        },
        required: ['userId'],
      },
      execute: async ({ userId, sourceIds }) => {
        const results = sourceIds && sourceIds.length > 0
          ? await this.collectorService.collectBySources(sourceIds)
          : await this.collectorService.collectGithubByUser(userId);

        // 汇总所有 savedContentIds
        const allSavedIds = results.flatMap((r) => r.savedContentIds || []);

        return {
          results,
          savedContentIds: allSavedIds,
          totalNewSaved: allSavedIds.length,
          hint: '请将 savedContentIds 传给 filter_and_dedup 的 contentIds 参数',
        };
      },
    });

    this.register({
      name: 'filter_and_dedup',
      description:
        '对采集到的内容进行去重和基础过滤（去垃圾、去广告、去过短内容、时间窗口过滤）。返回过滤后的内容 ID 列表。重要提示：为避免混入其他类型的内容，请务必将 collect_github/collect_wechat 返回的 savedContentIds 传入 contentIds 参数。如果不传 contentIds，将从数据库获取最近所有类型的内容（可能包含公众号等非目标内容），此时应搭配 sourceType 参数过滤。',
      parameters: {
        type: 'object',
        properties: {
          contentIds: {
            type: 'array',
            items: { type: 'string' },
            description:
              '待过滤的内容 ID 列表。强烈建议传入采集步骤返回的 savedContentIds，以确保只处理目标来源的内容。',
          },
          userId: { type: 'string', description: '用户 ID' },
          sourceType: {
            type: 'string',
            description:
              '按数据源类型过滤，如 "github" 或 "wechat"。当不传 contentIds 时必须传此参数，避免混入其他来源内容。',
          },
          minLength: {
            type: 'number',
            description: '最小内容长度，默认 100 字',
          },
          daysWindow: {
            type: 'number',
            description: '时间窗口（天），默认 7 天',
          },
        },
        required: ['userId'],
      },
      execute: async ({ contentIds, userId, sourceType, minLength, daysWindow }) => {
        return this.filterService.filterAndDedup({
          contentIds,
          userId,
          sourceType,
          minLength: minLength || 100,
          daysWindow: daysWindow || 7,
        });
      },
    });

    this.register({
      name: 'score_contents',
      description:
        '对内容进行初步规则评分（基于关键词匹配、时间衰减等规则，非 AI 评分）。返回带分数和分数拆解的内容列表，按总分降序排列。注意：这只是粗略预评分，最终精准评分由 generate_summary / batch_generate_summaries 的 AI 评分产出并自动覆盖。',
      parameters: {
        type: 'object',
        properties: {
          contentIds: {
            type: 'array',
            items: { type: 'string' },
            description: '待评分的内容 ID 列表',
          },
          userId: { type: 'string', description: '用户 ID' },
        },
        required: ['contentIds', 'userId'],
      },
      execute: async ({ contentIds, userId }) => {
        return this.scorerService.scoreAll({ contentIds, userId });
      },
    });

    this.register({
      name: 'generate_summary',
      description:
        '为单篇内容生成个性化 AI 摘要、多维度 AI 评分和行动建议。这是一个 LLM 调用，会自动将 AI 评分（relevance/quality/timeliness/novelty/actionability）写入数据库覆盖规则评分。返回摘要、AI 评分、关键点、行动建议等。',
      parameters: {
        type: 'object',
        properties: {
          contentId: { type: 'string', description: '内容 ID' },
          userId: { type: 'string', description: '用户 ID' },
        },
        required: ['contentId', 'userId'],
      },
      execute: async ({ contentId, userId }) => {
        return this.summaryService.generateSummary(contentId, userId);
      },
    });

    this.register({
      name: 'batch_generate_summaries',
      description:
        '批量为多篇内容生成 AI 摘要、多维度 AI 评分和行动建议。内部会控制并发（3 并发）。每批建议不超过 10 条。AI 评分会自动写入数据库覆盖规则评分。',
      parameters: {
        type: 'object',
        properties: {
          contentIds: {
            type: 'array',
            items: { type: 'string' },
            description: '需要生成摘要的内容 ID 列表（建议不超过 10 条）',
          },
          userId: { type: 'string', description: '用户 ID' },
        },
        required: ['contentIds', 'userId'],
      },
      execute: async ({ contentIds, userId }) => {
        return this.summaryService.batchGenerateSummaries(contentIds, userId);
      },
    });

    this.register({
      name: 'get_recent_contents',
      description:
        '获取最近采集的内容列表，支持分页和搜索。用于了解当前可用的内容池。',
      parameters: {
        type: 'object',
        properties: {
          sourceId: { type: 'string', description: '按数据源筛选' },
          search: { type: 'string', description: '标题关键词搜索' },
          page: { type: 'number', description: '页码，默认 1' },
          pageSize: { type: 'number', description: '每页数量，默认 20' },
        },
        required: [],
      },
      execute: async ({ sourceId, search, page, pageSize }) => {
        const result = await this.contentService.findAll({
          sourceId,
          search,
          page: page || 1,
          pageSize: pageSize || 20,
        });
        return {
          total: result.total,
          data: result.data.map((c) => ({
            id: c.id,
            title: c.title,
            url: c.url,
            author: c.author,
            sourceId: c.sourceId,
            publishedAt: c.publishedAt,
            collectedAt: c.collectedAt,
            contentLength: c.content ? c.content.length : 0,
          })),
        };
      },
    });
  }

  // ========== 推送类工具 ==========

  private registerPushTools(): void {
    this.register({
      name: 'send_daily_digest',
      description:
        '发送每日精选推送给用户。需要提供最终选定的内容 ID 列表。会自动生成推送内容并通过配置的渠道发送。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
          contentIds: {
            type: 'array',
            items: { type: 'string' },
            description: '最终推送的所有内容 ID 列表（传入所有已生成摘要的文章 ID，不限数量）',
          },
          agentNote: {
            type: 'string',
            description: 'Agent 想附带的说明，如"今天 AI 领域有重大更新"',
          },
        },
        required: ['userId', 'contentIds'],
      },
      execute: async ({ userId, contentIds, agentNote }) => {
        return this.notificationService.sendDigest({
          userId,
          contentIds,
          agentNote,
        });
      },
    });

    this.register({
      name: 'send_github_trending',
      description:
        '发送 GitHub 热点趋势邮件（独立于每日精选）。需要提供 GitHub 仓库相关的内容 ID 列表。会使用 GitHub 专属邮件模板展示仓库信息、Star 数、新增 Star 等数据。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
          contentIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'GitHub 热点仓库的内容 ID 列表',
          },
          agentNote: {
            type: 'string',
            description: 'Agent 想附带的说明，如"今日前端领域新增多个热门项目"',
          },
        },
        required: ['userId', 'contentIds'],
      },
      execute: async ({ userId, contentIds, agentNote }) => {
        return this.notificationService.sendGithubTrending({
          userId,
          contentIds,
          agentNote,
        });
      },
    });
  }

  // ========== 记忆类工具 ==========

  private registerMemoryTools(): void {
    this.register({
      name: 'store_memory',
      description:
        '存储一条经验/观察到 Agent 的长期记忆。用于记录决策经验、用户偏好变化、来源质量观察等。下次执行时可以通过 query_memory 查询。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
          type: {
            type: 'string',
            enum: [
              'decision_experience',
              'preference_change',
              'source_quality',
              'insight',
            ],
            description: '记忆类型',
          },
          content: { type: 'string', description: '要记住的内容' },
          confidence: { type: 'number', description: '置信度 0-1，默认 0.8' },
        },
        required: ['userId', 'type', 'content'],
      },
      execute: async ({ userId, type, content, confidence }) => {
        return this.memoryService.store({
          userId,
          type,
          content,
          confidence: confidence || 0.8,
        });
      },
    });

    this.register({
      name: 'analyze_source_quality',
      description:
        '分析指定来源的质量统计（相关率、平均分、用户反馈分布）。帮助判断是否需要建议用户调整来源。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
          sourceId: {
            type: 'string',
            description: '数据源 ID，不传则分析所有来源',
          },
          days: {
            type: 'number',
            description: '分析最近多少天的数据，默认 30 天',
          },
        },
        required: ['userId'],
      },
      execute: async ({ userId, sourceId, days }) => {
        return this.memoryService.analyzeSourceQuality({
          userId,
          sourceId,
          days: days || 30,
        });
      },
    });

    this.register({
      name: 'suggest_source_change',
      description:
        '生成来源管理建议（建议移除/降低频率/添加新来源）。建议会记录并在推送中展示给用户确认。',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID' },
          sourceId: { type: 'string', description: '相关数据源 ID' },
          action: {
            type: 'string',
            enum: ['suggest_remove', 'suggest_reduce_frequency', 'suggest_add'],
            description: '建议操作类型',
          },
          reason: { type: 'string', description: '建议理由' },
        },
        required: ['userId', 'sourceId', 'action', 'reason'],
      },
      execute: async ({ userId, sourceId, action, reason }) => {
        return this.memoryService.storeSuggestion({
          userId,
          sourceId,
          action,
          reason,
        });
      },
    });
  }
}

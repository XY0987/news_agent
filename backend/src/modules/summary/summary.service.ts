import { Injectable } from '@nestjs/common';

/**
 * 摘要生成服务 - LLM 驱动的个性化摘要
 * 封装为 Agent Tool: generate_summary, batch_generate_summaries
 *
 * 摘要类型：
 * - 极简摘要（50 字以内，推送通知标题）
 * - 标准摘要（200-300 字，核心观点 + 关键信息点 + 相关性说明）
 * - 深度分析（500-1000 字，技术要点 + 实践建议 + 延伸阅读）
 *
 * 策略：
 * - 只对候选 Top K 调用 LLM
 * - 同一 content_id 摘要缓存
 * - LLM 失败降级为规则摘要
 */
@Injectable()
export class SummaryService {
  // TODO: 实现 generateSummary(), batchGenerateSummaries()
  // TODO: 实现 LLM Prompt 模板
  // TODO: 实现降级策略
}

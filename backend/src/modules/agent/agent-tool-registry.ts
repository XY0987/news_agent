import { Injectable } from '@nestjs/common';

/**
 * Agent Tool 注册表
 * 将 NestJS Service 封装为 Agent 的 Tool，供 Agent 通过 tool calling 自主调用
 *
 * 感知类工具：
 * - read_user_profile      读取用户画像
 * - read_feedback_history   读取用户反馈记录
 * - query_memory           查询长期记忆
 *
 * 行动类工具：
 * - collect_rss            RSS 采集
 * - collect_github         GitHub 采集
 * - collect_wechat         公众号采集
 * - filter_and_dedup       过滤去重
 * - score_contents         多维度评分
 * - generate_summary       生成单篇摘要
 * - batch_generate_summaries 批量生成摘要
 *
 * 推送类工具：
 * - send_daily_digest      发送每日精选
 *
 * 记忆类工具：
 * - store_memory           存储经验/记忆
 * - suggest_source_change  生成来源管理建议
 * - analyze_source_quality 分析来源质量
 */
@Injectable()
export class AgentToolRegistry {
  // TODO: 实现 getAllTools() - 返回所有 Tool 定义
  // TODO: 实现 getAnthropicToolDefinitions() - 转换为 Anthropic API 格式（里程碑 1）
  // TODO: 实现 executeTool() - 执行指定 Tool
}

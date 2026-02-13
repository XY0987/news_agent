import { Injectable } from '@nestjs/common';

/**
 * 评分服务 - 多维度评分模型
 * 封装为 Agent Tool: score_contents
 *
 * 评分维度（MVP 默认权重）：
 * - 相关性 0.45（关键词匹配 + 可选 LLM 判定）
 * - 质量   0.20（来源信誉、内容长度、结构）
 * - 时效性 0.20（时间衰减函数）
 * - 新颖性 0.10（与近 7 天推送内容相似度反向得分）
 * - 可操作性 0.05（是否包含步骤/demo/实践建议）
 *
 * Tool 内部实现策略：
 * - 时效性、新颖性、质量：纯规则（快、稳定、零成本）
 * - 相关性：规则初筛 + LLM 精判
 * - 可操作性：LLM 判定
 */
@Injectable()
export class ScorerService {
  // TODO: 实现 scoreAll()
  // TODO: 实现各维度评分逻辑
}

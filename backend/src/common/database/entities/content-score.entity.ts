/**
 * 内容评分实体 - 对应 content_scores 表
 */
export class ContentScoreEntity {
  id: string;
  contentId: string;
  userId: string;
  finalScore: number;
  scoreBreakdown: Record<string, any>;
  isSelected: boolean;
  selectionReason: string;
  createdAt: Date;
}

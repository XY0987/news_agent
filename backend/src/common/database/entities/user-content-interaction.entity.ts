/**
 * 用户内容交互实体 - 对应 user_content_interactions 表
 */
export class UserContentInteractionEntity {
  id: string;
  userId: string;
  contentId: string;
  score: number;
  userRating: number;
  isRead: boolean;
  isSaved: boolean;
  isIgnored: boolean;
  readDuration: number;
  summary: string;
  suggestions: Record<string, any>;
  notifiedAt: Date;
  createdAt: Date;
}

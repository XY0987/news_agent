/**
 * 反馈实体 - 对应 feedbacks 表
 */
export class FeedbackEntity {
  id: string;
  userId: string;
  contentId: string;
  feedbackType: string;
  readDuration: number;
  createdAt: Date;
}

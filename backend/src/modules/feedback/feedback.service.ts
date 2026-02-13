import { Injectable } from '@nestjs/common';

/**
 * 反馈服务 - 用户反馈闭环
 *
 * 反馈类型：
 * - 显式：有用/无用/收藏/忽略
 * - 隐式：阅读时长、点击深度
 * - 周期性：每周偏好确认
 */
@Injectable()
export class FeedbackService {
  // TODO: 实现反馈提交、查询、统计
}

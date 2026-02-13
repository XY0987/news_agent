import { Injectable } from '@nestjs/common';

/**
 * 推送服务 - 多渠道通知
 * 封装为 Agent Tool: send_daily_digest
 *
 * MVP 渠道：邮件（必选）+ Telegram（可选）
 *
 * 推送策略：
 * - 日报：每天固定时间推送 Top 5
 * - 高分实时：final_score >= 90 且非免打扰时段
 * - 周报（里程碑 3）
 */
@Injectable()
export class NotificationService {
  // TODO: 实现 sendDigest()
  // TODO: 实现多渠道分发逻辑
}

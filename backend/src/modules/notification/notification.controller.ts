import { Controller } from '@nestjs/common';
import { NotificationService } from './notification.service';

/**
 * 推送相关接口
 * - GET  /api/notifications          获取通知列表
 * - PUT  /api/notifications/settings 更新通知设置
 * - POST /api/notifications/test     发送测试通知
 */
@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // TODO: 实现通知列表、设置、测试推送等接口
}

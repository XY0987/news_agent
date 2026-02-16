import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 获取通知渠道状态
   */
  @Get('channels/status')
  async getChannelStatus() {
    const status = await this.notificationService.getChannelStatus();
    return ApiResponse.ok(status);
  }

  /**
   * 发送测试邮件
   */
  @Post('test/email')
  async sendTestEmail(@Body() body: { email: string }) {
    const result = await this.notificationService.sendTestEmail(body.email);
    if (result.success) {
      return ApiResponse.ok(result, '测试邮件发送成功');
    }
    return ApiResponse.fail(result.error || '发送失败');
  }

  /**
   * 手动触发每日精选推送
   */
  @Post('send-digest')
  async sendDigest(
    @Body()
    body: {
      userId: string;
      contentIds: string[];
      agentNote?: string;
    },
  ) {
    const result = await this.notificationService.sendDigest(body);
    return ApiResponse.ok(result);
  }
}

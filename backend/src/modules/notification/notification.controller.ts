import { Controller, Get, Post, Body } from '@nestjs/common';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsEmail,
} from 'class-validator';
import { NotificationService } from './notification.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

class SendTestEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

class SendDigestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  contentIds: string[];

  @IsOptional()
  @IsString()
  agentNote?: string;
}

@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 获取通知渠道状态
   */
  @Get('channels/status')
  getChannelStatus() {
    const status = this.notificationService.getChannelStatus();
    return ApiResponse.ok(status);
  }

  /**
   * 发送测试邮件
   */
  @Post('test/email')
  async sendTestEmail(@Body() body: SendTestEmailDto) {
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
  async sendDigest(@Body() body: SendDigestDto) {
    const result = await this.notificationService.sendDigest(body);
    return ApiResponse.ok(result);
  }

  /**
   * 发送今日已分析的文章到邮箱
   */
  @Post('send-today-analyzed')
  async sendTodayAnalyzed(@Body() body: { userId: string }) {
    const result = await this.notificationService.sendTodayAnalyzed(
      body.userId,
    );
    return ApiResponse.ok(result);
  }

  /**
   * 手动触发 GitHub 热点推送
   */
  @Post('send-github-trending')
  async sendGithubTrending(@Body() body: SendDigestDto) {
    const result = await this.notificationService.sendGithubTrending(body);
    return ApiResponse.ok(result);
  }
}

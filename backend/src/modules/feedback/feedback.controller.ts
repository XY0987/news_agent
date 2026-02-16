import { Controller, Get, Query } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('api/feedbacks')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * 获取用户反馈历史
   */
  @Get()
  async findByUser(
    @Query('userId') userId: string,
    @Query('days') days?: string,
  ) {
    const feedbacks = await this.feedbackService.findByUser(
      userId,
      days ? parseInt(days, 10) : 7,
    );
    return ApiResponse.ok(feedbacks);
  }

  /**
   * 获取用户反馈统计
   */
  @Get('stats')
  async getStats(
    @Query('userId') userId: string,
    @Query('days') days?: string,
  ) {
    const stats = await this.feedbackService.getStats(
      userId,
      days ? parseInt(days, 10) : 30,
    );
    return ApiResponse.ok(stats);
  }
}

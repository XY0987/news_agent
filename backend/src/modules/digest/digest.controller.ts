import { Controller, Get, Param, Query } from '@nestjs/common';
import { DigestService } from './digest.service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('api/digests')
export class DigestController {
  constructor(private readonly digestService: DigestService) {}

  /**
   * 获取推送历史列表
   */
  @Get()
  async findByUser(
    @Query('userId') userId: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { data, total } = await this.digestService.findByUser(userId, {
      type,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    return ApiResponse.paginated(
      data,
      total,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  /**
   * 获取今日推送
   */
  @Get('today')
  async getTodayDigest(@Query('userId') userId: string) {
    const digest = await this.digestService.getTodayDigest(userId);
    return ApiResponse.ok(digest);
  }

  /**
   * 获取推送统计
   */
  @Get('stats')
  async getStats(
    @Query('userId') userId: string,
    @Query('days') days?: string,
  ) {
    const stats = await this.digestService.getStats(
      userId,
      days ? parseInt(days, 10) : 30,
    );
    return ApiResponse.ok(stats);
  }

  /**
   * 获取单条推送记录
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    const digest = await this.digestService.findById(id);
    return ApiResponse.ok(digest);
  }
}

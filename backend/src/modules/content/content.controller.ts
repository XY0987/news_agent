import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ContentService } from './content.service';
import { FeedbackService } from '../feedback/feedback.service';
import { ContentQueryDto, ContentFeedbackDto } from './dto/index';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('api/contents')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly feedbackService: FeedbackService,
  ) {}

  @Get()
  async findAll(@Query() query: ContentQueryDto) {
    const { data, total } = await this.contentService.findAll(query);
    return ApiResponse.paginated(
      data,
      total,
      query.page || 1,
      query.pageSize || 20,
    );
  }

  @Get('digest')
  async getTodayDigest(@Query('userId') userId: string) {
    const digest = await this.contentService.getTodayDigest(userId);
    return ApiResponse.ok(digest);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Query('userId') userId?: string) {
    if (userId) {
      const content = await this.contentService.getContentWithScore(id, userId);
      return ApiResponse.ok(content);
    }
    const content = await this.contentService.findById(id);
    return ApiResponse.ok(content);
  }

  @Post(':id/feedback')
  async submitFeedback(
    @Param('id') id: string,
    @Body() dto: ContentFeedbackDto,
  ) {
    const feedback = await this.feedbackService.create({
      contentId: id,
      userId: dto.userId,
      feedbackType: dto.feedbackType,
      feedbackReason: dto.feedbackReason,
      readDuration: dto.readDuration,
    });
    return ApiResponse.ok(feedback, 'Feedback submitted');
  }
}

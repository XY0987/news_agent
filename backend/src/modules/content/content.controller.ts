import { Controller } from '@nestjs/common';
import { ContentService } from './content.service';

/**
 * 内容相关接口
 * - GET  /api/contents              获取内容列表（支持筛选/分页）
 * - GET  /api/contents/:id          获取内容详情
 * - POST /api/contents/:id/feedback 提交内容反馈
 * - GET  /api/contents/digest       获取今日精选
 * - GET  /api/contents/search       搜索内容
 */
@Controller('api/contents')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // TODO: 实现内容列表、详情、搜索等接口
}

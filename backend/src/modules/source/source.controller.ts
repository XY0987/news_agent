import { Controller } from '@nestjs/common';
import { SourceService } from './source.service';

/**
 * 数据源管理接口
 * - GET    /api/sources              获取数据源列表
 * - POST   /api/sources              添加数据源
 * - PUT    /api/sources/:id          更新数据源
 * - DELETE /api/sources/:id          删除数据源
 * - GET    /api/sources/:id/stats    获取数据源统计
 * - POST   /api/sources/validate     验证数据源
 */
@Controller('api/sources')
export class SourceController {
  constructor(private readonly sourceService: SourceService) {}

  // TODO: 实现数据源 CRUD、验证、统计等接口
}

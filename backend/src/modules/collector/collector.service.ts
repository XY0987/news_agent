import { Injectable } from '@nestjs/common';

@Injectable()
export class CollectorService {
  // TODO: 实现统一采集入口
  // - 按用户的 Source 配置调用对应采集器
  // - 采集结果写入 Content 表
  // - URL 去重
}

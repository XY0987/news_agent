import { Injectable } from '@nestjs/common';
import { BaseCollector } from '../base.collector';

/**
 * RSS 采集器（MVP 优先）
 * 支持标准 RSS/Atom 订阅源采集
 */
@Injectable()
export class RssCollector extends BaseCollector {
  async collect(sources: any[]) {
    // TODO: 实现 RSS 源解析和内容采集
    return [];
  }

  async validateSource(source: any) {
    // TODO: 验证 RSS 源是否有效
    return { isValid: true, message: 'ok' };
  }
}

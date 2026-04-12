import { Injectable } from '@nestjs/common';
import { BaseCollector } from '../base.collector';
import type { RawContent, SourceValidation } from '../base.collector';

/**
 * RSS 采集器（MVP 优先）
 * 支持标准 RSS/Atom 订阅源采集
 */
@Injectable()
export class RssCollector extends BaseCollector {
  collect(_sources: any[]): Promise<RawContent[]> {
    // TODO: 实现 RSS 源解析和内容采集
    return Promise.resolve([]);
  }

  validateSource(_source: any): Promise<SourceValidation> {
    // TODO: 验证 RSS 源是否有效
    return Promise.resolve({ isValid: true, message: 'ok' });
  }
}

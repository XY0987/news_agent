import { Injectable } from '@nestjs/common';
import { BaseCollector } from '../base.collector';

/**
 * 微信公众号采集器
 * MVP 阶段通过第三方服务（WeRSS 等）实现 RSS 化采集
 */
@Injectable()
export class WechatCollector extends BaseCollector {
  async collect(sources: any[]) {
    // TODO: 实现公众号内容采集（通过第三方 RSS 化服务）
    return [];
  }

  async validateSource(source: any) {
    // TODO: 验证公众号源是否有效
    return { isValid: true, message: 'ok' };
  }
}

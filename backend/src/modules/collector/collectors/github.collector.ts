import { Injectable } from '@nestjs/common';
import { BaseCollector } from '../base.collector';

/**
 * GitHub 采集器
 * 支持 Trending、Releases、指定 Repo 的 Issues
 */
@Injectable()
export class GithubCollector extends BaseCollector {
  async collect(sources: any[]) {
    // TODO: 实现 GitHub API 调用，采集 Trending/Releases
    return [];
  }

  async validateSource(source: any) {
    // TODO: 验证 GitHub 源是否有效
    return { isValid: true, message: 'ok' };
  }
}

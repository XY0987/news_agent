import { Injectable } from '@nestjs/common';

/**
 * 采集服务 - 统一管理多个采集器
 * 封装为 Agent Tool: collect_rss, collect_github, collect_wechat
 */
@Injectable()
export class CollectorService {
  // TODO: 实现统一采集入口，分发到各个具体采集器
  // TODO: 实现 collectRss(), collectGithub(), collectWechat()
  // TODO: 实现 generateSummary(), batchGenerateSummaries()
}

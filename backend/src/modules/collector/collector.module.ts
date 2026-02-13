import { Module } from '@nestjs/common';
import { CollectorService } from './collector.service';
import { RssCollector } from './collectors/rss.collector';
import { GithubCollector } from './collectors/github.collector';
import { WechatCollector } from './collectors/wechat.collector';

@Module({
  providers: [CollectorService, RssCollector, GithubCollector, WechatCollector],
  exports: [CollectorService],
})
export class CollectorModule {}

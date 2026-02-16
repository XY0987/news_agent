import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectorService } from './collector.service.js';
import { CollectorController } from './collector.controller.js';
import { RssCollector } from './collectors/rss.collector.js';
import { GithubCollector } from './collectors/github.collector.js';
import { WechatCollector } from './collectors/wechat.collector.js';
import { WechatTokenService } from './services/wechat-token.service.js';
import { ContentEntity } from '../../common/database/entities/content.entity.js';
import { SourceEntity } from '../../common/database/entities/source.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([ContentEntity, SourceEntity])],
  controllers: [CollectorController],
  providers: [
    CollectorService,
    WechatTokenService,
    RssCollector,
    GithubCollector,
    WechatCollector,
  ],
  exports: [CollectorService, WechatCollector, WechatTokenService],
})
export class CollectorModule {}

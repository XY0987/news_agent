import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectorService } from './collector.service';
import { RssCollector } from './collectors/rss.collector';
import { GithubCollector } from './collectors/github.collector';
import { WechatCollector } from './collectors/wechat.collector';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { SourceEntity } from '../../common/database/entities/source.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContentEntity, SourceEntity])],
  providers: [CollectorService, RssCollector, GithubCollector, WechatCollector],
  exports: [CollectorService],
})
export class CollectorModule {}

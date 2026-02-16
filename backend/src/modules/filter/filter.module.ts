import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilterService } from './filter.service';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContentEntity, ContentScoreEntity])],
  providers: [FilterService],
  exports: [FilterService],
})
export class FilterModule {}

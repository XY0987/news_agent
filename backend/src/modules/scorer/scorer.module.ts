import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScorerService } from './scorer.service';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContentScoreEntity])],
  providers: [ScorerService],
  exports: [ScorerService],
})
export class ScorerModule {}

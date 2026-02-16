import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScorerService } from './scorer.service';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { UserEntity } from '../../common/database/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentScoreEntity, ContentEntity, UserEntity]),
  ],
  providers: [ScorerService],
  exports: [ScorerService],
})
export class ScorerModule {}

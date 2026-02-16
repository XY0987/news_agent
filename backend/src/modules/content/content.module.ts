import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentEntity,
      ContentScoreEntity,
      UserContentInteractionEntity,
    ]),
    FeedbackModule,
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}

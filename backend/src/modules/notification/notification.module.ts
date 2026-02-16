import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { UserEntity } from '../../common/database/entities/user.entity';
import { DigestEntity } from '../../common/database/entities/digest.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentEntity,
      ContentScoreEntity,
      UserEntity,
      DigestEntity,
      UserContentInteractionEntity,
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

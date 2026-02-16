import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';
import { DigestEntity } from '../../common/database/entities/digest.entity';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DigestEntity,
      ContentEntity,
      ContentScoreEntity,
      UserContentInteractionEntity,
    ]),
  ],
  controllers: [DigestController],
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}

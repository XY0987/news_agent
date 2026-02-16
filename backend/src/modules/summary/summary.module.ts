import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SummaryService } from './summary.service';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { UserEntity } from '../../common/database/entities/user.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentEntity,
      UserEntity,
      UserContentInteractionEntity,
    ]),
  ],
  providers: [SummaryService],
  exports: [SummaryService],
})
export class SummaryModule {}

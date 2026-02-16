import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackService } from './feedback.service';
import { FeedbackEntity } from '../../common/database/entities/feedback.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackEntity])],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}

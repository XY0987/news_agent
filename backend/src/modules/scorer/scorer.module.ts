import { Module } from '@nestjs/common';
import { ScorerService } from './scorer.service';

@Module({
  providers: [ScorerService],
  exports: [ScorerService],
})
export class ScorerModule {}

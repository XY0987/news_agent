import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilterService } from './filter.service';
import { ContentEntity } from '../../common/database/entities/content.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContentEntity])],
  providers: [FilterService],
  exports: [FilterService],
})
export class FilterModule {}

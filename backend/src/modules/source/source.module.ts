import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SourceController } from './source.controller';
import { SourceService } from './source.service';
import { SourceEntity } from '../../common/database/entities/source.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SourceEntity])],
  controllers: [SourceController],
  providers: [SourceService],
  exports: [SourceService],
})
export class SourceModule {}

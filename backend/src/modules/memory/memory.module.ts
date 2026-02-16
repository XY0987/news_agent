import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoryService } from './memory.service';
import { MemoryEntity } from '../../common/database/entities/memory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MemoryEntity])],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}

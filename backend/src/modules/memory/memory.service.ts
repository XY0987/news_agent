import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEntity } from '../../common/database/entities/memory.entity';

@Injectable()
export class MemoryService {
  constructor(
    @InjectRepository(MemoryEntity)
    private readonly memoryRepo: Repository<MemoryEntity>,
  ) {}

  // TODO: 实现 query(), store()
  // TODO: 实现 getRecentFeedback()
  // TODO: 实现 storeSuggestion()
  // TODO: 实现 analyzeSourceQuality()
}

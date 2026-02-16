import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';

@Injectable()
export class ScorerService {
  constructor(
    @InjectRepository(ContentScoreEntity)
    private readonly scoreRepo: Repository<ContentScoreEntity>,
  ) {}

  // TODO: 实现多维度评分逻辑
  // - 相关性评分 (0-100)
  // - 质量评分 (0-100)
  // - 时效性评分 (0-100)
  // - 新颖性评分 (0-100)
  // - 可操作性评分 (0-100)
  // - 加权综合分
}

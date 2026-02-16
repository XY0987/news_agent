import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentEntity } from '../../common/database/entities/content.entity';

@Injectable()
export class FilterService {
  constructor(
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
  ) {}

  // TODO: 实现过滤去重逻辑
  // - URL/external_id 强去重
  // - 标题 simhash 弱去重
  // - 最小长度过滤
  // - 黑名单关键词/作者过滤
  // - 时间窗口过滤
}

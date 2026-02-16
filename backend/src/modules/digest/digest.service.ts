import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DigestEntity } from '../../common/database/entities/digest.entity';

@Injectable()
export class DigestService {
  constructor(
    @InjectRepository(DigestEntity)
    private readonly digestRepo: Repository<DigestEntity>,
  ) {}

  // TODO: 实现日报/周报的生成、存储、查询
}

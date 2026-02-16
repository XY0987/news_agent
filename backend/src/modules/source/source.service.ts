import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceEntity } from '../../common/database/entities/source.entity';
import {
  CreateSourceDto,
  UpdateSourceDto,
  ValidateSourceDto,
} from './dto/index';

@Injectable()
export class SourceService {
  constructor(
    @InjectRepository(SourceEntity)
    private readonly sourceRepo: Repository<SourceEntity>,
  ) {}

  async create(dto: CreateSourceDto): Promise<SourceEntity> {
    const source = this.sourceRepo.create({
      userId: dto.userId,
      type: dto.type,
      identifier: dto.identifier,
      name: dto.name,
      config: dto.config || {},
      status: 'active',
      stats: { totalArticles: 0, relevantArticles: 0 },
    });
    return this.sourceRepo.save(source);
  }

  async findAll(userId?: string): Promise<SourceEntity[]> {
    const where = userId ? { userId } : {};
    return this.sourceRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<SourceEntity> {
    const source = await this.sourceRepo.findOneBy({ id });
    if (!source) throw new NotFoundException(`Source ${id} not found`);
    return source;
  }

  async findByUserAndType(
    userId: string,
    type: string,
  ): Promise<SourceEntity[]> {
    return this.sourceRepo.find({ where: { userId, type, status: 'active' } });
  }

  async findActiveByUser(userId: string): Promise<SourceEntity[]> {
    return this.sourceRepo.find({ where: { userId, status: 'active' } });
  }

  async update(id: string, dto: UpdateSourceDto): Promise<SourceEntity> {
    const source = await this.findById(id);
    Object.assign(source, dto);
    return this.sourceRepo.save(source);
  }

  async delete(id: string): Promise<void> {
    const result = await this.sourceRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Source ${id} not found`);
  }

  async updateLastCollected(id: string): Promise<void> {
    await this.sourceRepo.update(id, { lastCollectedAt: new Date() });
  }

  async updateStats(id: string, stats: Record<string, any>): Promise<void> {
    const source = await this.findById(id);
    source.stats = { ...source.stats, ...stats };
    await this.sourceRepo.save(source);
  }

  validate(dto: ValidateSourceDto): { valid: boolean; message: string } {
    // 基础验证：检查 identifier 格式
    if (!dto.identifier || dto.identifier.trim().length === 0) {
      return { valid: false, message: 'Identifier is required' };
    }

    switch (dto.type) {
      case 'wechat':
        // fakeid 格式验证
        return {
          valid: /^[a-zA-Z0-9_]+$/.test(dto.identifier),
          message: 'Wechat fakeid format check',
        };
      case 'rss':
        // URL 格式验证
        try {
          new URL(dto.identifier);
          return { valid: true, message: 'Valid RSS URL' };
        } catch {
          return { valid: false, message: 'Invalid RSS URL format' };
        }
      case 'github':
        // owner/repo 格式
        return {
          valid:
            /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(dto.identifier) ||
            dto.identifier === 'trending',
          message: 'GitHub identifier format check',
        };
      default:
        return { valid: true, message: 'No specific validation for this type' };
    }
  }

  async getStats(id: string): Promise<Record<string, any>> {
    const source = await this.findById(id);
    return {
      id: source.id,
      name: source.name,
      type: source.type,
      status: source.status,
      qualityScore: source.qualityScore,
      lastCollectedAt: source.lastCollectedAt,
      stats: source.stats,
    };
  }
}

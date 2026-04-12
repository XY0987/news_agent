import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEntity } from '../../common/database/entities/memory.entity';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @InjectRepository(MemoryEntity)
    private readonly memoryRepo: Repository<MemoryEntity>,
  ) {}

  /**
   * 查询记忆 - 按关键词和类型匹配
   */
  async query(
    userId: string,
    query: string,
    type?: string,
  ): Promise<{ memories: any[]; summary: string }> {
    const where: any = { userId };
    if (type) {
      where.type = type;
    }

    const memories = await this.memoryRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 20,
    });

    // 简单关键词匹配过滤
    const keywords = query.toLowerCase().split(/\s+/);
    const matched = memories.filter((m) => {
      const text =
        JSON.stringify(m.value).toLowerCase() + m.memoryKey.toLowerCase();
      return keywords.some((kw) => text.includes(kw));
    });

    const results = matched.length > 0 ? matched : memories.slice(0, 10);

    return {
      memories: results.map((m) => ({
        id: m.id,
        type: m.type,
        key: m.memoryKey,
        value: m.value,
        confidence: m.confidence,
        source: m.source,
        createdAt: m.createdAt,
      })),
      summary: `找到 ${results.length} 条相关记忆`,
    };
  }

  /**
   * 存储记忆
   */
  async store(data: {
    userId: string;
    type: string;
    content: string;
    confidence?: number;
  }): Promise<{ id: string; message: string }> {
    const memory = this.memoryRepo.create({
      userId: data.userId,
      type: data.type,
      memoryKey: `${data.type}_${Date.now()}`,
      value: { content: data.content, timestamp: new Date().toISOString() },
      confidence: data.confidence || 0.8,
      source: 'agent',
      validFrom: new Date(),
    });

    const saved = await this.memoryRepo.save(memory);
    this.logger.log(`存储记忆: type=${data.type}, userId=${data.userId}`);
    return { id: saved.id, message: '记忆已存储' };
  }

  /**
   * 存储来源建议
   */
  async storeSuggestion(data: {
    userId: string;
    sourceId: string;
    action: string;
    reason: string;
  }): Promise<{ id: string; message: string }> {
    const memory = this.memoryRepo.create({
      userId: data.userId,
      type: 'source_suggestion',
      memoryKey: `suggestion_${data.sourceId}_${Date.now()}`,
      value: {
        sourceId: data.sourceId,
        action: data.action,
        reason: data.reason,
        timestamp: new Date().toISOString(),
        status: 'pending', // pending / accepted / rejected
      },
      confidence: 0.9,
      source: 'agent',
      validFrom: new Date(),
    });

    const saved = await this.memoryRepo.save(memory);
    this.logger.log(
      `存储来源建议: sourceId=${data.sourceId}, action=${data.action}`,
    );
    return { id: saved.id, message: `来源建议已记录: ${data.action}` };
  }

  /**
   * 分析来源质量
   */
  async analyzeSourceQuality(params: {
    userId: string;
    sourceId?: string;
    days?: number;
  }): Promise<any> {
    const { userId, sourceId, days: _days = 30 } = params;

    // 查询相关的来源质量记忆
    const where: any = { userId, type: 'source_quality' };
    const memories = await this.memoryRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });

    if (sourceId) {
      const related = memories.filter(
        (m) => m.value && (m.value as any).sourceId === sourceId,
      );
      return {
        sourceId,
        qualityRecords: related.map((m) => ({
          value: m.value,
          createdAt: m.createdAt,
        })),
        summary: `来源 ${sourceId} 有 ${related.length} 条质量记录`,
      };
    }

    return {
      totalRecords: memories.length,
      records: memories.slice(0, 20).map((m) => ({
        key: m.memoryKey,
        value: m.value,
        createdAt: m.createdAt,
      })),
      summary: `共有 ${memories.length} 条来源质量记录`,
    };
  }

  /**
   * 获取所有记忆（分页）
   */
  async findAll(
    userId: string,
    type?: string,
    limit = 20,
  ): Promise<MemoryEntity[]> {
    const where: any = { userId };
    if (type) where.type = type;

    return this.memoryRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

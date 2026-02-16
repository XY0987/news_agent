import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between, In } from 'typeorm';
import { DigestEntity } from '../../common/database/entities/digest.entity';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';

export interface DigestItem {
  content: ContentEntity;
  score: ContentScoreEntity | null;
  interaction: UserContentInteractionEntity | null;
}

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    @InjectRepository(DigestEntity)
    private readonly digestRepo: Repository<DigestEntity>,
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
    @InjectRepository(ContentScoreEntity)
    private readonly scoreRepo: Repository<ContentScoreEntity>,
    @InjectRepository(UserContentInteractionEntity)
    private readonly interactionRepo: Repository<UserContentInteractionEntity>,
  ) {}

  /**
   * 组装每日精选内容
   * 根据评分排名获取 Top K 内容，附带评分和摘要
   */
  async assembleDigest(
    userId: string,
    options?: { topK?: number; minScore?: number },
  ): Promise<{ items: DigestItem[]; summary: string }> {
    const topK = options?.topK || 7;
    const minScore = options?.minScore || 0;

    // 获取今日已评分但未选中的内容（按分数排序）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scores = await this.scoreRepo
      .createQueryBuilder('cs')
      .leftJoinAndSelect('cs.contentItem', 'c')
      .where('cs.user_id = :userId', { userId })
      .andWhere('cs.created_at >= :today', { today })
      .andWhere('cs.final_score >= :minScore', { minScore })
      .orderBy('cs.final_score', 'DESC')
      .take(topK)
      .getMany();

    if (scores.length === 0) {
      return { items: [], summary: '今日暂无可推送的内容' };
    }

    const contentIds = scores.map((s) => s.contentId);

    // 获取交互/摘要信息
    const interactions = await this.interactionRepo.find({
      where: { userId, contentId: In(contentIds) },
    });
    const interactionMap = new Map(interactions.map((i) => [i.contentId, i]));

    const items: DigestItem[] = scores.map((score) => ({
      content: score.contentItem,
      score,
      interaction: interactionMap.get(score.contentId) || null,
    }));

    return {
      items,
      summary: `组装完成: ${items.length} 篇内容，最高分 ${scores[0]?.finalScore || 0}`,
    };
  }

  /**
   * 获取用户的推送历史列表
   */
  async findByUser(
    userId: string,
    options?: { type?: string; page?: number; pageSize?: number },
  ): Promise<{ data: DigestEntity[]; total: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { userId };
    if (options?.type) where.type = options.type;

    const [data, total] = await this.digestRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return { data, total };
  }

  /**
   * 获取单个推送记录
   */
  async findById(id: string): Promise<DigestEntity | null> {
    return this.digestRepo.findOneBy({ id });
  }

  /**
   * 获取用户今日的推送记录
   */
  async getTodayDigest(userId: string): Promise<DigestEntity | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.digestRepo.findOne({
      where: {
        userId,
        type: 'daily',
        createdAt: MoreThanOrEqual(today),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 获取指定日期范围内的推送记录
   */
  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DigestEntity[]> {
    return this.digestRepo.find({
      where: {
        userId,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 获取推送统计
   */
  async getStats(userId: string, days = 30): Promise<{
    totalDigests: number;
    dailyCount: number;
    weeklyCount: number;
    lastDigestAt: Date | null;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const digests = await this.digestRepo.find({
      where: {
        userId,
        createdAt: MoreThanOrEqual(since),
      },
      order: { createdAt: 'DESC' },
    });

    return {
      totalDigests: digests.length,
      dailyCount: digests.filter((d) => d.type === 'daily').length,
      weeklyCount: digests.filter((d) => d.type === 'weekly').length,
      lastDigestAt: digests.length > 0 ? digests[0].createdAt : null,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { UserContentInteractionEntity } from '../../common/database/entities/user-content-interaction.entity';
import { ContentQueryDto } from './dto/index';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
    @InjectRepository(ContentScoreEntity)
    private readonly scoreRepo: Repository<ContentScoreEntity>,
    @InjectRepository(UserContentInteractionEntity)
    private readonly interactionRepo: Repository<UserContentInteractionEntity>,
  ) {}

  async findAll(
    query: ContentQueryDto,
  ): Promise<{ data: ContentEntity[]; total: number }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const qb = this.contentRepo.createQueryBuilder('c');

    if (query.sourceId) {
      qb.andWhere('c.source_id = :sourceId', { sourceId: query.sourceId });
    }

    if (query.search) {
      qb.andWhere('c.title LIKE :search', { search: `%${query.search}%` });
    }

    const ALLOWED_SORT_COLUMNS = ['created_at', 'collected_at', 'published_at', 'title'];
    const sortBy = (query.sortBy && ALLOWED_SORT_COLUMNS.includes(query.sortBy)) ? query.sortBy : 'created_at';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`c.${sortBy}`, sortOrder);

    qb.skip(skip).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findById(id: string): Promise<ContentEntity> {
    const content = await this.contentRepo.findOne({
      where: { id },
      relations: ['source'],
    });
    if (!content) throw new NotFoundException(`Content ${id} not found`);
    return content;
  }

  async findByUrl(url: string): Promise<ContentEntity | null> {
    return this.contentRepo.findOneBy({ url });
  }

  async findByExternalId(externalId: string): Promise<ContentEntity | null> {
    return this.contentRepo.findOneBy({ externalId });
  }

  async save(content: Partial<ContentEntity>): Promise<ContentEntity> {
    const entity = this.contentRepo.create(content);
    return this.contentRepo.save(entity);
  }

  async saveBatch(
    contents: Partial<ContentEntity>[],
  ): Promise<ContentEntity[]> {
    const entities = contents.map((c) => this.contentRepo.create(c));
    return this.contentRepo.save(entities);
  }

  async getTodayDigest(userId: string): Promise<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scores = await this.scoreRepo.find({
      where: {
        userId,
        isSelected: true,
        createdAt: MoreThanOrEqual(today),
      },
      relations: ['contentItem', 'contentItem.source'],
      order: { finalScore: 'DESC' },
      take: 10,
    });

    const contentIds = scores.map((s) => s.contentId);
    const interactions =
      contentIds.length > 0
        ? await this.interactionRepo.find({
            where: contentIds.map((cid) => ({ contentId: cid, userId })),
          })
        : [];
    const interMap = new Map(interactions.map((i) => [i.contentId, i]));

    return scores.map((s) => {
      const c = s.contentItem;
      const inter = interMap.get(s.contentId);
      return {
        id: c.id,
        title: c.title,
        url: c.url,
        author: c.author,
        sourceName: c.source?.name || c.metadata?.sourceName || '',
        sourceType: c.source?.type || c.metadata?.sourceType || '',
        publishedAt: c.publishedAt,
        score: s.finalScore,
        scoreBreakdown: s.scoreBreakdown,
        summary: inter?.summary || '',
        suggestions: inter?.suggestions || [],
        tags: c.metadata?.tags || [],
      };
    });
  }

  async getContentWithScore(contentId: string, userId: string) {
    const content = await this.findById(contentId);
    const score = await this.scoreRepo.findOneBy({ contentId, userId });
    const interaction = await this.interactionRepo.findOneBy({
      contentId,
      userId,
    });

    return {
      ...content,
      score: score
        ? {
            finalScore: score.finalScore,
            breakdown: score.scoreBreakdown,
            isSelected: score.isSelected,
          }
        : null,
      interaction: interaction
        ? {
            isRead: interaction.isRead,
            isSaved: interaction.isSaved,
            isIgnored: interaction.isIgnored,
            summary: interaction.summary,
            suggestions: interaction.suggestions,
          }
        : null,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'DESC';
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

    const scores = await this.scoreRepo
      .createQueryBuilder('cs')
      .leftJoinAndSelect('cs.contentItem', 'c')
      .where('cs.user_id = :userId', { userId })
      .andWhere('cs.is_selected = :selected', { selected: true })
      .andWhere('cs.created_at >= :today', { today })
      .orderBy('cs.final_score', 'DESC')
      .take(10)
      .getMany();

    return scores.map((s) => ({
      content: s.contentItem,
      score: s.finalScore,
      breakdown: s.scoreBreakdown,
      selectionReason: s.selectionReason,
    }));
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

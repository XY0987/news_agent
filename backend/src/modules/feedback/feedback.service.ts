import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { FeedbackEntity } from '../../common/database/entities/feedback.entity';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(FeedbackEntity)
    private readonly feedbackRepo: Repository<FeedbackEntity>,
  ) {}

  async create(data: {
    userId: string;
    contentId: string;
    feedbackType: string;
    feedbackReason?: string;
    readDuration?: number;
  }): Promise<FeedbackEntity> {
    const feedback = this.feedbackRepo.create(data);
    return this.feedbackRepo.save(feedback);
  }

  async findByUser(userId: string, days = 7): Promise<FeedbackEntity[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.feedbackRepo.find({
      where: {
        userId,
        createdAt: MoreThanOrEqual(since),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findByContent(contentId: string): Promise<FeedbackEntity[]> {
    return this.feedbackRepo.find({ where: { contentId } });
  }

  async getStats(userId: string, days = 30): Promise<Record<string, number>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const feedbacks = await this.feedbackRepo.find({
      where: {
        userId,
        createdAt: MoreThanOrEqual(since),
      },
    });

    const stats: Record<string, number> = {
      useful: 0,
      useless: 0,
      save: 0,
      ignore: 0,
      total: feedbacks.length,
    };

    for (const f of feedbacks) {
      if (stats[f.feedbackType] !== undefined) {
        stats[f.feedbackType]++;
      }
    }

    return stats;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { ContentEntity } from '../../common/database/entities/content.entity';

export interface FilterResult {
  passedIds: string[];
  filteredOut: { id: string; reason: string }[];
  stats: {
    total: number;
    passed: number;
    duplicateRemoved: number;
    tooShort: number;
    tooOld: number;
    blacklisted: number;
  };
}

@Injectable()
export class FilterService {
  private readonly logger = new Logger(FilterService.name);

  constructor(
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
  ) {}

  /**
   * 过滤去重 - Agent Tool 入口
   */
  async filterAndDedup(params: {
    contentIds?: string[];
    userId: string;
    minLength?: number;
    daysWindow?: number;
  }): Promise<FilterResult> {
    const { userId, minLength = 100, daysWindow = 7 } = params;
    let contents: ContentEntity[];

    if (params.contentIds && params.contentIds.length > 0) {
      contents = await this.contentRepo.findBy({ id: In(params.contentIds) });
    } else {
      // 获取最近 N 天的内容
      const since = new Date();
      since.setDate(since.getDate() - daysWindow);
      contents = await this.contentRepo.find({
        where: { collectedAt: MoreThanOrEqual(since) },
        order: { collectedAt: 'DESC' },
        take: 500,
      });
    }

    const stats = {
      total: contents.length,
      passed: 0,
      duplicateRemoved: 0,
      tooShort: 0,
      tooOld: 0,
      blacklisted: 0,
    };

    const passedIds: string[] = [];
    const filteredOut: { id: string; reason: string }[] = [];
    const seenUrls = new Set<string>();
    const seenTitleHashes = new Set<string>();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysWindow);

    for (const content of contents) {
      // 1. URL 强去重
      if (content.url && seenUrls.has(content.url)) {
        stats.duplicateRemoved++;
        filteredOut.push({ id: content.id, reason: 'duplicate_url' });
        continue;
      }

      // 2. 标题 hash 弱去重
      if (content.titleHash && seenTitleHashes.has(content.titleHash)) {
        stats.duplicateRemoved++;
        filteredOut.push({ id: content.id, reason: 'duplicate_title' });
        continue;
      }

      // 3. 最小长度过滤
      const contentLength = content.content ? content.content.length : 0;
      if (contentLength < minLength) {
        stats.tooShort++;
        filteredOut.push({ id: content.id, reason: `too_short (${contentLength} chars)` });
        continue;
      }

      // 4. 时间窗口过滤
      const publishDate = content.publishedAt || content.collectedAt;
      if (publishDate && publishDate < cutoffDate) {
        stats.tooOld++;
        filteredOut.push({ id: content.id, reason: 'too_old' });
        continue;
      }

      // 5. 黑名单关键词过滤
      if (this.isBlacklisted(content)) {
        stats.blacklisted++;
        filteredOut.push({ id: content.id, reason: 'blacklisted' });
        continue;
      }

      // 通过所有过滤
      if (content.url) seenUrls.add(content.url);
      if (content.titleHash) seenTitleHashes.add(content.titleHash);
      passedIds.push(content.id);
      stats.passed++;
    }

    this.logger.log(
      `过滤完成: ${stats.total} → ${stats.passed} (去重 ${stats.duplicateRemoved}, 过短 ${stats.tooShort}, 过旧 ${stats.tooOld}, 黑名单 ${stats.blacklisted})`,
    );

    return { passedIds, filteredOut, stats };
  }

  /**
   * 黑名单关键词检查
   */
  private isBlacklisted(content: ContentEntity): boolean {
    const blacklistKeywords = ['广告', '推广', '商务合作', 'ad', 'sponsored'];
    const title = (content.title || '').toLowerCase();

    return blacklistKeywords.some((kw) => title.includes(kw.toLowerCase()));
  }
}

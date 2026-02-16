import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';

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
    similarToSent: number;
  };
}

@Injectable()
export class FilterService {
  private readonly logger = new Logger(FilterService.name);

  private readonly BLACKLIST_KEYWORDS = [
    '广告', '推广', '商务合作', '赞助', '优惠券', '打折',
    'ad', 'sponsored', 'promotion', 'advertisement',
  ];

  constructor(
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
    @InjectRepository(ContentScoreEntity)
    private readonly scoreRepo: Repository<ContentScoreEntity>,
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
      contents = await this.contentRepo.findBy({
        id: In(params.contentIds),
      });
    } else if (params.contentIds && params.contentIds.length === 0) {
      return {
        passedIds: [],
        filteredOut: [],
        stats: { total: 0, passed: 0, duplicateRemoved: 0, tooShort: 0, tooOld: 0, blacklisted: 0, similarToSent: 0 },
      };
    } else {
      const since = new Date();
      since.setDate(since.getDate() - daysWindow);
      contents = await this.contentRepo.find({
        where: { collectedAt: MoreThanOrEqual(since) },
        order: { collectedAt: 'DESC' },
        take: 500,
      });
    }

    // 获取最近已推送的内容标题（用于相似度去重）
    const recentSentTitles = await this.getRecentSentTitles(userId, daysWindow);

    const stats = {
      total: contents.length,
      passed: 0,
      duplicateRemoved: 0,
      tooShort: 0,
      tooOld: 0,
      blacklisted: 0,
      similarToSent: 0,
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

      // 2. 标题 hash 弱去重（批次内）
      const titleHash = content.titleHash || this.simpleHash(content.title || '');
      if (titleHash && seenTitleHashes.has(titleHash)) {
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

      // 6. 与已推送内容的标题相似度检查
      if (this.isSimilarToSent(content.title || '', recentSentTitles)) {
        stats.similarToSent++;
        filteredOut.push({ id: content.id, reason: 'similar_to_sent' });
        continue;
      }

      // 通过所有过滤
      if (content.url) seenUrls.add(content.url);
      if (titleHash) seenTitleHashes.add(titleHash);
      passedIds.push(content.id);
      stats.passed++;
    }

    this.logger.log(
      `过滤完成: ${stats.total} → ${stats.passed} (去重 ${stats.duplicateRemoved}, 过短 ${stats.tooShort}, 过旧 ${stats.tooOld}, 黑名单 ${stats.blacklisted}, 已推送相似 ${stats.similarToSent})`,
    );

    return { passedIds, filteredOut, stats };
  }

  /**
   * 获取最近已推送内容的标题
   */
  private async getRecentSentTitles(userId: string, days: number): Promise<string[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const sentScores = await this.scoreRepo.find({
      where: {
        userId,
        isSelected: true,
        createdAt: MoreThanOrEqual(since),
      },
      relations: ['contentItem'],
    });

    return sentScores
      .filter((s) => s.contentItem?.title)
      .map((s) => s.contentItem.title);
  }

  /**
   * 检查标题是否与已推送内容相似
   * 使用简单的字符重叠率判断（Jaccard 相似度）
   */
  private isSimilarToSent(title: string, sentTitles: string[]): boolean {
    if (!title || sentTitles.length === 0) return false;

    const titleTokens = this.tokenize(title);
    if (titleTokens.size === 0) return false;

    for (const sentTitle of sentTitles) {
      const sentTokens = this.tokenize(sentTitle);
      if (sentTokens.size === 0) continue;

      const intersection = new Set([...titleTokens].filter((t) => sentTokens.has(t)));
      const union = new Set([...titleTokens, ...sentTokens]);
      const similarity = intersection.size / union.size;

      if (similarity > 0.7) return true;
    }

    return false;
  }

  /**
   * 简单分词（按字符 bigram + 空格分词）
   */
  private tokenize(text: string): Set<string> {
    const tokens = new Set<string>();
    const normalized = text.toLowerCase().trim();

    // 空格分词
    for (const word of normalized.split(/\s+/)) {
      if (word.length >= 2) tokens.add(word);
    }

    // 字符 bigram（对中文有效）
    for (let i = 0; i < normalized.length - 1; i++) {
      tokens.add(normalized.slice(i, i + 2));
    }

    return tokens;
  }

  /**
   * 黑名单关键词检查
   */
  private isBlacklisted(content: ContentEntity): boolean {
    const title = (content.title || '').toLowerCase();
    return this.BLACKLIST_KEYWORDS.some((kw) => title.includes(kw.toLowerCase()));
  }

  /**
   * 简单字符串 hash（作为 titleHash 的备选计算）
   */
  private simpleHash(str: string): string {
    const s = str.toLowerCase().replace(/\s+/g, '');
    if (!s) return '';
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash.toString(16);
  }
}

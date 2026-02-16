import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { ContentScoreEntity } from '../../common/database/entities/content-score.entity';
import { ContentEntity } from '../../common/database/entities/content.entity';
import { UserEntity } from '../../common/database/entities/user.entity';

export interface ScoreResult {
  contentId: string;
  title: string;
  finalScore: number;
  breakdown: {
    relevance: number;
    quality: number;
    timeliness: number;
    novelty: number;
    actionability: number;
  };
  isSelected: boolean;
}

const DEFAULT_WEIGHTS = {
  relevance: 0.45,
  quality: 0.2,
  timeliness: 0.2,
  novelty: 0.1,
  actionability: 0.05,
};

@Injectable()
export class ScorerService {
  private readonly logger = new Logger(ScorerService.name);

  constructor(
    @InjectRepository(ContentScoreEntity)
    private readonly scoreRepo: Repository<ContentScoreEntity>,
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * 批量评分 - Agent Tool 入口
   */
  async scoreAll(params: {
    contentIds: string[];
    userId: string;
  }): Promise<{ scores: ScoreResult[]; summary: string }> {
    const { contentIds, userId } = params;

    if (!contentIds || contentIds.length === 0) {
      return { scores: [], summary: '没有内容需要评分' };
    }

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new Error(`用户 ${userId} 不存在`);
    }

    const contents = await this.contentRepo.findBy({ id: In(contentIds) });
    const weights = (user.preferences as any)?.scoreWeights || DEFAULT_WEIGHTS;

    // 获取最近已推送的内容标题用于新颖性评分
    const recentSentTitles = await this.getRecentSentTitles(userId, 7);

    const scores: ScoreResult[] = [];

    for (const content of contents) {
      const breakdown = {
        relevance: this.scoreRelevance(content, user),
        quality: this.scoreQuality(content),
        timeliness: this.scoreTimeliness(content),
        novelty: this.scoreNovelty(content, recentSentTitles),
        actionability: this.scoreActionability(content),
      };

      const finalScore =
        breakdown.relevance * weights.relevance +
        breakdown.quality * weights.quality +
        breakdown.timeliness * weights.timeliness +
        breakdown.novelty * weights.novelty +
        breakdown.actionability * weights.actionability;

      // 检查是否已有评分，有则更新
      let scoreEntity = await this.scoreRepo.findOneBy({
        contentId: content.id,
        userId,
      });

      if (scoreEntity) {
        scoreEntity.finalScore = Math.round(finalScore * 100) / 100;
        scoreEntity.scoreBreakdown = breakdown;
      } else {
        scoreEntity = this.scoreRepo.create({
          contentId: content.id,
          userId,
          finalScore: Math.round(finalScore * 100) / 100,
          scoreBreakdown: breakdown,
          isSelected: false,
        });
      }
      await this.scoreRepo.save(scoreEntity);

      scores.push({
        contentId: content.id,
        title: content.title,
        finalScore: Math.round(finalScore * 100) / 100,
        breakdown,
        isSelected: false,
      });
    }

    // 按分数降序排列
    scores.sort((a, b) => b.finalScore - a.finalScore);

    this.logger.log(
      `评分完成: ${scores.length} 篇内容, 最高分 ${scores[0]?.finalScore || 0}`,
    );

    return {
      scores,
      summary: `已评分 ${scores.length} 篇内容。Top 5 分数: ${scores
        .slice(0, 5)
        .map((s) => `${s.finalScore}`)
        .join(', ')}`,
    };
  }

  /**
   * 获取最近已推送的内容标题
   */
  private async getRecentSentTitles(userId: string, days: number): Promise<string[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    try {
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
    } catch {
      return [];
    }
  }

  /**
   * 相关性评分 (0-100): 基于用户画像关键词/标签匹配
   */
  private scoreRelevance(content: ContentEntity, user: UserEntity): number {
    const profile = (user.profile || {}) as Record<string, any>;
    const interests: string[] = [
      ...(profile.primaryInterests || []),
      ...(profile.secondaryInterests || []),
      ...(profile.techStack || []),
    ];
    const excludeTags: string[] = profile.excludeTags || [];

    const title = (content.title || '').toLowerCase();
    const text = (content.content || '').toLowerCase().slice(0, 2000);
    const combined = title + ' ' + text;

    // 排除标签匹配 -> 大幅降分
    for (const tag of excludeTags) {
      if (combined.includes(tag.toLowerCase())) {
        return 10;
      }
    }

    // 兴趣标签匹配
    let matchCount = 0;
    for (const interest of interests) {
      if (combined.includes(interest.toLowerCase())) {
        matchCount++;
      }
    }

    if (interests.length === 0) return 50; // 无画像时给中等分

    // 标题匹配额外加分
    let titleBonus = 0;
    for (const interest of interests) {
      if (title.includes(interest.toLowerCase())) {
        titleBonus += 5;
      }
    }

    const matchRate = matchCount / interests.length;
    return Math.min(100, Math.round(30 + matchRate * 70 + titleBonus));
  }

  /**
   * 质量评分 (0-100): 内容长度、结构
   */
  private scoreQuality(content: ContentEntity): number {
    let score = 40; // 基础分

    const length = content.content ? content.content.length : 0;

    // 长度分
    if (length > 5000) score += 25;
    else if (length > 2000) score += 20;
    else if (length > 1000) score += 15;
    else if (length > 500) score += 10;

    // 有标题
    if (content.title && content.title.length > 5) score += 10;

    // 有作者
    if (content.author) score += 5;

    // 有链接
    if (content.url) score += 5;

    // 内容包含代码块（教程类文章质量加分）
    if (content.content && content.content.includes('```')) score += 10;

    // 有明确的发布时间
    if (content.publishedAt) score += 5;

    return Math.min(100, score);
  }

  /**
   * 时效性评分 (0-100): 时间衰减函数
   */
  private scoreTimeliness(content: ContentEntity): number {
    const publishDate = content.publishedAt || content.collectedAt || new Date();
    const ageHours =
      (Date.now() - new Date(publishDate).getTime()) / (1000 * 60 * 60);

    if (ageHours < 6) return 100;
    if (ageHours < 12) return 95;
    if (ageHours < 24) return 90;
    if (ageHours < 48) return 80;
    if (ageHours < 72) return 70;
    if (ageHours < 168) return 50; // 7 天
    if (ageHours < 336) return 30; // 14 天
    return 10;
  }

  /**
   * 新颖性评分 (0-100): 基于与最近已推送内容的标题相似度
   * 与已推送内容越不相似，分数越高
   */
  private scoreNovelty(content: ContentEntity, recentSentTitles: string[]): number {
    if (!content.title || recentSentTitles.length === 0) {
      return 80; // 无历史数据时给较高分
    }

    const titleTokens = this.tokenize(content.title);
    if (titleTokens.size === 0) return 80;

    let maxSimilarity = 0;

    for (const sentTitle of recentSentTitles) {
      const sentTokens = this.tokenize(sentTitle);
      if (sentTokens.size === 0) continue;

      const intersection = new Set([...titleTokens].filter((t) => sentTokens.has(t)));
      const union = new Set([...titleTokens, ...sentTokens]);
      const similarity = intersection.size / union.size;

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    }

    // 相似度越高，新颖性越低
    // similarity 0.0 → novelty 100
    // similarity 0.3 → novelty 70
    // similarity 0.5 → novelty 50
    // similarity 0.7 → novelty 30
    // similarity 1.0 → novelty 0
    return Math.round(100 * (1 - maxSimilarity));
  }

  /**
   * 可操作性评分 (0-100): 简单规则判断
   */
  private scoreActionability(content: ContentEntity): number {
    let score = 30;
    const text = (content.content || '').toLowerCase();

    // 包含教程/步骤相关关键词
    const actionKeywords = [
      'tutorial', '教程', 'how to', '如何', 'step by step', '步骤',
      'example', '示例', 'demo', 'practice', '实践', 'hands-on',
      'getting started', '入门', '实战', 'quickstart',
    ];

    for (const kw of actionKeywords) {
      if (text.includes(kw)) {
        score += 15;
        break;
      }
    }

    // 包含代码
    if (text.includes('```') || text.includes('<code>')) score += 20;

    // 包含链接（可能有资源引用）
    if (text.includes('http://') || text.includes('https://')) score += 10;

    // 包含命令行指令
    if (text.includes('npm ') || text.includes('pip ') || text.includes('$ ')) score += 10;

    return Math.min(100, score);
  }

  /**
   * 简单分词
   */
  private tokenize(text: string): Set<string> {
    const tokens = new Set<string>();
    const normalized = text.toLowerCase().trim();

    for (const word of normalized.split(/\s+/)) {
      if (word.length >= 2) tokens.add(word);
    }

    // 字符 bigram（对中文有效）
    for (let i = 0; i < normalized.length - 1; i++) {
      tokens.add(normalized.slice(i, i + 2));
    }

    return tokens;
  }
}

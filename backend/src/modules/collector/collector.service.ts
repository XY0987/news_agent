import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, In } from 'typeorm';
import { ContentEntity } from '../../common/database/entities/content.entity.js';
import { SourceEntity } from '../../common/database/entities/source.entity.js';
import { WechatCollector } from './collectors/wechat.collector.js';
import { GithubCollector } from './collectors/github.collector.js';
import type { RawContent } from './base.collector.js';

export interface CollectResult {
  sourceType: string;
  totalCollected: number;
  newSaved: number;
  duplicatesSkipped: number;
  errors: string[];
  /** 本次新保存到数据库的内容 ID 列表 */
  savedContentIds: string[];
}

@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);

  constructor(
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
    @InjectRepository(SourceEntity)
    private readonly sourceRepo: Repository<SourceEntity>,
    private readonly configService: ConfigService,
    private readonly wechatCollector: WechatCollector,
    private readonly githubCollector: GithubCollector,
  ) {}

  /**
   * 按用户 ID 采集所有 active 数据源
   */
  async collectByUser(userId: string): Promise<CollectResult[]> {
    const sources = await this.sourceRepo.find({
      where: { userId, status: 'active' },
    });

    if (sources.length === 0) {
      this.logger.warn(`用户 ${userId} 没有活跃数据源`);
      return [];
    }

    const results: CollectResult[] = [];

    // 按类型分组采集
    const grouped = this.groupByType(sources);

    // 测试模式：按环境变量限制每种类型的源数量
    const maxSourcesRaw = this.configService.get<string>('COLLECT_MAX_SOURCES');
    const maxSources = maxSourcesRaw ? parseInt(maxSourcesRaw, 10) : 0;
    if (maxSources > 0) {
      const summary = Object.entries(grouped)
        .map(([t, s]) => `${t}=${s.length}`)
        .join(', ');
      this.logger.warn(
        `[测试模式] COLLECT_MAX_SOURCES=${maxSources}，各类型源数量: ${summary}`,
      );
      for (const type of Object.keys(grouped)) {
        if (grouped[type].length > maxSources) {
          this.logger.warn(
            `[测试模式] ${type} 类型源从 ${grouped[type].length} 截断为 ${maxSources} 个`,
          );
          grouped[type] = grouped[type].slice(0, maxSources);
        }
      }
    }

    for (const [type, typeSources] of Object.entries(grouped)) {
      try {
        const result = await this.collectByType(type, typeSources);
        results.push(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`采集类型 ${type} 失败: ${msg}`);
        results.push({
          sourceType: type,
          totalCollected: 0,
          newSaved: 0,
          duplicatesSkipped: 0,
          errors: [msg],
          savedContentIds: [],
        });
      }
    }

    return results;
  }

  /**
   * 采集指定数据源
   */
  async collectBySources(sourceIds: string[]): Promise<CollectResult[]> {
    if (!sourceIds || sourceIds.length === 0) return [];
    const sources = await this.sourceRepo.findBy({ id: In(sourceIds) });
    const grouped = this.groupByType(sources);
    const results: CollectResult[] = [];

    for (const [type, typeSources] of Object.entries(grouped)) {
      try {
        const result = await this.collectByType(type, typeSources);
        results.push(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({
          sourceType: type,
          totalCollected: 0,
          newSaved: 0,
          duplicatesSkipped: 0,
          errors: [msg],
          savedContentIds: [],
        });
      }
    }

    return results;
  }

  /**
   * 仅采集用户的 GitHub 数据源（用于独立的 GitHub 热点推送流程）
   */
  async collectGithubByUser(userId: string): Promise<CollectResult[]> {
    const sources = await this.sourceRepo.find({
      where: { userId, type: 'github', status: 'active' },
    });

    if (sources.length === 0) {
      this.logger.warn(`用户 ${userId} 没有活跃的 GitHub 数据源`);
      return [];
    }

    try {
      const result = await this.collectByType('github', sources);
      return [result];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`GitHub 采集失败: ${msg}`);
      return [
        {
          sourceType: 'github',
          totalCollected: 0,
          newSaved: 0,
          duplicatesSkipped: 0,
          errors: [msg],
          savedContentIds: [],
        },
      ];
    }
  }

  /**
   * 按类型调用对应采集器
   */
  private async collectByType(
    type: string,
    sources: SourceEntity[],
  ): Promise<CollectResult> {
    let rawContents: RawContent[] = [];
    const errors: string[] = [];

    switch (type) {
      case 'wechat':
        rawContents = await this.wechatCollector.collect(
          sources.map((s) => ({
            id: s.id,
            identifier: s.identifier,
            name: s.name,
            config: s.config,
          })),
        );
        break;

      case 'github':
        rawContents = await this.githubCollector.collect(
          sources.map((s) => ({
            id: s.id,
            identifier: s.identifier,
            name: s.name,
            config: s.config,
          })),
        );
        break;

      // TODO: case 'rss': ...

      default:
        errors.push(`不支持的采集类型: ${type}`);
    }

    // 写入数据库（URL 去重）
    const { newSaved, duplicatesSkipped, savedIds } =
      await this.saveContents(rawContents);

    // 更新每个数据源的最后采集时间和统计
    for (const source of sources) {
      try {
        await this.sourceRepo.update(source.id, {
          lastCollectedAt: new Date(),
        });
        const sourceContents = rawContents.filter(
          (c) => c.sourceId === source.id,
        );
        if (sourceContents.length > 0) {
          const currentStats = (source.stats || {}) as Record<string, any>;
          const updatedStats = {
            ...currentStats,
            totalArticles:
              ((currentStats.totalArticles as number) || 0) +
              sourceContents.length,
            lastCollectCount: sourceContents.length,
            lastCollectAt: new Date().toISOString(),
          };
          source.stats = updatedStats;
          await this.sourceRepo.save(source);
        }
      } catch (error) {
        this.logger.error(
          `更新数据源 ${source.id} 统计失败: ${(error as Error).message}`,
        );
      }
    }

    return {
      sourceType: type,
      totalCollected: rawContents.length,
      newSaved,
      duplicatesSkipped,
      errors,
      savedContentIds: savedIds,
    };
  }

  /**
   * 将采集到的 RawContent 写入 Content 表，URL 去重
   */
  private async saveContents(
    rawContents: RawContent[],
  ): Promise<{
    newSaved: number;
    duplicatesSkipped: number;
    savedIds: string[];
  }> {
    let newSaved = 0;
    let duplicatesSkipped = 0;
    const savedIds: string[] = [];

    for (const raw of rawContents) {
      try {
        // URL 去重
        if (raw.url) {
          const existing = await this.contentRepo.findOneBy({ url: raw.url });
          if (existing) {
            duplicatesSkipped++;
            continue;
          }
        }

        // externalId 去重
        if (raw.contentId) {
          const existing = await this.contentRepo.findOneBy({
            externalId: raw.contentId,
          });
          if (existing) {
            duplicatesSkipped++;
            continue;
          }
        }

        const entity = this.contentRepo.create({
          sourceId: raw.sourceId,
          externalId: raw.contentId || undefined,
          title: raw.title,
          content: raw.content,
          url: raw.url,
          author: raw.author,
          publishedAt: raw.publishedAt,
          collectedAt: raw.collectedAt || new Date(),
          metadata: {
            sourceType: raw.sourceType,
            sourceName: raw.sourceName,
            mediaUrls: raw.mediaUrls,
            ...raw.rawMetadata,
          },
          titleHash: this.simpleHash(raw.title),
        });

        await this.contentRepo.save(entity);
        savedIds.push(entity.id);
        newSaved++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // 唯一键冲突视为去重
        if (msg.includes('Duplicate') || msg.includes('ER_DUP_ENTRY')) {
          duplicatesSkipped++;
        } else {
          this.logger.error(`保存内容失败: ${msg}`);
        }
      }
    }

    this.logger.log(
      `内容保存完成: 新增 ${newSaved}, 去重跳过 ${duplicatesSkipped}`,
    );
    return { newSaved, duplicatesSkipped, savedIds };
  }

  /**
   * 简单标题哈希（用于弱去重）
   */
  private simpleHash(text: string): string {
    if (!text) return '';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private groupByType(sources: SourceEntity[]): Record<string, SourceEntity[]> {
    const grouped: Record<string, SourceEntity[]> = {};
    for (const s of sources) {
      if (!grouped[s.type]) grouped[s.type] = [];
      grouped[s.type].push(s);
    }
    return grouped;
  }
}

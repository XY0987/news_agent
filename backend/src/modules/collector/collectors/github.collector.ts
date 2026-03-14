import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  BaseCollector,
  type RawContent,
  type SourceValidation,
} from '../base.collector.js';

/** 解析后的 GitHub 仓库信息 */
export interface GithubRepoInfo {
  fullName: string; // owner/repo
  description: string;
  language: string;
  stars: number;
  starsToday: number; // 时段内新增 star
  forks: number;
  url: string;
  /** 数据来源标识 */
  trendSource: 'github_trending' | 'trendingrepos_api' | 'github_topics';
  /** 话题标签（来自 topics 源） */
  topics?: string[];
}

interface GithubCollectorConfig {
  /** GitHub Trending 页面 URL */
  trendingUrl: string;
  /** TrendingRepos API URL */
  trendingReposApiUrl: string;
  /** GitHub Topics 前端页面 URL */
  frontendTopicsUrl: string;
  /** 请求超时（ms） */
  timeout: number;
  /** 每个数据源最多获取多少条 */
  maxPerSource: number;
  /** 请求间隔（ms），避免被限流 */
  requestDelay: number;
}

@Injectable()
export class GithubCollector extends BaseCollector {
  private readonly logger = new Logger(GithubCollector.name);
  private readonly httpClient: AxiosInstance;
  private readonly config: GithubCollectorConfig;

  constructor(private readonly configService: ConfigService) {
    super();
    this.config = {
      trendingUrl:
        this.configService.get<string>('collector.github.trendingUrl') ??
        'https://github.com/trending',
      trendingReposApiUrl:
        this.configService.get<string>(
          'collector.github.trendingReposApiUrl',
        ) ?? 'https://trendingrepos.glup3.dev',
      frontendTopicsUrl:
        this.configService.get<string>(
          'collector.github.frontendTopicsUrl',
        ) ?? 'https://github.com/topics/frontend',
      timeout:
        this.configService.get<number>('collector.github.timeout') ?? 30000,
      maxPerSource:
        this.configService.get<number>('collector.github.maxPerSource') ?? 25,
      requestDelay:
        this.configService.get<number>('collector.github.requestDelay') ?? 2000,
    };

    this.httpClient = axios.create({
      timeout: this.config.timeout,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
      },
    });
  }

  /**
   * 采集 GitHub 热点仓库
   * @param sources - 数据源列表，identifier 为采集类别:
   *   - 'trending' / 'trending-monthly' / 'trending-weekly' / 'trending-daily': GitHub Trending
   *   - 'trending-repos-api': 第三方 TrendingRepos API
   *   - 'topics-frontend': GitHub Topics/frontend
   *   - 'all': 采集以上所有
   */
  async collect(
    sources: Array<{
      id: string;
      identifier: string;
      name: string;
      config?: Record<string, any>;
    }>,
  ): Promise<RawContent[]> {
    this.logger.log(`开始采集 ${sources.length} 个 GitHub 数据源...`);
    const startTime = Date.now();
    const allContents: RawContent[] = [];
    const seenRepos = new Set<string>(); // 去重用

    for (const source of sources) {
      try {
        const repos = await this.collectByIdentifier(
          source.identifier,
          source.config,
        );

        // 去重：同一个 fullName 只保留第一个
        for (const repo of repos) {
          if (seenRepos.has(repo.fullName)) continue;
          seenRepos.add(repo.fullName);

          const rawContent = this.convertToRawContent(repo, source.id);
          allContents.push(rawContent);
        }

        this.logger.log(
          `${source.name}: 获取 ${repos.length} 个仓库 (去重后累计 ${allContents.length})`,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`${source.name} 采集失败: ${msg}`);
      }

      // 数据源间延迟
      await this.delay(this.config.requestDelay);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    this.logger.log(
      `GitHub 采集完成，共获取 ${allContents.length} 个仓库 (耗时: ${duration}s)`,
    );

    return allContents;
  }

  /**
   * 验证 GitHub 数据源
   */
  async validateSource(source: {
    identifier: string;
    name?: string;
  }): Promise<SourceValidation> {
    const validIdentifiers = [
      'trending',
      'trending-monthly',
      'trending-weekly',
      'trending-daily',
      'trending-repos-api',
      'topics-frontend',
      'all',
    ];

    if (validIdentifiers.includes(source.identifier)) {
      return { isValid: true, message: 'GitHub 数据源标识有效' };
    }

    // 也支持 owner/repo 格式（未来支持单仓库追踪）
    if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(source.identifier)) {
      return { isValid: true, message: 'GitHub 仓库格式有效' };
    }

    return {
      isValid: false,
      message: `不支持的标识: ${source.identifier}。支持: ${validIdentifiers.join(', ')} 或 owner/repo 格式`,
    };
  }

  // ====== 按标识符分发采集 ======

  private async collectByIdentifier(
    identifier: string,
    sourceConfig?: Record<string, any>,
  ): Promise<GithubRepoInfo[]> {
    switch (identifier) {
      case 'trending':
      case 'trending-monthly':
        return this.fetchGithubTrending('monthly');
      case 'trending-weekly':
        return this.fetchGithubTrending('weekly');
      case 'trending-daily':
        return this.fetchGithubTrending('daily');
      case 'trending-repos-api':
        return this.fetchTrendingReposApi(
          (sourceConfig?.time as string) || 'daily',
        );
      case 'topics-frontend':
        return this.fetchGithubTopics('frontend');
      case 'all':
        return this.collectAll();
      default:
        this.logger.warn(`未知的 GitHub 标识: ${identifier}，尝试作为趋势页获取`);
        return this.fetchGithubTrending('monthly');
    }
  }

  /**
   * 采集所有来源并合并去重
   */
  private async collectAll(): Promise<GithubRepoInfo[]> {
    const allRepos: GithubRepoInfo[] = [];
    const seen = new Set<string>();

    const sources = [
      () => this.fetchGithubTrending('monthly'),
      () => this.fetchTrendingReposApi('daily'),
      () => this.fetchGithubTopics('frontend'),
    ];

    for (const fetchFn of sources) {
      try {
        const repos = await fetchFn();
        for (const repo of repos) {
          if (!seen.has(repo.fullName)) {
            seen.add(repo.fullName);
            allRepos.push(repo);
          }
        }
      } catch (error) {
        this.logger.error(
          `采集子源失败: ${(error as Error).message}`,
        );
      }
      await this.delay(this.config.requestDelay);
    }

    return allRepos;
  }

  // ====== 数据源 1: GitHub Trending 页面解析 ======

  private async fetchGithubTrending(
    since: 'daily' | 'weekly' | 'monthly' = 'monthly',
  ): Promise<GithubRepoInfo[]> {
    const url = `${this.config.trendingUrl}?since=${since}`;
    this.logger.log(`抓取 GitHub Trending: ${url}`);

    try {
      const resp = await this.httpClient.get(url);
      return this.parseGithubTrending(resp.data, since);
    } catch (error) {
      this.logger.error(
        `GitHub Trending 抓取失败: ${(error as Error).message}`,
      );
      return [];
    }
  }

  private parseGithubTrending(
    html: string,
    since: string,
  ): GithubRepoInfo[] {
    const $ = cheerio.load(html);
    const repos: GithubRepoInfo[] = [];

    // GitHub Trending 页面使用 article.Box-row 包裹每个仓库
    $('article.Box-row').each((_i, el) => {
      if (repos.length >= this.config.maxPerSource) return false;

      try {
        const $el = $(el);

        // 仓库全名: h2 > a 的 href，如 /owner/repo
        const href = $el.find('h2 a').attr('href')?.trim() || '';
        const fullName = href.replace(/^\//, '');
        if (!fullName || !fullName.includes('/')) return;

        // 描述
        const description = $el.find('p.col-9').text().trim();

        // 编程语言
        const language =
          $el.find('[itemprop="programmingLanguage"]').text().trim() || '';

        // 总 Star 数 - 通常在第一个 svg.octicon-star 旁
        const starLinks = $el.find('a[href*="/stargazers"]');
        const starsText =
          starLinks.first().text().trim().replace(/,/g, '') || '0';
        const stars = parseInt(starsText, 10) || 0;

        // Fork 数
        const forkLinks = $el.find('a[href*="/forks"]');
        const forksText =
          forkLinks.first().text().trim().replace(/,/g, '') || '0';
        const forks = parseInt(forksText, 10) || 0;

        // 时段内新增 Star
        const starsTodayText = $el
          .find('span.d-inline-block.float-sm-right')
          .text()
          .trim();
        const starsMatch = starsTodayText.match(/([\d,]+)\s+stars?\s+/i);
        const starsToday = starsMatch
          ? parseInt(starsMatch[1].replace(/,/g, ''), 10)
          : 0;

        repos.push({
          fullName,
          description,
          language,
          stars,
          starsToday,
          forks,
          url: `https://github.com/${fullName}`,
          trendSource: 'github_trending',
        });
      } catch {
        // 跳过解析失败的条目
      }
    });

    this.logger.log(
      `GitHub Trending (${since}): 解析到 ${repos.length} 个仓库`,
    );
    return repos;
  }

  // ====== 数据源 2: TrendingRepos API ======

  private async fetchTrendingReposApi(
    time: string = 'daily',
  ): Promise<GithubRepoInfo[]> {
    const url = `${this.config.trendingReposApiUrl}/api/repos`;
    this.logger.log(`抓取 TrendingRepos API: ${url}?time=${time}`);

    try {
      const resp = await this.httpClient.get(url, {
        params: { time, page: 1 },
        headers: { Accept: 'application/json' },
      });

      const data = resp.data;
      // 该 API 返回一个数组或 { data: [...] } 格式
      const items: any[] = Array.isArray(data) ? data : data?.data || data?.repos || [];

      const repos: GithubRepoInfo[] = [];

      for (const item of items) {
        if (repos.length >= this.config.maxPerSource) break;

        const fullName =
          item.fullName ||
          item.full_name ||
          item.name ||
          `${item.owner || item.author || 'unknown'}/${item.repo || item.repository || 'unknown'}`;

        repos.push({
          fullName,
          description: item.description || item.desc || '',
          language: item.language || item.lang || '',
          stars: item.stars || item.stargazers_count || item.currentStars || 0,
          starsToday: item.starsDiff || item.starsToday || item.stars_today || item.todayStars || 0,
          forks: item.forks || item.forks_count || 0,
          url: item.url || item.html_url || `https://github.com/${fullName}`,
          trendSource: 'trendingrepos_api',
        });
      }

      this.logger.log(
        `TrendingRepos API (${time}): 获取 ${repos.length} 个仓库`,
      );
      return repos;
    } catch (error) {
      this.logger.error(
        `TrendingRepos API 抓取失败: ${(error as Error).message}`,
      );
      // 降级：尝试抓取页面
      return this.fetchTrendingReposPage(time);
    }
  }

  /**
   * TrendingRepos 降级方案：抓取页面 HTML
   */
  private async fetchTrendingReposPage(
    time: string,
  ): Promise<GithubRepoInfo[]> {
    const url = `${this.config.trendingReposApiUrl}/?time=${time}`;
    this.logger.log(`TrendingRepos 降级抓取页面: ${url}`);

    try {
      const resp = await this.httpClient.get(url);
      const $ = cheerio.load(resp.data);
      const repos: GithubRepoInfo[] = [];

      // 尝试多种选择器匹配
      $('a[href*="github.com/"]').each((_i, el) => {
        if (repos.length >= this.config.maxPerSource) return false;
        const href = $(el).attr('href') || '';
        const match = href.match(
          /github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/,
        );
        if (!match) return;
        const fullName = match[1];
        // 避免重复
        if (repos.some((r) => r.fullName === fullName)) return;

        const text = $(el).text().trim();
        repos.push({
          fullName,
          description: text || '',
          language: '',
          stars: 0,
          starsToday: 0,
          forks: 0,
          url: `https://github.com/${fullName}`,
          trendSource: 'trendingrepos_api',
        });
      });

      this.logger.log(
        `TrendingRepos 降级页面: 解析到 ${repos.length} 个仓库`,
      );
      return repos;
    } catch (error) {
      this.logger.error(
        `TrendingRepos 降级也失败: ${(error as Error).message}`,
      );
      return [];
    }
  }

  // ====== 数据源 3: GitHub Topics 页面解析 ======

  private async fetchGithubTopics(
    topic: string = 'frontend',
  ): Promise<GithubRepoInfo[]> {
    const url = `https://github.com/topics/${topic}`;
    this.logger.log(`抓取 GitHub Topics: ${url}`);

    try {
      const resp = await this.httpClient.get(url);
      return this.parseGithubTopics(resp.data, topic);
    } catch (error) {
      this.logger.error(
        `GitHub Topics (${topic}) 抓取失败: ${(error as Error).message}`,
      );
      return [];
    }
  }

  private parseGithubTopics(html: string, topic: string): GithubRepoInfo[] {
    const $ = cheerio.load(html);
    const repos: GithubRepoInfo[] = [];

    // GitHub Topics 页面结构：article 元素包裹每个仓库
    $('article.border').each((_i, el) => {
      if (repos.length >= this.config.maxPerSource) return false;

      try {
        const $el = $(el);

        // 仓库链接: h3 > a 的 href
        const link = $el.find('h3 a').last();
        const href = link.attr('href')?.trim() || '';
        const fullName = href.replace(/^\//, '');
        if (!fullName || !fullName.includes('/')) return;

        // 描述
        const description = $el.find('p').first().text().trim();

        // Star 数
        const starText = $el.find('a[href*="/stargazers"]').text().trim().replace(/,/g, '');
        const stars = parseInt(starText, 10) || 0;

        // 编程语言
        const language =
          $el.find('[itemprop="programmingLanguage"]').text().trim() || '';

        // 话题标签
        const topics: string[] = [];
        $el.find('a.topic-tag').each((_j, tag) => {
          topics.push($(tag).text().trim());
        });

        repos.push({
          fullName,
          description,
          language,
          stars,
          starsToday: 0,
          forks: 0,
          url: `https://github.com/${fullName}`,
          trendSource: 'github_topics',
          topics: topics.length > 0 ? topics : [topic],
        });
      } catch {
        // 跳过
      }
    });

    this.logger.log(
      `GitHub Topics (${topic}): 解析到 ${repos.length} 个仓库`,
    );
    return repos;
  }

  // ====== 转换为统一 RawContent ======

  private convertToRawContent(
    repo: GithubRepoInfo,
    sourceId: string,
  ): RawContent {
    const [owner, repoName] = repo.fullName.split('/');

    // 构建丰富的内容文本
    const contentParts: string[] = [];
    contentParts.push(`## ${repo.fullName}`);
    if (repo.description) contentParts.push(`\n${repo.description}`);
    contentParts.push(`\n### 统计数据`);
    contentParts.push(`- ⭐ Stars: ${repo.stars.toLocaleString()}`);
    if (repo.starsToday > 0) {
      contentParts.push(
        `- 🔥 新增 Stars: +${repo.starsToday.toLocaleString()}`,
      );
    }
    if (repo.forks > 0) {
      contentParts.push(`- 🍴 Forks: ${repo.forks.toLocaleString()}`);
    }
    if (repo.language) {
      contentParts.push(`- 💻 语言: ${repo.language}`);
    }
    if (repo.topics && repo.topics.length > 0) {
      contentParts.push(`- 🏷️ 标签: ${repo.topics.join(', ')}`);
    }
    contentParts.push(`\n🔗 ${repo.url}`);

    return {
      sourceType: 'github',
      sourceId,
      sourceName: `GitHub ${repo.trendSource === 'github_trending' ? 'Trending' : repo.trendSource === 'trendingrepos_api' ? 'Most Popular' : 'Topics'}`,
      contentId: `github_${repo.fullName}_${new Date().toISOString().slice(0, 10)}`,
      title: `${repo.fullName}${repo.description ? ' - ' + repo.description.slice(0, 80) : ''}`,
      content: contentParts.join('\n'),
      url: repo.url,
      author: owner || 'unknown',
      publishedAt: new Date(),
      collectedAt: new Date(),
      mediaUrls: [],
      rawMetadata: {
        fullName: repo.fullName,
        owner,
        repoName,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        starsToday: repo.starsToday,
        forks: repo.forks,
        trendSource: repo.trendSource,
        topics: repo.topics,
        sourceCategory: 'github_trending',
      },
    };
  }

  // ====== 辅助方法 ======

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

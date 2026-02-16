import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  BaseCollector,
  type RawContent,
  type SourceValidation,
} from '../base.collector.js';
import { WechatTokenService } from '../services/wechat-token.service.js';

interface WechatAccount {
  fakeid: string;
  nickname: string;
}

interface WechatConfig {
  apiUrl: string;
  searchApiUrl: string;
  rateLimit: { minDelay: number; maxDelay: number };
  articleFetchDelay: { minDelay: number; maxDelay: number };
  maxRetry: number;
  timeout: number;
}

@Injectable()
export class WechatCollector extends BaseCollector {
  private readonly logger = new Logger(WechatCollector.name);
  private readonly httpClient: AxiosInstance;
  private readonly wechatConfig: WechatConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: WechatTokenService,
  ) {
    super();
    this.wechatConfig = {
      apiUrl:
        this.configService.get<string>('collector.wechat.apiUrl') ??
        'https://mp.weixin.qq.com/cgi-bin/appmsgpublish',
      searchApiUrl:
        this.configService.get<string>('collector.wechat.searchApiUrl') ??
        'https://mp.weixin.qq.com/cgi-bin/searchbiz',
      rateLimit: this.configService.get('collector.wechat.rateLimit') ?? {
        minDelay: 3000,
        maxDelay: 5000,
      },
      articleFetchDelay: this.configService.get(
        'collector.wechat.articleFetchDelay',
      ) ?? { minDelay: 250, maxDelay: 600 },
      maxRetry:
        this.configService.get<number>('collector.wechat.maxRetry') ?? 3,
      timeout:
        this.configService.get<number>('collector.wechat.timeout') ?? 30000,
    };

    this.httpClient = axios.create({
      timeout: this.wechatConfig.timeout,
    });
  }

  /**
   * 采集多个公众号来源的文章
   * @param sources - 数据源列表，每个 source 的 identifier 是 fakeid，name 是公众号名称
   */
  async collect(
    sources: Array<{
      id: string;
      identifier: string;
      name: string;
      config?: Record<string, any>;
    }>,
  ): Promise<RawContent[]> {
    this.logger.log(`开始采集 ${sources.length} 个微信公众号...`);
    const startTime = Date.now();

    const creds = await this.tokenService.getCredentials();
    if (!creds) {
      this.logger.error(
        '微信凭证不可用，跳过采集。请通过 API 或 .env 配置 Token/Cookie',
      );
      return [];
    }

    const allContents: RawContent[] = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const label = `[${i + 1}/${sources.length}]`;
      const account: WechatAccount = {
        fakeid: source.identifier,
        nickname: source.name,
      };

      try {
        this.logger.log(`${label} 开始采集: ${account.nickname}`);
        const contents = await this.collectAccount(
          account,
          source.id,
          creds.token,
          creds.cookie,
        );
        allContents.push(...contents);
        this.logger.log(
          `${label} ${account.nickname}: 获取 ${contents.length} 条文章`,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        // Token 过期，标记并中断
        if (msg.includes('token_expired')) {
          await this.tokenService.markExpired();
          this.logger.error('Token 已过期，中断采集。请更新凭证后重试');
          break;
        }

        this.logger.error(`${label} ${account.nickname} 采集失败: ${msg}`);
      }

      // 账号间限流
      if (i < sources.length - 1) {
        await this.applyRateLimit();
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    this.logger.log(
      `采集完成，共获取 ${allContents.length} 条文章 (耗时: ${duration}s)`,
    );

    return allContents;
  }

  /**
   * 验证公众号 fakeid 是否有效
   */
  async validateSource(source: {
    identifier: string;
    name?: string;
  }): Promise<SourceValidation> {
    // 格式检查
    if (!/^[a-zA-Z0-9_=]+$/.test(source.identifier)) {
      return { isValid: false, message: 'fakeid 格式不正确' };
    }

    // 如果有凭证，尝试实际请求验证
    const creds = await this.tokenService.getCredentials();
    if (!creds) {
      return {
        isValid: true,
        message: 'fakeid 格式正确，但无法在线验证（凭证不可用）',
      };
    }

    try {
      const response = await this.fetchArticleList(
        { fakeid: source.identifier, nickname: source.name ?? '' },
        creds.token,
        creds.cookie,
        0,
      );

      if (response?.base_resp?.ret === 200003) {
        return { isValid: false, message: 'Token 已过期，请先更新凭证' };
      }

      if (
        response?.base_resp?.ret !== undefined &&
        response.base_resp.ret !== 0
      ) {
        return {
          isValid: false,
          message: `接口返回错误: ret=${response.base_resp.ret}`,
        };
      }

      return { isValid: true, message: '公众号验证通过' };
    } catch (error) {
      return {
        isValid: false,
        message: `验证失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 搜索公众号（通过名称查找 fakeid）
   */
  async searchAccount(
    query: string,
  ): Promise<
    Array<{ fakeid: string; nickname: string; roundHeadImg?: string }>
  > {
    const creds = await this.tokenService.getCredentials();
    if (!creds) {
      throw new Error('微信凭证不可用');
    }

    const params = {
      action: 'search_biz',
      begin: 0,
      count: 10,
      query,
      token: creds.token,
      lang: 'zh_CN',
      f: 'json',
      ajax: 1,
    };

    const response = await this.httpClient.get(this.wechatConfig.searchApiUrl, {
      params,
      headers: this.buildRequestHeaders(creds.cookie),
    });

    const data = response.data;

    if (data?.base_resp?.ret === 200003) {
      await this.tokenService.markExpired();
      throw new Error('Token 已过期');
    }

    if (data?.base_resp?.ret !== 0) {
      throw new Error(
        `搜索接口错误: ret=${data?.base_resp?.ret}, msg=${data?.base_resp?.err_msg ?? ''}`,
      );
    }

    return (data.list || []).map((item: any) => ({
      fakeid: item.fakeid,
      nickname: item.nickname,
      roundHeadImg: item.round_head_img,
    }));
  }

  // ====== Private Methods ======

  /**
   * 采集单个公众号
   */
  private async collectAccount(
    account: WechatAccount,
    sourceId: string,
    token: string,
    cookie: string,
  ): Promise<RawContent[]> {
    const maxRetry = 2;

    for (let attempt = 1; attempt <= maxRetry; attempt++) {
      try {
        const response = await this.fetchArticleList(account, token, cookie, 0);

        // Token 过期检测
        if (response?.base_resp?.ret === 200003) {
          if (attempt < maxRetry) {
            this.logger.warn(
              `${account.nickname}: Token 过期，尝试刷新 (${attempt}/${maxRetry})`,
            );
            // 重新获取凭证
            const newCreds = await this.tokenService.getCredentials();
            if (newCreds) {
              token = newCreds.token;
              cookie = newCreds.cookie;
            }
            continue;
          }
          throw new Error('token_expired');
        }

        // 其它错误
        const retCode = response?.base_resp?.ret;
        if (retCode !== undefined && retCode !== 0) {
          throw new Error(`接口返回错误: ret=${retCode}`);
        }

        // 解析文章列表
        const articles = this.parseResponse(response);
        if (articles.length === 0) {
          return [];
        }

        // 转换为 RawContent
        let contents = articles.map((article) =>
          this.convertToRawContent(article, account, sourceId),
        );

        // 补充正文
        contents = await this.enrichWithBodies(contents);

        return contents;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('token_expired') || attempt === maxRetry) {
          throw error;
        }
        this.logger.warn(
          `${account.nickname} 采集异常，准备重试 (${attempt}/${maxRetry}): ${msg}`,
        );
        await this.delay(1000 * attempt);
      }
    }

    return [];
  }

  /**
   * 请求文章列表接口
   */
  private async fetchArticleList(
    account: WechatAccount,
    token: string,
    cookie: string,
    begin: number,
  ): Promise<any> {
    const params = {
      sub: 'list',
      search_field: 'null',
      begin,
      count: 10,
      query: '',
      fakeid: account.fakeid,
      type: '101_1',
      free_publish_type: 1,
      sub_action: 'list_ex',
      token,
      lang: 'zh_CN',
      f: 'json',
      ajax: 1,
    };

    return this.retryWithBackoff(async () => {
      const resp = await this.httpClient.get(this.wechatConfig.apiUrl, {
        params,
        headers: this.buildRequestHeaders(cookie),
      });
      return resp.data;
    });
  }

  /**
   * 解析多层嵌套 JSON 响应
   * publish_page(string) → JSON → publish_list[] → publish_info(string) → JSON → appmsgex[]
   */
  private parseResponse(response: any): any[] {
    try {
      if (!response.publish_page) {
        this.logger.debug('响应中缺少 publish_page 字段');
        return [];
      }

      const publishPage = JSON.parse(response.publish_page);
      const publishList = publishPage.publish_list || [];

      if (publishList.length === 0) {
        return [];
      }

      const articles: any[] = [];
      for (const item of publishList) {
        if (!item.publish_info) continue;
        try {
          const publishInfo = JSON.parse(item.publish_info);
          const appmsgex = publishInfo.appmsgex || [];
          if (Array.isArray(appmsgex)) {
            articles.push(...appmsgex);
          }
        } catch {
          this.logger.debug('第二层 JSON 解析失败，跳过该项');
        }
      }

      return articles;
    } catch (error) {
      this.logger.error(`JSON 解析失败: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 将微信文章原始数据转换为统一 RawContent 格式
   */
  private convertToRawContent(
    article: any,
    account: WechatAccount,
    sourceId: string,
  ): RawContent {
    const url = this.resolveArticleUrl(article.link);
    const publishedAt = this.resolvePublishTime(article);

    return {
      sourceType: 'wechat',
      sourceId,
      sourceName: account.nickname,
      contentId:
        article.aid?.toString() || `wechat_${account.fakeid}_${Date.now()}`,
      title: article.title || '',
      content: article.digest || '',
      url,
      author: article.author_name || account.nickname,
      publishedAt,
      collectedAt: new Date(),
      mediaUrls: [article.cover, article.cover_img].filter(Boolean),
      rawMetadata: {
        aid: article.aid,
        appmsgid: article.appmsgid,
        fakeid: account.fakeid,
        copyright_stat: article.copyright_stat,
        itemidx: article.itemidx,
        album_id: article.album_id,
        item_show_type: article.item_show_type,
        likes: article.like_count,
        comments: article.comment_count,
        views: article.read_num,
        accountName: account.nickname,
      },
    };
  }

  /**
   * 批量补充文章正文
   */
  private async enrichWithBodies(
    contents: RawContent[],
  ): Promise<RawContent[]> {
    for (const item of contents) {
      if (!item.url) continue;

      try {
        const { text, snippet } = await this.fetchArticleContent(item.url);
        if (text) {
          item.content = text;
          item.rawMetadata = {
            ...item.rawMetadata,
            contentLength: text.length,
          };
        }
        if (
          snippet &&
          (!item.content || item.content.length < snippet.length)
        ) {
          // 如果 digest 比抓取的 snippet 短，用 snippet
        }
      } catch {
        // 正文抓取失败不影响整体流程
      }

      // 文章间延迟
      const { minDelay, maxDelay } = this.wechatConfig.articleFetchDelay;
      await this.delay(this.getRandomDelay(minDelay, maxDelay));
    }

    return contents;
  }

  /**
   * 抓取公众号文章正文
   */
  private async fetchArticleContent(
    url: string,
  ): Promise<{ text: string; snippet: string }> {
    try {
      const resp = await this.httpClient.get(url, {
        headers: {
          Referer: 'https://mp.weixin.qq.com/',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      });

      const text = extractWeChatArticleText(resp.data);
      const snippet = text
        ? text.replace(/\s+/g, ' ').trim().slice(0, 600)
        : '';

      return { text, snippet };
    } catch {
      return { text: '', snippet: '' };
    }
  }

  // ====== Helper Methods ======

  private buildRequestHeaders(cookie: string): Record<string, string> {
    return {
      Cookie: cookie,
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    };
  }

  private resolveArticleUrl(rawLink: string): string {
    if (!rawLink) return '';
    if (rawLink.startsWith('http')) return rawLink;
    const normalized = rawLink.startsWith('/') ? rawLink : `/${rawLink}`;
    return `https://mp.weixin.qq.com${normalized}`;
  }

  private resolvePublishTime(article: any): Date {
    if (article.update_time) return new Date(article.update_time * 1000);
    if (article.create_time) return new Date(article.create_time * 1000);
    return new Date();
  }

  /**
   * 指数退避重试
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000,
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delayMs = baseDelayMs * Math.pow(2, i);
        this.logger.debug(
          `请求失败，${delayMs}ms 后重试 (${i + 1}/${maxRetries})`,
        );
        await this.delay(delayMs);
      }
    }
    throw new Error('Max retries exceeded');
  }

  private async applyRateLimit(): Promise<void> {
    const { minDelay, maxDelay } = this.wechatConfig.rateLimit;
    await this.delay(this.getRandomDelay(minDelay, maxDelay));
  }

  private getRandomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 从公众号文章 HTML 中提取正文文本
 */
export function extractWeChatArticleText(html: string): string {
  if (!html) return '';

  try {
    const $ = cheerio.load(html);
    const container = $('#js_content').length
      ? $('#js_content')
      : $('.rich_media_content');

    if (container.length === 0) {
      return $('body').text().replace(/\s+/g, ' ').trim();
    }

    container.find('script, style').remove();
    return container.text().replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

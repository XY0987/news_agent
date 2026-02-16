import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface WechatCredentials {
  token: string;
  cookie: string;
  updatedAt: string;
  expiresAt: string;
  source: 'env' | 'api';
}

const REDIS_KEY = 'wechat:credentials';

@Injectable()
export class WechatTokenService {
  private readonly logger = new Logger(WechatTokenService.name);
  private readonly tokenTtlDays: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.tokenTtlDays =
      this.configService.get<number>('collector.wechat.tokenTtlDays') ?? 7;
  }

  /**
   * 获取当前有效的凭证
   * 优先级: Redis 缓存 > .env 环境变量
   */
  async getCredentials(): Promise<WechatCredentials | null> {
    // 1. 尝试从 Redis 读取（前端 API 或之前缓存的）
    const cached = await this.loadFromRedis();
    if (cached) {
      return cached;
    }

    // 2. 回退到 .env 环境变量
    const envCreds = this.loadFromEnv();
    if (envCreds) {
      // 写入 Redis 缓存
      await this.saveToRedis(envCreds);
      return envCreds;
    }

    return null;
  }

  /**
   * 通过前端 API 更新凭证
   */
  async updateCredentials(
    token: string,
    cookie: string,
  ): Promise<WechatCredentials> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.tokenTtlDays * 24 * 60 * 60 * 1000,
    );

    const creds: WechatCredentials = {
      token,
      cookie,
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      source: 'api',
    };

    await this.saveToRedis(creds);
    this.logger.log('微信凭证已通过 API 更新');
    return creds;
  }

  /**
   * 标记当前凭证已过期（API 返回 200003 时调用）
   */
  async markExpired(): Promise<void> {
    await this.redis.del(REDIS_KEY);
    this.logger.warn('微信凭证已标记为过期并从缓存清除');
  }

  /**
   * 获取凭证状态信息（供前端展示）
   */
  async getStatus(): Promise<{
    hasCredentials: boolean;
    source: string;
    expiresAt: string | null;
    remainingDays: number | null;
  }> {
    const creds = await this.getCredentials();
    if (!creds) {
      return {
        hasCredentials: false,
        source: 'none',
        expiresAt: null,
        remainingDays: null,
      };
    }

    const now = new Date();
    const expiresAt = new Date(creds.expiresAt);
    const remainingDays = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );

    return {
      hasCredentials: true,
      source: creds.source,
      expiresAt: creds.expiresAt,
      remainingDays: Math.max(0, remainingDays),
    };
  }

  private async loadFromRedis(): Promise<WechatCredentials | null> {
    try {
      const data = await this.redis.get(REDIS_KEY);
      if (!data) return null;

      const creds: WechatCredentials = JSON.parse(data);

      if (!creds.token || !creds.cookie) {
        return null;
      }

      // 检查是否过期
      if (creds.expiresAt) {
        const expiresAt = new Date(creds.expiresAt);
        if (new Date() >= expiresAt) {
          this.logger.warn('Redis 中的微信凭证已过期');
          await this.redis.del(REDIS_KEY);
          return null;
        }
      }

      return creds;
    } catch (error) {
      this.logger.error(`从 Redis 加载凭证失败: ${(error as Error).message}`);
      return null;
    }
  }

  private loadFromEnv(): WechatCredentials | null {
    const token = this.configService.get<string>('collector.wechat.token');
    const cookie = this.configService.get<string>('collector.wechat.cookie');

    if (!token || !cookie) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.tokenTtlDays * 24 * 60 * 60 * 1000,
    );

    return {
      token,
      cookie,
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      source: 'env',
    };
  }

  private async saveToRedis(creds: WechatCredentials): Promise<void> {
    try {
      const ttlSeconds = this.tokenTtlDays * 24 * 60 * 60;
      await this.redis.set(REDIS_KEY, JSON.stringify(creds), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.error(`保存凭证到 Redis 失败: ${(error as Error).message}`);
    }
  }
}

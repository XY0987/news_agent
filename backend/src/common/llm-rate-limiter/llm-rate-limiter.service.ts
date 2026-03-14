import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * LLM 请求速率限制器（全局单例）
 *
 * 使用滑动窗口算法，控制每分钟 LLM API 调用次数。
 * 所有 LLM 调用点（AgentService、SummaryService）共享同一个限流器实例，
 * 确保总请求数不超过 LLM API 的限频阈值。
 *
 * 配置: .env 中的 LLM_RPM（requests per minute），默认 10
 */
@Injectable()
export class LlmRateLimiterService implements OnModuleInit {
  private readonly logger = new Logger(LlmRateLimiterService.name);

  /** 每分钟允许的最大请求数 */
  private maxRpm: number;

  /** 滑动窗口：记录每次请求的时间戳（ms） */
  private readonly requestTimestamps: number[] = [];

  /** 等待队列：FIFO，每个元素是一个 resolve 回调 */
  private readonly waitQueue: Array<() => void> = [];

  /** 定时器：用于定期检查是否可以放行等待中的请求 */
  private drainTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly configService: ConfigService) {
    const raw = parseInt(this.configService.get<string>('LLM_RPM') || '10', 10);
    // -1 或其他负值 = 不限流；0 或 NaN = 用默认值 10
    if (raw < 0) {
      this.maxRpm = -1; // 标记为不限流
    } else if (isNaN(raw) || raw === 0) {
      this.maxRpm = 10;
    } else {
      this.maxRpm = raw;
    }
  }

  onModuleInit(): void {
    if (this.maxRpm < 0) {
      this.logger.log('LLM 速率限制器已禁用 (LLM_RPM=-1)');
      return; // 不限流时不启动 drain 定时器
    }
    this.logger.log(`LLM 速率限制器已初始化: ${this.maxRpm} RPM`);
    // 每秒检查一次等待队列，看是否有请求可以放行
    this.drainTimer = setInterval(() => this.drainQueue(), 1000);
  }

  /**
   * 获取当前配置的 RPM 值
   */
  getRpm(): number {
    return this.maxRpm;
  }

  /**
   * 获取请求令牌（主动限速）
   *
   * 调用方在发起 LLM 请求前调用此方法。
   * - 如果当前滑动窗口内的请求数未达上限，立即返回
   * - 如果已达上限，会排队等待直到有空位
   *
   * @param caller 调用方标识（用于日志）
   */
  async acquire(caller?: string): Promise<void> {
    // 不限流模式：直接放行
    if (this.maxRpm < 0) return;

    // 清理过期的时间戳（超过 60s 的）
    this.purgeExpired();

    // 如果当前窗口内请求数 < 上限，立即放行
    if (this.requestTimestamps.length < this.maxRpm) {
      this.requestTimestamps.push(Date.now());
      return;
    }

    // 否则排队等待
    const tag = caller || 'unknown';
    const queueLen = this.waitQueue.length + 1;
    this.logger.warn(
      `[${tag}] LLM 请求限速中（当前 ${this.requestTimestamps.length}/${this.maxRpm} RPM），排队等待（队列深度: ${queueLen}）`,
    );

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * 清理过期时间戳（滑动窗口 60 秒）
   */
  private purgeExpired(): void {
    const cutoff = Date.now() - 60_000;
    while (
      this.requestTimestamps.length > 0 &&
      this.requestTimestamps[0] < cutoff
    ) {
      this.requestTimestamps.shift();
    }
  }

  /**
   * 尝试放行等待队列中的请求
   */
  private drainQueue(): void {
    if (this.waitQueue.length === 0) return;

    this.purgeExpired();

    while (
      this.waitQueue.length > 0 &&
      this.requestTimestamps.length < this.maxRpm
    ) {
      this.requestTimestamps.push(Date.now());
      const resolve = this.waitQueue.shift();
      if (resolve) {
        resolve();
      }
    }
  }

  /**
   * 模块销毁时清理定时器
   */
  onModuleDestroy(): void {
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
  }
}

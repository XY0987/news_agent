import { Global, Module } from '@nestjs/common';
import { LlmRateLimiterService } from './llm-rate-limiter.service.js';

/**
 * LLM 请求限流模块（全局）
 *
 * 标记为 @Global()，导入一次后所有模块均可注入 LlmRateLimiterService
 */
@Global()
@Module({
  providers: [LlmRateLimiterService],
  exports: [LlmRateLimiterService],
})
export class LlmRateLimiterModule {}

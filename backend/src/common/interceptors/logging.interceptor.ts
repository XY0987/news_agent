import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';

/**
 * 全局日志拦截器
 *
 * 记录每个请求的方法、路径和耗时，方便排查性能问题。
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - now;
        this.logger.log(`${method} ${url} ${ms}ms`);
      }),
    );
  }
}

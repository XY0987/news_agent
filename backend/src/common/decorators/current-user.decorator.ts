import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: Record<string, unknown>;
}

/**
 * 从 JWT payload 中提取当前用户信息
 *
 * @example
 * @Get('me')
 * getMe(@CurrentUser() user: JwtPayload) {}
 *
 * @Get('me')
 * getMe(@CurrentUser('userId') userId: string) {}
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

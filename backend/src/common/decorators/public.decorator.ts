import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记接口为公开访问（不需要 JWT 认证）
 *
 * @example
 * @Public()
 * @Post('login')
 * async login() {}
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

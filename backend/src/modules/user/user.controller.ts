import { Controller, Get } from '@nestjs/common';
import { UserService } from './user.service';

/**
 * 用户相关接口
 * - POST /api/users/register    用户注册
 * - GET  /api/users/profile     获取用户画像
 * - PUT  /api/users/profile     更新用户画像
 * - PUT  /api/users/preferences 更新偏好设置
 */
@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // TODO: 实现用户注册、画像管理、偏好设置等接口
  @Get('/profile')
  getUserProfile() {
    return {
      name: '111',
      age: 18,
    };
  }
}

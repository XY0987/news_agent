import { Controller } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // TODO: 实现用户注册、画像管理、偏好设置等接口
}

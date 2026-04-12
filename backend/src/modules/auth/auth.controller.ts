import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import {
  RegisterDto,
  LoginDto,
  SendCodeDto,
  ResetPasswordDto,
} from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import type { JwtPayload } from './jwt.strategy.js';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 发送邮箱验证码 */
  @Public()
  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  async sendCode(@Body() dto: SendCodeDto) {
    const result = await this.authService.sendCode(dto);
    return ApiResponse.ok(result);
  }

  /** 用户注册 */
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return ApiResponse.ok(result, '注册成功');
  }

  /** 用户登录 */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return ApiResponse.ok(result, '登录成功');
  }

  /** 重置密码 */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(dto);
    return ApiResponse.ok(result);
  }

  /** 获取当前登录用户信息 */
  @Get('me')
  async getProfile(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getProfile(user.userId);
    return ApiResponse.ok(profile);
  }
}

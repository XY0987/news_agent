import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { UserEntity } from '../../common/database/entities/user.entity.js';
import { REDIS_CLIENT } from '../../common/redis/redis.module.js';
import { EmailChannel } from '../notification/channels/email.channel.js';
import type { JwtPayload } from './jwt.strategy.js';
import type {
  RegisterDto,
  LoginDto,
  SendCodeDto,
  ResetPasswordDto,
} from './dto/index.js';

const SALT_ROUNDS = 10;
const CODE_TTL = 300; // 验证码 5 分钟过期
const CODE_INTERVAL = 60; // 同一邮箱最短 60 秒发一次

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly emailChannel: EmailChannel,
  ) {}

  /**
   * 发送邮箱验证码
   */
  async sendCode(dto: SendCodeDto): Promise<{ message: string }> {
    const { email, scene } = dto;

    // 防止频繁发送
    const intervalKey = `auth:code_interval:${email}`;
    const hasInterval = await this.redis.exists(intervalKey);
    if (hasInterval) {
      throw new BadRequestException('发送过于频繁，请稍后再试');
    }

    // 场景校验
    if (scene === 'register') {
      const existing = await this.userRepo.findOneBy({ email });
      if (existing) {
        throw new ConflictException('该邮箱已注册');
      }
    } else if (scene === 'reset') {
      const existing = await this.userRepo.findOneBy({ email });
      if (!existing) {
        throw new BadRequestException('该邮箱未注册');
      }
    }

    // 生成 6 位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // 存入 Redis
    const codeKey = `auth:code:${scene}:${email}`;
    await this.redis.set(codeKey, code, 'EX', CODE_TTL);
    await this.redis.set(intervalKey, '1', 'EX', CODE_INTERVAL);

    // 发送邮件
    const sceneText = scene === 'register' ? '注册' : '重置密码';
    const result = await this.emailChannel.send({
      to: email,
      subject: `News Agent ${sceneText}验证码`,
      html: `
        <div style="max-width:480px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <h2 style="color:#1a1a1a;">News Agent ${sceneText}验证码</h2>
          <p style="color:#4a4a4a;line-height:1.6;">您的验证码是：</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:16px 0;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a1a;">${code}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;">验证码 ${CODE_TTL / 60} 分钟内有效，请勿泄露给他人。</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;">如非本人操作，请忽略此邮件。</p>
        </div>`,
      text: `您的${sceneText}验证码是：${code}，${CODE_TTL / 60} 分钟内有效。`,
    });

    if (!result.success) {
      this.logger.error(`发送验证码邮件失败: ${result.error}`);
      throw new BadRequestException('验证码发送失败，请检查邮箱地址或稍后再试');
    }

    this.logger.log(`验证码已发送至 ${email} (scene=${scene})`);
    return { message: '验证码已发送' };
  }

  /**
   * 用户注册
   */
  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; user: Partial<UserEntity> }> {
    const { name, email, password, code } = dto;

    // 校验验证码
    await this.verifyCode(email, code, 'register');

    // 检查邮箱唯一性
    const existing = await this.userRepo.findOneBy({ email });
    if (existing) {
      throw new ConflictException('该邮箱已注册');
    }

    // 创建用户
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = this.userRepo.create({
      name,
      email,
      passwordHash,
      profile: {},
      preferences: {
        pushFrequency: 'daily',
        notifyTime: '08:00',
        notifyChannels: ['email'],
        topN: 5,
        detailedNotify: false,
        scoreWeights: {
          relevance: 0.45,
          quality: 0.2,
          timeliness: 0.2,
          novelty: 0.1,
          actionability: 0.05,
        },
      },
      notificationSettings: {},
    });
    const saved = await this.userRepo.save(user);

    // 清除验证码
    await this.redis.del(`auth:code:register:${email}`);

    // 签发 Token
    const payload: JwtPayload = { userId: saved.id, email: saved.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: { id: saved.id, email: saved.email, name: saved.name },
    };
  }

  /**
   * 用户登录
   */
  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; user: Partial<UserEntity> }> {
    const { email, password } = dto;

    // 必须 select passwordHash（默认被排除）
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const payload: JwtPayload = { userId: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profile: user.profile,
        preferences: user.preferences,
      },
    };
  }

  /**
   * 重置密码
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const { email, newPassword, code } = dto;

    // 校验验证码
    await this.verifyCode(email, code, 'reset');

    const user = await this.userRepo.findOneBy({ email });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepo.save(user);

    // 清除验证码
    await this.redis.del(`auth:code:reset:${email}`);

    this.logger.log(`用户 ${email} 密码已重置`);
    return { message: '密码重置成功' };
  }

  /**
   * 获取当前用户信息
   */
  async getProfile(userId: string): Promise<UserEntity> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return user;
  }

  /**
   * 校验验证码
   */
  private async verifyCode(
    email: string,
    code: string,
    scene: string,
  ): Promise<void> {
    const codeKey = `auth:code:${scene}:${email}`;
    const storedCode = await this.redis.get(codeKey);

    if (!storedCode) {
      throw new BadRequestException('验证码已过期或不存在');
    }

    if (storedCode !== code) {
      throw new BadRequestException('验证码错误');
    }
  }
}

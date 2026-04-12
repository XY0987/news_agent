import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../common/database/entities/user.entity';
import {
  UpdateUserDto,
  UpdateProfileDto,
  UpdatePreferencesDto,
} from './dto/index';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findAll(): Promise<UserEntity[]> {
    return this.userRepo.find();
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<UserEntity> {
    const user = await this.findById(id);
    // 过滤掉 undefined 的属性，避免 spread 覆盖已有值
    const clean = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    user.profile = { ...user.profile, ...clean };
    return this.userRepo.save(user);
  }

  async updatePreferences(
    id: string,
    dto: UpdatePreferencesDto,
  ): Promise<UserEntity> {
    const user = await this.findById(id);
    const clean = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    user.preferences = { ...user.preferences, ...clean };
    return this.userRepo.save(user);
  }

  async updateNotificationSettings(
    id: string,
    settings: Record<string, any>,
  ): Promise<UserEntity> {
    const user = await this.findById(id);
    user.notificationSettings = { ...user.notificationSettings, ...settings };
    return this.userRepo.save(user);
  }

  async delete(id: string): Promise<void> {
    const result = await this.userRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`User ${id} not found`);
  }
}

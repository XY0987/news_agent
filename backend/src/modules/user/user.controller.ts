import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateProfileDto,
  UpdatePreferencesDto,
} from './dto/index';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.userService.create(dto);
    return ApiResponse.ok(user, 'User created');
  }

  @Get()
  async findAll() {
    const users = await this.userService.findAll();
    return ApiResponse.ok(users);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    return ApiResponse.ok(user);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.userService.update(id, dto);
    return ApiResponse.ok(user, 'User updated');
  }

  @Patch(':id/profile')
  async updateProfile(@Param('id') id: string, @Body() dto: UpdateProfileDto) {
    const user = await this.userService.updateProfile(id, dto);
    return ApiResponse.ok(user, 'Profile updated');
  }

  @Patch(':id/preferences')
  async updatePreferences(
    @Param('id') id: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    const user = await this.userService.updatePreferences(id, dto);
    return ApiResponse.ok(user, 'Preferences updated');
  }

  @Patch(':id/notification-settings')
  async updateNotificationSettings(
    @Param('id') id: string,
    @Body() settings: Record<string, any>,
  ) {
    const user = await this.userService.updateNotificationSettings(
      id,
      settings,
    );
    return ApiResponse.ok(user, 'Notification settings updated');
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.userService.delete(id);
    return ApiResponse.ok(null, 'User deleted');
  }
}

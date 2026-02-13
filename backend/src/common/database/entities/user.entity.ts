/**
 * 用户实体 - 对应 users 表
 */
export class UserEntity {
  id: string;
  email: string;
  name: string;
  profile: Record<string, any>;
  preferences: Record<string, any>;
  notificationSettings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

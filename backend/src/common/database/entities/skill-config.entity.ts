import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

/**
 * Skill 用户配置实体
 *
 * 存储每个用户对每个 Skill 的个性化配置（启用状态、settings 覆盖值等）
 * Skill 的定义（SKILL.md + scripts/ + references/）保存在文件系统中，此表只存运行时状态
 */
@Entity('skill_configs')
@Unique(['userId', 'skillId'])
export class SkillConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ name: 'skill_id', type: 'varchar', length: 64 })
  skillId: string;

  @Column({
    type: 'enum',
    enum: ['enabled', 'disabled'],
    default: 'enabled',
  })
  status: 'enabled' | 'disabled';

  /** 用户自定义的配置项（覆盖 SKILL.md 中 settings 的 default 值） */
  @Column({ type: 'json', nullable: true })
  settings: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

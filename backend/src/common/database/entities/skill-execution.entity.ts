import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

/**
 * Skill 执行记录实体
 *
 * 记录每次 Skill 执行的状态、输入输出、耗时、Token 等信息
 */
@Entity('skill_executions')
export class SkillExecutionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_skill_exec_skill')
  @Column({ name: 'skill_id', type: 'varchar', length: 64 })
  skillId: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Index('idx_skill_exec_session')
  @Column({ name: 'session_id', type: 'char', length: 36 })
  sessionId: string;

  @Column({
    type: 'enum',
    enum: ['running', 'success', 'failed'],
    default: 'running',
  })
  status: 'running' | 'success' | 'failed';

  /** 输入参数 */
  @Column({ name: 'input_params', type: 'json', nullable: true })
  inputParams: Record<string, any>;

  /** 输出结果 */
  @Column({ name: 'output_data', type: 'json', nullable: true })
  outputData: Record<string, any>;

  /** 总步骤数 */
  @Column({ name: 'steps_count', type: 'int', default: 0 })
  stepsCount: number;

  /** 消耗 Token 数 */
  @Column({ name: 'total_tokens', type: 'int', default: 0 })
  totalTokens: number;

  /** 执行耗时（毫秒） */
  @Column({ name: 'duration_ms', type: 'int', default: 0 })
  durationMs: number;

  /** 错误信息（失败时） */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({
    name: 'started_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

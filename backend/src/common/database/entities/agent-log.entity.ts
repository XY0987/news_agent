import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('agent_logs')
export class AgentLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Index('idx_agent_log_session')
  @Column({ name: 'session_id', type: 'char', length: 36 })
  sessionId: string;

  @Column({ length: 100 })
  action: string;

  @Column({ type: 'json', nullable: true })
  input: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  output: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  reasoning: string;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

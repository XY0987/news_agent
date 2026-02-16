import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('sources')
export class SourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ length: 50 })
  type: string;

  @Column({ length: 255 })
  identifier: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'json', nullable: true })
  config: Record<string, any>;

  @Column({ length: 20, default: 'active' })
  status: string;

  @Column({ name: 'quality_score', type: 'float', nullable: true })
  qualityScore: number;

  @Column({ name: 'last_collected_at', type: 'timestamp', nullable: true })
  lastCollectedAt: Date;

  @Column({ type: 'json', nullable: true })
  stats: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

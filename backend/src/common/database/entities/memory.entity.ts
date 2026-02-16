import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('memories')
export class MemoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ length: 50 })
  type: string;

  @Column({ name: 'key', length: 255 })
  memoryKey: string;

  @Column({ type: 'json', nullable: true })
  value: Record<string, any>;

  @Column({ type: 'float', nullable: true })
  confidence: number;

  @Column({ length: 50, nullable: true })
  source: string;

  @Column({ name: 'valid_from', type: 'timestamp', nullable: true })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'timestamp', nullable: true })
  validUntil: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

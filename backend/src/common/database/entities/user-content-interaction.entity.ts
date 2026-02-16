import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { ContentEntity } from './content.entity';

@Entity('user_content_interactions')
export class UserContentInteractionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ name: 'content_id', type: 'char', length: 36 })
  contentId: string;

  @Column({ type: 'float', nullable: true })
  score: number;

  @Column({ name: 'user_rating', type: 'tinyint', nullable: true })
  userRating: number;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'is_saved', type: 'boolean', default: false })
  isSaved: boolean;

  @Column({ name: 'is_ignored', type: 'boolean', default: false })
  isIgnored: boolean;

  @Column({ name: 'read_duration', type: 'int', nullable: true })
  readDuration: number;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'json', nullable: true })
  suggestions: Record<string, any>;

  @Column({ name: 'notified_at', type: 'timestamp', nullable: true })
  notifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => ContentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  contentItem: ContentEntity;
}

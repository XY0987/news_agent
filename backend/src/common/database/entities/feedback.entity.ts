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

@Entity('feedbacks')
export class FeedbackEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ name: 'content_id', type: 'char', length: 36 })
  contentId: string;

  @Column({ name: 'feedback_type', length: 20 })
  feedbackType: string;

  @Column({ name: 'feedback_reason', type: 'text', nullable: true })
  feedbackReason: string;

  @Column({ name: 'read_duration', type: 'int', nullable: true })
  readDuration: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => ContentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  contentItem: ContentEntity;
}

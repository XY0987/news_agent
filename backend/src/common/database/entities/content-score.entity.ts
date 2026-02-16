import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ContentEntity } from './content.entity';
import { UserEntity } from './user.entity';

@Entity('content_scores')
export class ContentScoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'content_id', type: 'char', length: 36 })
  contentId: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ name: 'final_score', type: 'float' })
  finalScore: number;

  @Column({ name: 'score_breakdown', type: 'json', nullable: true })
  scoreBreakdown: Record<string, any>;

  @Column({ name: 'is_selected', type: 'boolean', default: false })
  isSelected: boolean;

  @Column({ name: 'selection_reason', type: 'text', nullable: true })
  selectionReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ContentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  contentItem: ContentEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

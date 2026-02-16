import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SourceEntity } from './source.entity';

@Entity('contents')
export class ContentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_id', type: 'char', length: 36 })
  sourceId: string;

  @Column({ name: 'external_id', length: 255, nullable: true, unique: true })
  externalId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'mediumtext', nullable: true })
  content: string;

  @Column({ length: 2048, nullable: true })
  url: string;

  @Column({ length: 255, nullable: true })
  author: string;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date;

  @Column({
    name: 'collected_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  collectedAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'title_hash', length: 64, nullable: true })
  titleHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => SourceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source: SourceEntity;
}

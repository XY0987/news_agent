/**
 * 内容实体 - 对应 contents 表
 */
export class ContentEntity {
  id: string;
  sourceId: string;
  externalId: string;
  title: string;
  content: string;
  url: string;
  author: string;
  publishedAt: Date;
  collectedAt: Date;
  metadata: Record<string, any>;
  titleHash: string;
  createdAt: Date;
}

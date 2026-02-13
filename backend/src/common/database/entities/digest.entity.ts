/**
 * 日报/周报实体 - 对应 digests 表
 */
export class DigestEntity {
  id: string;
  userId: string;
  type: string;
  contentIds: string[];
  renderedContent: string;
  sentAt: Date;
  createdAt: Date;
}

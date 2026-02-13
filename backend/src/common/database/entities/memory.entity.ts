/**
 * 记忆实体 - 对应 memories 表
 */
export class MemoryEntity {
  id: string;
  userId: string;
  type: string;
  key: string;
  value: Record<string, any>;
  confidence: number;
  source: string;
  validFrom: Date;
  validUntil: Date;
  createdAt: Date;
}

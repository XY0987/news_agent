/**
 * 数据源实体 - 对应 sources 表
 */
export class SourceEntity {
  id: string;
  userId: string;
  type: string;
  identifier: string;
  name: string;
  config: Record<string, any>;
  status: string;
  qualityScore: number;
  lastCollectedAt: Date;
  stats: Record<string, any>;
  createdAt: Date;
}

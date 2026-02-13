/**
 * 采集器抽象基类
 * 所有采集器继承此类，统一采集接口
 */
export interface RawContent {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  contentId: string;
  title: string;
  content: string;
  url: string;
  author: string;
  publishedAt: Date;
  collectedAt: Date;
  mediaUrls: string[];
  rawMetadata: Record<string, any>;
}

export interface SourceValidation {
  isValid: boolean;
  message: string;
}

export abstract class BaseCollector {
  abstract collect(sources: any[]): Promise<RawContent[]>;
  abstract validateSource(source: any): Promise<SourceValidation>;
}

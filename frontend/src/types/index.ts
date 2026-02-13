/**
 * 前端类型定义 - 与后端 API 响应对齐
 */

export interface User {
  id: string;
  email: string;
  name: string;
  profile: UserProfile;
  preferences: UserPreferences;
}

export interface UserProfile {
  role: string;
  techStack: string[];
  experienceYears: number;
  companyType: string;
  primaryInterests: string[];
  secondaryInterests: string[];
  excludeTags: string[];
  contentDepth: string;
  contentFormats: string[];
  languages: string[];
}

export interface UserPreferences {
  notifyTime: string;
  notifyChannels: string[];
  topN: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface Source {
  id: string;
  type: string;
  identifier: string;
  name: string;
  status: string;
  qualityScore: number;
  stats: SourceStats;
}

export interface SourceStats {
  totalArticles: number;
  relevantArticles: number;
  relevanceRate: number;
  averageScore: number;
}

export interface Content {
  id: string;
  title: string;
  url: string;
  author: string;
  sourceName: string;
  sourceType: string;
  publishedAt: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  summary: string;
  suggestions: ActionSuggestion[];
  tags: string[];
}

export interface ScoreBreakdown {
  relevance: number;
  quality: number;
  timeliness: number;
  novelty: number;
  actionability: number;
}

export interface ActionSuggestion {
  type: 'learn' | 'practice' | 'read';
  suggestion: string;
}

export interface DigestContent {
  id: string;
  date: string;
  type: 'daily' | 'weekly';
  contents: Content[];
}

export interface Suggestion {
  id: string;
  type: string;
  content: string;
  confidence: number;
}

export interface Feedback {
  contentId: string;
  type: 'useful' | 'useless' | 'save' | 'ignore';
  reason?: string;
}

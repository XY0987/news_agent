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
  /** 详细运行通知：开启后 Agent 启动和失败时发送邮件通知 */
  detailedNotify: boolean;
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
  type: "learn" | "practice" | "read";
  suggestion: string;
}

export interface DigestContent {
  id: string;
  date: string;
  type: "daily" | "weekly";
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
  type: "useful" | "useless" | "save" | "ignore";
  reason?: string;
}

// ========== Skill 类型 ==========

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  icon?: string;
  tags?: string[];
  category?: string;
  builtin?: boolean;
  triggerType: string;
  status: "enabled" | "disabled" | "not_configured";
  settings?: Record<string, any>;
  /** Git 来源信息（通过 git 安装的 Skill 才有） */
  gitSource?: SkillGitSource;
}

export interface SkillGitSource {
  gitUrl: string;
  branch: string;
  directory?: string | null;
  installedAt: string;
}

export interface InstallSkillParams {
  gitUrl: string;
  branch?: string;
  directory?: string;
}

export interface SkillDetail extends Skill {
  trigger: {
    type: string;
    schedule?: { cron: string };
    manual?: { api?: boolean; ui?: boolean };
  };
  input?: {
    required?: SkillInputParam[];
    optional?: SkillInputParam[];
  };
  tools: {
    include?: string[];
    exclude?: string[];
  };
  agent?: {
    maxSteps?: number;
    model?: string;
    temperature?: number;
    timeout?: number;
  };
  settingDefinitions?: SkillSettingDef[];
  userConfig: {
    status: "enabled" | "disabled" | "not_configured";
    settings: Record<string, any>;
  };
  recentExecutions: SkillExecution[];
}

export interface SkillInputParam {
  name: string;
  type: string;
  description: string;
  default?: any;
}

export interface SkillSettingDef {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select";
  default?: any;
  min?: number;
  max?: number;
  options?: string[] | { value: string; label: string }[];
}

export interface SkillExecution {
  id: string;
  sessionId: string;
  status: "running" | "success" | "failed";
  stepsCount: number;
  durationMs: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface SkillRegistryStats {
  total: number;
  available: number;
  categories: Record<string, number>;
  triggerTypes: Record<string, number>;
}

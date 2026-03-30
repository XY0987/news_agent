/**
 * Skills 类型定义
 *
 * 对标 CodeBuddy / Cursor / Claude Code 标准 Skill 格式
 * frontmatter 只包含 name + description（标准格式，不加额外字段）
 *
 * 设计理念：
 * - 用户启用了某个 Skill → 系统把该 Skill 的 name + description 注入到 AI 的 system prompt
 * - AI 根据 description 自主判断当前任务是否需要调用/使用该 Skill 的能力
 * - 不需要 Skill 自己声明"增强哪个流程"，由 AI 自己决策
 */

// ===================== SKILL.md Frontmatter 类型 =====================

/** SKILL.md frontmatter 标准结构（对标 CodeBuddy Skill 标准，只有 name + description） */
export interface SkillFrontmatter {
  /** 技能标识名，kebab-case */
  name: string;
  /** 技能描述——AI 根据此描述决定是否使用该技能的能力 */
  description: string;
}

// ===================== 运行时类型 =====================

/** 解析后的 Skill 完整结构（frontmatter + prompt + 目录元信息） */
export interface ParsedSkill {
  /** SKILL.md frontmatter 解析结果 */
  frontmatter: SkillFrontmatter;
  /** SKILL.md Markdown 正文（Agent 完整指令） */
  prompt: string;
  /** Skill 目录在文件系统中的绝对路径 */
  dirPath: string;
  /** Skill ID（取自 frontmatter.name 或目录名） */
  id: string;
  /** scripts/ 目录中的脚本列表 */
  scripts: string[];
  /** references/ 目录中的文档列表 */
  references: string[];
  /** assets/ 目录中的资产列表 */
  assets: string[];
}

/** 注册表中的 Skill 条目（ParsedSkill + 运行时状态） */
export interface SkillRegistryEntry {
  skill: ParsedSkill;
  /** 全局启用状态（区别于用户级别的 SkillConfigEntity.status） */
  isAvailable: boolean;
  /** 注册时间 */
  registeredAt: Date;
}

/** Skill 执行上下文 */
export interface SkillExecutionContext {
  skillId: string;
  userId: string;
  sessionId: string;
  params: Record<string, any>;
  userSettings: Record<string, any>;
}

/** Skill 执行结果（扩展 AgentResult） */
export interface SkillExecutionResult {
  sessionId: string;
  skillId: string;
  report: string;
  stepsUsed: number;
  totalDurationMs: number;
  isSuccess: boolean;
  error?: string;
}

/** Prompt 变量插值上下文 */
export interface SkillPromptVariables {
  userName?: string;
  userInterests?: string;
  currentDate?: string;
  [key: string]: any;
}

/** 脚本执行结果 */
export interface ScriptExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

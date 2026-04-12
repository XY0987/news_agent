import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AgentToolRegistry } from '../agent/agent-tool-registry.js';
import { SkillRegistryService } from './skill-registry.service.js';
import { SkillPromptService } from './skill-prompt.service.js';
import { SkillParserService } from './skill-parser.service.js';
import { SkillSandboxService } from './skill-sandbox.service.js';
import type {
  ParsedSkill,
  SkillExecutionContext,
  ScriptExecutionResult,
} from './skill.types.js';
import type { OpenAIToolDefinition } from '../agent/agent.types.js';

/**
 * AgentLoop 配置接口
 *
 * 对应 AgentService.runAgentLoop() 的 config 参数
 */
export interface AgentLoopConfig {
  userId: string;
  label: string;
  systemPrompt: string;
  userMessage: string;
  tools: OpenAIToolDefinition[];
  digestToolName: string;
  defaultReport: string;
  enableAutoDigest: boolean;
  enableFallbackAlert: boolean;
}

/**
 * Skill 执行器（标准格式）
 *
 * 核心职责：将 SKILL.md 解析结果转换为 AgentLoopConfig，传递给 runAgentLoop()
 *
 * 标准 Skill 格式中：
 * - frontmatter 只有 name + description
 * - 所有工具声明、执行步骤、参考资料引用等都在 Markdown 正文中
 * - references/ 目录中的文件作为补充知识，按需加载
 *
 * 构建流程：
 * 1. 解析 SKILL.md → frontmatter（name+description）+ Markdown 正文（完整 Agent 指令）
 * 2. 对 Prompt 进行变量插值（{{userName}} 等）→ systemPrompt
 * 3. 加载 references/ 目录中的所有文档，追加到 systemPrompt
 * 4. 如果存在 scripts/pre_run → 执行预检查脚本
 * 5. 获取全部可用 Tool 定义（标准格式不做 include/exclude 筛选）
 * 6. 组装为 AgentLoopConfig
 */
@Injectable()
export class SkillExecutorService {
  private readonly logger = new Logger(SkillExecutorService.name);

  constructor(
    private readonly skillRegistry: SkillRegistryService,
    private readonly promptService: SkillPromptService,
    private readonly parserService: SkillParserService,
    private readonly toolRegistry: AgentToolRegistry,
    private readonly sandbox: SkillSandboxService,
  ) {}

  /**
   * 构建 AgentLoopConfig
   *
   * 将 ParsedSkill + 用户上下文 转换为 runAgentLoop() 所需的 config
   */
  async buildConfig(context: SkillExecutionContext): Promise<AgentLoopConfig> {
    const { skillId, userId, params, userSettings } = context;

    // 1. 获取已解析的 Skill
    const entry = this.skillRegistry.getOrThrow(skillId);
    const skill = entry.skill;

    this.logger.log(
      `构建 Skill 配置: ${skill.id} (${skill.frontmatter.name}) for user=${userId}`,
    );

    // 2. 构建变量上下文
    const variables = this.promptService.buildVariables({
      userName: params.userName as string,
      userInterests: params.userInterests as string,
      userSettings,
      inputParams: params,
    });

    // 3. Prompt 插值（Markdown 正文即为完整 Agent 指令）
    let systemPrompt = this.promptService.interpolate(skill.prompt, variables);

    // 3.5 处理 !`command` 脚本注入（参照 Claude Code Skills 设计）
    //     在变量插值之后、追加 references 之前执行
    //     !`command` 中的命令以 Skill 目录为 cwd，注入环境变量
    const scriptEnv: Record<string, string> = {
      SKILL_ID: skill.id,
      SKILL_NAME: skill.frontmatter.name,
      SKILL_DIR: skill.dirPath,
      USER_ID: userId,
      SESSION_ID: context.sessionId,
      SKILL_PARAMS: JSON.stringify(params),
      SKILL_SETTINGS: JSON.stringify(userSettings),
    };
    systemPrompt = await this.promptService.processScriptInjections(
      systemPrompt,
      skill.dirPath,
      scriptEnv,
    );

    // 4. 加载 references/ 目录中的所有文档，追加到 systemPrompt
    systemPrompt = this.appendReferences(skill, systemPrompt);

    // 5. 动态注册 Skill 脚本工具（模式 2：Agent 推理过程中按需调用脚本）
    //    过滤掉生命周期脚本（pre_run / post_run），它们已经在 executeLifecycle 中处理
    this.registerSkillScriptTools(skill, context);

    // 6. 获取全部可用 Tool 定义（包含刚动态注册的 Skill 脚本工具）
    const tools = this.toolRegistry.getToolDefinitions();

    // 7. 构建 userMessage（包含运行时上下文信息）
    const userMessage = this.buildUserMessage(skill, context);

    // 8. 组装 config
    const config: AgentLoopConfig = {
      userId,
      label: `Skill[${skill.frontmatter.name}]`,
      systemPrompt,
      userMessage,
      tools,
      digestToolName: 'send_daily_digest', // 默认推送工具
      defaultReport: `Skill "${skill.frontmatter.name}" 执行完成，但未生成报告。`,
      enableAutoDigest: false, // Skill 默认不启用自动推送
      enableFallbackAlert: false,
    };

    this.logger.log(
      `Skill 配置构建完成: ${skill.id} — ${tools.length} tools (含 ${this.getCallableScripts(skill).length} 个脚本工具), prompt ${systemPrompt.length} chars`,
    );

    return config;
  }

  /**
   * 执行 Skill 的完整生命周期
   *
   * pre_run → buildConfig → (由调用方运行 AgentLoop) → post_run
   *
   * 注意：此方法不直接调用 runAgentLoop()，只负责生命周期钩子和配置构建
   * AgentLoop 的实际调用由 AgentService.runSkill() 完成
   */
  async executeLifecycle(context: SkillExecutionContext): Promise<{
    config: AgentLoopConfig;
    preRunOutput?: string;
  }> {
    const entry = this.skillRegistry.getOrThrow(context.skillId);
    const skill = entry.skill;

    // 执行 pre_run 钩子
    let preRunOutput: string | undefined;
    if (this.hasLifecycleScript(skill, 'pre_run')) {
      this.logger.log(`执行 pre_run 钩子: ${context.skillId}`);
      const result = await this.runLifecycleScript(skill, 'pre_run', context);

      if (result.exitCode !== 0) {
        throw new Error(
          `Skill "${context.skillId}" pre_run 脚本失败 (exit=${result.exitCode}): ${result.stderr}`,
        );
      }
      preRunOutput = result.stdout;
    }

    // 构建 config（如果有 pre_run 输出，追加到上下文）
    if (preRunOutput) {
      context.params._preRunOutput = preRunOutput;
    }
    const config = await this.buildConfig(context);

    return { config, preRunOutput };
  }

  /**
   * 执行 post_run 钩子，并清理动态注册的 Skill 脚本工具
   */
  async executePostRun(
    context: SkillExecutionContext,
    agentResult: any,
  ): Promise<void> {
    const entry = this.skillRegistry.getOrThrow(context.skillId);
    const skill = entry.skill;

    // 执行 post_run 脚本
    if (this.hasLifecycleScript(skill, 'post_run')) {
      this.logger.log(`执行 post_run 钩子: ${context.skillId}`);

      const result = await this.runLifecycleScript(skill, 'post_run', {
        ...context,
        params: {
          ...context.params,
          _agentResult: JSON.stringify(agentResult),
        },
      });

      if (result.exitCode !== 0) {
        // post_run 失败仅记录警告，不中止
        this.logger.warn(
          `Skill "${context.skillId}" post_run 脚本警告 (exit=${result.exitCode}): ${result.stderr}`,
        );
      }
    }

    // 清理动态注册的 Skill 脚本工具（确保不污染后续执行）
    this.cleanupSkillScriptTools(skill);
  }

  // ==================== 内部方法 ====================

  /**
   * 加载 references/ 目录中的所有文档并追加到 systemPrompt
   *
   * 标准 Skill 格式中，references/ 目录下的文件作为补充知识，全部加载。
   * 如果不需要某些文件，应从 references/ 目录中移除而非在代码中过滤。
   */
  private appendReferences(skill: ParsedSkill, systemPrompt: string): string {
    if (skill.references.length === 0) return systemPrompt;

    const refContents: string[] = [];

    for (const refName of skill.references) {
      const content = this.parserService.readReferenceFile(
        skill.dirPath,
        refName,
      );
      if (content) {
        refContents.push(`\n---\n## 📖 参考资料: ${refName}\n\n${content}\n`);
      } else {
        this.logger.warn(
          `Skill "${skill.id}" reference 文件读取失败: ${refName}`,
        );
      }
    }

    if (refContents.length > 0) {
      return systemPrompt + '\n\n' + refContents.join('\n');
    }

    return systemPrompt;
  }

  /**
   * 构建 userMessage（执行时的用户消息）
   */
  private buildUserMessage(
    skill: ParsedSkill,
    context: SkillExecutionContext,
  ): string {
    const parts: string[] = [];

    parts.push(`请执行 "${skill.frontmatter.name}" 技能任务。`);

    // 添加输入参数说明
    if (Object.keys(context.params).length > 0) {
      const paramEntries = Object.entries(context.params)
        .filter(([key]) => !key.startsWith('_')) // 过滤内部参数
        .map(
          ([key, value]) =>
            `- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`,
        )
        .join('\n');

      if (paramEntries) {
        parts.push(`\n**执行参数：**\n${paramEntries}`);
      }
    }

    // 添加 pre_run 脚本输出
    if (context.params._preRunOutput) {
      parts.push(`\n**预处理脚本输出：**\n${context.params._preRunOutput}`);
    }

    return parts.join('\n');
  }

  /**
   * 检查是否存在指定生命周期脚本
   */
  hasLifecycleScript(skill: ParsedSkill, hookName: string): boolean {
    const scriptsDir = path.join(skill.dirPath, 'scripts');
    const extensions = ['.sh', '.ts', '.js'];

    return extensions.some((ext) =>
      fs.existsSync(path.join(scriptsDir, `${hookName}${ext}`)),
    );
  }

  /**
   * 执行生命周期脚本（通过安全沙箱）
   *
   * 支持两种调用方式：
   * - 传入完整 SkillExecutionContext（独立运行模式）
   * - 传入轻量 env Record（增强模式，由 SkillEnhancerService 调用）
   */
  async runLifecycleScript(
    skill: ParsedSkill,
    hookName: string,
    contextOrEnv: SkillExecutionContext | Record<string, string>,
  ): Promise<ScriptExecutionResult> {
    const scriptsDir = path.join(skill.dirPath, 'scripts');
    const extensions = ['.sh', '.ts', '.js'];
    let scriptPath: string | null = null;

    for (const ext of extensions) {
      const candidate = path.join(scriptsDir, `${hookName}${ext}`);
      if (fs.existsSync(candidate)) {
        scriptPath = candidate;
        break;
      }
    }

    if (!scriptPath) {
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 0,
      };
    }

    // 构建环境变量：区分完整 context 和轻量 env
    let env: Record<string, string>;
    if ('skillId' in contextOrEnv) {
      // 完整 SkillExecutionContext
      const ctx = contextOrEnv as SkillExecutionContext;
      env = {
        SKILL_ID: skill.id,
        SKILL_NAME: skill.frontmatter.name,
        SKILL_DIR: skill.dirPath,
        USER_ID: ctx.userId,
        SESSION_ID: ctx.sessionId,
        SKILL_PARAMS: JSON.stringify(ctx.params),
        SKILL_SETTINGS: JSON.stringify(ctx.userSettings),
      };
    } else {
      // 轻量 env（增强模式）
      env = {
        SKILL_ID: skill.id,
        SKILL_NAME: skill.frontmatter.name,
        SKILL_DIR: skill.dirPath,
        ...contextOrEnv,
      };
    }

    const result = await this.sandbox.executeScript(scriptPath, skill.dirPath, {
      env,
    });

    // 打印生命周期脚本输出到控制台
    if (result.stdout?.trim()) {
      this.logger.log(
        `[${hookName}] ${skill.id} stdout:\n${result.stdout.trim()}`,
      );
    }
    if (result.stderr?.trim()) {
      const level = result.exitCode !== 0 ? 'warn' : 'debug';
      this.logger[level](
        `[${hookName}] ${skill.id} stderr:\n${result.stderr.trim()}`,
      );
    }

    return result;
  }

  /**
   * 创建 Skill 执行上下文
   */
  createContext(params: {
    skillId: string;
    userId: string;
    inputParams?: Record<string, any>;
    userSettings?: Record<string, any>;
  }): SkillExecutionContext {
    return {
      skillId: params.skillId,
      userId: params.userId,
      sessionId: uuidv4(),
      params: params.inputParams || {},
      userSettings: params.userSettings || {},
    };
  }

  // ==================== Skill 脚本工具（模式 2：Agent 推理中按需调用） ====================

  /** 生命周期脚本名前缀（不注册为可调用工具） */
  private static readonly LIFECYCLE_SCRIPTS = [
    'pre_run',
    'post_run',
    'gather_context',
  ];

  /**
   * 获取 Skill 中可被 Agent 调用的脚本列表（排除生命周期脚本）
   */
  getCallableScripts(skill: ParsedSkill): string[] {
    return skill.scripts.filter((scriptName) => {
      const baseName = scriptName.replace(/\.(js|ts|sh)$/, '');
      return !SkillExecutorService.LIFECYCLE_SCRIPTS.includes(baseName);
    });
  }

  /**
   * 为 Skill 的 scripts/ 下的可调用脚本动态注册 Agent 工具
   *
   * 每个脚本注册为一个独立工具，工具名格式：skill_script__{skillId}__{scriptBaseName}
   * 例如：skill_script__daily-digest-email__analyze_trends
   *
   * 支持两种调用方式：
   * - 传入 SkillExecutionContext（独立运行模式）
   * - 传入 env Record（增强模式，由 SkillEnhancerService 调用）
   *
   * @returns 注册的工具名列表
   */
  registerSkillScriptTools(
    skill: ParsedSkill,
    contextOrEnv: SkillExecutionContext | Record<string, string>,
  ): string[] {
    const callableScripts = this.getCallableScripts(skill);

    if (callableScripts.length === 0) return [];

    // 构建基础环境变量
    const baseEnv: Record<string, string> =
      'skillId' in contextOrEnv
        ? {
            SKILL_ID: skill.id,
            SKILL_NAME: skill.frontmatter.name,
            SKILL_DIR: skill.dirPath,
            USER_ID: (contextOrEnv as SkillExecutionContext).userId,
            SESSION_ID: (contextOrEnv as SkillExecutionContext).sessionId,
            SKILL_PARAMS: JSON.stringify(
              (contextOrEnv as SkillExecutionContext).params,
            ),
            SKILL_SETTINGS: JSON.stringify(
              (contextOrEnv as SkillExecutionContext).userSettings,
            ),
          }
        : {
            SKILL_ID: skill.id,
            SKILL_NAME: skill.frontmatter.name,
            SKILL_DIR: skill.dirPath,
            ...contextOrEnv,
          };

    this.logger.log(
      `为 Skill "${skill.id}" 注册 ${callableScripts.length} 个脚本工具: ${callableScripts.join(', ')}`,
    );

    const registeredNames: string[] = [];

    for (const scriptName of callableScripts) {
      const baseName = scriptName.replace(/\.(js|ts|sh)$/, '');
      const toolName = `skill_script__${skill.id}__${baseName}`;
      const scriptPath = path.join(skill.dirPath, 'scripts', scriptName);

      this.toolRegistry.registerDynamic({
        name: toolName,
        description:
          `执行 Skill "${skill.frontmatter.name}" 的脚本: ${scriptName}。` +
          `此脚本位于 Skill 的 scripts/ 目录中，可在 Agent 推理过程中按需调用。` +
          `输入参数会通过环境变量 SCRIPT_ARGS 传递（JSON 格式）。`,
        parameters: {
          type: 'object',
          properties: {
            args: {
              type: 'object',
              description:
                '传递给脚本的参数（JSON 对象），脚本可通过 SCRIPT_ARGS 环境变量读取',
            },
          },
          required: [],
        },
        execute: async (toolArgs: Record<string, any>) => {
          const result = await this.sandbox.executeScript(
            scriptPath,
            skill.dirPath,
            {
              env: {
                ...baseEnv,
                SCRIPT_ARGS: JSON.stringify(toolArgs.args || {}),
              },
            },
          );

          if (result.exitCode !== 0) {
            this.logger.warn(
              `Skill 脚本 ${scriptName} 执行异常 (exit=${result.exitCode}, ${result.durationMs}ms)`,
            );
            if (result.stderr?.trim()) {
              this.logger.warn(`  [stderr] ${result.stderr.trim()}`);
            }
            if (result.stdout?.trim()) {
              this.logger.log(`  [stdout] ${result.stdout.trim()}`);
            }
            return {
              success: false,
              output: result.stdout?.trim() || '',
              error: result.stderr?.trim() || `exit code ${result.exitCode}`,
              durationMs: result.durationMs,
            };
          }

          this.logger.log(
            `Skill 脚本 ${scriptName} 执行成功 (${result.durationMs}ms)`,
          );
          if (result.stdout?.trim()) {
            this.logger.log(`  [stdout] ${result.stdout.trim()}`);
          }
          if (result.stderr?.trim()) {
            this.logger.debug(`  [stderr] ${result.stderr.trim()}`);
          }
          return {
            success: true,
            output: result.stdout?.trim() || '',
            error: result.stderr?.trim() || undefined,
            durationMs: result.durationMs,
          };
        },
      });

      registeredNames.push(toolName);
    }

    return registeredNames;
  }

  /**
   * 清理 Skill 动态注册的脚本工具（供 executePostRun 或外部异常处理时调用）
   */
  cleanupSkillScriptTools(skillOrId: ParsedSkill | string): void {
    let skill: ParsedSkill;
    if (typeof skillOrId === 'string') {
      const entry = this.skillRegistry.get(skillOrId);
      if (!entry) return;
      skill = entry.skill;
    } else {
      skill = skillOrId;
    }

    const callableScripts = this.getCallableScripts(skill);
    for (const scriptName of callableScripts) {
      const baseName = scriptName.replace(/\.(js|ts|sh)$/, '');
      const toolName = `skill_script__${skill.id}__${baseName}`;
      this.toolRegistry.unregisterDynamic(toolName);
    }
  }
}

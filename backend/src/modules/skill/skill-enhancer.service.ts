import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { SkillRegistryService } from './skill-registry.service.js';
import { SkillPromptService } from './skill-prompt.service.js';
import { SkillExecutorService } from './skill-executor.service.js';
import { SkillConfigEntity } from '../../common/database/entities/skill-config.entity.js';
import type { SkillRegistryEntry } from './skill.types.js';
import type {
  OpenAIToolDefinition,
  ToolExecutor,
} from '../agent/agent.types.js';

/**
 * 增强结果：应用到现有流程 config 的最终产物
 */
export interface EnhancedConfig {
  /** 增强后的 systemPrompt（原始 prompt + 已启用 Skill 的描述清单 + load_skill 使用引导） */
  systemPrompt: string;
  /** 被注入的 Skill 列表 */
  appliedSkills: Array<{ id: string; name: string }>;
  /** 需要追加到 tools 列表的 Skill 相关工具定义 */
  skillTools: Array<{
    definition: OpenAIToolDefinition;
    execute: ToolExecutor;
  }>;
  /**
   * 通过 load_skill 加载过的 Skill ID 列表（运行时动态填充）
   * 调用方在清理时需遍历此列表，执行 post_run + 清理脚本工具
   */
  loadedSkillIds: string[];
}

/**
 * Skill 增强服务 —— 参照 Claude Code Skills 的两阶段渐进式加载机制
 *
 * 工作原理：
 * 1. enhance() 在 systemPrompt 末尾注入所有已启用 Skill 的 name + description（第一阶段）
 * 2. 同时注册 `load_skill` 工具，AI 判断某个 Skill 与任务相关时主动调用加载完整内容（第二阶段）
 * 3. load_skill 加载 Skill 时：执行 pre_run 钩子 → 注册脚本工具 → 返回完整指令
 * 4. AI 获得完整指令后，按 Skill 中的步骤执行任务
 * 5. Agent 执行完毕后：调用 cleanupLoadedSkills 执行 post_run 钩子并清理脚本工具
 *
 * 生命周期钩子和脚本工具注册统一复用 SkillExecutorService，不维护两份实现。
 */
@Injectable()
export class SkillEnhancerService {
  private readonly logger = new Logger(SkillEnhancerService.name);

  constructor(
    private readonly registry: SkillRegistryService,
    private readonly promptService: SkillPromptService,
    private readonly executor: SkillExecutorService,
    @InjectRepository(SkillConfigEntity)
    private readonly configRepo: Repository<SkillConfigEntity>,
  ) {}

  /**
   * 增强现有流程的 systemPrompt + 注册 Skill 工具
   *
   * 参照 Claude Code 的两阶段加载：
   * - 第一阶段：将已启用 Skill 的 description 注入 systemPrompt（AI 知道自己有哪些能力）
   * - 第二阶段：提供 load_skill 工具定义（AI 判断需要时主动加载完整 Skill 内容）
   */
  async enhance(
    originalPrompt: string,
    userId: string,
  ): Promise<EnhancedConfig> {
    const allEntries = this.registry.list({ isAvailable: true });

    if (allEntries.length === 0) {
      return {
        systemPrompt: originalPrompt,
        appliedSkills: [],
        skillTools: [],
        loadedSkillIds: [],
      };
    }

    const enabledSkills = await this.filterUserEnabled(allEntries, userId);

    if (enabledSkills.length === 0) {
      this.logger.debug(
        `用户 ${userId} 未启用任何 Skill（共 ${allEntries.length} 个可用）`,
      );
      return {
        systemPrompt: originalPrompt,
        appliedSkills: [],
        skillTools: [],
        loadedSkillIds: [],
      };
    }

    const enhancedPrompt = this.injectSkillDescriptions(
      originalPrompt,
      enabledSkills,
    );

    // loadedSkillIds 会在 load_skill 执行时动态填充
    const loadedSkillIds: string[] = [];

    const skillTools = this.buildSkillTools(
      enabledSkills,
      userId,
      loadedSkillIds,
    );

    const appliedSkills = enabledSkills.map((entry) => ({
      id: entry.skill.id,
      name: entry.skill.frontmatter.name,
    }));

    this.logger.log(
      `已注入 ${appliedSkills.length} 个 Skill 描述 + load_skill 工具: ${appliedSkills.map((s) => s.name).join(', ')}`,
    );

    return {
      systemPrompt: enhancedPrompt,
      appliedSkills,
      skillTools,
      loadedSkillIds,
    };
  }

  /**
   * 清理所有通过 load_skill 加载的 Skill
   *
   * 对每个已加载的 Skill 执行：
   * 1. post_run 生命周期钩子（失败仅警告，不中止）
   * 2. 清理动态注册的脚本工具
   *
   * 调用方（AgentService）在 finally 块中调用此方法。
   */
  async cleanupLoadedSkills(
    loadedSkillIds: string[],
    env: Record<string, string>,
  ): Promise<void> {
    for (const skillId of loadedSkillIds) {
      const entry = this.registry.get(skillId);
      if (!entry) continue;

      const skill = entry.skill;

      // 1. 执行 post_run 钩子（失败仅警告）
      if (this.executor.hasLifecycleScript(skill, 'post_run')) {
        try {
          const result = await this.executor.runLifecycleScript(
            skill,
            'post_run',
            env,
          );
          if (result.exitCode !== 0) {
            this.logger.warn(
              `Skill "${skillId}" post_run 警告 (exit=${result.exitCode}): ${result.stderr}`,
            );
          } else {
            this.logger.log(
              `Skill "${skillId}" post_run 完成: ${result.stdout?.length || 0} chars`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Skill "${skillId}" post_run 异常: ${(err as Error).message}`,
          );
        }
      }

      // 2. 清理脚本工具
      this.executor.cleanupSkillScriptTools(skillId);
    }
  }

  // ==================== 内部方法 ====================

  /**
   * 过滤出用户已启用的 Skill
   */
  private async filterUserEnabled(
    entries: SkillRegistryEntry[],
    userId: string,
  ): Promise<SkillRegistryEntry[]> {
    if (entries.length === 0) return [];

    const skillIds = entries.map((e) => e.skill.id);

    const configs = await this.configRepo
      .createQueryBuilder('config')
      .where('config.userId = :userId', { userId })
      .andWhere('config.skillId IN (:...skillIds)', { skillIds })
      .getMany();

    const enabledSet = new Set(
      configs.filter((c) => c.status === 'enabled').map((c) => c.skillId),
    );

    return entries.filter((e) => enabledSet.has(e.skill.id));
  }

  /**
   * 第一阶段：将已启用 Skill 的 name + description 注入到 systemPrompt 末尾
   */
  private injectSkillDescriptions(
    originalPrompt: string,
    enabledSkills: SkillRegistryEntry[],
  ): string {
    const skillList = enabledSkills
      .map((entry) => {
        let desc = entry.skill.frontmatter.description.trim();
        if (desc.length > 250) {
          desc = desc.slice(0, 247) + '...';
        }
        return `- **${entry.skill.frontmatter.name}**: ${desc}`;
      })
      .join('\n');

    const skillNames = enabledSkills
      .map((e) => `"${e.skill.frontmatter.name}"`)
      .join(', ');

    const injection = `

---

# 🔌 已启用的扩展技能 (Skills)

以下是用户已启用的扩展技能。每个技能包含名称和简要描述：

${skillList}

## 使用方式

当你判断当前任务与某个技能相关时，请调用 \`load_skill\` 工具加载该技能的完整指令。
加载后你将获得详细的执行步骤、参考资料和工具使用指南。

**重要**：
- 在 load_skill 返回完整内容之前，不要猜测技能的具体行为
- 可以同时加载多个相关技能
- 可用的技能名称：${skillNames}`;

    return originalPrompt + injection;
  }

  /**
   * 第二阶段：构建 load_skill 工具定义
   */
  private buildSkillTools(
    enabledSkills: SkillRegistryEntry[],
    userId: string,
    loadedSkillIds: string[],
  ): Array<{ definition: OpenAIToolDefinition; execute: ToolExecutor }> {
    const skillNames = enabledSkills.map((e) => e.skill.frontmatter.name);

    const loadSkillTool = {
      definition: {
        type: 'function' as const,
        function: {
          name: 'load_skill',
          description:
            '加载指定技能的完整指令内容。当你判断某个已启用的技能与当前任务相关时，' +
            '调用此工具获取该技能的详细执行步骤、参考资料和工具使用指南。' +
            '加载后，技能附带的脚本工具会自动注册，你可以直接调用。' +
            `可用的技能名称: ${skillNames.join(', ')}`,
          parameters: {
            type: 'object' as const,
            properties: {
              skillName: {
                type: 'string',
                description: `要加载的技能名称，必须是以下之一: ${skillNames.join(', ')}`,
                enum: skillNames,
              },
            },
            required: ['skillName'],
          },
        },
      },
      execute: async (args: Record<string, any>) => {
        return this.loadSkillContent(
          args.skillName as string,
          enabledSkills,
          userId,
          loadedSkillIds,
        );
      },
    };

    return [loadSkillTool];
  }

  /**
   * load_skill 工具的执行逻辑
   *
   * 1. 变量插值 → 2. !`command` 脚本注入 → 3. pre_run 钩子
   * → 4. references 加载 → 5. 脚本工具注册 → 6. 组合返回
   */
  private async loadSkillContent(
    skillName: string,
    enabledSkills: SkillRegistryEntry[],
    userId: string,
    loadedSkillIds: string[],
  ): Promise<{
    success: boolean;
    skillName: string;
    content?: string;
    references?: Array<{ name: string; content: string }>;
    registeredScriptTools?: string[];
    preRunOutput?: string;
    error?: string;
  }> {
    const entry = enabledSkills.find(
      (e) => e.skill.frontmatter.name === skillName,
    );

    if (!entry) {
      this.logger.warn(`load_skill: 技能 "${skillName}" 未找到或未启用`);
      return {
        success: false,
        skillName,
        error: `技能 "${skillName}" 未找到或未启用。可用的技能: ${enabledSkills.map((e) => e.skill.frontmatter.name).join(', ')}`,
      };
    }

    const skill = entry.skill;
    this.logger.log(
      `load_skill: 加载技能 "${skillName}" (${skill.prompt.length} chars prompt, ${skill.references.length} refs, ${skill.scripts.length} scripts)`,
    );

    try {
      // 1. 变量插值
      const variables = this.promptService.buildVariables({
        userName: undefined,
        extraContext: {
          skillName: skill.frontmatter.name,
          skillDescription: skill.frontmatter.description,
        },
      });
      let fullContent = this.promptService.interpolate(skill.prompt, variables);

      // 2. !`command` 脚本注入
      const scriptEnv: Record<string, string> = {
        SKILL_ID: skill.id,
        SKILL_NAME: skill.frontmatter.name,
        SKILL_DIR: skill.dirPath,
        USER_ID: userId,
      };
      fullContent = await this.promptService.processScriptInjections(
        fullContent,
        skill.dirPath,
        scriptEnv,
      );

      // 3. 执行 pre_run 生命周期钩子（复用 SkillExecutorService）
      let preRunOutput: string | undefined;
      if (this.executor.hasLifecycleScript(skill, 'pre_run')) {
        this.logger.log(`load_skill: 执行 pre_run 钩子: ${skill.id}`);
        const result = await this.executor.runLifecycleScript(
          skill,
          'pre_run',
          scriptEnv,
        );
        if (result.exitCode !== 0) {
          this.logger.warn(
            `load_skill: "${skillName}" pre_run 失败 (exit=${result.exitCode}): ${result.stderr}`,
          );
          preRunOutput = `[⚠️ pre_run 脚本执行失败: ${result.stderr}]`;
        } else {
          preRunOutput = result.stdout?.trim() || undefined;
          this.logger.log(
            `load_skill: "${skillName}" pre_run 完成: ${preRunOutput?.length || 0} chars`,
          );
        }
      }

      // 4. 加载 references/
      const references: Array<{ name: string; content: string }> = [];
      for (const refName of skill.references) {
        const refPath = path.join(skill.dirPath, 'references', refName);
        try {
          if (fs.existsSync(refPath)) {
            references.push({
              name: refName,
              content: fs.readFileSync(refPath, 'utf-8'),
            });
          }
        } catch (err) {
          this.logger.warn(
            `load_skill: 读取参考文件失败 ${refName}: ${(err as Error).message}`,
          );
        }
      }

      // 5. 动态注册脚本工具（复用 SkillExecutorService）
      const registeredScriptTools = this.executor.registerSkillScriptTools(
        skill,
        scriptEnv,
      );

      // 追踪已加载的 Skill ID（用于 post_run 清理）
      if (!loadedSkillIds.includes(skill.id)) {
        loadedSkillIds.push(skill.id);
      }

      // 6. 组合完整内容
      let combinedContent = `# 技能: ${skill.frontmatter.name}\n\n${fullContent}`;

      if (preRunOutput) {
        combinedContent += `\n\n---\n\n# 🚀 预处理脚本输出 (pre_run)\n\n${preRunOutput}\n`;
      }

      if (references.length > 0) {
        combinedContent += '\n\n---\n\n# 📖 参考资料\n';
        for (const ref of references) {
          combinedContent += `\n## ${ref.name}\n\n${ref.content}\n`;
        }
      }

      if (registeredScriptTools.length > 0) {
        combinedContent += '\n\n---\n\n# 🔧 可用脚本工具\n\n';
        combinedContent +=
          '以下脚本工具已自动注册，你可以在推理过程中直接调用：\n\n';
        for (const toolName of registeredScriptTools) {
          combinedContent += `- \`${toolName}\`: 通过 SCRIPT_ARGS 环境变量接收 JSON 格式参数\n`;
        }
        combinedContent +=
          '\n调用时传入 `args` 参数（JSON 对象），脚本会通过 SCRIPT_ARGS 环境变量读取。\n';
      }

      this.logger.log(
        `load_skill: "${skillName}" 加载完成 — ${combinedContent.length} chars (${references.length} refs, ${registeredScriptTools.length} scripts)`,
      );

      return {
        success: true,
        skillName,
        content: combinedContent,
        references: references.map((r) => ({
          name: r.name,
          content: r.content,
        })),
        registeredScriptTools,
        preRunOutput,
      };
    } catch (err) {
      this.logger.error(
        `load_skill: 加载技能 "${skillName}" 失败: ${(err as Error).message}`,
      );
      return {
        success: false,
        skillName,
        error: `加载技能失败: ${(err as Error).message}`,
      };
    }
  }
}

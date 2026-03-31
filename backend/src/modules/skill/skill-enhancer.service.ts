import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { SkillRegistryService } from './skill-registry.service.js';
import { SkillPromptService } from './skill-prompt.service.js';
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
}

/**
 * Skill 增强服务 —— 参照 Claude Code Skills 的两阶段渐进式加载机制
 *
 * Claude Code 官方 Skills 加载机制：
 *
 * | 阶段 | 何时加载 | 加载什么 | 上下文成本 |
 * |------|---------|---------|-----------|
 * | 第一阶段 | 会话启动时 | 所有已启用 Skill 的 name + description | 低（每个请求） |
 * | 第二阶段 | AI 判断需要时 | SKILL.md 的完整 Markdown 正文 | 按需（调用时加载） |
 * | 第三阶段 | 需要更多细节 | references/ 目录下的文档 | 按需 |
 *
 * 工作原理：
 * 1. enhance() 在 systemPrompt 末尾注入所有已启用 Skill 的 name + description（第一阶段）
 * 2. 同时注册 `load_skill` 工具，AI 判断某个 Skill 与任务相关时主动调用加载完整内容（第二阶段）
 * 3. load_skill 返回的完整 prompt 中如引用了 references/ 文件，也会一并加载（第三阶段）
 * 4. AI 获得完整指令后，按 Skill 中的步骤执行任务
 *
 * 设计原则（对齐 Claude Code）：
 * - 描述始终在上下文中，调用时加载完整 Skill
 * - AI 自主决策是否加载——就像看到 tool 列表后自己决定是否调用某个 tool
 * - 不需要 Skill 声明"增强哪个流程"，由 AI 根据 description 自行判断
 * - 如果用户没有启用任何 Skill，enhance 直接透传原始 prompt
 */
@Injectable()
export class SkillEnhancerService {
  private readonly logger = new Logger(SkillEnhancerService.name);

  constructor(
    private readonly registry: SkillRegistryService,
    private readonly promptService: SkillPromptService,
    @InjectRepository(SkillConfigEntity)
    private readonly configRepo: Repository<SkillConfigEntity>,
  ) {}

  /**
   * 增强现有流程的 systemPrompt + 注册 Skill 工具
   *
   * 参照 Claude Code 的两阶段加载：
   * - 第一阶段：将已启用 Skill 的 description 注入 systemPrompt（AI 知道自己有哪些能力）
   * - 第二阶段：提供 load_skill 工具定义（AI 判断需要时主动加载完整 Skill 内容）
   *
   * @param originalPrompt - 现有流程构建的原始 systemPrompt
   * @param userId - 当前用户 ID
   * @returns 增强后的配置（包含新 systemPrompt、注入的 Skill 列表、Skill 工具定义）
   */
  async enhance(
    originalPrompt: string,
    userId: string,
  ): Promise<EnhancedConfig> {
    // 1. 获取所有在注册表中可用的 Skill
    const allEntries = this.registry.list({ isAvailable: true });

    if (allEntries.length === 0) {
      return {
        systemPrompt: originalPrompt,
        appliedSkills: [],
        skillTools: [],
      };
    }

    // 2. 过滤出用户已启用的 Skill
    const enabledSkills = await this.filterUserEnabled(allEntries, userId);

    if (enabledSkills.length === 0) {
      this.logger.debug(
        `用户 ${userId} 未启用任何 Skill（共 ${allEntries.length} 个可用）`,
      );
      return {
        systemPrompt: originalPrompt,
        appliedSkills: [],
        skillTools: [],
      };
    }

    // 3. 第一阶段：将 name + description 注入 systemPrompt
    const enhancedPrompt = this.injectSkillDescriptions(
      originalPrompt,
      enabledSkills,
    );

    // 4. 第二阶段：构建 load_skill 工具定义（AI 判断需要时主动调用）
    const skillTools = this.buildSkillTools(enabledSkills, userId);

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
    };
  }

  // ==================== 内部方法 ====================

  /**
   * 过滤出用户已启用的 Skill
   *
   * 逻辑：
   * - 用户对该 Skill 有配置记录且 status=enabled → 启用
   * - 用户对该 Skill 无配置记录 → 不启用（需要用户主动启用）
   * - 用户对该 Skill 有配置记录且 status=disabled → 不启用
   */
  private async filterUserEnabled(
    entries: SkillRegistryEntry[],
    userId: string,
  ): Promise<SkillRegistryEntry[]> {
    if (entries.length === 0) return [];

    const skillIds = entries.map((e) => e.skill.id);

    // 批量查询用户配置
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
   *
   * 参照 Claude Code：
   * - 描述始终在上下文中（description 长度超过 250 字符会被截断）
   * - 引导 AI 使用 load_skill 工具加载完整内容
   */
  private injectSkillDescriptions(
    originalPrompt: string,
    enabledSkills: SkillRegistryEntry[],
  ): string {
    const skillList = enabledSkills
      .map((entry) => {
        // 参照 Claude Code：description 超过 250 字符截断
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
   * 第二阶段：构建 Skill 相关的工具定义
   *
   * 注册 load_skill 工具，让 AI 在判断需要某个 Skill 时主动调用，
   * 返回该 Skill 的完整 Markdown 正文 + references 文件内容。
   *
   * 这对应 Claude Code 的"调用时加载完整 Skill"行为。
   */
  private buildSkillTools(
    enabledSkills: SkillRegistryEntry[],
    userId: string,
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
        return this.loadSkillContent(args.skillName, enabledSkills, userId);
      },
    };

    return [loadSkillTool];
  }

  /**
   * load_skill 工具的执行逻辑
   *
   * 加载 Skill 的完整内容，实现渐进式披露的第二、第三阶段：
   * 1. 加载 SKILL.md 的 Markdown 正文（完整 Agent 指令）
   * 2. 执行变量插值（{{variable}} 替换）
   * 3. 处理 !`command` 脚本注入（参照 Claude Code）
   * 4. 加载 references/ 目录中的所有参考文档
   * 5. 返回组合后的完整内容
   */
  private async loadSkillContent(
    skillName: string,
    enabledSkills: SkillRegistryEntry[],
    userId: string,
  ): Promise<{
    success: boolean;
    skillName: string;
    content?: string;
    references?: Array<{ name: string; content: string }>;
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
      `load_skill: 加载技能 "${skillName}" 的完整内容 (${skill.prompt.length} chars prompt, ${skill.references.length} references)`,
    );

    try {
      // 1. 变量插值
      const variables = this.promptService.buildVariables({
        userName: undefined, // 在增强模式下不强制要求用户名
        extraContext: {
          skillName: skill.frontmatter.name,
          skillDescription: skill.frontmatter.description,
        },
      });
      let fullContent = this.promptService.interpolate(skill.prompt, variables);

      // 2. 处理 !`command` 脚本注入
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

      // 3. 加载 references/ 目录中的文档
      const references: Array<{ name: string; content: string }> = [];
      for (const refName of skill.references) {
        const refPath = path.join(skill.dirPath, 'references', refName);
        try {
          if (fs.existsSync(refPath)) {
            const refContent = fs.readFileSync(refPath, 'utf-8');
            references.push({ name: refName, content: refContent });
          }
        } catch (err) {
          this.logger.warn(
            `load_skill: 读取参考文件失败 ${refName}: ${(err as Error).message}`,
          );
        }
      }

      // 4. 组合完整内容（prompt + references）
      let combinedContent = `# 技能: ${skill.frontmatter.name}\n\n${fullContent}`;

      if (references.length > 0) {
        combinedContent += '\n\n---\n\n# 📖 参考资料\n';
        for (const ref of references) {
          combinedContent += `\n## ${ref.name}\n\n${ref.content}\n`;
        }
      }

      this.logger.log(
        `load_skill: 技能 "${skillName}" 加载完成 — ${combinedContent.length} chars (含 ${references.length} 个参考文件)`,
      );

      return {
        success: true,
        skillName,
        content: combinedContent,
        references: references.map((r) => ({
          name: r.name,
          content: r.content,
        })),
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

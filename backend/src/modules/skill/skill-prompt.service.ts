import { Injectable, Logger } from '@nestjs/common';
import { SkillSandboxService } from './skill-sandbox.service.js';
import type { SkillPromptVariables } from './skill.types.js';

/**
 * Skill Prompt 模板引擎
 *
 * 负责：
 * 1. Mustache 风格 {{variable}} 变量插值
 * 2. 支持嵌套属性访问（如 {{user.name}}）
 * 3. 支持默认值（如 {{variable|默认值}}）
 * 4. 支持条件块（如 {{#hasHistory}}...{{/hasHistory}}）
 * 5. 未匹配变量保留原文（避免误删模板标记）
 */
@Injectable()
export class SkillPromptService {
  private readonly logger = new Logger(SkillPromptService.name);

  constructor(private readonly sandbox: SkillSandboxService) {}

  /**
   * 对 Prompt 模板进行变量插值
   *
   * @param template  Markdown 正文（含 {{variable}} 占位符）
   * @param variables 变量上下文
   * @returns 插值后的完整 Prompt
   */
  interpolate(template: string, variables: SkillPromptVariables): string {
    let result = template;

    // 1. 处理条件块 {{#key}}...{{/key}}
    result = this.processConditionalBlocks(result, variables);

    // 2. 处理反向条件块 {{^key}}...{{/key}}（当 key 为 falsy 时显示）
    result = this.processInverseBlocks(result, variables);

    // 3. 处理变量插值 {{key}} 或 {{key|default}}
    result = this.processVariables(result, variables);

    return result;
  }

  /**
   * 构建通用 Prompt 变量上下文
   *
   * 将用户信息、执行参数、系统信息合并为统一的变量 map
   */
  buildVariables(params: {
    userName?: string;
    userInterests?: string;
    userSettings?: Record<string, any>;
    inputParams?: Record<string, any>;
    extraContext?: Record<string, any>;
  }): SkillPromptVariables {
    const now = new Date();
    const currentDate = now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
      timeZone: 'Asia/Shanghai',
    });
    const currentTime = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai',
    });

    const variables: SkillPromptVariables = {
      // 系统变量
      currentDate,
      currentTime,
      timestamp: now.toISOString(),

      // 用户变量
      userName: params.userName || '用户',
      userInterests: params.userInterests || '未设置',

      // 用户设置展开到顶层
      ...(params.userSettings || {}),

      // 输入参数展开到顶层
      ...(params.inputParams || {}),

      // 额外上下文
      ...(params.extraContext || {}),
    };

    return variables;
  }

  /**
   * 处理条件块：{{#key}}content{{/key}}
   * 当 key 为 truthy 时保留 content，否则移除整个块
   */
  private processConditionalBlocks(
    template: string,
    variables: SkillPromptVariables,
  ): string {
    const blockRegex = /\{\{#(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

    return template.replace(
      blockRegex,
      (_match, key: string, content: string) => {
        const value = this.resolveValue(key, variables);

        // 数组：对每个元素重复 content
        if (Array.isArray(value)) {
          if (value.length === 0) return '';
          return value
            .map((item) => {
              if (typeof item === 'object' && item !== null) {
                // 嵌套对象：将其属性展开为变量
                return this.processVariables(content, {
                  ...variables,
                  ...item,
                });
              }
              return this.processVariables(content, {
                ...variables,
                '.': String(item),
              });
            })
            .join('');
        }

        // 布尔 / truthy 检查
        if (value) {
          return content;
        }
        return '';
      },
    );
  }

  /**
   * 处理反向条件块：{{^key}}content{{/key}}
   * 当 key 为 falsy 时保留 content
   */
  private processInverseBlocks(
    template: string,
    variables: SkillPromptVariables,
  ): string {
    const blockRegex = /\{\{\^(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

    return template.replace(
      blockRegex,
      (_match, key: string, content: string) => {
        const value = this.resolveValue(key, variables);

        if (!value || (Array.isArray(value) && value.length === 0)) {
          return content;
        }
        return '';
      },
    );
  }

  /**
   * 处理变量插值：{{key}} 或 {{key|defaultValue}}
   */
  private processVariables(
    template: string,
    variables: SkillPromptVariables,
  ): string {
    // 匹配 {{key}} 或 {{key|default value}}
    const varRegex = /\{\{(\w+(?:\.\w+)*)(?:\|([^}]*))?\}\}/g;

    return template.replace(
      varRegex,
      (_match, key: string, defaultValue?: string) => {
        const value = this.resolveValue(key, variables);

        if (value !== undefined && value !== null) {
          // 数组 → 逗号分隔字符串
          if (Array.isArray(value)) {
            return value.join(', ');
          }
          // 对象 → JSON
          if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
          }
          return String(value);
        }

        // 有默认值则使用默认值
        if (defaultValue !== undefined) {
          return defaultValue;
        }

        // 未匹配到 → 保留原始占位符（避免误删）
        this.logger.debug(`Prompt 变量未匹配: {{${key}}}`);
        return _match;
      },
    );
  }

  /**
   * 解析嵌套属性值（支持 a.b.c 点号访问）
   */
  private resolveValue(key: string, variables: SkillPromptVariables): any {
    const parts = key.split('.');
    let current: unknown = variables;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * 提取模板中所有的变量名（用于预检查）
   */
  extractVariableNames(template: string): string[] {
    const varRegex = /\{\{([#^/]?)(\w+(?:\.\w+)*)(?:\|[^}]*)?\}\}/g;
    const names = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = varRegex.exec(template)) !== null) {
      // 跳过块标记的闭合标签（{{/key}}）
      if (match[1] !== '/') {
        names.add(match[2]);
      }
    }

    return Array.from(names);
  }

  /**
   * 检查模板中未赋值的变量
   */
  findUnresolvedVariables(
    template: string,
    variables: SkillPromptVariables,
  ): string[] {
    const names = this.extractVariableNames(template);
    return names.filter((name) => {
      const value: unknown = this.resolveValue(name, variables);
      return value === undefined || value === null;
    });
  }

  // ===================== !`command` 预处理脚本注入 =====================

  /**
   * 处理 Prompt 中的 !`command` 脚本注入语法（参照 Claude Code Skills）
   *
   * 扫描已插值的 Prompt 文本，找到所有 !`command` 占位符，
   * 在 Prompt 发送给 LLM 之前执行这些命令，并将 stdout 替换回原位。
   *
   * 语法：!`command args...`
   * 示例：
   *   !`node scripts/gather_stats.js`
   *   !`bash scripts/check_env.sh`
   *   !`cat references/EXTRA_RULES.md`
   *
   * 命令以 Skill 目录（dirPath）作为 cwd 执行，通过安全沙箱注入环境变量。
   * 命令超时默认 30 秒。执行失败时替换为错误提示文本（不中止整体流程）。
   *
   * @param prompt   变量插值后的 Prompt 文本
   * @param dirPath  Skill 目录绝对路径（命令的 cwd）
   * @param env      注入的环境变量
   * @returns 替换脚本输出后的 Prompt 文本
   */
  async processScriptInjections(
    prompt: string,
    dirPath: string,
    env: Record<string, string> = {},
  ): Promise<string> {
    // 匹配 !`...` 语法（支持跨行命令，但通常为单行）
    const scriptPattern = /!\`([^`]+)\`/g;
    const matches: Array<{ fullMatch: string; command: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = scriptPattern.exec(prompt)) !== null) {
      matches.push({
        fullMatch: match[0],
        command: match[1].trim(),
      });
    }

    if (matches.length === 0) {
      return prompt;
    }

    this.logger.log(
      `发现 ${matches.length} 个 !\`command\` 脚本注入: ${matches.map((m) => m.command).join(', ')}`,
    );

    // 并行执行所有命令（通过安全沙箱）
    const results = await Promise.all(
      matches.map(async ({ fullMatch, command }) => {
        try {
          const output = await this.sandbox.executeCommand(command, dirPath, {
            env,
          });
          this.logger.log(
            `脚本注入执行成功: ${command} → ${output.length} chars`,
          );
          return { fullMatch, output };
        } catch (err: any) {
          this.logger.warn(`脚本注入执行失败: ${command} → ${err?.message}`);
          return {
            fullMatch,
            output: `[⚠️ 脚本执行失败: ${command}]\n错误: ${err?.message}`,
          };
        }
      }),
    );

    // 按顺序替换（使用简单字符串替换以支持重复出现）
    let result = prompt;
    for (const { fullMatch, output } of results) {
      result = result.replace(fullMatch, output);
    }

    return result;
  }
}
